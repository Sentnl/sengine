export const TEST_TYPES = {

    CORE: {
      HTTP: 'HTTP is available',
      HTTPS: 'HTTPS is available',
      HTTP2: 'HTTP2 is available',
      CORS: 'CORS is configured correctly',
      TLS_SECURITY: 'TLS test passed'
    },
    HYPERION: {
      FULL_NODE: 'Node is correctly marked as full',
      HEALTH: 'Hyperion Health was found',
      SERVICES: 'Hyperion services are ok',
      MISSING_BLOCKS: 'No missing blocks',
      GET_TRANSACTION: 'Get transaction test',
      GET_ACTIONS: 'Get actions test',
      GET_KEY_ACCOUNTS: 'Get key accounts test',
      PARTIAL: 'Partial Hyperion test',
    },
    GUILD: {
      GITHUB_USERNAME: 'Github username is set',
      BRANDING: 'Branding logos have been set',
    },
    API: {
      GET_INFO_CORRECT_CHAIN: 'Correct chain version',
      GET_INFO_UP_TO_DATE: 'Head block is up-to-date',
      CHECK_BLOCK_1: 'Check Block 1',
      ABI_SERIALIZER_TEST: 'Abi serializer test',
      CHECK_WAX_SYMBOL: 'Check WAX Symbol',
      PRODUCER_API: 'Producer api is not accessible',
      DBSIZE_API: 'Db_size api is not accessible',
      NET_API: 'Net api is not accessible'
    },
    P2P: {
      CONNECTION_POSSIBLE: 'p2p_connection_possible',
      BLOCK_TRANSMISSION_SPEED: 'p2p_block_transmission_speed',
    },
    // You can add other test types here, e.g.:
    // ATOMIC: { ... }
  };