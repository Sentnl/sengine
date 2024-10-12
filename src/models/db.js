import pg from 'pg';
import config from '../config.js';

const { Pool } = pg;

let pool;

export const setupDatabase = async () => {
  pool = new Pool(config.database);

  // Create tables if they don't exist
  await pool.query(`
    CREATE TABLE IF NOT EXISTS producers (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      website VARCHAR(255),
      chain_json_url VARCHAR(255),
      json_url VARCHAR(255),
      logo_svg TEXT,
      chain VARCHAR(50) NOT NULL,
      UNIQUE(name, chain)
    );

    CREATE TABLE IF NOT EXISTS producer_services (
      id SERIAL PRIMARY KEY,
      producer_id INTEGER REFERENCES producers(id),
      node_type TEXT[] NOT NULL,
      api_endpoint VARCHAR(255) NOT NULL DEFAULT '',
      ssl_endpoint VARCHAR(255),
      p2p_endpoint VARCHAR(255) NOT NULL DEFAULT '',
      features TEXT[],
      is_full BOOLEAN,
      location_name VARCHAR(100),
      location_country VARCHAR(2),
      location_latitude DECIMAL,
      location_longitude DECIMAL,
      UNIQUE (producer_id, api_endpoint, p2p_endpoint)
    );

    CREATE TABLE IF NOT EXISTS validate_services (
      id SERIAL PRIMARY KEY,
      producer_id INTEGER REFERENCES producers(id),
      chain VARCHAR(50) NOT NULL,
      test_type VARCHAR(100) NOT NULL,
      is_successful BOOLEAN NOT NULL,
      url_called VARCHAR(255),
      response_time INTEGER,
      status_code INTEGER,
      error_message TEXT,
      curl_command TEXT,
      timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      type VARCHAR(50) NOT NULL,
      request_type VARCHAR(10),
      payload TEXT,
      version VARCHAR(20)
    );

    CREATE TABLE IF NOT EXISTS validate_results (
      id SERIAL PRIMARY KEY,
      producer_id INTEGER REFERENCES producers(id),
      guild BOOLEAN,
      api BOOLEAN,
      history BOOLEAN,
      hyperion BOOLEAN,
      p2p BOOLEAN,
      timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
};

export const getDatabase = () => {
  if (!pool) {
    throw new Error('Database not initialized');
  }
  return pool;
};