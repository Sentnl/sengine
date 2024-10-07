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
        Logger.log('Node add:', service.api_endpoint,  service.ssl_endpoint, service.p2p_endpoint);
    } catch (error) {
        console.error('Error saving producer service:', error);
        throw error;
    }
};

export { saveProducer, saveProducerService };