import { JsonRpc } from 'eosjs';
import fetch from 'node-fetch';
import ky from 'ky';
import config from '../config.js';
import { getNodeAndRpc } from '../validate/validateCore.js';

const getProducers = async (chain, top21Producers, retries = 3) => {
  for (let i = 0; i < retries; i++) {
    try {
      const endpoint = await config.chains[chain].getEndpoint();
      console.log(`Try ${i + 1}: Using endpoint for ${chain}:`, endpoint);

      if (typeof endpoint !== 'string' || !endpoint) {
        throw new Error(`Invalid endpoint for ${chain}: ${endpoint}`);
      }

      const rpc = new JsonRpc(endpoint, { fetch });
      const response = await rpc.get_table_rows({
        json: true,
        code: 'eosio',
        scope: 'eosio',
        table: 'producers',
        limit: 150,
        reverse: false,
        show_payer: false
      });

      if (!response || !Array.isArray(response.rows)) {
        throw new Error('Invalid response format');
      }

      return response.rows
        .filter(producer => producer.total_votes > 0 && producer.is_active === 1) // Only include active producers with votes
        .map(producer => ({
          ...producer,
          top21: top21Producers.includes(producer.owner)
        }));

    } catch (error) {
      console.error(`Attempt ${i + 1} failed for ${chain}:`, error);
      if (i === retries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000)); // 1s delay between retries
    }
  }
};

const getProducerChainJson = async (chain, rpc) => {
  console.log(`Starting getProducerChainJson for chain ${chain}`);
  try {

    const response = await rpc.get_table_rows({
      json: true,
      code: 'producerjson',
      scope: 'producerjson',
      table: 'producerjson',
      limit: 200,
      reverse: false,
      show_payer: false
    });

    if (!response || !response.rows) {
      console.log('Response or response.rows is undefined');
      return null;
    }

    return response.rows.map(row => ({
      owner: row.owner,
      json: JSON.parse(row.json)
    }));
  } catch (error) {
    console.error(`Error in getProducerChainJson for ${chain}:`, error);
    throw error;
  }
};
/* 
const fetchChainJson = async (url) => {
  try {
    const response = await ky.get(url).json();
    return response;
  } catch (error) {
    console.error(`Error fetching chain.json from ${url}:`, error);
    return null;
  }
};

const fetchProducerJson = async (url) => {
  try {
    const response = await ky.get(url).json();
    return response;
  } catch (error) {
    console.error(`Error fetching producer JSON from ${url}:`, error);
    return null;
  }
}; */

const parseProducerServices = (producerJson) => {
  if (!producerJson || !producerJson.nodes) return [];

  return producerJson.nodes
    .filter(node => node.node_type !== 'producer') // Ignore nodes with type 'producer'
    .map(node => ({
      node_type: node.node_type,
      api_endpoint: node.api_endpoint,
      ssl_endpoint: node.ssl_endpoint,
      p2p_endpoint: node.p2p_endpoint,
      features: node.features,
      is_full: node.full || false,
      location: node.location,
    }));
};

const getPriceFeedData = async (chain, nodePulse, count = 100, maxRetries = 3) => {
  console.log(`Getting Pricefeed data for ${chain}`);
  let retries = 0;

  while (retries < maxRetries) {
    try {
      const { endpoint: api } = await getNodeAndRpc(nodePulse);
      const url = `${api}/v2/history/get_actions`;
      
      const response = await ky.get(url, {
        searchParams: {
          limit: count,
          account: 'delphioracle'
        },
        timeout: 30000 // 30 seconds timeout
      }).json();
     
      if (!response || !response.actions || response.actions.length === 0) {
        console.log(`No data received from ${api}, retrying...`);
        retries++;
        continue;
      }

      console.log(`Received ${response.actions.length} actions`);
      const guilds = response.actions;
      const producerFinal = [];

      for (const guild of guilds) {
        if (guild.act.data.quotes && guild.act.data.quotes.length > 0) {
          producerFinal.push({
            owner: guild.act.data.owner,
            quoteCount: guild.act.data.quotes.length
          });
        }
      }
      // Remove duplicates
      const uniqueProducers = [...new Set(producerFinal)];

      return uniqueProducers;
    } catch (error) {
      console.error(`Error in getPriceFeedData for ${chain}:`, error);
      retries++;
      if (retries < maxRetries) {
        console.log(`Retrying... (Attempt ${retries + 1} of ${maxRetries})`);
      }
    }
  }

  throw new Error(`Failed to get price feed data for ${chain} after ${maxRetries} attempts`);
};

