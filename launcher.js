#!/usr/bin/env node
/**
 * G-Rump Launcher - Auto-updating Windows Executable
 * Compiles to G-Rump.exe using nexe/pkg
 */

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn, exec } = require('child_process');
const os = require('os');

// Configuration
const CONFIG = {
  appName: 'G-Rump',
  version: '1.0.0',
  updateUrl: 'https://api.g-rump.com/v1/releases/latest',
  downloadUrl: 'https://github.com/Aphrodine-wq/G-rump.com/releases/latest',
  installDir: path.join(os.homedir(), 'AppData', 'Local', 'G-Rump'),
  exePath: path.join(os.homedir(), 'AppData', 'Local', 'G-Rump', 'G-Rump.exe'),
  updateCheckInterval: 24, // hours
};

// Logging
function log(message, level = 'INFO') {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] [${level}] ${message}`;
  console.log(logMessage);
  
  const logDir = path.join(CONFIG.installDir, 'logs');
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }
  const logFile = path.join(logDir, `launcher-${new Date().toISOString().split('T')[0]}.log`);
  fs.appendFileSync(logFile, logMessage + '\n');
}

// Show Windows dialog
function showDialog(title, message, type = 'info') {
  if (process.platform === 'win32') {
    const vbType = type === 'error' ? 16 : type === 'question' ? 36 : 64;
    const cmd = `powershell -Command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.MessageBox]::Show('${message}', '${title}', 'OK', ${vbType})"`;
    exec(cmd, { windowsHide: true });
  } else {
    console.log(`${title}: ${message}`);
  }
}

// Check for updates
async function checkForUpdates() {
  return new Promise((resolve) => {
    log('Checking for updates...');
    
    const url = new URL(CONFIG.updateUrl);
    const client = url.protocol === 'https:' ? https : http;
    
    const req = client.get(url, { 
      timeout: 10000,
      headers: {
        'User-Agent': `G-Rump-Launcher/${CONFIG.version}`,
        'Accept': 'application/json'
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          if (response.version) {
            const latest = response.version;
            const current = CONFIG.version;
            
            if (latest > current) {
              log(`Update available: ${current} -> ${latest}`);
              resolve({
                available: true,
                version: latest,
                downloadUrl: response.download_url || CONFIG.downloadUrl,
                mandatory: response.mandatory || false
              });
              return;
            }
          }
          log('No updates available');
          resolve({ available: false });
        } catch (e) {
          log(`Update check failed: ${e.message}`, 'WARN');
          resolve({ available: false });
        }
      });
    });
    
    req.on('error', (err) => {
      log(`Update check error: ${err.message}`, 'WARN');
      resolve({ available: false });
    });
    
    req.setTimeout(10000, () => {
      req.destroy();
      resolve({ available: false });
    });
  });
}

// Download file
async function downloadFile(url, destination, description) {
  return new Promise((resolve) => {
    log(`${description}...`);
    
    const urlObj = new URL(url);
    const client = urlObj.protocol === 'https:' ? https : http;
    const file = fs.createWriteStream(destination);
    
    const req = client.get(url, { 
      timeout: 60000,
      headers: {
        'User-Agent': `G-Rump-Launcher/${CONFIG.version}`
      }
    }, (res) => {
      if (res.statusCode === 302 || res.statusCode === 301) {
        // Follow redirect
        downloadFile(res.headers.location, destination, description).then(resolve);
        return;
      }
      
      const totalSize = parseInt(res.headers['content-length'], 10);
      let downloaded = 0;
      
      res.on('data', (chunk) => {
        downloaded += chunk.length;
        const percent = totalSize ? Math.round((downloaded / totalSize) * 100) : 0;
        process.stdout.write(`\r${description}: ${percent}%`);
      });
      
      res.pipe(file);
      
      file.on('finish', () => {
        file.close();
        process.stdout.write('\n');
        log(`Download complete: ${destination}`);
        resolve(true);
      });
    });
    
    req.on('error', (err) => {
      fs.unlink(destination, () => {});
      log(`Download failed: ${err.message}`, 'ERROR');
      resolve(false);
    });
    
    req.setTimeout(60000, () => {
      req.destroy();
      fs.unlink(destination, () => {});
      resolve(false);
    });
  });
}

// Install G-Rump
async function install() {
  log('Installing G-Rump...');
  
  try {
    // Create install directory
    if (!fs.existsSync(CONFIG.installDir)) {
      fs.mkdirSync(CONFIG.installDir, { recursive: true });
    }
    
    // Download latest version
    const tempFile = path.join(os.tmpdir(), `G-Rump-Setup-${Date.now()}.exe`);
    
    if (!await downloadFile(CONFIG.downloadUrl, tempFile, 'Downloading G-Rump')) {
      throw new Error('Download failed');
    }
    
    // Copy to install directory
    fs.copyFileSync(tempFile, CONFIG.exePath);
    fs.unlinkSync(tempFile);
    
    // Create desktop shortcut (Windows)
    if (process.platform === 'win32') {
      const desktopPath = path.join(os.homedir(), 'Desktop', 'G-Rump.lnk');
      const vbsScript = `
Set WshShell = WScript.CreateObject("WScript.Shell")
Set shortcut = WshShell.CreateShortcut("${desktopPath}")
shortcut.TargetPath = "${CONFIG.exePath}"
shortcut.WorkingDirectory = "${CONFIG.installDir}"
shortcut.IconLocation = "${CONFIG.exePath}"
shortcut.Save()
      `;
      const vbsFile = path.join(os.tmpdir(), 'create-shortcut.vbs');
      fs.writeFileSync(vbsFile, vbsScript);
      exec(`cscript //nologo "${vbsFile}"`, { windowsHide: true });
      fs.unlinkSync(vbsFile);
    }
    
    log('Installation complete!');
    showDialog('Installation Complete', 'G-Rump has been installed successfully!\n\nA shortcut has been created on your Desktop.');
    return true;
  } catch (err) {
    log(`Installation failed: ${err.message}`, 'ERROR');
    showDialog('Installation Error', `Installation failed: ${err.message}`, 'error');
    return false;
  }
}

