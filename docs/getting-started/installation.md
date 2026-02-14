# Installation

This guide will walk you through the process of installing G-Rump and its dependencies.

## 1. Clone the Repository

First, clone the G-Rump repository from GitHub:

```bash
git clone https://github.com/Aphrodine-wq/GRUMPCO.git
cd GRUMPCO
```

## 2. Set Up Environment Variables

G-Rump uses a variety of AI providers. You will need to configure API keys for the providers you want to use.

**Required:**
```bash
# NVIDIA NIM (Primary provider)
NVIDIA_NIM_API_KEY=your_nvidia_nim_api_key
```

**Optional (add as needed):**
```bash
# Anthropic - Best quality (Claude)
ANTHROPIC_API_KEY=your_anthropic_api_key

# OpenRouter - Multi-model gateway
OPENROUTER_API_KEY=your_openrouter_api_key

# Ollama - Local/self-hosted
OLLAMA_BASE_URL=http://localhost:11434
```

Create a `.env` file in the `backend` directory and add the environment variables for the providers you want to use. You can start by copying the example file:

```bash
cp backend/.env.example backend/.env
```

Then, edit the `backend/.env` file to add your API keys.

## 3. Install Dependencies

G-Rump uses `pnpm` for package management. Install the dependencies from the project root:

```bash
pnpm install
```

## 4. Build the Project

You can build the entire project or just the backend:

```bash
# Full project
npm run build

# Backend only
cd backend && npm run build
```

## 5. Run the Application

To run the application, you need to start the backend server and the frontend application.

```bash
# Start the backend server
cd backend
npm run dev
```

In a separate terminal, start the frontend application:

```bash
# Start the frontend application
cd frontend
npm run electron:dev
```

Now you should have the G-Rump desktop application running on your machine.