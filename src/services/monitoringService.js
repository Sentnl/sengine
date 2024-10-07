import { getProducers, fetchChainJson, fetchProducerJson, parseProducerServices } from './blockchainService.js';
import { saveProducer, saveProducerService } from './dataService.js';
import { runGuildTests } from '../validate/guildTest.js';
import { runAllHyperionTests } from '../validate/hyperionTest.js';
import { runAllApiTests } from '../validate/ApiTest.js';
import { getValidationData, getProducerName } from '../validate/validateCore.js';
import config from '../config.js';
import { isUrlIgnored, joinUrl } from '../helpers/Urls.js';
import { getDatabase } from '../models/db.js';
import { Logger } from '../helpers/Logger.js';
import { httpRequest } from '../helpers/performanceHelper.js';

const isAbsoluteUrl = (url) => /^https?:\/\//i.test(url);

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
      console.log('producerJson', producerJson);
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


const runAllTests = async (chain) => {
  console.log(`Running all tests for ${chain}`);
  const validationData = await getValidationData(chain);

  
  const db = getDatabase();
  const query = "SELECT id, chain, json_url FROM producers WHERE chain = $1";
  const { rows } = await db.query(query, [chain]);

  for (const row of rows) {
    const producerName = await getProducerName(row.id);

    Logger.log('', '----------------------------------------');
    Logger.log('', `Testing producer: ${producerName} on ${chain}`);
    Logger.log('', '----------------------------------------');

    await runGuildTests(row.id, row.chain, row.json_url);
    Logger.log('', '----------------------------------------');
    await runAllHyperionTests(row.id, chain, validationData);
    Logger.log('', '----------------------------------------');
    await runAllApiTests(row.id, chain, validationData);
    Logger.log('', '----------------------------------------');
    await runAllP2PTests(row.id, chain, validationData);
    
    // Run other tests here...
  }
  console.log(`Completed all tests for ${chain}`);
};

export const startMonitoring = async () => {
  const updateAllProducers = async () => {
    await updateProducers('mainnet');
    await updateProducers('testnet');
  };

  const runAllTestsForBothChains = async () => {
    await runAllTests('mainnet');
    await runAllTests('testnet');
  };

  // Run producer updates immediately and wait for it to finish
  await updateAllProducers();

  // Run all tests after producer updates have completed
  //await runAllTestsForBothChains();

  // Set intervals for periodic runs
  setInterval(updateAllProducers, 15 * 60 * 1000);
  setInterval(runAllTestsForBothChains, 60 * 60 * 1000);
};