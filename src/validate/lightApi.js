import kyInstance from '../utils/kyInstance.js';
import { getApiNodes, runTlsSecurityTest, runHttpsCheckTest } from './validateCore.js';
import { TEST_TYPES } from '../helpers/TestTypes.js';
import { Logger } from '../helpers/Logger.js';
import { generateCurlCommandFromKyConfig } from '../helpers/curlGenerator.js';
import { measureResponseTime } from '../helpers/measureResponseTime.js';
import { runTest, saveMultipleFailedResults } from '../helpers/testRunner.js';
import { getUserFriendlyMessage } from '../helpers/errorHandler.js';

const runNodeTest = async (producerId, chain, endpoint, nodeType, validateResultId, producerServiceId) => {
  const httpsEndpoint = endpoint.replace(/^http:/, 'https:');
  const { hostname } = new URL(httpsEndpoint);
  const importantTests = [];
  let totalTests = 0;
  let passedTests = 0;

  // TLS security test
  const tlsResult = await runTlsSecurityTest({
    producerId,
    chain,
    hostname,
    nodeType,
    validateResultId,
    producerServiceId
  });

  // HTTPS check
  const httpsStatusUrl = `${httpsEndpoint}/api/status`;
  const httpsResult = await runHttpsCheckTest({
    producerId,
    chain,
    url: httpsStatusUrl,
    nodeType,
    validateResultId,
    producerServiceId
  });
  totalTests++;
  if (httpsResult) passedTests++;
  importantTests.push(httpsResult);

  // Status check
  const statusUrl = `${endpoint}/api/status`;
  const statusCurl = generateCurlCommandFromKyConfig(statusUrl);

  try {
    const { result: response, responseTime } = await measureResponseTime(() => 
      kyInstance.get(statusUrl, { 
        throwHttpErrors: false,
        timeout: 10000 // 10 second timeout
      }).then(async res => ({
        status: res.status,
        body: await res.text() // Get response as text instead of JSON
      }))
    );

    // HTTP check
    const httpResult = await runTest({
      producerId,
      chain,
      testType: TEST_TYPES.CORE.HTTP,
      url: statusUrl,
      method: 'GET',
      curlCmd: statusCurl,
      nodeType,
      existingResult: response,
      existingResponseTime: responseTime,
      successCondition: (result) => 
        result.status === 200,
      onErrorMessage: (error) => getUserFriendlyMessage(error),
      validateResultId,
      producerServiceId
    });
    totalTests++;
    if (httpResult) passedTests++;
    importantTests.push(httpResult);

    // Status OK check
    const statusOkResult = await runTest({
      producerId,
      chain,
      testType: TEST_TYPES.LIGHT_API.STATUS_OK,
      url: statusUrl,
      method: 'GET',
      curlCmd: statusCurl,
      nodeType,
      existingResponseTime: responseTime,
      testFunction: () => Promise.resolve({ response }),
      successCondition: () => {
        const responseText = response.body.trim();
        return responseText === 'OK %' || responseText === 'OK';
      },
      onErrorMessage: `Status check failed - Expected 'OK %' or 'OK', got: ${response.body}`,
      validateResultId,
      producerServiceId
    });
    totalTests++;
    if (statusOkResult) passedTests++;
    importantTests.push(statusOkResult);

  } catch (error) {
    await saveMultipleFailedResults({
      producerId,
      chain,
      testTypes: [
        TEST_TYPES.CORE.HTTP,
        TEST_TYPES.LIGHT_API.STATUS_OK
      ],
      url: statusUrl,
      error,
      curlCmd: statusCurl,
      nodeType,
      method: 'GET',
      validateResultId,
      producerServiceId
    });
    totalTests += 2;
    importantTests.push(false);
  }

  const testsPassed = passedTests === totalTests && importantTests.every(test => test);
  console.log(`${nodeType} Tests: ${passedTests}/${totalTests}`);
  return [true, testsPassed];
};

export const runAllLightApiTests = async (producerId, chain, validateResultId) => {
  const nodeType = 'light-api';
  const Endpoints = await getApiNodes(producerId, nodeType);
  let runningLightApiNodes = false;

  if (Endpoints.length === 0) {
    Logger.log(`No ${nodeType} nodes found for this producer', 'Passed`);
    return [runningLightApiNodes, false];
  }

  runningLightApiNodes = true;
  let anyTestPassed = false;

  for (let { producerServiceId, endpoint } of Endpoints) {
    endpoint = endpoint.replace(/\/$/, '');
    Logger.log('', `${nodeType}: ${endpoint}`);
    const [running, passed] = await runNodeTest(producerId, chain, endpoint, nodeType, validateResultId, producerServiceId);
    anyTestPassed = anyTestPassed || passed;
  }

  Logger.log('', '----------------------------------------');
  console.log(`Running Light API nodes: ${runningLightApiNodes}, Any test passed: ${anyTestPassed}`);
  return [runningLightApiNodes, anyTestPassed];
}; 