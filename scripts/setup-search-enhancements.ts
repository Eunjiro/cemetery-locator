/**
 * Setup Script for Search Enhancements
 * This script will:
 * 1. Test database connection
 * 2. Enable required PostgreSQL extensions
 * 3. Create full-text search indexes
 * 4. Verify installation
 */

// Load environment variables FIRST
import * as dotenv from 'dotenv';
import { resolve } from 'path';

const envPath = resolve(process.cwd(), '.env.local');
dotenv.config({ path: envPath });

// Now import pool (after env vars are loaded)
import pool from '../lib/db';
import * as fs from 'fs';
import * as path from 'path';

async function setupSearchEnhancements() {
  console.log('🚀 Starting Search Enhancements Setup...\n');

  try {
    // Step 1: Test Database Connection
    console.log('📡 Step 1: Testing database connection...');
    const connectionTest = await pool.query('SELECT NOW(), version()');
    console.log('✅ Database connected successfully');
    console.log(`   Server time: ${connectionTest.rows[0].now}`);
    console.log(`   PostgreSQL version: ${connectionTest.rows[0].version.split(',')[0]}\n`);

    // Step 2: Enable Required Extensions
    console.log('🔌 Step 2: Enabling PostgreSQL extensions...');
    
    try {
      await pool.query('CREATE EXTENSION IF NOT EXISTS fuzzystrmatch');
      console.log('✅ fuzzystrmatch extension enabled (for "Did You Mean?" suggestions)');
    } catch (error: any) {
      console.warn('⚠️  fuzzystrmatch extension failed:', error.message);
      console.warn('   "Did You Mean?" suggestions may not work');
    }

    try {
      await pool.query('CREATE EXTENSION IF NOT EXISTS pg_trgm');
      console.log('✅ pg_trgm extension enabled (for trigram matching)');
    } catch (error: any) {
      console.warn('⚠️  pg_trgm extension failed:', error.message);
      console.warn('   Trigram-based matching may not work');
    }

    // Verify extensions
    const extResult = await pool.query(
      "SELECT extname FROM pg_extension WHERE extname IN ('fuzzystrmatch', 'pg_trgm')"
    );
    console.log(`   Extensions installed: ${extResult.rows.map(r => r.extname).join(', ')}\n`);

    // Step 3: Create Full-Text Search Indexes
    console.log('📊 Step 3: Creating full-text search indexes...');
    
    // Check if search_vector column already exists
    const columnCheck = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'deceased_persons' 
      AND column_name = 'search_vector'
    `);

    if (columnCheck.rows.length === 0) {
      console.log('   Creating search_vector column...');
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
    console.log('   Creating indexes (this may take a few minutes)...');

    const indexes = [
      {
        name: 'deceased_search_vector_idx',
        sql: 'CREATE INDEX IF NOT EXISTS deceased_search_vector_idx ON deceased_persons USING gin(search_vector)',
        description: 'Full-text search vector index'
      },
      {
        name: 'deceased_names_gin_idx',
        sql: `CREATE INDEX IF NOT EXISTS deceased_names_gin_idx ON deceased_persons USING gin((LOWER(first_name) || ' ' || LOWER(COALESCE(middle_name, '')) || ' ' || LOWER(last_name)) gin_trgm_ops)`,
        description: 'Trigram-based name matching index'
      },
      {
        name: 'deceased_date_of_birth_idx',
        sql: 'CREATE INDEX IF NOT EXISTS deceased_date_of_birth_idx ON deceased_persons(date_of_birth)',
        description: 'Birth date index'
      },
      {
        name: 'deceased_date_of_death_idx',
        sql: 'CREATE INDEX IF NOT EXISTS deceased_date_of_death_idx ON deceased_persons(date_of_death)',
        description: 'Death date index'
      },
      {
        name: 'deceased_death_year_idx',
        sql: 'CREATE INDEX IF NOT EXISTS deceased_death_year_idx ON deceased_persons(EXTRACT(YEAR FROM date_of_death))',
        description: 'Death year extraction index'
      },
      {
        name: 'deceased_birth_year_idx',
        sql: 'CREATE INDEX IF NOT EXISTS deceased_birth_year_idx ON deceased_persons(EXTRACT(YEAR FROM date_of_birth))',
        description: 'Birth year extraction index'
      },
      {
        name: 'deceased_death_month_idx',
        sql: 'CREATE INDEX IF NOT EXISTS deceased_death_month_idx ON deceased_persons(EXTRACT(MONTH FROM date_of_death))',
        description: 'Death month extraction index'
      }
    ];

    for (const index of indexes) {
      try {
        await pool.query(index.sql);
        console.log(`✅ ${index.description}`);
      } catch (error: any) {
        if (error.message.includes('already exists')) {
          console.log(`✅ ${index.description} (already exists)`);
        } else {
          console.warn(`⚠️  ${index.description} failed: ${error.message}`);
        }
      }
    }

    // Step 4: Update Statistics
    console.log('\n📈 Step 4: Updating query planner statistics...');
    await pool.query('ANALYZE deceased_persons');
    console.log('✅ Statistics updated\n');

    // Step 5: Verify Installation
    console.log('🔍 Step 5: Verifying installation...');
    
    const indexCount = await pool.query(`
      SELECT COUNT(*) as count
      FROM pg_indexes
      WHERE tablename = 'deceased_persons'
      AND indexname LIKE 'deceased_%'
    `);
    console.log(`✅ Found ${indexCount.rows[0].count} indexes on deceased_persons table`);

    // Test Levenshtein (for Did You Mean?)
    try {
      const levResult = await pool.query("SELECT levenshtein('test', 'test') as distance");
      console.log('✅ Levenshtein distance function works');
    } catch {
      console.warn('⚠️  Levenshtein function not available (Did You Mean? suggestions disabled)');
    }

    // Test full-text search
    try {
      const ftsResult = await pool.query(`
        SELECT COUNT(*) as count
        FROM deceased_persons
        WHERE search_vector @@ plainto_tsquery('english', 'test')
      `);
      console.log('✅ Full-text search works');
    } catch (error: any) {
      console.warn('⚠️  Full-text search test failed:', error.message);
    }

    // Show total record count
    const countResult = await pool.query('SELECT COUNT(*) as total FROM deceased_persons');
    console.log(`📊 Total records in database: ${countResult.rows[0].total}\n`);

    console.log('🎉 Setup completed successfully!\n');
    console.log('Next steps:');
    console.log('1. Test age-based search: "died at 50 in 2020"');
    console.log('2. Test Did You Mean: search for a misspelled name');
    console.log('3. Test middle name optional: "John Smith" finds "John Michael Smith"');
    console.log('4. Test autocomplete API: GET /api/deceased/autocomplete?q=John');
    console.log('\nAll search enhancements are now active! 🚀\n');

  } catch (error: any) {
    console.error('❌ Setup failed:', error.message);
    console.error('\nTroubleshooting:');
    console.error('1. Check your database connection (POSTGRES_URL or DATABASE_URL in .env.local)');
    console.error('2. Ensure you have PostgreSQL admin permissions');
    console.error('3. Verify your PostgreSQL version is 9.6 or higher');
    console.error('4. Check database logs for more details\n');
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run the setup
setupSearchEnhancements().catch(console.error);
