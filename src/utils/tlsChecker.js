import tls from 'tls';
import { URL } from 'url';

/**
 * Checks if the server supports deprecated TLS/SSL versions.
 * @param {string} domainName - The domain name to check.
 * @param {number} port - The port number to connect to.
 * @returns {Promise<{ deprecatedAccepted: string[], acceptedVersion: string, status: string }>}
 */
export const checkTls = async (domainName, port) => {
  const deprecatedVersions = ['TLSv1', 'TLSv1.1'];
  const modernVersions = ['TLSv1.2', 'TLSv1.3'];
  
  const parsedUrl = new URL(`https://${domainName}`);
  const HOST = parsedUrl.hostname;
  const PORT = port;

  const acceptedDeprecatedVersions = [];
  let highestAcceptedVersion = null;

  const checkVersion = async (version) => {
    try {
      const options = {
        host: HOST,
        port: PORT,
        minVersion: version,
        maxVersion: version,
        rejectUnauthorized: false,
      };

      return await new Promise((resolve, reject) => {
        const socket = tls.connect(options, () => {
          const protocol = socket.getProtocol();
          resolve(protocol);
          socket.end();
        });

        socket.on('error', (err) => {
          reject(err);
        });
      });
    } catch (error) {
      return null;
    }
  };

  // Check deprecated versions
  for (const version of deprecatedVersions) {
    const result = await checkVersion(version);
    if (result) {;
      acceptedDeprecatedVersions.push(version);
    }
  }

  // Check modern versions
  for (const version of modernVersions.reverse()) {
    const result = await checkVersion(version);
    if (result) {
      highestAcceptedVersion = result;
      break;
    }
  }

  const isSecure = acceptedDeprecatedVersions.length === 0 && highestAcceptedVersion !== null;
  const statusMessage = isSecure
    ? `Server is secure. Highest accepted version: ${highestAcceptedVersion}`
    : `Server ${acceptedDeprecatedVersions.length > 0 ? `accepts deprecated TLS/SSL versions: ${acceptedDeprecatedVersions.join(', ')}. ` : ''}Lowest accepted version: ${highestAcceptedVersion || 'None'}`;

  return {
    isSecure,
    acceptedVersion: highestAcceptedVersion,
    deprecatedAccepted: acceptedDeprecatedVersions,
    status: statusMessage,
  };
};