import kyInstance from '../utils/kyInstance.js';
import { getApiNodes, runTlsSecurityTest, runHttpsCheckTest } from './validateCore.js';
import config from '../config.js';
import { TEST_TYPES } from '../helpers/TestTypes.js';
import { Logger } from '../helpers/Logger.js';
import { generateCurlCommandFromKyConfig } from '../helpers/curlGenerator.js';
import { measureResponseTime } from '../helpers/measureResponseTime.js';
import { runTest, saveMultipleFailedResults, evaluateTestResults } from '../helpers/testRunner.js'; 


const runNodeTest = async (producerId, chain, endpoint, validationData, nodeType, validateResultId, producerServiceId) => {
  let totalTests = 0;
  let passedTests = 0;
  const importantTests = [];
  const httpsEndpoint = endpoint.replace(/^http:/, 'https:');
  const hostname = new URL(httpsEndpoint).hostname;

  // TLS security test
  const tlsResult = await runTlsSecurityTest({
    producerId,
    chain,
    hostname,
    nodeType,
    validateResultId,
    producerServiceId,
  });


  // HTTPS check
  const httpsGetInfoUrl = `${httpsEndpoint}/v1/chain/get_info`;
  const httpsResult = await runHttpsCheckTest({
    producerId,
    chain,
    url: httpsGetInfoUrl,
    nodeType,
    validateResultId,
    producerServiceId,
  });
  totalTests++;
  if (httpsResult) passedTests++;
  importantTests.push(httpsResult);

  // Combined check for HTTP availability and CORS configuration
  const getInfoUrl = `${endpoint}/v1/chain/get_info`;
  const getInfoCurl = generateCurlCommandFromKyConfig(getInfoUrl);

  try {
    const { result: response, responseTime } = await measureResponseTime(() => 
      kyInstance.get(getInfoUrl, { throwHttpErrors: false }).then(async res => ({
        status: res.status,
        headers: Object.fromEntries(res.headers),
        body: await res.json().catch(() => ({}))
      }))
    );

    // HTTP check
    const httpResult = await runTest({
      producerId,
      chain,
      testType: TEST_TYPES.CORE.HTTP,
      url: getInfoUrl,
      method: 'GET',
      curlCmd: getInfoCurl,
      nodeType,
      existingResult: response,
      existingResponseTime: responseTime,
      version: response.body.server_version_string,
      successCondition: (result) => 
        result.status === 200 && 
        typeof result.body === 'object' && 
        result.body !== null && 
        !Array.isArray(result.body),
      onErrorMessage: (error) => 
        response.status === 200
          ? 'HTTP request successful but response is not a JSON object'
          : getUserFriendlyMessage(error),
      validateResultId,
      producerServiceId,
    });
    totalTests++;
    if (httpResult) passedTests++;
    importantTests.push(httpResult);

    // Check CORS configuration
    const corsHeader = response.headers && response.headers['access-control-allow-origin'];
    const corsValues = corsHeader ? corsHeader.split(',').map(v => v.trim()) : [];
    const corsOk = corsValues.includes('*') || corsValues.includes('https://wax.sengine.co');

    const corsResult = await runTest({
      producerId,
      chain,
      testType: TEST_TYPES.CORE.CORS,
      url: getInfoUrl,
      method: 'GET',
      curlCmd: getInfoCurl,
      nodeType,
      existingResult: response,
      existingResponseTime: responseTime,
      successCondition: () => corsOk,
      onErrorMessage: 'CORS not properly configured',
      validateResultId,
      producerServiceId,
    });
    totalTests++;
    if (corsResult) passedTests++;
    importantTests.push(corsResult);

  } catch (error) {
    await saveMultipleFailedResults({
      producerId,
      chain,
      testTypes: [
        TEST_TYPES.CORE.HTTP,
        TEST_TYPES.CORE.CORS,
      ],
      url: getInfoUrl,
      error,
      curlCmd: getInfoCurl,
      nodeType,
      method: 'GET',
      validateResultId,
      producerServiceId,
    });
    totalTests += 2
    importantTests.push(false); 
  }

  // Perform specific POST requests
  const testCases = [
    {
      testType: TEST_TYPES.HYPERION.GET_TRANSACTION,
      url: `${endpoint}/v1/history/get_transaction`,
      payload: { "json": true, "id": validationData.transaction },
      successCondition: (result) => typeof result === 'object' && result !== null,
      errorMessage: 'Invalid transaction response',
    },
    {
      testType: TEST_TYPES.HYPERION.GET_ACTIONS,
      url: `${endpoint}/v1/history/get_actions`,
      payload: { "json": true, "pos": -1, "offset": -100, "account_name": "eosio.token" },
      successCondition: (result) => typeof result === 'object' && Array.isArray(result.actions),
      errorMessage: 'Invalid actions response',
    },
    {
      testType: TEST_TYPES.HYPERION.GET_KEY_ACCOUNTS,
      url: `${endpoint}/v1/history/get_key_accounts`,
      payload: { "json": true, "public_key": config.publicKey },
      successCondition: (result) => 
        typeof result === 'object' && 
        Array.isArray(result.account_names) && 
        result.account_names.length === 1,
      errorMessage: 'Invalid key accounts response',
    },
    {
      testType: TEST_TYPES.HYPERION.GET_CONTROLLED_ACCOUNTS,
      url: `${endpoint}/v1/history/get_controlled_accounts`,
      payload: { "controlling_account": config.api.controllingAccount },
      successCondition: (result) => {
        return (
          typeof result === 'object' &&
          Array.isArray(result.controlled_accounts) &&
          result.controlled_accounts.includes(config.api.testAccount)
        );
      },
      errorMessage: 'Invalid controlled accounts response',
    },
  ];

  let failedTests = 0;
  for (const testCase of testCases) {
    const curlCmd = generateCurlCommandFromKyConfig(testCase.url, { method: 'POST', json: testCase.payload });
    const result = await runTest({
      producerId,
      chain,
      testType: testCase.testType,
      url: testCase.url,
      method: 'POST',
      payload: testCase.payload,
      curlCmd: curlCmd,
      nodeType,
      testFunction: () => kyInstance.post(testCase.url, { json: testCase.payload }).json(),
      successCondition: testCase.successCondition,
      onErrorMessage: testCase.errorMessage,
      validateResultId,
      producerServiceId,
    });
    totalTests++;
    if (result) {
      passedTests++;
    } else {
      failedTests++;
    }
    if (failedTests > 1) {
      importantTests.push(result);
    }
  }
  const testsPassed = evaluateTestResults(passedTests, totalTests, importantTests);
  console.log(`${nodeType} Tests: ${passedTests}/${totalTests}`);
  return testsPassed;

};


export const runAllHistoryTests = async (producerId, chain, validationData, validateResultId) => {
  const nodeType = 'history-v1'
  const Endpoints = await getApiNodes(producerId, nodeType);
  let runningHistoryNodes = false;

  if (Endpoints.length === 0) {
    Logger.log(`No ${nodeType} nodes found for this producer', 'Passed`);
    return [runningHistoryNodes, false];
  }

  runningHistoryNodes = true;
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
  return [runningHistoryNodes, anyTestPassed];
};
