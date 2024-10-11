import http2 from 'http2';

/**
 * Checks if the server supports HTTP/2.
 * @param {string} http2Endpoint - The endpoint to check for HTTP/2 support.
 * @returns {Promise<{ success: boolean, error?: string }>}
 */
export const checkHttp2 = async (http2Endpoint) => {
  return new Promise((resolve) => {
    let client;
    try {
      client = http2.connect(http2Endpoint);

      client.on('error', (err) => {
        resolve({ success: false, error: `HTTP/2 connection error: ${err.message}` });
      });

      const req = client.request({ ':path': '/v2/health' });

      req.on('response', (headers) => {
        if (headers[':status'] === 200) {
          resolve({ success: true });
        } else {
          resolve({ success: false, error: `HTTP/2 request failed with status ${headers[':status']}` });
        }
      });

      req.on('data', () => {
        // Consume data to ensure the response is fully processed
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