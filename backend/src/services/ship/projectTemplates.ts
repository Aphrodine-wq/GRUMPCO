import type { FileDefinition, TechStack } from '../../types/index.js';

function sanitizeProjectName(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .substring(0, 50) || 'generated-project'
  );
}

const reactExpressPrismaBase: FileDefinition[] = [
  {
    path: '.gitignore',
    content: `node_modules/
dist/
.env
.env.local
*.log
.DS_Store
prisma/*.db
prisma/*.db-journal
`,
  },
  {
    path: '.env.example',
    content: `DATABASE_URL="postgresql://user:password@localhost:5432/mydb?schema=public"
PORT=3000
NODE_ENV=development
`,
  },
  {
    path: 'tsconfig.json',
    content: JSON.stringify(
      {
        compilerOptions: {
          target: 'ES2022',
          module: 'NodeNext',
          moduleResolution: 'NodeNext',
          lib: ['ES2022'],
          outDir: './dist',
          rootDir: './src',
          strict: true,
          esModuleInterop: true,
          skipLibCheck: true,
          forceConsistentCasingInFileNames: true,
          resolveJsonModule: true,
        },
        include: ['src/**/*'],
        exclude: ['node_modules', 'dist'],
      },
      null,
      2
    ),
  },
];

const fastapiSqlalchemyBase: FileDefinition[] = [
  {
    path: '.gitignore',
    content: `__pycache__/
*.py[cod]
*$py.class
*.so
.Python
venv/
.env
*.db
.DS_Store
`,
  },
  {
    path: '.env.example',
    content: `DATABASE_URL=sqlite:///./app.db
# For PostgreSQL: DATABASE_URL=postgresql://user:password@localhost:5432/mydb
SECRET_KEY=your-secret-key-here
`,
  },
  {
    path: 'requirements.txt',
    content: `fastapi>=0.109.0
uvicorn[standard]>=0.27.0
sqlalchemy>=2.0.25
pydantic>=2.5.0
python-dotenv>=1.0.0
alembic>=1.13.0
`,
  },
];

const nextjsPrismaBase: FileDefinition[] = [
  {
    path: '.gitignore',
    content: `node_modules/
.next/
out/
.env
.env.local
*.log
.DS_Store
prisma/*.db
prisma/*.db-journal
`,
  },
  {
    path: '.env.example',
    content: `DATABASE_URL="postgresql://user:password@localhost:5432/mydb?schema=public"
NEXTAUTH_SECRET="your-secret-here"
NEXTAUTH_URL="http://localhost:3000"
`,
  },
  {
    path: 'next.config.js',
    content: `/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: true,
  },
};

module.exports = nextConfig;
`,
  },
  {
    path: 'tsconfig.json',
    content: JSON.stringify(
      {
        compilerOptions: {
          lib: ['dom', 'dom.iterable', 'esnext'],
          allowJs: true,
          skipLibCheck: true,
          strict: true,
          noEmit: true,
          esModuleInterop: true,
          module: 'esnext',
          moduleResolution: 'bundler',
          resolveJsonModule: true,
          isolatedModules: true,
          jsx: 'preserve',
          incremental: true,
          plugins: [{ name: 'next' }],
          paths: { '@/*': ['./src/*'] },
        },
        include: ['next-env.d.ts', '**/*.ts', '**/*.tsx', '.next/types/**/*.ts'],
        exclude: ['node_modules'],
      },
      null,
      2
    ),
  },
];

export function getBaseTemplate(techStack: TechStack): FileDefinition[] {
  switch (techStack) {
    case 'react-express-prisma':
      return [...reactExpressPrismaBase];
    case 'fastapi-sqlalchemy':
      return [...fastapiSqlalchemyBase];
    case 'nextjs-prisma':
      return [...nextjsPrismaBase];
    default:
      return [];
  }
}

