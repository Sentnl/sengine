import { JsonRpc } from 'eosjs';
import fetch from 'node-fetch';
import ky from 'ky';
import NodePulse from '@sentnl/nodepulse';
import { getDatabase } from '../models/db.js';
import { Logger } from '../helpers/Logger.js';

const mainnetNodePulse = new NodePulse({
  nodeType: 'hyperion',
  network: 'mainnet',
});

const testnetNodePulse = new NodePulse({
  nodeType: 'hyperion',
  network: 'testnet',
});

const mainnetAtomicNodePulse = new NodePulse({
  nodeType: 'atomic',
  network: 'mainnet',
});

const getNodeAndRpc = async (nodePulse) => {
  const endpoint = await nodePulse.getNode();
  return { endpoint, rpc: new JsonRpc(endpoint, { fetch }) };
};

export const getValidationData = async (chain) => {
  const nodePulse = chain === 'mainnet' ? mainnetNodePulse : testnetNodePulse;
  let nodeAttempts = 0;
  const maxNodeAttempts = 5;

  while (nodeAttempts < maxNodeAttempts) {
    try {
      const { endpoint, rpc } = await getNodeAndRpc(nodePulse);
      console.log(`Using ${chain} endpoint:`, endpoint);

      // 1. Get the latest headblock
      const info = await rpc.get_info();
      let latestHeadBlock = info.head_block_num;

      // 2. Get a transaction from the latest headblock or previous blocks
      let transaction = null;
      let blockAttempts = 0;
      const maxBlockAttempts = 100;

      while (!transaction && blockAttempts < maxBlockAttempts) {
        try {
          const block = await rpc.get_block(latestHeadBlock - blockAttempts);
          if (block.transactions && block.transactions.length > 0) {
            transaction = block.transactions[0]?.trx?.id || null;
          }
          blockAttempts++;
        } catch (blockError) {
          console.warn(`Error fetching block ${latestHeadBlock - blockAttempts}:`, blockError);
          blockAttempts++;
        }
      }

      if (!transaction) {
        console.warn(`Unable to find a transaction after ${blockAttempts} attempts for ${chain}`);
      }

      let atomicAssetId = null;
      let delphioracleActions = null;

      if (chain === 'mainnet') {
        // 3. Get an Atomic AssetId (only for mainnet)
        const atomicEndpoint = await mainnetAtomicNodePulse.getNode();
        const atomicAssetResponse = await ky.get(`${atomicEndpoint}/atomicassets/v1/assets?page=1&limit=1&order=desc&sort=asset_id`).json();
        atomicAssetId = atomicAssetResponse.data[0]?.asset_id || null;

        // 4. Get delphioracle actions (only for mainnet)
        const actions = await rpc.history_get_actions('delphioracle', -1, -100);
        delphioracleActions = actions.actions.map(action => action.action_trace);
      }

      return {
        latestHeadBlock,
        transaction,
        atomicAssetId,
        delphioracleActions
      };
    } catch (error) {
      console.error(`Error with ${chain} node, attempt ${nodeAttempts + 1}:`, error);
      nodeAttempts++;
      if (nodeAttempts >= maxNodeAttempts) {
        throw new Error(`Failed to get validation data for ${chain} after ${maxNodeAttempts} attempts`);
      }
    }
  }
};

export const saveTestResult = async (
  producerId,
  chain,
  testType,
  isSuccessful,
  urlCalled,
  responseTime,
  statusCode,
  errorMessage,
  curlCmd,
  type // Added new parameter
) => {
  const db = getDatabase();
  const query = `
    INSERT INTO validate_results (
      producer_id,
      chain,
      test_type,
      is_successful,
      url_called,
      response_time,
      status_code,
      error_message,
      curl_command,
      type
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
  `;
  await db.query(query, [
    producerId,
    chain,
    testType,
    isSuccessful,
    urlCalled,
    responseTime,
    statusCode,
    errorMessage,
    curlCmd,
    type, // Added new value
  ]);
};

export const saveTestResultWrapper = async (producerId, chain, testType, passed, url, responseTime, statusCode, errorMessage, curlCommand, nodeType) => {
  Logger.log(testType, passed ? 'Passed' : 'Failed', errorMessage || '');
  await saveTestResult(producerId, chain, testType, passed, url, responseTime, statusCode, passed ? null : errorMessage, curlCommand, nodeType);
};

export const getHyperionNodes = async (producerId) => {
  const db = getDatabase();
  const query = `
    SELECT api_endpoint, is_full 
    FROM producer_services 
    WHERE producer_id = $1 
    AND $2 = ANY(node_type)
    AND $3 = ANY(features)
  `;
  const result = await db.query(query, [producerId, 'query', 'hyperion-v2']);
  return result.rows.map(row => ({ endpoint: row.api_endpoint, isFull: row.is_full }));
};

export const getProducerName = async (producerId) => {
  const db = getDatabase();
  const query = 'SELECT name FROM producers WHERE id = $1';
  const result = await db.query(query, [producerId]);
  
  if (result.rows.length > 0) {
    return result.rows[0].name;
  } else {
    return `Producer${producerId}`;  // Fallback if not found
  }
};

export const getApiNodes = async (producerId) => {
  const db = getDatabase();
  const query = `
    SELECT api_endpoint 
    FROM producer_services 
    WHERE producer_id = $1 
    AND $2 = ANY(node_type)
    AND $3 = ANY(features)
  `;
  const result = await db.query(query, [producerId, 'query', 'chain-api']);
  return result.rows.map(row => row.api_endpoint);
};

export const getSeedNodes = async (producerId) => {
  const db = getDatabase();
  const query = `
    SELECT api_endpoint 
    FROM producer_services 
    WHERE producer_id = $1 
    AND $2 = ANY(node_type)
    AND $3 = ANY(features)
  `;
  const result = await db.query(query, [producerId, 'seed', 'seed']);
  return result.rows.map(row => row.api_endpoint);
};