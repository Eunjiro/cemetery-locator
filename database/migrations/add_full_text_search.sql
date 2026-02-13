-- Full-Text Search Enhancement for PAFM Locator
-- This migration adds PostgreSQL full-text search capabilities to improve search performance and accuracy

-- Prerequisites:
-- 1. PostgreSQL with fuzzystrmatch extension for Levenshtein distance (for "Did You Mean?" suggestions)
-- 2. PostgreSQL 9.6+ for GIN indexes

-- Step 1: Enable the fuzzystrmatch extension for Levenshtein distance calculations
-- This is used for "Did You Mean?" suggestions
CREATE EXTENSION IF NOT EXISTS fuzzystrmatch;

-- Step 2: Add a computed column for full-text search (optional but recommended)
-- This creates a tsvector column that combines first_name, middle_name, and last_name
ALTER TABLE deceased_persons 
ADD COLUMN IF NOT EXISTS search_vector tsvector
GENERATED ALWAYS AS (
  to_tsvector('english', 
    COALESCE(first_name, '') || ' ' || 
    COALESCE(middle_name, '') || ' ' || 
    COALESCE(last_name, '')
  )
) STORED;

-- Step 3: Create GIN index on the search_vector for fast full-text search
-- GIN (Generalized Inverted Index) is optimized for full-text search
CREATE INDEX IF NOT EXISTS deceased_search_vector_idx 
ON deceased_persons USING gin(search_vector);

-- Step 4: Create GIN index on name fields for faster LIKE queries
-- This improves performance of our existing LIKE-based searches
CREATE INDEX IF NOT EXISTS deceased_names_gin_idx 
ON deceased_persons USING gin(
  (LOWER(first_name) || ' ' || LOWER(COALESCE(middle_name, '')) || ' ' || LOWER(last_name)) gin_trgm_ops
);

-- Note: The above index requires pg_trgm extension
-- Enable it if you want trigram-based similarity matching:
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Step 5: Create indexes on date fields for faster date range queries
CREATE INDEX IF NOT EXISTS deceased_date_of_birth_idx ON deceased_persons(date_of_birth);
CREATE INDEX IF NOT EXISTS deceased_date_of_death_idx ON deceased_persons(date_of_death);

-- Step 6: Create composite indexes for common query patterns
-- Index for year of death queries
CREATE INDEX IF NOT EXISTS deceased_death_year_idx 
ON deceased_persons(EXTRACT(YEAR FROM date_of_death));

-- Index for year of birth queries
CREATE INDEX IF NOT EXISTS deceased_birth_year_idx 
ON deceased_persons(EXTRACT(YEAR FROM date_of_birth));

-- Index for month of death queries
CREATE INDEX IF NOT EXISTS deceased_death_month_idx 
ON deceased_persons(EXTRACT(MONTH FROM date_of_death));

-- Step 7: Update statistics for query planner
ANALYZE deceased_persons;

-- Verify indexes were created
SELECT 
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'deceased_persons'
ORDER BY indexname;

-- Example usage of full-text search (for reference):
-- SELECT * FROM deceased_persons
-- WHERE search_vector @@ plainto_tsquery('english', 'John Smith');

-- Example usage with ranking:
-- SELECT *, ts_rank(search_vector, plainto_tsquery('english', 'John Smith')) AS rank
-- FROM deceased_persons
-- WHERE search_vector @@ plainto_tsquery('english', 'John Smith')
-- ORDER BY rank DESC;
