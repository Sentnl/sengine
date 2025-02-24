## SpecStory

## Creating a Curl Request for API (16/01/2025, 20:09:57)

_**User**_

can you create a curl request fir this

---

_**Assistant**_

Here's a curl request to test the `/services-stats` endpoint:

```bash
curl -X POST \
  http://localhost:3000/services-stats \
  -H 'Content-Type: application/json' \
  -d '{
    "ids": [162, 198, 249, 250, 252, 287, 296, 298],
    "type": "hyperion"
  }'
```

Alternative format with comma-separated IDs:
```bash
curl -X POST \
  http://localhost:3000/services-stats \
  -H 'Content-Type: application/json' \
  -d '{
    "ids": "162,198,249,250,252,287,296,298",
    "type": "hyperion"
  }'
```

Valid `type` values:
- api
- history
- hyperion
- atomicassets
- light_api
- ipfs

---



---

