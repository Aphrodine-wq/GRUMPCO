#!/bin/bash
#
# Vercel Deployment Setup Script
# This script helps set up the required environment for Vercel deployment
#

set -e

echo "================================"
echo "G-Rump Vercel Deployment Setup"
echo "================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check prerequisites
echo "Checking prerequisites..."

if ! command -v vercel &> /dev/null; then
    echo -e "${RED}❌ Vercel CLI not found. Install with: npm i -g vercel${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Vercel CLI found${NC}"

# Check if logged in
if ! vercel whoami &> /dev/null; then
    echo -e "${YELLOW}⚠ Not logged in to Vercel. Please run: vercel login${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Logged in to Vercel${NC}"

echo ""
echo "================================"
echo "Required Environment Variables"
echo "================================"
echo ""
echo "You'll need the following:"
echo ""
echo -e "${YELLOW}1. ANTHROPIC_API_KEY${NC}"
echo "   Get from: https://console.anthropic.com"
echo ""
echo -e "${YELLOW}2. Supabase Credentials${NC}"
echo "   - Create project at: https://supabase.com"
echo "   - Run backend/supabase-schema.sql in SQL Editor"
echo "   - Get URL and Service Role Key from Settings > API"
echo ""
echo -e "${YELLOW}3. QStash Credentials${NC}"
echo "   - Create at: https://upstash.com/qstash"
echo "   - Get Token and URL"
echo ""
echo -e "${YELLOW}4. Generate a JOB_WORKER_SECRET${NC}"
echo "   - Any random string (use: openssl rand -hex 32)"
echo ""

read -p "Press Enter to continue or Ctrl+C to cancel..."

echo ""
echo "================================"
echo "Setting Environment Variables"
echo "================================"
echo ""

# Function to add env var
add_env_var() {
    local name=$1
    local description=$2
    local required=$3
    
    echo ""
    if [ "$required" = "true" ]; then
        echo -e "${YELLOW}$name${NC} (REQUIRED)"
    else
        echo -e "$name (optional)"
    fi
    echo "   $description"
    
    if [ "$required" = "true" ]; then
        read -p "   Enter value: " value
        if [ -n "$value" ]; then
            vercel env add "$name" production <<< "$value"
            echo -e "   ${GREEN}✓ Set${NC}"
        else
            echo -e "   ${RED}⚠ Skipped (will need to set manually)${NC}"
        fi
    else
        read -p "   Enter value (or press Enter to skip): " value
        if [ -n "$value" ]; then
            vercel env add "$name" production <<< "$value"
            echo -e "   ${GREEN}✓ Set${NC}"
        fi
    fi
}

# Required variables
echo "Setting required environment variables..."
add_env_var "ANTHROPIC_API_KEY" "Your Anthropic API key" "true"
add_env_var "SUPABASE_URL" "Supabase project URL (e.g., https://xxxxx.supabase.co)" "true"
add_env_var "SUPABASE_SERVICE_KEY" "Supabase service_role key" "true"
add_env_var "QSTASH_TOKEN" "QStash token from Upstash" "true"
add_env_var "QSTASH_URL" "QStash URL (default: https://qstash.upstash.io/v2/publish/)" "true"
add_env_var "JOB_WORKER_SECRET" "Random secret for job worker authentication" "true"

# Set defaults
echo ""
echo "Setting default values..."
vercel env add NODE_ENV production <<< "production"
vercel env add SERVERLESS_MODE production <<< "vercel"
vercel env add EVENTS_MODE production <<< "poll"
vercel env add BLOCK_SUSPICIOUS_PROMPTS production <<< "true"
vercel env add REQUIRE_AUTH_FOR_API production <<< "true"

echo -e "${GREEN}✓ Set NODE_ENV=production${NC}"
echo -e "${GREEN}✓ Set SERVERLESS_MODE=vercel${NC}"
echo -e "${GREEN}✓ Set EVENTS_MODE=poll${NC}"
echo -e "${GREEN}✓ Set BLOCK_SUSPICIOUS_PROMPTS=true${NC}"
echo -e "${GREEN}✓ Set REQUIRE_AUTH_FOR_API=true${NC}"

echo ""
echo "================================"
echo "Setup Complete!"
echo "================================"
echo ""
echo -e "${GREEN}✓ Environment variables configured${NC}"
echo ""
echo "Next steps:"
echo "  1. Set PUBLIC_BASE_URL after first deploy:"
echo "     vercel env add PUBLIC_BASE_URL production"
echo "     (Enter your backend URL, e.g., https://your-app.vercel.app)"
echo ""
echo "  2. Deploy the backend:"
echo "     vercel --prod"
echo ""
echo "  3. Deploy the frontend (see docs/THINGS_TO_DO.md)"
echo ""
echo "For troubleshooting, see:"
echo "  - backend/DEPLOY_VERCEL.md"
echo "  - docs/PRODUCTION_CHECKLIST.md"
echo ""
