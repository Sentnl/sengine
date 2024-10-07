import { EOSIOP2PClientConnection, HandshakeMessage, SyncRequestMessage } from 'eosio-protocol';
import { saveTestResultWrapper, getSeedNodes } from './validateCore.js';
import config from '../config.js';
import { TEST_TYPES } from '../helpers/TestTypes.js';
import { Logger } from '../helpers/Logger.js';
import { measureResponseTime } from '../helpers/measureResponseTime.js';
import ky from 'ky';

class BlockTransmissionTestRunner {
  constructor(node, numBlocks) {
    this.node = node;
    this.numBlocks = numBlocks;
    this.blockCount = 0;
    this.latencies = [];
    this.killed = false;
    this.killedReason = '';
    this.killedDetail = '';
    this.p2p = new EOSIOP2PClientConnection({ ...this.node, debug: false });
  }

  async run() {
    try {
      const client = await this.p2p.connect();

      client.on('data', (data) => {
        if (data[0] === 7) { // Signed block
          this.onSignedBlock(data[2]);
        } else if (data[0] === 2) { // Go away message
          this.killed = true;
          this.killedReason = 'go_away';
          this.killedDetail = `Received go away message: ${data[2].reason}`;
        }
      });

      const info = await ky.get(`${this.node.api}/v1/chain/get_info`).json();
      const prevInfo = await this.getPrevInfo(info, this.numBlocks);

      await this.sendHandshake(info, prevInfo);
      await this.sendSyncRequest(prevInfo);

      return await this.waitForTests();
    } catch (error) {
      this.killed = true;
      this.killedReason = 'error';
      this.killedDetail = error.message;
      return this.getResultJson();
    } finally {
      this.p2p.disconnect();
    }
  }

  async sendHandshake(info, prevInfo) {
    const msg = new HandshakeMessage({
      network_version: 1206,
      chain_id: info.chain_id,
      node_id: '0585cab37823404b8c82d6fcc66c4faf20b0f81b2483b2b0f186dd47a1230fdc',
      key: 'PUB_K1_11111111111111111111111111111111149Mr2R',
      time: '1574986199433946000',
      token: '0000000000000000000000000000000000000000000000000000000000000000',
      sig: 'SIG_K1_111111111111111111111111111111111111111111111111111111111111111116uk5ne',
      p2p_address: 'validationcore.blacklusion.io:9876 - a6f45b4',
      last_irreversible_block_num: prevInfo.last_irreversible_block_num,
      last_irreversible_block_id: prevInfo.last_irreversible_block_id,
      head_num: prevInfo.head_block_num,
      head_id: prevInfo.head_block_id,
      os: 'linux',
      agent: 'NodePulse',
      generation: 1,
    });
    await this.p2p.send_message(msg);
  }

  async sendSyncRequest(prevInfo) {
    const msg = new SyncRequestMessage({
      start_block: prevInfo.last_irreversible_block_num,
      end_block: prevInfo.last_irreversible_block_num + this.numBlocks,
    });
    await this.p2p.send_message(msg);
  }

  onSignedBlock(msg) {
    this.blockCount++;
    const now = process.hrtime.bigint();
    if (this.lastBlockTime) {
      const latency = Number(now - this.lastBlockTime);
      this.latencies.push(latency);
    }
    this.lastBlockTime = now;
  }

  async getPrevInfo(info, num) {
    info.head_block_num -= num;
    info.last_irreversible_block_num -= num;
    info.head_block_id = await this.getBlockId(info.head_block_num);
    info.last_irreversible_block_id = await this.getBlockId(info.last_irreversible_block_num);
    return info;
  }

  async getBlockId(blockNum) {
    const response = await ky.post(`${this.node.api}/v1/chain/get_block`, {
      json: { block_num_or_id: blockNum },
    }).json();
    return response.id;
  }

  async waitForTests() {
    return new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        if (this.blockCount >= this.numBlocks || this.killed) {
          clearInterval(checkInterval);
          resolve(this.getResultJson());
        }
      }, 1000);
    });
  }

  getResultJson() {
    const totalTime = this.latencies.reduce((sum, latency) => sum + latency, 0) / 1e9;
    const speed = this.blockCount / totalTime;

    return {
      host: `${this.node.host}:${this.node.port}`,
      status: this.killed ? 'error' : 'success',
      error_code: this.killedReason,
      error_detail: this.killedDetail,
      blocks_received: this.blockCount,
      total_test_time: totalTime,
      speed: speed.toFixed(10),
    };
  }
}

const runP2PTest = async (producerId, chain, endpoint, validationData, nodeType = 'seed') => {
  const [host, port] = endpoint.split(':');
  const node = {
    api: config.chains[chain].apiEndpoint,
    host,
    port: parseInt(port, 10),
  };

  const runner = new BlockTransmissionTestRunner(node, config.validation.seedBlockCount);
  
  try {
    const { responseTime, result } = await measureResponseTime(() => runner.run());

    // Test 1: P2P Connection Possible
    await saveTestResultWrapper(
      producerId,
      chain,
      TEST_TYPES.P2P.CONNECTION_POSSIBLE,
      result.status === 'success',
      endpoint,
      responseTime,
      result.status === 'success' ? 200 : 500,
      result.error_detail || null,
      'P2P connection test',
      nodeType
    );

    // Test 2: Block Transmission Speed
    if (result.status === 'success') {
      const speedOk = parseFloat(result.speed) > config.validation.seedOkSpeed;
      await saveTestResultWrapper(
        producerId,
        chain,
        TEST_TYPES.P2P.BLOCK_TRANSMISSION_SPEED,
        speedOk,
        endpoint,
        responseTime,
        200,
        speedOk ? null : `Slow block transmission: ${result.speed} blocks/s`,
        'P2P block transmission test',
        nodeType
      );
    }
  } catch (error) {
    await saveTestResultWrapper(
      producerId,
      chain,
      TEST_TYPES.P2P.CONNECTION_POSSIBLE,
      false,
      endpoint,
      0,
      500,
      error.message,
      'P2P connection test failed',
      nodeType
    );
  }
};

export const runAllP2PTests = async (producerId, chain, validationData) => {
  const seedNodes = await getSeedNodes(producerId);

  if (seedNodes.length === 0) {
    Logger.log('No seed nodes found for this producer', 'Passed');
    return;
  }

  for (const endpoint of seedNodes) {
    Logger.log('', `P2P: ${endpoint}`);
    await runP2PTest(producerId, chain, endpoint, validationData, 'seed');
  }
};