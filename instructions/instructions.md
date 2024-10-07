# Project overview

You are building a monitoring platform that will every 15 minutes (configurable) check the status of a particular list of services offered by block producers on the WAX Blockchain.
It should consist of a backend that performs the monitoring of each service attached to each block producer.
And a frontend where the results can be viewed on high level and also a granular level. 
The tests should be perform for mainnet and testnet.


## Backend

Backend stack:  fastify, postgres, javascript ESM (and do not use typescript)

###  Backend Core Functionalities

Libraries to use:

1. For HTTP/HTTPS requests - https://github.com/sindresorhus/ky
2. For RPC connectins to the blockchain use -  eosjs   (for example when we need to get the list of all block producers.)
3. When you need a hyperion node or history node to obtain inforamtion - https://github.com/Sentnl/nodepulse


Configuration File (.env)

Contains the following information:
```
PUBLIC_KEY=EOS8EnadnLuzFZX9EQBsS9xLKqDz48HF5nY5v6RvzAcNj8TmWqZ5s
TIMESTAMP_42_DAYS_AGO=2024-02-21T00:00:00Z
MAINNET_CHAIN_VERSION=1064487b3cd1a897ce03ae5b6a865651747e2e152090f99c1d19d44e01aea5a4
TESTNET_CHAIN_VERSION=f16b1833c747c43682f4386fca9cbb327929334a762755ebec17f6f23c9b8a12
ACCOUNT=sentnlagents
SYMBOL=WAX
```


1. Fetch the list of block producers from the WAX blockchain (mainnet and testnet). Use the wharfkit for this - https://wharfkit.com/docs/contract-kit/table-class
    1. Extract the website for each producer 
    2. Look for a file called chains.json  obtain the the JSON files for mainnet and testnet. The chains.json file looks like this. You will notice that the .env file contain strings for eah chain, which corrosponds to the location for the mainnet and testnet JSON files.
    ```json
      {
    "chains": {
      "aca376f206b8fc25a6ed44dbdc66547c36c6c33e3a119ffbeaef943642f0e906": "/bp.json",
      "1064487b3cd1a897ce03ae5b6a865651747e2e152090f99c1d19d44e01aea5a4": "/wax.json",
      "f16b1833c747c43682f4386fca9cbb327929334a762755ebec17f6f23c9b8a12": "/waxtest.json",
      "4667b205c6838ef70ff7988f6e8257e8be0e1284a2f59699054a018f743b1d11": "/telos.json",
      "1eaa0824707c8c16bd25145493bf062aecddfeb56c736f6ba6397f3195f33c9f": "/telostest.json"
    }
  }
  ```
    3. Each block producer should be saved to the database for mainnet and testnet (be careful as sometimes testnet amd mainnet will hav the same producer name). Save the producername, website, chain.json location, json file that corrosponds to chain.
    2. Then for each producer listed for mainnet and testnet, and extract the logo_svg and then extract the services from the block producer's JSON metadata. Example of a JSON file is provided here.
```json
    {
  "producer_account_name": "sentnlagents",
  "org": {
    "candidate_name": "Sentnl",
    "website": "https://www.sentnl.io",
    "code_of_conduct": "https://medium.com/@charles.holtzkampf/wax-code-of-conduct-c135050c49a4",
    "ownership_disclosure": "https://medium.com/@charles.holtzkampf/wax-code-of-conduct-c135050c49a4#2dd3",
    "email": "charles@sentnl.io",
    "github_user": [
      "ankh2054"
    ],
    "branding": {
      "logo_256": "https://www.sentnl.io/sentnl_256.png",
      "logo_1024": "https://www.sentnl.io/sentnl_1024.png",
      "logo_svg": "https://www.sentnl.io/sentnl.svg"
    },
    "location": {
      "name": "London",
      "country": "GB",
      "latitude": 51.51118829,
      "longitude": -0.09617353
    },
    "social": {
      "steemit": "",
      "twitter": "sentnl_io",
      "facebook": "",
      "github": "ankh2054",
      "reddit": "",
      "keybase": "ankh2054",
      "telegram": "ankh2054"
    }
  },
  "nodes": [
    {
      "location": {
        "name": "Falkenstein",
        "country": "DE",
        "latitude": 49.0975,
        "longitude": 12.48802
      },
      "node_type": "query",
      "api_endpoint": "http://hyperion7.sentnl.io",
      "ssl_endpoint": "https://hyperion7.sentnl.io",
      "features": [
        "chain-api",
        "hyperion-v2",
        "history-v1"
      ],
      "full": true
    },
    {
      "location": {
        "name": "Falkenstein",
        "country": "DE",
        "latitude": 49.0975,
        "longitude": 12.48802
      },
      "node_type": "seed",
      "p2p_endpoint": "waxp2p.sentnl.io:9876"
    },
    {
      "location": {
        "name": "Falkenstein",
        "country": "DE",
        "latitude": 49.0975,
        "longitude": 12.48802
      },
      "node_type": "producer"
    },
    {
      "location": {
        "name": "Falkenstein",
        "country": "DE",
        "latitude": 49.0975,
        "longitude": 12.48802
      },
      "node_type": "query",
      "api_endpoint": "http://atomic.sentnl.io/",
      "ssl_endpoint": "https://atomic.sentnl.io/",
      "features": [
        "atomic-assets-api"
      ]
    },
    {
      "location": {
        "name": "Falkenstein",
        "country": "DE",
        "latitude": 49.0975,
        "longitude": 12.48802
      },
      "node_type": "query",
      "api_endpoint": "http://ipfs-gateway.sentnl.io/",
      "ssl_endpoint": "https://ipfs-gateway.sentnl.io/",
      "features": [
        "ipfs"
      ]
    },
    {
      "location": {
        "name": "Falkenstein",
        "country": "DE",
        "latitude": 49.0975,
        "longitude": 12.48802
      },
      "node_type": "query",
      "api_endpoint": "http://light-api.sentnl.io/",
      "ssl_endpoint": "https://light-api.sentnl.io/",
      "features": [
        "light-api"
      ]
    }
  ]
}
```

    3. Save the services to the database. Making sure you clearly also save the features attached to each service and in the case of hyperion whether full is true or false.
    4. Also save the logo_svg to the database.
     
2. Every 15 minutes the backend should check each of the services listed below.

 
 a. Before we start checking the services we need to obtain some core information which is used during the checks:
    To obtain this information you can connect to a hyperion node using this library https://github.com/Sentnl/nodepulse ( it ensures that you are always connecting to a working one)
    1. The latest headblock from hyperion 
    2. a Transaction from the latest headblock
    3. Atomic AssetID - get an assetid fromGa working atomic APi - /atomicassets/v1/assets?page=1&limit=1&order=desc&sort=asset_id\
    4. delphioracle actions - Get actions data the last 100 actions of the account delphioracle. 

 b. The checks listed should be checked for both mainnet and testnet
 c. Each check result should be saved in the database. Was it sucessfull or not and if not why not. Include the response and code and the error if any.
 d. Code example for the checks have been provided in DOC.
 e. JSON examples of checks have also been provided in DOC


    

Services to Check


    1. Guild checks 

        1. Website is reachable - Website is reachable 
        2. Chains.json is accessible - Chains file exists (ths will point to mainnetor testnet JSON files)
        3. BP.json is accessible and valid - Check mainnet or testnet JSON file exist and is valid JSON
        4. Github username was provided - Check that at least one github username is specified
        5. Branding logos provided - Branding is provided in all three formats (logo_256,logo_1024,logo_svg)
   
    1. Hyperion checks (for code examples see DOC)
        1. Provided endpoint url is valid - Provided endpoint url is valid
        2. Node is correctly marked as full - Check if marked as full or partial and mark accordingly.
        3. Check http2 is available  - Check http2 is available
        4. Check CORS headers are configured properly - check cors is working correctly. 
        5. HTTP  available - check HTTP is available
        6. HTTPS is available - check HTTPS is available
        7. Hyperion Health was found - Hyperion Health was found /v2/health
        8. Hyperion services all ok - Check all the services in /v2/health are ok. If not okay add to the database which services are not okay.
        9. Check missing blocks = Check missing blocks is 0. if not then fail and save missing blocks number
        10. Then perform the following requests. We should get a 200 response.
            1. get_transaction test - POST /v2/history/get_transaction?id={transaction_id}. We should get a 200 response and the transaction should be valid.
            2. get_actions test - POST /v2/history/get_actions?limit=1. We should get a 200 response and should be valid.
            3. get_key_accounts test - POST /v2/state/get_key_accounts - payload ({ "public_key": "public_key in config" })  We should get a 200 response and should be valid.
            4. Partial Hyperion test  - If the hyperion node is a partial node then also perform this. /v2/history/get_actions?limit=1&before={42 days ago in config }&after={42 days ago in config + 1 day}

    2. API checks  (for code examples see DOC)
        1. Provided endpoint url is valid - check the endpoint and respone is 200
        2. Perform a TLS security test - Check TLS and security. Python code provided in DOC
        5. HTTP  available - check HTTP is available
        6. HTTPS is available - check HTTPS is available
        4. GET /v1/chain/get_info and then check:
            1. Correct chain - The chain version matches the expected version
            2. Head block is up-to-date - (check against the headblock we obtained during our core checks)
            3. Check Block 1 - POST /v1/chain/get_block { "block_num_or_id": 1, "json": true }  We should get a 200 response and should be valid.
            4. Abi serializer test  - POST /v1/chain/get_block { "json": true, "block_num_or_id": headblock -1 }
            5. Check WAX Symbol - /v1/chain/get_currency_balance - { "json": true, "account": account from config , "code": "eosio.token", "symbol": symbol from config }
        5. Check the following liunks and ensure they dont exist. So we want a 404.
            1. Producer api  - /v1/producer/get_integrity_hash
            2. Db_size api - /v1/db_size/get
            3. Net api - /v1/net/connections

    3. P2P aka seed node checks
        1. P2P node is accessible
        2. P2P connections was possible - Check we could initiai a P2P conection to the node
        3. Block transmission speed - Check the block transmission speed was okay.


    4. History checks
        1. Provided endpoint url is valid
        2. HTTP  available - check HTTP is available
        3. HTTPS is available - check HTTPS is available
        4. Check CORS headers are configured properly - check cors is working correctly. 
        4. Then perform the following requests. We should get a 200 response.
            1. get_transaction test-  POST /v1/history/get_transaction?id={transaction_id}. We should get a 200 response and the transaction should be valid.
            2. get_actions test - POST /v1/history/get_actions?limit=1. We should get a 200 response and should be valid.
            3. get_key_accounts test - POST /v1/history/get_key_accounts - payload ({ "public_key": "public_key in config" })  We should get a 200 response and should be valid.
            4. get_controlled_accounts - test POST /v1/history/get_controlled_accounts - { "json": true, "controlling_account":  account from config}

    5. Atomic assets checks
        1. Provided endpoint url is valid
        2. Check both HTTP and HTTTPS is available
        3. GET /health 
            1. Check all services are ok
            2. Correct chain - Check the chain version is correct
            3. Head block is up-to-date - Check that the headblock is in align with the current headblock. So you can check the headblock in /health and then compare against headblock we obtained at the start and ensure it not older than 10 blocks.
        4. Then perform the following requests. We should get a 200 response and success should equal true.
            1. Atomicassets collections test - GET /atomicassets/v1/collections/kogsofficial
            2. Atomicassets templates test - GET /atomicassets/v1/templates?collection_name=kogsofficial&has_assets=true&page=1&limit=1&order=desc&sort=created
            3. Atomicassets schema test - GET /atomicassets/v1/schemas/kogsofficial/2ndedition
            3  Atomicassets assets test - GET  atomicassets/v1/assets/{Atomic AssetID}   (Use the Atomic Asset ID we obtained during core checks)
        5. Also test AtomicMarket endpoints.

    6. Oracle Feed
        Each producer should publish price feeds to chain. I have provided some python code as an example in DOC.
        Using the actions data from delphioracle cfrom core checks
        1. Pricefeed provided - Check the producer exists in that list
        2. 3 Pricefeeds provided - Check that the producer has provided at least 3 price feeds.
    7. ON Chain JSON
        Each producer should publish their website JSON file to chain (this is only a mainnet requirement so this can be ignored fo testnet)
        1. On chain JSON matches web version - Compare the website JSON file against the chain version. If JSON does not match identify the mismatch and save that mismatch to the DB for late retrieval.

	3.	Data Storage and API
	  1. Database: Use PostgreSQL to store all the results and relevant data.
    2. REST APIs: Provide endpoints for the frontend to:
	    •	Query results with filter options (producer name, testnet/mainnet, date range)
	    •	Retrieve a list of producers (filterable by mainnet and testnet)
	    •	Get lists of hyperion and atomic nodes
	4.	Scheduling
	  •	Schedule the entire process to run every 15 minutes (configurable).
	  •	Ensure that the scheduling mechanism is reliable and handles errors gracefully.

