import { JsonRpc } from 'eosjs';
import fetch from 'node-fetch';
import ky from 'ky';
import NodePulse from '@sentnl/nodepulse';
import { getDatabase } from '../models/db.js';
import { Logger } from '../helpers/Logger.js';
import { TEST_TYPES } from '../helpers/TestTypes.js';
import { checkTls } from '../utils/tlsChecker.js';
import { runTest } from '../helpers/testRunner.js';
import { generateCurlCommandFromKyConfig } from '../helpers/curlGenerator.js';
import { getUserFriendlyMessage } from '../helpers/errorHandler.js';

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
      const { endpoint: api, rpc } = await getNodeAndRpc(nodePulse);
      console.log(`Using ${chain} endpoint:`, api);

      // 1. Get the latest headblock and additional info
      const info = await rpc.get_info();
      let latestHeadBlock = info.head_block_num;

      // Extract additional information
      const {
        last_irreversible_block_num,
        last_irreversible_block_id,
        head_block_num,
        head_block_id,
        chain_id
      } = info;
 
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
        api, // Renamed from endpoint to api
        latestHeadBlock,
        transaction,
        atomicAssetId,
        delphioracleActions,
        last_irreversible_block_num,
        last_irreversible_block_id,
        head_block_num,
        head_block_id,
        chain_id
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

// Save Test resulst to the DB
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
  type,
  requestType,
  payload,
  version = null // Added version with default null
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
      type,
      request_type,
      payload,
      version
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
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
    type,
    requestType,
    payload,
    version, // New value
  ]);
};

// Wrapper to save test results to the DB
export const saveTestResultWrapper = async (
  producerId,
  chain,
  testType,
  passed,
  url,
  responseTime,
  statusCode,
  errorMessage,
  curlCommand,
  nodeType,
  requestType = 'GET', // Default to GET
  payload = null,      // Default to null
  version = null       // Added version parameter with default null
) => {
  Logger.log(testType, passed ? 'Passed' : 'Failed', errorMessage || '');
  await saveTestResult(
    producerId,
    chain,
    testType,
    passed,
    url,
    responseTime,
    statusCode,
    errorMessage,
    curlCommand,
    nodeType,
    requestType,
    payload,
    version // Pass version
  );
};


// SHARED DB GET QUERIES
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

export const getHistoryNodes = async (producerId) => {
  const db = getDatabase();
  const query = `
    SELECT api_endpoint 
    FROM producer_services 
    WHERE producer_id = $1 
    AND $2 = ANY(node_type)
    AND $3 = ANY(features)
  `;
  const result = await db.query(query, [producerId, 'query', 'history-v1']);
  return result.rows.map(row => row.api_endpoint);
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
    SELECT p2p_endpoint 
    FROM producer_services 
    WHERE producer_id = $1 
    AND $2 = ANY(node_type)
  `;
  const result = await db.query(query, [producerId, 'seed']);
  return result.rows.map(row => ({ p2p_endpoint: row.p2p_endpoint }));
};


// Shared  Validation TESTS
export const runTlsSecurityTest = async ({
  producerId,
  chain,
  hostname,
  nodeType = 'core',
}) => {
  await runTest({
    producerId,
    chain,
    testType: TEST_TYPES.CORE.TLS_SECURITY,
    url: `${hostname}:443`,
    method: 'GET',
    curlCmd: 'TLS security test',
    nodeType,
    testFunction: () => checkTls(hostname, 443),
    successCondition: (result) => result.isSecure,
    onSuccessMessage: (result) => result.status,
    onErrorMessage: (result) => result.status,
    expectedStatusCode: (result) => (result.isSecure ? 200 : 0),
    saveErrorMessageOnSuccess: true,
  });
};

export const runHttpsCheckTest = async ({
  producerId,
  chain,
  url,
  nodeType = 'core',
}) => {
  const curlCmd = generateCurlCommandFromKyConfig(url);
  
  await runTest({
    producerId,
    chain,
    testType: TEST_TYPES.CORE.HTTPS,
    url,
    method: 'GET',
    curlCmd,
    nodeType,
    testFunction: async () => {
      try {
        const response = await ky.get(url);
        return { success: true, response };
      } catch (error) {
        return { success: false, error };
      }
    },
    successCondition: ({ success }) => success,
    onErrorMessage: (result) => {
      if (result.success === false && result.error) {
        return getUserFriendlyMessage(result.error);
      }
      return 'HTTPS check failed: Unknown error';
    },
    //onErrorMessage: ({ error }) => `HTTPS check failed: ${error?.message || 'Unknown error'}`,
  });
};
