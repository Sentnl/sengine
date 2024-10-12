import ky from 'ky';
import { getHistoryNodes, runTlsSecurityTest, runHttpsCheckTest } from './validateCore.js';
import config from '../config.js';
import { TEST_TYPES } from '../helpers/TestTypes.js';
import { Logger } from '../helpers/Logger.js';
import { generateCurlCommandFromKyConfig } from '../helpers/curlGenerator.js';
import { measureResponseTime } from '../helpers/measureResponseTime.js';
import { runTest, saveMultipleFailedResults } from '../helpers/testRunner.js'; 


const runNodeTest = async (producerId, chain, endpoint, validationData, nodeType = 'history') => {
  let totalTests = 0;
  let passedTests = 0;

  const httpsEndpoint = endpoint.replace(/^http:/, 'https:');
  const hostname = new URL(httpsEndpoint).hostname;

  // TLS security test
  const tlsResult = await runTlsSecurityTest({
    producerId,
    chain,
    hostname,
    nodeType,
  });
  totalTests++;
  if (tlsResult) passedTests++;

  // HTTPS check
  const httpsGetInfoUrl = `${httpsEndpoint}/v1/chain/get_info`;
  const httpsResult = await runHttpsCheckTest({
    producerId,
    chain,
    url: httpsGetInfoUrl,
    nodeType,
  });
  totalTests++;
  if (httpsResult) passedTests++;

  // Combined check for HTTP availability and CORS configuration
  const getInfoUrl = `${endpoint}/v1/chain/get_info`;
  const getInfoCurl = generateCurlCommandFromKyConfig(getInfoUrl);


  try {
    const { result: response, responseTime } = await measureResponseTime(() => 
      ky.get(getInfoUrl, { throwHttpErrors: false }).then(async res => ({
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
    });
    totalTests++;
    if (httpResult) passedTests++;
    
    // Check CORS configuration
    //const corsHeader = response.headers.get('access-control-allow-origin');
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
    });
    totalTests++;
    if (corsResult) passedTests++;
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
    });
    totalTests += 2
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
      testFunction: () => ky.post(testCase.url, { json: testCase.payload }).json(),
      successCondition: testCase.successCondition,
      onErrorMessage: testCase.errorMessage,
    });
    totalTests++;
    if (result) passedTests++;
  }

  return passedTests === totalTests;
};


export const runAllHistoryTests = async (producerId, chain, validationData) => {
  const nodeType = 'history'
  const apiEndpoints = await getHistoryNodes(producerId);

  if (apiEndpoints.length === 0) {
    Logger.log(`No ${nodeType} nodes found for this producer', 'Passed`);
    return true;
  }

  let anyTestPassed = false;
  for (const endpoint of apiEndpoints) {
    Logger.log('', `${nodeType}: ${endpoint}`);
    const endpointTestsPassed = await runNodeTest(producerId, chain, endpoint, validationData, nodeType);
    console.log(`${nodeType} Endpoint test passed: ${endpointTestsPassed}`);
    anyTestPassed = anyTestPassed || endpointTestsPassed;
  }
  Logger.log('', '----------------------------------------');
  console.log(`Is one endpoint working: ${anyTestPassed}`);
  Logger.log('', '----------------------------------------');
  return anyTestPassed;
};