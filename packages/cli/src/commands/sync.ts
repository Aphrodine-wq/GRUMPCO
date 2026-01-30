import chalk from 'chalk';
import { existsSync, readFileSync, writeFileSync, statSync, readdirSync } from 'fs';
import { join, resolve, relative } from 'path';
import { createHash } from 'crypto';
import { config } from '../config.js';
import { branding } from '../branding.js';
import { withSpinner, createProgressSpinner, showProgressBar } from '../utils/progress.js';
import { GrumpError, handleApiError } from '../utils/errors.js';
import { prompt as askUser } from '../utils/prompt.js';

interface SyncOptions {
  push?: boolean;
  pull?: boolean;
  watch?: boolean;
  force?: boolean;
  dryRun?: boolean;
}

interface FileEntry {
  path: string;
  content?: string;
  hash: string;
  modified: number;
  size: number;
}

/**
 * Get file hash
 */
function getFileHash(filePath: string): string {
  const content = readFileSync(filePath);
  return createHash('md5').update(content).digest('hex');
}

/**
 * Scan project files
 */
function scanProject(cwd: string): FileEntry[] {
  const files: FileEntry[] = [];
  const ignorePatterns = [
    'node_modules', '.git', 'dist', 'build', '.next', 'target',
    '__pycache__', '.venv', 'venv', '.env', '.cache'
  ];
  
  function scan(dir: string) {
    for (const entry of readdirSync(dir)) {
      const fullPath = join(dir, entry);
      const relPath = relative(cwd, fullPath);
      
      if (ignorePatterns.some(p => relPath.includes(p))) continue;
      
      const stat = statSync(fullPath);
      
      if (stat.isDirectory()) {
        scan(fullPath);
      } else if (stat.isFile()) {
        files.push({
          path: relPath,
          hash: getFileHash(fullPath),
          modified: stat.mtimeMs,
          size: stat.size
        });
      }
    }
  }
  
  scan(cwd);
  return files;
}

/**
 * Sync project with cloud
 */
