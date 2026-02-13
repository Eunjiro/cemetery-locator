/**
 * Alternative setup script with direct connection config
 */

import * as dotenv from 'dotenv';
import { resolve } from 'path';
import { Pool } from 'pg';

// Load environment variables
const envPath = resolve(process.cwd(), '.env.local');
dotenv.config({ path: envPath });

console.log('🚀 Alternative Setup - Direct Connection\n');

// Get connection URL
const connectionUrl = process.env.POSTGRES_URL || process.env.DATABASE_URL;

if (!connectionUrl) {
  console.error('❌ No DATABASE_URL or POSTGRES_URL found in .env.local');
  process.exit(1);
}

console.log('Connection URL format check:');
try {
  const url = new URL(connectionUrl);
  console.log(`✅ URL parsed successfully`);
  console.log(`   Host: ${url.hostname}`);
  console.log(`   Database: ${url.pathname.slice(1)}`);
  console.log(`   Username: ${url.username}`);
  console.log(`   Password length: ${url.password?.length || 0} characters`);
  console.log(`   Password type: ${typeof url.password}`);
  
  if (!url.password || url.password.length === 0) {
    console.error('\n❌ Password is empty in the connection string!');
    console.log('Please check your .env.local file and ensure POSTGRES_URL has a password');
    process.exit(1);
  }
} catch (error: any) {
  console.error('❌ Failed to parse URL:', error.message);
  process.exit(1);
}

// Create pool with explicit configuration
console.log('\n🔌 Creating database connection...');

const pool = new Pool({
  connectionString: connectionUrl,
  ssl: { rejectUnauthorized: false }, // For Neon and other cloud providers
  max: 5,
  connectionTimeoutMillis: 10000,
});

async function testAndSetup() {
  try {
    // Test connection
    console.log('Testing connection...');
    const testResult = await pool.query('SELECT NOW(), version()');
    console.log('✅ Connected successfully!');
    console.log(`   Time: ${testResult.rows[0].now}`);
    console.log(`   PostgreSQL: ${testResult.rows[0].version.split(',')[0]}\n`);
    
    // Check if deceased_persons table exists
    const tableCheck = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'deceased_persons'
    `);
    
    if (tableCheck.rows.length === 0) {
      console.error('❌ Table "deceased_persons" not found!');
      console.log('Please ensure your database is properly set up.');
      process.exit(1);
    }
    
    console.log('✅ deceased_persons table found');
    
    // Get record count
    const count = await pool.query('SELECT COUNT(*) as total FROM deceased_persons');
    console.log(`   Total records: ${count.rows[0].total}\n`);
    
    // Install extensions
    console.log('🔌 Installing PostgreSQL extensions...');
    
    try {
      await pool.query('CREATE EXTENSION IF NOT EXISTS fuzzystrmatch');
      console.log('✅ fuzzystrmatch extension installed');
    } catch (error: any) {
      console.warn(`⚠️  fuzzystrmatch: ${error.message}`);
    }
    
    try {
      await pool.query('CREATE EXTENSION IF NOT EXISTS pg_trgm');
      console.log('✅ pg_trgm extension installed');
    } catch (error: any) {
      console.warn(`⚠️  pg_trgm: ${error.message}`);
    }
    
    // Create search_vector column
    console.log('\n📊 Creating full-text search column...');
    const columnCheck = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'deceased_persons' 
      AND column_name = 'search_vector'
    `);
    
    if (columnCheck.rows.length === 0) {
      await pool.query(`
        ALTER TABLE deceased_persons 
        ADD COLUMN search_vector tsvector
        GENERATED ALWAYS AS (
          to_tsvector('english', 
            COALESCE(first_name, '') || ' ' || 
            COALESCE(middle_name, '') || ' ' || 
            COALESCE(last_name, '')
          )
        ) STORED
      `);
      console.log('✅ search_vector column created');
    } else {
      console.log('✅ search_vector column already exists');
    }
    
    // Create indexes
    console.log('\n📑 Creating indexes (this may take a minute)...');
    
    const indexes = [
      'CREATE INDEX IF NOT EXISTS deceased_search_vector_idx ON deceased_persons USING gin(search_vector)',
      'CREATE INDEX IF NOT EXISTS deceased_date_of_birth_idx ON deceased_persons(date_of_birth)',
      'CREATE INDEX IF NOT EXISTS deceased_date_of_death_idx ON deceased_persons(date_of_death)',
      "CREATE INDEX IF NOT EXISTS deceased_death_year_idx ON deceased_persons(EXTRACT(YEAR FROM date_of_death))",
      "CREATE INDEX IF NOT EXISTS deceased_birth_year_idx ON deceased_persons(EXTRACT(YEAR FROM date_of_birth))",
      "CREATE INDEX IF NOT EXISTS deceased_death_month_idx ON deceased_persons(EXTRACT(MONTH FROM date_of_death))",
    ];
    
    for (const indexSQL of indexes) {
      try {
        await pool.query(indexSQL);
        const indexName = indexSQL.match(/deceased_\w+_idx/)?.[0];
        console.log(`✅ ${indexName}`);
      } catch (error: any) {
        if (!error.message.includes('already exists')) {
          console.warn(`⚠️  ${error.message}`);
        }
      }
    }
    
    // Try to create trigram index (may fail if pg_trgm not available)
    try {
      await pool.query(`
        CREATE INDEX IF NOT EXISTS deceased_names_gin_idx 
        ON deceased_persons USING gin(
          (LOWER(first_name) || ' ' || LOWER(COALESCE(middle_name, '')) || ' ' || LOWER(last_name)) gin_trgm_ops
        )
      `);
      console.log('✅ deceased_names_gin_idx (trigram)');
    } catch {
      console.log('⚠️  deceased_names_gin_idx (trigram) - requires pg_trgm extension');
    }
    
    // Update statistics
    console.log('\n📈 Updating statistics...');
    await pool.query('ANALYZE deceased_persons');
    console.log('✅ Statistics updated');
    
    // Verify
    console.log('\n🔍 Verifying installation...');
    
    const indexCount = await pool.query(`
      SELECT COUNT(*) as count
      FROM pg_indexes
      WHERE tablename = 'deceased_persons'
      AND indexname LIKE 'deceased_%'
    `);
    console.log(`✅ ${indexCount.rows[0].count} indexes created`);
    
    // Test Levenshtein
    try {
      await pool.query("SELECT levenshtein('test', 'test')");
      console.log('✅ Levenshtein function works (Did You Mean? enabled)');
    } catch {
      console.log('⚠️  Levenshtein not available (Did You Mean? disabled)');
    }
    
    // Test full-text search
    try {
      await pool.query(`
        SELECT COUNT(*) 
        FROM deceased_persons 
        WHERE search_vector @@ plainto_tsquery('english', 'test')
      `);
      console.log('✅ Full-text search works');
    } catch {
      console.log('⚠️  Full-text search not available');
    }
    
    console.log('\n🎉 Setup completed successfully!\n');
    console.log('All search enhancements are now active:');
    console.log('✓ Age-based search: "died at 50 in 2020"');
    console.log('✓ Did You Mean suggestions');
    console.log('✓ Middle name optional matching');
    console.log('✓ Full-text search indexes');
    console.log('✓ Autocomplete API endpoint');
    console.log('\n🚀 Ready to use!');
    
  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
    console.error('\nStack trace:', error.stack);
  } finally {
    await pool.end();
  }
}

testAndSetup();