// Perform update
async function performUpdate(updateInfo) {
  log(`Starting update to v${updateInfo.version}...`);
  
  const tempDir = path.join(os.tmpdir(), `G-Rump-Update-${Date.now()}`);
  fs.mkdirSync(tempDir, { recursive: true });
  
  try {
    // Download new version
    const downloadPath = path.join(tempDir, `G-Rump-v${updateInfo.version}.exe`);
    
    if (!await downloadFile(updateInfo.downloadUrl, downloadPath, 'Downloading update')) {
      throw new Error('Download failed');
    }
    
    // Create update batch script
    const updateScript = `@echo off
timeout /t 2 /nobreak >nul
move /y "${downloadPath}" "${CONFIG.exePath}"
if %errorlevel% == 0 (
    echo Update complete!
    start "" "${CONFIG.exePath}"
) else (
    echo Update failed. Please try again.
    pause
)
del "%~f0"
    `;
    
    const updateScriptPath = path.join(tempDir, 'update.bat');
    fs.writeFileSync(updateScriptPath, updateScript);
    
    log('Update ready. Installing...');
    
    // Show notification
    if (updateInfo.mandatory) {
      showDialog('Update Required', `A mandatory update (v${updateInfo.version}) is available.\n\nThe application will now update and restart.`);
      spawn('cmd', ['/c', updateScriptPath], { 
        detached: true, 
        windowsHide: true,
        cwd: tempDir
      });
      process.exit(0);
    } else {
      // For now, just show info and continue
      showDialog('Update Available', `An update (v${updateInfo.version}) is available.\n\nPlease download from:\n${CONFIG.downloadUrl}`);
    }
  } catch (err) {
    log(`Update failed: ${err.message}`, 'ERROR');
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

// Launch G-Rump
async function launch() {
  log('Starting G-Rump...');
  
  // Check if installed
  if (!fs.existsSync(CONFIG.exePath)) {
    log('G-Rump not found. Installing...');
    if (!await install()) {
      return;
    }
  }
  
  // Check for updates
  const shouldCheck = true; // Could be made smarter with last-check timestamp
  if (shouldCheck) {
    const updateInfo = await checkForUpdates();
    if (updateInfo.available) {
      await performUpdate(updateInfo);
      return;
    }
  }
  
  // Launch the application
  try {
    const child = spawn(CONFIG.exePath, [], {
      detached: true,
      stdio: 'ignore',
      windowsHide: false,
      cwd: CONFIG.installDir
    });
    
    child.unref();
    log('G-Rump launched successfully');
    
    // Exit launcher after launching
    setTimeout(() => process.exit(0), 1000);
  } catch (err) {
    log(`Failed to start: ${err.message}`, 'ERROR');
    showDialog('Launch Error', `Failed to start G-Rump: ${err.message}`, 'error');
  }
}

// Show help
function showHelp() {
  console.log(`
G-Rump Launcher v${CONFIG.version}

Usage: G-Rump.exe [options]

Options:
  --install       Install G-Rump
  --uninstall     Uninstall G-Rump
  --update        Force update check
  --skip-update   Skip update check
  --help          Show this help

Examples:
  G-Rump.exe              Launch G-Rump (checks for updates)
  G-Rump.exe --install    Install G-Rump
  G-Rump.exe --update     Force update check
`);
}

// Uninstall
function uninstall() {
  log('Uninstalling G-Rump...');
  
  try {
    // Kill running processes
    if (process.platform === 'win32') {
      exec('taskkill /F /IM G-Rump.exe /T 2>nul', { windowsHide: true });
    }
    
    // Remove install directory
    if (fs.existsSync(CONFIG.installDir)) {
      fs.rmSync(CONFIG.installDir, { recursive: true, force: true });
    }
    
    // Remove desktop shortcut
    const desktopPath = path.join(os.homedir(), 'Desktop', 'G-Rump.lnk');
    if (fs.existsSync(desktopPath)) {
      fs.unlinkSync(desktopPath);
    }
    
    log('Uninstallation complete');
    showDialog('Uninstalled', 'G-Rump has been uninstalled successfully.');
  } catch (err) {
    log(`Uninstall failed: ${err.message}`, 'ERROR');
  }
}

// Main entry point
async function main() {
  log('=== G-Rump Launcher v${CONFIG.version} ===');
  
  const args = process.argv.slice(2);
  
  if (args.includes('--help') || args.includes('-h')) {
    showHelp();
    return;
  }
  
  if (args.includes('--install')) {
    await install();
    return;
  }
  
  if (args.includes('--uninstall')) {
    uninstall();
    return;
  }
  
  if (args.includes('--update')) {
    const updateInfo = await checkForUpdates();
    if (updateInfo.available) {
      await performUpdate(updateInfo);
    } else {
      showDialog('No Updates', 'You are running the latest version.');
    }
    return;
  }
  
  // Normal launch
  await launch();
}

// Handle errors
process.on('uncaughtException', (err) => {
  log(`Uncaught exception: ${err.message}`, 'ERROR');
  process.exit(1);
});

process.on('unhandledRejection', (err) => {
  log(`Unhandled rejection: ${err}`, 'ERROR');
  process.exit(1);
});

// Run
main().catch(err => {
  log(`Fatal error: ${err.message}`, 'ERROR');
  process.exit(1);
});
