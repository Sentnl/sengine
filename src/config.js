import dotenv from 'dotenv';
import NodePulse from '@sentnl/nodepulse';

dotenv.config();

const mainnetNodePulse = new NodePulse({
  nodeType: 'hyperion',
  network: 'mainnet',
});

const testnetNodePulse = new NodePulse({
  nodeType: 'hyperion',
  network: 'testnet',
});

export default {
  general: {
    logging_level: 'silly',
  },
  database: {
    host: process.env.DB_HOST || 'sengine-db',
    port: process.env.DB_PORT || 5432,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  },
  chains: {
    mainnet: {
      chainId: '1064487b3cd1a897ce03ae5b6a865651747e2e152090f99c1d19d44e01aea5a4',
      getEndpoint: async () => {
        const node = await mainnetNodePulse.getNode();
        console.log('Mainnet node:', node);
        return node;
      },
    },
    testnet: {
      chainId: 'f16b1833c747c43682f4386fca9cbb327929334a762755ebec17f6f23c9b8a12',
      getEndpoint: async () => {
        const node = await testnetNodePulse.getNode();
        console.log('Testnet node:', node);
        return node;
      },
    },
  },
  publicKey: process.env.PUBLIC_KEY,
  timestamp42DaysAgo: process.env.TIMESTAMP_42_DAYS_AGO,
  account: process.env.ACCOUNT,
  symbol: process.env.SYMBOL,

  // {{ Add performance mode configurations }}
  validation: {
    performance_mode: true, // Enable or disable performance mode
    performance_mode_threshold: 2, // Threshold for failed requests to trigger performance mode
    request_retry_count: 2, // Number of retries for HTTP requests
    retry_delay_ms: 1000, // Delay between retries in milliseconds
  },
  p2p: {
    seedBlockCount: 10, // or whatever value you're using
    blocks_per_second: 5, // or whatever value you're using
  },
  api:{
    testAccount: 'sentnlagents',
    testSymbol: 'WAX',
    controllingAccount: 'a4v5y.waa',
  },
};