/**
 * Vercel serverless function: forwards all requests to the Express app.
 * Deploy with Root Directory = "backend". Build runs first (npm run build), then this handler serves all routes.
 */
import handler from "../dist/vercel-handler.js";

export default handler;
