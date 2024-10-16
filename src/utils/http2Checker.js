import http2 from 'http2';
import tls from 'tls';
import { URL } from 'url';

/**
 * Checks if the server supports HTTP/2, logs the request URL, response, headers, and body.
 * @param {string} http2Endpoint - The endpoint to check for HTTP/2 support.
 * @returns {Promise<{ success: boolean, error?: string }>}
 */
export const checkHttp2 = async (http2Endpoint) => {
  return new Promise((resolve) => {
    let client;
    try {
      const parsedUrl = new URL(http2Endpoint);

      // Connect to the HTTP/2 server with the secure context
      client = http2.connect(parsedUrl.origin, {
        ALPNProtocols: ['h2', 'http/1.1'],
      });

      client.on('error', (err) => {
        resolve({ success: false, error: `HTTP/2 connection error: ${err.message}` });
      });

      // Explicitly set the method, path, and headers (like curl)
      const req = client.request({
        ':method': 'GET',
        ':path': parsedUrl.pathname,
        'Host': parsedUrl.hostname,
        'User-Agent': 'curl/8.4.0', // Mimic curl User-Agent
        'Accept': '*/*',
      });

      // Log the response headers
      req.on('response', (headers) => {
        if (headers[':status'] === 200) {
          resolve({ success: true });
        } else {
          resolve({ success: false, error: `HTTP/2 request failed with status ${headers[':status']}` });
        }
      });

      let body = '';

      req.on('data', (chunk) => {
        body += chunk;
      });

      req.on('end', () => {
        resolve({ success: true });
      });

      req.on('error', (err) => {
        resolve({ success: false, error: `HTTP/2 request error: ${err.message}` });
      });

      req.end();
    } catch (err) {
      resolve({ success: false, error: `HTTP/2 check error: ${err.message}` });
    } finally {
      if (client && !client.destroyed) {
        client.on('close', () => {
          client.destroy();
        });
      }
    }
  });
};