/**
 * Generates a curl command string from a given URL, method, headers, and query parameters.
 * @param {string} url - The base URL for the request.
 * @param {string} method - The HTTP method (GET, POST, etc.).
 * @param {Object} headers - An object containing header key-value pairs.
 * @param {Object} queryParams - An object containing query parameter key-value pairs.
 * @returns {string} The generated curl command.
 */
export function generateCurlCommand(url, method = 'GET', headers = {}, queryParams = {}) {
    let curlCommand = `curl -X ${method} `;
  
    // Add headers
    Object.entries(headers).forEach(([key, value]) => {
      curlCommand += `-H "${key}: ${value}" `;
    });
  
    // Add query parameters to the URL
    const queryString = new URLSearchParams(queryParams).toString();
    const fullUrl = queryString ? `${url}?${queryString}` : url;
  
    // Add the URL
    curlCommand += `"${fullUrl}"`;
  
    return curlCommand;
  }
  
  /**
   * Generates a curl command string from a ky request configuration.
   * @param {string} url - The base URL for the request.
   * @param {Object} kyConfig - The ky request configuration object.
   * @returns {string} The generated curl command.
   */
  export function generateCurlCommandFromKyConfig(url, kyConfig = {}) {
    const method = kyConfig.method || 'GET';
    const headers = kyConfig.headers || {};
    const searchParams = kyConfig.searchParams || {};
  
    return generateCurlCommand(url, method, headers, searchParams);
  }