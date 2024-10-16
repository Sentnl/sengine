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
      GET_CONTROLLED_ACCOUNTS: 'Get controlled accounts test',
      PARTIAL: 'Partial Hyperion test',
    },
    GUILD: {
      GITHUB_USERNAME: 'Github username is set',
      BRANDING: 'Branding logos have been set',
      JSON_CONSISTENCY: 'guild_json_consistency',
    },
    API: {
      GET_INFO_CORRECT_CHAIN: 'Correct chain version',
      GET_INFO_UP_TO_DATE: 'Head block is up-to-date',
      CHECK_BLOCK_1: 'Check Block 1',
      ABI_SERIALIZER_TEST: 'Abi serializer test',
      CHECK_WAX_SYMBOL: 'Check WAX Symbol',
      PRODUCER_API: 'Producer api is not accessible',
      DBSIZE_API: 'Db_size api is not accessible',
      NET_API: 'Net api is not accessible',
      BLOCK_ONE_TEST: 'Block one test passed',
      LATEST_BLOCK_TEST: 'Latest block test passed',
      BASIC_SYMBOL_TEST: 'Basic symbol test passed',
    },
    ATOMIC:{
      HEALTH: 'Atomic Health was found',
      HEAD_BLOCK: 'Atomic Head Block is up to date',
      SERVICES: 'Atomic Services are ok',
      COLLECTIONS: 'Atomic Collections found',
      ASSET: 'Atomic Assets found',
      SCHEMA: 'Atomic Schema found',
      TEMPLATE: 'Atomic Template found',
    },
    PRICEFEED: {
      HEALTH: '3 Pricefeeds being supplied',
    },
    P2P: {
      CONNECTION_POSSIBLE: 'P2P Connection was possible',
      BLOCK_TRANSMISSION_SPEED: 'P2P Block Transmission Speed',
      CHAIN_ID_MATCH: 'P2P Chain ID Matches',
      P2P_NOT_AVAILABLE: 'No P2P nodes found for this producer',

    },
  };