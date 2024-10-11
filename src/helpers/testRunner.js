import { measureResponseTime } from './measureResponseTime.js';
import { saveTestResultWrapper } from '../validate/validateCore.js';
import { getUserFriendlyMessage, logDetailedError } from './errorHandler.js';

export async function runTest({
  producerId,
  chain,
  testType,
  url,
  method = 'GET',
  payload = null,
  curlCmd,
  nodeType,
  testFunction = null, 
  existingResult = null,
  existingResponseTime = null,
  successCondition,
  onSuccessMessage = null,
  onErrorMessage = null,
  expectedStatusCode = 200,
  saveErrorMessageOnSuccess = false,
  version = null,
}) {
  try {
    let result;
    let responseTime;
    // Always run the testFunction and save the result
    if (testFunction) {
      if (existingResponseTime == null) {
        // Measure response time and execute testFunction
        const measured = await measureResponseTime(() => testFunction());
        result = measured.result;
        responseTime = measured.responseTime;
      } else {
        // Execute testFunction without measuring time
        result = await testFunction();
        responseTime = existingResponseTime; // Use existing response time
      }
    } else if (existingResult !== null) {
      // Use existing result and response time
      result = existingResult;
      responseTime = existingResponseTime;
      console.log(`existingResult is not null`)
    } else {
      throw new Error('Either testFunction or existingResult and existingResponseTime must be provided.');
    }

    const success = successCondition(result);

    // Handle dynamic or static messages
    const successMessage = typeof onSuccessMessage === 'function'
      ? onSuccessMessage(result)
      : onSuccessMessage;
    const errorMessage = typeof onErrorMessage === 'function'
      ? onErrorMessage(result)
      : onErrorMessage;
    // Update this line to use successMessage when saveErrorMessageOnSuccess is true
    const message = success && !saveErrorMessageOnSuccess ? null : (success ? successMessage : errorMessage);

    // Handle dynamic or static status codes
    const statusCode = typeof expectedStatusCode === 'function'
      ? expectedStatusCode(result)
      : expectedStatusCode;

    await saveTestResultWrapper(
      producerId,
      chain,
      testType,
      success,
      url,
      responseTime,
      statusCode,
      message,
      curlCmd,
      nodeType,
      method,
      payload ? JSON.stringify(payload) : null,
      version
    );
  } catch (error) {
    const userMessage = getUserFriendlyMessage(error);
    const errorStatus = error.response?.status || (error.cause && error.cause.code === 'ENOTFOUND' ? 404 : 500);

    await saveTestResultWrapper(
      producerId,
      chain,
      testType,
      false,
      url,
      error.responseTime || 0,
      errorStatus,
      userMessage,
      curlCmd,
      nodeType,
      method,
      payload ? JSON.stringify(payload) : null,
      version
    );

    // Log detailed error
    logDetailedError(error, `TestType: ${testType}, URL: ${url}`);
  }
}

export async function saveMultipleFailedResults({
  producerId,
  chain,
  testTypes,
  url,
  error,
  curlCmd,
  nodeType,
  method,
  payload = null,
  version = null
}) {
  const errorStatus = error.response?.status || (error.cause && error.cause.code === 'ENOTFOUND' ? 404 : 500);
  const responseTime = error.responseTime || 0;
  const userMessage = getUserFriendlyMessage(error);

  for (const testType of testTypes) {
    await saveTestResultWrapper(
      producerId,
      chain,
      testType,
      false,
      url,
      responseTime,
      errorStatus,
      userMessage,
      curlCmd,
      nodeType,
      method,
      payload ? JSON.stringify(payload) : null,
      version
    );
  }

  // Log detailed error
  //logDetailedError(error, `MultipleFailedResults, URL: ${url}`);
}