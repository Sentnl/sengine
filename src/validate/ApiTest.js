import ky, { HTTPError } from 'ky';
import { getApiNodes,  runTlsSecurityTest, runHttpsCheckTest } from './validateCore.js';
import config from '../config.js';
import { TEST_TYPES } from '../helpers/TestTypes.js';
import { Logger } from '../helpers/Logger.js';
import { generateCurlCommandFromKyConfig } from '../helpers/curlGenerator.js';
import { measureResponseTime } from '../helpers/measureResponseTime.js';
import { runTest, saveMultipleFailedResults } from '../helpers/testRunner.js'; 
import { getUserFriendlyMessage } from '../helpers/errorHandler.js';


const runNodeTest = async (producerId, chain, endpoint, validationData, nodeType = 'api') => {
  const httpsEndpoint = endpoint.replace(/^http:/, 'https:');
  const { hostname } = new URL(httpsEndpoint);
  let combinedError = null; // Initialize combinedErr
  let totalTests = 0;
  let passedTests = 0;

  // TLS security test
  const tlsResult = await runTlsSecurityTest({
    producerId,
    chain,
    hostname,
    nodeType,
  });
  totalTests++;
  console.log(`TLS Result ${tlsResult}`);
  if (tlsResult) passedTests++;

  // HTTPS check
  const httpsGetInfoUrl = `${httpsEndpoint}/v1/chain/get_info`;
  const httpsResult = await runHttpsCheckTest({
    producerId,
    chain,
    url: httpsGetInfoUrl,
    nodeType,
  });
  console.log(`HTTPS Reslut ${httpsResult}`)
  totalTests++;
  if (httpsResult) passedTests++;

  // GET /v1/chain/get_info (including HTTP check)
  const getInfoUrl = `${endpoint}/v1/chain/get_info`;
  const getInfoCurl = generateCurlCommandFromKyConfig(getInfoUrl);

  try {
    const { result: response, responseTime } = await measureResponseTime(() => 
      ky.get(getInfoUrl, { throwHttpErrors: false }).then(async res => ({
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
    });
    totalTests++;
    if (correctChainResult) passedTests++;

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
    });
    totalTests++;
    if (headBlockUpToDateResult) passedTests++;

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
    });
    // If all tests fail just manaully state that 3 Tests were performed
    totalTests += 3;
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
        const response = await ky.get(url, { 
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
    });

    totalTests++;
    if (testResult) {
      passedTests++;
      // Perform additional action here if the test was successful
      console.log(`Test passed for URL: ${url}`);
      // Add any other actions you want to perform on success
    }
  }

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
    testFunction: () => ky.post(latestBlockUrl, { json: latestBlockPayload }).json(),
    successCondition: (result) =>
      result &&
      typeof result === 'object' &&
      Array.isArray(result.transactions),
    onErrorMessage: (error) => getUserFriendlyMessage(error), 
  });
  totalTests++;
  if (latestBlockResult) passedTests++;

  // Basic symbol test
  const currencyBalanceUrl = `${endpoint}/v1/chain/get_currency_balance`;
  const currencyBalancePayload = {
    "json": true,
    "account": config.api.testAccount,
    "code": "eosio.token",
    "symbol": config.api.testSymbol,
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
      const response = await ky.post(currencyBalanceUrl, { 
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
      result[0].endsWith(` ${config.api.testSymbol}`),
    onErrorMessage: ({ status, result }) => 
      status === 200
        ? `Invalid currency balance response: ${JSON.stringify(result)}`
        : getUserFriendlyMessage(result),
  });
  totalTests++;
  if (currencyBalanceResult) passedTests++;
  console.log(`Total tests ${totalTests} passed tests ${passedTests}`);
  return passedTests === totalTests;
};


export const runAllApiTests = async (producerId, chain, validationData) => {
  const nodeType = 'api'
  const apiEndpoints = await getApiNodes(producerId);

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