export function getPackageJson(projectName: string, techStack: TechStack): FileDefinition | null {
  if (techStack === 'fastapi-sqlalchemy') {
    return null; // Python uses requirements.txt
  }

  const sanitizedName = sanitizeProjectName(projectName);
  const basePackage = {
    name: sanitizedName,
    version: '0.1.0',
    private: true,
  };

  if (techStack === 'react-express-prisma') {
    return {
      path: 'package.json',
      content: JSON.stringify(
        {
          ...basePackage,
          type: 'module',
          scripts: {
            dev: 'tsx watch src/index.ts',
            build: 'tsc',
            start: 'node dist/index.js',
            'db:generate': 'prisma generate',
            'db:migrate': 'prisma migrate dev',
          },
          dependencies: {
            express: '^4.18.2',
            '@prisma/client': '^5.9.0',
            cors: '^2.8.5',
            dotenv: '^16.4.0',
          },
          devDependencies: {
            '@types/express': '^4.17.21',
            '@types/cors': '^2.8.17',
            '@types/node': '^20.11.0',
            prisma: '^5.9.0',
            tsx: '^4.7.0',
            typescript: '^5.3.3',
          },
        },
        null,
        2
      ),
    };
  }

  if (techStack === 'nextjs-prisma') {
    return {
      path: 'package.json',
      content: JSON.stringify(
        {
          ...basePackage,
          scripts: {
            dev: 'next dev',
            build: 'next build',
            start: 'next start',
            lint: 'next lint',
            'db:generate': 'prisma generate',
            'db:migrate': 'prisma migrate dev',
          },
          dependencies: {
            next: '14.1.0',
            react: '^18.2.0',
            'react-dom': '^18.2.0',
            '@prisma/client': '^5.9.0',
          },
          devDependencies: {
            '@types/node': '^20.11.0',
            '@types/react': '^18.2.48',
            '@types/react-dom': '^18.2.18',
            prisma: '^5.9.0',
            typescript: '^5.3.3',
            eslint: '^8.56.0',
            'eslint-config-next': '14.1.0',
          },
        },
        null,
        2
      ),
    };
  }

  return null;
}

// ============================================================================
// Intent-Driven Template Generation
// ============================================================================

export interface TechStackHints {
  frontend?: string[];
  backend?: string[];
  database?: string[];
  deployment?: string[];
  language?: string[];
}

/**
 * Intent-driven template generator
 * Creates project structure based on extracted intent hints
 */
export class IntentDrivenTemplate {
  /**
   * Generate base template files from intent hints
   */
  generateFromIntent(projectName: string, hints: TechStackHints): FileDefinition[] {
    const files: FileDefinition[] = [];
    const safeName = sanitizeProjectName(projectName);

    // Determine primary technologies
    const frontend = this.selectPrimary(hints.frontend, ['react', 'vue', 'svelte', 'nextjs']);
    const backend = this.selectPrimary(hints.backend, ['express', 'fastapi', 'nestjs']);
    const database = this.selectPrimary(hints.database, ['postgres', 'mongodb', 'sqlite']);
    const language = this.selectPrimary(hints.language, ['typescript', 'javascript', 'python']);

    // Generate appropriate config files
    files.push(this.generateGitignore(language));
    files.push(this.generateEnvExample(database));

    if (language === 'typescript' || language === 'javascript') {
      files.push(this.generateTsConfig(frontend, backend));
      files.push(this.generatePackageJson(safeName, frontend, backend, database));
    } else if (language === 'python') {
      files.push(this.generateRequirementsTxt(backend, database));
    }

    if (frontend === 'nextjs') {
      files.push(this.generateNextConfig());
    }

    return files;
  }

  /**
   * Select primary technology from hints
   */
  private selectPrimary(hints: string[] | undefined, defaults: string[]): string {
    if (!hints || hints.length === 0) return defaults[0];

    // Find first match between hints and defaults
    const match = hints.find((h) => defaults.some((d) => h.toLowerCase().includes(d)));

    return match ? defaults.find((d) => match.toLowerCase().includes(d))! : defaults[0];
  }

  /**
   * Generate .gitignore based on language
   */
  private generateGitignore(language: string): FileDefinition {
    if (language === 'python') {
      return {
        path: '.gitignore',
        content: `__pycache__/
*.py[cod]
*$py.class
*.so
.Python
venv/
.env
*.db
.DS_Store
`,
      };
    }

    // Default to Node.js gitignore
    return {
      path: '.gitignore',
      content: `node_modules/
dist/
.next/
out/
.env
.env.local
*.log
.DS_Store
*.db
*.db-journal
coverage/
.vscode/
.idea/
`,
    };
  }

  /**
   * Generate .env.example based on database
   */
  private generateEnvExample(database: string): FileDefinition {
    let dbUrl: string;

    switch (database) {
      case 'postgres':
      case 'postgresql':
        dbUrl = 'postgresql://user:password@localhost:5432/mydb?schema=public';
        break;
      case 'mongodb':
        dbUrl = 'mongodb://localhost:27017/mydb';
        break;
      case 'sqlite':
        dbUrl = 'file:./dev.db';
        break;
      default:
        dbUrl = 'postgresql://user:password@localhost:5432/mydb';
    }

    return {
      path: '.env.example',
      content: `DATABASE_URL="${dbUrl}"
PORT=3000
NODE_ENV=development
# Add your API keys here
`,
    };
  }

