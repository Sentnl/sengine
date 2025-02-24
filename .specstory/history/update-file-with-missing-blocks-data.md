## SpecStory

## Update File with Missing Blocks Data (24/02/2025, 20:42:27)

_**User**_

CAh you pudate this file to show the values of missing_blocks found via the json that is putputed ifrom /v2/health

---

_**Assistant**_

I'll modify the code to log the missing blocks information from the health endpoint response. I'll add this in the section where we check for missing blocks.

Let me edit the file:

---

_****_

```diff
  
        // Any Missing Blocks
+       const elasticsearchService = healthResponse.health.find(service => service.service === 'Elasticsearch');
        const missingBlocks = parseInt(
-         healthResponse.health.find(service => service.service === 'Elasticsearch')?.service_data?.missing_blocks || '0',
+         elasticsearchService?.service_data?.missing_blocks || '0',
          10
        );
+ 
+       // Log missing blocks information
+       if (elasticsearchService?.service_data) {
+         Logger.log('Missing Blocks Info:', JSON.stringify(elasticsearchService.service_data, null, 2));
+       }
+ 
        const missingBlocksResult = await runTest({
          producerId,
```

---

_****_



Now when the health check runs, it will log the complete service_data from the Elasticsearch service, which includes missing blocks and other relevant information. This will give you better visibility into the state of each Hyperion node's block data.

The output will show all the service_data fields in a nicely formatted JSON structure, not just the missing_blocks count.

---



---

