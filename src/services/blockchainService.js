import { JsonRpc } from 'eosjs';
import fetch from 'node-fetch';
import got from 'got';
import config from '../config.js';

const getProducers = async (chain) => {
  try {
    const endpoint = await config.chains[chain].getEndpoint();
    console.log(`Retrieved endpoint for ${chain}:`, endpoint);

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

    return response.rows;
  } catch (error) {
    console.error(`Error getting producers for ${chain}:`, error);
    throw error;
  }
};

const fetchChainJson = async (url) => {
  try {
    const response = await got(url).json();
    return response;
  } catch (error) {
    console.error(`Error fetching chain.json from ${url}:`, error);
    return null;
  }
};

const fetchProducerJson = async (url) => {
  try {
    const response = await got(url).json();
    return response;
  } catch (error) {
    console.error(`Error fetching producer JSON from ${url}:`, error);
    return null;
  }
};

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

export { getProducers, fetchChainJson, fetchProducerJson, parseProducerServices };