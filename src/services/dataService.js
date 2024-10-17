import { getDatabase } from '../models/db.js';
import { Logger } from '../helpers/Logger.js';

const saveProducer = async (producer) => {
    const db = getDatabase();
    const query = `
      INSERT INTO producers (name, website, chain_json_url, json_url, logo_svg, chain)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (name, chain) DO UPDATE
      SET website = $2, chain_json_url = $3, json_url = $4, logo_svg = $5
      RETURNING id
    `;
    try {
        const result = await db.query(query, [
            producer.name,
            producer.website,
            producer.chain_json_url,
            producer.json_url,
            producer.logo_svg,
            producer.chain,
        ]);
        Logger.log('', '----------------------------------------');
        Logger.log('', `Adding: ${producer.name} on ${producer.chain}`);
        Logger.log('', '----------------------------------------');
        return result.rows[0].id;
    } catch (error) {
        console.error('Error saving producer:', error);
        throw error;
    }
};

// Save Producer Service Function
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
        // Ensure node_type is always an array of strings
        const nodeType = Array.isArray(service.node_type) 
            ? service.node_type.map(String) 
            : [String(service.node_type)];

        // Ensure features is always an array of strings
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
        // Modified logging
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

// Add this new function at the end of the file
async function saveValidateResult(producerId, results, timestamp, cpuValue) {
    const db = getDatabase();
    const query = `
      INSERT INTO validate_results (
        producer_id, guild, guild_ok, api, api_ok, history, history_ok, 
        hyperion, hyperion_ok, p2p, p2p_ok, atomicassets, atomicassets_ok, pricefeed, pricefeed_ok, timestamp, cpu
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
      RETURNING id
    `;
    const values = [
      producerId,
      false, false, // guild, guild_ok
      false, false, // api, api_ok
      false, false, // history, history_ok
      false, false, // hyperion, hyperion_ok
      false, false, // p2p, p2p_ok
      false, false, // atomicassets, atomicassets_ok
      false, false, // pricefeed, pricefeed_ok
      timestamp,
      cpuValue
    ];
  
    const { rows } = await db.query(query, values);
    return rows[0].id;
  }
  
  async function updateValidateResult(id, results) {
    const db = getDatabase();
    const query = `
      UPDATE validate_results
      SET guild = $1, guild_ok = $2, 
          api = $3, api_ok = $4, 
          history = $5, history_ok = $6, 
          hyperion = $7, hyperion_ok = $8, 
          atomicassets = $9, atomicassets_ok = $10,
          p2p = $11, p2p_ok = $12,
          pricefeed = $13, pricefeed_ok = $14
      WHERE id = $15
    `;
    const values = [
      results.guild[0], results.guild[1],
      results.api[0], results.api[1],
      results.history[0], results.history[1],
      results.hyperion[0], results.hyperion[1],
      results.atomicassets[0], results.atomicassets[1],
      results.p2p[0], results.p2p[1],
      results.pricefeed[0], results.pricefeed[1],
      id
    ];
  
    await db.query(query, values);
  }

export { saveProducer, saveProducerService, saveValidateResult, updateValidateResult };
