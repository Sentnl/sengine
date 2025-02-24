## SpecStory

## Date Range Query Troubleshooting (26/12/2024, 20:15:09)

_**User**_

when I am using this route, if I U se @http://127.0.0.1:3000/producer-stats/2711?start_date=2024-12-22&end_date=2024-12-26&chain=mainnet 

It's not giving me any results for 12/26 even though tyey exist. If I put in 12.27 then only does it give me 12.25 results

---

_**Assistant**_

The issue is likely with the date handling in the query. The current query might be excluding the end date due to timestamp comparison. Here's the fix:

```javascript:src/routes.js
// ... existing code ...
const query = `
    SELECT 
      DATE(vr.timestamp AT TIME ZONE 'UTC') AS date,
      vr.id,
      vr.guild_ok,
      vr.api_ok,
      vr.history_ok,
      vr.hyperion_ok,
      vr.p2p_ok,
      vr.atomicassets_ok,
      vr.pricefeed_ok
    FROM validate_results vr
    WHERE vr.producer_id = $1
      AND vr.chain = $2
      AND vr.timestamp >= $3::timestamp
      AND vr.timestamp < ($4::timestamp + INTERVAL '1 day')
    ORDER BY vr.timestamp
`;
// ... existing code ...
```

Changes made:
1. Changed `BETWEEN $3::timestamp AND $4::timestamp` to use `>=` and `<` operators
2. Added 1 day to the end date to include the full end date in results

This ensures that all results from the start date up to and including the end date are included in the query.

---

_**User**_

can you explaihj these options.



---

_**Assistant**_

Here's what each option means:

1. `git config pull.rebase false` (merge):
- Creates a merge commit
- Preserves full history
- Can make history messy with lots of merge commits
- Good for preserving exact history
```bash
A---B---C (main)
     \
      D---E (origin/main)
      
# After merge:
A---B---C---M (main)
     \     /
      D---E
```

2. `git config pull.rebase true` (rebase):
- Replays your local commits on top of remote changes
- Creates linear history
- Cleaner history but modifies commit hashes
- Good for keeping history clean
```bash
A---B---C (main)
     \
      D---E (origin/main)
      
# After rebase:
A---B---D---E---C' (main)
```

3. `git config pull.rebase ff only` (fast-forward):
- Only allows pulls if they can be fast-forwarded
- Fails if branches have diverged
- Prevents accidental merges
- Good for enforcing clean history
```bash
A---B---C (main)
         \
          D---E (origin/main)
          
# After fast-forward:
A---B---C---D---E (main)
```

Most common choice: `git config pull.rebase true` for cleaner history.

Set globally with: `git config --global pull.rebase true`

---

_**User**_

can you give me a curl request example for service-stats

---

_**Assistant**_

Here's a curl example for the `/services-stats` endpoint:

```bash
curl -X POST http://localhost:3000/services-stats \
  -H "Content-Type: application/json" \
  -d '{
    "ids": [162, 198, 249, 250],
    "type": "hyperion"
  }'
```

Valid `type` options:
- `api`
- `history`
- `hyperion`
- `atomicassets`
- `guild`
- `p2p`
- `pricefeed`

The `ids` can be either:
- Array of numbers: `[162, 198, 249]`
- Comma-separated string: `"162,198,249"`

You get these IDs from the `/producer-stats` endpoint's response where they're listed in the `ids` array for each date.

---

_**User**_

the /services-stats route, can we re-arrange the results so teh dates is descending

---

_**Assistant**_



Here's the modified part of the `/services-stats` route to sort dates in descending order:

```javascript:src/routes.js
// ... existing code ...
const uptimePercentages = Object.entries(dailyUptime)
  .sort((a, b) => new Date(b[0]) - new Date(a[0]))  // Sort dates descending
  .map(([date, types]) => {
    const percentages = {};
    for (const [testType, counts] of Object.entries(types)) {
      percentages[testType] = counts.total > 0 ? Math.round((counts.success / counts.total) * 100) : null;
    }
    return { date, percentages };
  });
// ... existing code ...
```

This sorts the dates in descending order (newest to oldest) before mapping them to the percentages.

---

_**User**_

no the timestamp 

---

_**Assistant**_



Here's the modified query to sort timestamps in descending order:

```javascript:src/routes.js
const query = `
  SELECT 
    vs.*, 
    p.name AS producer_name,
    ps.ssl_endpoint,
    ps.p2p_endpoint,
    vr.timestamp AS test_timestamp
  FROM validate_services vs
  JOIN validate_results vr ON vs.validate_result_id = vr.id
  JOIN producers p ON vr.producer_id = p.id
  LEFT JOIN producer_services ps ON vs.producer_service_id = ps.id
  WHERE vs.validate_result_id = ANY($1::int[])
  AND vs.type = $2
  ORDER BY vr.timestamp DESC`  // Changed from ASC to DESC
```

This will return the most recent timestamps first in the results.

---



---

