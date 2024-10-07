import ky from 'ky';
import { saveTestResultWrapper } from './validateCore.js';
import { TEST_TYPES } from '../helpers/TestTypes.js';

const runTest = async (producerId, chain, jsonUrl, testType, checkSuccess, errorMessageOnFailure) => {
  const startTime = Date.now();
  try {
    const response = await ky.get(jsonUrl).json();
    const responseTime = Date.now() - startTime;
    const isSuccessful = checkSuccess(response);

    await saveTestResultWrapper(
      producerId,
      chain,
      testType,
      isSuccessful,
      jsonUrl,
      responseTime,
      200,
      isSuccessful ? null : errorMessageOnFailure,
      null,
      'guild'
    );
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
      'guild'
    );
  }
};

const testGithubUsername = async (producerId, chain, jsonUrl) => {
  await runTest(
    producerId,
    chain,
    jsonUrl,
    TEST_TYPES.GUILD.GITHUB_USERNAME,
    (response) => {
      const githubUser = response.org?.github_user;
      return Array.isArray(githubUser) ? githubUser.length > 0 : Boolean(githubUser);
    },
    'No GitHub username specified'
  );
};

const testBranding = async (producerId, chain, jsonUrl) => {
  await runTest(
    producerId,
    chain,
    jsonUrl,
    TEST_TYPES.GUILD.BRANDING,
    (response) => {
      const branding = response.org?.branding;
      return Boolean(branding && branding.logo_256 && branding.logo_1024 && branding.logo_svg);
    },
    'Missing one or more branding fields'
  );
};

export const runGuildTests = async (producerId, chain, jsonUrl) => {
  await testGithubUsername(producerId, chain, jsonUrl);
  await testBranding(producerId, chain, jsonUrl);
};