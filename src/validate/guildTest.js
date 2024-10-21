import { httpRequest } from '../helpers/performanceHelper.js';
import { saveTestResultWrapper } from './validateCore.js';
import { TEST_TYPES } from '../helpers/TestTypes.js';
import { create } from 'jsondiffpatch';
import { getProducerName } from './validateCore.js';

const jsondiffpatch = create();

const runTest = async (producerId, chain, jsonUrl, testType, checkSuccess, errorMessageOnFailure, validateResultId) => {
  const startTime = Date.now();
  try {
    const response = await httpRequest(jsonUrl, {}, 0, 'guildTest');
    const responseTime = Date.now() - startTime;
    const responseData = await response.json();
    const isSuccessful = await checkSuccess(responseData);

    await saveTestResultWrapper(
      producerId,
      chain,
      testType,
      isSuccessful,
      jsonUrl,
      responseTime,
      response.status,
      isSuccessful ? null : errorMessageOnFailure,
      null,
      'guild',
      'GET',
      null,
      null,
      validateResultId,
      null  
    );

    return isSuccessful;
  } catch (error) {
    await saveTestResultWrapper(
      producerId,
      chain,
      testType,
      false,
      jsonUrl,
      Date.now() - startTime,
      error.response?.status || 0,
      error.message,
      null,
      'guild',
      'GET',
      null,
      null,
      validateResultId,
      null  // Use null for producerServiceId in guild tests
    );

    return false;
  }
};

const testGithubUsername = async (producerId, chain, jsonUrl, validateResultId) => {
  return await runTest(
    producerId,
    chain,
    jsonUrl,
    TEST_TYPES.GUILD.GITHUB_USERNAME,
    (response) => {
      const githubUser = response.org?.github_user;
      const socialGithub = response.org?.social?.github;
      return (Array.isArray(githubUser) ? githubUser.length > 0 : Boolean(githubUser)) || Boolean(socialGithub);
    },
    'No GitHub username specified in either org.github_user or org.social.github',
    validateResultId
  );
};

const testBranding = async (producerId, chain, jsonUrl, validateResultId) => {
  return await runTest(
    producerId,
    chain,
    jsonUrl,
    TEST_TYPES.GUILD.BRANDING,
    (response) => {
      const branding = response.org?.branding;
      return Boolean(branding && branding.logo_256 && branding.logo_1024 && branding.logo_svg);
    },
    'Missing one or more branding fields',
    validateResultId
  );
};


const testJsonConsistency = async (producerId, chain, jsonUrl, validateResultId, chainJson, producerName) => {
  return await runTest(
    producerId,
    chain,
    jsonUrl,
    TEST_TYPES.GUILD.JSON_CONSISTENCY,
    async (downloadedJson) => {
      const onChainJson = chainJson.find(p => p.owner === producerName)?.json;
      if (!onChainJson) {
        console.log(`No chain JSON found for producer ${producerName} on chain ${chain}`);
        return false;
      }
      const delta = jsondiffpatch.diff(downloadedJson, onChainJson);
      if (delta) {
        console.log('Differences:', JSON.stringify(delta, null, 2));
        return false;
      }
      return true;
    },
    'Inconsistency found between downloaded JSON and on-chain JSON',
    validateResultId
  );
};

export const runGuildTests = async (producerId, chain, validationData, validateResultId) => {
  const producerName = await getProducerName(producerId);
  let runningGuildInfo = false;
  let totalTests = 0;
  let passedTests = 0;
  const jsonUrl = validationData.jsonUrl
  const chainJson = validationData.producerJsonData

  if (!jsonUrl) {
    console.log('No Guild JSON URL found for this producer');
    return [runningGuildInfo, false];
  }
   
  runningGuildInfo = true;

  const githubUsernameResult = await testGithubUsername(producerId, chain, jsonUrl, validateResultId);
  totalTests++;
  if (githubUsernameResult) passedTests++;

  const brandingResult = await testBranding(producerId, chain, jsonUrl, validateResultId);
  totalTests++;
  if (brandingResult) passedTests++;
  
  // Only run this test on mainnet
  if (chain === 'mainnet') {
    const jsonConsistencyResult = await testJsonConsistency(producerId, chain, jsonUrl, validateResultId, chainJson, producerName);
    totalTests++;
    if (jsonConsistencyResult) passedTests++;
  }

  console.log(`Guild Tests: ${passedTests}/${totalTests}`);
  return [runningGuildInfo, passedTests === totalTests];
};
