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

  // 1. Latest results for each producer
  fastify.get('/latest-results', async (request, reply) => {
    const db = getDatabase();
    const query = `
      SELECT DISTINCT ON (vr.producer_id) vr.*, p.name AS producer_name
      FROM validate_results vr
      JOIN producers p ON vr.producer_id = p.id
      ORDER BY vr.producer_id, vr.timestamp DESC
    `;
    const { rows } = await db.query(query);
    return rows;
  });

  // 2. Validate services for a specific result
  fastify.get('/validate-services/:resultId', async (request, reply) => {
    const db = getDatabase();
    const { resultId } = request.params;
    const query = `
      SELECT vs.*, p.name AS producer_name
      FROM validate_services vs
      JOIN validate_results vr ON vs.validate_result_id = vr.id
      JOIN producers p ON vr.producer_id = p.id
      WHERE vr.id = $1
    `;
    const { rows } = await db.query(query, [resultId]);
    return rows;
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
      SELECT vs.*
      FROM validate_services vs
      JOIN validate_results vr ON vs.id = vr.validate_service_id
      WHERE vr.producer_id = $1
        AND vr.created_at BETWEEN $2 AND $3
    `;
    const { rows } = await db.query(query, [producerId, start_date, end_date]);
    return rows;
  });
};
