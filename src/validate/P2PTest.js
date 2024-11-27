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
import { saveTestResultWrapper, getSeedNodes } from './validateCore.js';
import { TEST_TYPES } from '../helpers/TestTypes.js';
import { Logger } from '../helpers/Logger.js';
import config from '../config.js';

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

const configLoggingLevel = process.env.LOGGING_LEVEL || "info";
const debug = configLoggingLevel === "silly" || configLoggingLevel === "trace";

class TestRunner {
  constructor(node, numBlocks, chainId) {
    this.node = node;
    this.lastBlockTime = BigInt(0);
    this.blockCount = 0;
    this.killed = false;
    this.killedReason = "";
    this.killedDetail = "";
    this.latencies = [];
    this.blockTimeout = 5000; // 5 seconds
    this.numBlocks = numBlocks;
    this.chainId = chainId;

    const p2p = new EOSIOP2PClientConnection({ ...this.node, debug });
    this.p2p = p2p;
  }

  async sendHandshake(override) {
    const msg = new HandshakeMessage();
    msg.copy({
      network_version: 1206,
      chain_id: this.chainId,
      node_id: "0585cab37823404b8c82d6fcc66c4faf20b0f81b2483b2b0f186dd47a1230fdc",
      key: "PUB_K1_11111111111111111111111111111111149Mr2R",
      time: "1574986199433946000",
      token: "0000000000000000000000000000000000000000000000000000000000000000",
      sig: "SIG_K1_111111111111111111111111111111111111111111111111111111111111111116uk5ne",
      p2p_address: `eosdac-p2p-client:9876 - a6f45b4`,
      last_irreversible_block_num: 0,
      last_irreversible_block_id: "0000000000000000000000000000000000000000000000000000000000000000",
      head_num: 0,
      head_id: "0000000000000000000000000000000000000000000000000000000000000000",
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

class BlockTransmissionTestRunner extends TestRunner {
  constructor(node, numBlocks, chainId) {
    super(node, numBlocks, chainId);
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
      const blocksPerSecond = 1 / (latency / 1e9);
    }
    this.lastBlockTime = tm;
  }

  async onError(e) {
    this.killed = true;
    this.killedReason = e.code || "unknown_error";
    this.killedDetail = e.message || String(e);
  }

  async run(debugMode = false) {
    this.killTimer = setTimeout(this.kill.bind(this), this.blockTimeout);

    const numBlocks = this.numBlocks;
    const p2p = this.p2p;

    // Set up a timeout for the connection attempt
    const connectionTimeout = 5000; // 5 seconds timeout for connection
    let connectionSuccessful = false;

    try {
      // Attempt the connection with a timeout
      const client = await Promise.race([
        p2p.connect(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Connection timeout')), connectionTimeout))
      ]);

      connectionSuccessful = true;

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

      const override = {
        chain_id: this.chainId,
        p2p_address: "wax.sentnl.io:9876 - a6f45b4",
        last_irreversible_block_num: this.validationData.last_irreversible_block_num,
        last_irreversible_block_id: this.validationData.last_irreversible_block_id,
        head_num: this.validationData.head_block_num,
        head_id: this.validationData.head_block_id,
      };
      await this.sendHandshake(override);

      const msg = new SyncRequestMessage();
      msg.start_block = this.validationData.last_irreversible_block_num;
      msg.end_block = this.validationData.last_irreversible_block_num + numBlocks;
      await p2p.send_message(msg);
    } catch (e) {
      if (e.message === 'Connection timeout') {
        this.onError({ code: 'timeout', message: 'Connection attempt timed out' });
      } else {
        this.onError(e);
      }
    }

    const results = await this.waitForTests(numBlocks);

    try {
      if (connectionSuccessful) {
        console.log('disconnecting');
        await p2p.disconnect();
      }
    } catch (disconnectError) {
      childLogger.warn("Error while disconnecting P2P client:", disconnectError);
    }

    return results;
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
          resolve(await this.getResultJson());
          break;
        }

        if (this.killed) {
          clearTimeout(this.killTimer);
          resolve(await this.getResultJson());
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

export const runAllP2PTests = async (producerId, chain, validationData, validateResultId) => {
  const seedNodes = await getSeedNodes(producerId);
  let totalTests = 0;
  let passedTests = 0;
  let anyNodePassedAllTests = false;
  let runningP2PNodes = false;

  if (seedNodes.length === 0) {
    Logger.log('No P2P nodes found for this producer', 'Passed');
    return [runningP2PNodes, false];
  }

  runningP2PNodes = true;

  for (const { producerServiceId, p2p_endpoint } of seedNodes) {
    Logger.log('', `P2P: ${p2p_endpoint}`);
    const { testsRun, testsPassed } = await runP2PTest(producerId, chain, p2p_endpoint, validationData, validateResultId, producerServiceId);
    totalTests += testsRun;
    passedTests += testsPassed;

    const nodePassedAllTests = testsRun === testsPassed;
    anyNodePassedAllTests = anyNodePassedAllTests || nodePassedAllTests;

    Logger.log('', `P2P Node ${p2p_endpoint} - Tests Passed: ${testsPassed}/${testsRun}`);
    Logger.log('', `P2P Node ${p2p_endpoint} - All Tests Passed: ${nodePassedAllTests ? 'Yes' : 'No'}`);
    Logger.log('', '----------------------------------------');
  }

  Logger.log('', `At least one P2P node passed all tests: ${anyNodePassedAllTests ? 'Yes' : 'No'}`);
  Logger.log('', '----------------------------------------');

  return [runningP2PNodes, anyNodePassedAllTests];
};

const runP2PTest = async (producerId, chain, endpoint, validationData, validateResultId, producerServiceId) => {
  const [host, portStr] = endpoint.split(':');
  const port = parseInt(portStr, 10);
  const node = {
    api: validationData.api,
    host: host,
    port: port,
  };

  const runner = new BlockTransmissionTestRunner(node, 10, validationData.chain_id);
  runner.validationData = validationData;
  const result = await runner.run(debug);

  let testsRun = 0;
  let testsPassed = 0;

  // Test 1: P2P connection was possible
  testsRun++;
  const connectionPossible = result.status === 'success';
  if (connectionPossible) testsPassed++;

  await saveTestResultWrapper(
    producerId,
    chain,
    TEST_TYPES.P2P.CONNECTION_POSSIBLE,
    connectionPossible,
    endpoint,
    Math.round(result.total_test_time * 1000),
    connectionPossible ? 200 : 500,
    result.error_detail || null,
    TEST_TYPES.P2P.CONNECTION_POSSIBLE,
    'p2p',
    'GET',
    null,
    null,
    validateResultId,
    producerServiceId
  );

  // Test 2: Block transmission speed is OK
  testsRun++;
  const speedOk = parseFloat(result.speed) >= config.p2p.blocks_per_second;
  if (speedOk) testsPassed++;

  await saveTestResultWrapper(
    producerId,
    chain,
    TEST_TYPES.P2P.BLOCK_TRANSMISSION_SPEED,
    speedOk,
    endpoint,
    Math.round(result.total_test_time * 1000),
    result.status === 'success' ? 200 : 500,
    result.status === 'success' 
      ? (speedOk ? `Block transmission speed (${parseFloat(result.speed).toFixed(2)} blocks/s)` : `Block transmission speed (${parseFloat(result.speed).toFixed(2)} blocks/s) is below the required ${config.p2p.blocks_per_second} blocks/s`)
      : 'Block transmission not possible',
    parseFloat(result.speed),
    'p2p',
    'GET',
    null,
    null,
    validateResultId,
    producerServiceId
  );

  return { testsRun, testsPassed };
};
