import kyInstance from '../utils/kyInstance.js';
import { getApiNodes, runHttpsCheckTest } from './validateCore.js';
import { TEST_TYPES } from '../helpers/TestTypes.js';
import { Logger } from '../helpers/Logger.js';
import { generateCurlCommandFromKyConfig } from '../helpers/curlGenerator.js';
import { measureResponseTime } from '../helpers/measureResponseTime.js';
import { runTest, saveMultipleFailedResults,evaluateTestResults } from '../helpers/testRunner.js';
import { getUserFriendlyMessage } from '../helpers/errorHandler.js';

const runNodeTest = async (producerId, chain, endpoint, validationData, nodeType, validateResultId, producerServiceId) => {
  if (!endpoint || typeof endpoint !== 'string') {
    console.error(`Invalid endpoint: ${endpoint}`);
    return false;
  }

  const httpsEndpoint = endpoint.replace(/^http:/, 'https:');
  let hostname;
  try {
    ({ hostname } = new URL(httpsEndpoint));
  } catch (error) {
    console.error(`Invalid URL: ${httpsEndpoint}`, error);
    return false;
  }
  // Define important tests (add test results here that must pass)
  const importantTests = [];
  let totalTests = 0;
  let passedTests = 0;

  // HTTPS check
  const httpsHealthUrl = `${httpsEndpoint}/health`;
  const httpsResult = await runHttpsCheckTest({
    producerId,
    chain,
    url: httpsHealthUrl,
    nodeType,
    validateResultId,
    producerServiceId
  });
  totalTests++;
  if (httpsResult) passedTests++;
  importantTests.push(httpsResult);

  // Health check (including HTTP check)
  const healthUrl = `${endpoint}/health`;
  const healthCurl = generateCurlCommandFromKyConfig(healthUrl);

  try {
    const { result: response, responseTime } = await measureResponseTime(() => 
      kyInstance.get(healthUrl, { 
        throwHttpErrors: false,
        timeout: 10000,
      }).then(async res => ({
        status: res.status,
        body: await res.text().then(text => {
          try {
            return JSON.parse(text);
          } catch (e) {
            console.log(`Failed to parse JSON: ${text}`);
            return {};
          }
        })
      }))
    );

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
      version: response.body.data?.version,
      successCondition: (result) => 
        result.status === 200 && 
        result.body.success === true,
      onErrorMessage: (error) => 
        response.status === 200
          ? 'HTTP request successful but response is not as expected'
          : getUserFriendlyMessage(error),
      validateResultId,
      producerServiceId
    });
    totalTests++;
    if (httpResult) passedTests++;
    importantTests.push(httpResult);
    // Check services status
    const servicesResult = await runTest({
      producerId,
      chain,
      testType: TEST_TYPES.ATOMIC.SERVICES,
      url: healthUrl,
      method: 'GET',
      curlCmd: healthCurl,
      nodeType,
      existingResponseTime: responseTime,
      testFunction: () => Promise.resolve({ response }),
      successCondition: () => 
        response.body.data.postgres.status === 'OK' &&
        response.body.data.redis.status === 'OK' &&
        response.body.data.chain.status === 'OK',
      onErrorMessage: 'One or more services are not OK',
      validateResultId,
      producerServiceId
    });
    totalTests++;
    if (servicesResult) passedTests++;
    importantTests.push(servicesResult);

    // Check head block
    const headBlockResult = await runTest({
      producerId,
      chain,
      testType: TEST_TYPES.ATOMIC.HEAD_BLOCK,
      url: healthUrl,
      method: 'GET',
      curlCmd: healthCurl,
      nodeType,
      existingResponseTime: responseTime,
      testFunction: () => Promise.resolve({ response }),
      successCondition: () => 
        response.body.data.chain.head_block >= validationData.latestHeadBlock - 10,
      onErrorMessage: 'Head block is not up-to-date',
      validateResultId,
      producerServiceId
    });
    totalTests++;
    if (headBlockResult) passedTests++;
    importantTests.push(headBlockResult);

  } catch (error) {
    console.error(`Error in health check:`, error);
    await saveMultipleFailedResults({
      producerId,
      chain,
      testTypes: [
        TEST_TYPES.CORE.HTTP,
        TEST_TYPES.ATOMIC.SERVICES,
        TEST_TYPES.ATOMIC.HEAD_BLOCK,
      ],
      url: healthUrl,
      error,
      curlCmd: healthCurl,
      nodeType,
      method: 'GET',
      validateResultId,
      producerServiceId
    });
    totalTests += 3;
    importantTests.push(false); 
  }

  // Atomic Assets Collections test
  const collectionsUrl = `${endpoint}/atomicassets/v1/collections/kogsofficial`;
  const collectionsCurl = generateCurlCommandFromKyConfig(collectionsUrl);

  const collectionsResult = await runTest({
    producerId,
    chain,
    testType: TEST_TYPES.ATOMIC.COLLECTIONS,
    url: collectionsUrl,
    method: 'GET',
    curlCmd: collectionsCurl,
    nodeType,
    testFunction: () => kyInstance.get(collectionsUrl).json(),
    successCondition: (result) => result.success === true,
    onErrorMessage: (error) => getUserFriendlyMessage(error),
    validateResultId,
    producerServiceId
  });
  totalTests++;
  if (collectionsResult) passedTests++;
  importantTests.push(collectionsResult);

  // Atomic Assets Templates test
  const templatesUrl = `${endpoint}/atomicassets/v1/templates?collection_name=kogsofficial&has_assets=true&page=1&limit=1&order=desc&sort=created`;
  const templatesCurl = generateCurlCommandFromKyConfig(templatesUrl);

  const templatesResult = await runTest({
    producerId,
    chain,
    testType: TEST_TYPES.ATOMIC.TEMPLATE,
    url: templatesUrl,
    method: 'GET',
    curlCmd: templatesCurl,
    nodeType,
    testFunction: () => kyInstance.get(templatesUrl).json(),
    successCondition: (result) => result.success === true,
    onErrorMessage: (error) => getUserFriendlyMessage(error),
    validateResultId,
    producerServiceId
  });
  totalTests++;
  if (templatesResult) passedTests++;
  importantTests.push(templatesResult);
  // Atomic Assets Schema test
  const schemaUrl = `${endpoint}/atomicassets/v1/schemas/kogsofficial/2ndedition`;
  const schemaCurl = generateCurlCommandFromKyConfig(schemaUrl);

  const schemaResult = await runTest({
    producerId,
    chain,
    testType: TEST_TYPES.ATOMIC.SCHEMA,
    url: schemaUrl,
    method: 'GET',
    curlCmd: schemaCurl,
    nodeType,
    testFunction: () => kyInstance.get(schemaUrl).json(),
    successCondition: (result) => result.success === true,
    onErrorMessage: (error) => getUserFriendlyMessage(error),
    validateResultId,
    producerServiceId
  });
  totalTests++;
  if (schemaResult) passedTests++;      
  importantTests.push(schemaResult);
  // Atomic Assets Asset test
  const assetUrl = `${endpoint}/atomicassets/v1/assets/${validationData.atomicAssetId}`;
  const assetCurl = generateCurlCommandFromKyConfig(assetUrl);

  const assetResult = await runTest({
    producerId,
    chain,
    testType: TEST_TYPES.ATOMIC.ASSET,
    url: assetUrl,
    method: 'GET',
    curlCmd: assetCurl,
    nodeType,
    testFunction: () => kyInstance.get(assetUrl).json(),
    successCondition: (result) => result.success === true,
    onErrorMessage: (error) => getUserFriendlyMessage(error),
    validateResultId,
    producerServiceId
  });
  totalTests++;
  if (assetResult) passedTests++;
  const testsPassed = evaluateTestResults(passedTests, totalTests, importantTests);
  console.log(`${nodeType} Tests: ${passedTests}/${totalTests}`);
  return testsPassed;
};

