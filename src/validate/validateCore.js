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
import { runAllApiTests } from './ApiTest.js';
import { runAllHistoryTests } from './HistoryTest.js';
import { runAllHyperionTests } from './hyperionTest.js';
import { runGuildTests } from './guildTest.js';
import { runAllP2PTests } from './P2PTest.js';
import { runAllAtomicTests } from './AtomicTest.js';
import { runPriceFeedTests } from './PriceFeedTest.js';
import { saveValidateResult, updateValidateResult } from '../services/dataService.js';
import { getProducerChainJson, getCpuData, getPriceFeedData } from '../services/blockchainService.js';

const mainnetNodePulse = new NodePulse({
  nodeType: 'hyperion',
  network: 'mainnet',
  nodeCount: 5,
  historyfull: true
});

const testnetNodePulse = new NodePulse({
  nodeType: 'hyperion',
  network: 'testnet',
  nodeCount: 5,
  historyfull: true
});

const mainnetAtomicNodePulse = new NodePulse({
  nodeType: 'atomic',
  network: 'mainnet',
});

export const getNodeAndRpc = async (nodePulse) => {
  const endpoint = await nodePulse.getNode();
  return { endpoint, rpc: new JsonRpc(endpoint, { fetch }) };
};

export const getValidationData = async (chain, options = {}) => {
  const { skipCpu = false } = options;
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
      let producerJsonData = {};
      let CpuData = 0;
      let PriceFeed = null;

      if (chain === 'mainnet') {
        // 3. Get an Atomic AssetId (only for mainnet)
        const atomicEndpoint = await mainnetAtomicNodePulse.getNode();
        const atomicAssetResponse = await ky.get(`${atomicEndpoint}/atomicassets/v1/assets?page=1&limit=1&order=desc&sort=asset_id`).json();
        atomicAssetId = atomicAssetResponse.data[0]?.asset_id || null;

        // 4. Get delphioracle actions (only for mainnet)
        const actions = await rpc.history_get_actions('delphioracle', -1, -100);
        delphioracleActions = actions.actions.map(action => action.action_trace);

        // 5. Get Producer JSON data
        console.log('Fetching producer JSON data...');
        try {
          producerJsonData = await getProducerChainJson(chain,rpc);
          if (!producerJsonData) {
            console.log('No producer JSON data returned');
            producerJsonData = {};
          }
        } catch (error) {
          console.error(`Error fetching JSON data for chain ${chain}:`, error);
          producerJsonData = {};
        }

        // 6. Get Pricefeed Data (if not skipped)
        console.log('Fetching PriceFeed data...');
        PriceFeed = await getPriceFeedData(chain, nodePulse);
   
        // 7. Get CPU Data (if not skipped)
        if (!skipCpu) {
          console.log('Fetching CPU data...');
          CpuData = await getCpuData(chain, rpc, nodePulse);
        } else {
          console.log('Skipping CPU data fetch.');
        }

      }
 
      if (chain === 'testnet') {
        if (!skipCpu) {
          console.log('Fetching CPU data...');
          CpuData = await getCpuData(chain, rpc, nodePulse);
        } else {
          console.log('Skipping CPU data fetch.');
        }

      }

       
      return {
        api,
        latestHeadBlock,
        transaction,
        atomicAssetId,
        //delphioracleActions,
        last_irreversible_block_num,
        last_irreversible_block_id,
        head_block_num,
        head_block_id,
        chain_id,
        producerJsonData,
        CpuData,
        PriceFeed,
        skipCpu
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


export async function validateProducer(producerId, chain, validationData) {
  const timestamp = new Date().toISOString();
  
  // Extract CPU value for the specific producer only if not skipping CPU
  let cpuValue = null;
  if (!validationData.skipCpu) {
    const producerName = await getProducerName(producerId);
    const cpuData = validationData.CpuData.find(data => data.producer === producerName);
    cpuValue = cpuData ? cpuData.cpuStats : null; 
  }

  // Create initial entry in validate_results with timestamp, producerID and CPU
  const validateResultId = await saveValidateResult(producerId, {}, timestamp, cpuValue);

  const testResults = {
    guild: await runGuildTests(producerId, chain, validationData, validateResultId),
    api: await runAllApiTests(producerId, chain, validationData, validateResultId),
    history: await runAllHistoryTests(producerId, chain, validationData, validateResultId),
    hyperion: await runAllHyperionTests(producerId, chain, validationData, validateResultId),
    atomicassets: await runAllAtomicTests(producerId, chain, validationData, validateResultId),
    p2p: await runAllP2PTests(producerId, chain, validationData, validateResultId),
  };

  // Only run pricefeed tests for mainnet, return [false, false] for testnet
  testResults.pricefeed = chain === 'mainnet'
    ? await runPriceFeedTests(producerId, chain, validationData, validateResultId)
    : [false, false];

  // Create a results object suitable for updateValidateResult
  const results = {
    guild: testResults.guild,
    api: testResults.api,
    history: testResults.history,
    hyperion: testResults.hyperion,
    atomicassets: testResults.atomicassets,
    p2p: testResults.p2p,
    pricefeed: testResults.pricefeed
  };
  
  // Update the validate_results row with the final results
  await updateValidateResult(validateResultId, results);

  return { results: testResults, timestamp, validateResultId };
}


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
  version = null,
  validateResultId
) => {
  const db = getDatabase();
  const query = `
    INSERT INTO validate_services (
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
      version,
      validate_result_id
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
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
    version,
    validateResultId,
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
  version = null,       // Added version parameter with default null
  validateResultId 
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
    version, // Pass version
    validateResultId
  );
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

export const getAtomicNodes = async (producerId) => {
  const db = getDatabase();
  const query = `
    SELECT api_endpoint 
    FROM producer_services 
    WHERE producer_id = $1 
    AND $2 = ANY(node_type)
    AND $3 = ANY(features)
  `;
  const result = await db.query(query, [producerId, 'query', 'atomic-assets-api']);
  return result.rows.map(row => row.api_endpoint);
};

// General DB function to get Nodes, including special statements to deal with hyperion-v2
export const getApiNodes = async (producerId, nodeFeature) => {
  const db = getDatabase();
  const query = `
    SELECT 
      COALESCE(NULLIF(ssl_endpoint, ''), api_endpoint) AS endpoint
      ${nodeFeature === 'hyperion-v2' ? ', is_full' : ''}
    FROM producer_services 
    WHERE producer_id = $1 
    AND $2 = ANY(node_type)
    AND $3 = ANY(features)
  `;
  const result = await db.query(query, [producerId, 'query', nodeFeature]);
  
  if (nodeFeature === 'hyperion-v2') {
    return result.rows.map(row => ({ endpoint: row.endpoint, isFull: row.is_full }));
  } else {
    return result.rows.map(row => row.endpoint);
  }
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
export async function runTlsSecurityTest({
  producerId,
  chain,
  hostname,
  nodeType = 'core',
  validateResultId
}) {
  // ... existing implementation ...

  return await runTest({
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
    validateResultId,
  });
}

export async function runHttpsCheckTest({
  producerId,
  chain,
  url,
  nodeType = 'core',
  validateResultId
}) {
  return await runTest({
    producerId,
    chain,
    testType: TEST_TYPES.CORE.HTTPS,
    url,
    method: 'GET',
    curlCmd: generateCurlCommandFromKyConfig(url),
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
    validateResultId,
  });
}



