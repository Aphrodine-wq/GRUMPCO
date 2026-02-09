#!/bin/bash
# G-Rump Demo Script
# Quick demonstration of the SHIP workflow with mock data

set -e

echo "🚀 G-Rump Demo - SHIP Workflow"
echo "==============================="
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}Step 1: Starting services...${NC}"
echo "This would normally start the backend and frontend servers."
echo "For demo purposes, we'll simulate the workflow."
echo ""

echo -e "${BLUE}Step 2: Creating a new project...${NC}"
echo "Project: Task Management API"
echo "Description: A RESTful API for managing tasks with authentication"
echo ""

echo -e "${YELLOW}AI Analysis Phase:${NC}"
echo "  ✓ Parsing intent: 'Build a task management API with Node.js'"
echo "  ✓ Extracted features: authentication, CRUD operations, API endpoints"
echo "  ✓ Tech stack detected: Node.js, Express, PostgreSQL"
echo "  ✓ Architecture pattern: REST API with layered architecture"
echo ""

echo -e "${YELLOW}Architecture Generation:${NC}"
echo "  ✓ Generated system architecture diagram"
echo "  ✓ Defined data models: User, Task, Project"
echo "  ✓ API endpoints designed: 12 endpoints"
echo "  ✓ Database schema: 3 tables with relationships"
echo ""

echo -e "${YELLOW}PRD Generation:${NC}"
echo "  ✓ Product Requirements Document created"
echo "  ✓ User stories: 8 stories defined"
echo "  ✓ Acceptance criteria: 24 criteria specified"
echo ""

echo -e "${YELLOW}Code Generation:${NC}"
echo "  ✓ Generated Express server with middleware"
echo "  ✓ Created authentication controllers"
echo "  ✓ Implemented CRUD operations for tasks"
echo "  ✓ Added input validation and error handling"
echo "  ✓ Generated 15 files total"
echo ""

echo -e "${GREEN}🎉 Demo Complete!${NC}"
echo ""
echo "The SHIP workflow has successfully:"
echo "  1. Analyzed your intent"
echo "  2. Generated architecture"
echo "  3. Created PRD"
echo "  4. Generated production-ready code"
echo ""
echo "To run this for real:"
echo "  npm run dev"
echo "  Then open http://localhost:5173 and click 'SHIP'"
echo ""
