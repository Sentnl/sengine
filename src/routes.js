import { getDatabase } from './models/db.js';

export const setupRoutes = (fastify) => {
  fastify.get('/producers', async (request, reply) => {
    const db = getDatabase();
    const { rows } = await db.query('SELECT * FROM producers');
    return rows;
  });

  fastify.get('/producers/:chain', async (request, reply) => {
    const db = getDatabase();
    const { chain } = request.params;
    const { rows } = await db.query('SELECT * FROM producers WHERE chain = $1', [chain]);
    return rows;
  });


  // 1. Latest results for each producer, optionally filtered by chain
fastify.get('/latest-results', async (request, reply) => {
  const { chain } = request.query;
  const db = getDatabase();
  
  let query = `
    WITH latest_results AS (
      SELECT DISTINCT ON (vr.producer_id) 
        vr.*,
        p.name AS producer_name,
        vr.timestamp AT TIME ZONE 'UTC' AS utc_timestamp
      FROM validate_results vr
      JOIN producers p ON vr.producer_id = p.id
      ${chain ? 'WHERE vr.chain = $1' : ''}
      ORDER BY vr.producer_id, vr.timestamp DESC
    )
    SELECT * FROM latest_results
  `;

  const queryParams = chain ? [chain] : [];
  const { rows } = await db.query(query, queryParams);

  // Convert the timestamp to ISO format
  rows.forEach(row => {
    row.timestamp = row.utc_timestamp.toISOString();
    delete row.utc_timestamp;
  });

  return rows;
});



  // 2. Return Validate_services for a specific result, categorized by type and endpoint
  fastify.get('/validate-services/:resultId', async (request, reply) => {
    const db = getDatabase();
    const { resultId } = request.params;
    const query = `
      SELECT 
        vs.*, 
        p.name AS producer_name,
        ps.ssl_endpoint,
        ps.p2p_endpoint
      FROM validate_services vs
      JOIN validate_results vr ON vs.validate_result_id = vr.id
      JOIN producers p ON vr.producer_id = p.id
      LEFT JOIN producer_services ps ON vs.producer_service_id = ps.id
      WHERE vr.id = $1
    `;
    const { rows } = await db.query(query, [resultId]);

    // Categorize results by type and endpoint
    const categorizedResults = rows.reduce((acc, row) => {
      if (!acc[row.type]) {
        acc[row.type] = {};
      }
      
      const endpoint = row.ssl_endpoint || row.p2p_endpoint;
      if (!acc[row.type][endpoint]) {
        acc[row.type][endpoint] = [];
      }
      
      acc[row.type][endpoint].push(row);
      return acc;
    }, {});

    return categorizedResults;
  });
/* 
  // 3. Validate services for a producer within a time range
  fastify.get('/producer-services/:producerId', async (request, reply) => {
    const db = getDatabase();
    const { producerId } = request.params;
    const { start_date, end_date } = request.query;

    if (!start_date || !end_date) {
      reply.code(400).send({ error: 'start_date and end_date are required query parameters' });
      return;
    }

    const query = `
      SELECT 
        vs.*,
        vr.timestamp AT TIME ZONE 'UTC' AS utc_timestamp
      FROM validate_services vs
      JOIN validate_results vr ON vs.validate_result_id = vr.id
      WHERE vr.producer_id = $1
        AND vr.timestamp BETWEEN $2::timestamp AND $3::timestamp
    `;
    const { rows } = await db.query(query, [producerId, start_date, end_date]);

    // Convert the timestamp to ISO format
    rows.forEach(row => {
      row.timestamp = row.utc_timestamp.toISOString();
      delete row.utc_timestamp;
    });

    return rows;
  });
 */

  
// 4. Results for a specific producer or all producers in a chain
fastify.get('/producer-results/:producerId?', async (request, reply) => {
  const { producerId } = request.params;
  const { chain, start_date, end_date } = request.query;
  const db = getDatabase();
  
  if (!start_date || !end_date || !chain) {
    reply.code(400).send({ error: 'start_date, end_date, and chain are required query parameters' });
    return;
  }

  let query = `
    SELECT 
      vr.*,
      vr.timestamp AT TIME ZONE 'UTC' AS utc_timestamp,
      p.name AS producer_name
    FROM validate_results vr
    JOIN producers p ON vr.producer_id = p.id
    WHERE vr.timestamp BETWEEN $1::timestamp AND $2::timestamp
      AND vr.chain = $3
      ${producerId ? 'AND vr.producer_id = $4' : ''}
    ORDER BY vr.producer_id, vr.timestamp DESC
  `;
  
  const queryParams = [start_date, end_date, chain];
  if (producerId) queryParams.push(producerId);

  const { rows } = await db.query(query, queryParams);
  
  if (rows.length === 0) {
    reply.code(404).send({ error: 'No results available for the given parameters' });
    return;
  }
  
  const groupedResults = rows.reduce((acc, row) => {
    if (!acc[row.producer_id]) {
      acc[row.producer_id] = {
        id: row.id,
        producer_id: row.producer_id,
        producer_name: row.producer_name,
        chain: row.chain,
        start_timestamp: start_date,
        end_timestamp: end_date,
        rows: []
      };
    }
    acc[row.producer_id].rows.push(row);
    return acc;
  }, {});

  const services = ['guild', 'api', 'history', 'hyperion', 'p2p', 'atomicassets', 'pricefeed'];

  const results = Object.values(groupedResults).map(producer => {
    services.forEach(service => {
      const totalTests = producer.rows.length;
      const passedTests = producer.rows.filter(row => row[`${service}_ok`]).length;
      producer[service] = producer.rows[0][service];
      producer[`${service}_ok`] = Math.round((passedTests / totalTests) * 100);
    });

    producer.cpu = Math.round(producer.rows.reduce((sum, row) => sum + row.cpu, 0) / producer.rows.length);

    delete producer.rows;
    return producer;
  });

  return producerId ? results[0] : results;
});

};
