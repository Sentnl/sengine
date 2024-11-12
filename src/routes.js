import { getDatabase } from './models/db.js';
import config from './config.js';
import ky from 'ky';


function insertDummyDataIfEmpty(apiResponse) {
  if (apiResponse.data && apiResponse.data.length === 0) {
    const startDate = new Date(apiResponse.startDate);
    const endDate = new Date(apiResponse.endDate);
    const oneDayMilliseconds = 24 * 60 * 60 * 1000;
    const days = Math.ceil((endDate - startDate) / oneDayMilliseconds);

    let dummyDataset = [];  // Temporary storage for dummy data

    for (let i = 0; i < days; i++) {
      const dateObj = new Date(startDate.getTime() + i * oneDayMilliseconds);

      const dummyData = {
        owner_name: apiResponse.ownerName,
        block_number: 231959980 + i,  // Adjust this based on your needs.
        date: dateObj.toISOString(),
        round_missed: false,
        blocks_missed: false,
        missed_block_count: 0
      };

      dummyDataset.push(dummyData);
    }

    apiResponse.data = dummyDataset.reverse();  // No need to reverse as we're incrementing the date
  }

  return apiResponse;
}


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


// Get missing block data fdrom external urls 
fastify.get('/missing-blocks', async (req, reply) => {
  const ownerName = req.query.ownerName;
  const startDate = req.query.startDate;
  const endDate = req.query.endDate;
  const chain = req.query.chain?.toLowerCase();

  if (!ownerName || !chain || !['mainnet', 'testnet'].includes(chain)) {
    return reply.status(400).send({
      success: false,
      error: {
        kind: "user_input",
        message: "Invalid or missing parameters. Chain must be 'mainnet' or 'testnet'",
      },
    });
  }

  const baseURL = config.chains[chain].missingBlocksUrl;
  
  // Construct the external URL with query parameters
  const externalURL = `${baseURL}/missing-blocks?ownerName=${encodeURIComponent(ownerName)}&startDate=${startDate}&endDate=${endDate}`;

  try {
    const response = await ky.get(externalURL).json();
    const processedResponse = insertDummyDataIfEmpty(response);
    reply.send(processedResponse);
  } catch (error) {
    console.error('Error calling external URL:', error);
    
    // Handle the error based on your needs (e.g., sending a custom error response)
    reply.status(500).send({
      success: false,
      error: {
        kind: "external_api",
        message: "Failed to fetch data from external source.",
      },
    });
  }
});


// CPU history for charts
// example: /cpu/123?start_date=2024-01-01&end_date=2024-01-31&chain=mainnet
fastify.get('/cpu/:producerId', async (request, reply) => {
  const { producerId } = request.params;
  const { start_date, end_date, chain } = request.query;
  const db = getDatabase();
  
  if (!start_date || !end_date || !chain) {
    reply.code(400).send({ error: 'start_date, end_date, and chain are required query parameters' });
    return;
  }

  const query = `
    SELECT 
      cpu,
      timestamp AT TIME ZONE 'UTC' as timestamp
    FROM validate_results 
    WHERE producer_id = $1
      AND chain = $2
      AND timestamp BETWEEN $3::timestamp AND $4::timestamp
    ORDER BY timestamp ASC
  `;

  const { rows } = await db.query(query, [producerId, chain, start_date, end_date]);

  return rows.map(row => ({
    date: row.timestamp.toISOString(),
    value: row.cpu
  }));
});


  // 1. Latest results for each producer, optionally filtered by chain and/or producer
  // Home page
  // example: /latest-results?chain=mainnet&producer=someproducer
fastify.get('/latest-results', async (request, reply) => {
  const { chain, producer } = request.query;
  const db = getDatabase();
  
  let query = `
    WITH latest_results AS (
      SELECT DISTINCT ON (vr.producer_id) 
        vr.*,
        p.name AS producer_name,
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

  const queryParams = [];
  if (chain) queryParams.push(chain);
  if (producer) queryParams.push(producer);

  const { rows } = await db.query(query, queryParams);

  // Convert the timestamp to ISO format
  rows.forEach(row => {
    row.timestamp = row.utc_timestamp.toISOString();
    delete row.utc_timestamp;
  });

  return rows;
});



  // 2. Return Validate_services for a specific result, categorized by type and endpoint
  // Producer Page 
  //example: /validate-services/162
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




// 3. Results for a specific producer or all producers in a chain, provides a list of services and their uptime percentages.
// Producer Page (if you ask for specific producer) and Stats Page (if you ask for all producers)
fastify.get('/validate-producer/:producerId?', async (request, reply) => {
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

//4. Stats page that creates a total percentage of passed tests per day, for each test.
// Chart page 1 - For Charts for each type per producer
// example: /producer-stats/162?start_date=2024-01-01&end_date=2024-01-31&chain=mainnet
fastify.get('/producer-stats/:producerId', async (request, reply) => {
  const { producerId } = request.params;
  const { start_date, end_date, chain } = request.query;
  const db = getDatabase();
  
  if (!start_date || !end_date || !chain) {
    reply.code(400).send({ error: 'start_date, end_date, and chain are required query parameters' });
    return;
  }

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
      AND vr.timestamp BETWEEN $3::timestamp AND $4::timestamp
    ORDER BY vr.timestamp
  `;

  const { rows } = await db.query(query, [producerId, chain, start_date, end_date]);

  if (rows.length === 0) {
    reply.code(404).send({ error: 'No results available for the given parameters' });
    return;
  }

  const services = ['guild', 'api', 'history', 'hyperion', 'p2p', 'atomicassets', 'pricefeed'];
  const dailyResults = {};

  rows.forEach(row => {
    const date = row.date.toISOString().split('T')[0];
    if (!dailyResults[date]) {
      dailyResults[date] = {
        date,
        total_tests: 0,
        ids: [],
      };
      services.forEach(service => {
        dailyResults[date][service] = { passed: 0, total: 0 };
      });
    }

    dailyResults[date].total_tests++;
    dailyResults[date].ids.push(row.id);

    services.forEach(service => {
      dailyResults[date][service].total++;
      if (row[`${service}_ok`]) {
        dailyResults[date][service].passed++;
      }
    });
  });

  const results = Object.values(dailyResults).map(day => {
    const dayResult = {
      date: day.date,
      total_tests: day.total_tests,
      ids: day.ids
    };
    services.forEach(service => {
      dayResult[service] = Math.round((day[service].passed / day[service].total) * 100);
    });
    return dayResult;
  });

  const categorizedResults = services.reduce((acc, service) => {
    acc[service] = results.map(day => ({
      date: day.date,
      value: day[service]
    }));
    return acc;
  }, {});

  categorizedResults.total_tests = results.map(day => ({
    date: day.date,
    value: day.total_tests
  }));

  categorizedResults.ids = results.map(day => ({
    date: day.date,
    value: day.ids
  }));

  return categorizedResults;
});

