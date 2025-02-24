## SpecStory

## Preventing Duplicates in P2P Nodes (15/01/2025, 12:06:48)

_**User**_

Here is my current default for the producer_services table.

    column_name     |     data_type     | is_nullable |                column_default
--------------------+-------------------+-------------+-----------------------------------------------
 id                 | integer           | NO          | nextval('producer_services_id_seq'::regclass)
 producer_id        | integer           | YES         |
 node_type          | ARRAY             | NO          |
 api_endpoint       | character varying | NO          | ''::character varying
 ssl_endpoint       | character varying | YES         |
 p2p_endpoint       | character varying | NO          | ''::character varying
 features           | ARRAY             | YES         | '{}'::text[]
 is_full            | boolean           | YES         |
 location_name      | character varying | YES         |
 location_country   | character varying | YES         |
 location_latitude  | numeric           | YES         |
 location_longitude | numeric           | YES         |


I am getting duplicates when P2P nodes are saved to teh DB.

@db.js @dataService.js

here is an example:

18588,2707,{seed},"",,peer2-wax.eosphere.io:9876,,true,Beauharnois,CA,45.3151
18831,2707,{seed},"",,peer2-wax.eosphere.io:9876,,true,Beauharnois,CA,45.3151


How can I prevent this, because sometimes we get nodes with the same endpoint name but their features are unique

---

_**Assistant**_

Looking at your schema and the issue, I see the problem. The current UNIQUE constraint in `db.js` is:

```sql
UNIQUE (producer_id, api_endpoint, features, p2p_endpoint)
```

But in your example, you're getting duplicates because `features` is null/empty in both cases. Let's modify the table to handle this case better. I'll update the table definition:

---

_****_

```diff
        ssl_endpoint VARCHAR(255),
        p2p_endpoint VARCHAR(255) NOT NULL DEFAULT '',
-       features TEXT[],
+       features TEXT[] DEFAULT '{}',
        is_full BOOLEAN,
        location_name VARCHAR(100),
        location_country VARCHAR(2),
        location_latitude DECIMAL,
        location_longitude DECIMAL,
-       UNIQUE (producer_id, api_endpoint, features,p2p_endpoint)
+       UNIQUE (producer_id, api_endpoint, p2p_endpoint, COALESCE(features::text, ''))
      );
  
```

---

_****_



Now let's update the data service to ensure features is always an array:

---

_****_

```diff
          const features = Array.isArray(service.features) 
              ? service.features.map(String) 
-             : (service.features ? [String(service.features)] : null);
+             : (service.features ? [String(service.features)] : []);
  
          await db.query(query, [
```

---

_****_



Key changes made:
1. Changed features to have a DEFAULT '{}' instead of allowing NULL
2. Modified the UNIQUE constraint to use COALESCE on features text representation
3. Updated dataService to always provide an empty array instead of null for features

You'll need to recreate the table for these changes to take effect. You can do this by:
1. Backing up your data
2. Dropping the table
3. Letting the setupDatabase function recreate it

This should prevent duplicates while still allowing unique combinations of features for the same endpoint.

---

_**User**_

can you help me update an existn table

---

_**Assistant**_

I'll help you update the existing producer_services table. Here's the ALTER command to modify the table:

---

_****_



---

_****_



---

_**User**_

