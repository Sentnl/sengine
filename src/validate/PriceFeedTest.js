import { saveTestResultWrapper } from './validateCore.js';
import { TEST_TYPES } from '../helpers/TestTypes.js';
import { getProducerName } from './validateCore.js';

const MIN_GUILDS_FOR_MEDIAN = 3;
const MAX_DEVIATION_FROM_MEDIAN = 0.2;

const median = (arr) => {
  if (arr.length === 0) return null;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
};

const buildPerPairMedians = (priceFeedData) => {
  const byPair = new Map();
  for (const entry of priceFeedData) {
    if (!entry.quotes) continue;
    for (const q of entry.quotes) {
      const v = Number(q.value);
      if (Number.isNaN(v)) continue;
      if (!byPair.has(q.pair)) byPair.set(q.pair, []);
      byPair.get(q.pair).push(v);
    }
  }
  const result = new Map();
  for (const [pair, values] of byPair) {
    if (values.length < MIN_GUILDS_FOR_MEDIAN) continue;
    result.set(pair, median(values));
  }
  return result;
};

const runTest = async (producerId, chain, priceFeedData, testType, checkSuccess, errorMessageOnFailure, validateResultId) => {
  const startTime = Date.now();
  try {
    const [isSuccessful, errorMessage] = await checkSuccess(priceFeedData);
    const responseTime = Date.now() - startTime;
    
    await saveTestResultWrapper(
      producerId,
      chain,
      testType,
      isSuccessful,
      null,
      responseTime,
      isSuccessful ? 200 : 400, // Mock status code
      isSuccessful ? null : errorMessage, // Use errorMessage directly
      null, // requestBody
      'pricefeed',
      'GET',
      null, // responseBody
      null, // headers
      validateResultId
    );
    return isSuccessful;
  } catch (error) {
    const responseTime = Date.now() - startTime;
    await saveTestResultWrapper(
      producerId,
      chain,
      testType,
      false,
      null, // No URL for this test
      responseTime,
      error.response?.status || 0,
      error.message,
      null, // requestBody
      'pricefeed',
      'GET',
      null, // responseBody
      null, // headers
      validateResultId
    );
    return false;
  }
};

const testPriceFeedProvided = async (producerId, chain, priceFeedData, validateResultId) => {
  const producerName = await getProducerName(producerId);

  return await runTest(
    producerId,
    chain,
    priceFeedData,
    TEST_TYPES.PRICEFEED.HEALTH,
    (priceFeedData) => {
      const producerEntry = priceFeedData.find(entry => entry.owner === producerName);
      if (!producerEntry) {
        return [false, "Producer is not publishing a pricefeed."];
      }
      if (producerEntry.quoteCount < 3) {
        return [false, `Producer is only publishing ${producerEntry.quoteCount} pairs.`];
      }
      return [true, null];
    },
    (result) => result[1], // Pass the error message to errorMessageOnFailure
    validateResultId
  );
};

const testPriceFeedNearMedian = async (producerId, chain, priceFeedData, validateResultId) => {
  const producerName = await getProducerName(producerId);

  return await runTest(
    producerId,
    chain,
    priceFeedData,
    TEST_TYPES.PRICEFEED.PRICE_NEAR_MEDIAN,
    (priceFeedData) => {
      const producerEntry = priceFeedData.find(entry => entry.owner === producerName);
      if (!producerEntry || !producerEntry.quotes?.length) {
        return [true, null];
      }
      const pairMedians = buildPerPairMedians(priceFeedData);
      const deviations = [];
      for (const q of producerEntry.quotes) {
        const med = pairMedians.get(q.pair);
        if (med == null) continue;
        const v = Number(q.value);
        if (Number.isNaN(v)) continue;
        const ratio = Math.abs(v - med) / med;
        if (ratio > MAX_DEVIATION_FROM_MEDIAN) {
          const pct = (ratio * 100).toFixed(1);
          const side = v > med ? 'above' : 'below';
          deviations.push(`${q.pair}: ${pct}% ${side} median`);
        }
      }
      if (deviations.length > 0) {
        return [false, `Price deviation: ${deviations.join('; ')}`];
      }
      return [true, null];
    },
    (result) => result[1],
    validateResultId
  );
};

export const runPriceFeedTests = async (producerId, chain, validationData, validateResultId) => {
  let runningPriceFeedInfo = false;
  let totalTests = 0;
  let passedTests = 0;
  const priceFeedData = validationData.PriceFeed;

  if (!priceFeedData || priceFeedData.length === 0) {
    console.log('No Price Feed data found');
    return [runningPriceFeedInfo, false];
  }

  runningPriceFeedInfo = true;

  const priceFeedProvidedResult = await testPriceFeedProvided(producerId, chain, priceFeedData, validateResultId);
  totalTests++;
  if (priceFeedProvidedResult) passedTests++;

  const priceFeedNearMedianResult = await testPriceFeedNearMedian(producerId, chain, priceFeedData, validateResultId);
  totalTests++;
  if (priceFeedNearMedianResult) passedTests++;

  console.log(`Price Feed Tests: ${passedTests}/${totalTests}`);
  return [runningPriceFeedInfo, passedTests === totalTests];
};