backend/
├── package.json
├── src/
    ├── index.js                // Entry point for the Fastify server
    ├── config.js               // Configuration variables
    ├── routes.js               // REST API endpoints
    ├── controllers/
    │   └── checksController.js // Handles API requests and responses
    ├── services/
    │   ├── monitoringService.js// Logic for scheduling and performing checks
    │   ├── blockchainService.js// Interacts with the blockchain
    │   └── dataService.js      // Handles database interactions
    └── models/
        └── db.js               // Sets up PostgreSQL connection

## Frontend

Frontend stack: Next.js, tailwind, shadcn, Lucide Icons

###  Frontend Core Functionalities

The frontend will be where the checks we have performed can be viewed.


**Main Page (Producer Validations)**

1. The Mainpage (Producer Validations) should show two tabs Mainnet and Testnet.
2. Each tab should show a list of producers in cards. 
  1. Each producer cards should be sqaure. 
  2. Avatar as the producer logo - the logo_256 from the producers JSON file on their website) followed by producer name.
  3. Each of the services (atomic, hyperion, guild, chainsjson, api, history, pricefeed, missingblocks) as a badge either green for pass or red for fail.
  4. Top21 badge (green if they are in the top21) no badge if not.
3. The frontend should utilise breadcrumbs for easy navigation.
4. When user clicks on producer card, you get more details on all the checks.

**Producer Detail Page**

  1. A card with producer logo, website link

	1.	A rectangular card displays an overview of services.
    1.	Each service is represented by a badge, colored green (for up) or red (for down).
    2.	Each service also shows a percentage representing its uptime, defaulting to the last 30 days.
    3.	Include a date range selection feature, allowing users to choose a start and end date to view uptime percentages for specific days.

  2. A chart that should be able to be minimized.
    1. The chart shows us the missing blocks for each producer.
    2. Ths chart should also default to showing the last 30 days and update based on  date range selection feature dates.

  3. List each individual service in a card with: 
    1. the check heading as a badge with either green or red (pass or fail)
    2. Request made for example http://url//atomicassets/v1/collections/kogsofficial
    3. Response - what the response was.
    4. Duplicate test - curl request url (must be able to copy and paste)




**STATSPAGE**
 
1. A list of all producers and their services, but showing a percentage against each service. 
2. Same setup as Main page, but with percentages.
3. Include a date range selection feature, allowing users to choose a start and end date to view uptime percentages for specific days.




**SIDEBAR**

Sidebar Navigation
	•	Accessible from all pages.
	•	Includes links to:
	•	Producer Validations (default page)
	•	Producer Stats

**External sources loading:**
When the frontend loads we need to load some data from an external sources. Only load this for mainnet and when testnet is chosen load for testnet

1. Producer logos - the logo_256 from the producers JSON file on their website. If there is a way to cache these that would be helpful
2. Missing blocks data from each producer. Defaulting to the last 30 days. DOC section has an explanation of how that works.
3. Missing Blocks data for each producer needs to be calculated as pass or fail. Calculate pass/fail based on percentageReliability compared to a threshold specified in the configuration file.



**Frontend File Structure**

```
frontend/
├── package.json
├── next.config.js
├── postcss.config.js
├── tailwind.config.js
├── tsconfig.json
├── src/
    ├── pages/
    │   ├── _app.tsx            // Custom App component
    │   ├── index.tsx           // Main page (Producer Validations)
    │   ├── producer/
    │   │   └── [name].tsx      // Dynamic route for producer details
    │   └── stats.tsx           // Stats page
    ├── components/
    │   ├── Layout.tsx          // Common layout wrapper
    │   ├── Sidebar.tsx         // Sidebar navigation
    │   ├── ProducerCard.tsx    // Producer card component
    │   └── ServiceBadge.tsx    // Service badge component
    ├── styles/
    │   └── globals.css         // Global CSS and Tailwind directives
    └── lib/
        └── api.js              // Functions to interact with the backend API
```

# Documentation and Examples


Example of the JSON metadataon block producer website:
```json
{
  "producer_account_name": "sentnlagents",
  "org": {
    "candidate_name": "Sentnl",
    "website": "https://www.sentnl.io",
    "code_of_conduct": "https://medium.com/@charles.holtzkampf/wax-code-of-conduct-c135050c49a4",
    "ownership_disclosure": "https://medium.com/@charles.holtzkampf/wax-code-of-conduct-c135050c49a4#2dd3",
    "email": "charles@sentnl.io",
    "github_user": [
      "ankh2054"
    ],
    "branding": {
      "logo_256": "https://www.sentnl.io/sentnl_256.png",
      "logo_1024": "https://www.sentnl.io/sentnl_1024.png",
      "logo_svg": "https://www.sentnl.io/sentnl.svg"
    },
    "location": {
      "name": "London",
      "country": "GB",
      "latitude": 51.51118829,
      "longitude": -0.09617353
    },
    "social": {
      "steemit": "",
      "twitter": "sentnl_io",
      "facebook": "",
      "github": "ankh2054",
      "reddit": "",
      "keybase": "ankh2054",
      "telegram": "ankh2054"
    }
  },
  "nodes": [
    {
      "location": {
        "name": "Falkenstein",
        "country": "DE",
        "latitude": 49.0975,
        "longitude": 12.48802
      },
      "node_type": "query",
      "api_endpoint": "http://hyperion7.sentnl.io",
      "ssl_endpoint": "https://hyperion7.sentnl.io",
      "features": [
        "chain-api",
        "hyperion-v2",
        "history-v1"
      ],
      "full": true
    },
    {
      "location": {
        "name": "Falkenstein",
        "country": "DE",
        "latitude": 49.0975,
        "longitude": 12.48802
      },
      "node_type": "seed",
      "p2p_endpoint": "waxp2p.sentnl.io:9876"
    },
    {
      "location": {
        "name": "Falkenstein",
        "country": "DE",
        "latitude": 49.0975,
        "longitude": 12.48802
      },
      "node_type": "producer"
    },
    {
      "location": {
        "name": "Falkenstein",
        "country": "DE",
        "latitude": 49.0975,
        "longitude": 12.48802
      },
      "node_type": "query",
      "api_endpoint": "http://atomic.sentnl.io/",
      "ssl_endpoint": "https://atomic.sentnl.io/",
      "features": [
        "atomic-assets-api"
      ]
    },
    {
      "location": {
        "name": "Falkenstein",
        "country": "DE",
        "latitude": 49.0975,
        "longitude": 12.48802
      },
      "node_type": "query",
      "api_endpoint": "http://ipfs-gateway.sentnl.io/",
      "ssl_endpoint": "https://ipfs-gateway.sentnl.io/",
      "features": [
        "ipfs"
      ]
    },
    {
      "location": {
        "name": "Falkenstein",
        "country": "DE",
        "latitude": 49.0975,
        "longitude": 12.48802
      },
      "node_type": "query",
      "api_endpoint": "http://light-api.sentnl.io/",
      "ssl_endpoint": "https://light-api.sentnl.io/",
      "features": [
        "light-api"
      ]
    }
  ]
}
```

## Example of Hyperion /v2/health JSON

{"version":"3.3.9-8","version_hash":"b94f99d552a8fe85a3ab2c1cb5b84ccd6ded6af4","host":"hyperion6.sentnl.io","health":[{"service":"RabbitMq","status":"OK","time":1727941289636},{"service":"NodeosRPC","status":"OK","service_data":{"head_block_num":332934643,"head_block_time":"2024-10-03T07:41:29.500","time_offset":136,"last_irreversible_block":332934307,"chain_id":"1064487b3cd1a897ce03ae5b6a865651747e2e152090f99c1d19d44e01aea5a4"},"time":1727941289636},{"service":"Elasticsearch","status":"OK","service_data":{"active_shards":"100.0%","head_offset":0,"first_indexed_block":2,"last_indexed_block":332934643,"total_indexed_blocks":332934641,"missing_blocks":0,"missing_pct":"0.00%"},"time":1727941289637}],"features":{"streaming":{"enable":true,"traces":true,"deltas":true},"tables":{"proposals":true,"accounts":true,"voters":true},"index_deltas":true,"index_transfer_memo":true,"index_all_deltas":true,"deferred_trx":false,"failed_trx":false,"resource_limits":false,"resource_usage":false},"cached":true,"query_time_ms":0.368,"last_indexed_block":332934654,"last_indexed_block_time":"2024-10-03T07:41:35.000"}


## Example of History /v1/chain/get_info JSON

{"server_version":"2fa62c4c","chain_id":"1064487b3cd1a897ce03ae5b6a865651747e2e152090f99c1d19d44e01aea5a4","head_block_num":332937536,"last_irreversible_block_num":332937211,"last_irreversible_block_id":"13d837fbe593e39bb1312fc1ce209cc3313f753a6aec743fd98a20ee5a30be44","head_block_id":"13d8394037933dd454dbd26feed80ffa88f955b82c2420b30fd0f9c4314c21e3","head_block_time":"2024-10-03T08:05:36.000","head_block_producer":"eosphereiobp","virtual_block_cpu_limit":211710,"virtual_block_net_limit":1048576000,"block_cpu_limit":200000,"block_net_limit":1048576,"server_version_string":"v5.0.1wax01","fork_db_head_block_num":332937536,"fork_db_head_block_id":"13d8394037933dd454dbd26feed80ffa88f955b82c2420b30fd0f9c4314c21e3","server_full_version_string":"v5.0.1wax01-2fa62c4c3e3dafaa5331598c27b340d362095635-dirty","total_cpu_weight":"46465111119432256","total_net_weight":"121963807807090562","earliest_available_block_num":1,"last_irreversible_block_time":"2024-10-03T08:02:53.500"}


## Example of atomic /health  JSON
{"success":true,"data":{"version":"1.3.24","postgres":{"status":"OK","readers":[{"block_num":"332939793"}]},"redis":{"status":"OK"},"chain":{"status":"OK","head_block":332939792,"head_time":1727943864000}},"query_time":1727943864549}


## Example of /atomicassets/v1/assets?page=1&limit=1&order=desc&sort=asset_id JSON

