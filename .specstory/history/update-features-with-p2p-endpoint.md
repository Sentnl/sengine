## SpecStory

## Update Features with P2P Endpoint (15/01/2025, 11:14:50)

_**User**_

can we updte this so that when node.p2p_endpoint is encountered, can features be upded to contain {p2p}

---

_**Assistant**_

Here’s the update to `parseProducerServices` to include `p2p` in the `features` when `node.p2p_endpoint` is present:

```javascript:src/services/blockchainService.js
const parseProducerServices = (producerJson) => {
  if (!producerJson || !producerJson.nodes) return [];

  return producerJson.nodes
    .filter(node => node.node_type !== 'producer') // Ignore nodes with type 'producer'
    .map(node => ({
      node_type: node.node_type,
      api_endpoint: node.api_endpoint,
      ssl_endpoint: node.ssl_endpoint,
      p2p_endpoint: node.p2p_endpoint,
      features: node.features.concat(node.p2p_endpoint ? ['p2p'] : []),
      is_full: node.full || false,
      location: node.location,
    }));
};
```

This change ensures that if `node.p2p_endpoint` exists, `p2p` is added to the `features` array. If `node.p2p_endpoint` is absent, `features` remains unchanged.

---

_**User**_

Error processing producer amsterdamwax: TypeError: Cannot read properties of undefined (reading 'concat')
    at file:///Users/charlesholtzkampf/sentnl/sengine-backend/src/services/blockchainService.js:104:31
    at Array.map (<anonymous>)
    at parseProducerServices (file:///Users/charlesholtzkampf/sentnl/sengine-backend/src/services/blockchainService.js:99:6)
    at updateProducers (file:///Users/charlesholtzkampf/sentnl/sengine-backend/src/services/monitoringService.js:73:24)
    at process.processTicksAndRejections (node:internal/process/task_queues:95:5)
    at async updateAllProducers (file:///Users/charlesholtzkampf/sentnl/sengine-backend/src/services/monitoringService.js:130:5)
    at async initializeMonitoring (file:///Users/charlesholtzkampf/sentnl/sengine-backend/src/services/monitoringService.js:142:4)
    at async startMonitoring (file:///Users/charlesholtzkampf/sentnl/sengine-backend/src/services/monitoringService.js:173:3)

---

_**Assistant**_

Ah, got it. The error occurs because `node.features` might be undefined. Let's fix that by ensuring `features` is always an array before concatenating:

```javascript:src/services/blockchainService.js
const parseProducerServices = (producerJson) => {
  if (!producerJson || !producerJson.nodes) return [];

  return producerJson.nodes
    .filter(node => node.node_type !== 'producer')
    .map(node => ({
      node_type: node.node_type,
      api_endpoint: node.api_endpoint,
      ssl_endpoint: node.ssl_endpoint,
      p2p_endpoint: node.p2p_endpoint,
      features: (node.features || []).concat(node.p2p_endpoint ? ['p2p'] : []),
      is_full: node.full || false,
      location: node.location,
    }));
};
```

The fix adds `node.features || []` to ensure we're always working with an array, even if `node.features` is undefined. This should resolve the TypeError.

---

_**User**_

why are we getting duplicates?

4717,2757,{seed},"",,waxtest.sentnl.io:9877,{p2p},false,United Kingdom,GB
4715,2756,{seed},"",,waxtest.sentnl.io:9877,{p2p},false,United Kingdom,GB


@db.js @dataService.js 

---

_**Assistant**_

The duplicates are likely due to the `ON CONFLICT` clause in `saveProducerService` not handling the uniqueness correctly. The `UNIQUE` constraint in the `producer_services` table is on `(producer_id, api_endpoint, features, p2p_endpoint)`, but the `ON CONFLICT` clause only checks `(producer_id, api_endpoint, features, p2p_endpoint)` for conflicts. If the values are slightly different (e.g., empty strings vs null), it won't trigger the conflict.

Here’s the fix:

```javascript:src/services/dataService.js
const saveProducerService = async (producerId, service) => {
    const db = getDatabase();
    const query = `
      INSERT INTO producer_services (
        producer_id, node_type, api_endpoint, ssl_endpoint, p2p_endpoint, 
        features, is_full, location_name, location_country, location_latitude, location_longitude
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      ON CONFLICT (producer_id, api_endpoint, p2p_endpoint) 
      DO UPDATE SET
        node_type = EXCLUDED.node_type,
        ssl_endpoint = EXCLUDED.ssl_endpoint,
        features = EXCLUDED.features,
        is_full = EXCLUDED.is_full,
        location_name = EXCLUDED.location_name,
        location_country = EXCLUDED.location_country,
        location_latitude = EXCLUDED.location_latitude,
        location_longitude = EXCLUDED.location_longitude
    `;
    try {
        const nodeType = Array.isArray(service.node_type) 
            ? service.node_type.map(String) 
            : [String(service.node_type)];

        const features = Array.isArray(service.features) 
            ? service.features.map(String) 
            : (service.features ? [String(service.features)] : null);

        await db.query(query, [
            producerId,
            nodeType,
            service.api_endpoint || '',
            service.ssl_endpoint || null,
            service.p2p_endpoint || '',
            features,
            service.is_full || false,
            service.location?.name || null,
            service.location?.country || null,
            service.location?.latitude || null,
            service.location?.longitude || null,
        ]);
        Logger.log('Node add:', 
            JSON.stringify({
                api: service.api_endpoint,
                ssl: service.ssl_endpoint,
                p2p: service.p2p_endpoint
            }, null, 2));
    } catch (error) {
        console.error('Error saving producer service:', error);
        throw error;
    }
};
```

The change simplifies the `ON CONFLICT` clause to only check `(producer_id, api_endpoint, p2p_endpoint)`, which should prevent duplicates. Also, ensure `api_endpoint` and `p2p_endpoint` are consistently handled (e.g., always use `''` for empty strings).

---

_**User**_

no we need to check for features also

---

_**Assistant**_

Got it. If `features` needs to be included in the conflict check, here’s the updated fix:

```javascript:src/services/dataService.js
const saveProducerService = async (producerId, service) => {
    const db = getDatabase();
    const query = `
      INSERT INTO producer_services (
        producer_id, node_type, api_endpoint, ssl_endpoint, p2p_endpoint, 
        features, is_full, location_name, location_country, location_latitude, location_longitude
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      ON CONFLICT (producer_id, api_endpoint, p2p_endpoint, features) 
      DO UPDATE SET
        node_type = EXCLUDED.node_type,
        ssl_endpoint = EXCLUDED.ssl_endpoint,
        is_full = EXCLUDED.is_full,
        location_name = EXCLUDED.location_name,
        location_country = EXCLUDED.location_country,
        location_latitude = EXCLUDED.location_latitude,
        location_longitude = EXCLUDED.location_longitude
    `;
    try {
        const nodeType = Array.isArray(service.node_type) 
            ? service.node_type.map(String) 
            : [String(service.node_type)];

        const features = Array.isArray(service.features) 
            ? service.features.map(String) 
            : (service.features ? [String(service.features)] : null);

        await db.query(query, [
            producerId,
            nodeType,
            service.api_endpoint || '',
            service.ssl_endpoint || null,
            service.p2p_endpoint || '',
            features,
            service.is_full || false,
            service.location?.name || null,
            service.location?.country || null,
            service.location?.latitude || null,
            service.location?.longitude || null,
        ]);
        Logger.log('Node add:', 
            JSON.stringify({
                api: service.api_endpoint,
                ssl: service.ssl_endpoint,
                p2p: service.p2p_endpoint
            }, null, 2));
    } catch (error) {
        console.error('Error saving producer service:', error);
        throw error;
    }
};
```


The `ON CONFLICT` clause now includes `features`, ensuring that duplicates are prevented when `producer_id`, `api_endpoint`, `p2p_endpoint`, and `features` are the same. This should resolve the issue.

---

_**User**_

how can I remove these duplicates from my DB?

4717,2757,{seed},"",,waxtest.sentnl.io:9877,{p2p},false,United Kingdom,GB
4715,2756,{seed},"",,waxtest.sentnl.io:9877,{p2p},false,United Kingdom,GB


---

_**Assistant**_

To remove duplicates from your `producer_services` table, you can run this SQL query. It will keep the row with the lowest `id` and delete the rest:

```sql
DELETE FROM producer_services
WHERE id NOT IN (
  SELECT MIN(id)
  FROM producer_services
  GROUP BY producer_id, api_endpoint, p2p_endpoint, features
);
```

### Explanation:
1. **`GROUP BY producer_id, api_endpoint, p2p_endpoint, features`**: Groups rows by the unique combination of these columns.
2. **`MIN(id)`**: Selects the smallest `id` for each group (the first record inserted).
3. **`DELETE ... WHERE id NOT IN`**: Deletes all rows except the ones with the smallest `id` in each group.

### Steps:
1. Backup your database before running the query.
2. Run the query in your database client (e.g., psql, pgAdmin, or directly in your app if you have a query runner).
3. Verify the duplicates are removed.

Let me know if you need help executing this!

---

_**User**_

that did nothing

---

_**Assistant**_



If the query didn't work, it’s likely because the `features` array comparison isn't working as expected. PostgreSQL treats arrays with the same elements but different orders as distinct. Let’s fix this by normalizing the `features` array and then removing duplicates.

Here’s the updated query:

```sql
-- Step 1: Normalize features array (sort and remove duplicates)
UPDATE producer_services
SET features = ARRAY(SELECT DISTINCT unnest(features) ORDER BY 1);

-- Step 2: Delete duplicates
DELETE FROM producer_services
WHERE id NOT IN (
  SELECT MIN(id)
  FROM producer_services
  GROUP BY producer_id, api_endpoint, p2p_endpoint, array_to_string(features, ',')
);
```

### Explanation:
1. **Step 1**: Normalizes the `features` array by sorting and removing duplicate elements. This ensures consistent comparison.
2. **Step 2**: Uses `array_to_string(features, ',')` to convert the array to a string for comparison, which avoids issues with array ordering.

### Steps:
1. Run the `UPDATE` query first to normalize the `features` arrays.
2. Then run the `DELETE` query to remove duplicates.

Let me know if this works or if you need further adjustments!

---

_**User**_

wrire ma a query to delete all rows vfrom validate_services, then all rows from validate_results and tehn all rows from producer_sevices

---

_**Assistant**_

Here’s the SQL query to delete all rows from the specified tables in the correct order (respecting foreign key constraints):

```sql
-- Delete from validate_services first (child table)
DELETE FROM validate_services;

-- Then delete from validate_results (parent of validate_services)
DELETE FROM validate_results;

-- Finally, delete from producer_services (independent table)
DELETE FROM producer_services;
```


### Why this order?
1. **`validate_services`** has a foreign key reference to `validate_results`, so it must be deleted first.
2. **`validate_results`** can then be safely deleted.
3. **`producer_services`** is independent of the other two, so it can be deleted last.

Run these queries in sequence. Let me know if you need further assistance!

---



---

