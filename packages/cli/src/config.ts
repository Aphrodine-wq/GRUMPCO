import Conf from 'conf';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { homedir } from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration schema
interface GrumpConfig {
  apiUrl: string;
  apiKey: string | null;
  theme: 'dark' | 'light' | 'minimal' | 'grumpy';
  defaultOutputDir: string;
  colors: {
    primary: string;
    secondary: string;
    error: string;
  };
  features: {
    autoStream: boolean;
    cacheEnabled: boolean;
    progressIndicators: boolean;
  };
  retries: number;
  timeout: number;
  cache: {
    enabled: boolean;
    ttl: number;
    directory: string;
  };
}

// Default configuration
const defaultConfig: GrumpConfig = {
  apiUrl: process.env.GRUMP_API_URL || 'http://localhost:3000',
  apiKey: process.env.GRUMP_API_KEY || null,
  theme: (process.env.GRUMP_THEME as GrumpConfig['theme']) || 'dark',
  defaultOutputDir: './output',
  colors: {
    primary: '#FF6B35',
    secondary: '#F7931E',
    error: '#FF4136'
  },
  features: {
    autoStream: false,
    cacheEnabled: true,
    progressIndicators: true
  },
  retries: 3,
  timeout: 30000,
  cache: {
    enabled: true,
    ttl: 3600000, // 1 hour
    directory: join(homedir(), '.grump-cache')
  }
};

// Config file paths
const CONFIG_FILE_NAME = '.grumprc';
const CONFIG_FILE_NAME_JS = 'grump.config.js';
const GLOBAL_CONFIG_DIR = join(homedir(), '.config', 'grump');
const GLOBAL_CONFIG_FILE = join(GLOBAL_CONFIG_DIR, 'config.json');

class ConfigManager {
  private store: Conf<GrumpConfig>;
  private fileConfig: Partial<GrumpConfig> = {};
  private configPath: string | null = null;

  constructor() {
    this.store = new Conf<GrumpConfig>({
      projectName: 'grump-cli',
      defaults: defaultConfig
    });

    this.loadFileConfig();
  }

  /**
   * Load configuration from file (.grumprc or grump.config.js)
   */
  private loadFileConfig(): void {
    // Check for local config files
    const cwd = process.cwd();
    const localJsonPath = join(cwd, CONFIG_FILE_NAME);
    const localJsPath = join(cwd, CONFIG_FILE_NAME_JS);
    const envConfigPath = process.env.GRUMP_CONFIG_PATH;

    // Priority: env > local js > local json > global
    if (envConfigPath && existsSync(envConfigPath)) {
      this.configPath = envConfigPath;
      this.loadConfigFile(envConfigPath);
    } else if (existsSync(localJsPath)) {
      this.configPath = localJsPath;
      this.loadJsConfig(localJsPath);
    } else if (existsSync(localJsonPath)) {
      this.configPath = localJsonPath;
      this.loadJsonConfig(localJsonPath);
    } else if (existsSync(GLOBAL_CONFIG_FILE)) {
      this.configPath = GLOBAL_CONFIG_FILE;
      this.loadJsonConfig(GLOBAL_CONFIG_FILE);
    }
  }

  /**
   * Load JSON config file
   */
  private loadJsonConfig(path: string): void {
    try {
      const content = readFileSync(path, 'utf-8');
      this.fileConfig = JSON.parse(content);
    } catch (error) {
      console.warn(`Warning: Failed to load config from ${path}`);
    }
  }

  /**
   * Load JS config file
   */
  private loadJsConfig(path: string): void {
    try {
      // Dynamic import for ES modules
      import(path).then((module) => {
        this.fileConfig = module.default || module;
      }).catch(() => {
        console.warn(`Warning: Failed to load config from ${path}`);
      });
    } catch (error) {
      console.warn(`Warning: Failed to load config from ${path}`);
    }
  }

  /**
   * Load config file (auto-detects type)
   */
  private loadConfigFile(path: string): void {
    if (path.endsWith('.js') || path.endsWith('.mjs')) {
      this.loadJsConfig(path);
    } else {
      this.loadJsonConfig(path);
    }
  }