sengine_wax=# ALTER TABLE producer_services DROP CONSTRAINT IF EXISTS producer_services_producer_id_api_endpoint_features_p2p_endpoint_key; ALTER TABLE producer_services ALTER COLUMN features SET DEFAULT '{}'; ALTER TABLE producer_services ADD CONSTRAINT producer_services_unique_constraint UNIQUE (producer_id, api_endpoint, p2p_endpoint, COALESCE(features::text, ''));"
NOTICE:  identifier "producer_services_producer_id_api_endpoint_features_p2p_endpoint_key" will be truncated to "producer_services_producer_id_api_endpoint_features_p2p_endpoin"
NOTICE:  constraint "producer_services_producer_id_api_endpoint_features_p2p_endpoin" of relation "producer_services" does not exist, skipping
ALTER TABLE
ALTER TABLE
ERROR:  syntax error at or near "("
LINE 1: ...(producer_id, api_endpoint, p2p_endpoint, COALESCE(features:...
                                                             ^

---

_**Assistant**_

Let's fix the syntax error. Here's the correct SQL:

---

_****_



---

_****_



---

_**User**_

can you confirm the tabke looks correct now?

    column_name     |     data_type     | is_nullable |                column_default
--------------------+-------------------+-------------+-----------------------------------------------
 id                 | integer           | NO          | nextval('producer_services_id_seq'::regclass)
 producer_id        | integer           | YES         |
 node_type          | ARRAY             | NO          |
 api_endpoint       | character varying | NO          | ''::character varying
 ssl_endpoint       | character varying | YES         |
 p2p_endpoint       | character varying | NO          | ''::character varying
 features           | ARRAY             | YES         | '{}'::text[]
 is_full            | boolean           | YES         |
 location_name      | character varying | YES         |
 location_country   | character varying | YES         |
 location_latitude  | numeric           | YES         |
 location_longitude | numeric           | YES         |

---

_**Assistant**_

Let's check the constraints to make sure everything is set up correctly:

---

_****_



---

_****_



---

_**User**_

                                          Table "public.producer_services"
       Column       |          Type          | Collation | Nullable |                    Default
--------------------+------------------------+-----------+----------+-----------------------------------------------
 id                 | integer                |           | not null | nextval('producer_services_id_seq'::regclass)
 producer_id        | integer                |           |          |
 node_type          | text[]                 |           | not null |
 api_endpoint       | character varying(255) |           | not null | ''::character varying
 ssl_endpoint       | character varying(255) |           |          |
 p2p_endpoint       | character varying(255) |           | not null | ''::character varying
 features           | text[]                 |           |          | '{}'::text[]
 is_full            | boolean                |           |          |
 location_name      | character varying(100) |           |          |
 location_country   | character varying(2)   |           |          |
 location_latitude  | numeric                |           |          |
 location_longitude | numeric                |           |          |
Indexes:
    "producer_services_pkey" PRIMARY KEY, btree (id)
    "idx_producer_services_producer_id" btree (producer_id)
    "producer_services_unique_constraint" UNIQUE CONSTRAINT, btree (producer_id, api_endpoint, p2p_endpoint, features)
Foreign-key constraints:
    "producer_services_producer_id_fkey" FOREIGN KEY (producer_id) REFERENCES producers(id)
Referenced by:
    TABLE "validate_services" CONSTRAINT "validate_services_producer_service_id_fkey" FOREIGN KEY (producer_service_id) REFERENCES producer_services(id)

---

_**Assistant**_

Yes, the table structure looks correct now. The key points are in place:

1. `features` has the correct default: `'{}'::text[]`
2. The unique constraint is properly set up: `producer_services_unique_constraint` on `(producer_id, api_endpoint, p2p_endpoint, features)`
3. All other columns maintain their correct types and constraints
4. The indexes and foreign key relationships are preserved

The table should now handle the duplicate entries case properly, as it will consider the combination of `producer_id`, `api_endpoint`, `p2p_endpoint`, and `features` when determining uniqueness. If you're still seeing duplicates, we should look at the data being inserted in `dataService.js` to make sure the features are being properly normalized before insertion.

---

_**User**_

{"level":50,"time":1736943368788,"pid":28122,"hostname":"Charless-MacBook-Pro.local","err":{"type":"DatabaseError","message":"syntax error at or near \"(\"","stack":"error: syntax error at or near \"(\"\n    at /Users/charlesholtzkampf/sentnl/sengine-backend/node_modules/pg-pool/index.js:45:11\n    at process.processTicksAndRejections (node:internal/process/task_queues:95:5)\n    at async setupDatabase (file:///Users/charlesholtzkampf/sentnl/sengine-backend/src/models/db.js:12:3)\n    at async start (file:///Users/charlesholtzkampf/sentnl/sengine-backend/src/index.js:22:5)","length":91,"name":"error","severity":"ERROR","code":"42601","position":"932","file":"scan.l","line":"1180","routine":"scanner_yyerror"},"msg":"syntax error at or near \"(\""}

---

_**Assistant**_



The error is coming from the table creation in `db.js`. Let's fix the syntax error in the CREATE TABLE statement:

---

_****_

```diff
        location_latitude DECIMAL,
        location_longitude DECIMAL,
-       UNIQUE (producer_id, api_endpoint, p2p_endpoint, COALESCE(features::text, ''))
+       UNIQUE (producer_id, api_endpoint, p2p_endpoint, features)
      );
  
```

---

_****_



I've removed the `COALESCE` from the table creation since PostgreSQL handles array comparison in UNIQUE constraints natively. The empty array default we set (`DEFAULT '{}'`) will ensure consistency when no features are provided.

This should resolve the syntax error you're seeing. The table will now properly enforce uniqueness across the combination of producer_id, api_endpoint, p2p_endpoint, and features.

---

_**User**_

tihs is on my docker container does the DB look correct nbased on the changes we tried to make.

                                          Table "public.producer_services"
       Column       |          Type          | Collation | Nullable |                    Default                    
--------------------+------------------------+-----------+----------+-----------------------------------------------
 id                 | integer                |           | not null | nextval('producer_services_id_seq'::regclass)
 producer_id        | integer                |           |          | 
 node_type          | text[]                 |           | not null | 
 api_endpoint       | character varying(255) |           | not null | ''::character varying
 ssl_endpoint       | character varying(255) |           |          | 
 p2p_endpoint       | character varying(255) |           | not null | ''::character varying
 features           | text[]                 |           |          | '{}'::text[]
 is_full            | boolean                |           |          | 
 location_name      | character varying(100) |           |          | 
 location_country   | character varying(2)   |           |          | 
 location_latitude  | numeric                |           |          | 
 location_longitude | numeric                |           |          | 
Indexes:
    "producer_services_pkey" PRIMARY KEY, btree (id)
    "idx_producer_services_producer_id" btree (producer_id)
    "producer_services_unique_constraint" UNIQUE CONSTRAINT, btree (producer_id, api_endpoint, p2p_endpoint, features)
Foreign-key constraints:
    "producer_services_producer_id_fkey" FOREIGN KEY (producer_id) REFERENCES producers(id)
Referenced by:
    TABLE "validate_services" CONSTRAINT "validate_services_producer_service_id_fkey" FOREIGN KEY (producer_service_id) REFERENCES producer_services(id)

---

_**Assistant**_

Yes, the database structure in your Docker container looks correct based on our changes. The key elements are in place:

1. The `features` column has the correct default: `'{}'::text[]`
2. The unique constraint is properly set up: `producer_services_unique_constraint` on `(producer_id, api_endpoint, p2p_endpoint, features)`
3. All other columns have their correct types and constraints
4. The indexes and foreign key relationships are preserved

Also, your `dataService.js` is correctly handling the features array:
```javascript
const features = Array.isArray(service.features) 
    ? service.features.map(String) 
    : (service.features ? [String(service.features)] : []);
```

This should now prevent duplicates while still allowing unique combinations of features for the same endpoint. If you're still seeing duplicates, we should look at the actual data being inserted to see what might be causing it.

---

_**User**_

can you recommend some DB indexes I can create to optomizd seraching?

---

_**Assistant**_



I'll suggest some additional indexes based on common query patterns for producer services. Here's what I recommend:

---

_****_

```diff
        CREATE INDEX IF NOT EXISTS idx_validate_services_chain_timestamp ON validate_services(chain, timestamp);
        CREATE INDEX IF NOT EXISTS idx_validate_services_type ON validate_services(type);
+ 
+       -- Producer Services Optimization Indexes
+       CREATE INDEX IF NOT EXISTS idx_producer_services_p2p ON producer_services(p2p_endpoint);
+       CREATE INDEX IF NOT EXISTS idx_producer_services_api ON producer_services(api_endpoint);
+       CREATE INDEX IF NOT EXISTS idx_producer_services_features ON producer_services USING gin(features);
+       CREATE INDEX IF NOT EXISTS idx_producer_services_node_type ON producer_services USING gin(node_type);
+       CREATE INDEX IF NOT EXISTS idx_producer_services_location ON producer_services(location_country, location_name);
+       CREATE INDEX IF NOT EXISTS idx_producer_services_composite ON producer_services(producer_id, p2p_endpoint, api_endpoint);
    `);
  };
