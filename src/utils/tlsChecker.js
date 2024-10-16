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
        timeout: 5000, // Add a timeout to prevent hanging
      };

      return await new Promise((resolve, reject) => {
        const socket = tls.connect(options, () => {
          const protocol = socket.getProtocol();
          console.log(`Successfully connected using ${version}, actual protocol: ${protocol}`);
          resolve(protocol);
          socket.end();
        });

        socket.on('error', (err) => {
          reject(err);
        });

        socket.on('timeout', () => {
          reject(new Error('Connection timed out'));
        });
      });
    } catch (error) {
      console.log(`Failed to connect using ${version}: ${error.message}`);
      return { error: error.message };
    }
  };

  // Check deprecated versions
  for (const version of deprecatedVersions) {
    const result = await checkVersion(version);
    if (result && !result.error) {
      console.log(`Deprecated version ${version} is accepted`);
      acceptedDeprecatedVersions.push(version);
    }
  }

  // Check modern versions
  for (const version of modernVersions.reverse()) {
    const result = await checkVersion(version);
    if (result && !result.error) {
      console.log(`Modern version ${version} is accepted`);
      highestAcceptedVersion = result;
      break;
    }
  }

  const isSecure = acceptedDeprecatedVersions.length === 0 && highestAcceptedVersion !== null;
  const statusMessage = isSecure
    ? `Server is secure. Highest accepted version: ${highestAcceptedVersion}`
    : `Server ${acceptedDeprecatedVersions.length > 0 ? `accepts deprecated TLS/SSL versions: ${acceptedDeprecatedVersions.join(', ')}. ` : ''}`;

  return {
    isSecure,
    acceptedVersion: highestAcceptedVersion,
    deprecatedAccepted: acceptedDeprecatedVersions,
    status: statusMessage,
  };
};
