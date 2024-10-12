import {
  EOSIOStreamDeserializer,
  EOSIOStreamTokenizer,
  EOSIOStreamConsoleDebugger,
  EOSIOP2PClientConnection,
  GoAwayMessage,
  HandshakeMessage,
  SyncRequestMessage,
  sleep,
} from "eosio-protocol";
import fetch from "node-fetch";
import dns from 'dns';
import { promisify } from 'util';

const dnsLookup = promisify(dns.lookup);

/**
 * Simplified logger using console
 */
const logger = {
  getChildLogger: (options) => ({
    debug: console.log,
    warn: console.warn,
    fatal: console.error,
  }),
};

const childLogger = logger.getChildLogger({
  name: "P2P-Validation",
});

/**
 * Configuration settings
 * Replace the config.get calls with environment variables or hardcoded values as needed
 */
const configLoggingLevel = process.env.LOGGING_LEVEL || "info";
const debug = configLoggingLevel === "silly" || configLoggingLevel === "trace";

/**
 * Simplified Validation Level Enumeration
 */
const ValidationLevel = {
  Low: 1,
  Medium: 2,
  High: 3,
};

/**
 * Simplified helper functions
 */
function calculateValidationLevel(condition, _, __) {
  return condition ? ValidationLevel.High : ValidationLevel.Low;
}

function allChecksOK(validations, _) {
  return validations.every(([_, level]) => level === ValidationLevel.High);
}

function validateBpLocation(location) {
  // Implement basic validation or replace with actual logic
  return typeof location === "object" && location !== null;
}

function extractLongitude(location) {
  // Replace with actual extraction logic
  return location && typeof location.longitude === "number" ? location.longitude : null;
}

function extractLatitude(location) {
  // Replace with actual extraction logic
  return location && typeof location.latitude === "number" ? location.latitude : null;
}

/**
 * TestRunner class modified to use IPv4 address
 */
class TestRunner {
  constructor(node, numBlocks) {
    this.node = node;
    this.lastBlockTime = BigInt(0);
    this.blockCount = 0;
    this.killed = false;
    this.killedReason = "";
    this.killedDetail = "";
    this.latencies = [];
    this.blockTimeout = 10000; // 10 seconds
    this.numBlocks = numBlocks;

    this.p2p = null; // We'll set this in an async method
  }

  async initializeP2P() {
    try {
      const { address } = await dnsLookup(this.node.host, { family: 4 });
      this.p2p = new EOSIOP2PClientConnection({ 
        ...this.node, 
        host: address, 
        debug 
      });
    } catch (error) {
      console.error(`Failed to resolve IPv4 address for ${this.node.host}:`, error);
      throw error;
    }
  }

  run(debugMode = false) {
    console.log(`Test runner doesn't override run`);
  }

  async sendHandshake(override) {
    const msg = new HandshakeMessage();
    msg.copy({
      network_version: 1206,
      chain_id:
        "0000000000000000000000000000000000000000000000000000000000000000",
      node_id:
        "0585cab37823404b8c82d6fcc66c4faf20b0f81b2483b2b0f186dd47a1230fdc",
      key: "PUB_K1_11111111111111111111111111111111149Mr2R",
      time: "1574986199433946000",
      token:
        "0000000000000000000000000000000000000000000000000000000000000000",
      sig: "SIG_K1_111111111111111111111111111111111111111111111111111111111111111116uk5ne",
      p2p_address: `eosdac-p2p-client:9876 - a6f45b4`,
      last_irreversible_block_num: 0,
      last_irreversible_block_id:
        "0000000000000000000000000000000000000000000000000000000000000000",
      head_num: 0,
      head_id:
        "0000000000000000000000000000000000000000000000000000000000000000",
      os: "linux",
      agent: "Dream Ghost",
      generation: 1,
    });

    if (override) {
      msg.copy(override);
    }

    await this.p2p.send_message(msg);
  }
}

/**
 * BlockTransmissionTestRunner class modified to remove database interactions
 */
class BlockTransmissionTestRunner extends TestRunner {
  constructor(node, numBlocks) {
    super(node, numBlocks);
    this.killTimer = null;
  }

  async onSignedBlock(msg) {
    clearTimeout(this.killTimer);
    this.killTimer = setTimeout(this.kill.bind(this), this.blockTimeout);

    this.blockCount++;
    const tm = process.hrtime.bigint();
    if (this.lastBlockTime > 0) {
      const latency = Number(tm - this.lastBlockTime);
      this.latencies.push(latency);
      console.log(
        `Received block signed by ${msg.producer} with latency ${latency} ns - ${this.blockCount} received from ${this.node.host}`
      );
    }
    this.lastBlockTime = tm;
  }

  async onError(e) {
    this.killed = true;
    this.killedReason = e.code || "unknown_error";
    this.killedDetail = e.message || String(e);
  }

  logResults(results) {
    console.log("Results of SeedNode:", JSON.stringify(results, null, 2));
  }

