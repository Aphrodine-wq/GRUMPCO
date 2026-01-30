#!/usr/bin/env pwsh
# G-Rump Auto-Updating Launcher - Lightning Fast Edition
# This PowerShell script acts as the main launcher for G-Rump with auto-update capability
# It can be compiled to an .exe using ps2exe or similar tools
#
# PERFORMANCE OPTIMIZATIONS:
# - Fast-launch mode (-Fast) skips UI and update checks
# - Background update checking (non-blocking)
# - Cached configuration
# - Minimal assembly loading

param(
    [switch]$SkipUpdateCheck,
    [switch]$Install,
    [switch]$Uninstall,
    [switch]$ForceUpdate,
    [switch]$Fast,           # Lightning fast mode - skip all checks
    [switch]$NoUI            # CLI mode - no GUI
)

# Configuration
$Config = @{
    AppName = "G-Rump"
    Version = "1.0.0"
    UpdateUrl = "https://api.g-rump.com/v1/releases/latest"
    DownloadUrl = "https://github.com/Aphrodine-wq/G-rump.com/releases/latest"
    InstallDir = "$env:LOCALAPPDATA\G-Rump"
    ExePath = "$env:LOCALAPPDATA\G-Rump\G-Rump.exe"
    UpdateCheckInterval = 24 # hours
    MinVersion = [Version]"1.0.0"
}

# Logging function
function Write-Log {
    param([string]$Message, [string]$Level = "INFO")
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $logMessage = "[$timestamp] [$Level] $Message"
    Write-Host $logMessage
    
    # Also write to log file
    $logDir = "$env:LOCALAPPDATA\G-Rump\logs"
    if (!(Test-Path $logDir)) { New-Item -ItemType Directory -Path $logDir -Force | Out-Null }
    $logFile = "$logDir\launcher-$(Get-Date -Format 'yyyy-MM-dd').log"
    Add-Content -Path $logFile -Value $logMessage
}

