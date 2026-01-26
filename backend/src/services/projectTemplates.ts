import type { FileDefinition, TechStack } from '../types/index.js';

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
`
  },
  {
    path: '.env.example',
    content: `DATABASE_URL="postgresql://user:password@localhost:5432/mydb?schema=public"
PORT=3000
NODE_ENV=development
`
  },
  {
    path: 'tsconfig.json',
    content: JSON.stringify({
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
        resolveJsonModule: true
      },
      include: ['src/**/*'],
      exclude: ['node_modules', 'dist']
    }, null, 2)
  }
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
`
  },
  {
    path: '.env.example',
    content: `DATABASE_URL=sqlite:///./app.db
# For PostgreSQL: DATABASE_URL=postgresql://user:password@localhost:5432/mydb
SECRET_KEY=your-secret-key-here
`
  },
  {
    path: 'requirements.txt',
    content: `fastapi>=0.109.0
uvicorn[standard]>=0.27.0
sqlalchemy>=2.0.25
pydantic>=2.5.0
python-dotenv>=1.0.0
alembic>=1.13.0
`
  }
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
`
  },
  {
    path: '.env.example',
    content: `DATABASE_URL="postgresql://user:password@localhost:5432/mydb?schema=public"
NEXTAUTH_SECRET="your-secret-here"
NEXTAUTH_URL="http://localhost:3000"
`
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
`
  },
  {
    path: 'tsconfig.json',
    content: JSON.stringify({
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
        paths: { '@/*': ['./src/*'] }
      },
      include: ['next-env.d.ts', '**/*.ts', '**/*.tsx', '.next/types/**/*.ts'],
      exclude: ['node_modules']
    }, null, 2)
  }
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

  const basePackage = {
    name: projectName,
    version: '0.1.0',
    private: true
  };

  if (techStack === 'react-express-prisma') {
    return {
      path: 'package.json',
      content: JSON.stringify({
        ...basePackage,
        type: 'module',
        scripts: {
          dev: 'tsx watch src/index.ts',
          build: 'tsc',
          start: 'node dist/index.js',
          'db:generate': 'prisma generate',
          'db:migrate': 'prisma migrate dev'
        },
        dependencies: {
          express: '^4.18.2',
          '@prisma/client': '^5.9.0',
          cors: '^2.8.5',
          dotenv: '^16.4.0'
        },
        devDependencies: {
          '@types/express': '^4.17.21',
          '@types/cors': '^2.8.17',
          '@types/node': '^20.11.0',
          prisma: '^5.9.0',
          tsx: '^4.7.0',
          typescript: '^5.3.3'
        }
      }, null, 2)
    };
  }

  if (techStack === 'nextjs-prisma') {
    return {
      path: 'package.json',
      content: JSON.stringify({
        ...basePackage,
        scripts: {
          dev: 'next dev',
          build: 'next build',
          start: 'next start',
          lint: 'next lint',
          'db:generate': 'prisma generate',
          'db:migrate': 'prisma migrate dev'
        },
        dependencies: {
          next: '14.1.0',
          react: '^18.2.0',
          'react-dom': '^18.2.0',
          '@prisma/client': '^5.9.0'
        },
        devDependencies: {
          '@types/node': '^20.11.0',
          '@types/react': '^18.2.48',
          '@types/react-dom': '^18.2.18',
          prisma: '^5.9.0',
          typescript: '^5.3.3',
          eslint: '^8.56.0',
          'eslint-config-next': '14.1.0'
        }
      }, null, 2)
    };
  }

  return null;
}