//5. Provides a list of test_types and their daily uptime percentages, based on the type.
// Chart page 2 - Charts for each test_type per type (which is associated with a producer based on the ids)
// So if you passed in hyperion and a range of ids, it will get all the test_types done for hyperion. 
// Since it start from the stats page they 30 days range will automatically work, 
// since it will get the ids from the stats page that are associated with that timestamp range.
// example: /services-stats?ids=162,198,249,250,252,287,296,298&type=hyperion
fastify.get('/services-stats', async (request, reply) => {
  const db = getDatabase();
  const { ids, type } = request.query;

  console.log('Received query:', { ids, type });

  if (!ids || !type) {
    reply.code(400).send({ error: 'ids and type are required query parameters' });
    return;
  }

  const idArray = ids.split(',').map(id => parseInt(id.trim(), 10)).filter(id => !isNaN(id));

  console.log('Parsed ID array:', idArray);

  if (idArray.length === 0) {
    reply.code(400).send({ error: 'No valid IDs provided' });
    return;
  }

  let dbType;
  switch (type.toLowerCase()) {
    case 'api':
      dbType = 'chain-api';
      break;
    case 'history':
      dbType = 'history-v1';
      break;
    case 'hyperion':
      dbType = 'hyperion-v2';
      break;
    case 'atomicassets':
      dbType = 'atomic-assets-api';
      break;
    default:
      dbType = type;
  }

  console.log('Transformed type:', dbType);

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
    ORDER BY vr.timestamp
  `;
  
  try {
    const { rows } = await db.query(query, [idArray, dbType]);
    console.log('Query result:', rows);

    if (rows.length === 0) {
      reply.code(404).send({ error: 'No results available for the given parameters' });
      return;
    }

    // Calculate daily uptime percentages
    const dailyUptime = rows.reduce((acc, row) => {
      const date = new Date(row.test_timestamp).toISOString().split('T')[0];
      if (!acc[date]) {
        acc[date] = {};
      }
      if (!acc[date][row.test_type]) {
        acc[date][row.test_type] = { total: 0, success: 0 };
      }
      acc[date][row.test_type].total++;
      if (row.is_successful) {
        acc[date][row.test_type].success++;
      }
      return acc;
    }, {});


    // Ensure all dates in the range are included
    const dates = [...new Set(rows.map(row => new Date(row.test_timestamp).toISOString().split('T')[0]))].sort();
    const startDate = new Date(dates[0]);
    const endDate = new Date(dates[dates.length - 1]);
    console.log('Date range:', startDate, 'to', endDate);

    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0];
      if (!dailyUptime[dateStr]) {
        dailyUptime[dateStr] = {};
      }
    }

    const uptimePercentages = Object.entries(dailyUptime).map(([date, types]) => {
      const percentages = {};
      for (const [testType, counts] of Object.entries(types)) {
        percentages[testType] = counts.total > 0 ? Math.round((counts.success / counts.total) * 100) : null;
      }
      return { date, percentages };
    });

    // Categorize results by endpoint and test_type
    const categorizedResults = rows.reduce((acc, row) => {
      const endpoint = row.ssl_endpoint || row.p2p_endpoint || 'unknown';
      if (!acc[endpoint]) {
        acc[endpoint] = {};
      }
      
      if (!acc[endpoint][row.test_type]) {
        acc[endpoint][row.test_type] = [];
      }
      
      acc[endpoint][row.test_type].push(row);
      return acc;
    }, {});

    return { 
      [type]: {
        daily_uptime: uptimePercentages,
        endpoints: categorizedResults
      }
    };
  } catch (error) {
    console.error('Database query error:', error);
    reply.code(500).send({ error: 'Internal server error', details: error.message });
  }
});

};

