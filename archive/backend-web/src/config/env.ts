import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'
import { existsSync } from 'fs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const possiblePaths = [
  resolve(__dirname, '../../.env'),
  resolve(process.cwd(), '.env'),
  resolve(process.cwd(), 'backend-web/.env'),
]

let envPath: string | null = null
for (const path of possiblePaths) {
  if (existsSync(path)) {
    envPath = path
    break
  }
}

if (envPath) {
  dotenv.config({ path: envPath })
} else {
  dotenv.config()
}

export default process.env