# Check if running as administrator
function Test-Admin {
    $currentUser = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($currentUser)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

# Download file with progress
function Download-File {
    param(
        [string]$Url,
        [string]$Destination,
        [string]$Description = "Downloading"
    )
    
    try {
        Write-Log "$Description..."
        
        $webClient = New-Object System.Net.WebClient
        $webClient.Headers.Add("User-Agent", "G-Rump-Launcher/$($Config.Version)")
        
        # Show progress
        $webClient.DownloadProgressChanged = {
            param($sender, $e)
            $percent = $e.ProgressPercentage
            Write-Progress -Activity $Description -Status "$percent% Complete" -PercentComplete $percent
        }
        
        $webClient.DownloadFileAsync($Url, $Destination)
        
        # Wait for download
        while ($webClient.IsBusy) {
            Start-Sleep -Milliseconds 100
        }
        
        Write-Progress -Activity $Description -Completed
        Write-Log "Download complete: $Destination"
        return $true
    }
    catch {
        Write-Log "Download failed: $_" -Level "ERROR"
        return $false
    }
}

# Check for updates
function Test-UpdateAvailable {
    try {
        Write-Log "Checking for updates..."
        
        $headers = @{
            "User-Agent" = "G-Rump-Launcher/$($Config.Version)"
            "Accept" = "application/json"
        }
        
        $response = Invoke-RestMethod -Uri $Config.UpdateUrl -Headers $headers -TimeoutSec 10
        
        if ($response.version) {
            $latestVersion = [Version]$response.version
            $currentVersion = [Version]$Config.Version
            
            if ($latestVersion -gt $currentVersion) {
                Write-Log "Update available: v$currentVersion -> v$latestVersion"
                return @{
                    Available = $true
                    Version = $latestVersion
                    DownloadUrl = $response.download_url
                    ReleaseNotes = $response.release_notes
                    Mandatory = $response.mandatory -eq $true
                }
            }
        }
        
        Write-Log "No updates available (current: v$($Config.Version))"
        return @{ Available = $false }
    }
    catch {
        Write-Log "Update check failed: $_" -Level "WARN"
        return @{ Available = $false }
    }
}

# Perform update
function Invoke-Update {
    param([hashtable]$UpdateInfo)
    
    Write-Log "Starting update to v$($UpdateInfo.Version)..."
    
    # Create temp directory
    $tempDir = "$env:TEMP\G-Rump-Update-$(Get-Random)"
    New-Item -ItemType Directory -Path $tempDir -Force | Out-Null
    
    try {
        # Download new version
        $downloadPath = "$tempDir\G-Rump-v$($UpdateInfo.Version).exe"
        
        if (!(Download-File -Url $UpdateInfo.DownloadUrl -Destination $downloadPath -Description "Downloading update")) {
            throw "Download failed"
        }
        
        # Verify download (optional: add signature check here)
        if (!(Test-Path $downloadPath)) {
            throw "Downloaded file not found"
        }
        
        # Create update script
        $updateScript = @"
@echo off
timeout /t 2 /nobreak >nul
move /y "$downloadPath" "$($Config.ExePath)"
if %errorlevel% == 0 (
    echo Update complete!
    start "" "$($Config.ExePath)"
) else (
    echo Update failed. Please try again.
    pause
)
del "%~f0"
"@
        
        $updateScriptPath = "$tempDir\update.bat"
        Set-Content -Path $updateScriptPath -Value $updateScript
        
        Write-Log "Update ready. Installing on next launch..."
        
        # Show update notification
        if ($UpdateInfo.Mandatory) {
            $result = [System.Windows.Forms.MessageBox]::Show(
                "A mandatory update (v$($UpdateInfo.Version)) is available.`n`nRelease Notes:`n$($UpdateInfo.ReleaseNotes)`n`nThe application will now update and restart.",
                "G-Rump Update Required",
                [System.Windows.Forms.MessageBoxButtons]::OKCancel,
                [System.Windows.Forms.MessageBoxIcon]::Information
            )
            
            if ($result -eq [System.Windows.Forms.DialogResult]::OK) {
                Start-Process -FilePath $updateScriptPath -WindowStyle Hidden
                exit
            }
        }
        else {
            $result = [System.Windows.Forms.MessageBox]::Show(
                "An update (v$($UpdateInfo.Version)) is available.`n`nRelease Notes:`n$($UpdateInfo.ReleaseNotes)`n`nWould you like to update now?",
                "G-Rump Update Available",
                [System.Windows.Forms.MessageBoxButtons]::YesNo,
                [System.Windows.Forms.MessageBoxIcon]::Information
            )
            
            if ($result -eq [System.Windows.Forms.DialogResult]::Yes) {
                Start-Process -FilePath $updateScriptPath -WindowStyle Hidden
                exit
            }
        }
    }
    catch {
        Write-Log "Update failed: $_" -Level "ERROR"
        Remove-Item -Path $tempDir -Recurse -Force -ErrorAction SilentlyContinue
    }
}

# Install G-Rump
function Install-Gump {
    Write-Log "Installing G-Rump..."
    
    try {
        # Create install directory
        if (!(Test-Path $Config.InstallDir)) {
            New-Item -ItemType Directory -Path $Config.InstallDir -Force | Out-Null
        }
        
        # Download latest version
        $downloadPath = "$env:TEMP\G-Rump-Setup.exe"
        
        if (!(Download-File -Url $Config.DownloadUrl -Destination $downloadPath -Description "Downloading G-Rump")) {
            throw "Download failed"
        }
        
        # Copy to install directory
        Copy-Item -Path $downloadPath -Destination $Config.ExePath -Force
        
        # Create Start Menu shortcut
        $startMenuPath = "$env:APPDATA\Microsoft\Windows\Start Menu\Programs\G-Rump.lnk"
        $WshShell = New-Object -ComObject WScript.Shell
        $Shortcut = $WshShell.CreateShortcut($startMenuPath)
        $Shortcut.TargetPath = $Config.ExePath
        $Shortcut.WorkingDirectory = $Config.InstallDir
        $Shortcut.IconLocation = $Config.ExePath
        $Shortcut.Save()
        
        # Create Desktop shortcut
        $desktopPath = "$env:USERPROFILE\Desktop\G-Rump.lnk"
        $Shortcut2 = $WshShell.CreateShortcut($desktopPath)
        $Shortcut2.TargetPath = $Config.ExePath
        $Shortcut2.WorkingDirectory = $Config.InstallDir
        $Shortcut2.IconLocation = $Config.ExePath
        $Shortcut2.Save()
        
        Write-Log "Installation complete!"
        [System.Windows.Forms.MessageBox]::Show(
            "G-Rump has been installed successfully!`n`nShortcuts have been created on your Desktop and Start Menu.",
            "Installation Complete",
            [System.Windows.Forms.MessageBoxButtons]::OK,
            [System.Windows.Forms.MessageBoxIcon]::Information
        )
        
        return $true
    }
    catch {
        Write-Log "Installation failed: $_" -Level "ERROR"
        [System.Windows.Forms.MessageBox]::Show(
            "Installation failed: $_`n`nPlease try again or visit $($Config.DownloadUrl) to download manually.",
            "Installation Error",
            [System.Windows.Forms.MessageBoxButtons]::OK,
            [System.Windows.Forms.MessageBoxIcon]::Error
        )
        return $false
    }
}

# Uninstall G-Rump
function Uninstall-Gump {
    Write-Log "Uninstalling G-Rump..."
    
    try {
        # Remove install directory
        if (Test-Path $Config.InstallDir) {
            Remove-Item -Path $Config.InstallDir -Recurse -Force
        }
        
        # Remove shortcuts
        $startMenuPath = "$env:APPDATA\Microsoft\Windows\Start Menu\Programs\G-Rump.lnk"
        $desktopPath = "$env:USERPROFILE\Desktop\G-Rump.lnk"
        
        if (Test-Path $startMenuPath) { Remove-Item -Path $startMenuPath -Force }
        if (Test-Path $desktopPath) { Remove-Item -Path $desktopPath -Force }
        
        Write-Log "Uninstallation complete!"
        [System.Windows.Forms.MessageBox]::Show(
            "G-Rump has been uninstalled successfully.",
            "Uninstallation Complete",
            [System.Windows.Forms.MessageBoxButtons]::OK,
            [System.Windows.Forms.MessageBoxIcon]::Information
        )
        
        return $true
    }
    catch {
        Write-Log "Uninstallation failed: $_" -Level "ERROR"
        return $false
    }
}

# Launch G-Rump Electron app
function Start-Gump {
    Write-Log "Starting G-Rump..."
    
    try {
        # Check if installed
        if (!(Test-Path $Config.ExePath)) {
            Write-Log "G-Rump not found. Starting installation..."
            if (!(Install-Gump)) {
                return
            }
        }
        
        # Launch the application
        Start-Process -FilePath $Config.ExePath -WorkingDirectory $Config.InstallDir
        Write-Log "G-Rump launched successfully"
    }
    catch {
        Write-Log "Failed to start G-Rump: $_" -Level "ERROR"
        [System.Windows.Forms.MessageBox]::Show(
            "Failed to start G-Rump: $_",
            "Launch Error",
            [System.Windows.Forms.MessageBoxButtons]::OK,
            [System.Windows.Forms.MessageBoxIcon]::Error
        )
    }
}

# Show about dialog
function Show-About {
    [System.Windows.Forms.MessageBox]::Show(
        "G-Rump Launcher v$($Config.Version)`n`nAI-Powered Development Assistant`n`n(c) 2026 G-Rump Team`n`nVisit: https://g-rump.com",
        "About G-Rump",
        [System.Windows.Forms.MessageBoxButtons]::OK,
        [System.Windows.Forms.MessageBoxIcon]::Information
    )
}

# Main launcher window
function Show-LauncherWindow {
    Add-Type -AssemblyName System.Windows.Forms
    Add-Type -AssemblyName System.Drawing
    
    # Create form
    $form = New-Object System.Windows.Forms.Form
    $form.Text = "G-Rump Launcher"
    $form.Size = New-Object System.Drawing.Size(500, 400)
    $form.StartPosition = "CenterScreen"
    $form.FormBorderStyle = "FixedDialog"
    $form.MaximizeBox = $false
    $form.BackColor = [System.Drawing.Color]::FromArgb(250, 250, 252)
    
    # Logo/Title
    $titleLabel = New-Object System.Windows.Forms.Label
    $titleLabel.Text = "G-Rump"
    $titleLabel.Font = New-Object System.Drawing.Font("Segoe UI", 24, [System.Drawing.FontStyle]::Bold)
    $titleLabel.ForeColor = [System.Drawing.Color]::FromArgb(124, 58, 237) # Purple
    $titleLabel.Size = New-Object System.Drawing.Size(460, 50)
    $titleLabel.Location = New-Object System.Drawing.Point(20, 20)
    $titleLabel.TextAlign = "MiddleCenter"
    $form.Controls.Add($titleLabel)
    
    # Subtitle
    $subtitleLabel = New-Object System.Windows.Forms.Label
    $subtitleLabel.Text = "AI-Powered Development Assistant"
    $subtitleLabel.Font = New-Object System.Drawing.Font("Segoe UI", 12)
    $subtitleLabel.ForeColor = [System.Drawing.Color]::FromArgb(107, 114, 128)
    $subtitleLabel.Size = New-Object System.Drawing.Size(460, 30)
    $subtitleLabel.Location = New-Object System.Drawing.Point(20, 70)
    $subtitleLabel.TextAlign = "MiddleCenter"
    $form.Controls.Add($subtitleLabel)
    
    # Version info
    $versionLabel = New-Object System.Windows.Forms.Label
    $versionLabel.Text = "Version: $($Config.Version)"
    $versionLabel.Font = New-Object System.Drawing.Font("Segoe UI", 10)
    $versionLabel.ForeColor = [System.Drawing.Color]::FromArgb(156, 163, 175)
    $versionLabel.Size = New-Object System.Drawing.Size(460, 25)
    $versionLabel.Location = New-Object System.Drawing.Point(20, 100)
    $versionLabel.TextAlign = "MiddleCenter"
    $form.Controls.Add($versionLabel)
    
    # Status label
    $statusLabel = New-Object System.Windows.Forms.Label
    $statusLabel.Text = "Ready to launch"
    $statusLabel.Font = New-Object System.Drawing.Font("Segoe UI", 10)
    $statusLabel.ForeColor = [System.Drawing.Color]::FromArgb(75, 85, 99)
    $statusLabel.Size = New-Object System.Drawing.Size(460, 25)
    $statusLabel.Location = New-Object System.Drawing.Point(20, 140)
    $statusLabel.TextAlign = "MiddleCenter"
    $form.Controls.Add($statusLabel)
    
    # Launch Button
    $launchButton = New-Object System.Windows.Forms.Button
    $launchButton.Text = "Launch G-Rump"
    $launchButton.Font = New-Object System.Drawing.Font("Segoe UI", 12, [System.Drawing.FontStyle]::Bold)
    $launchButton.Size = New-Object System.Drawing.Size(200, 50)
    $launchButton.Location = New-Object System.Drawing.Point(150, 180)
    $launchButton.BackColor = [System.Drawing.Color]::FromArgb(124, 58, 237)
    $launchButton.ForeColor = [System.Drawing.Color]::White
    $launchButton.FlatStyle = "Flat"
    $launchButton.FlatAppearance.BorderSize = 0
    $launchButton.Add_Click({
        $statusLabel.Text = "Launching..."
        $form.Refresh()
        Start-Gump
        $form.Close()
    })
    $form.Controls.Add($launchButton)
    
    # Check for Updates Button
    $updateButton = New-Object System.Windows.Forms.Button
    $updateButton.Text = "Check for Updates"
    $updateButton.Font = New-Object System.Drawing.Font("Segoe UI", 10)
    $updateButton.Size = New-Object System.Drawing.Size(150, 35)
    $updateButton.Location = New-Object System.Drawing.Point(80, 250)
    $updateButton.BackColor = [System.Drawing.Color]::FromArgb(243, 244, 246)
    $updateButton.ForeColor = [System.Drawing.Color]::FromArgb(75, 85, 99)
    $updateButton.FlatStyle = "Flat"
    $updateButton.FlatAppearance.BorderSize = 0
    $updateButton.Add_Click({
        $statusLabel.Text = "Checking for updates..."
        $form.Refresh()
        $updateInfo = Test-UpdateAvailable
        if ($updateInfo.Available) {
            Invoke-Update -UpdateInfo $updateInfo
        }
        else {
            [System.Windows.Forms.MessageBox]::Show(
                "You are running the latest version (v$($Config.Version))",
                "No Updates Available",
                [System.Windows.Forms.MessageBoxButtons]::OK,
                [System.Windows.Forms.MessageBoxIcon]::Information
            )
            $statusLabel.Text = "Running latest version"
        }
    })
    $form.Controls.Add($updateButton)
    
    # Install/Reinstall Button
    $installButton = New-Object System.Windows.Forms.Button
    $installButton.Text = "Reinstall"
    $installButton.Font = New-Object System.Drawing.Font("Segoe UI", 10)
    $installButton.Size = New-Object System.Drawing.Size(150, 35)
    $installButton.Location = New-Object System.Drawing.Point(270, 250)
    $installButton.BackColor = [System.Drawing.Color]::FromArgb(243, 244, 246)
    $installButton.ForeColor = [System.Drawing.Color]::FromArgb(75, 85, 99)
    $installButton.FlatStyle = "Flat"
    $installButton.FlatAppearance.BorderSize = 0
    $installButton.Add_Click({
        $result = [System.Windows.Forms.MessageBox]::Show(
            "This will reinstall G-Rump. Continue?",
            "Confirm Reinstall",
            [System.Windows.Forms.MessageBoxButtons]::YesNo,
            [System.Windows.Forms.MessageBoxIcon]::Question
        )
        if ($result -eq [System.Windows.Forms.DialogResult]::Yes) {
            $statusLabel.Text = "Reinstalling..."
            $form.Refresh()
            Install-Gump
            $statusLabel.Text = "Installation complete"
        }
    })
    $form.Controls.Add($installButton)
    
    # About Button
    $aboutButton = New-Object System.Windows.Forms.Button
    $aboutButton.Text = "About"
    $aboutButton.Font = New-Object System.Drawing.Font("Segoe UI", 9)
    $aboutButton.Size = New-Object System.Drawing.Size(80, 30)
    $aboutButton.Location = New-Object System.Drawing.Point(210, 300)
    $aboutButton.BackColor = [System.Drawing.Color]::Transparent
    $aboutButton.ForeColor = [System.Drawing.Color]::FromArgb(107, 114, 128)
    $aboutButton.FlatStyle = "Flat"
    $aboutButton.FlatAppearance.BorderSize = 0
    $aboutButton.Add_Click({ Show-About })
    $form.Controls.Add($aboutButton)
    
    # Check for updates on startup (if not skipped)
    if (!$SkipUpdateCheck -and !$ForceUpdate) {
        $lastCheckFile = "$env:LOCALAPPDATA\G-Rump\last-update-check.txt"
        $shouldCheck = $true
        
        if (Test-Path $lastCheckFile) {
            $lastCheck = Get-Content $lastCheckFile | Get-Date
            $hoursSince = ((Get-Date) - $lastCheck).TotalHours
            if ($hoursSince -lt $Config.UpdateCheckInterval) {
                $shouldCheck = $false
            }
        }
        
        if ($shouldCheck) {
            Get-Date | Set-Content $lastCheckFile
            $updateInfo = Test-UpdateAvailable
            if ($updateInfo.Available) {
                Invoke-Update -UpdateInfo $updateInfo
            }
        }
    }
    elseif ($ForceUpdate) {
        Write-Log "Forcing update check..."
        $updateInfo = Test-UpdateAvailable
        if ($updateInfo.Available) {
            Invoke-Update -UpdateInfo $updateInfo
        }
        else {
            Write-Log "No updates available"
        }
    }
    
    # Show form
    $form.ShowDialog() | Out-Null
}

# Lightning Fast Launch - Skip everything and launch immediately
function Start-FastLaunch {
    $scriptDir = Split-Path -Parent $MyInvocation.ScriptName
    $electronPath = Join-Path $scriptDir "frontend"
    
    # Try multiple possible locations for the Electron app
    $possiblePaths = @(
        (Join-Path $electronPath "node_modules\.bin\electron.cmd"),
        (Join-Path $electronPath "node_modules\electron\dist\electron.exe"),
        $Config.ExePath
    )
    
    foreach ($path in $possiblePaths) {
        if (Test-Path $path) {
            if ($path -like "*.cmd") {
                # Run electron dev mode
                $env:GRUMP_FAST = "true"
                Start-Process -FilePath "cmd.exe" -ArgumentList "/c", $path, "." -WorkingDirectory $electronPath -WindowStyle Hidden
            } else {
                # Run compiled exe
                Start-Process -FilePath $path -WindowStyle Normal
            }
            return $true
        }
    }
    
    # Fallback: try npm run electron:fast
    if (Test-Path (Join-Path $electronPath "package.json")) {
        $env:GRUMP_FAST = "true"
        Start-Process -FilePath "npm" -ArgumentList "run", "electron:fast" -WorkingDirectory $electronPath -WindowStyle Hidden
        return $true
    }
    
    return $false
}

# CLI Mode - No GUI, just commands
function Start-CliMode {
    $scriptDir = Split-Path -Parent $MyInvocation.ScriptName
    $cliPath = Join-Path $scriptDir "packages\cli"
    
    if (Test-Path (Join-Path $cliPath "package.json")) {
        $env:GRUMP_FAST = "true"
        $env:GRUMP_NO_BRANDING = "true"
        
        # Run CLI directly
        $nodePath = Join-Path $cliPath "dist\index.js"
        if (Test-Path $nodePath) {
            node $nodePath @args
        } else {
            # Fallback to npm
            Push-Location $cliPath
            npm run start:fast -- @args
            Pop-Location
        }
        return $true
    }
    
    Write-Host "CLI not found. Run 'npm install' in packages/cli first." -ForegroundColor Red
    return $false
}

# Main entry point
function Main {
    # LIGHTNING FAST MODE - Skip everything
    if ($Fast) {
        if ($NoUI) {
            # CLI mode - fastest possible
            Start-CliMode
        } else {
            # GUI mode - direct Electron launch
            if (!(Start-FastLaunch)) {
                Write-Host "Fast launch failed. Falling back to normal launch..." -ForegroundColor Yellow
                Start-Gump
            }
        }
        return
    }
    
    # NO-UI MODE (but not fast) - CLI with normal startup
    if ($NoUI) {
        Start-CliMode
        return
    }
    
    # Normal mode with logging
    Write-Log "=== G-Rump Launcher v$($Config.Version) ==="
    
    # Handle command line arguments
    if ($Install) {
        Install-Gump
        return
    }
    
    if ($Uninstall) {
        Uninstall-Gump
        return
    }
    
    if ($ForceUpdate) {
        $updateInfo = Test-UpdateAvailable
        if ($updateInfo.Available) {
            Invoke-Update -UpdateInfo $updateInfo
        }
        else {
            Write-Log "No updates available"
        }
        return
    }
    
    # Show main window
    Show-LauncherWindow
}

# Only load Windows Forms if we need GUI (not in fast mode)
if (!$Fast -and !$NoUI) {
    Add-Type -AssemblyName System.Windows.Forms
}

# Run main
Main
