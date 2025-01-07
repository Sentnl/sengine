import kyInstance from '../utils/kyInstance.js';
import { getApiNodes, runTlsSecurityTest, runHttpsCheckTest } from './validateCore.js';
import { TEST_TYPES } from '../helpers/TestTypes.js';
import { Logger } from '../helpers/Logger.js';
import { generateCurlCommandFromKyConfig } from '../helpers/curlGenerator.js';
import { measureResponseTime } from '../helpers/measureResponseTime.js';
import { runTest, saveMultipleFailedResults } from '../helpers/testRunner.js';
import { getUserFriendlyMessage } from '../helpers/errorHandler.js';
import config from '../config.js';

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
  const httpsStatusUrl = `${httpsEndpoint}${config.ipfs.testPath}`;
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

  // IPFS file check
  const fileUrl = `${endpoint}${config.ipfs.testPath}`;
  const fileCurl = generateCurlCommandFromKyConfig(fileUrl);

  try {
    const { result: response, responseTime } = await measureResponseTime(() => 
      kyInstance.get(fileUrl, { 
        throwHttpErrors: false,
        timeout: 10000, // 10 second timeout
        headers: {
          'Range': 'bytes=0-0' // Request only first byte
        }
      }).then(async res => ({
        status: res.status
      }))
    );

    // HTTP check
    const httpResult = await runTest({
      producerId,
      chain,
      testType: TEST_TYPES.CORE.HTTP,
      url: fileUrl,
      method: 'GET',
      curlCmd: fileCurl,
      nodeType,
      existingResult: response,
      existingResponseTime: responseTime,
      successCondition: (result) => result.status === 200 || result.status === 206,
      onErrorMessage: (error) => getUserFriendlyMessage(error),
      validateResultId,
      producerServiceId
    });
    totalTests++;
    if (httpResult) passedTests++;
    importantTests.push(httpResult);

    // File availability check
    const fileCheckResult = await runTest({
      producerId,
      chain,
      testType: TEST_TYPES.IPFS.IMAGE_CHECK,
      url: fileUrl,
      method: 'GET',
      curlCmd: fileCurl,
      nodeType,
      existingResult: response,
      existingResponseTime: responseTime,
      successCondition: (result) => 
        result.status === 200 || result.status === 206, // Accept both full and partial responses
      onErrorMessage: (result) => 
        `File not available. Status: ${result.status}`,
      validateResultId,
      producerServiceId
    });
    totalTests++;
    if (fileCheckResult) passedTests++;
    importantTests.push(fileCheckResult);

  } catch (error) {
    await saveMultipleFailedResults({
      producerId,
      chain,
      testTypes: [
        TEST_TYPES.CORE.HTTP,
        TEST_TYPES.IPFS.IMAGE_CHECK
      ],
      url: fileUrl,
      error,
      curlCmd: fileCurl,
      nodeType,
      method: 'GET',
      validateResultId,
      producerServiceId
    });
    totalTests += 2;
    importantTests.push(false);
    importantTests.push(false);
  }

  const testsPassed = passedTests === totalTests && importantTests.every(test => test);
  console.log(`${nodeType} Tests: ${passedTests}/${totalTests}`);
  return [true, testsPassed];
};

export const runAllIpfsTests = async (producerId, chain, validateResultId) => {
  const nodeType = 'ipfs';
  const Endpoints = await getApiNodes(producerId, nodeType);
  let runningIpfsNodes = false;

  if (Endpoints.length === 0) {
    Logger.log(`No ${nodeType} nodes found for this producer', 'Passed`);
    return [runningIpfsNodes, false];
  }

  runningIpfsNodes = true;
  let anyTestPassed = false;

  for (let { producerServiceId, endpoint } of Endpoints) {
    endpoint = endpoint.replace(/\/$/, '');
    Logger.log('', `${nodeType}: ${endpoint}`);
    const [running, passed] = await runNodeTest(producerId, chain, endpoint, nodeType, validateResultId, producerServiceId);
    anyTestPassed = anyTestPassed || passed;
  }

  Logger.log('', '----------------------------------------');
  console.log(`Running IPFS nodes: ${runningIpfsNodes}, Any test passed: ${anyTestPassed}`);
  return [runningIpfsNodes, anyTestPassed];
}; 