## SpecStory

## Adding Top21 Status to Producer Routes (28/12/2024, 21:45:06)

_**User**_

does any route herte display the top21 status of a producer @db.js 

---

_**Assistant**_

Looking at both files, none of the current routes explicitly display the `top21` status from the producers table, despite it being defined in the schema. Here's a quick modification to include it in relevant routes:

```javascript:src/routes.js
// ... existing code ...

// Add top21 to /producers route
fastify.get('/producers', async (request, reply) => {
  const db = getDatabase();
  const { rows } = await db.query('SELECT *, top21 FROM producers');
  return rows;
});

// Add top21 to /producers/:chain route
fastify.get('/producers/:chain', async (request, reply) => {
  const db = getDatabase();
  const { chain } = request.params;
  const { rows } = await db.query('SELECT *, top21 FROM producers WHERE chain = $1', [chain]);
  return rows;
});

// Add top21 to /latest-results query
fastify.get('/latest-results', async (request, reply) => {
  // ... existing code ...
  let query = `
    WITH latest_results AS (
      SELECT DISTINCT ON (vr.producer_id) 
        vr.*,
        p.name AS producer_name,
        p.top21,
        vr.timestamp AT TIME ZONE 'UTC' AS utc_timestamp
      FROM validate_results vr
      JOIN producers p ON vr.producer_id = p.id
      WHERE 1=1
      ${chain ? 'AND vr.chain = $1' : ''}
      ${producer ? 'AND LOWER(p.name) = LOWER($' + (chain ? '2' : '1') + ')' : ''}
      ORDER BY vr.producer_id, vr.timestamp DESC
    )
    SELECT * FROM latest_results
  `;
  // ... rest of the route ...
});
```

These changes will include the `top21` boolean field in the response for these endpoints. You can then use this data in your frontend to show which producers are in the top 21.

---



---