  async run(debugMode = false) {
    await this.initializeP2P();

    this.killTimer = setTimeout(this.kill.bind(this), this.blockTimeout);

    const numBlocks = this.numBlocks;
    const p2p = this.p2p;

    p2p.on("net_error", (e) => {
      this.killed = true;
      this.killedReason = "net_error";
      this.killedDetail = e.message;
    });

    try {
      const client = await p2p.connect();

      const deserializedStream = client
        .pipe(new EOSIOStreamTokenizer({}))
        .pipe(new EOSIOStreamDeserializer({}))
        .on("data", (obj) => {
          if (obj[0] === 7) {
            this.onSignedBlock(obj[2]);
          }
          if (obj[0] === 2) {
            this.killed = true;
            this.killedReason = "go_away";
            this.killedDetail = `Received go away message: ${GoAwayMessage.reasons[obj[2].reason]}`;
          }
        });

      if (debugMode) {
        deserializedStream.pipe(
          new EOSIOStreamConsoleDebugger({ prefix: "<<<" })
        );
      }

      const res = await fetch(`${this.node.api}/v1/chain/get_info`);
      const info = await res.json();

      const prevInfo = await this.getPrevInfo(info, numBlocks);

      const override = {
        chain_id: info.chain_id,
        p2p_address: "wax.sentnl.io:9876 - a6f45b4",
        last_irreversible_block_num: prevInfo.last_irreversible_block_num,
        last_irreversible_block_id: prevInfo.last_irreversible_block_id,
        head_num: prevInfo.head_block_num,
        head_id: prevInfo.head_block_id,
      };
      await this.sendHandshake(override);

      const msg = new SyncRequestMessage();
      msg.start_block = prevInfo.last_irreversible_block_num;
      msg.end_block = prevInfo.last_irreversible_block_num + numBlocks;
      await p2p.send_message(msg);
    } catch (e) {
      this.onError(e);
    }

    // Wait for the tests to complete
    const results = await this.waitForTests(numBlocks);

    // Disconnect p2p after tests
    try {
      console.log('disconnecting');
      await p2p.disconnect(); // Ensure to await the disconnect
    } catch (disconnectError) {
      childLogger.warn("Error while disconnecting P2P client:", disconnectError);
    }

    this.logResults(results);

    return results;
  }

  async getBlockId(blockNumOrId) {
    const res = await fetch(`${this.node.api}/v1/chain/get_block`, {
      method: "POST",
      body: JSON.stringify({ block_num_or_id: blockNumOrId }),
    });
    const info = await res.json();

    return info.id;
  }

  async getPrevInfo(info, num = 1000) {
    if (num > 0) {
      info.head_block_num -= num;
      info.last_irreversible_block_num -= num;
      info.head_block_id = await this.getBlockId(info.head_block_num);
      info.last_irreversible_block_id = await this.getBlockId(
        info.last_irreversible_block_num
      );
    }

    return info;
  }

  async getResultJson() {
    const raw = {
      status: "success",
      block_count: this.blockCount,
      latencies: this.latencies,
      error_code: this.killedReason,
      error_detail: this.killedDetail,
    };

    raw.status = !this.killedReason ? "success" : "error";

    let sum = 0;
    if (raw.latencies.length > 0) {
      sum = raw.latencies.reduce((previous, current) => current + previous, 0);
    }

    const nsDivisor = Math.pow(10, 9);
    const totalTime = sum / nsDivisor;
    const blocksPerNs = raw.block_count / sum;
    let speed = (blocksPerNs * nsDivisor).toFixed(10);
    if (speed === "NaN") {
      speed = "";
    }

    const results = {
      host: `${this.node.host}:${this.node.port}`,
      status: raw.status,
      error_code: raw.error_code,
      error_detail: raw.error_detail,
      blocks_received: raw.block_count,
      total_test_time: totalTime,
      speed: speed,
    };

    return results;
  }

  async waitForTests(num) {
    return new Promise(async (resolve) => {
      while (true) {
        if (this.blockCount >= num) {
          clearTimeout(this.killTimer);
          resolve(this.getResultJson());
          break;
        }

        if (this.killed) {
          clearTimeout(this.killTimer);
          resolve(this.getResultJson());
          break;
        }
        await sleep(1000);
      }
    });
  }

  kill() {
    this.killed = true;
    this.killedReason = "timeout";
    this.killedDetail = "Timed out while receiving blocks";
  }
}

/**
 * Simplified validateSeed function
 * Replaces database operations with console logging
 */
