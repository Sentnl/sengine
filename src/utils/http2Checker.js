import http2 from 'http2';
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

      //console.log(`Attempting to connect to: ${parsedUrl.origin}`);

      // Connect to the HTTP/2 server
      client = http2.connect(parsedUrl.origin, {
        ALPNProtocols: ['h2', 'http/1.1'],
      });

      client.on('error', (err) => {
        console.error(`Client connection error: ${err.message}`);
        resolve({ success: false, error: `HTTP/2 connection error: ${err.message}` });
      });

      // Create the HTTP/2 request
      const headers = {
        ':method': 'GET',
        ':path': parsedUrl.pathname + parsedUrl.search, // Include query params if any
        ':scheme': parsedUrl.protocol.replace(':', ''), // 'https' or 'http'
        ':authority': parsedUrl.hostname, // Required for HTTP/2
        'User-Agent': 'curl/8.4.0', // Mimic curl User-Agent
        'Accept': '*/*',
      };

      console.log('Sending headers:', headers);

      const req = client.request(headers);

      req.setEncoding('utf8');

      let body = '';

      req.on('response', (headers) => {
        //console.log('Response headers:', headers);
        if (headers[':status'] === 200) {
          console.log('HTTP/2 request succeeded with status 200');
        } else {
          console.error(`HTTP/2 request failed with status ${headers[':status']}`);
          resolve({ success: false, error: `HTTP/2 request failed with status ${headers[':status']}` });
        }
      });

      req.on('data', (chunk) => {
        body += chunk;
      });

      req.on('end', () => {
        //console.log('Response body:', body);
        resolve({ success: true });
      });

      req.on('error', (err) => {
        console.error(`Request error: ${err.message}`);
        resolve({ success: false, error: `HTTP/2 request error: ${err.message}` });
      });

      req.end();
    } catch (err) {
      console.error(`Error while setting up the HTTP/2 check: ${err.message}`);
      resolve({ success: false, error: `HTTP/2 check error: ${err.message}` });
    } finally {
      if (client) {
        client.on('close', () => {
          console.log('Client connection closed');
          client.destroy();
        });
      }
    }
  });
};