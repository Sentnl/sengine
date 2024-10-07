import tls from 'tls';
import { URL } from 'url';

/**
 * Checks the TLS version supported by the given domain and port.
 * @param {string} domainName - The domain name to check.
 * @param {number} port - The port number to connect to.
 * @returns {Promise<{ version: string, status: string } | { version: false, status: string }>}
 */
export const checkTls = async (domainName, port) => {
  const tlsVersions = [
    'SSLv3',
    'TLSv1',
    'TLSv1.1',
    'TLSv1.2',
    'TLSv1.3'
  ];
  
  const parsedUrl = new URL(`https://${domainName}`);
  const HOST = parsedUrl.hostname;
  const PORT = port;

  for (const version of tlsVersions) {
    try {
      const options = {
        host: HOST,
        port: PORT,
        // Set both min and max to the current version to test it specifically
        minVersion: version,
        maxVersion: version,
        ALPNProtocols: ['h2', 'spdy/3', 'http/1.1'],
        rejectUnauthorized: false, // Adjust as needed
      };

      await new Promise((resolve, reject) => {
        const socket = tls.connect(options, () => {
          if (socket.authorized) {
            resolve();
          } else {
            reject(new Error(socket.authorizationError));
          }
          socket.end();
        });

        socket.on('error', (err) => {
          reject(err);
        });
      });

      return { version, status: 'ok' };
    } catch (error) {
    }
  }

  return { version: false, status: 'tls_downgrade failed' };
};