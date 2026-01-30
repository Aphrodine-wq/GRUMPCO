# G-Rump v3.0.0 Release Notes

## The Grumpiest AI Development Platform

G-Rump is an AI-powered development platform with the SHIP workflow (Design → Spec → Plan → Code), featuring NVIDIA NIM integration with Kimi K2.5.

---

## Highlights

### 43 CLI Commands
Including 23 funny/therapeutic commands for developer wellbeing:
- `grump fortune` - Programming fortunes with sass
- `grump imposter` - Imposter syndrome therapy
- `grump friday` - Friday deploy detector
- `grump stackoverflow` - Simulate the SO experience
- `grump techdebt` - Technical debt calculator
- `grump meeting` - Meeting survival guide
- And many more!

### Multi-Provider AI Support
- **NVIDIA NIM** with Kimi K2.5 (recommended)
- **OpenRouter** for multi-model access
- **Groq** for fast inference
- **Together AI** for open source models
- **Ollama** for local models

### SHIP Workflow
Complete AI-assisted development pipeline:
1. **Design** - Architecture generation
2. **Spec** - PRD and requirements
3. **Plan** - Task breakdown
4. **Code** - Code generation with streaming

### Security Features
- Prompt injection detection
- Output filtering
- Rate limiting
- Webhook signature verification

---

## Installation

### CLI (npm)
```bash
npm install -g grump-cli

# Or run without installing
npx grump-cli fortune
```

### Self-Hosted
```bash
git clone https://github.com/Aphrodine-wq/G-rump.com.git
cd G-rump.com
npm install
npm run dev
```

### Vercel Deployment
```bash
npm i -g vercel
vercel --prod
```

---

## What's New in v3.0.0

### New Features
- 10 new CLI commands (overtime, meeting, stackoverflow, fml, intern, legacy, yeet, techdebt, friday, imposter)
- Enhanced compiler with 10 features (incremental, watch, analyzer, DCE, parallel, transforms, sourcemaps, hot reload)
- Agent TODO system for task tracking
- Intent optimizer for better AI prompts
- Hybrid compiler for multiple output formats

### Improvements
- 551 passing tests (100% pass rate)
- Purple branding throughout (#6B46C1, #8B5CF6, #A855F7)
- Better error handling and recovery
- Improved streaming performance

### Fixes
- LLM Gateway mock isolation for tests
- Webhook service reliability
- TypeScript strict mode compliance

---

## Requirements

- Node.js 20+
- One AI provider API key (NVIDIA NIM, OpenRouter, Groq, or Together)
- For production: Vercel account + Supabase

---

## Quick Start

1. Get an API key from https://build.nvidia.com
2. Set environment variable: `NVIDIA_NIM_API_KEY=nvapi-xxx`
3. Run: `npx grump-cli ship "Build a todo app"`

---

## Documentation

- [Getting Started](docs/GETTING_STARTED.md)
- [Setup Guide](docs/SETUP.md)
- [Release & Signup Guide](docs/RELEASE_SIGNUP_GUIDE.md)
- [Production Checklist](docs/PRODUCTION_CHECKLIST.md)

---

## Contributors

Built with purple passion by the G-Rump team.

---

## License

MIT
