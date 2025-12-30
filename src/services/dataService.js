import { getDatabase } from '../models/db.js';
import { Logger } from '../helpers/Logger.js';

const saveProducer = async (producer) => {
    const db = getDatabase();
    const query = `
      INSERT INTO producers (name, website, chain_json_url, json_url, logo_svg, logo_256, chain, top21, country_code)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (name, chain) DO UPDATE
      SET website = $2, chain_json_url = $3, json_url = $4, logo_svg = $5, logo_256 = $6, top21 = $8, country_code = $9
      RETURNING id
    `;
    try {
        const result = await db.query(query, [
            producer.name,
            producer.website,
            producer.chain_json_url,
            producer.json_url,
            producer.logo_svg,
            producer.logo_256,
            producer.chain, 
            producer.top21,
            producer.country_code
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
            : (service.features ? [String(service.features)] : []);

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

// Add this new function at the end of the file
async function saveValidateResult(producerId, results, timestamp, cpuValue, chain) {
    const db = getDatabase();
    const query = `
      INSERT INTO validate_results (
        producer_id, guild, guild_ok, api, api_ok, history, history_ok, 
        hyperion, hyperion_ok, p2p, p2p_ok, atomicassets, atomicassets_ok, 
        pricefeed, pricefeed_ok, light_api, light_api_ok, timestamp, cpu, chain,
        ipfs, ipfs_ok
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)
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
      false, false, // light_api, light_api_ok
      timestamp,
      cpuValue,
      chain,
      false, false, // ipfs, ipfs_ok
    ];
  
    const { rows } = await db.query(query, values);
    return rows[0].id;
}
  
async function updateValidateResult(id, results, serverFullVersionString = "unknown") {
    const db = getDatabase();
    const query = `
      UPDATE validate_results
      SET guild = $1, guild_ok = $2, 
          api = $3, api_ok = $4, 
          history = $5, history_ok = $6, 
          hyperion = $7, hyperion_ok = $8, 
          atomicassets = $9, atomicassets_ok = $10,
          p2p = $11, p2p_ok = $12,
          pricefeed = $13, pricefeed_ok = $14,
          light_api = $15, light_api_ok = $16,
          ipfs = $17, ipfs_ok = $18,
          server_full_version_string = $19
      WHERE id = $20
    `;
    const values = [
      results.guild[0], results.guild[1],
      results.api[0], results.api[1],
      results.history[0], results.history[1],
      results.hyperion[0], results.hyperion[1],
      results.atomicassets[0], results.atomicassets[1],
      results.p2p[0], results.p2p[1],
      results.pricefeed[0], results.pricefeed[1],
      results.light_api[0], results.light_api[1],
      results.ipfs[0], results.ipfs[1],
      serverFullVersionString,
      id
    ];
  
    await db.query(query, values);
}

export { saveProducer, saveProducerService, saveValidateResult, updateValidateResult };
