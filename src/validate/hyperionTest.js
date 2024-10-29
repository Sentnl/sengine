import kyInstance from '../utils/kyInstance.js';
import { getApiNodes } from './validateCore.js';
import config from '../config.js';
import { TEST_TYPES } from '../helpers/TestTypes.js';
import { Logger } from '../helpers/Logger.js';
import { generateCurlCommandFromKyConfig } from '../helpers/curlGenerator.js';
import { measureResponseTime } from '../helpers/measureResponseTime.js';
import { runTest, saveMultipleFailedResults, evaluateTestResults } from '../helpers/testRunner.js'; 


const runHyperionTest = async (producerId, chain, { endpoint, isFull }, validationData, nodeType, validateResultId, producerServiceId) => {
  // Define important tests (add test results here that must pass)
  const importantTests = [];
  // Variables to evaluate whether this node is a pass or not.
  let totalTests = 0;
  let passedTests = 0;
  console.log(`producerServiceId: ${producerServiceId}`)

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
    validateResultId,
    producerServiceId
  });

  // 2. Combined health, HTTP, and CORS check
  const healthUrl = `${endpoint}/v2/health`;
  const corsConfig = { headers: { 'Origin': 'https://wax.sengine.co' } };
  const healthCurl = generateCurlCommandFromKyConfig(healthUrl, corsConfig);

  try {
    const { result: response, responseTime } = await measureResponseTime(() => kyInstance.get(healthUrl, corsConfig));
    const healthResponse = await response.json();
    // HTTP check
    const httpResult = await runTest({
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
      validateResultId,
      producerServiceId
    });
    totalTests++;
    if (httpResult) passedTests++
    importantTests.push(httpResult);
    
    // Health check
    const healthResult = await runTest({
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
      validateResultId,
      producerServiceId
    });
    totalTests++;
    if (httpResult) passedTests++;


    // CORS check
    const corsHeader = response.headers.get('access-control-allow-origin');
    const corsValues = corsHeader ? corsHeader.split(',').map(v => v.trim()) : [];
    const corsOk = corsValues.includes('*') || corsValues.includes('https://wax.sengine.co');
    const corsResult = await runTest({
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
      validateResultId,
      producerServiceId
    });
    totalTests++;
    if (corsResult) passedTests++;
    importantTests.push(corsResult);

    // Services and Missing Blocks
    const healthOk = healthResponse.health && Array.isArray(healthResponse.health);
    if (healthOk) {
      // Hyperion services are OK
      const servicesOk = healthResponse.health.every(service => service.status === 'OK');
      const failedServices = healthResponse.health
        .filter(service => service.status !== 'OK')
        .map(service => service.service)
        .join(', ');

    const servicesResult = await runTest({
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
        validateResultId,
        producerServiceId
      });
      totalTests++;
      if (servicesResult) passedTests++;
      importantTests.push(servicesResult);

      // Any Missing Blocks
      const missingBlocks = parseInt(
        healthResponse.health.find(service => service.service === 'Elasticsearch')?.service_data?.missing_blocks || '0',
        10
      );
      const missingBlocksResult = await runTest({
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
        validateResultId,
        producerServiceId
      });
      totalTests++;
      if (missingBlocksResult) passedTests++;
      importantTests.push(missingBlocksResult);
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
      validateResultId,
      producerServiceId
    });
    // If all tests fail just manually state that 3 Tests were performed
    totalTests += 3;
  }

  // HTTPS is available
  const httpsEndpoint = endpoint.replace('http://', 'https://');
  const httpsCurl = generateCurlCommandFromKyConfig(`${httpsEndpoint}/v2/health`);
  const httpsResult = await runTest({
    producerId,
    chain,
    testType: TEST_TYPES.CORE.HTTPS,
    url: `${httpsEndpoint}/v2/health`,
    method: 'GET',
    curlCmd: httpsCurl,
    nodeType,
    testFunction: () => kyInstance.get(`${httpsEndpoint}/v2/health`),
    successCondition: () => true,
    validateResultId,
    producerServiceId
  });
  totalTests++;
  if (httpsResult) passedTests++;
  importantTests.push(httpsResult);

  // 4. get_transaction test
  const transactionCurl = generateCurlCommandFromKyConfig(`${endpoint}/v2/history/get_transaction`, { searchParams: { id: validationData.transaction } });
  const transactionResult = await runTest({
    producerId,
    chain,
    testType: TEST_TYPES.HYPERION.GET_TRANSACTION,
    url: `${endpoint}/v2/history/get_transaction`,
    method: 'GET',
    curlCmd: transactionCurl,
    nodeType,
    testFunction: () => kyInstance.get(`${endpoint}/v2/history/get_transaction`, { searchParams: { id: validationData.transaction } }).json(),
    successCondition: (result) => result.query_time_ms !== undefined,
    onErrorMessage: 'Invalid transaction response',
    validateResultId,
    producerServiceId
  });
  totalTests++;
  if (transactionResult) passedTests++;

  // 5. get_actions test
  const actionsCurl = generateCurlCommandFromKyConfig(`${endpoint}/v2/history/get_actions`, { searchParams: { limit: 1 } });
  const actionsResult = await runTest({
    producerId,
    chain,
    testType: TEST_TYPES.HYPERION.GET_ACTIONS,
    url: `${endpoint}/v2/history/get_actions`,
    method: 'GET',
    curlCmd: actionsCurl,
    nodeType,
    testFunction: () => kyInstance.get(`${endpoint}/v2/history/get_actions`, { searchParams: { limit: 1 } }).json(),
    successCondition: (result) => result.actions && Array.isArray(result.actions),
    onErrorMessage: 'Invalid actions response',
    validateResultId,
    producerServiceId
  });
  totalTests++;
  if (actionsResult) passedTests++;

  // 6. get_key_accounts test
  const keyAccountsCurl = generateCurlCommandFromKyConfig(`${endpoint}/v2/state/get_key_accounts`, { 
    searchParams: { public_key: config.chains[chain].publicKey } 
  });
  const keyAccountsResult = await runTest({
    producerId,
    chain,
    testType: TEST_TYPES.HYPERION.GET_KEY_ACCOUNTS,
    url: `${endpoint}/v2/state/get_key_accounts`,
    method: 'GET',
    curlCmd: keyAccountsCurl,
    nodeType,
    testFunction: () => kyInstance.get(`${endpoint}/v2/state/get_key_accounts`, { 
      searchParams: { public_key: config.chains[chain].publicKey } 
    }).json(),
    successCondition: (result) => result.account_names !== undefined,
    onErrorMessage: 'Invalid key accounts response',
    validateResultId,
    producerServiceId
  });
  totalTests++;
  if (keyAccountsResult) passedTests++;

  // 7. Partial Hyperion test
  if (!isFull) {
    const now = new Date();
    const timestamp42DaysAgo = new Date(now.getTime() - 42 * 24 * 60 * 60 * 1000);
    const timestamp41DaysAgo = new Date(now.getTime() - 41 * 24 * 60 * 60 * 1000);
    const partialCurl = generateCurlCommandFromKyConfig(`${endpoint}/v2/history/get_actions`, {
      searchParams: {
        limit: 1,
        before: timestamp41DaysAgo.toISOString(),
        after: timestamp42DaysAgo.toISOString(),
      },
    });
    const partialResult = await runTest({
      producerId,
      chain,
      testType: TEST_TYPES.HYPERION.PARTIAL,
      url: `${endpoint}/v2/history/get_actions`,
      method: 'GET',
      curlCmd: partialCurl,
      nodeType,
      testFunction: () => kyInstance.get(`${endpoint}/v2/history/get_actions`, {
        searchParams: {
          limit: 1,
          before: timestamp41DaysAgo.toISOString(),
          after: timestamp42DaysAgo.toISOString(),
        },
      }).json(),
      successCondition: (result) => result.actions !== undefined,
      onErrorMessage: 'Invalid partial Hyperion response',
      validateResultId,
      producerServiceId
    });
    totalTests++;
    if (partialResult) passedTests++;
  }
  const testsPassed = evaluateTestResults(passedTests, totalTests, importantTests);
  console.log(`${nodeType} Tests: ${passedTests}/${totalTests}`);
  return testsPassed;
};


export const runAllHyperionTests = async (producerId, chain, validationData, validateResultId) => {
  const nodeType = 'hyperion-v2'
  const hyperionNodes = await getApiNodes(producerId, nodeType);
  let runningHyperionNodes = false;

  if (hyperionNodes.length === 0) {
    Logger.log('No Hyperion nodes found for this producer', 'Passed');
    return [runningHyperionNodes, false];
  }

  runningHyperionNodes = true;
  let anyTestPassed = false;
  for (let { producerServiceId, endpoint, isFull } of hyperionNodes) {
    // Remove trailing slash if present
    endpoint = endpoint.replace(/\/$/, '');
    
    Logger.log('', `${nodeType}: ${endpoint}`);
    const endpointTestsPassed = await runHyperionTest(producerId, chain, { endpoint, isFull }, validationData, nodeType, validateResultId, producerServiceId);
    console.log(`${nodeType} Endpoint passed: ${endpointTestsPassed}`);
    anyTestPassed = anyTestPassed || endpointTestsPassed;
  }
  Logger.log('', '----------------------------------------');
  console.log(`Is one endpoint working: ${anyTestPassed}`);
  Logger.log('', '----------------------------------------');
  return [runningHyperionNodes, anyTestPassed];
};
