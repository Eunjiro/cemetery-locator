/**
 * Simple database connection test
 */

// Load environment variables
import * as dotenv from 'dotenv';
import { resolve } from 'path';

// Try to load .env.local
const envPath = resolve(process.cwd(), '.env.local');
console.log(`Loading environment from: ${envPath}`);
const result = dotenv.config({ path: envPath });

if (result.error) {
  console.error('❌ Error loading .env.local:', result.error);
} else {
  console.log('✅ Environment file loaded');
}

console.log('\nDatabase Configuration:');
console.log('DATABASE_URL:', process.env.DATABASE_URL ? '✅ Set' : '❌ Not set');
console.log('POSTGRES_URL:', process.env.POSTGRES_URL ? '✅ Set' : '❌ Not set');

if (process.env.DATABASE_URL) {
  // Mask password but show connection string structure
  const url = process.env.DATABASE_URL;
  const masked = url.replace(/(postgresql:\/\/[^:]+:)([^@]+)(@.+)/, '$1***$3');
  console.log('Connection string format:', masked);
}

// Try to connect
import pool from '../lib/db';

async function testConnection() {
  try {
    console.log('\n🔌 Testing database connection...');
    const result = await pool.query('SELECT NOW() as time, version() as version');
    console.log('✅ Connection successful!');
    console.log('   Server time:', result.rows[0].time);
    console.log('   PostgreSQL:', result.rows[0].version.split(',')[0]);
    
    // Test if deceased_persons table exists
    const tableCheck = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'deceased_persons'
    `);
    
    if (tableCheck.rows.length > 0) {
      console.log('✅ deceased_persons table exists');
      
      // Get record count
      const count = await pool.query('SELECT COUNT(*) as total FROM deceased_persons');
      console.log(`   Total records: ${count.rows[0].total}`);
    } else {
      console.log('❌ deceased_persons table not found');
    }
    
  } catch (error: any) {
    console.error('❌ Connection failed:', error.message);
    console.error('\nPossible issues:');
    console.error('1. Check your .env.local file exists and has DATABASE_URL or POSTGRES_URL');
    console.error('2. Verify the connection string format: postgresql://user:password@host:port/database');
    console.error('3. Ensure PostgreSQL server is running');
    console.error('4. Check username and password are correct');
  } finally {
    await pool.end();
  }
}

testConnection();
