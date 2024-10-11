import ky from 'ky';
import { getHistoryNodes, runTlsSecurityTest, runHttpsCheckTest } from './validateCore.js';
import config from '../config.js';
import { TEST_TYPES } from '../helpers/TestTypes.js';
import { Logger } from '../helpers/Logger.js';
import { generateCurlCommandFromKyConfig } from '../helpers/curlGenerator.js';
import { measureResponseTime } from '../helpers/measureResponseTime.js';
import { runTest, saveMultipleFailedResults } from '../helpers/testRunner.js'; 
import { info } from 'console';

const runHistoryTest = async (producerId, chain, endpoint, validationData, nodeType = 'history') => {
  const httpsEndpoint = endpoint.replace(/^http:/, 'https:');
  const hostname = new URL(httpsEndpoint).hostname;

  // TLS security test
  await runTlsSecurityTest({
    producerId,
    chain,
    hostname,
    nodeType,
  });

  // HTTPS check
  const httpsGetInfoUrl = `${httpsEndpoint}/v1/chain/get_info`;
  await runHttpsCheckTest({
    producerId,
    chain,
    url: httpsGetInfoUrl,
    nodeType,
  });

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
    await runTest({
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

    
    // Check CORS configuration
    //const corsHeader = response.headers.get('access-control-allow-origin');
    const corsHeader = response.headers && response.headers['access-control-allow-origin'];
    const corsValues = corsHeader ? corsHeader.split(',').map(v => v.trim()) : [];
    const corsOk = corsValues.includes('*') || corsValues.includes('https://wax.sengine.co');

    await runTest({
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
  }

  // 2. Perform specific POST requests
  // 1. get_transaction test
  const getTransactionUrl = `${endpoint}/v1/history/get_transaction`;
  const getTransactionPayload = { "json": true, "id": validationData.transaction };
  const getTransactionCurl = generateCurlCommandFromKyConfig(getTransactionUrl, { method: 'POST', json: getTransactionPayload });

  await runTest({
    producerId,
    chain,
    testType: TEST_TYPES.HYPERION.GET_TRANSACTION,
    url: getTransactionUrl,
    method: 'POST',
    payload: getTransactionPayload,
    curlCmd: getTransactionCurl,
    nodeType,
    testFunction: () => ky.post(getTransactionUrl, { json: getTransactionPayload }).json(),
    successCondition: (result) => typeof result === 'object' && result !== null,
    onErrorMessage: 'Invalid transaction response',
  });

  // 2. get_actions test
  const getActionsUrl = `${endpoint}/v1/history/get_actions`;
  const getActionsPayload = { "json": true, "pos": -1, "offset": -100, "account_name": "eosio.token" };
  const getActionsCurl = generateCurlCommandFromKyConfig(getActionsUrl, { method: 'POST', json: getActionsPayload });

  await runTest({
    producerId,
    chain,
    testType: TEST_TYPES.HYPERION.GET_ACTIONS,
    url: getActionsUrl,
    method: 'POST',
    payload: getActionsPayload,
    curlCmd: getActionsCurl,
    nodeType,
    testFunction: () => ky.post(getActionsUrl, { json: getActionsPayload }).json(),
    successCondition: (result) => typeof result === 'object' && Array.isArray(result.actions),
    onErrorMessage: 'Invalid actions response',
  });

  // 3. get_key_accounts test
  const getKeyAccountsUrl = `${endpoint}/v1/history/get_key_accounts`;
  const getKeyAccountsPayload = { "json": true, "public_key": config.publicKey };
  const getKeyAccountsCurl = generateCurlCommandFromKyConfig(getKeyAccountsUrl, { method: 'POST', json: getKeyAccountsPayload });

  await runTest({
    producerId,
    chain,
    testType: TEST_TYPES.HYPERION.GET_KEY_ACCOUNTS,
    url: getKeyAccountsUrl,
    method: 'POST',
    payload: getKeyAccountsPayload,
    curlCmd: getKeyAccountsCurl,
    nodeType,
    testFunction: () => ky.post(getKeyAccountsUrl, { json: getKeyAccountsPayload }).json(),
    successCondition: (result) => 
      typeof result === 'object' && 
      Array.isArray(result.account_names) && 
      result.account_names.length === 1,
    onErrorMessage: 'Invalid key accounts response',
  });

  // 4. get_controlled_accounts test
  const getControlledAccountsUrl = `${endpoint}/v1/history/get_controlled_accounts`;
  const getControlledAccountsPayload = { "controlling_account": config.api.controllingAccount };
  const getControlledAccountsCurl = generateCurlCommandFromKyConfig(getControlledAccountsUrl, { method: 'POST', json: getControlledAccountsPayload });

  await runTest({
    producerId,
    chain,
    testType: TEST_TYPES.HYPERION.GET_CONTROLLED_ACCOUNTS,
    url: getControlledAccountsUrl,
    method: 'POST',
    payload: getControlledAccountsPayload,
    curlCmd: getControlledAccountsCurl,
    nodeType,
    testFunction: () => ky.post(getControlledAccountsUrl, { json: getControlledAccountsPayload }).json(),
    successCondition: (result) => {
      return (
        typeof result === 'object' &&
        Array.isArray(result.controlled_accounts) &&
        result.controlled_accounts.includes(config.api.testAccount)
      );
    },
    onErrorMessage: (error) => `Invalid controlled accounts response: ${error}`,
  });
};

export const runAllHistoryTests = async (producerId, chain, validationData) => {
  const historyEndpoints = await getHistoryNodes(producerId);

  if (historyEndpoints.length === 0) {
    Logger.log('No History endpoints found for this producer', 'Passed');
    return;
  }

  for (const endpoint of historyEndpoints) {
    Logger.log('', `History: ${endpoint}`);
    await runHistoryTest(producerId, chain, endpoint, validationData, 'history');
  }
};