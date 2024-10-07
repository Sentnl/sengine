import ky from 'ky';
import http from 'http';
import https from 'https';
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

// Create agents that force IPv4
const ipv4HttpsAgent = new https.Agent({
  lookup: (hostname, options, callback) => {
    require('dns').lookup(hostname, { family: 4 }, callback);
  },
});

const ipv4HttpAgent = new http.Agent({
  lookup: (hostname, options, callback) => {
    require('dns').lookup(hostname, { family: 4 }, callback);
  },
});

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
  const urlObj = new URL(url);
  const isHttps = urlObj.protocol === 'https:';
  const agent = isHttps ? ipv4HttpsAgent : ipv4HttpAgent;

  while (retryCounter >= 0) {
    try {
      const response = await ky.get(url, {
        ...options,
        agent: {
          https: ipv4HttpsAgent,
          http: ipv4HttpAgent,
        },
        timeout: config.validation.request_timeout_ms || 5000,
      });
      if (response.ok) return response;
      throw new Error(`HTTP error! status: ${response.status}`);
    } catch (error) {
      if (retryCounter === 0) throw error;
      Logger.log(`Retrying request to ${url}. Attempts left: ${retryCounter}. Error: ${error.message}`);
      await sleep(config.validation.retry_delay_ms);
      retryCounter--;
      failedRequests++;
    }
  }
};