# G-Rump Platform Overview

## 1. Project Identity & Mission
**G-Rump** is a cutting-edge, agentic AI coding platform designed to architect, generate, and maintain complex software systems. Unlike simple code completion tools, G-Rump operates as a full-stack software engineer, capable of understanding high-level intent, designing system architectures (via Mermaid diagrams), generating Product Requirement Documents (PRDs), and executing code implementation through direct file system manipulation.

The platform is wrapped in a **Tauri** desktop application for deep system integration (CLI access, file I/O) while maintaining a premium, modern web-based UI built with **Svelte 5**.

---

## 2. Technology Stack

### **Frontend (`/frontend`)**
*   **Framework**: Svelte 5 (Runes mode for reactive state management).
*   **Build Tool**: Vite (Lightning-fast HMR).
*   **Styling**: 
    *   **Tailwind CSS**: Utility-first styling.
    *   **Custom Design System**: "Premium Dark" theme featuring Aurora gradients, Glassmorphism (`backdrop-filter: blur`), and semantic color tokens.
    *   **Fonts**: Inter (Sans) and JetBrains Mono (Code/Monospace).
*   **State Management**: Svelte Stores (`sessionsStore`, `chatModeStore`, `workflowStore`).
*   **Visualization**: Mermaid.js for real-time architecture diagrams.
*   **Desktop Wrapper**: Tauri v2 (Rust-based) for native capabilities.

### **Backend (`/backend`)**
*   **Runtime**: Node.js (v20+) with Express.
*   **Language**: TypeScript.
*   **AI Integration**: Anthropic Claude 3.5 Sonnet (via `@anthropic-ai/sdk`).
*   **Database & Storage**:
    *   **PostgreSQL**: Primary data store (via Supabase).
    *   **Redis**: Caching and job queues (`bullmq`).
*   **Tools & Utilities**:
    *   `fast-xml-parser`: For structured output parsing.
    *   `dockerode`: For auditing and managing Docker environments.
    *   `zod`: Runtime schema validation.

### **Intent Compiler (`/intent-compiler`)**
*   **Language**: Rust 🦀.
*   **Purpose**: High-performance natural language processing to extract structured intent (Actors, Features, Tech Stack) from user queries before they hit the LLM layer.

### **Web / Marketing (`/web`)**
*   **Framework**: SvelteKit (inferred).
*   **Purpose**: Public-facing landing page and documentation.

---

## 3. Core Architectures & Workflows

### **A. Chat Modes**
The application operates in distinct "Modes" managed by `chatModeStore`:
1.  **Design Mode**: Focuses on high-level system architecture. Users describe an idea, and G-Rump generates editable Mermaid.js diagrams to visualize the solution.
2.  **Code Mode (Agentic)**: A tool-enabled environment where the AI has direct access to the `workspaceRoot`.
    *   **Capabilities**: `read_file`, `write_file`, `list_dir`, `run_command` (Shell).
    *   **Workflow**: Plan -> Execute -> Verify.
3.  **Plan Mode**: Pure reasoning mode to generate implementation strategies without side effects.
4.  **Ship Mode**: A dedicated workflow for deployment, CI/CD setup, and final production polish.

### **B. The "G-Rump" Workflow**
1.  **Intent** -> The Rust compiler extracts the core entities.
2.  **Architecture** -> LLM generates a system diagram (Sequence/C4/Class).
3.  **PRD** -> A detailed Product Requirements Document is generated.
4.  **Implementation** -> The "Agent Orchestrator" spins up sub-agents (Frontend, Backend, DevOps, QA) to write the actual code into the file system.

---

## 4. Design System & Aesthetics (New v2)
The UI has been completely overhauled to a **Premium Dark Theme** to match modern developer tool aesthetics (e.g., Linear, Vercel).

*   **Color Palette**:
    *   Background: Deep Space Blue/Black (`#030014`) with subtle Aurora Borealis gradients (Cyan/Purple/Emerald).
    *   Primary Accent: Electric Blue (`#3B82F6`) with glowing shadows.
    *   Text: High-contrast Slate (`#E2E8F0`) for readability.
*   **Components**:
    *   **Glass Panels**: Sidebar and Modals use `rgba(15, 23, 42, 0.6)` with `backdrop-filter: blur(12px)`.
    *   **Sessions Sidebar**: Collapsible, virtualized list with hover states and delete actions.
    *   **Chat Interface**: Fluid message stream with distinct User/AI bubbles, "Thinking" indicators, and tool execution cards.

---

## 5. Directory Structure Breakdown

```
/
├── backend/                 # Node.js Express API
│   ├── src/
│   │   ├── api/             # API Routes
│   │   ├── services/        # Business Logic (Claude, Tools)
│   │   └── mcp/             # Model Context Protocol server
│   ├── tests/               # Vitest & k6 Load Tests
│   └── Dockerfile           # Backend containerization
│
├── frontend/                # Svelte 5 + Tauri App
│   ├── src-tauri/           # Rust Tauri bindings
│   ├── src/
│   │   ├── components/      # UI Components (ChatInterface, Sidebar)
│   │   ├── lib/             # Utilities (Design System, API, Mermaid)
│   │   ├── stores/          # Svelte State Stores
│   │   └── style.css        # Global Premium Dark Styles
│   └── tailwind.config.js   # Theme configuration
│
├── intent-compiler/         # Rust CLI for NLP
│   ├── src/                 # Rust source code
│   └── Cargo.toml           # Rust dependencies
│
├── web/                     # Marketing Website
├── packages/                # Shared Monorepo Packages
├── docker-compose.yml       # Local dev infrastructure (Redis, DB)
└── ARCHITECTURE.md          # Technical system diagrams
```

---

## 6. Development & Deployment
*   **Dev**: `npm run dev` in frontend starts Vite. Backend runs separately via `npm start`. Tauri connects the two.
*   **Prod**: The backend is often bundled into a single executable (via `pkg`) and shipped inside the Tauri resource bundle, allowing the app to run completely "locally" without external server dependencies for the core logic (though it still calls LLM APIs).