export async function execute(options: SyncOptions): Promise<void> {
  const apiUrl = config.get('apiUrl');
  const headers = config.getHeaders();
  const cwd = process.cwd();
  
  console.log(branding.format('\n☁️  Project Sync\n', 'title'));
  
  if (!config.hasApiKey()) {
    throw new GrumpError(
      'Authentication required',
      'AUTH_REQUIRED',
      undefined,
      ['Run `grump auth login` to authenticate']
    );
  }
  
  // Get project info
  let projectId: string;
  const grumpProjectPath = join(cwd, '.grump-project');
  
  if (existsSync(grumpProjectPath)) {
    const project = JSON.parse(readFileSync(grumpProjectPath, 'utf-8'));
    projectId = project.id;
    console.log(chalk.hex(branding.colors.lightPurple)(`Project: ${project.name || projectId}\n`));
  } else {
    // Create new project
    console.log(chalk.hex(branding.colors.lightPurple)('No project found. Creating new cloud project...\n'));
    
    const pkgPath = join(cwd, 'package.json');
    const defaultName = existsSync(pkgPath) 
      ? JSON.parse(readFileSync(pkgPath, 'utf-8')).name 
      : 'unnamed-project';
    
    const { name, description } = await askUser<{ name: string; description: string }>([
      {
        type: 'input',
        name: 'name',
        message: 'Project name:',
        default: defaultName
      },
      {
        type: 'input',
        name: 'description',
        message: 'Project description:',
        default: ''
      }
    ]);
    
    const project = await withSpinner(
      'Creating cloud project...',
      async () => {
        const response = await fetch(`${apiUrl}/api/projects`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ name, description })
        });
        
        if (!response.ok) {
          handleApiError(response);
        }
        
        return response.json();
      },
      'Project created'
    );
    
    projectId = (project as { id: string }).id;
    
    // Save project info locally
    writeFileSync(grumpProjectPath, JSON.stringify({
      id: projectId,
      name,
      created: new Date().toISOString()
    }, null, 2));
  }
  
  // Determine sync direction
  if (!options.push && !options.pull) {
    const { direction } = await askUser<{ direction: string }>([{
      type: 'list',
      name: 'direction',
      message: 'Sync direction:',
      choices: [
        { name: 'Push (upload to cloud)', value: 'push' },
        { name: 'Pull (download from cloud)', value: 'pull' },
        { name: 'Bidirectional (merge)', value: 'both' }
      ]
    }]);
    
    options.push = direction === 'push' || direction === 'both';
    options.pull = direction === 'pull' || direction === 'both';
  }
  
  // Scan local files
  console.log(chalk.hex(branding.colors.mediumPurple)('\n📁 Scanning local files...'));
  const localFiles = scanProject(cwd);
  console.log(chalk.hex(branding.colors.lightPurple)(`  Found ${localFiles.length} files\n`));
  
  if (options.dryRun) {
    console.log(chalk.hex(branding.colors.mediumPurple)('🔍 Dry Run Mode - No changes will be made\n'));
  }
  
  // Push to cloud
  if (options.push) {
    console.log(chalk.hex(branding.colors.mediumPurple)('⬆️  Pushing to cloud...\n'));
    
    // Get remote file list for comparison
    const remoteState = await withSpinner(
      'Checking remote state...',
      async () => {
        const response = await fetch(`${apiUrl}/api/projects/${projectId}/files`, {
          headers
        });
        
        if (!response.ok) {
          handleApiError(response);
        }
        
        return response.json();
      },
      'Remote state retrieved'
    );
    
    const remoteFiles = (remoteState as { files: FileEntry[] }).files || [];
    const remoteFileMap = new Map(remoteFiles.map(f => [f.path, f]));
    
    // Find changed files
    const changedFiles = localFiles.filter(local => {
      const remote = remoteFileMap.get(local.path);
      return !remote || remote.hash !== local.hash;
    });
    
    const newFiles = changedFiles.filter(f => !remoteFileMap.has(f.path));
    const modifiedFiles = changedFiles.filter(f => remoteFileMap.has(f.path));
    
    console.log(chalk.hex(branding.colors.lightPurple)(
      `  ${newFiles.length} new, ${modifiedFiles.length} modified\n`
    ));
    
    if (changedFiles.length === 0) {
      console.log(branding.status('Already up to date!', 'success'));
    } else {
      // Upload files
      const progress = createProgressSpinner('Uploading files...', changedFiles.length);
      progress.start();
      
      for (let i = 0; i < changedFiles.length; i++) {
        const file = changedFiles[i];
        const content = readFileSync(join(cwd, file.path), 'utf-8');
        
        if (!options.dryRun) {
          try {
            await fetch(`${apiUrl}/api/projects/${projectId}/files/${encodeURIComponent(file.path)}`, {
              method: 'PUT',
              headers: {
                ...headers,
                'X-File-Hash': file.hash
              },
              body: JSON.stringify({ content, hash: file.hash })
            });
          } catch (error) {
            console.log(chalk.hex(branding.colors.mediumPurple)(`\n  ✗ Failed: ${file.path}`));
          }
        }
        
        progress.update(`Uploading ${file.path}`, i + 1);
      }
      
      progress.succeed(`Uploaded ${changedFiles.length} files`);
    }
  }
  
  // Pull from cloud
  if (options.pull) {
    console.log(chalk.hex(branding.colors.mediumPurple)('\n⬇️  Pulling from cloud...\n'));
    
    const remoteFiles = await withSpinner(
      'Fetching remote files...',
      async () => {
        const response = await fetch(`${apiUrl}/api/projects/${projectId}/files`, {
          headers
        });
        
        if (!response.ok) {
          handleApiError(response);
        }
        
        return response.json();
      },
      'Remote files retrieved'
    );
    
    const files = (remoteFiles as { files: Array<FileEntry & { content: string }> }).files || [];
    const localFileMap = new Map(localFiles.map(f => [f.path, f]));
    
    // Find files to download
    const toDownload = files.filter(remote => {
      const local = localFileMap.get(remote.path);
      return !local || local.hash !== remote.hash;
    });
    
    if (toDownload.length === 0) {
      console.log(branding.status('Already up to date!', 'success'));
    } else {
      const progress = createProgressSpinner('Downloading files...', toDownload.length);
      progress.start();
      
      for (let i = 0; i < toDownload.length; i++) {
        const file = toDownload[i];
        
        if (!options.dryRun && file.content) {
          const filePath = join(cwd, file.path);
          writeFileSync(filePath, file.content);
        }
        
        progress.update(`Downloading ${file.path}`, i + 1);
      }
      
      progress.succeed(`Downloaded ${toDownload.length} files`);
    }
  }
  
  // Save sync state
  if (!options.dryRun) {
    const syncState = {
      lastSync: new Date().toISOString(),
      files: localFiles.map(f => ({ path: f.path, hash: f.hash }))
    };
    writeFileSync(join(cwd, '.grump-sync'), JSON.stringify(syncState, null, 2));
  }
  
  console.log('\n' + branding.getDivider());
  console.log(branding.status('Sync complete!', 'success'));
  
  if (options.watch) {
    console.log(chalk.hex(branding.colors.mediumPurple)('\n👀 Watching for changes... (Press Ctrl+C to stop)\n'));
    
    const watcher = async () => {
      // Simple polling-based watch
      setInterval(async () => {
        const currentFiles = scanProject(cwd);
        // Compare and sync if needed
      }, 30000);
    };
    
    await watcher();
  }
}

export const syncCommand = { execute };
