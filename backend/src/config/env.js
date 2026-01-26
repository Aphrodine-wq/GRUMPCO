import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// Load .env from backend root (two levels up from src/config)
const envPath = resolve(__dirname, '../../.env');
dotenv.config({ path: envPath });
// Validate critical environment variables
const requiredVars = ['ANTHROPIC_API_KEY'];
const missing = requiredVars.filter(v => !process.env[v]);
if (missing.length > 0) {
    console.error(`Missing required environment variables: ${missing.join(', ')}`);
    console.error(`Ensure backend/.env exists and contains these variables.`);
}
export default process.env;
//# sourceMappingURL=env.js.map