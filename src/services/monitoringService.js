import { getProducers, parseProducerServices } from './blockchainService.js';
import { saveProducer, saveProducerService } from './dataService.js';
import { getValidationData, validateProducer } from '../validate/validateCore.js';
import config from '../config.js';
import { isUrlIgnored, joinUrl } from '../helpers/Urls.js';
import { getDatabase } from '../models/db.js';
import { Logger } from '../helpers/Logger.js';
import { httpRequest } from '../helpers/performanceHelper.js';

const isAbsoluteUrl = (url) => /^https?:\/\//i.test(url);


// Updating producers and services
const updateProducers = async (chain) => {
  console.log(`Updating producers for ${chain}`);
  const producers = await getProducers(chain);
  console.log(`Retrieved ${producers.length} producers for ${chain}`);

  for (const producer of producers) {
    let website = producer.url;
    if (!website || isUrlIgnored(website)) {
      continue;
    }

    let failedRequests = 0;
    const chainJsonUrl = joinUrl(website, 'chains.json');

    try {
      const chainJsonResponse = await httpRequest(chainJsonUrl, {}, failedRequests, website);
      const chainJson = await chainJsonResponse.json();

      if (!chainJson || !chainJson.chains) continue;

      const chainId = config.chains[chain].chainId;
      const jsonUrl = chainJson.chains[chainId];
      if (!jsonUrl) continue;

      let producerJsonUrl;
      if (isAbsoluteUrl(jsonUrl)) {
        producerJsonUrl = jsonUrl;
      } else {
        producerJsonUrl = joinUrl(website, jsonUrl);
      }

      const producerJsonResponse = await httpRequest(producerJsonUrl, {}, failedRequests, website);
      const producerJson = await producerJsonResponse.json();
      if (!producerJson) continue;

      const logoSvg = producerJson.org?.branding?.logo_svg || null;

      const producerId = await saveProducer({
        name: producer.owner,
        website,
        chain_json_url: chainJsonUrl,
        json_url: producerJsonUrl,
        logo_svg: logoSvg,
        chain,
      });

      const services = parseProducerServices(producerJson);
      for (const service of services) {
        await saveProducerService(producerId, service);
      }
    } catch (error) {
      console.error(`Error processing producer ${producer.owner}:`, error);
      failedRequests++;
    }
  }
};

// Running all tests
const runAllTests = async (chain, producerName = null, options = {}) => {
  console.log(`Running tests for ${chain}${producerName ? ` (Producer: ${producerName})` : ''}`);
  const validationData = await getValidationData(chain, options);

  const db = getDatabase();
  let query = "SELECT id, chain, json_url, name FROM producers WHERE chain = $1";
  let params = [chain];

  if (producerName) {
    query += " AND name = $2";
    params.push(producerName);
  }

  const { rows } = await db.query(query, params);

  for (const row of rows) {
    Logger.log('', '----------------------------------------');
    Logger.log('', `Testing producer: ${row.name} on ${chain}`);
    Logger.log('', '----------------------------------------');

    const { results, timestamp } = await validateProducer(row.id, row.chain, {
      ...validationData,
      jsonUrl: row.json_url
    });
    Logger.log('', `Test Results for: ${row.name}`);
    if (results.guild[0]) Logger.log('', `Guild: ${results.guild[1] ? 'Passed' : 'Failed'}`);
    if (results.api[0]) Logger.log('', `API: ${results.api[1] ? 'Passed' : 'Failed'}`);
    if (results.history[0]) Logger.log('', `History: ${results.history[1] ? 'Passed' : 'Failed'}`);
    if (results.hyperion[0]) Logger.log('', `Hyperion: ${results.hyperion[1] ? 'Passed' : 'Failed'}`);
    if (results.p2p[0]) Logger.log('', `P2P: ${results.p2p[1] ? 'Passed' : 'Failed'}`);
    if (results.atomicassets[0]) Logger.log('', `AtomicAssets: ${results.atomicassets[1] ? 'Passed' : 'Failed'}`);
    if (results.pricefeed[0]) Logger.log('', `PriceFeed: ${results.pricefeed[1] ? 'Passed' : 'Failed'}`);
    Logger.log('', `Timestamp: ${timestamp}`);
    Logger.log('', '----------------------------------------');
  }
  console.log(`Completed tests for ${chain}${producerName ? ` (Producer: ${producerName})` : ''}`);
};

// StartMonitoring
// To skip cpu and pricefeed tests, use options: { skipCpu: true }
export const startMonitoring = async (options = { skipCpu: true }) => {
  const updateAllProducers = async () => {
    await updateProducers('mainnet');
    await updateProducers('testnet');
  };

  // Use the options passed to startMonitoring
  const runAllTestsForBothChains = async (producerName = 'bountyblokbp') => {
    await runAllTests('mainnet', producerName, options);
    await runAllTests('testnet', producerName, options);
  };

  // Run producer updates immediately and wait for it to finish
  //await updateAllProducers();

  // Run all tests after producer updates have completed
  await runAllTestsForBothChains();

  // Only set intervals if we're not testing a single producer
  if (!producerName) {
    setInterval(updateAllProducers, 15 * 60 * 1000);
    setInterval(() => runAllTestsForBothChains(null, options), 60 * 60 * 1000);
  }
};
