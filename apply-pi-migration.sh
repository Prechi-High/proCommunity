#!/bin/bash
# Apply Product Intelligence Organisation migration

# Check if SUPABASE_ACCESS_TOKEN is set
if [ -z "$SUPABASE_ACCESS_TOKEN" ]; then
    echo "Error: SUPABASE_ACCESS_TOKEN not set"
    echo "Set it in your .env.local file or export it"
    exit 1
fi

# Supabase project config
PROJECT_REF="aqdptcuwpneuyzjavjak"
MIGRATION_FILE="supabase/migrations/0012_product_intelligence_core.sql"

# Read migration SQL
if [ ! -f "$MIGRATION_FILE" ]; then
    echo "Error: Migration file not found: $MIGRATION_FILE"
    exit 1
fi

MIGRATION_SQL=$(cat "$MIGRATION_FILE")

# Apply migration using Supabase API
echo "Applying Product Intelligence Organisation migration..."

RESPONSE=$(curl -s -X POST "https://api.supabase.com/v1/projects/$PROJECT_REF/db/execute" \
    -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"sql\": \"$MIGRATION_SQL\"}" 2>&1)

# Check response
if echo "$RESPONSE" | grep -q "error"; then
    echo "Migration failed:"
    echo "$RESPONSE"
    exit 1
fi

echo "Migration applied successfully!"
echo "Tables created:"
echo "  - categories"
echo "  - intelligence_templates"
echo "  - intelligence_fields"
echo "  - intelligence_claims"
echo "  - evidence"
echo "  - claim_evidence"
echo "  - product_images"
echo "  - product_prices"
echo "  - intelligence_jobs"
echo "  - refresh_policies"
echo "  - category_proposals"