const getCpuData = async (chain, rpc, nodePulse, count) => {
  // Set count based on the chain
  count = chain === 'mainnet' ? 120 : 200;

  console.log(`Getting CPU Results for ${chain} with count ${count}`);
  try {
    const actions = await getEosmechanicsActions(rpc, count);
    const producerFinal = [];
    let { endpoint: api } = await getNodeAndRpc(nodePulse);
    console.log(`Initial API: ${api}`);

    let transactionCount = 0;

    for (const action of actions) {
      const trxId = action.trx_id;
      let retries = 0;
      const maxRetries = 3;

      while (retries < maxRetries) {
        try {
          const fullTrx = await ky.get(`${api}/v2/history/get_transaction`, {
            searchParams: { id: trxId },
            timeout: 50000
          }).json();

          if (fullTrx && fullTrx.actions && fullTrx.actions.length > 0) {
            const firstAction = fullTrx.actions[0];
            const cpuStats = firstAction.cpu_usage_us;
            const producer = firstAction.producer;
            
            if (cpuStats !== undefined && producer) {
              producerFinal.push({ producer, cpuStats, trxId });
              transactionCount++;
              break;
            }
          }
          // If we reach here, fullTrx doesn't contain the expected data
          console.log(`Invalid data for transaction ${trxId}. Retrying with a new endpoint.`);
          retries++;
          ({ endpoint: api } = await getNodeAndRpc(nodePulse));
          console.log(`New API: ${api}`);

        } catch (error) {
          console.error(`Error processing transaction ${trxId}:`, error);
          retries++;
          ({ endpoint: api } = await getNodeAndRpc(nodePulse));
          console.log(`Error occurred. Retrying with a new endpoint. New API: ${api}`);
        }
      }

      if (retries === maxRetries) {
        console.log(`Max retries reached for transaction ${trxId}. Moving to next transaction.`);
      }

      // // Change API node after every 5 transactions
      // if (transactionCount % 5 === 0) {
      //   ({ endpoint: api } = await getNodeAndRpc(nodePulse));
      //   console.log(`Changing API after 5 transactions. New API: ${api}`);
      // }
    }
    console.log(`Total transactions processed: ${transactionCount}`);
    return producerFinal;
  } catch (error) {
    console.error(`Error in getCpuData for ${chain}:`, error);
    throw error;
  }
};

const getEosmechanicsActions = async (rpc, count) => {
  const result = await rpc.history_get_actions('eosmechanics', -1, -count);
  return result.actions.map(action => ({
    trx_id: action.action_trace.trx_id,
  }));
};

const getTop21Producers = async (chain, nodePulse) => {
  try {
    const { endpoint: api } = await getNodeAndRpc(nodePulse);
    const url = `${api}/v2/history/get_schedule`;
    
    const response = await ky.get(url, { timeout: 30000 }).json();
    
    if (!response || !response.producers || response.producers.length === 0) {
      throw new Error('Invalid response from get_schedule');
    }

    return response.producers.map(producer => producer.name);
  } catch (error) {
    console.error(`Error fetching top 21 producers for ${chain}:`, error);
    return [];
  }
};

export { getProducers, parseProducerServices, getProducerChainJson, getPriceFeedData, getCpuData, getTop21Producers };
