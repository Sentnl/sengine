import { getProducers, parseProducerServices } from './blockchainService.js';
import { saveProducer, saveProducerService } from './dataService.js';
import { getValidationData, validateProducer, getAllTop21Producers } from '../validate/validateCore.js';
import config from '../config.js';
import { isUrlIgnored, joinUrl } from '../helpers/Urls.js';
import { getDatabase } from '../models/db.js';
import { Logger } from '../helpers/Logger.js';
import { httpRequest } from '../helpers/performanceHelper.js';
import { ignoredUrls } from '../config/ignoredUrls.js';
import ky from 'ky';


const isAbsoluteUrl = (url) => /^https?:\/\//i.test(url);

// Add this function at the top of the file or just before startMonitoring
const formatCountdown = (milliseconds) => {
  const seconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
};

// Function to get retired guilds from on-chain table
const getRetiredGuilds = async (chain) => {
  try {
    // Use Hyperion API to get the guilds table
    const hyperionUrl = chain === 'mainnet' 
      ? 'https://wax.greymass.com' 
      : 'https://waxtest.greymass.com';
    
    const response = await ky.get(`${hyperionUrl}/v2/state/get_table_rows`, {
      searchParams: {
        code: 'guilds.oig',
        scope: 'guilds.oig',
        table: 'guilds',
        limit: 200,
        json: true
      },
      timeout: 10000
    }).json();
    
    if (response.rows) {
      // Filter for retired guilds (retired = 1)
      return response.rows
        .filter(guild => guild.retired === 1)
        .map(guild => guild.producer);
    }
    
    return [];
  } catch (error) {
    console.warn(`Failed to fetch retired guilds from on-chain table for ${chain}:`, error.message);
    return []; // Return empty array if we can't connect, don't disable any guilds
  }
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
  
  // Get retired guilds from on-chain table
  const retiredGuilds = await getRetiredGuilds(chain);
  console.log(`Found ${retiredGuilds.length} retired guilds on-chain for ${chain}`);
  
  // Disable producers with ignored domains or retired on-chain
  for (const producer of currentProducers) {
    const isIgnoredDomain = producer.website && ignoredUrls.includes(new URL(producer.website).hostname);
    const isRetiredOnChain = retiredGuilds.includes(producer.name);
    
    if (isIgnoredDomain) {
      console.log(`Disabling producer ${producer.name} as domain is in ignored URLs list`);
      await db.query('UPDATE producers SET disabled = true WHERE id = $1', [producer.id]);
    } else if (isRetiredOnChain) {
      console.log(`Disabling producer ${producer.name} as it is retired on-chain`);
      await db.query('UPDATE producers SET disabled = true WHERE id = $1', [producer.id]);
    } else {
      // Re-enable producers that are not in ignored URLs and not retired
      await db.query('UPDATE producers SET disabled = false WHERE id = $1', [producer.id]);
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
export const startMonitoring = async (options = { skipCpu: true }, producerName = null ) => {
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
