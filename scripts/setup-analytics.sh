#!/bin/bash
#
# Analytics Setup Script
# 
# This script helps set up PostHog analytics for your G-Rump project
#

set -e

echo "🔧 G-Rump Analytics Setup"
echo "=========================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if running from correct directory
if [ ! -f "package.json" ] || [ ! -d "backend" ] || [ ! -d "frontend" ]; then
    echo -e "${RED}Error: Please run this script from the project root directory${NC}"
    exit 1
fi

echo "Step 1: Installing dependencies..."
echo "-----------------------------------"

# Backend dependencies
echo "Installing backend dependencies..."
cd backend
npm install posthog-node uuid --save
npm install @types/uuid --save-dev

# Frontend dependencies
echo "Installing frontend dependencies..."
cd ../frontend
npm install posthog-js --save

cd ..

echo ""
echo -e "${GREEN}✓ Dependencies installed${NC}"
echo ""

echo "Step 2: Configuration"
echo "---------------------"
echo ""
echo "To complete setup, you need a PostHog API key."
echo ""
echo "1. Go to https://posthog.com/ and sign up for a free account"
echo "2. Create a new project"
echo "3. Go to Project Settings → API Keys"
echo "4. Copy your project API key (starts with 'phc_')"
echo ""

read -p "Enter your PostHog API key: " POSTHOG_API_KEY

if [ -z "$POSTHOG_API_KEY" ]; then
    echo -e "${YELLOW}⚠ No API key provided. You'll need to manually add it to .env files${NC}"
else
    # Update backend .env
    if [ -f "backend/.env" ]; then
        if grep -q "POSTHOG_API_KEY" backend/.env; then
            sed -i "s/POSTHOG_API_KEY=.*/POSTHOG_API_KEY=$POSTHOG_API_KEY/" backend/.env
        else
            echo "" >> backend/.env
            echo "# PostHog Analytics" >> backend/.env
            echo "POSTHOG_API_KEY=$POSTHOG_API_KEY" >> backend/.env
            echo "POSTHOG_HOST=https://us.i.posthog.com" >> backend/.env
            echo "ANALYTICS_ENABLED=true" >> backend/.env
        fi
        echo -e "${GREEN}✓ Backend .env updated${NC}"
    else
        echo -e "${YELLOW}⚠ backend/.env not found. Please create it manually${NC}"
    fi
    
    # Update frontend .env
    if [ -f "frontend/.env" ]; then
        if grep -q "VITE_POSTHOG_API_KEY" frontend/.env; then
            sed -i "s/VITE_POSTHOG_API_KEY=.*/VITE_POSTHOG_API_KEY=$POSTHOG_API_KEY/" frontend/.env
        else
            echo "" >> frontend/.env
            echo "# PostHog Analytics" >> frontend/.env
            echo "VITE_POSTHOG_API_KEY=$POSTHOG_API_KEY" >> frontend/.env
            echo "VITE_POSTHOG_HOST=https://us.i.posthog.com" >> frontend/.env
        fi
        echo -e "${GREEN}✓ Frontend .env updated${NC}"
    else
        echo -e "${YELLOW}⚠ frontend/.env not found. Please create it manually${NC}"
    fi
fi

echo ""
echo "Step 3: Verifying setup..."
echo "--------------------------"

# Check if analytics files exist
FILES=(
    "backend/src/services/analytics.ts"
    "backend/src/middleware/analytics.ts"
    "backend/src/analytics/index.ts"
    "frontend/src/lib/analytics.ts"
    "frontend/src/components/Analytics.svelte"
    "frontend/src/components/TrackButton.svelte"
    "frontend/src/components/TrackFeature.svelte"
)

ALL_EXIST=true
for file in "${FILES[@]}"; do
    if [ -f "$file" ]; then
        echo -e "${GREEN}✓${NC} $file"
    else
        echo -e "${RED}✗${NC} $file (missing)"
        ALL_EXIST=false
    fi
done

echo ""
if [ "$ALL_EXIST" = true ]; then
    echo -e "${GREEN}✓ All analytics files are in place${NC}"
else
    echo -e "${YELLOW}⚠ Some files are missing. Please check the setup${NC}"
fi

echo ""
echo "Step 4: Next steps"
echo "------------------"
echo ""
echo "1. Import the Analytics component in your frontend root layout:"
echo ""
echo "   <script>"
echo "     import { Analytics } from '\$components';"
echo "   </script>"
echo ""
echo "   <Analytics />"
echo ""
echo "2. Add the analytics middleware to your backend:"
echo ""
echo "   import { analyticsMiddleware } from './middleware/analytics';"
echo "   app.use(analyticsMiddleware());"
echo ""
echo "3. Start tracking events in your services (see docs/analytics/integration-examples.ts)"
echo ""
echo "4. Set up your PostHog dashboards:"
echo "   - Go to https://app.posthog.com"
echo "   - Import the dashboard templates from docs/analytics/dashboards.json"
echo ""
echo "5. Read the full documentation:"
echo "   docs/analytics/README.md"
echo ""

echo -e "${GREEN}✓ Setup complete!${NC}"
echo ""