```

---

_****_



Here's what each new index is for:

1. `idx_producer_services_p2p`: Optimizes searches by P2P endpoint
2. `idx_producer_services_api`: Optimizes searches by API endpoint
3. `idx_producer_services_features`: GIN index for array searches on features
4. `idx_producer_services_node_type`: GIN index for array searches on node types
5. `idx_producer_services_location`: Helps with geographical queries
6. `idx_producer_services_composite`: Composite index for common multi-column queries

The GIN indexes are particularly useful for the array columns (`features` and `node_type`) as they allow efficient searching within arrays.

To apply these changes to your existing database, you can run:

---

_****_



---

_****_



---

_**User**_

actually lets look at @routes.js and create indexes that would benefit those routes

---

_**Assistant**_

I'll analyze each route and suggest optimal indexes based on the query patterns:

---

_****_

```diff
        CREATE INDEX IF NOT EXISTS idx_validate_services_chain_timestamp ON validate_services(chain, timestamp);
        CREATE INDEX IF NOT EXISTS idx_validate_services_type ON validate_services(type);
+ 
+       -- Indexes for /latest-results route
+       CREATE INDEX IF NOT EXISTS idx_validate_results_producer_timestamp ON validate_results(producer_id, timestamp DESC);
+       CREATE INDEX IF NOT EXISTS idx_validate_results_chain_producer_timestamp ON validate_results(chain, producer_id, timestamp DESC);
+       
+       -- Indexes for /validate-services/:resultId route
+       CREATE INDEX IF NOT EXISTS idx_validate_services_result_type ON validate_services(validate_result_id, type);
+       
+       -- Indexes for /validate-producer/:producerId route
+       CREATE INDEX IF NOT EXISTS idx_validate_results_chain_timestamp_producer ON validate_results(chain, timestamp, producer_id);
+       
+       -- Indexes for /producer-stats/:producerId route
+       CREATE INDEX IF NOT EXISTS idx_validate_results_producer_chain_timestamp ON validate_results(producer_id, chain, timestamp);
+       
+       -- Indexes for /services-stats route
+       CREATE INDEX IF NOT EXISTS idx_validate_services_result_type_timestamp ON validate_services(validate_result_id, type, timestamp);
+       
+       -- Indexes for /nodes/:nodeType route
+       CREATE INDEX IF NOT EXISTS idx_producer_services_features_gin ON producer_services USING gin(features);
+       CREATE INDEX IF NOT EXISTS idx_producer_services_chain_features ON producer_services(producer_id, ssl_endpoint) INCLUDE (features);
+       CREATE INDEX IF NOT EXISTS idx_producer_services_p2p_chain ON producer_services(producer_id, p2p_endpoint) WHERE p2p_endpoint != '';
    `);
  };
```

---

_****_



Here's why each index was added:

1. `/latest-results`:
   - `idx_validate_results_producer_timestamp`: Optimizes the DISTINCT ON with ORDER BY
   - `idx_validate_results_chain_producer_timestamp`: Covers chain filter + ordering

2. `/validate-services/:resultId`:
   - `idx_validate_services_result_type`: Optimizes lookup by result ID and type categorization

3. `/validate-producer/:producerId`:
   - `idx_validate_results_chain_timestamp_producer`: Optimizes date range + chain filtering

4. `/producer-stats/:producerId`:
   - `idx_validate_results_producer_chain_timestamp`: Optimizes producer-specific time series queries

5. `/services-stats`:
   - `idx_validate_services_result_type_timestamp`: Optimizes type filtering with timestamp sorting

6. `/nodes/:nodeType`:
   - `idx_producer_services_features_gin`: GIN index for array searching in features
   - `idx_producer_services_chain_features`: Composite index for SSL endpoints
   - `idx_producer_services_p2p_chain`: Partial index for P2P endpoints

These indexes are specifically tailored to the actual query patterns in your routes, which should provide better performance than generic indexes.

To apply these to your existing database:

---

_****_



---

_****_



---



---

