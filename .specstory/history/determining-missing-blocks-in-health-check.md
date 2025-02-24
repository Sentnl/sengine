## SpecStory

## Determining Missing Blocks in Health Check (24/02/2025, 20:37:34)

_**User**_

The output of /v2/health looks like this,.

{"version":"3.5.0-3","version_hash":"1d3196800697560093e93380af92e1c9aef8d419","host":"wax.eosusa.io","health":[{"service":"RabbitMq","status":"OK","time":1740429266926},{"service":"NodeosRPC","status":"OK","service_data":{"head_block_num":357901617,"head_block_time":"2025-02-24T20:34:27.000","time_offset":-75,"last_irreversible_block":357901286,"chain_id":"1064487b3cd1a897ce03ae5b6a865651747e2e152090f99c1d19d44e01aea5a4"},"time":1740429266925},{"service":"Elasticsearch","status":"OK","service_data":{"active_shards":"100.0%","head_offset":2,"first_indexed_block":236123000,"last_indexed_block":357901615,"total_indexed_blocks":121773535,"missing_blocks":5080,"missing_pct":"0.00%"},"time":1740429266926}],"limits":{"get_actions":1000,"get_voters":100,"get_links":1000,"get_deltas":1000,"get_trx_actions":200},"features":{"streaming":{"enable":true,"traces":true,"deltas":true},"tables":{"proposals":true,"accounts":true,"voters":true},"index_deltas":true,"index_transfer_memo":true,"index_all_deltas":true,"deferred_trx":false,"failed_trx":false,"resource_limits":false,"resource_usage":false},"query_time_ms":3.397,"last_indexed_block":357901617,"last_indexed_block_time":"2025-02-24T20:34:27.000"}


How does our code determine missig blocks?

---

_**Assistant**_

Looking at the code, missing blocks are determined from the health response in `hyperionTest.js`. Specifically:

```javascript
const missingBlocks = parseInt(
  healthResponse.health.find(service => service.service === 'Elasticsearch')?.service_data?.missing_blocks || '0',
  10
);
```

It:
1. Finds the Elasticsearch service in the health array
2. Extracts `missing_blocks` from its `service_data`
3. Defaults to '0' if not found
4. Parses it as an integer

The test fails if `missingBlocks !== 0`.

In your example output, there are 5080 missing blocks according to `"missing_blocks":5080` in the Elasticsearch service data.

---

_**User**_

can we add some logging to see what the missing_blocs value is in the json

---

_**Assistant**_

I'll add logging right before we parse the missing blocks value:

```antml:function_calls>
<invoke name="edit_file">
<parameter name="target_file">src/validate/hyperionTest.js</parameter>
<parameter name="instructions">I will add logging to show the missing blocks value from the health response.</parameter>
<parameter name="code_edit">// ... existing code ...
      // Any Missing Blocks
      const elasticService = healthResponse.health.find(service => service.service === 'Elasticsearch');
      console.log('Elasticsearch service data:', elasticService?.service_data);
      const missingBlocks = parseInt(
        elasticService?.service_data?.missing_blocks || '0',
        10
      );
      console.log('Parsed missing blocks:', missingBlocks);
      const missingBlocksResult = await runTest({
// ... existing code ...</parameter>
</invoke>

---

_**User**_

yo did no update the file?

---

_**Assistant**_

Let me try the edit again:

```antml:function_calls>
<invoke name="edit_file">
<parameter name="target_file">src/validate/hyperionTest.js</parameter>
<parameter name="instructions">I will add logging to show the missing blocks value from the health response.</parameter>
<parameter name="code_edit">      // Any Missing Blocks
      const elasticService = healthResponse.health.find(service => service.service === 'Elasticsearch');
      console.log('Elasticsearch service data:', elasticService?.service_data);
      const missingBlocks = parseInt(
        elasticService?.service_data?.missing_blocks || '0',
        10
      );
      console.log('Parsed missing blocks:', missingBlocks);
      const missingBlocksResult = await runTest({
        producerId,
        chain,
        testType: TEST_TYPES.HYPERION.MISSING_BLOCKS,</parameter>
</invoke>

---



---

