import ky from 'ky';
import { saveTestResultWrapper, getApiNodes } from './validateCore.js';
import config from '../config.js';
import { TEST_TYPES } from '../helpers/TestTypes.js';
import { Logger } from '../helpers/Logger.js';
import { generateCurlCommandFromKyConfig } from '../helpers/curlGenerator.js';
import { checkTls } from '../utils/tlsChecker.js';
import { measureResponseTime } from '../helpers/measureResponseTime.js';

const runApiTest = async (producerId, chain, endpoint, validationData, nodeType = 'api') => {
  const httpsEndpoint = endpoint.replace(/^http:/, 'https:');

  // TLS security test
  try {
    const { hostname } = new URL(httpsEndpoint);
    const { responseTime, result: { version, status } } = await measureResponseTime(() => checkTls(hostname, 443));
    await saveTestResultWrapper(producerId, chain, TEST_TYPES.CORE.TLS_SECURITY, !!version, `${hostname}:443`, responseTime, version ? 200 : 0, version ? `TLS Version: ${version}` : status, 'TLS security test', nodeType, 'GET');
  } catch (error) {
    await saveTestResultWrapper(producerId, chain, TEST_TYPES.CORE.TLS_SECURITY, false, `${httpsEndpoint}:443`, error.responseTime || 0, 0, error.message, 'TLS security test encountered an error', nodeType, 'GET');
  }

  // HTTPS check
  const httpsGetInfoUrl = `${httpsEndpoint}/v1/chain/get_info`;
  const httpsCurl = generateCurlCommandFromKyConfig(httpsGetInfoUrl);
  try {
    const { responseTime } = await measureResponseTime(() => ky.get(httpsGetInfoUrl));
    await saveTestResultWrapper(producerId, chain, TEST_TYPES.CORE.HTTPS, true, httpsEndpoint, responseTime, 200, null, httpsCurl, nodeType, 'GET');
  } catch (error) {
    await saveTestResultWrapper(producerId, chain, TEST_TYPES.CORE.HTTPS, false, httpsEndpoint, error.responseTime || 0, error.response?.status || 500, error.message, httpsCurl, nodeType, 'GET');
  }

  // GET /v1/chain/get_info (including HTTP check)
  const getInfoUrl = `${endpoint}/v1/chain/get_info`;
  const getInfoCurl = generateCurlCommandFromKyConfig(getInfoUrl);
  try {
    const { result: response, responseTime } = await measureResponseTime(() => ky.get(getInfoUrl).json());

    await saveTestResultWrapper(producerId, chain, TEST_TYPES.CORE.HTTP, true, getInfoUrl, responseTime, 200, null, getInfoCurl, nodeType, 'GET');
    
    const expectedChainId = config.chains[chain].chainId;
    const correctChain = response.chain_id === expectedChainId;
    await saveTestResultWrapper(producerId, chain, TEST_TYPES.API.GET_INFO_CORRECT_CHAIN, correctChain, getInfoUrl, responseTime, 200, correctChain ? null : `Chain ID mismatch. Expected: ${expectedChainId}, Got: ${response.chain_id}`, getInfoCurl, nodeType, 'GET');
    
    const headBlockUpToDate = response.head_block_num >= validationData.latestHeadBlock - 10;
    await saveTestResultWrapper(producerId, chain, TEST_TYPES.API.GET_INFO_UP_TO_DATE, headBlockUpToDate, getInfoUrl, responseTime, 200, headBlockUpToDate ? null : 'Head block not up-to-date', getInfoCurl, nodeType, 'GET');
    
  } catch (error) {
    const errorStatus = error.response?.status || 500;
    await saveTestResultWrapper(producerId, chain, TEST_TYPES.CORE.HTTP, false, getInfoUrl, error.responseTime || 0, errorStatus, error.message, getInfoCurl, nodeType, 'GET');
    await saveTestResultWrapper(producerId, chain, TEST_TYPES.API.GET_INFO_CORRECT_CHAIN, false, getInfoUrl, error.responseTime || 0, errorStatus, error.message, getInfoCurl, nodeType, 'GET');
    await saveTestResultWrapper(producerId, chain, TEST_TYPES.API.GET_INFO_UP_TO_DATE, false, getInfoUrl, error.responseTime || 0, errorStatus, error.message, getInfoCurl, nodeType, 'GET');
  }

  // 6. Ensure specific links do not return 200
  const invalidEndpoints = [
    { url: `${endpoint}/v1/producer/get_integrity_hash`, testType: TEST_TYPES.API.PRODUCER_API },
    { url: `${endpoint}/v1/db_size/get`, testType: TEST_TYPES.API.DBSIZE_API },
    { url: `${endpoint}/v1/net/connections`, testType: TEST_TYPES.API.NET_API }
  ];

  for (const { url, testType } of invalidEndpoints) {
    const curlCmd = generateCurlCommandFromKyConfig(url);
    try {
      const { result: response, responseTime } = await measureResponseTime(() => ky.get(url));
      
      try {
        const jsonResponse = await response.json();
        await saveTestResultWrapper(producerId, chain, testType, false, url, responseTime, response.status, JSON.stringify(jsonResponse), curlCmd, nodeType, 'GET');
      } catch {
        await saveTestResultWrapper(producerId, chain, testType, true, url, responseTime, response.status, null, curlCmd, nodeType, 'GET');
      }
    } catch (error) {
      await saveTestResultWrapper(producerId, chain, testType, true, url, error.responseTime || 0, error.response?.status || 500, null, curlCmd, nodeType, 'GET');
    }
  }

  //  Block one test
  const blockOneUrl = `${endpoint}/v1/chain/get_block`;
  const blockOnePayload = { "block_num_or_id": 1, "json": true };
  const blockOneCurl = generateCurlCommandFromKyConfig(blockOneUrl, { method: 'POST', json: blockOnePayload });
  try {
    const { result: blockOneResponse, responseTime } = await measureResponseTime(() => ky.post(blockOneUrl, { json: blockOnePayload }).json());
    const blockOneOk = blockOneResponse && typeof blockOneResponse === 'object';
    await saveTestResultWrapper(producerId, chain, TEST_TYPES.API.BLOCK_ONE_TEST, blockOneOk, blockOneUrl, responseTime, 200, blockOneOk ? null : 'Invalid block one response', blockOneCurl, nodeType, 'POST', JSON.stringify(blockOnePayload));
  } catch (error) {
    await saveTestResultWrapper(producerId, chain, TEST_TYPES.API.BLOCK_ONE_TEST, false, blockOneUrl, error.responseTime || 0, error.response?.status || 500, error.message, blockOneCurl, nodeType, 'POST', JSON.stringify(blockOnePayload));
  }

  //  Latest block test
  const latestBlockUrl = `${endpoint}/v1/chain/get_block`;
  const latestBlockPayload = { "block_num_or_id": validationData.head_block_num, "json": true };
  const latestBlockCurl = generateCurlCommandFromKyConfig(latestBlockUrl, { method: 'POST', json: latestBlockPayload });
  try {
    const { result: latestBlockResponse, responseTime } = await measureResponseTime(() => ky.post(latestBlockUrl, { json: latestBlockPayload }).json());
    const latestBlockOk = latestBlockResponse && typeof latestBlockResponse === 'object' && Array.isArray(latestBlockResponse.transactions);
    await saveTestResultWrapper(producerId, chain, TEST_TYPES.API.LATEST_BLOCK_TEST, latestBlockOk, latestBlockUrl, responseTime, 200, latestBlockOk ? null : 'Invalid latest block response', latestBlockCurl, nodeType, 'POST', JSON.stringify(latestBlockPayload));
  } catch (error) {
    await saveTestResultWrapper(producerId, chain, TEST_TYPES.API.LATEST_BLOCK_TEST, false, latestBlockUrl, error.responseTime || 0, error.response?.status || 500, error.message, latestBlockCurl, nodeType, 'POST', JSON.stringify(latestBlockPayload));
  }

  // Basic symbol test
  const currencyBalanceUrl = `${endpoint}/v1/chain/get_currency_balance`;
  const currencyBalancePayload = { "json": true, "account": config.api.testAccount, "code": "eosio.token", "symbol": config.api.testSymbol };
  const currencyBalanceCurl = generateCurlCommandFromKyConfig(currencyBalanceUrl, { method: 'POST', json: currencyBalancePayload });
  try {
    const { result: currencyBalanceResponse, responseTime } = await measureResponseTime(() => ky.post(currencyBalanceUrl, { json: currencyBalancePayload }).json());
    const currencyBalanceOk = Array.isArray(currencyBalanceResponse) && 
                              currencyBalanceResponse.length === 1 && 
                              typeof currencyBalanceResponse[0] === 'string' &&
                              currencyBalanceResponse[0].endsWith(' WAX');
    const errorMessage = currencyBalanceOk ? null : `Invalid currency balance response: ${JSON.stringify(currencyBalanceResponse)}`;
    await saveTestResultWrapper(producerId, chain, TEST_TYPES.API.BASIC_SYMBOL_TEST, currencyBalanceOk, currencyBalanceUrl, responseTime, 200, errorMessage, currencyBalanceCurl, nodeType, 'POST', JSON.stringify(currencyBalancePayload));
  } catch (error) {
    await saveTestResultWrapper(producerId, chain, TEST_TYPES.API.BASIC_SYMBOL_TEST, false, currencyBalanceUrl, error.responseTime || 0, error.response?.status || 500, error.message, currencyBalanceCurl, nodeType, 'POST', JSON.stringify(currencyBalancePayload));
  }
};

export const runAllApiTests = async (producerId, chain, validationData) => {
  const apiEndpoints = await getApiNodes(producerId);

  if (apiEndpoints.length === 0) {
    Logger.log('No API nodes found for this producer', 'Passed');
    return;
  }

  for (const endpoint of apiEndpoints) {
    Logger.log('', `API: ${endpoint}`);
    await runApiTest(producerId, chain, endpoint, validationData, 'api');
  }
};