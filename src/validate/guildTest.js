import { httpRequest } from '../helpers/performanceHelper.js';
import { saveTestResultWrapper } from './validateCore.js';
import { TEST_TYPES } from '../helpers/TestTypes.js';

const runTest = async (producerId, chain, jsonUrl, testType, checkSuccess, errorMessageOnFailure) => {
  const startTime = Date.now();
  try {
    const response = await httpRequest(jsonUrl, {}, 0, 'guildTest');
    const responseTime = Date.now() - startTime;
    const responseData = await response.json();
    const isSuccessful = checkSuccess(responseData);

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
      'GET'
    );

    return isSuccessful; // Return the test result
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
      'GET'
    );

    return false; // Return false if there was an error
  }
};

const testGithubUsername = async (producerId, chain, jsonUrl) => {
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
    'No GitHub username specified in either org.github_user or org.social.github'
  );
};

const testBranding = async (producerId, chain, jsonUrl) => {
  return await runTest(
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
  let totalTests = 0;
  let passedTests = 0;

  const githubUsernameResult = await testGithubUsername(producerId, chain, jsonUrl);
  totalTests++;
  if (githubUsernameResult) passedTests++;

  const brandingResult = await testBranding(producerId, chain, jsonUrl);
  totalTests++;
  if (brandingResult) passedTests++;

  // Add more tests as needed
  console.log(`Guild Tests: ${passedTests}/${totalTests}`);
  return passedTests === totalTests; // Return true if all tests passed
};