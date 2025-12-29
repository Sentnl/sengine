import kyInstance from '../utils/kyInstance.js';
import { getApiNodes,  runTlsSecurityTest, runHttpsCheckTest } from './validateCore.js';
import config from '../config.js';
import { TEST_TYPES } from '../helpers/TestTypes.js';
import { Logger } from '../helpers/Logger.js';
import { generateCurlCommandFromKyConfig } from '../helpers/curlGenerator.js';
import { measureResponseTime } from '../helpers/measureResponseTime.js';
import { runTest, saveMultipleFailedResults, evaluateTestResults } from '../helpers/testRunner.js'; 
import { getUserFriendlyMessage } from '../helpers/errorHandler.js';
import { checkHttp2 } from '../utils/http2Checker.js';



const runNodeTest = async (producerId, chain, endpoint, validationData, nodeType, validateResultId, producerServiceId) => {
  const httpsEndpoint = endpoint.replace(/^http:/, 'https:');
  const { hostname } = new URL(httpsEndpoint);
  // Define important tests (add test results here that must pass)
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
  const httpsGetInfoUrl = `${httpsEndpoint}/v1/chain/get_info`;
  const httpsResult = await runHttpsCheckTest({
    producerId,
    chain,
    url: httpsGetInfoUrl,
    nodeType,
    validateResultId,
    producerServiceId  // Add this parameter
  });
  totalTests++;
  if (httpsResult) passedTests++;
  importantTests.push(httpsResult);

  // GET /v1/chain/get_info (including HTTP check)
  const getInfoUrl = `${endpoint}/v1/chain/get_info`;
  const getInfoCurl = generateCurlCommandFromKyConfig(getInfoUrl);

  try {
    const { result: response, responseTime } = await measureResponseTime(() => 
      kyInstance.get(getInfoUrl, { throwHttpErrors: false }).then(async res => ({
        status: res.status,
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
      serverFullVersionString: response.body.server_full_version_string,
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
      producerServiceId
    });
    totalTests++;
    if (httpResult) passedTests++;
    importantTests.push(httpResult);

    const expectedChainId = config.chains[chain].chainId;
    const correctChain = response.body.chain_id === expectedChainId;

    const correctChainResult = await runTest({
      producerId,
      chain,
      testType: TEST_TYPES.API.GET_INFO_CORRECT_CHAIN,
      url: getInfoUrl,
      method: 'GET',
      curlCmd: getInfoCurl,
      nodeType,
      existingResponseTime: responseTime,
      testFunction: () => Promise.resolve({ response }),
      successCondition: () => correctChain,
      onErrorMessage: `Chain ID mismatch. Expected: ${expectedChainId}, Got: ${response.body.chain_id}`,
      validateResultId,
      producerServiceId
    });
    totalTests++;
    if (correctChainResult) passedTests++;
    importantTests.push(correctChainResult);

    const headBlockUpToDate = response.body.head_block_num >= validationData.latestHeadBlock - 10;

    const headBlockUpToDateResult = await runTest({
      producerId,
      chain,
      testType: TEST_TYPES.API.GET_INFO_UP_TO_DATE,
      url: getInfoUrl,
      method: 'GET',
      curlCmd: getInfoCurl,
      nodeType,
      existingResponseTime: responseTime,
      testFunction: () => Promise.resolve({ response, }),
      successCondition: () => headBlockUpToDate,
      onErrorMessage: 'Head block not up-to-date',
      validateResultId,
      producerServiceId
    });
    totalTests++;
    if (headBlockUpToDateResult) passedTests++;
    importantTests.push(headBlockUpToDateResult);

  } catch (error) {
    await saveMultipleFailedResults({
      producerId,
      chain,
      testTypes: [
        TEST_TYPES.CORE.HTTP,
        TEST_TYPES.API.GET_INFO_CORRECT_CHAIN,
        TEST_TYPES.API.GET_INFO_UP_TO_DATE,
      ],
      url: getInfoUrl,
      error,
      curlCmd: getInfoCurl,
      nodeType,
      method: 'GET',
      validateResultId,
      producerServiceId
    });
    // If all tests fail just manaully state that 3 Tests were performed
    totalTests += 3;
    importantTests.push(false); 
  }

  // Invalid endpoints test
  const invalidEndpoints = [
    { url: `${endpoint}/v1/producer/get_integrity_hash`, testType: TEST_TYPES.API.PRODUCER_API },
    { url: `${endpoint}/v1/db_size/get`, testType: TEST_TYPES.API.DBSIZE_API },
    { url: `${endpoint}/v1/net/connections`, testType: TEST_TYPES.API.NET_API },
  ];

  for (const { url, testType } of invalidEndpoints) {
    const curlCmd = generateCurlCommandFromKyConfig(url);
    
    const testResult = await runTest({
      producerId,
      chain,
      testType,
      url,
      method: 'GET',
      curlCmd,
      nodeType,
      testFunction: async () => {
        const response = await kyInstance.get(url, { 
          throwHttpErrors: false,
          followRedirect: false  // Disable automatic redirect following
        });
        const contentType = response.headers.get('content-type');
        const isJson = contentType && contentType.includes('application/json');
         let responseBody;
        try {
          responseBody = await response.text();
        } catch (error) {
          //console.log(`Error reading response body: ${error.message}`);
        }
        return { response, responseBody, isJson, contentType };
      },
      successCondition: (result) => {
        const status = result.response.status;
        return status >= 300 || !result.isJson;
      },
      expectedStatusCode: (result) => result.response.status, // Log the actual status code
      onSuccessMessage: (result) => {
        if (result.response.status >= 300) {
          return `Endpoint not available (status ${result.response.status})`;
        } else if (!result.isJson) {
          return `Endpoint not serving JSON response as expected (Content-Type: ${result.contentType})`;
        }
      },
      onErrorMessage: 'Endpoint unexpectedly available and serving JSON',
      validateResultId,
      producerServiceId
    });

    totalTests++;
    if (testResult) {
      passedTests++;
    }
  }

  // HTTP/2 check with timeout
  const http2Endpoint = endpoint.replace('http://', 'https://');
  const http2Curl = generateCurlCommandFromKyConfig(`${http2Endpoint}/v1/chain/get_info`, { headers: { ':method': 'GET' } });

  const http2Result = await runTest({
    producerId,
    chain,
    testType: TEST_TYPES.CORE.HTTP2,
    url: `${http2Endpoint}/v1/chain/get_info`,
    method: 'GET',
    curlCmd: http2Curl,
    nodeType,
    testFunction: () => checkHttp2(`${http2Endpoint}/v1/chain/get_info`),
    successCondition: (result) => result.success,
    onErrorMessage: (result) => result.error || 'HTTP/2 connection failed',
    validateResultId,
    producerServiceId
  });
  totalTests++;
  if (http2Result) passedTests++;
  importantTests.push(http2Result);


/*   // Block one test
  const blockOneUrl = `${endpoint}/v1/chain/get_block`;
  const blockOnePayload = { "block_num_or_id": 1, "json": true };
  const blockOneCurl = generateCurlCommandFromKyConfig(blockOneUrl, { method: 'POST', json: blockOnePayload });

  await runTest({
    producerId,
    chain,
    testType: TEST_TYPES.API.BLOCK_ONE_TEST,
    url: blockOneUrl,
    method: 'POST',
    payload: blockOnePayload,
    curlCmd: blockOneCurl,
    nodeType,
    testFunction: async () => {
      const response = await ky.post(blockOneUrl, { 
        json: blockOnePayload, 
        throwHttpErrors: false 
      }).json();
      return response;
    },
    successCondition: (result) => 
      result && typeof result === 'object' && !result.code,
    onErrorMessage: (result) => 
      result.message || `Invalid block one response. Received: ${JSON.stringify(result)}`,
  }); */

  // Latest block test
  const latestBlockUrl = `${endpoint}/v1/chain/get_block`;
  const latestBlockPayload = { "block_num_or_id": validationData.head_block_num, "json": true };
  const latestBlockCurl = generateCurlCommandFromKyConfig(latestBlockUrl, { method: 'POST', json: latestBlockPayload });
  

  const latestBlockResult = await runTest({
    producerId,
    chain,
    testType: TEST_TYPES.API.LATEST_BLOCK_TEST,
    url: latestBlockUrl,
    method: 'POST',
    payload: latestBlockPayload,
    curlCmd: latestBlockCurl,
    nodeType,
    testFunction: () => kyInstance.post(latestBlockUrl, { json: latestBlockPayload }).json(),
    successCondition: (result) =>
      result &&
      typeof result === 'object' &&
      Array.isArray(result.transactions),
    onErrorMessage: (error) => getUserFriendlyMessage(error), 
    validateResultId,
    producerServiceId
  });
  totalTests++;
  if (latestBlockResult) passedTests++;

  // Basic symbol test
  const currencyBalanceUrl = `${endpoint}/v1/chain/get_currency_balance`;
  const currencyBalancePayload = {
    "json": true,
    "account": config.chains[chain].testAccount,
    "code": "eosio.token",
    "symbol": config.symbol,
  };
  const currencyBalanceCurl = generateCurlCommandFromKyConfig(currencyBalanceUrl, { method: 'POST', json: currencyBalancePayload });

  const currencyBalanceResult = await runTest({
    producerId,
    chain,
    testType: TEST_TYPES.API.BASIC_SYMBOL_TEST,
    url: currencyBalanceUrl,
    method: 'POST',
    payload: currencyBalancePayload,
    curlCmd: currencyBalanceCurl,
    nodeType,
    testFunction: async () => {
      const response = await kyInstance.post(currencyBalanceUrl, { 
        json: currencyBalancePayload,
        throwHttpErrors: false
      });
      const result = await response.json();
      return { status: response.status, result };
    },
    successCondition: ({ status, result }) =>
      status === 200 &&
      Array.isArray(result) &&
      result.length === 1 &&
      typeof result[0] === 'string' &&
      result[0].endsWith(` ${config.symbol}`),
    onErrorMessage: ({ status, result }) => 
      status === 200
        ? `Invalid currency balance response: ${JSON.stringify(result)}`
        : getUserFriendlyMessage(result),
    validateResultId,
    producerServiceId
  });
  totalTests++;
  if (currencyBalanceResult) passedTests++;

  const testsPassed = evaluateTestResults(passedTests, totalTests, importantTests);
  console.log(`${nodeType} Tests: ${passedTests}/${totalTests}`);
  return testsPassed;

};


export const runAllApiTests = async (producerId, chain, validationData, validateResultId) => {
  const nodeType = 'chain-api'
  const Endpoints = await getApiNodes(producerId, nodeType);
  let runningApiNodes = false

  if (Endpoints.length === 0) {
    Logger.log(`No ${nodeType} nodes found for this producer', 'Passed`);
    return [runningApiNodes, false];
  }
  
  runningApiNodes = true;
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
  console.log(`Running API nodes: ${runningApiNodes}, Any test passed: ${anyTestPassed}`);
  return [runningApiNodes, anyTestPassed];
};
