import { getProducers, parseProducerServices } from './blockchainService.js';
import { saveProducer, saveProducerService } from './dataService.js';
import { getValidationData, validateProducer, getAllTop21Producers } from '../validate/validateCore.js';
import config from '../config.js';
import { isUrlIgnored, joinUrl } from '../helpers/Urls.js';
import { getDatabase } from '../models/db.js';
import { Logger } from '../helpers/Logger.js';
import { httpRequest } from '../helpers/performanceHelper.js';
import { ignoredUrls } from '../config/ignoredUrls.js';


const isAbsoluteUrl = (url) => /^https?:\/\//i.test(url);

// Add this function at the top of the file or just before startMonitoring
const formatCountdown = (milliseconds) => {
  const seconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
};

// Updating producers and services
const updateProducers = async (chain) => {
  console.log(`Updating producers for ${chain}`);
  const top21Producers = await getAllTop21Producers(chain);
  const producers = await getProducers(chain, top21Producers);
  
  // Get all current producers for this chain
  const db = getDatabase();
  const { rows: currentProducers } = await db.query('SELECT id, name, website FROM producers WHERE chain = $1', [chain]);
  
  // Create a map of current producers by website
  const currentProducerMap = new Map();
  currentProducers.forEach(p => {
    if (p.website) {
      try {
        const domain = new URL(p.website).hostname;
        if (!currentProducerMap.has(domain)) {
          currentProducerMap.set(domain, []);
        }
        currentProducerMap.get(domain).push(p);
      } catch (error) {
        console.error(`Error processing website for producer ${p.name}: ${p.website}`, error);
      }
    }
  });
  
  // Create a set of active producers from the chain
  const activeProducers = new Set(producers.map(p => p.owner));
  
  // Disable producers not found in the chain or with ignored domains
  for (const [domain, producers] of currentProducerMap) {
    const hasActiveProducer = producers.some(p => activeProducers.has(p.name));
    const isIgnoredDomain = ignoredUrls.includes(domain);
    
    if (!hasActiveProducer || isIgnoredDomain) {
      console.log(`Disabling all producers with domain ${domain} as ${isIgnoredDomain ? 'domain is ignored' : 'none are found in the chain'}`);
      const producerIds = producers.map(p => p.id);
      await db.query('UPDATE producers SET disabled = true WHERE id = ANY($1)', [producerIds]);
    }
  }

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
      const logo256 = producerJson.org?.branding?.logo_256 || null;
      const countryCode = producerJson.org?.location?.country || null;

      const producerId = await saveProducer({
        name: producer.owner,
        website,
        chain_json_url: chainJsonUrl,
        json_url: producerJsonUrl,
        logo_svg: logoSvg,
        logo_256: logo256,
        chain,
        top21: producer.top21,
        country_code: countryCode
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

// Add timeout wrapper function
const withTimeout = (promise, timeoutMs, timeoutMessage) => {
  return Promise.race([
    promise,
    new Promise((_, reject) => 
      setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs)
    )
  ]);
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
  } else {
    query += " AND disabled = false";
  }

  const { rows } = await db.query(query, params);

  for (const row of rows) {
    Logger.log('', '----------------------------------------');
    Logger.log('', `Testing producer: ${row.name} on ${chain}`);
    Logger.log('', '----------------------------------------');

    try {
      const validationPromise = validateProducer(row.id, row.chain, {
        ...validationData,
        jsonUrl: row.json_url
      });
      
      const { results, timestamp } = await withTimeout(
        validationPromise,
        120000, // 2 minute timeout per producer
        `Timeout testing producer ${row.name} after 2 minutes`
      );

      Logger.log('', `Test Results for: ${row.name}`);
      if (results.guild[0]) Logger.log('', `Guild: ${results.guild[1] ? 'Passed' : 'Failed'}`);
      if (results.api[0]) Logger.log('', `API: ${results.api[1] ? 'Passed' : 'Failed'}`);
      if (results.history[0]) Logger.log('', `History: ${results.history[1] ? 'Passed' : 'Failed'}`);
      if (results.hyperion[0]) Logger.log('', `Hyperion: ${results.hyperion[1] ? 'Passed' : 'Failed'}`);
      if (results.p2p[0]) Logger.log('', `P2P: ${results.p2p[1] ? 'Passed' : 'Failed'}`);
      if (results.atomicassets[0]) Logger.log('', `AtomicAssets: ${results.atomicassets[1] ? 'Passed' : 'Failed'}`);
      if (results.pricefeed[0]) Logger.log('', `PriceFeed: ${results.pricefeed[1] ? 'Passed' : 'Failed'}`);
      if (results.light_api[0]) Logger.log('', `Light API: ${results.light_api[1] ? 'Passed' : 'Failed'}`);
      if (results.ipfs[0]) Logger.log('', `IPFS: ${results.ipfs[1] ? 'Passed' : 'Failed'}`);
      Logger.log('', `Timestamp: ${timestamp}`);
    } catch (error) {
      console.error(`Error testing producer ${row.name}:`, error.message);
      Logger.log('', `Test Results for: ${row.name}`);
      Logger.log('', `Error: ${error.message}`);
    }
    
    Logger.log('', '----------------------------------------');
  }
  console.log(`Completed tests for ${chain}${producerName ? ` (Producer: ${producerName})` : ''}`);
};

// StartMonitoring
// To skip cpu and pricefeed tests, use options: { skipCpu: true } 
// To validate a single producer set prodcuerName = 'producername'
export const startMonitoring = async (options = { skipCpu: true }, producerName = Null ) => {
  const updateAllProducers = async () => {
    await updateProducers('mainnet');
    await updateProducers('testnet');
  };

  const runAllTestsForBothChains = async () => {
    await runAllTests('mainnet', producerName, options);
    await runAllTests('testnet', producerName, options);
  };


  const initializeMonitoring = async () => {
  // Run update producers
   await updateAllProducers();
  
  // Run all tests immediately
   await runAllTestsForBothChains();

  // Only set intervals if we're not testing a single producer
    let lastTestTime = Date.now();

    const scheduleNextTest = () => {
      const now = Date.now();
      const timeUntilNextTest = Math.max(0, 25 * 60 * 1000 - (now - lastTestTime)); // Run every 20 minutes
      console.log(`Next update and test run in: ${formatCountdown(timeUntilNextTest)}`);

      const countdown = setInterval(() => {
        const remaining = timeUntilNextTest - (Date.now() - now);
        if (remaining <= 0) {
          clearInterval(countdown);
          updateAllProducers()
            .then(() => runAllTestsForBothChains())
            .then(() => {
              lastTestTime = Date.now();
              scheduleNextTest();
            });
        } else {
          console.log(`Update and test run in: ${formatCountdown(remaining)}`);
        }
      }, 1000);
    };
    scheduleNextTest();
  };

  await initializeMonitoring();
};