async function validateSeed(
  guildName,
  chainId,
  endpointUrl,
  location
) {
  if (!endpointUrl) {
    console.error("Endpoint URL is undefined.");
    return;
  }

  // Use a manual entry for the Hyperion node instead of NodePulse
  const api = 'https://hyperion7.sentnl.io';

  // Create seed object
  const seed = {
    instance_id: process.env.INSTANCE_ID || "default_instance",
    guild: guildName,
    endpoint_url: endpointUrl,
    location_ok: false,
    location_longitude: null,
    location_latitude: null,
    endpoint_url_ok: false,
    p2p_connection_possible: false,
    p2p_connection_possible_message: null,
    block_transmission_speed_ok: ValidationLevel.Low, // Initialize as Low
    block_transmission_speed_ms: null,
    all_checks_ok: false,
  };

  if (validateBpLocation(location)) {
    seed.location_ok = calculateValidationLevel(
      true,
      chainId,
      "nodeSeed_location_level"
    );
    seed.location_longitude = extractLongitude(location);
    seed.location_latitude = extractLatitude(location);
  }

  /**
   * Test 1: Check URL
   */
  const endpointUrlOk = isValidURL(endpointUrl);
  seed.endpoint_url_ok = calculateValidationLevel(
    endpointUrlOk,
    chainId,
    "nodeSeed_endpoint_url_ok_level"
  );

  if (!seed.endpoint_url_ok) {
    console.log("Endpoint URL validation failed:", seed);
    return;
  }

  /**
   * Test 2: Create Seed Connection
   */
  try {
    const [host, portStr] = endpointUrl.split(":");
    const port = parseInt(portStr, 10);

    const node = {
      api: api,
      host: host,
      port: port,
    };

    const runner = new BlockTransmissionTestRunner(node, 10);
    await runner.initializeP2P(); // Initialize P2P connection
    const result = await runner.run(debug);

    if (result.status === "success") {
      seed.p2p_connection_possible = calculateValidationLevel(
        true,
        chainId,
        "nodeSeed_p2p_connection_possible_level"
      );
      seed.p2p_connection_possible_message = "Connection successful";

      const requiredSpeed = 1000; // This is in milliseconds, so 1000 ms = 1 second
      if (result.speed) {
        const speedMs = Math.round(parseFloat(result.speed));
        seed.block_transmission_speed_ok = calculateValidationLevel(
          speedMs <= requiredSpeed,
          chainId,
          "nodeSeed_block_transmission_speed_ok_level"
        );
        seed.block_transmission_speed_ms = speedMs;
      } else {
        seed.block_transmission_speed_ok = calculateValidationLevel(
          false,
          chainId,
          "nodeSeed_block_transmission_speed_ok_level"
        );
        seed.block_transmission_speed_ms = 0;
      }
    } else {
      seed.p2p_connection_possible = calculateValidationLevel(
        false,
        chainId,
        "nodeSeed_p2p_connection_possible_level"
      );
      seed.p2p_connection_possible_message = result.error_detail || "Connection failed";
      seed.block_transmission_speed_ok = calculateValidationLevel(
        false,
        chainId,
        "nodeSeed_block_transmission_speed_ok_level"
      );
      seed.block_transmission_speed_ms = 0;
    }
  } catch (e) {
    childLogger.warn("Error during NodeSeed validation", e);
    seed.p2p_connection_possible = calculateValidationLevel(
      false,
      chainId,
      "nodeSeed_p2p_connection_possible_level"
    );
    seed.p2p_connection_possible_message = e.message || "Unexpected error during validation";
    seed.block_transmission_speed_ok = calculateValidationLevel(
      false,
      chainId,
      "nodeSeed_block_transmission_speed_ok_level"
    );
    seed.block_transmission_speed_ms = 0;
  }

  /**
   * All checks OK
   */
  const validations = [
    ["nodeSeed_location", seed.location_ok],
    ["nodeSeed_endpoint_url_ok", seed.endpoint_url_ok],
    ["nodeSeed_p2p_connection_possible", seed.p2p_connection_possible],
    ["nodeSeed_block_transmission_speed_ok", seed.block_transmission_speed_ok],
  ];
  seed.all_checks_ok = allChecksOK(validations, chainId);

  /**
   * Log the results
   */
  console.log("Seed Validation Results:", JSON.stringify(seed, null, 2));

  return seed;
}

/**
 * Helper function to validate URLs without external libraries
 */
function isValidURL(url) {
  try {
    const parsed = new URL(url.startsWith("http") ? url : `http://${url}`);
    return !!parsed.host;
  } catch {
    return false;
  }
}

/**
 * Example usage
 */
const guildName = "sentnlagents";
const chainId = "1064487b3cd1a897ce03ae5b6a865651747e2e152090f99c1d19d44e01aea5a4";
const endpointUrl = "wax-peer-eu.blokcrafters.io:9876"; // Replace with actual endpoint
const location = {
  // Replace with actual location data
  longitude: 12.345678,
  latitude: 98.765432,
};

// Execute the validateSeed function
validateSeed(guildName, chainId, endpointUrl, location).catch(console.error);

export async function runP2PTests(producerId, chainId, endpointUrl, location) {
  const result = await validateSeed(producerId, chainId, endpointUrl, location);
  return result.all_checks_ok;
}