  /**
   * Generate tsconfig.json based on frontend/backend
   */
  private generateTsConfig(frontend: string, backend: string): FileDefinition {
    const isNextjs = frontend === 'nextjs';

    if (isNextjs) {
      return {
        path: 'tsconfig.json',
        content: JSON.stringify(
          {
            compilerOptions: {
              lib: ['dom', 'dom.iterable', 'esnext'],
              allowJs: true,
              skipLibCheck: true,
              strict: true,
              noEmit: true,
              esModuleInterop: true,
              module: 'esnext',
              moduleResolution: 'bundler',
              resolveJsonModule: true,
              isolatedModules: true,
              jsx: 'preserve',
              incremental: true,
              plugins: [{ name: 'next' }],
              paths: { '@/*': ['./src/*'] },
            },
            include: ['next-env.d.ts', '**/*.ts', '**/*.tsx', '.next/types/**/*.ts'],
            exclude: ['node_modules'],
          },
          null,
          2
        ),
      };
    }

    return {
      path: 'tsconfig.json',
      content: JSON.stringify(
        {
          compilerOptions: {
            target: 'ES2022',
            module: 'NodeNext',
            moduleResolution: 'NodeNext',
            lib: ['ES2022'],
            outDir: './dist',
            rootDir: './src',
            strict: true,
            esModuleInterop: true,
            skipLibCheck: true,
            forceConsistentCasingInFileNames: true,
            resolveJsonModule: true,
          },
          include: ['src/**/*'],
          exclude: ['node_modules', 'dist'],
        },
        null,
        2
      ),
    };
  }

  /**
   * Generate package.json based on tech stack
   */
  private generatePackageJson(
    name: string,
    frontend: string,
    backend: string,
    database: string
  ): FileDefinition {
    const hasPrisma = database === 'postgres' || database === 'postgresql';
    const isNextjs = frontend === 'nextjs';

    const dependencies: Record<string, string> = {};
    const devDependencies: Record<string, string> = {
      '@types/node': '^20.11.0',
      typescript: '^5.3.3',
    };

    // Add frontend dependencies
    if (isNextjs) {
      dependencies.next = '14.1.0';
      dependencies.react = '^18.2.0';
      dependencies['react-dom'] = '^18.2.0';
      devDependencies['@types/react'] = '^18.2.48';
      devDependencies['@types/react-dom'] = '^18.2.18';
    } else if (frontend === 'react') {
      dependencies.react = '^18.2.0';
      dependencies['react-dom'] = '^18.2.0';
    } else if (frontend === 'vue') {
      dependencies.vue = '^3.4.15';
    } else if (frontend === 'svelte') {
      dependencies.svelte = '^4.2.9';
    }

    // Add backend dependencies
    if (backend === 'express') {
      dependencies.express = '^4.18.2';
      dependencies.cors = '^2.8.5';
      devDependencies['@types/express'] = '^4.17.21';
      devDependencies['@types/cors'] = '^2.8.17';
    }

    // Add database dependencies
    if (hasPrisma) {
      dependencies['@prisma/client'] = '^5.9.0';
      devDependencies.prisma = '^5.9.0';
    }

    // Generate scripts
    const scripts: Record<string, string> = {
      dev: isNextjs ? 'next dev' : 'tsx src/index.ts',
      build: isNextjs ? 'next build' : 'tsc',
      start: isNextjs ? 'next start' : 'node dist/index.js',
    };

    if (hasPrisma) {
      scripts['db:generate'] = 'prisma generate';
      scripts['db:migrate'] = 'prisma migrate dev';
    }

    return {
      path: 'package.json',
      content: JSON.stringify(
        {
          name,
          version: '1.0.0',
          private: true,
          scripts,
          dependencies,
          devDependencies,
        },
        null,
        2
      ),
    };
  }

  /**
   * Generate Python requirements.txt
   */
  private generateRequirementsTxt(backend: string, database: string): FileDefinition {
    const packages = [
      'fastapi>=0.109.0',
      'uvicorn[standard]>=0.27.0',
      'pydantic>=2.5.0',
      'python-dotenv>=1.0.0',
    ];

    if (backend === 'fastapi') {
      // Already included above
    }

    if (database === 'postgres' || database === 'postgresql') {
      packages.push('sqlalchemy>=2.0.25');
      packages.push('psycopg2-binary>=2.9.9');
      packages.push('alembic>=1.13.0');
    } else if (database === 'mongodb') {
      packages.push('pymongo>=4.6.0');
    } else if (database === 'sqlite') {
      packages.push('sqlalchemy>=2.0.25');
    }

    return {
      path: 'requirements.txt',
      content: packages.join('\n') + '\n',
    };
  }

  /**
   * Generate next.config.js for Next.js projects
   */
  private generateNextConfig(): FileDefinition {
    return {
      path: 'next.config.js',
      content: `/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: true,
  },
};

module.exports = nextConfig;
`,
    };
  }
}

/**
 * Convenience function to generate template from intent hints
 */
export function generateIntentDrivenTemplate(
  projectName: string,
  hints: TechStackHints
): FileDefinition[] {
  const template = new IntentDrivenTemplate();
  return template.generateFromIntent(projectName, hints);
}
