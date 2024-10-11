import { measureResponseTime } from './measureResponseTime.js';
import { saveTestResultWrapper } from '../validate/validateCore.js';

export async function runTest({
  producerId,
  chain,
  testType,
  url,
  method = 'GET',
  payload = null,
  curlCmd,
  nodeType,
  testFunction,
  successCondition,
  onSuccessMessage = null,
  onErrorMessage = null,
  expectedStatusCode = 200,
}) {
  try {
    const { result, responseTime } = await measureResponseTime(() => testFunction());
    const success = successCondition(result);

    // Handle dynamic or static messages
    const message = success
      ? typeof onSuccessMessage === 'function'
        ? onSuccessMessage(result)
        : onSuccessMessage
      : typeof onErrorMessage === 'function'
        ? onErrorMessage(result)
        : onErrorMessage;

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
      payload ? JSON.stringify(payload) : null
    );
  } catch (error) {
    // Use onErrorMessage if provided, else default to error.message
    const message = typeof onErrorMessage === 'function'
      ? onErrorMessage(error)
      : onErrorMessage || error.message;

    await saveTestResultWrapper(
      producerId,
      chain,
      testType,
      false,
      url,
      error.responseTime || 0,
      error.response?.status || 500,
      message,
      curlCmd,
      nodeType,
      method,
      payload ? JSON.stringify(payload) : null
    );
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
}) {
  const errorStatus = error.response?.status || 500;
  const responseTime = error.responseTime || 0;
  const message = error.message;

  for (const testType of testTypes) {
    await saveTestResultWrapper(
      producerId,
      chain,
      testType,
      false,
      url,
      responseTime,
      errorStatus,
      message,
      curlCmd,
      nodeType,
      method,
      payload ? JSON.stringify(payload) : null
    );
  }
}