export const runAllAtomicTests = async (producerId, chain, validationData, validateResultId) => {
  const nodeType = 'atomic-assets-api';
  const Endpoints = await getApiNodes(producerId, nodeType);
  let runningAtomicNodes = false;

  if (Endpoints.length === 0) {
    Logger.log(`No ${nodeType} nodes found for this producer', 'Passed`);
    return [runningAtomicNodes, false];
  }

  runningAtomicNodes = true;
  let anyTestPassed = false;
  for (let { producerServiceId, endpoint } of Endpoints) {
    // Remove trailing slash if present
    endpoint = endpoint.replace(/\/$/, '');
    
    Logger.log('', `${nodeType}: ${endpoint}`);
    const endpointTestsPassed = await runNodeTest(producerId, chain, endpoint, validationData, nodeType, validateResultId, producerServiceId);
    console.log(`${nodeType} Endpoint test passed: ${endpointTestsPassed}`);
    anyTestPassed = anyTestPassed || endpointTestsPassed;
  }
  Logger.log('', '----------------------------------------');
  console.log(`Is one endpoint working: ${anyTestPassed}`);
  Logger.log('', '----------------------------------------');
  console.log(`Running Atomic nodes: ${runningAtomicNodes}, Any test passed: ${anyTestPassed}`);
  return [runningAtomicNodes, anyTestPassed];
};
