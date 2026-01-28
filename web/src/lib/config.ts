/**
 * Runtime config for web app.
 * VITE_API_URL: set in .env for production (e.g. https://api.grump.example.com)
 */
export const apiBase =
  typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL
    ? import.meta.env.VITE_API_URL
    : ''
