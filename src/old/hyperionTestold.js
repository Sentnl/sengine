import ky from 'ky';
import http2 from 'http2';
import { getHyperionNodes, saveTestResultWrapper } from '../validate/validateCore.js';
import config from '../config.js';
import { TEST_TYPES } from '../helpers/TestTypes.js';
import { Logger } from '../helpers/Logger.js';
import { generateCurlCommandFromKyConfig } from '../helpers/curlGenerator.js';
import { measureResponseTime } from '../helpers/measureResponseTime.js';


const runHyperionTest = async (producerId, chain, { endpoint, isFull }, validationData, nodeType = 'hyperion') => {

  // 1. Node is correctly marked as full
  console.log(endpoint, isFull);
  const fullNodeCurl = generateCurlCommandFromKyConfig(endpoint);
  await saveTestResultWrapper(producerId, chain, TEST_TYPES.HYPERION.FULL_NODE, isFull, endpoint, 0, 200, isFull ? null : 'Node is not marked as full', fullNodeCurl, nodeType, 'GET');

  // 2. Combined health, HTTP, and CORS check
  const healthUrl = `${endpoint}/v2/health`;
  const corsConfig = { headers: { 'Origin': 'https://wax.sengine.co' } };
  const healthCurl = generateCurlCommandFromKyConfig(healthUrl, corsConfig);

  try {
    const { result: response, responseTime } = await measureResponseTime(() => ky.get(healthUrl, corsConfig));
    const healthResponse = await response.json();
    
    // Health check
    const healthOk = healthResponse.health && Array.isArray(healthResponse.health);
    await saveTestResultWrapper(producerId, chain, TEST_TYPES.HYPERION.HEALTH, healthOk, healthUrl, responseTime, 200, healthOk ? null : 'Health endpoint not available', healthCurl, nodeType, 'GET');

    // HTTP check (implicitly passed if we got this far)
    await saveTestResultWrapper(producerId, chain, TEST_TYPES.CORE.HTTP, true, healthUrl, responseTime, 200, null, healthCurl, nodeType, 'GET');

    // CORS check
    const corsHeader = response.headers.get('access-control-allow-origin');
    const corsValues = corsHeader ? corsHeader.split(',').map(v => v.trim()) : [];
    const corsOk = corsValues.includes('*') || corsValues.includes('https://wax.sengine.co');
    await saveTestResultWrapper(producerId, chain, TEST_TYPES.CORE.CORS, corsOk, healthUrl, responseTime, 200, corsOk ? null : 'CORS not properly configured', healthCurl, nodeType, 'GET');

    if (healthOk) {
      // Hyperion services are ok
      const servicesOk = healthResponse.health.every(service => service.status === 'OK');
      const failedServices = healthResponse.health.filter(service => service.status !== 'OK').map(service => service.service).join(', ');
      await saveTestResultWrapper(producerId, chain, TEST_TYPES.HYPERION.SERVICES, servicesOk, healthUrl, responseTime, 200, servicesOk ? null : `Failed services: ${failedServices}`, healthCurl, nodeType, 'GET');

      //  Any Missing Blocks
      const missingBlocks = parseInt(healthResponse.health.find(service => service.service === 'Elasticsearch')?.service_data?.missing_blocks || '0', 10);
      await saveTestResultWrapper(producerId, chain, TEST_TYPES.HYPERION.MISSING_BLOCKS, missingBlocks === 0, healthUrl, responseTime, 200, missingBlocks === 0 ? null : `Missing blocks: ${missingBlocks}`, healthCurl, nodeType, 'GET');
    }
  } catch (error) {
    const errorStatus = error.response?.status || 500;
    await saveTestResultWrapper(producerId, chain, TEST_TYPES.HYPERION.HEALTH, false, healthUrl, error.responseTime || 0, errorStatus, error.message, healthCurl, nodeType, 'GET', null);
    await saveTestResultWrapper(producerId, chain, TEST_TYPES.CORE.HTTP, false, healthUrl, error.responseTime || 0, errorStatus, error.message, healthCurl, nodeType, 'GET', null);
    await saveTestResultWrapper(producerId, chain, TEST_TYPES.CORE.CORS, false, healthUrl, error.responseTime || 0, errorStatus, error.message, healthCurl, nodeType, 'GET', null);
  }

  // HTTP2 check with timeout
  const http2Endpoint = endpoint.replace('http://', 'https://');
  const http2Curl = generateCurlCommandFromKyConfig(`${http2Endpoint}/v2/health`, { headers: { ':method': 'GET' } });

  try {
    const { responseTime } = await measureResponseTime(() => 
      Promise.race([
        new Promise((_, reject) => setTimeout(() => reject(new Error('HTTP/2 connection timeout')), 10000)),
        (async () => {
          let client;
          try {
            client = http2.connect(http2Endpoint);
            
            client.on('error', (err) => {
              console.error(`HTTP/2 connection error: ${err.message}`);
            });

            const req = client.request({ ':path': '/v2/health' });

            await new Promise((resolve, reject) => {
              req.on('response', (headers) => {
                if (headers[':status'] === 200) {
                  resolve();
                } else {
                  reject(new Error(`HTTP/2 request failed with status ${headers[':status']}`));
                }
              });
              req.on('error', (err) => {
                reject(new Error(`HTTP/2 request error: ${err.message}`));
              });
              req.end();
            });
          } finally {
            if (client && !client.destroyed) {
              client.destroy();
            }
          }
        })()
      ])
    );

    await saveTestResultWrapper(producerId, chain, TEST_TYPES.CORE.HTTP2, true, `${http2Endpoint}/v2/health`, responseTime, 200, null, http2Curl, nodeType, 'GET');
  } catch (error) {
    const errorStatus = error.response?.status || 500;
    await saveTestResultWrapper(producerId, chain, TEST_TYPES.CORE.HTTP2, false, `${http2Endpoint}/v2/health`, error.responseTime || 0, errorStatus, error.message, http2Curl, nodeType, 'GET', null);
  }

  // 3. HTTPS is available (keep this separate as it's testing a different protocol)
  const httpsEndpoint = endpoint.replace('http://', 'https://');
  const httpsCurl = generateCurlCommandFromKyConfig(`${httpsEndpoint}/v2/health`);
  try {
    const { responseTime } = await measureResponseTime(() => ky.get(`${httpsEndpoint}/v2/health`));
    await saveTestResultWrapper(producerId, chain, TEST_TYPES.CORE.HTTPS, true, `${httpsEndpoint}/v2/health`, responseTime, 200, null, httpsCurl, nodeType, 'GET');
  } catch (error) {
    const errorStatus = error.response?.status || 500;
    await saveTestResultWrapper(producerId, chain, TEST_TYPES.CORE.HTTPS, false, `${httpsEndpoint}/v2/health`, error.responseTime || 0, errorStatus, error.message, httpsCurl, nodeType, 'GET', null);
  }

  // 4. get_transaction test
  const transactionCurl = generateCurlCommandFromKyConfig(`${endpoint}/v2/history/get_transaction`, { searchParams: { id: validationData.transaction } });
  try {
    const { result: transactionResponse, responseTime } = await measureResponseTime(() => 
      ky.get(`${endpoint}/v2/history/get_transaction`, { searchParams: { id: validationData.transaction } }).json()
    );
    const transactionOk = transactionResponse.query_time_ms !== undefined;
    await saveTestResultWrapper(producerId, chain, TEST_TYPES.HYPERION.GET_TRANSACTION, transactionOk, `${endpoint}/v2/history/get_transaction`, responseTime, 200, transactionOk ? null : 'Invalid transaction response', transactionCurl, nodeType, 'GET');
  } catch (error) {
    const errorStatus = error.response?.status || 500;
    await saveTestResultWrapper(producerId, chain, TEST_TYPES.HYPERION.GET_TRANSACTION, false, `${endpoint}/v2/history/get_transaction`, error.responseTime || 0, errorStatus, error.message, transactionCurl, nodeType, 'GET', null);
  }

  // 5. get_actions test
  const actionsCurl = generateCurlCommandFromKyConfig(`${endpoint}/v2/history/get_actions`, { searchParams: { limit: 1 } });
  try {
    const { result: actionsResponse, responseTime } = await measureResponseTime(() => 
      ky.get(`${endpoint}/v2/history/get_actions`, { searchParams: { limit: 1 } }).json()
    );
    const actionsOk = actionsResponse.actions && Array.isArray(actionsResponse.actions);
    await saveTestResultWrapper(producerId, chain, TEST_TYPES.HYPERION.GET_ACTIONS, actionsOk, `${endpoint}/v2/history/get_actions`, responseTime, 200, actionsOk ? null : 'Invalid actions response', actionsCurl, nodeType, 'GET');
  } catch (error) {
    const errorStatus = error.response?.status || 500;
    await saveTestResultWrapper(producerId, chain, TEST_TYPES.HYPERION.GET_ACTIONS, false, `${endpoint}/v2/history/get_actions`, error.responseTime || 0, errorStatus, error.message, actionsCurl, nodeType, 'GET', null);
  }

  // 6. get_key_accounts test
  const keyAccountsCurl = generateCurlCommandFromKyConfig(`${endpoint}/v2/state/get_key_accounts`, { searchParams: { public_key: config.publicKey } });
  try {
    const { result: keyAccountsResponse, responseTime } = await measureResponseTime(() => 
      ky.get(`${endpoint}/v2/state/get_key_accounts`, { searchParams: { public_key: config.publicKey } }).json()
    );
    const keyAccountsOk = keyAccountsResponse.account_names !== undefined;
    await saveTestResultWrapper(producerId, chain, TEST_TYPES.HYPERION.GET_KEY_ACCOUNTS, keyAccountsOk, `${endpoint}/v2/state/get_key_accounts`, responseTime, 200, keyAccountsOk ? null : 'Invalid key accounts response', keyAccountsCurl, nodeType, 'GET');
  } catch (error) {
    const errorStatus = error.response?.status || 500;
    await saveTestResultWrapper(producerId, chain, TEST_TYPES.HYPERION.GET_KEY_ACCOUNTS, false, `${endpoint}/v2/state/get_key_accounts`, error.responseTime || 0, errorStatus, error.message, keyAccountsCurl, nodeType, 'GET', null);
  }

  // 7. Partial Hyperion test
  if (!isFull) {
    const timestamp42DaysAgo = new Date(config.timestamp42DaysAgo);
    const timestamp41DaysAgo = new Date(timestamp42DaysAgo.getTime() + 24 * 60 * 60 * 1000);
    const partialCurl = generateCurlCommandFromKyConfig(`${endpoint}/v2/history/get_actions`, {
      searchParams: {
        limit: 1,
        before: timestamp41DaysAgo.toISOString(),
        after: timestamp42DaysAgo.toISOString()
      }
    });
    try {
      const { result: partialResponse, responseTime } = await measureResponseTime(() => 
        ky.get(`${endpoint}/v2/history/get_actions`, {
          searchParams: {
            limit: 1,
            before: timestamp41DaysAgo.toISOString(),
            after: timestamp42DaysAgo.toISOString()
          }
        }).json()
      );
      const partialOk = partialResponse.actions !== undefined;
      await saveTestResultWrapper(producerId, chain, TEST_TYPES.HYPERION.PARTIAL, partialOk, `${endpoint}/v2/history/get_actions`, responseTime, 200, partialOk ? null : 'Invalid partial Hyperion response', partialCurl, nodeType, 'GET');
    } catch (error) {
      const errorStatus = error.response?.status || 500;
      await saveTestResultWrapper(producerId, chain, TEST_TYPES.HYPERION.PARTIAL, false, `${endpoint}/v2/history/get_actions`, error.responseTime || 0, errorStatus, error.message, partialCurl, nodeType, 'GET', null);
    }
  }
};

export const runAllHyperionTests = async (producerId, chain, validationData) => {
  const hyperionNodes = await getHyperionNodes(producerId);

  if (hyperionNodes.length === 0) {
    Logger.log('No Hyperion nodes found for this producer', 'Passed');
    return;
  }
  for (const node of hyperionNodes) {
    Logger.log('', `Hyperion: ${node.endpoint}`);
    await runHyperionTest(producerId, chain, node, validationData, 'hyperion');
  }
};