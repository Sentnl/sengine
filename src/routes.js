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
        vr.created_at AT TIME ZONE 'UTC' AS utc_created_at
      FROM validate_services vs
      JOIN validate_results vr ON vs.validate_result_id = vr.id
      WHERE vr.producer_id = $1
        AND vr.created_at BETWEEN $2::timestamp AND $3::timestamp
    `;
    const { rows } = await db.query(query, [producerId, start_date, end_date]);

    // Convert the created_at to ISO format
    rows.forEach(row => {
      row.created_at = row.utc_created_at.toISOString();
      delete row.utc_created_at;
    });

    return rows;
  });

 4. // Latest results for a specific producer
fastify.get('/producer-latest-results/:producerName', async (request, reply) => {
  const { producerName } = request.params;
  const { chain } = request.query;
  const db = getDatabase();
  
  let query = `
    WITH latest_results AS (
      SELECT DISTINCT ON (vr.producer_id, vr.chain) 
        vr.*,
        vr.timestamp AT TIME ZONE 'UTC' AS utc_timestamp
      FROM validate_results vr
      JOIN producers p ON vr.producer_id = p.id
      WHERE p.name = $1
      ${chain ? 'AND vr.chain = $2' : ''}
      ORDER BY vr.producer_id, vr.chain, vr.timestamp DESC
    )
    SELECT * FROM latest_results
  `;
  
  const queryParams = [producerName];
  if (chain) queryParams.push(chain);

  const { rows } = await db.query(query, queryParams);
  
  if (rows.length === 0) {
    reply.code(404).send({ error: 'Producer not found or no results available' });
    return;
  }
  
  // Convert the timestamp to ISO format
  rows.forEach(row => {
    row.timestamp = row.utc_timestamp.toISOString();
    delete row.utc_timestamp;
  });
  
  return rows;
});

};
