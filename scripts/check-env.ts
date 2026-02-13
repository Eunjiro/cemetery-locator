/**
 * Check and validate .env.local configuration
 */

import * as dotenv from 'dotenv';
import { resolve } from 'path';
import * as fs from 'fs';

const envPath = resolve(process.cwd(), '.env.local');

console.log('🔍 Checking .env.local configuration...\n');

if (!fs.existsSync(envPath)) {
  console.error('❌ .env.local file not found!');
  console.log('\nPlease create .env.local with your database connection:');
  console.log('DATABASE_URL=postgresql://user:password@host:port/database');
  process.exit(1);
}

// Load env file
dotenv.config({ path: envPath });

console.log('Environment Variables Status:');
console.log('─'.repeat(50));

const hasDatabase = !!process.env.DATABASE_URL;
const hasPostgres = !!process.env.POSTGRES_URL;

console.log(`DATABASE_URL: ${hasDatabase ? '✅ Set' : '❌ Not set'}`);
console.log(`POSTGRES_URL: ${hasPostgres ? '✅ Set' : '❌ Not set'}`);

if (!hasDatabase && !hasPostgres) {
  console.error('\n❌ Neither DATABASE_URL nor POSTGRES_URL is set!');
  process.exit(1);
}

// Validate connection string format
const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;

if (url) {
  console.log('\n📝 Connection String Analysis:');
  console.log('─'.repeat(50));
  
  try {
    // Parse URL
    const urlObj = new URL(url);
    
    console.log(`Protocol: ${urlObj.protocol === 'postgresql:' || urlObj.protocol === 'postgres:' ? '✅' : '❌'} ${urlObj.protocol}`);
    console.log(`Host: ${urlObj.hostname || '❌ Missing'}`);
    console.log(`Port: ${urlObj.port || '❌ Missing (will use default 5432)'}`);
    console.log(`Database: ${urlObj.pathname.slice(1) || '❌ Missing'}`);
    console.log(`Username: ${urlObj.username || '❌ Missing'}`);
    console.log(`Password: ${urlObj.password ? '✅ Set (***masked***)' : '❌ Missing or empty'}`);
    
    // Check for common issues
    console.log('\n🔧 Validation:');
    console.log('─'.repeat(50));
    
    let hasErrors = false;
    
    if (!urlObj.username) {
      console.log('❌ Username is missing');
      hasErrors = true;
    }
    
    if (!urlObj.password || urlObj.password.trim() === '') {
      console.log('❌ Password is missing or empty - THIS IS YOUR ISSUE!');
      console.log('   Your connection string has an empty password field');
      hasErrors = true;
    }
    
    if (!urlObj.hostname) {
      console.log('❌ Hostname is missing');
      hasErrors = true;
    }
    
    if (!urlObj.pathname || urlObj.pathname === '/') {
      console.log('❌ Database name is missing');
      hasErrors = true;
    }
    
    if (!hasErrors) {
      console.log('✅ Connection string format looks correct!');
    } else {
      console.log('\n💡 Fix your .env.local file with the correct format:');
      console.log('DATABASE_URL=postgresql://username:password@host:port/database');
      console.log('\nExample:');
      console.log('DATABASE_URL=postgresql://myuser:mypassword@localhost:5432/pafm_locator');
      console.log('\nOr for Vercel Postgres:');
      console.log('POSTGRES_URL="postgres://default:************@ep-***.region.aws.neon.tech/verceldb?sslmode=require"');
      console.log('\n⚠️  Make sure the password field is not empty!');
    }
    
    // Show search params
    if (urlObj.searchParams.toString()) {
      console.log(`\nQuery params: ${urlObj.searchParams.toString()}`);
    }
    
  } catch (error: any) {
    console.error(`\n❌ Invalid URL format: ${error.message}`);
    console.log('\nExpected format:');
    console.log('DATABASE_URL=postgresql://username:password@host:port/database');
  }
}

console.log('\n' + '─'.repeat(50));
console.log('Next Steps:');
console.log('1. Fix your .env.local file with the correct database credentials');
console.log('2. Make sure password is not empty');
console.log('3. Run: npm run test-db');
console.log('4. Once connection works, run: npm run setup-search');
