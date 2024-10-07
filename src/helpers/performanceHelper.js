import got from 'got';
import { Logger } from '../helpers/Logger.js';
import config from '../config.js';

/**
 * Evaluates whether to enter performance mode based on failed requests.
 * @param {number} failedRequests - Number of failed requests.
 * @param {string} base - Base URL for logging.
 * @returns {number} - Number of retries to attempt.
 */
export const evaluatePerformanceMode = (failedRequests, base) => {
  if (
    config.validation.performance_mode &&
    failedRequests >= config.validation.performance_mode_threshold
  ) {
    Logger.log("Performance mode kicked in", base);
    return 0;
  }
  return config.validation.request_retry_count;
};

/**
 * Sleeps for the specified number of milliseconds.
 * @param {number} ms - Milliseconds to sleep.
 * @returns {Promise} - Promise that resolves after the specified time.
 */
export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Custom HTTP request function with retry and performance mode logic.
 * @param {string} url - The URL to request.
 * @param {object} options - Ky request options.
 * @param {number} failedRequests - Number of failed requests.
 * @param {string} base - Base URL for logging.
 * @returns {Response} - Ky response object.
 * @throws {Error} - Throws error after exhausting retries.
 */
export const httpRequest = async (url, options, failedRequests, base) => {
  let retryCounter = evaluatePerformanceMode(failedRequests, base);

  while (retryCounter >= 0) {
    try {
      const response = await got(url, {
        ...options,
        timeout: { request: config.validation.request_timeout_ms || 5000 },
        throwHttpErrors: false,
        responseType: 'json',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          'Accept': 'application/json, text/plain, */*',
          'Accept-Language': 'en-US,en;q=0.9',
          ...options.headers,
        },
      });
      
      if (response.statusCode >= 200 && response.statusCode < 300) {
        return response.body;
      }
      throw new Error(`HTTP error! status: ${response.statusCode}`);
    } catch (error) {
      if (retryCounter === 0) throw error;
      Logger.log(
        `Retrying request to ${url}. Attempts left: ${retryCounter}. Error: ${error.message}`
      );
      await sleep(config.validation.retry_delay_ms);
      retryCounter--;
      failedRequests++;
    }
  }
};