{"success":true,"data":[{"contract":"atomicassets","asset_id":"1099589982448","owner":"pfpwizardpfp","is_transferable":true,"is_burnable":true,"collection":{"collection_name":"pfpwizardbot","name":"PFP Wizard","img":null,"images":"{\"banner_1920x500\":\"QmRQVEsXUBbZ5heEEKRSWtPvwbbmMMX7nhXTaYfKAZrpbW\",\"logo_512x512\":\"QmbUPYPiHBpiwQuyokfjHQfcdX5aVYqz9iGwZegu7JF2zb\"}","author":"exitlmbrhino","allow_notify":true,"authorized_accounts":["exitlmbrhino","blend.nefty","nfthivedrops","pfpwizardpfp","up.nefty","pfpwizardgen"],"notify_accounts":["blend.nefty"],"market_fee":0.02,"created_at_block":"252957413","created_at_time":"1702373318500"},"schema":{"schema_name":"test.fawn","format":[{"name":"name","type":"string"},{"name":"img","type":"image"},{"name":"backimg","type":"image"},{"name":"full_ownership","type":"string"},{"name":"secondary_market","type":"string"},{"name":"Background","type":"string"},{"name":"Type","type":"string"},{"name":"Base","type":"string"},{"name":"Eyes","type":"string"},{"name":"Mouth","type":"string"},{"name":"Cloth","type":"string"},{"name":"Earring","type":"string"},{"name":"Glasses","type":"string"},{"name":"Necklace","type":"string"},{"name":"Horns","type":"string"}],"created_at_block":"302753157","created_at_time":"1727275823500"},"template":{"template_id":"655503","max_supply":"0","is_transferable":true,"is_burnable":true,"issued_supply":"47","immutable_data":{"backimg":"QmNfH3qiAETKxe3eS3LkCcPSor4AnEsinXFAcfdzyb4Htc","full_ownership":"When you acquire an Abyssal NFT, it’s entirely yours. You have the freedom to showcase it, trade it, or use it as a digital collectible in any way you see fit.","secondary_market":"A full 100% fee is levied on transactions involving our three core collections: Male, Female, and Baby Deer NFTs"},"created_at_time":"1727276004000","created_at_block":"302753518"},"mutable_data":{},"immutable_data":{"img":"QmcmNhKY4L2eZMdXvmSMsF4vRXXWpeeCra5bz5wY5EPJd9","Base":"Zebra","Eyes":"Fire","Type":"Devil","name":"Fawn #0047","Cloth":"Missing","Horns":"Water","Mouth":"Smoker","Earring":"Missing","Glasses":"Matrix","Necklace":"Missing","Background":"Wattle"},"template_mint":"47","backed_tokens":[],"burned_by_account":null,"burned_at_block":null,"burned_at_time":null,"updated_at_block":"304084681","updated_at_time":"1727941598500","transferred_at_block":"304084681","transferred_at_time":"1727941598500","minted_at_block":"304084681","minted_at_time":"1727941598500","data":{"img":"QmcmNhKY4L2eZMdXvmSMsF4vRXXWpeeCra5bz5wY5EPJd9","Base":"Zebra","Eyes":"Fire","Type":"Devil","name":"Fawn #0047","Cloth":"Missing","Horns":"Water","Mouth":"Smoker","Earring":"Missing","Glasses":"Matrix","Necklace":"Missing","Background":"Wattle","backimg":"QmNfH3qiAETKxe3eS3LkCcPSor4AnEsinXFAcfdzyb4Htc","full_ownership":"When you acquire an Abyssal NFT, it’s entirely yours. You have the freedom to showcase it, trade it, or use it as a digital collectible in any way you see fit.","secondary_market":"A full 100% fee is levied on transactions involving our three core collections: Male, Female, and Baby Deer NFTs"},"name":"Fawn #0047"}],"query_time":1727944566548}

## Example of /v2/history/get_actions?account=delphioracle&limit=100 JSON

