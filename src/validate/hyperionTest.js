import ky from 'ky';
import { getHyperionNodes } from './validateCore.js';
import config from '../config.js';
import { TEST_TYPES } from '../helpers/TestTypes.js';
import { Logger } from '../helpers/Logger.js';
import { generateCurlCommandFromKyConfig } from '../helpers/curlGenerator.js';
import { measureResponseTime } from '../helpers/measureResponseTime.js';
import { runTest, saveMultipleFailedResults } from '../helpers/testRunner.js'; 
import { checkHttp2 } from '../utils/http2Checker.js';

const runHyperionTest = async (producerId, chain, { endpoint, isFull }, validationData, nodeType = 'hyperion') => {

  // 1. Node is correctly marked as full
  const fullNodeCurl = generateCurlCommandFromKyConfig(endpoint);
  await runTest({
    producerId,
    chain,
    testType: TEST_TYPES.HYPERION.FULL_NODE,
    url: endpoint,
    method: 'GET',
    curlCmd: fullNodeCurl,
    nodeType,
    testFunction: () => Promise.resolve(),
    successCondition: () => isFull,
    onErrorMessage: 'Node is not marked as full',
  });

  // 2. Combined health, HTTP, and CORS check
  const healthUrl = `${endpoint}/v2/health`;
  const corsConfig = { headers: { 'Origin': 'https://wax.sengine.co' } };
  const healthCurl = generateCurlCommandFromKyConfig(healthUrl, corsConfig);

  try {
    const { result: response, responseTime } = await measureResponseTime(() => ky.get(healthUrl, corsConfig));
    const healthResponse = await response.json();
    // HTTP check
    await runTest({
      producerId,
      chain,
      testType: TEST_TYPES.CORE.HTTP,
      url: healthUrl,
      method: 'GET',
      curlCmd: healthCurl,
      nodeType,
      existingResult: response,
      existingResponseTime: responseTime,
      successCondition: (response) => response.status === 200,
      onErrorMessage: 'HTTP request failed',
    });
    
    // Health check
    console.log('Version:', healthResponse.version);
    await runTest({
      producerId,
      chain,
      testType: TEST_TYPES.HYPERION.HEALTH,
      url: healthUrl,
      method: 'GET',
      curlCmd: healthCurl,
      nodeType,
      existingResponseTime: responseTime,
      version: healthResponse.version ,
      testFunction: () => Promise.resolve({ healthResponse }),
      successCondition: ({ healthResponse }) => healthResponse.health && Array.isArray(healthResponse.health),
      onErrorMessage: 'Health endpoint not available',
    });



    // CORS check
    const corsHeader = response.headers.get('access-control-allow-origin');
    const corsValues = corsHeader ? corsHeader.split(',').map(v => v.trim()) : [];
    const corsOk = corsValues.includes('*') || corsValues.includes('https://wax.sengine.co');
    await runTest({
      producerId,
      chain,
      testType: TEST_TYPES.CORE.CORS,
      url: healthUrl,
      method: 'GET',
      curlCmd: healthCurl,
      nodeType,
      existingResponseTime: responseTime,
      testFunction: () => Promise.resolve(),
      successCondition: () => corsOk,
      onErrorMessage: 'CORS not properly configured',
    });

    // Services and Missing Blocks
    const healthOk = healthResponse.health && Array.isArray(healthResponse.health);
    if (healthOk) {
      // Hyperion services are OK
      const servicesOk = healthResponse.health.every(service => service.status === 'OK');
      const failedServices = healthResponse.health
        .filter(service => service.status !== 'OK')
        .map(service => service.service)
        .join(', ');

      await runTest({
        producerId,
        chain,
        testType: TEST_TYPES.HYPERION.SERVICES,
        url: healthUrl,
        method: 'GET',
        curlCmd: healthCurl,
        nodeType,
        existingResponseTime: responseTime,
        testFunction: () => Promise.resolve(),
        successCondition: () => servicesOk,
        onErrorMessage: `Failed services: ${failedServices}`,
      });

      // Any Missing Blocks
      const missingBlocks = parseInt(
        healthResponse.health.find(service => service.service === 'Elasticsearch')?.service_data?.missing_blocks || '0',
        10
      );
      await runTest({
        producerId,
        chain,
        testType: TEST_TYPES.HYPERION.MISSING_BLOCKS,
        url: healthUrl,
        method: 'GET',
        curlCmd: healthCurl,
        nodeType,
        existingResponseTime: responseTime,
        testFunction: () => Promise.resolve(),
        successCondition: () => missingBlocks === 0,
        onErrorMessage: `Missing blocks: ${missingBlocks}`,
      });
    }
  } catch (error) {
    await saveMultipleFailedResults({
      producerId,
      chain,
      testTypes: [
        TEST_TYPES.HYPERION.HEALTH,
        TEST_TYPES.CORE.HTTP,
        TEST_TYPES.CORE.CORS,
      ],
      url: healthUrl,
      error,
      curlCmd: healthCurl,
      nodeType,
      method: 'GET',
    });
  }

  // HTTP/2 check with timeout
  const http2Endpoint = endpoint.replace('http://', 'https://');
  const http2Curl = generateCurlCommandFromKyConfig(`${http2Endpoint}/v2/health`, { headers: { ':method': 'GET' } });

  await runTest({
    producerId,
    chain,
    testType: TEST_TYPES.CORE.HTTP2,
    url: `${http2Endpoint}/v2/health`,
    method: 'GET',
    curlCmd: http2Curl,
    nodeType,
    testFunction: () => checkHttp2(http2Endpoint),
    successCondition: (result) => result.success,
    onErrorMessage: (result) => result.error || 'HTTP/2 connection failed',
  });

  // HTTPS is available
  const httpsEndpoint = endpoint.replace('http://', 'https://');
  const httpsCurl = generateCurlCommandFromKyConfig(`${httpsEndpoint}/v2/health`);
  await runTest({
    producerId,
    chain,
    testType: TEST_TYPES.CORE.HTTPS,
    url: `${httpsEndpoint}/v2/health`,
    method: 'GET',
    curlCmd: httpsCurl,
    nodeType,
    testFunction: () => ky.get(`${httpsEndpoint}/v2/health`),
    successCondition: () => true,
  });

  // 4. get_transaction test
  const transactionCurl = generateCurlCommandFromKyConfig(`${endpoint}/v2/history/get_transaction`, { searchParams: { id: validationData.transaction } });
  await runTest({
    producerId,
    chain,
    testType: TEST_TYPES.HYPERION.GET_TRANSACTION,
    url: `${endpoint}/v2/history/get_transaction`,
    method: 'GET',
    curlCmd: transactionCurl,
    nodeType,
    testFunction: () => ky.get(`${endpoint}/v2/history/get_transaction`, { searchParams: { id: validationData.transaction } }).json(),
    successCondition: (result) => result.query_time_ms !== undefined,
    onErrorMessage: 'Invalid transaction response',
  });

  // 5. get_actions test
  const actionsCurl = generateCurlCommandFromKyConfig(`${endpoint}/v2/history/get_actions`, { searchParams: { limit: 1 } });
  await runTest({
    producerId,
    chain,
    testType: TEST_TYPES.HYPERION.GET_ACTIONS,
    url: `${endpoint}/v2/history/get_actions`,
    method: 'GET',
    curlCmd: actionsCurl,
    nodeType,
    testFunction: () => ky.get(`${endpoint}/v2/history/get_actions`, { searchParams: { limit: 1 } }).json(),
    successCondition: (result) => result.actions && Array.isArray(result.actions),
    onErrorMessage: 'Invalid actions response',
  });

  // 6. get_key_accounts test
  const keyAccountsCurl = generateCurlCommandFromKyConfig(`${endpoint}/v2/state/get_key_accounts`, { searchParams: { public_key: config.publicKey } });
  await runTest({
    producerId,
    chain,
    testType: TEST_TYPES.HYPERION.GET_KEY_ACCOUNTS,
    url: `${endpoint}/v2/state/get_key_accounts`,
    method: 'GET',
    curlCmd: keyAccountsCurl,
    nodeType,
    testFunction: () => ky.get(`${endpoint}/v2/state/get_key_accounts`, { searchParams: { public_key: config.publicKey } }).json(),
    successCondition: (result) => result.account_names !== undefined,
    onErrorMessage: 'Invalid key accounts response',
  });

  // 7. Partial Hyperion test
  if (!isFull) {
    const timestamp42DaysAgo = new Date(config.timestamp42DaysAgo);
    const timestamp41DaysAgo = new Date(timestamp42DaysAgo.getTime() + 24 * 60 * 60 * 1000);
    const partialCurl = generateCurlCommandFromKyConfig(`${endpoint}/v2/history/get_actions`, {
      searchParams: {
        limit: 1,
        before: timestamp41DaysAgo.toISOString(),
        after: timestamp42DaysAgo.toISOString(),
      },
    });
    await runTest({
      producerId,
      chain,
      testType: TEST_TYPES.HYPERION.PARTIAL,
      url: `${endpoint}/v2/history/get_actions`,
      method: 'GET',
      curlCmd: partialCurl,
      nodeType,
      testFunction: () => ky.get(`${endpoint}/v2/history/get_actions`, {
        searchParams: {
          limit: 1,
          before: timestamp41DaysAgo.toISOString(),
          after: timestamp42DaysAgo.toISOString(),
        },
      }).json(),
      successCondition: (result) => result.actions !== undefined,
      onErrorMessage: 'Invalid partial Hyperion response',
    });
  }
};


export const runAllHyperionTests = async (producerId, chain, validationData) => {
  const hyperionNodes = await getHyperionNodes(producerId);

  if (hyperionNodes.length === 0) {
    Logger.log('No Hyperion nodes found for this producer', 'Passed');
    return;
  }
  for (const node of hyperionNodes) {
    Logger.log('', `Hyperion: ${node.endpoint}`);
    await runHyperionTest(producerId, chain, node, validationData, 'hyperion');
  }
};