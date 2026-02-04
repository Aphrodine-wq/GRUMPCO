# Environment setup

Use these templates to create your local `.env` files. Real loading is done by the backend and frontend; this doc is your single reference.

## Backend

1. Copy the template: `backend/.env.example` → `backend/.env`
2. Edit `backend/.env` with your API keys and options (see comments in the file).

**Quick start (no API key):** Copy `backend/.env.minimal` → `backend/.env` for mock mode, then switch to real AI when ready.

## Frontend

1. Copy the template: `frontend/.env.example` → `frontend/.env`
2. Edit `frontend/.env` (e.g. `VITE_API_URL`, optional Supabase/PostHog).

## Root `.env.example` (reference only)

A root `.env.example` in this repo lists variable names for both backend and frontend. It is for reference only; the app does not load it. Copy from `backend/.env.example` and `frontend/.env.example` for real templates.