"query_time_ms":73.111,"cached":false,"lib":0,"last_indexed_block":397423204,"last_indexed_block_time":"2024-10-03T08:52:53.500","total":{"value":10000,"relation":"gte"},"actions":[{"@timestamp":"2024-10-03T08:52:09.000","timestamp":"2024-10-03T08:52:09.000","block_num":397423115,"block_id":"17b0320b7264f4ab69a6636bc15e960aa476b54f6d01f9e4e1450edac8bff1bf","trx_id":"aaf9ee79c9af7675a8b769171f04ef0fbc14872590b2f6773de7638c1378a38d","act":{"account":"delphioracle","name":"write","authorization":[{"actor":"eosiodetroit","permission":"feed"}],"data":{"owner":"eosiodetroit","quotes":[{"value":"4625","pair":"eosusdt"},{"value":"23345066","pair":"ethusd"},{"value":"601814666","pair":"btcusd"},{"value":"762","pair":"eosbtc"}]}},"receipts":[{"receiver":"delphioracle","global_sequence":361838163251,"recv_sequence":17095964,"auth_sequence":[{"account":"eosiodetroit","sequence":1669895}]}],"cpu_usage_us":542,"net_usage_words":21,"global_sequence":361838163251,"producer":"teamgreymass","action_ordinal":1,"creator_action_ordinal":0,"signatures":["SIG_K1_KYzr4Rro9tiWA6HaLAeigS3d4QfsZCHjkTiLrduPTKMHeMk21UEb3wTjKoAc7MnZpurLUzv4x88BMFUM1B21VDfdbWTBNJ"]},{"@timestamp":"2024-10-03T08:52:08.500","timestamp":"2024-10-03T08:52:08.500","block_num":397423114,"block_id":"17b0320aba6b44aba94dbb8ce3926fa1567d2016d2b5951d9ec92f0d05d93304","trx_id":"17fc2ee628386150f8f57a75fc2df34a99aaa2facf4bc6b108003209626943b6","act":{"account":"delphioracle","name":"write","authorization":[{"actor":"ivote4eosusa","permission":"delphioracle"}],"data":{"owner":"ivote4eosusa","quotes":[{"value":"4604","pair":"eosusd"},{"value":"764","pair":"eosbtc"},{"value":"602588300","pair":"btcusd"},{"value":"4246138200","pair":"btccny"},{"value":"23363800","pair":"ethusd"},{"value":"60","pair":"eosemt"},{"value":"6901","pair":"vigeos"},{"value":"11457","pair":"eosvigor"},{"value":"4610","pair":"eosusdt"},{"value":"12239","pair":"iqeos"}]}},"receipts":[{"receiver":"delphioracle","global_sequence":361838163233,"recv_sequence":17095963,"auth_sequence":[{"account":"ivote4eosusa","sequence":1409783}]}],"cpu_usage_us":832,"net_usage_words":33,"global_sequence":361838163233,"producer":"teamgreymass","action_ordinal":1,"creator_action_ordinal":0,"signatures":["SIG_K1_JwmgQX2aPtcH1doD3FXzHykuzq6TZXSVjWh4eeMAF215cT6XzB6uiDjYTDiTZYZT1w8aqhkiw5aVy7gmytLhwPqtfayx8k"]},{"@timestamp":"2024-10-03T08:52:06.500","timestamp":"2024-10-03T08:52:06.500","block_num":397423110,"block_id":"17b03206496fb9dff76e768256db04afc456cc6de41ee1c188bcb1fcd28b5e87","trx_id":"065ce54318a4a22719583bb736ca90f5d79c00eebfca0279c4f76c07b9904bc2","act":{"account":"delphioracle","name":"write","authorization":[{"actor":"teamgreymass","permission":"oracle"}],"data":{"owner":"teamgreymass","quotes":[{"value":"4582","pair":"eosusd"},{"value":"763","pair":"eosbtc"},{"value":"602990710","pair":"btcusd"}]}},"receipts":[{"receiver":"delphioracle","global_sequence":361838163096,"recv_sequence":17095962,"auth_sequence":[{"account":"teamgreymass","sequence":2347044}]}],"cpu_usage_us":453,"net_usage_words":19,"global_sequence":361838163096,"producer":"teamgreymass","action_ordinal":1,"creator_action_ordinal":0,"signatures":["SIG_K1_JysxjDXhwAsyM5aniKJ6ugezHFGnFvnTYX8tXJY5KKtAmnTNej4UjuKGnyzR9T5eurW4bceHnqAH5nzaezLs8zhCqWN3U6"]},{"@timestamp":"2024-10-03T08:51:06.500","timestamp":"2024-10-03T08:51:06.500","block_num":397422990,"block_id":"17b0318eb0aa6e77300c195a27c8c3c091092529d8632d8d2e263e69276e44a2","trx_id":"339bb30aac1d6f3cc94a48bcc86899ac973a9b20790254b8cb188bd7c2c6b040","act":{"account":"delphioracle","name":"write","authorization":[{"actor":"teamgreymass","permission":"oracle"}],"data":{"owner":"teamgreymass","quotes":[{"value":"4597","pair":"eosusd"},{"value":"764","pair":"eosbtc"},{"value":"603585556","pair":"btcusd"}]}},"receipts":[{"receiver":"delphioracle","global_sequence":361838160263,"recv_sequence":17095961,"auth_sequence":[{"account":"teamgreymass","sequence":2347043}]}],"cpu_usage_us":206,"net_usage_words":19,"global_sequence":361838160263,"producer":"eosiodetroit","action_ordinal":1,"creator_action_ordinal":0,"signatures":["SIG_K1_KA4QCrL5x16RhREuQFwh2EVya8khWkzXykELzowqctDYYUVt3ZguPA7L3TfXWwc9Mrq66zAZGWJxzkiPXn9NzzTqWkwfQq"]},{"@timestamp":"2024-10-03T08:51:03.000","timestamp":"2024-10-03T08:51:03.000","block_num":397422983,"block_id":"17b031878c149aee1bbbcc9819dc16c1fcd406beed510a917c08987d54234c71","trx_id":"7b281281d2e70c8deda124789d45b662aabfd91c9872c24e97276cff6e21bb49","act":{"account":"delphioracle","name":"write","authorization":[{"actor":"cryptolions1","permission":"oracle"}],"data":{"owner":"cryptolions1","quotes":[{"value":"4619","pair":"eosusd"},{"value":"23447900","pair":"ethusd"},{"value":"604010000","pair":"btcusd"},{"value":"10000","pair":"usdtusd"},{"value":"70500","pair":"usdtcny"}]}},"receipts":[{"receiver":"delphioracle","global_sequence":361838160147,"recv_sequence":17095960,"auth_sequence":[{"account":"cryptolions1","sequence":1530053}]}],"cpu_usage_us":765,"net_usage_words":23,"global_sequence":361838160147,"producer":"eosinfstones","action_ordinal":1,"creator_action_ordinal":0,"signatures":["SIG_K1_KcVeFT5tPsnxDdSS3iHCj8spD8pyn91JCQxYw8L96wmJBEreCHfQpeJeZQ8WSEJbegYSV31atkmRX58AzhqPCJXXpTEYnW"]},{"@timestamp":"2024-10-03T08:50:09.000","timestamp":"2024-10-03T08:50:09.000","block_num":397422875,"block_id":"17b0311bdbdb9572d837cdb3e152a7807ad017bbd0a5e697eac8426a155a8789","trx_id":"704cbb2089d72aaf58a696dd3ce6048c8d32509a6c546f3fa9ed16662a10f9f1","act":{"account":"delphioracle","name":"write","authorization":[{"actor":"eosiodetroit","permission":"feed"}],"data":{"owner":"eosiodetroit","quotes":[{"value":"4639","pair":"eosusdt"},{"value":"23384066","pair":"ethusd"},{"value":"602647000","pair":"btcusd"},{"value":"764","pair":"eosbtc"}]}},"receipts":[{"receiver":"delphioracle","global_sequence":361838157792,"recv_sequence":17095959,"auth_sequence":[{"account":"eosiodetroit","sequence":1669894}]}],"cpu_usage_us":754,"net_usage_words":21,"global_sequence":361838157792,"producer":"atticlabeosb","action_ordinal":1,"creator_action_ordinal":0,"signatures":["SIG_K1_KB9pmuEb17yXNaf5okumK4biTiJqjyKHsRqtSxqhXFB6wJjFPehSrrgjd4KcSBGmzAVvRzhGTXxcBKcJow4oYD7vJmfpN5"]},{"@timestamp":"2024-10-03T08:50:09.000","timestamp":"2024-10-03T08:50:09.000","block_num":397422875,"block_id":"17b0311bdbdb9572d837cdb3e152a7807ad017bbd0a5e697eac8426a155a8789","trx_id":"6d846076f1f65c15f8fce2cd03b0030cb8342a8c8bcb876aba2899790fb63d02","act":{"account":"delphioracle","name":"write","authorization":[{"actor":"ivote4eosusa","permission":"delphioracle"}],"data":{"owner":"ivote4eosusa","quotes":[{"value":"4620","pair":"eosusd"},{"value":"765","pair":"eosbtc"},{"value":"603312700","pair":"btcusd"},{"value":"4251242700","pair":"btccny"},{"value":"23447900","pair":"ethusd"},{"value":"60","pair":"eosemt"},{"value":"6901","pair":"vigeos"},{"value":"11457","pair":"eosvigor"},{"value":"4619","pair":"eosusdt"},{"value":"12239","pair":"iqeos"}]}},"receipts":[{"receiver":"delphioracle","global_sequence":361838157780,"recv_sequence":17095958,"auth_sequence":[{"account":"ivote4eosusa","sequence":1409782}]}],"cpu_usage_us":4788,"net_usage_words":33,"global_sequence":361838157780,"producer":"atticlabeosb","action_ordinal":1,"creator_action_ordinal":0,"signatures":["SIG_K1_KAWnkLpEn4bs4R8zE5pPiFAgRUjV5JXayE39GrCjqVWH8CufNe4yoUx8fCMb4Rd7wAkjfY7KgFVzxm31adKduubmBoWnT5"]}


## Examples on how to get missing block data.

Missing block information can be obtained as following: 
You need to pass in the producername and the start and end dates.
Mainnet 
https://missm.sentnl.io/missing-blocks?ownerName=sentnlagents&startDate=2024-09-03T10%3A14%3A39.813Z&endDate=2024-10-03T10%3A14%3A39.813Z

Tesnet 
https://misst.sentnl.io/missing-blocks?ownerName=sentnlagents&startDate=2024-09-03T10%3A14%3A39.813Z&endDate=2024-10-03T10%3A14%3A39.813Z

The results looks like this.

      ```json
      {
  "ownerName": "eosdublinwow",
  "startDate": "2024-09-03T10:14:39.813Z",
  "endDate": "2024-10-03T10:14:39.813Z",
  "totalExpectedBlocks": 185203,
  "totalMissedBlocks": 12,
  "percentageMissed": 0.006,
  "percentageReliability": 99.994,
  "data": [
    {
      "owner_name": "eosdublinwow",
      "block_number": 303549240,
      "date": "2024-09-30 05:24:05.500000",
      "round_missed": true,
      "blocks_missed": false,
      "missed_block_count": 12
    }
  ]
}
```


## Examples code for testing the API 
```ts
import * as config from "config";
import { HttpErrorType } from "../validationcore-database-scheme/enum/HttpErrorType";
import { Guild } from "../validationcore-database-scheme/entity/Guild";
import { NodeApi } from "../validationcore-database-scheme/entity/NodeApi";
import { getConnection } from "typeorm";
import { Logger } from "tslog";
import * as http from "../httpConnection/HttpRequest";
import { isURL } from "validator";
import { ValidationLevel } from "../validationcore-database-scheme/enum/ValidationLevel";
import {
  allChecksOK,
  calculateValidationLevel, extractLatitude, extractLongitude,
  logger,
  validateBpLocation
} from "../validationcore-database-scheme/common";
import { getChainsConfigItem, serverVersionsConfig } from "../validationcore-database-scheme/readConfig";

/**
 * Logger Settings for NodeApi
 */
const childLogger: Logger = logger.getChildLogger({
  name: "Api-Validation",
  displayFilePath: "hidden",
  displayLoggerName: true,
});

/**
 * Performs all validations for an NodeApi-Node
 * @param {Guild} guild = guild for which the NodeApi is validated (must be tracked in database)
 * @param {string} chainId = chainId of chain that is validated
 * @param {string} endpointUrl = url of the api node (http and https possible)
 * @param {boolean} isSSL = if true, it is also validated if TLS is working. Then the NodeApi will only be considered healthy, if all checks pass and if TLS is working
 * @param {unknown} location = location information as in bp.json
 */
export async function validateApi(
  guild: Guild,
  chainId: string,
  endpointUrl: string,
  isSSL: boolean,
  location: unknown
): Promise<NodeApi> {
  if (!endpointUrl) return undefined;

  // Counts how many requests have failed. If performance mode is enabled, future requests may not be performed, if to many requests already failed
  let failedRequestCounter = 0;

  // Create api object for database
  const database = getConnection(chainId);
  const api: NodeApi = new NodeApi();
  api.instance_id = config.get("general.instance_id")
  api.guild = guild.name;
  api.endpoint_url = endpointUrl;
  api.is_ssl = isSSL;


  if (getChainsConfigItem(chainId, "nodeApi_location")) {
    api.location_ok = calculateValidationLevel(validateBpLocation(location), chainId, "nodeApi_location_level");
    api.location_longitude = extractLongitude(location);
    api.location_latitude = extractLatitude(location);
  }

  // Check if valid EndpointUrl has been provided
  if (getChainsConfigItem(chainId, "nodeApi_endpoint_url_ok")) {
    const endpointUrlOk = isURL(endpointUrl, {
      require_protocol: true,
    });

    api.endpoint_url_ok = calculateValidationLevel(endpointUrlOk, chainId, "nodeApi_endpoint_url_ok_level");
  }

  /**
   * 1. Test: Basic Checks
   */
  if (getChainsConfigItem(chainId, "nodeApi_get_info")) {
    await http
      .request(endpointUrl, "nodeApi_get_info", chainId, failedRequestCounter)
      .then((response) => {

        /**
         * SSL Check
         */
        if (isSSL && getChainsConfigItem(chainId, "nodeApi_ssl")) {
          http.evaluateSSL(endpointUrl, response.ok, response.errorType).then((response) => {
            api.ssl_ok = calculateValidationLevel(response.ok, chainId, "nodeApi_ssl_level");
            api.ssl_errortype = response.errorType;
            if (api.ssl_ok !== ValidationLevel.SUCCESS) failedRequestCounter++;
          });
        }

          const getInfoOk = response.ok && response.isJson();
        api.get_info_ok = calculateValidationLevel(getInfoOk, chainId, "nodeApi_get_info_level");
        api.get_info_ms = response.elapsedTimeInMilliseconds;
        api.get_info_errortype = response.errorType;
        api.get_info_httpcode = response.httpCode;

        if (api.get_info_ok !== ValidationLevel.SUCCESS) {
          failedRequestCounter++;
          return;
        }

        /**
         * Test 1.1: Server Version
         */
        if (getChainsConfigItem(chainId, "nodeApi_server_version")) {
          const serverVersion = response.getDataItem(["server_version_string"])
            ? response.getDataItem(["server_version_string"])
            : "";
          // todo: test code
          const serverVersionOk =
            serverVersionsConfig[chainId][serverVersion] !== undefined &&
            serverVersionsConfig[chainId][serverVersion]["valid"];
          api.server_version_ok = calculateValidationLevel(serverVersionOk, chainId, "nodeApi_server_version_level");
          api.server_version = serverVersion === "" ? null : serverVersion;
        }

        /**
         * Test 1.2: NodeApi for correct chain
         */
        if (getChainsConfigItem(chainId, "nodeApi_correct_chain")) {
          const correctChain: boolean =
            typeof response.getDataItem(["chain_id"]) === "string" && response.getDataItem(["chain_id"]) === chainId;
          api.correct_chain = calculateValidationLevel(correctChain, chainId, "nodeApi_correct_chain_level");
        }

        /**
         * Test 1.3: Head Block up to date
         */
        if (getChainsConfigItem(chainId, "nodeApi_head_block_delta")) {
          if (typeof response.getDataItem(["head_block_time"]) === "string") {
            // Get current time
            let currentDate: number = Date.now();

            // Use time of http request if available in order to avoid server or validation time delay
            if (typeof response.headers.get("date") === "number") {
              currentDate = new Date(response.headers.get("date")).getTime();
            }

            // "+00:00" is necessary for defining date as UTC
            const timeDelta: number =
              currentDate - new Date(response.getDataItem(["head_block_time"]) + "+00:00").getTime();

            // Check if headBlock is within the allowed delta
            const headBlockDeltaOk = Math.abs(timeDelta) < config.get("validation.api_head_block_time_delta");
            api.head_block_delta_ok = calculateValidationLevel(
              headBlockDeltaOk,
              chainId,
              "nodeApi_head_block_delta_level"
            );
            api.head_block_delta_ms = timeDelta;

          } else {
            api.head_block_delta_ok = calculateValidationLevel(false, chainId, "nodeApi_head_block_delta_level");
          }
        }
      });
  }
  /**
   * Test 2: Block one exists
   */
  if (getChainsConfigItem(chainId, "nodeApi_block_one")) {
    await http
      .request(endpointUrl, "nodeApi_block_one", chainId, failedRequestCounter)
      .then((response) => {
        const blockOneOk = response.ok && response.isJson();
        api.block_one_ok = calculateValidationLevel(blockOneOk, chainId, "nodeApi_block_one_level");
        api.block_one_ms = response.elapsedTimeInMilliseconds;
        api.block_one_errortype = response.errorType;
        api.block_one_httpcode = response.httpCode;

        if (api.block_one_ok !== ValidationLevel.SUCCESS) failedRequestCounter++;
      });
  }

  /**
   * Test 3: Verbose Error
   */
  if (getChainsConfigItem(chainId, "nodeApi_verbose_error")) {
    await http.request(endpointUrl, "nodeApi_verbose_error", chainId, 999).then((response) => {
      api.verbose_error_ms = response.elapsedTimeInMilliseconds;
      // todo: ensure no check on undefined
      const verboseErrorOk =
        !response.ok && response.isJson() && response.getDataItem(["error", "details"]) && Object.keys(response.getDataItem(["error", "details"])).length != 0;
      api.verbose_error_ok = calculateValidationLevel(verboseErrorOk, chainId, "nodeApi_verbose_error_level");
      api.verbose_error_errortype = response.errorType;
      api.verbose_error_httpcode = response.httpCode;

      if (api.verbose_error_ok !== ValidationLevel.SUCCESS) failedRequestCounter++;
    });
  }

  /**
   * Test 4: abi serializer
   */
  if (getChainsConfigItem(chainId, "nodeApi_abi_serializer")) {
    let expectedBlockCount = -1;
    try {
      expectedBlockCount = Number.parseInt(getChainsConfigItem(chainId, "$nodeApi_expected_block_count"));
    } catch (e) {
      logger.fatal(
        "Error during parsing $nodeApi_expected_block_count from config/chains.csv. This will result in wrong validation results."
      );
    }
    await http
      .request(endpointUrl, "nodeApi_abi_serializer", chainId, failedRequestCounter)
      .then((response) => {
        api.abi_serializer_ms = response.elapsedTimeInMilliseconds;
        const abiSerializerOk =
          response.ok &&
          response.getDataItem(["transactions"]) &&
          Object.keys(response.getDataItem(["transactions"])).length === expectedBlockCount;
        api.abi_serializer_ok = calculateValidationLevel(abiSerializerOk, chainId, "nodeApi_abi_serializer_level");
        api.abi_serializer_errortype = response.errorType;
        api.abi_serializer_httpcode = response.httpCode;

        if (api.abi_serializer_ok !== ValidationLevel.SUCCESS) failedRequestCounter++;
      });
  }

  /**
   * Test 5: basic symbol
   */
  if (getChainsConfigItem(chainId, "nodeApi_basic_symbol")) {
    await http
      .request(endpointUrl, "nodeApi_basic_symbol", chainId, failedRequestCounter)
      .then((response) => {
        const basicSymbolOk = response.ok && Array.isArray(response.dataJson) && response.dataJson.length == 1;
        api.basic_symbol_ok = calculateValidationLevel(basicSymbolOk, chainId, "nodeApi_basic_symbol_level");
        api.basic_symbol_ms = response.elapsedTimeInMilliseconds;
        api.basic_symbol_errortype = response.errorType;
        api.basic_symbol_httpcode = response.httpCode;

        if (api.basic_symbol_ok !== ValidationLevel.SUCCESS) failedRequestCounter++;
      });
  }

  /**
   * Test 6: producer api disabled
   */
  if (getChainsConfigItem(chainId, "nodeApi_producer_api")) {
    await http.request(endpointUrl, "nodeApi_producer_api", chainId, 999).then((response) => {
      // Set status in database
      api.producer_api_ms = response.elapsedTimeInMilliseconds;
      // Test should be successful if a html page is returned, hence !response.isJson()
      const producerApiOff =
        (!response.ok && response.errorType === HttpErrorType.HTTP && response.httpCode > 100) || !response.isJson();
      api.producer_api_off = calculateValidationLevel(producerApiOff, chainId, "nodeApi_producer_api_level");

      api.producer_api_errortype = response.errorType;
      api.producer_api_httpcode = response.httpCode;

      if (api.producer_api_off !== ValidationLevel.SUCCESS) failedRequestCounter++;
    });
  }

  /**
   * Test 7: db_size api disabled
   */
  if (getChainsConfigItem(chainId, "nodeApi_db_size_api")) {
    await http.request(endpointUrl, "nodeApi_db_size_api", chainId, 999).then((response) => {
      // Set status in database
      api.db_size_api_ms = response.elapsedTimeInMilliseconds;
      // Test should be successful if a html page is returned, hence !response.isJson()
      const dbSizeApiOff =
        (!response.ok && response.errorType === HttpErrorType.HTTP && response.httpCode > 100) || !response.isJson();
      api.db_size_api_off = calculateValidationLevel(dbSizeApiOff, chainId, "nodeApi_db_size_api_level");

      api.db_size_api_errortype = response.errorType;
      api.db_size_api_httpcode = response.httpCode;

      if (api.db_size_api_off !== ValidationLevel.SUCCESS) failedRequestCounter++;
    });
  }

  /**
   * Test 8: net api disabled
   */
  if (getChainsConfigItem(chainId, "nodeApi_net_api")) {
    await http.request(endpointUrl, "nodeApi_net_api", chainId, 999).then((response) => {
      // Set status in database
      api.net_api_ms = response.elapsedTimeInMilliseconds;
      // Test should be successful if a html page is returned, hence !response.isJson()
      const netApiOff =
        (!response.ok && response.errorType === HttpErrorType.HTTP && response.httpCode > 100) || !response.isJson();
      api.net_api_off = calculateValidationLevel(netApiOff, chainId, "nodeApi_net_api_level");

      api.net_api_errortype = response.errorType;
      api.net_api_httpcode = response.httpCode;

      if (api.net_api_off !== ValidationLevel.SUCCESS) failedRequestCounter++;
    });
  }

  /**
   * Set all checks ok
   */
  const validations: [string, ValidationLevel][] = [
    ["nodeApi_location", api.location_ok],
    ["nodeApi_endpoint_url_ok", api.endpoint_url_ok],
    ["nodeApi_get_info", api.get_info_ok],
    ["nodeApi_server_version", api.server_version_ok],
    ["nodeApi_correct_chain", api.correct_chain],
    ["nodeApi_head_block_delta", api.head_block_delta_ok],
    ["nodeApi_block_one", api.block_one_ok],
    ["nodeApi_verbose_error", api.verbose_error_ok],
    ["nodeApi_abi_serializer", api.abi_serializer_ok],
    ["nodeApi_basic_symbol", api.basic_symbol_ok],
    ["nodeApi_producer_api", api.producer_api_off],
    ["nodeApi_db_size_api", api.db_size_api_off],
    ["nodeApi_net_api", api.net_api_off],
  ];
  if (isSSL) validations.push(["nodeApi_ssl", api.ssl_ok]);

  api.all_checks_ok = allChecksOK(validations, chainId);

  /**
   * Store results in Database
   */
  try {
    await database.manager.save(api);
    childLogger.debug(
      "SAVED \t New NodeApi validation to database for " +
        guild.name +
        " " +
        getChainsConfigItem(chainId, "name") +
        " to database"
    );
  } catch (error) {
    childLogger.fatal("Error while saving new NodeApi validation to database", error);
  }

  return api;
}

```
## Examples code for testing Hyperion

```ts
import {
  allChecksOK,
  combineValidationLevel,
  calculateValidationLevel,
  logger, validateBpLocation, extractLongitude, extractLatitude
} from "../validationcore-database-scheme/common";
import { Guild } from "../validationcore-database-scheme/entity/Guild";
import * as config from "config";
import { Logger } from "tslog";
import { getConnection } from "typeorm";
import * as http from "../httpConnection/HttpRequest";
import { NodeHyperion } from "../validationcore-database-scheme/entity/NodeHyperion";
import { isURL } from "validator";
import { ValidationLevel } from "../validationcore-database-scheme/enum/ValidationLevel";
import { getChainsConfigItem } from "../validationcore-database-scheme/readConfig";

/**
 * Logger Settings for NodeHyperion
 */
const childLogger: Logger = logger.getChildLogger({
  name: "Hyperion-Validation",
});

/**
 * Performs all validations of the NodeHyperion
 * @param {Guild} guild = guild for which the NodeHyperion is validated (must be tracked in database)
 * @param {string} chainId = chainId of chain that is validated
 * @param {string} endpointUrl = url of the api node (http and https possible)
 * @param {boolean} isSSL = if true, it is also validated if TLS is working. Then the NodeApi will only be considered healthy, if all checks pass and if TLS is working
 * @param {unknown} location = location information as in bp.json
 */
export async function validateHyperion(
  guild: Guild,
  chainId: string,
  endpointUrl: string,
  isSSL: boolean,
  location: unknown
): Promise<NodeHyperion> {
  if (!endpointUrl) return undefined;

  // Counts how many requests have failed. If performance mode is enabled, future requests may not be performed, if to many requests already failed
  let failedRequestCounter = 0;

  // Create hyperion object for database
  const database = getConnection(chainId);
  const hyperion: NodeHyperion = new NodeHyperion();
  hyperion.instance_id = config.get("general.instance_id")
  hyperion.guild = guild.name;
  hyperion.endpoint_url = endpointUrl;
  hyperion.is_ssl = isSSL;


  if (getChainsConfigItem(chainId, "nodeHyperion_location")) {
    hyperion.location_ok = calculateValidationLevel(validateBpLocation(location), chainId, "nodeHyperion_location_level");
    hyperion.location_longitude = extractLongitude(location);
    hyperion.location_latitude = extractLatitude(location);
  }

  // Check if valid EndpointUrl has been provided
  if (getChainsConfigItem(chainId, "nodeHyperion_endpoint_url_ok")) {
    const endpointUrlOk = isURL(endpointUrl, {
      require_protocol: true,
    });
    hyperion.endpoint_url_ok = calculateValidationLevel(endpointUrlOk, chainId, "nodeHyperion_endpoint_url_ok_level");
  }

  /**
   * Test 1 Hyperion Health
   */
  if (getChainsConfigItem(chainId, "nodeHyperion_health")) {
    await http
      .request(endpointUrl, "nodeHyperion_health", chainId, failedRequestCounter)
      .then((response) => {

        /**
         * SSL Check
         */
        if (isSSL && getChainsConfigItem(chainId, "nodeHyperion_ssl")) {
          http.evaluateSSL(endpointUrl, response.ok, response.errorType).then((response) => {
            hyperion.ssl_ok = calculateValidationLevel(response.ok, chainId, "nodeHyperion_ssl_level");
            hyperion.ssl_errortype = response.errorType;
            if (hyperion.ssl_ok !== ValidationLevel.SUCCESS) failedRequestCounter++;
          });
        }

        const healthFound = response.ok && response.isJson();
        hyperion.health_found = calculateValidationLevel(healthFound, chainId, "nodeHyperion_health_level");
        hyperion.health_ms = response.elapsedTimeInMilliseconds;
        hyperion.health_errortype = response.errorType;
        hyperion.health_httpcode = response.httpCode;

        if (hyperion.health_found !== ValidationLevel.SUCCESS) {
          failedRequestCounter++;
          return;
        }

        // Test 1.1 Health version
        // todo: add check
        if (getChainsConfigItem(chainId, "nodeHyperion_health_version")) {
          const healthVersionOk = response.getDataItem(["version"]) !== undefined;
          hyperion.health_version_ok = calculateValidationLevel(
            healthVersionOk,
            chainId,
            "nodeHyperion_health_version_level"
          );
          hyperion.server_version = response.getDataItem(["version"])
        }

        // Test 1.2 Health Host
        // todo: add check
        if (getChainsConfigItem(chainId, "nodeHyperion_health_host")) {
          const healthHostOk = response.getDataItem(["host"]) !== undefined;
          hyperion.health_host_ok = calculateValidationLevel(healthHostOk, chainId, "nodeHyperion_health_host_level");
        }

        // Test 1.3 Query Time
        if (getChainsConfigItem(chainId, "nodeHyperion_health_query_time")) {
          if (typeof response.getDataItem(["query_time_ms"]) === "number") {
            // Set status in database
            hyperion.health_query_time_ms = Math.round(response.getDataItem(["query_time_ms"]));
            const healthQueryTimeOk =
              response.getDataItem(["query_time_ms"]) < config.get("validation.hyperion_query_time_ms");
            hyperion.health_query_time_ok = calculateValidationLevel(
              healthQueryTimeOk,
              chainId,
              "nodeHyperion_health_query_time_level"
            );
          }
        }

        /**
         * Test 1.4 Features
         */
        // todo: test code
        if (getChainsConfigItem(chainId, "nodeHyperion_health_features") && response.getDataItem(["features"])) {
          // tables/proposals
          const healthFeaturesTablesProposals =
            response.getDataItem(["features", "tables", "proposals"]) ===
              getChainsConfigItem(chainId, "nodeHyperion_health_features_tables_proposals") ||
            (response.getDataItem(["features", "tables", "proposals"]) === undefined &&
              !getChainsConfigItem(chainId, "nodeHyperion_health_features_tables_proposals"));
          hyperion.health_features_tables_proposals = calculateValidationLevel(
            healthFeaturesTablesProposals,
            chainId,
            "nodeHyperion_health_features_tables_proposals_level"
          );

          // tables/accounts
          const healthFeaturesTablesAccounts =
            response.getDataItem(["features", "tables", "accounts"]) ===
              getChainsConfigItem(chainId, "nodeHyperion_health_features_tables_accounts") ||
            (response.getDataItem(["features", "tables", "accounts"]) === undefined &&
              !getChainsConfigItem(chainId, "nodeHyperion_health_features_tables_accounts"));
          hyperion.health_features_tables_accounts = calculateValidationLevel(
            healthFeaturesTablesAccounts,
            chainId,
            "nodeHyperion_health_features_tables_accounts_level"
          );

          // tables/voters
          const healthFeaturesTablesVoters =
            response.getDataItem(["features", "tables", "voters"]) ===
              getChainsConfigItem(chainId, "nodeHyperion_health_features_tables_voters") ||
            (response.getDataItem(["features", "tables", "voters"]) === undefined &&
              !getChainsConfigItem(chainId, "nodeHyperion_health_features_tables_voters"));
          hyperion.health_features_tables_voters = calculateValidationLevel(
            healthFeaturesTablesVoters,
            chainId,
            "nodeHyperion_health_features_tables_voters_level"
          );

          // index_deltas
          const healthFeaturesIndexDeltas =
            response.getDataItem(["features", "index_deltas"]) ===
              getChainsConfigItem(chainId, "nodeHyperion_health_features_index_deltas") ||
            (response.getDataItem(["features", "index_deltas"]) === undefined &&
              !getChainsConfigItem(chainId, "nodeHyperion_health_features_index_deltas"));
          hyperion.health_features_index_deltas = calculateValidationLevel(
            healthFeaturesIndexDeltas,
            chainId,
            "nodeHyperion_health_features_index_deltas_level"
          );

          // index_transfer_memo
          const healthFeaturesIndexTransferMemo =
            response.getDataItem(["features", "index_transfer_memo"]) ===
              getChainsConfigItem(chainId, "nodeHyperion_health_features_index_transfer_memo") ||
            (response.getDataItem(["features", "index_transfer_memo"]) === undefined &&
              !getChainsConfigItem(chainId, "nodeHyperion_health_features_index_transfer_memo"));
          hyperion.health_features_index_transfer_memo = calculateValidationLevel(
            healthFeaturesIndexTransferMemo,
            chainId,
            "nodeHyperion_health_features_index_transfer_memo_level"
          );

          // index_all_deltas
          const healthFeaturesIndexAllDeltas =
            response.getDataItem(["features", "index_all_deltas"]) ===
              getChainsConfigItem(chainId, "nodeHyperion_health_features_index_all_deltas") ||
            (response.getDataItem(["features", "index_all_deltas"]) === undefined &&
              !getChainsConfigItem(chainId, "nodeHyperion_health_features_index_all_deltas"));
          hyperion.health_features_index_all_deltas = calculateValidationLevel(
            healthFeaturesIndexAllDeltas,
            chainId,
            "nodeHyperion_health_features_index_all_deltas_level"
          );

          // deferred_trx
          const healthFeaturesDeferredTrx =
            response.getDataItem(["features", "deferred_trx"]) ===
              getChainsConfigItem(chainId, "nodeHyperion_health_features_deferred_trx") ||
            (response.getDataItem(["features", "deferred_trx"]) === undefined &&
              !getChainsConfigItem(chainId, "nodeHyperion_health_features_deferred_trx"));
          hyperion.health_features_deferred_trx = calculateValidationLevel(
            healthFeaturesDeferredTrx,
            chainId,
            "nodeHyperion_health_features_deferred_trx_level"
          );

          // failed_trx
          const healthFeaturesFailedTrx =
            response.getDataItem(["features", "failed_trx"]) ===
              getChainsConfigItem(chainId, "nodeHyperion_health_features_failed_trx") ||
            (response.getDataItem(["features", "failed_trx"]) === undefined &&
              !getChainsConfigItem(chainId, "nodeHyperion_health_features_failed_trx"));
          hyperion.health_features_failed_trx = calculateValidationLevel(
            healthFeaturesFailedTrx,
            chainId,
            "nodeHyperion_health_features_failed_trx_level"
          );

          // resource_limits disabled
          const healthFeaturesResourceLimits =
            response.getDataItem(["features", "resource_limits"]) ===
              getChainsConfigItem(chainId, "nodeHyperion_health_features_resource_limits") ||
            (response.getDataItem(["features", "resource_limits"]) === undefined &&
              !getChainsConfigItem(chainId, "nodeHyperion_health_features_resource_limits"));
          hyperion.health_features_resource_limits = calculateValidationLevel(
            healthFeaturesResourceLimits,
            chainId,
            "nodeHyperion_health_features_resource_limits_level"
          );

          // resource_usage disabled
          const healthFeaturesResourceUsage =
            response.getDataItem(["features", "resource_usage"]) ===
              getChainsConfigItem(chainId, "nodeHyperion_health_features_resource_usage") ||
            (response.getDataItem(["features", "resource_usage"]) === undefined &&
              !getChainsConfigItem(chainId, "nodeHyperion_health_features_resource_usage"));
          hyperion.health_features_resource_usage = calculateValidationLevel(
            healthFeaturesResourceUsage,
            chainId,
            "nodeHyperion_health_features_resource_usage_level"
          );
          hyperion.health_all_features_ok = combineValidationLevel([
            hyperion.health_features_tables_proposals,
            hyperion.health_features_tables_accounts,
            hyperion.health_features_tables_voters,
            hyperion.health_features_index_deltas,
            hyperion.health_features_index_transfer_memo,
            hyperion.health_features_index_all_deltas,
            hyperion.health_features_deferred_trx,
            hyperion.health_features_failed_trx,
            hyperion.health_features_resource_limits,
            hyperion.health_features_resource_usage,
          ]);
        }

        /**
         * Test 1.5 Health of Services
         */
        let nodeosRpc;
        let rabbitmq;
        let elastic;
        if (Array.isArray(response.getDataItem(["health"]))) {
          nodeosRpc = response.getDataItem(["health"]).find((x) => x.service === "NodeosRPC");
          rabbitmq = response.getDataItem(["health"]).find((x) => x.service === "RabbitMq");
          elastic = response.getDataItem(["health"]).find((x) => x.service === "Elasticsearch");
        }

        // NodeosRPC
        let nodeosRpcIncorrectMessage = "";
        if (
          getChainsConfigItem(chainId, "nodeHyperion_health_services_nodeosrpc") &&
          nodeosRpc !== undefined &&
          nodeosRpc.status === "OK" &&
          nodeosRpc.service_data !== undefined &&
          nodeosRpc.service_data.time_offset !== undefined
        ) {
          hyperion.health_nodeosrpc_ok = calculateValidationLevel(
            true,
            chainId,
            "nodeHyperion_health_services_nodeosrpc_level"
          );

          // Check time offset
          if (nodeosRpc.service_data.time_offset < -500 || nodeosRpc.service_data.time_offset > 2000) {
            nodeosRpcIncorrectMessage +=
              "time offset invalid (" + nodeosRpc.service_data.time_offset + ") must be between -500 and 2000";
          }

          // Check chainId
          if (nodeosRpc.service_data.chain_id !== chainId) {
            nodeosRpcIncorrectMessage += (nodeosRpcIncorrectMessage === "" ? "" : ", ") + "wrong chainId";
          }
        }
        hyperion.health_nodeosrpc_message = nodeosRpcIncorrectMessage === "" ? null : nodeosRpcIncorrectMessage;

        // RabbitMq
        if (getChainsConfigItem(chainId, "nodeHyperion_health_services_rabbitmq")) {
          const rabbitmqOk = rabbitmq !== undefined && rabbitmq.status === "OK";
          hyperion.health_rabbitmq_ok = calculateValidationLevel(
            rabbitmqOk,
            chainId,
            "nodeHyperion_health_services_rabbitmq_level"
          );
        }

        // Elastic
        if (getChainsConfigItem(chainId, "nodeHyperion_health_services_elastic")) {
          const elasticOk =
            elastic !== undefined &&
            elastic.status === "OK" &&
            elastic.service_data !== undefined &&
            elastic.service_data.active_shards === "100.0%";
          hyperion.health_elastic_ok = calculateValidationLevel(
            elasticOk,
            chainId,
            "nodeHyperion_health_services_elastic_level"
          );

          // Elastic - Total indexed blocks
          if (
            getChainsConfigItem(chainId, "nodeHyperion_health_total_indexed_blocks") &&
            elastic !== undefined &&
            elastic.service_data !== undefined &&
            typeof elastic.service_data.last_indexed_block === "number" &&
            typeof elastic.service_data.total_indexed_blocks === "number"
          ) {
            const missingBlocks = elastic.service_data.last_indexed_block - elastic.service_data.total_indexed_blocks;
            hyperion.health_missing_blocks = missingBlocks;
            const totalIndexedBlocksOk = missingBlocks <= config.get("validation.hyperion_tolerated_missing_blocks");
            hyperion.health_total_indexed_blocks_ok = calculateValidationLevel(
              totalIndexedBlocksOk,
              chainId,
              "nodeHyperion_health_total_indexed_blocks_level"
            );

          }
        }
      });
  }

  /**
   * Test 2 get_transaction
   */
  if (getChainsConfigItem(chainId, "nodeHyperion_get_transaction")) {
    await http
      .request(endpointUrl, "nodeHyperion_get_transaction", chainId, failedRequestCounter)
      .then((response) => {
        hyperion.get_transaction_ok = calculateValidationLevel(
          response.ok,
          chainId,
          "nodeHyperion_get_transaction_level"
        );
        hyperion.get_transaction_ms = response.elapsedTimeInMilliseconds;
        hyperion.get_transaction_errortype = response.errorType;
        hyperion.get_transaction_httpcode = response.httpCode;

        if (hyperion.get_transaction_ok !== ValidationLevel.SUCCESS) failedRequestCounter++;
      });
  }

  /**
   * Test 3 get_actions
   */
  if (getChainsConfigItem(chainId, "nodeHyperion_get_actions")) {
    await http
      .request(endpointUrl, "nodeHyperion_get_actions", chainId, failedRequestCounter)
      .then((response) => {
        hyperion.get_actions_ms = response.elapsedTimeInMilliseconds;
        hyperion.get_actions_errortype = response.errorType;
        hyperion.get_actions_httpcode = response.httpCode;

        // block_time missing in last action
        if (
          response.ok &&
          Array.isArray(response.getDataItem(["actions"])) &&
          response.getDataItem(["actions"]).length == 1 &&
          response.getDataItem(["actions"])[0]["@timestamp"]
        ) {
          let currentDate: number = Date.now();

          // Use time of http request if available in order to avoid server or validation time delay
          if (response.headers.get("date")) {
            currentDate = new Date(response.headers.get("date")).getTime();
          }
          // "+00:00" is necessary for defining date as UTC
          const timeDelta: number =
            currentDate - new Date(response.getDataItem(["actions"])[0]["@timestamp"] + "+00:00").getTime();

          // Hyperion up-to-date
          if (Math.abs(timeDelta) < 300000) {
            hyperion.get_actions_ok = calculateValidationLevel(true, chainId, "nodeHyperion_get_actions_level");
          }
        } else {
          hyperion.get_actions_ok = calculateValidationLevel(false, chainId, "nodeHyperion_get_actions_level");
        }
        if (hyperion.get_actions_ok !== ValidationLevel.SUCCESS) failedRequestCounter++;
      });
  }

  /**
   * Test 4 get_key_accounts
   */
  if (getChainsConfigItem(chainId, "nodeHyperion_get_key_accounts")) {
    await http
      .request(
        endpointUrl,
        "nodeHyperion_get_key_accounts",
        chainId,
        failedRequestCounter
      )
      .then((response) => {
        hyperion.get_key_accounts_ms = response.elapsedTimeInMilliseconds;
        const getKeyAccountsOk =
          response.ok && response.isJson() && response.getDataItem(["account_names"]) !== undefined;
        hyperion.get_key_accounts_ok = calculateValidationLevel(
          getKeyAccountsOk,
          chainId,
          "nodeHyperion_get_key_accounts_level"
        );
        hyperion.get_key_accounts_errortype = response.errorType;
        hyperion.get_key_accounts_httpcode = response.httpCode;

        if (hyperion.get_key_accounts_ok !== ValidationLevel.SUCCESS) failedRequestCounter++;
      });
  }

  /**
   * Test 5 get_created_accounts
   */
  if (getChainsConfigItem(chainId, "nodeHyperion_get_created_accounts")) {
    await http
      .request(
        endpointUrl,
        "nodeHyperion_get_created_accounts",
        chainId,
        failedRequestCounter
      )
      .then((response) => {
        let getCreatedAccountsOk =
          response.ok && response.isJson() &&  Array.isArray(response.getDataItem(["accounts"]));

        if (getCreatedAccountsOk) {
          const arrayFromConfig = getChainsConfigItem(chainId, "$nodeHyperion_created_accounts").split(",");
          getCreatedAccountsOk = getCreatedAccountsOk && response.getDataItem(["accounts"]).length === arrayFromConfig.length;

          response.getDataItem(["accounts"]).forEach(x => {
            getCreatedAccountsOk = getCreatedAccountsOk && x && x.name && arrayFromConfig.includes(x.name);
          })
        }

        hyperion.get_created_accounts_ok = calculateValidationLevel(
          getCreatedAccountsOk,
          chainId,
          "nodeHyperion_get_created_accounts_level"
        );

        hyperion.get_created_accounts_ms = response.elapsedTimeInMilliseconds;
        hyperion.get_created_accounts_errortype = response.errorType;
        hyperion.get_created_accounts_httpcode = response.httpCode;

        if (hyperion.get_created_accounts_ok !== ValidationLevel.SUCCESS) failedRequestCounter++;
      });
  }

  /**
   * NodeHyperion Health
   */
  const validations: [string, ValidationLevel][] = [
    ["nodeHyperion_location", hyperion.location_ok],
    ["nodeHyperion_endpoint_url_ok", hyperion.endpoint_url_ok],
    ["nodeHyperion_health", hyperion.health_found],
    ["nodeHyperion_health_version", hyperion.health_version_ok],
    ["nodeHyperion_health_host", hyperion.health_host_ok],
    ["nodeHyperion_health_query_time", hyperion.health_query_time_ok],
    ["nodeHyperion_health_features", hyperion.health_all_features_ok],
    ["nodeHyperion_health_services_nodeosrpc", hyperion.health_nodeosrpc_ok],
    ["nodeHyperion_health_services_rabbitmq", hyperion.health_rabbitmq_ok],
    ["nodeHyperion_health_services_elastic", hyperion.health_elastic_ok],
    ["nodeHyperion_health_total_indexed_blocks", hyperion.health_total_indexed_blocks_ok],
    ["nodeHyperion_get_transaction", hyperion.get_transaction_ok],
    ["nodeHyperion_get_actions", hyperion.get_actions_ok],
    ["nodeHyperion_get_key_accounts", hyperion.get_key_accounts_ok],
    ["nodeHyperion_get_created_accounts", hyperion.get_created_accounts_ok],
  ];

  if (isSSL) validations.push(["nodeHyperion_ssl", hyperion.ssl_ok]);
  hyperion.all_checks_ok = allChecksOK(validations, chainId);

  /**
   * Store results in Database
   */
  try {
    await database.manager.save(hyperion);
    childLogger.debug(
      "SAVED \t New NodeHyperion validation to database for " +
        guild.name +
        " " +
        getChainsConfigItem(chainId, "name") +
        " to database"
    );
  } catch (error) {
    childLogger.fatal("Error while saving new NodeHyperion validation to database", error);
  }

  return hyperion;
}
```

## P2P code example for tesing P2P seed nodes
```ts
import { EOSIOStreamDeserializer } from "eosio-protocol";
import { EOSIOStreamTokenizer } from "eosio-protocol";
import { EOSIOStreamConsoleDebugger } from "eosio-protocol";
import { EOSIOP2PClientConnection } from "eosio-protocol";
import { GoAwayMessage, HandshakeMessage, SyncRequestMessage } from "eosio-protocol";
import { sleep } from "eosio-protocol";
import * as config from "config";
import * as stream from "stream";
import fetch = require("node-fetch");
import {
  calculateValidationLevel,
  logger,
  allChecksOK, validateBpLocation, extractLongitude, extractLatitude
} from "../validationcore-database-scheme/common";
import { getConnection } from "typeorm";
import { NodeSeed } from "../validationcore-database-scheme/entity/NodeSeed";
import { Guild } from "../validationcore-database-scheme/entity/Guild";
import { Logger } from "tslog";
import { isURL } from "validator";
import { ValidationLevel } from "../validationcore-database-scheme/enum/ValidationLevel";
import { getChainsConfigItem } from "../validationcore-database-scheme/readConfig";
import { globalNodeSeedQueue } from "../index";

/**
 * This code is based on the original code of "EOSIO Protocol", published by Michael Yeates
 * Only the method validateSeed() was implemented by Blacklusion
 *
 *              https://github.com/michaeljyeates/eosio-protocol
 *
 *                              © Michael Yeates
 */

/**
 * Logger Settings for Validation
 */
const childLogger: Logger = logger.getChildLogger({
  name: "P2P-Validation",
});

const configLoggingLevel = config.get("general.logging_level");
const debug = configLoggingLevel === "silly" || configLoggingLevel === "trace";

// eslint-disable-next-line require-jsdoc
class TestRunner {
  protected lastBlockTime: bigint;
  protected blockCount: number;
  protected node: any;
  protected killedReason: string;
  protected killedDetail: string;
  protected killed: boolean;
  protected latencies: number[];
  protected blockTimeout: number;
  protected p2p: EOSIOP2PClientConnection;
  protected numBlocks: number;

  // eslint-disable-next-line require-jsdoc
  constructor(node: any, numBlocks: number) {
    this.node = node;
    this.lastBlockTime = BigInt(0);
    this.blockCount = 0;
    this.killed = false;
    this.killedReason = "";
    this.killedDetail = "";
    this.latencies = [];
    this.blockTimeout = 10000;
    this.numBlocks = numBlocks;

    const p2p = new EOSIOP2PClientConnection({ ...this.node, ...{ debug } });
    this.p2p = p2p;
  }

  // eslint-disable-next-line require-jsdoc
  run(debug = false) {
    console.log(`Test runner doesnt override run`);
  }

  // eslint-disable-next-line require-jsdoc
  protected async sendHandshake(override) {
    const msg = new HandshakeMessage();
    msg.copy({
      network_version: 1206,
      chain_id: "0000000000000000000000000000000000000000000000000000000000000000", // should be o
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

// eslint-disable-next-line require-jsdoc
class BlockTransmissionTestRunner extends TestRunner {
  // @ts-ignore
  private killTimer: NodeJS.Timeout;

  // eslint-disable-next-line require-jsdoc
  constructor(node: any, numBlocks: number) {
    super(node, numBlocks);
  }

  // eslint-disable-next-line require-jsdoc
  async onSignedBlock(msg): Promise<void> {
    // console.log('TestRunner:on_signed_block');
    clearTimeout(this.killTimer);
    this.killTimer = setTimeout(this.kill.bind(this), this.blockTimeout);

    this.blockCount++;
    // const blockNumHex = msg.previous.substr(0, 8); // first 64 bits
    // const blockNum = parseInt(blockNumHex, 16) + 1;
    // @ts-ignore
    const tm = process.hrtime.bigint();
    if (this.lastBlockTime > 0) {
      const latency = Number(tm - this.lastBlockTime);
      this.latencies.push(latency);
      // console.log(`Received block : ${blockNum} signed by ${msg.producer} with latency ${latency} - ${this.block_count} received from ${this.node.host}`);
    }
    this.lastBlockTime = tm;
  }

  // eslint-disable-next-line require-jsdoc
  async onError(e): Promise<void> {
    this.killed = true;
    this.killedReason = e.code;
    this.killedDetail = (e + "").replace("Error: ", "");
  }

  // eslint-disable-next-line require-jsdoc
  logResults(results): void {
    console.log("Results of SeedNode" + JSON.stringify(results));
  }

  // eslint-disable-next-line require-jsdoc
  async run(debug = false): Promise<any> {
    this.killTimer = setTimeout(this.kill.bind(this), this.blockTimeout);

    const numBlocks = this.numBlocks;

    const p2p = this.p2p;

    p2p.on("net_error", (e) => {
      this.killed = true;
      this.killedReason = "net_error";
      this.killedDetail = e.message;
    });

    try {
      const client: stream.Stream = await p2p.connect();

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
            // @ts-ignore
            this.killedDetail = `Received go away message ${GoAwayMessage.reasons[obj[2].reason]}`;
          }
        });

      if (debug) {
        deserializedStream.pipe(new EOSIOStreamConsoleDebugger({ prefix: "<<<" }));
      }

      const res = await fetch(`${this.node.api}/v1/chain/get_info`);
      const info = await res.json();

      const prevInfo = await this.getPrevInfo(info, numBlocks);
      // const prevInfo = info;

      const override = {
        chain_id: info.chain_id,
        p2p_address: "validationcore.blacklusion.io:9876 - a6f45b4",
        last_irreversible_block_num: prevInfo.last_irreversible_block_num,
        last_irreversible_block_id: prevInfo.last_irreversible_block_id,
        head_num: prevInfo.head_block_num,
        head_id: prevInfo.head_block_id,
      };
      await this.sendHandshake(override);

      // get num blocks before lib
      const msg = new SyncRequestMessage();
      msg.start_block = prevInfo.last_irreversible_block_num;
      msg.end_block = prevInfo.last_irreversible_block_num + numBlocks;
      await p2p.send_message(msg);
    } catch (e) {}

    const results = await this.waitForTests(numBlocks);
    p2p.disconnect();

    return results;
  }

  // eslint-disable-next-line require-jsdoc
  async getBlockId(blockNumOrId: number | string): Promise<string> {
    const res = await fetch(`${this.node.api}/v1/chain/get_block`, {
      method: "POST",
      body: JSON.stringify({ block_num_or_id: blockNumOrId }),
    });
    const info = await res.json();

    return info.id;
  }

  // eslint-disable-next-line require-jsdoc
  async getPrevInfo(info: any, num = 1000) {
    if (num > 0) {
      info.head_block_num -= num;
      info.last_irreversible_block_num -= num;
      info.head_block_id = await this.getBlockId(info.head_block_num);
      info.last_irreversible_block_id = await this.getBlockId(info.last_irreversible_block_num);
    }

    return info;
  }

  // eslint-disable-next-line require-jsdoc
  async getResultJson(): Promise<Object> {
    const raw = {
      status: "success",
      block_count: this.blockCount,
      latencies: this.latencies,
      error_code: this.killedReason,
      error_detail: this.killedDetail,
    };

    raw.status = !this.killedReason ? "success" : "error";

    // let avg = 0;
    let sum = 0;
    // let sumB = BigInt(0);
    if (raw.latencies.length > 0) {
      sum = raw.latencies.reduce((previous, current) => (current += previous));
      // sumB = BigInt(sumB);
      // avg = sum / raw.latencies.length;
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

  // eslint-disable-next-line require-jsdoc
  async waitForTests(num) {
    return new Promise(async (resolve, reject) => {
      // eslint-disable-next-line no-constant-condition
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

  // eslint-disable-next-line require-jsdoc
  kill(): void {
    this.killed = true;
    this.killedReason = "timeout";
    this.killedDetail = "Timed out while receiving blocks";
  }
}

/**
 *
 * @param {Guild} guild = guild for which the Seed is validated (must be tracked in database)
 * @param {string} chainId = chainId of chain that is validated
 * @param {string} endpointUrl = url of the p2p endpoint
 * @param {unknown} location = location information as in bp.json
 */
export async function validateSeed(
  guild: Guild,
  chainId: string,
  endpointUrl: string,
  location: unknown
): Promise<NodeSeed> {
  if (!endpointUrl) return undefined;

  // Set general variables
  const api: string = getChainsConfigItem(chainId, "api_endpoint");

  // Create seed object for database
  const database = getConnection(chainId);
  const seed: NodeSeed = new NodeSeed();
  seed.instance_id = config.get("general.instance_id")
  seed.guild = guild.name;
  seed.endpoint_url = endpointUrl;

  if (getChainsConfigItem(chainId, "nodeSeed_location")) {
    seed.location_ok = calculateValidationLevel(validateBpLocation(location), chainId, "nodeSeed_location_level");
    seed.location_longitude = extractLongitude(location);
    seed.location_latitude = extractLatitude(location);
  }
  /**
   * Test 1: Check url
   */
  const endpointUrlOk = isURL(endpointUrl, {
    protocols: [],
    require_protocol: false,
    require_port: true,
  });
  seed.endpoint_url_ok = calculateValidationLevel(endpointUrlOk, chainId, "nodeSeed_endpoint_url_ok_level");

  if (!seed.endpoint_url_ok) return seed;

  /**
   * 2. Create Seed Connection
   */
  try {
    const node = {
      api: api,
      host: endpointUrl.substring(0, endpointUrl.indexOf(":")),
      port: endpointUrl.substring(endpointUrl.indexOf(":") + 1, endpointUrl.length),
    };
    const runner: BlockTransmissionTestRunner = new BlockTransmissionTestRunner(
      node,
      config.get("validation.seed_block_count")
    );
    await globalNodeSeedQueue.add(() => runner
      .run(debug)
      .then((result) => {
        /**
         * Test 2.1: p2p Connection successful
         */
        if (result.status == "success") {
          seed.p2p_connection_possible = calculateValidationLevel(
            true,
            chainId,
            "nodeSeed_p2p_connection_possible_level"
          );

          /**
           * Test 2.2: block transmission speed ok
           */
          if (getChainsConfigItem(chainId, "nodeSeed_block_transmission_speed_ok")) {
            if (result.speed && result.speed > config.get("validation.seed_ok_speed")) {
              seed.block_transmission_speed_ok = calculateValidationLevel(
                true,
                chainId,
                "nodeSeed_block_transmission_speed_ok_level"
              );
              seed.block_transmission_speed_ms = Math.round(result.speed);
            } else {
              seed.block_transmission_speed_ok = calculateValidationLevel(
                false,
                chainId,
                "nodeSeed_block_transmission_speed_ok_level"
              );
            }
          }
        } else {
          seed.p2p_connection_possible = calculateValidationLevel(
            false,
            chainId,
            "nodeSeed_p2p_connection_possible_level"
          );
        }

        seed.p2p_connection_possible_message = result.error_detail ? result.error_detail : null;
      })
      .catch((error) => {
        // todo: improve error handling, test with block_count =  "10"
        childLogger.warn("Error during NodeSeed validation", error);
      }))
  } catch (e) {
    childLogger.warn("Error during NodeSeed validation", e);
  }

  /**
   * All checks ok
   */
  const validations: [string, ValidationLevel][] = [
    ["nodeSeed_location", seed.location_ok],
    ["nodeSeed_endpoint_url_ok", seed.endpoint_url_ok],
    ["nodeSeed_p2p_connection_possible", seed.p2p_connection_possible],
    ["nodeSeed_block_transmission_speed_ok", seed.block_transmission_speed_ok],
  ];
  seed.all_checks_ok = allChecksOK(validations, chainId);

  /**
   * Store results in Database
   */
  try {
    await database.manager.save(seed);
    childLogger.debug(
      "SAVED \t New Seed validation to database for " +
        guild.name +
        " " +
        getChainsConfigItem(chainId, "name") +
        " to database"
    );
  } catch (error) {
    childLogger.fatal("Error while saving new Seed validation to database", error);
  }

  return seed;
}
```

## Example of atomic check code:

```ts
import * as config from "config";
import {
  allChecksOK,
  calculateValidationLevel, extractLatitude, extractLongitude,
  logger, validateBpLocation
} from "../validationcore-database-scheme/common";
import { Guild } from "../validationcore-database-scheme/entity/Guild";
import { getConnection } from "typeorm";
import { Logger } from "tslog";
import * as http from "../httpConnection/HttpRequest";
import { NodeAtomic } from "../validationcore-database-scheme/entity/NodeAtomic";
import { isURL } from "validator";
import { ValidationLevel } from "../validationcore-database-scheme/enum/ValidationLevel";
import { getChainsConfigItem } from "../validationcore-database-scheme/readConfig";

/**
 * Logger Settings for NodeAtomic NodeApi
 */
const childLogger: Logger = logger.getChildLogger({
  name: "AA-Validation",
  displayFilePath: "hidden",
  displayLoggerName: true,
});

/**
 * Performs all validations for an NodeAtomic NodeApi-Node
 * @param {Guild} guild = guild for which the NodeAtomic NodeApi is validated (must be tracked in database)
 * @param {string} chainId = chainId of chain that is validated
 * @param {string} endpointUrl = url of the api node (http and https possible)
 * @param {boolean} isSSL = if true, it is also validated if TLS is working. Then the NodeApi will only be considered healthy, if all checks pass and if TLS is working
 * @param {unknown} location = location information as in bp.json
 */
export async function validateAtomic(
  guild: Guild,
  chainId: string,
  endpointUrl: string,
  isSSL: boolean,
  location: unknown
): Promise<NodeAtomic> {
  if (!endpointUrl) return undefined;

  // Counts how many requests have failed. If performance mode is enabled, future requests may not be performed, if to many requests already failed
  let failedRequestCounter = 0;

  // Create atomic object for database
  const database = getConnection(chainId);
  const atomic: NodeAtomic = new NodeAtomic();
  atomic.instance_id = config.get("general.instance_id")
  atomic.guild = guild.name;
  atomic.endpoint_url = endpointUrl;
  atomic.is_ssl = isSSL;


  if (getChainsConfigItem(chainId, "nodeAtomic_location")) {
    atomic.location_ok = calculateValidationLevel(validateBpLocation(location), chainId, "nodeAtomic_location_level");
    atomic.location_longitude = extractLongitude(location);
    atomic.location_latitude = extractLatitude(location);
  }

  // Check if valid EndpointUrl has been provided
  if (getChainsConfigItem(chainId, "nodeAtomic_endpoint_url_ok")) {
    const endpointUrlOk = isURL(endpointUrl, {
      require_protocol: true,
    });
    atomic.endpoint_url_ok = calculateValidationLevel(endpointUrlOk, chainId, "nodeAtomic_endpoint_url_ok_level");
  }


  /**
   * Test 1 Health Checks
   */
  if (getChainsConfigItem(chainId, "nodeAtomic_health")) {
    await http
      .request(endpointUrl, "nodeAtomic_health", chainId, failedRequestCounter)
      .then((response) => {

        /**
         * SSL Check
         */
        if (isSSL && getChainsConfigItem(chainId, "nodeAtomic_ssl")) {
          http.evaluateSSL(endpointUrl, response.ok, response.errorType).then((response) => {
            atomic.ssl_ok = calculateValidationLevel(response.ok, chainId, "nodeAtomic_ssl_level");
            atomic.ssl_errortype = response.errorType;
            if (atomic.ssl_ok !== ValidationLevel.SUCCESS) failedRequestCounter++;
          });
        }

        const healthFound = response.ok && response.isJson();
        atomic.health_ms = response.elapsedTimeInMilliseconds;
        atomic.health_found = calculateValidationLevel(healthFound, chainId, "nodeAtomic_health_level");
        atomic.health_errortype = response.errorType;
        atomic.health_httpcode = response.httpCode;

        if (atomic.health_found !== ValidationLevel.SUCCESS) {
          failedRequestCounter++;
          return;
        }

        /**
         * Test 1.1 Access Control Allow Header Checks
         */
        if (getChainsConfigItem(chainId, "nodeAtomic_health_access_control_header")) {
          const atomicAccessControlHeaderOk =
            response.headers !== undefined &&
            response.headers.has("access-control-allow-headers");

          atomic.health_access_control_header_ok = calculateValidationLevel(
            atomicAccessControlHeaderOk,
            chainId,
            "nodeAtomic_health_access_control_header_level"
          );
        }

        // Test 1.2 Health version
      atomic.server_version = response.getDataItem(["data", "version"]);

        /**
         * Test 1.3 Status of Services
         */
        // Status of Postgres Service
        if (getChainsConfigItem(chainId, "nodeAtomic_health_postgres")) {
          const healthPostgresOk = response.getDataItem(["data", "postgres", "status"]) === "OK";
          atomic.health_postgres_ok = calculateValidationLevel(
            healthPostgresOk,
            chainId,
            "nodeAtomic_health_postgres_level"
          );
        }

        // Status of Redis Service
        if (getChainsConfigItem(chainId, "nodeAtomic_health_redis")) {
          const healthRedisOk = response.getDataItem(["data", "redis", "status"]) === "OK";
          atomic.health_redis_ok = calculateValidationLevel(healthRedisOk, chainId, "nodeAtomic_health_redis_level");
        }

        // Status of Chain Service
        if (getChainsConfigItem(chainId, "nodeAtomic_health_chain")) {
          const healthChainOk = response.getDataItem(["data", "chain", "status"]) === "OK";
          atomic.health_chain_ok = calculateValidationLevel(healthChainOk, chainId, "nodeAtomic_health_chain_level");
        }

        /**
         * Test 1.4 Check head block of reader
         */
        if (getChainsConfigItem(chainId, "nodeAtomic_health_total_indexed_blocks")) {
          const missingBlocks =
            response.getDataItem(["data", "chain", "head_block"]) -
            Number.parseInt(response.getDataItem(["data", "postgres", "readers", "0", "block_num"]));
          const totalIndexedBlocksOk = missingBlocks <= config.get("validation.atomic_tolerated_missing_blocks");
          atomic.health_total_indexed_blocks_ok = calculateValidationLevel(
            totalIndexedBlocksOk,
            chainId,
            "nodeAtomic_health_total_indexed_blocks_level"
          );
          atomic.health_missing_blocks = missingBlocks;
        }
      });
  }

  /**
   * Test 2 Get Asset by ID
   */
  if (getChainsConfigItem(chainId, "nodeAtomic_assets")) {
    await http
      .request(endpointUrl, "nodeAtomic_assets", chainId, failedRequestCounter)
      .then((response) => {
        atomic.assets_ok = calculateValidationLevel(response.ok, chainId, "nodeAtomic_assets_level");
        atomic.assets_ms = response.elapsedTimeInMilliseconds;
        atomic.assets_errortype = response.errorType;
        atomic.assets_httpcode = response.httpCode;

        if (atomic.assets_ok !== ValidationLevel.SUCCESS) failedRequestCounter++;
      });
  }

  /**
   * Test 3 Get Collection by name
   */
  if (getChainsConfigItem(chainId, "nodeAtomic_collections")) {
    await http
      .request(endpointUrl, "nodeAtomic_collections", chainId, failedRequestCounter)
      .then((response) => {
        atomic.collections_ok = calculateValidationLevel(response.ok, chainId, "nodeAtomic_collections_level");
        atomic.collections_ms = response.elapsedTimeInMilliseconds;
        atomic.collections_errortype = response.errorType;
        atomic.collections_httpcode = response.httpCode;

        if (atomic.collections_ok !== ValidationLevel.SUCCESS) failedRequestCounter++;
      });
  }

  /**
   * Test 4 Get Schema by name
   */
  if (getChainsConfigItem(chainId, "nodeAtomic_schemas")) {
    await http
      .request(endpointUrl, "nodeAtomic_schemas", chainId, failedRequestCounter)
      .then((response) => {
        atomic.schemas_ok = calculateValidationLevel(response.ok, chainId, "nodeAtomic_schemas_level");
        atomic.schemas_ms = response.elapsedTimeInMilliseconds;
        atomic.schemas_errortype = response.errorType;
        atomic.schemas_httpcode = response.httpCode;

        if (atomic.schemas_ok !== ValidationLevel.SUCCESS) failedRequestCounter++;
      });
  }

  /**
   * Test 5 Get Template by name
   */
  if (getChainsConfigItem(chainId, "nodeAtomic_templates")) {
    await http
      .request(endpointUrl, "nodeAtomic_templates", chainId, failedRequestCounter)
      .then((response) => {
        atomic.templates_ok = calculateValidationLevel(response.ok, chainId, "nodeAtomic_templates_level");
        atomic.templates_ms = response.elapsedTimeInMilliseconds;
        atomic.templates_errortype = response.errorType;
        atomic.templates_httpcode = response.httpCode;

        if (atomic.templates_ok !== ValidationLevel.SUCCESS) failedRequestCounter++;
      });
  }

  /**
   * Set all checks ok
   */
  const validations: [string, ValidationLevel][] = [
    ["nodeAtomic_location", atomic.location_ok],
    ["nodeAtomic_endpoint_url_ok", atomic.endpoint_url_ok],
    ["nodeAtomic_health", atomic.health_found],
    ["nodeAtomic_health_access_control_header", atomic.health_access_control_header_ok],
    ["nodeAtomic_health_postgres", atomic.health_postgres_ok],
    ["nodeAtomic_health_redis", atomic.health_redis_ok],
    ["nodeAtomic_health_chain", atomic.health_chain_ok],
    ["nodeAtomic_health_total_indexed_blocks", atomic.health_total_indexed_blocks_ok],
    ["nodeAtomic_assets", atomic.assets_ok],
    ["nodeAtomic_collections", atomic.collections_ok],
    ["nodeAtomic_schemas", atomic.schemas_ok],
    ["nodeAtomic_templates", atomic.templates_ok],
  ];

  if (isSSL) validations.push(["nodeAtomic_ssl", atomic.ssl_ok]);

  atomic.all_checks_ok = allChecksOK(validations, chainId);
  /**
   * Store results in Database
   */
  try {
    await database.manager.save(atomic);
    childLogger.debug(
      "SAVED \t New NodeAtomic validation to database for " +
        guild.name +
        " " +
        getChainsConfigItem(chainId, "name") +
        " to database"
    );
  } catch (error) {
    childLogger.fatal("Error while saving new NodeAtomic validation to database", error);
  }

  return atomic;
}
```


## Delphioracle (price feed) code:

```python
import utils.requests as requests
import utils.eosio as eosio
import utils.core as core
import services.Messages as messages

def delphioracle_actors():
    print(core.bcolors.OKYELLOW,f"{'='*100}\nGetting Delphi Oracle Data ",core.bcolors.ENDC)
    chain = "mainnet"
    #Get list of guilds posting to delphioracle looking at actions, save last 100 actions.
    delphi_actions = requests.get_actions_data("delphioracle","100")
    actions = eosio.get_stuff(eosio.HyperionNodeMainnet1,delphi_actions,'action',chain)
    guilds = actions['simple_actions']
    # Create empty list
    producer_final = []
    # Create emtpy dictinary
    proddict = {}
    for i in guilds:
        # create copy of dict and call it new
        new = proddict.copy()
        if len(i['data']['quotes']) < 3:
            continue
        else:
            producer_final.append(i['data']['owner'])
            producer_final = list(dict.fromkeys(producer_final))
    # Returns list of guilds with duplicates removed   
    return producer_final



# Returns tuple list with producers in delphioracle True or False
def delphiresults(producer,oracledata):
     producersoracle = oracledata
     if producer in producersoracle:
        return True, messages.CHECK_ORACLE_FEED(True)
     else:
        return False, messages.CHECK_ORACLE_FEED(False)
```


Example of TLS check

```python
def check_tls(domain_name,port):
    socket.setdefaulttimeout(5)
    tls = ""
    tlsver = [ssl.TLSVersion.SSLv3,ssl.TLSVersion.TLSv1,ssl.TLSVersion.TLSv1_1,ssl.TLSVersion.TLSv1_2,ssl.TLSVersion.TLSv1_3,ssl.TLSVersion.TLSv1_3]
    i = 0
    HOST = urlparse(domain_name).hostname
    PORT = int(port)
    while not tls and i != 5:
           try: 
                ctx = ssl.create_default_context()
                ctx.set_alpn_protocols(['h2', 'spdy/3', 'http/1.1'])
                conn = ctx.wrap_socket(
                    socket.socket(socket.AF_INET, socket.SOCK_STREAM), server_hostname=HOST)
                try:
                    ctx.maximum_version = tlsver[i]
                except ValueError as e:
                    if str(e) == "Unsupported protocol version 0x300":
                        print("Error: SSLv3 is not supported in this version of openssl")
                    else:
                        raise e
                i += 1
                conn.connect((HOST,PORT))
                tls = conn.version()
                return tls, 'ok'
           except (OSError, ValueError):
                print(ctx.maximum_version," Not available")
           except ssl.SSLError as sslErr:
                conn.shutdown(socket.SHUT_RDWR)
                conn.close()
    return False, f'tls_downgrade i does not equal 5'
```
