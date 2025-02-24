## SpecStory

## Change Timing to Every 30 Minutes (15/01/2025, 11:35:26)

_**User**_

can we chnage this to every 30min

---

_**Assistant**_

Here's the change to make it run every 30 minutes instead of 20:

```javascript:src/services/monitoringService.js
      const timeUntilNextTest = Math.max(0, 30 * 60 * 1000 - (now - lastTestTime)); // Run every 30 minutes
```

Just changed `20 * 60 * 1000` to `30 * 60 * 1000`. The rest of the code can stay the same since it's using relative timing.

---

_**User**_

write me a query to check for duplicates ona table

---

_**Assistant**_

Here's a SQL query to check for duplicates in a table based on a specific column (replace `your_column` with the actual column name):

```sql
SELECT your_column, COUNT(*) 
FROM your_table 
GROUP BY your_column 
HAVING COUNT(*) > 1;
```

This will return all values in `your_column` that appear more than once, along with the count of duplicates.

If you want to check for duplicates across multiple columns, just add them to the `GROUP BY` clause:

```sql
SELECT column1, column2, COUNT(*) 
FROM your_table 
GROUP BY column1, column2 
HAVING COUNT(*) > 1;
```

---

_**User**_

how do count teh rows in a table using posql

---

_**Assistant**_

Here's how to count rows in a table using PostgreSQL:

```sql
SELECT COUNT(*) FROM your_table_name;
```

If you want to count only non-null values in a specific column:

```sql
SELECT COUNT(your_column_name) FROM your_table_name;
```

---

_**User**_

how to delete entries in the producer_services table where id are larger tahn  855292

---

_**Assistant**_

Here's the SQL query to delete entries from `producer_services` where IDs are greater than 855292:

```sql
DELETE FROM producer_services WHERE id > 855292;
```

Before running this, you might want to:

1. Check how many rows will be affected:
```sql
SELECT COUNT(*) FROM producer_services WHERE id > 855292;
```

2. Backup the data first:
```sql
CREATE TABLE producer_services_backup AS
SELECT * FROM producer_services WHERE id > 855292;
```

---

_**User**_

this command how can I ensure it rebuilds from scratch

DB_USER=ankh2054 DB_PASSWORD=Nightshade900! DB_NAME=wax_sengine DB_HOST=sengine-db CONTAINER_NAME=sengine-backend docker-compose up --build --no-deps -d sengine-app

---

_**Assistant**_

To ensure a complete rebuild from scratch, you'll want to:

1. Force a fresh pull of images
2. Remove any existing containers
3. Remove any existing volumes
4. Rebuild without cache

Here's the modified command:

```bash
DB_USER=ankh2054 DB_PASSWORD=Nightshade900! DB_NAME=wax_sengine DB_HOST=sengine-db CONTAINER_NAME=sengine-backend docker-compose down -v && docker-compose build --no-cache && docker-compose up -d
```

Key changes:
- Added `-v` to `docker-compose down` to remove volumes
- Added `--no-cache` to the build command
- Split into separate commands with `&&` to ensure proper sequence
- Removed `--no-deps` since we want a complete rebuild

This will:
1. Tear down everything including volumes
2. Build fresh images without using cache
3. Start everything up clean

If you want to be extra thorough, you can also add `docker system prune -a -f` before the build to clean up all unused Docker objects.

---

_**User**_

I lnly want to rebuilld sengine-app though

---

_**Assistant**_

Got it, here's how to rebuild just `sengine-app` from scratch while keeping other services intact:

```bash
DB_USER=ankh2054 DB_PASSWORD=Nightshade900! DB_NAME=wax_sengine DB_HOST=sengine-db CONTAINER_NAME=sengine-backend docker-compose stop sengine-app && docker-compose rm -f sengine-app && docker-compose build --no-cache sengine-app && docker-compose up -d sengine-app
```

This will:
1. Stop just the `sengine-app` service
2. Remove its container
3. Rebuild it without cache
4. Start it back up

The rest of your services will remain untouched and running. If you want to ensure no cached layers are used, the `--no-cache` flag is key.

---

_**User**_

it always ading p2p to the feature list, even when the node is not p2p?

2736,"{query,seed}",http://wax-testnet.cryptolions.io,https://wax-testnet.cryptolions.io,wax-testnet.cryptolions.io:7987,"{chain-api,account-query,history-v1,hyperion-v2,p2p}",true,Germany-Finland,DE


---

_**Assistant**_

The issue is that `p2p` is being added to the `features` array even when it shouldn't be. Here's how to fix it:

1. First, check where the `features` array is being populated. Look for the code that builds this array and ensure it only adds `p2p` when the node actually supports it.

2. If you're using a function to generate the `features` array, modify it to conditionally add `p2p`:

```javascript
function buildFeatures(nodeType, apiEndpoint, p2pEndpoint) {
  const features = ['chain-api', 'account-query', 'history-v1', 'hyperion-v2'];
  
  // Only add p2p if there's a valid p2p endpoint
  if (p2pEndpoint && p2pEndpoint !== '') {
    features.push('p2p');
  }
  
  return features;
}
```

3. If this is happening during database insertion, add a validation step before inserting:

```javascript
if (producerService.p2pEndpoint === '' || producerService.p2pEndpoint === null) {
  producerService.features = producerService.features.filter(f => f !== 'p2p');
}
```

4. For existing incorrect entries, run a SQL update to remove `p2p` from features where p2p_endpoint is empty:

```sql
UPDATE producer_services
SET features = array_remove(features, 'p2p')
WHERE p2p_endpoint = '' OR p2p_endpoint IS NULL;
```

This should prevent `p2p` from being added to features when it's not applicable.

---

_**User**_

2736,"{query,seed}",http://wax-testnet.cryptolions.io,https://wax-testnet.cryptolions.io,wax-testnet.cryptolions.io:7987,"{chain-api,account-query,history-v1,hyperion-v2,p2p}",true,Germany-Finland,DE


it's always adding p2p to the features list ven when the node is not a p2p_enmdpoint

---

_**Assistant**_

The issue is in the `parseProducerServices` function where `p2p` is being added unconditionally. Here's the fix:

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
      features: (node.features || []).concat(node.p2p_endpoint ? ['p2p'] : []), // Only add p2p if p2p_endpoint exists
      is_full: node.full || false,
      location: node.location,
    }));
};
```


The change is in the `features` line - now it only adds `p2p` if `node.p2p_endpoint` exists. This will prevent `p2p` from being added to nodes that don't have a p2p endpoint.

---



---