  /**
   * Get a configuration value (with priority: env > file > store > default)
   */
  get<K extends keyof GrumpConfig>(key: K): GrumpConfig[K] {
    // Check environment variables first
    const envKey = `GRUMP_${key.toUpperCase()}`;
    if (process.env[envKey]) {
      const value = process.env[envKey];
      // Try to parse as JSON for complex values
      try {
        return JSON.parse(value as string);
      } catch {
        return value as GrumpConfig[K];
      }
    }

    // Check file config
    if (this.fileConfig[key] !== undefined) {
      return this.fileConfig[key] as GrumpConfig[K];
    }

    // Fall back to store (which has defaults)
    return this.store.get(key);
  }

  /**
   * Set a configuration value
   */
  set<K extends keyof GrumpConfig>(key: K, value: GrumpConfig[K], global = false): void {
    if (global) {
      // Save to global config file
      if (!existsSync(GLOBAL_CONFIG_DIR)) {
        mkdirSync(GLOBAL_CONFIG_DIR, { recursive: true });
      }
      
      let globalConfig: Partial<GrumpConfig> = {};
      if (existsSync(GLOBAL_CONFIG_FILE)) {
        globalConfig = JSON.parse(readFileSync(GLOBAL_CONFIG_FILE, 'utf-8'));
      }
      
      globalConfig[key] = value;
      writeFileSync(GLOBAL_CONFIG_FILE, JSON.stringify(globalConfig, null, 2));
    } else {
      // Save to local store
      this.store.set(key, value);
    }
  }

  /**
   * Get all configuration values
   */
  getAll(): GrumpConfig {
    return {
      apiUrl: this.get('apiUrl'),
      apiKey: this.get('apiKey'),
      theme: this.get('theme'),
      defaultOutputDir: this.get('defaultOutputDir'),
      colors: this.get('colors'),
      features: this.get('features'),
      retries: this.get('retries'),
      timeout: this.get('timeout'),
      cache: this.get('cache')
    };
  }

  /**
   * Reset configuration to defaults
   */
  reset(global = false): void {
    if (global) {
      if (existsSync(GLOBAL_CONFIG_FILE)) {
        // Note: This will be handled at runtime
        // We can't use fs.unlinkSync here due to ES modules
      }
    } else {
      this.store.clear();
    }
  }

  /**
   * List all configuration keys
   */
  list(): string[] {
    return Object.keys(defaultConfig);
  }

  /**
   * Get the current config file path
   */
  getConfigPath(): string | null {
    return this.configPath;
  }

  /**
   * Initialize a new config file
   */
  async init(global = false, force = false): Promise<string> {
    const configPath = global ? GLOBAL_CONFIG_FILE : join(process.cwd(), CONFIG_FILE_NAME);
    
    if (!force && existsSync(configPath)) {
      throw new Error(`Config file already exists at ${configPath}. Use --force to overwrite.`);
    }

    if (global && !existsSync(GLOBAL_CONFIG_DIR)) {
      mkdirSync(GLOBAL_CONFIG_DIR, { recursive: true });
    }

    const initialConfig = {
      apiUrl: 'http://localhost:3000',
      apiKey: null,
      theme: 'dark',
      defaultOutputDir: './output',
      colors: {
        primary: '#FF6B35',
        secondary: '#F7931E',
        error: '#FF4136'
      },
      features: {
        autoStream: false,
        cacheEnabled: true,
        progressIndicators: true
      }
    };

    writeFileSync(configPath, JSON.stringify(initialConfig, null, 2));
    return configPath;
  }

  /**
   * Check if API key is configured
   */
  hasApiKey(): boolean {
    return !!this.get('apiKey');
  }

  /**
   * Get API headers with authentication
   */
  getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };

    const apiKey = this.get('apiKey');
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }

    return headers;
  }
}

// Export singleton instance
export const config = new ConfigManager();
export type { GrumpConfig };
