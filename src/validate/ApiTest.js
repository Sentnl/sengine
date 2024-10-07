import got from 'got';
import { saveTestResultWrapper, getApiNodes } from './validateCore.js';
import config from '../config.js';
import { TEST_TYPES } from '../helpers/TestTypes.js';
import { Logger } from '../helpers/Logger.js';
import { generateCurlCommandFromGotConfig } from '../helpers/curlGenerator.js';
import { checkTls } from '../utils/tlsChecker.js';
import { measureResponseTime } from '../helpers/measureResponseTime.js';

const runApiTest = async (producerId, chain, endpoint, validationData, nodeType = 'api') => {
  const httpsEndpoint = endpoint.replace(/^http:/, 'https:');

  // TLS security test
  try {
    const { hostname } = new URL(httpsEndpoint);
    const { responseTime, result: { version, status } } = await measureResponseTime(() => checkTls(hostname, 443));
    await saveTestResultWrapper(
      producerId,
      chain,
      TEST_TYPES.CORE.TLS_SECURITY,
      !!version,
      `${hostname}:443`,
      responseTime,
      version ? 200 : 0,
      version ? `TLS Version: ${version}` : status,
      'TLS security test',
      nodeType
    );
  } catch (error) {
    await saveTestResultWrapper(producerId, chain, TEST_TYPES.CORE.TLS_SECURITY, false, `${httpsEndpoint}:443`, error.responseTime || 0, 0, error.message, 'TLS security test encountered an error', nodeType);
  }

  // HTTPS check
  const httpsGetInfoUrl = `${httpsEndpoint}/v1/chain/get_info`;
  const httpsCurl = generateCurlCommandFromGotConfig(httpsGetInfoUrl);
  try {
    const { responseTime } = await measureResponseTime(() => got(httpsGetInfoUrl));
    await saveTestResultWrapper(producerId, chain, TEST_TYPES.CORE.HTTPS, true, httpsEndpoint, responseTime, 200, null, httpsCurl, nodeType);
  } catch (error) {
    await saveTestResultWrapper(producerId, chain, TEST_TYPES.CORE.HTTPS, false, httpsEndpoint, error.responseTime || 0, error.response?.status || 500, error.message, httpsCurl, nodeType);
  }

  // GET /v1/chain/get_info (including HTTP check)
  const getInfoUrl = `${endpoint}/v1/chain/get_info`;
  const getInfoCurl = generateCurlCommandFromGotConfig(getInfoUrl);
  try {
    const { result: response, responseTime } = await measureResponseTime(() => 
      got.post(getInfoUrl, { json: {} }).json()
    );

    await saveTestResultWrapper(producerId, chain, TEST_TYPES.CORE.HTTP, true, getInfoUrl, responseTime, 200, null, getInfoCurl, nodeType);
    
    const expectedChainId = config.chains[chain].chainId;
    const correctChain = response.chain_id === expectedChainId;
    await saveTestResultWrapper(
      producerId, 
      chain, 
      TEST_TYPES.API.GET_INFO_CORRECT_CHAIN, 
      correctChain, 
      getInfoUrl, 
      responseTime, 
      200, 
      correctChain ? null : `Chain ID mismatch. Expected: ${expectedChainId}, Got: ${response.chain_id}`, 
      getInfoCurl, 
      nodeType
    );
    
    const headBlockUpToDate = response.head_block_num >= validationData.latestHeadBlock - 10;
    await saveTestResultWrapper(producerId, chain, TEST_TYPES.API.GET_INFO_UP_TO_DATE, headBlockUpToDate, getInfoUrl, responseTime, 200, headBlockUpToDate ? null : 'Head block not up-to-date', getInfoCurl, nodeType);
    
  } catch (error) {
    const errorStatus = error.response?.status || 500;
    
    await saveTestResultWrapper(producerId, chain, TEST_TYPES.CORE.HTTP, false, getInfoUrl, error.responseTime || 0, errorStatus, error.message, getInfoCurl, nodeType);
    await saveTestResultWrapper(producerId, chain, TEST_TYPES.API.GET_INFO_CORRECT_CHAIN, false, getInfoUrl, error.responseTime || 0, errorStatus, error.message, getInfoCurl, nodeType);
    await saveTestResultWrapper(producerId, chain, TEST_TYPES.API.GET_INFO_UP_TO_DATE, false, getInfoUrl, error.responseTime || 0, errorStatus, error.message, getInfoCurl, nodeType);
  }

  // 6. Ensure specific links do not return 200
  const invalidEndpoints = [
    { url: `${endpoint}/v1/producer/get_integrity_hash`, testType: TEST_TYPES.API.PRODUCER_API },
    { url: `${endpoint}/v1/db_size/get`, testType: TEST_TYPES.API.DBSIZE_API },
    { url: `${endpoint}/v1/net/connections`, testType: TEST_TYPES.API.NET_API }
  ];

  for (const { url, testType } of invalidEndpoints) {
    const curlCmd = generateCurlCommandFromGotConfig(url);
    try {
      const { result: response, responseTime } = await measureResponseTime(() => got(url));
      
      try {
        const jsonResponse = JSON.parse(response.body);
        // If we can parse the response as JSON, it's a fail
        await saveTestResultWrapper(producerId, chain, testType, false, url, responseTime, response.status, JSON.stringify(jsonResponse), curlCmd, nodeType);
      } catch {
        // If we can't parse as JSON, it's a pass
        await saveTestResultWrapper(producerId, chain, testType, true, url, responseTime, response.status, null, curlCmd, nodeType);
      }
    } catch (error) {
      // Network error or non-200 status, considered a pass
      await saveTestResultWrapper(producerId, chain, testType, true, url, error.responseTime || 0, error.response?.status || 500, null, curlCmd, nodeType);
    }
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