import { saveTestResultWrapper } from './validateCore.js';
import { TEST_TYPES } from '../helpers/TestTypes.js';
import { getProducerName } from './validateCore.js';

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
      if (producerEntry.quoteCount < 5) {
        return [false, `Producer is only publishing ${producerEntry.quoteCount} pairs.`];
      }
      return [true, null];
    },
    (result) => result[1], // Pass the error message to errorMessageOnFailure
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

  console.log(`Price Feed Tests: ${passedTests}/${totalTests}`);
  return [runningPriceFeedInfo, passedTests === totalTests];
};
