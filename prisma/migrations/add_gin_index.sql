-- This migration adds a GIN index for the searchTags array field
-- GIN (Generalized Inverted Index) is optimal for array/JSON indexing in PostgreSQL

-- Create GIN index on searchTags array for efficient array searches
CREATE INDEX IF NOT EXISTS "Listing_searchTags_idx" ON "Listing" USING GIN ("searchTags");

-- This enables fast queries like:
-- WHERE 'electronics' = ANY(searchTags)
-- WHERE searchTags @> ARRAY['electronics', 'gadgets']
-- WHERE searchTags && ARRAY['electronics', 'computers']