## SpecStory

## Debugging JSON Node Saving Issues (14/01/2025, 18:12:26)

_**User**_

First read all of the codebase.

In @blockchainService.js the parseProducerServices function trawls through the JSON files of guilds and save all nodes.

Here is an example of a JSON file whic is having issues.

{
  "producer_account_name": "liquidstudio",
  "org": {
    "candidate_name": "LiquidStudios",
    "website": "https://liquiid.io",
    "code_of_conduct": "https://liquiid.io/code-of-conduct",
    "ownership_disclosure": "https://liquiid.io/ownership-disclosure",
    "email": "info@liquiid.io",
    "github_user": [
      "cmadh",
      "kthamm"
    ],
    "branding": {
      "logo_256": "",
      "logo_1024": "",
      "logo_svg": ""
    },
    "location": {
      "name": "Germany",
      "country": "DE",
      "latitude": 52,
      "longitude": 10
    },
    "social": {
      "steemit": "",
      "twitter": "beliquiid",
      "youtube": "",
      "facebook": "",
      "github": "liquiidio",
      "keybase": "cmadh",
      "reddit": "liquidstudios",
      "telegram": "liquidstudios",
      "wechat": ""
    }
  },
  "nodes": [
    {
      "location": {
        "name": "Germany",
        "country": "DE",
        "latitude": 52.37052,
        "longitude": 9.73322
      },
      "node_type": "producer"
    },
    {
      "location": {
        "name": "Germany",
        "country": "DE",
        "latitude": 50.110924,
        "longitude": 8.682127
      },
      "node_type": "seed",
      "p2p_endpoint": "p2p.wax.liquidstudios.io:9876"
    },
    {
      "location": {
        "name": "Germany",
        "country": "DE",
        "latitude": 50.110924,
        "longitude": 8.682127
      },
      "node_type": "query",
      "api_endpoint": "http://api.wax.liquidstudios.io",
      "ssl_endpoint": "https://api.wax.liquidstudios.io",
      "features": [
        "chain-api",
        "account-query",
        "history-v1"
      ]
    },
    {
      "location": {
        "name": "Germany",
        "country": "DE",
        "latitude": 50.110924,
        "longitude": 8.682127
      },
      "node_type": "query",
      "api_endpoint": "http://api.wax.liquidstudios.io",
      "ssl_endpoint": "https://api.wax.liquidstudios.io",
      "features": [
        "hyperion-v2"
      ],
      "full": true
    },
    {
      "location": {
        "name": "Germany",
        "country": "DE",
        "latitude": 50.110924,
        "longitude": 8.682127
      },
      "node_type": "query",
      "api_endpoint": "http://api.wax.liquidstudios.io",
      "ssl_endpoint": "https://api.wax.liquidstudios.io",
      "features": [
        "atomic-assets-api"
      ]
    }
  ]
}

For some reason it is only saving  atomic-assets-api and not histoy-v1 or the hyperion one. I suspect it has somethig to do with the db insert query.

Whici is in @monitoringService.js saveProducerService

---

_**Assistant**_

Looking at the code, I notice that `parseProducerServices` in blockchainService.js is correctly filtering and mapping the nodes, but I don't see the `saveProducerService` function in the files provided. It seems to be imported from './dataService.js' in monitoringService.js.

Could you share the contents of the dataService.js file? That's where the database insert query would be, and that's likely where the issue is occurring.

From what I can see in the example JSON, there are multiple query nodes with different features:
1. One with `["chain-api", "account-query", "history-v1"]`
2. One with `["hyperion-v2"]`
3. One with `["atomic-assets-api"]`

The `parseProducerServices` function looks correct as it's returning all non-producer nodes:

```javascript:src/services/blockchainService.js
const parseProducerServices = (producerJson) => {
  if (!producerJson || !producerJson.nodes) return [];

  return producerJson.nodes
    .filter(node => node.node_type !== 'producer') // Ignores only producer nodes
    .map(node => ({
      node_type: node.node_type,
      api_endpoint: node.api_endpoint,
      ssl_endpoint: node.ssl_endpoint,
      p2p_endpoint: node.p2p_endpoint,
      features: node.features,
      is_full: node.full || false,
      location: node.location,
    }));
};
```

The issue is likely in how these services are being saved to the database. Could you share the dataService.js file so I can help identify and fix the problem?

---



---

