; G-Rump Professional Windows Installer
; NSIS Script for G-Rump Desktop App and CLI
; Version: 1.0.0
; Author: G-Rump Team

; ============================================
; COMPRESSION AND GENERAL SETTINGS
; ============================================
SetCompressor /SOLID lzma
SetCompressorDictSize 64
SetDatablockOptimize on
CRCCheck on
Unicode true
ManifestDPIAware true
RequestExecutionLevel admin

; ============================================
; INCLUDE MODERN UI AND PLUGINS
; ============================================
!include "MUI2.nsh"
!include "LogicLib.nsh"
!include "x64.nsh"
!include "FileFunc.nsh"
!include "WordFunc.nsh"
!include "nsDialogs.nsh"

; ============================================
; PRODUCT INFORMATION
; ============================================
!define PRODUCT_NAME "G-Rump"
!define PRODUCT_VERSION "1.0.0"
!define PRODUCT_PUBLISHER "G-Rump Team"
!define PRODUCT_WEB_SITE "https://grump.dev"
!define PRODUCT_SUPPORT "https://grump.dev/support"
!define PRODUCT_DIR_REGKEY "Software\Microsoft\Windows\CurrentVersion\App Paths\G-Rump.exe"
!define PRODUCT_UNINST_KEY "Software\Microsoft\Windows\CurrentVersion\Uninstall\${PRODUCT_NAME}"
!define PRODUCT_UNINST_ROOT_KEY "HKLM"

; G-Rump Brand Colors (Purple Theme)
!define MUI_BGCOLOR "6B21A8"
!define MUI_HEADER_BGCOLOR "6B21A8"
!define MUI_HEADER_TEXT_COLOR "FFFFFF"
!define MUI_HEADER_TRANSPARENT_TEXT "FFFFFF"
!define MUI_WELCOMEFINISH_BGCOLOR "3B0764"

; ============================================
; INSTALLER CONFIGURATION
; ============================================
Name "${PRODUCT_NAME} ${PRODUCT_VERSION}"
OutFile "G-Rump-Setup-v${PRODUCT_VERSION}.exe"
InstallDir "$PROGRAMFILES64\G-Rump"
InstallDirRegKey HKLM "${PRODUCT_DIR_REGKEY}" ""
ShowInstDetails show
ShowUnInstDetails show
BrandingText "G-Rump - AI-Powered Project Management"

; Version Information
VIProductVersion "1.0.0.0"
VIAddVersionKey "ProductName" "G-Rump"
VIAddVersionKey "CompanyName" "G-Rump Team"
VIAddVersionKey "LegalCopyright" "© 2024 G-Rump Team. All rights reserved."
VIAddVersionKey "FileDescription" "G-Rump Desktop Application and CLI Installer"
VIAddVersionKey "FileVersion" "1.0.0"
VIAddVersionKey "ProductVersion" "1.0.0"

; ============================================
; INTERFACE CONFIGURATION
; ============================================
!define MUI_ABORTWARNING
!define MUI_ABORTWARNING_CANCEL_DEFAULT
!define MUI_FINISHPAGE_NOAUTOCLOSE
!define MUI_UNFINISHPAGE_NOAUTOCLOSE

; Welcome Page
!define MUI_WELCOMEPAGE_TITLE "Welcome to G-Rump Setup"
!define MUI_WELCOMEPAGE_TEXT "Setup will guide you through the installation of G-Rump ${PRODUCT_VERSION} on your computer.$\r$\n$\r$\nG-Rump is an AI-powered project management tool that combines the power of CLI and Desktop interface.$\r$\n$\r$\nIt is recommended that you close all other applications before continuing.$\r$\n$\r$\nClick Next to continue, or Cancel to exit Setup."

; License Page
!define MUI_LICENSEPAGE_TEXT_TOP "Please read the following license agreement carefully."
!define MUI_LICENSEPAGE_TEXT_BOTTOM "If you accept the terms of the agreement, click I Agree to continue. You must accept the agreement to install G-Rump."
!define MUI_LICENSEPAGE_BUTTON "I Agree"

; Components Page
!define MUI_COMPONENTSPAGE_TEXT_TOP "Select the components you want to install. Click Next when you are ready to continue."
!define MUI_COMPONENTSPAGE_TEXT_TOP_COMP "Select the components you want to install. Required components are disabled."
!define MUI_COMPONENTSPAGE_TEXT_BOTTOM "Space required: $0 MB. Space available: $1 MB."

; Directory Page
!define MUI_DIRECTORYPAGE_TEXT_TOP "Setup will install G-Rump in the following folder. To install in a different folder, click Browse and select another folder. Click Next to continue."
!define MUI_DIRECTORYPAGE_TEXT_BOTTOM "Space required: $0 MB. Space available: $1 MB."

; Instfiles Page
!define MUI_INSTFILESPAGE_FINISHHEADER_TEXT "Installation Complete"
!define MUI_INSTFILESPAGE_FINISHHEADER_SUBTEXT "Setup was completed successfully."
!define MUI_INSTFILESPAGE_ABORTHEADER_TEXT "Installation Aborted"
!define MUI_INSTFILESPAGE_ABORTHEADER_SUBTEXT "Setup was not completed successfully."

; Finish Page
!define MUI_FINISHPAGE_TITLE "Completing G-Rump Setup"
!define MUI_FINISHPAGE_TEXT "G-Rump ${PRODUCT_VERSION} has been installed on your computer.$\r$\n$\r$\nClick Finish to close Setup."
!define MUI_FINISHPAGE_RUN "$INSTDIR\G-Rump.exe"
!define MUI_FINISHPAGE_RUN_TEXT "Launch G-Rump Desktop"
!define MUI_FINISHPAGE_RUN_NOTCHECKED
!define MUI_FINISHPAGE_SHOWREADME "$INSTDIR\README.txt"
!define MUI_FINISHPAGE_SHOWREADME_TEXT "Show Release Notes"
!define MUI_FINISHPAGE_SHOWREADME_NOTCHECKED

; Icons and Images
!define MUI_ICON "assets\logo.ico"
!define MUI_UNICON "assets\logo.ico"
!define MUI_HEADERIMAGE
!define MUI_HEADERIMAGE_RIGHT
!define MUI_HEADERIMAGE_BITMAP "assets\installer-header.bmp"
!define MUI_HEADERIMAGE_UNBITMAP "assets\installer-header.bmp"
!define MUI_WELCOMEFINISHPAGE_BITMAP "assets\welcome.bmp"
!define MUI_UNWELCOMEFINISHPAGE_BITMAP "assets\welcome.bmp"

; ============================================
; INSTALLER PAGES
; ============================================
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_LICENSE "LICENSE.txt"
!insertmacro MUI_PAGE_COMPONENTS
!insertmacro MUI_PAGE_DIRECTORY

; Custom Node.js Check Page
Page custom CheckNodePage CheckNodePageLeave

; Custom Docker Check Page
Page custom CheckDockerPage CheckDockerPageLeave

!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH

; ============================================
; UNINSTALLER PAGES
; ============================================
!insertmacro MUI_UNPAGE_WELCOME
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_UNPAGE_FINISH

; ============================================
; LANGUAGES
; ============================================
!insertmacro MUI_LANGUAGE "English"

; ============================================
; VARIABLES
; ============================================
Var NodeInstalled
Var NodeVersion
Var DockerInstalled
Var InstallNode
Var InstallDocker
Var DownloadProgress
Var InstallProgress
Var TempDir

; ============================================
; COMPONENT DESCRIPTIONS
; ============================================
LangString DESC_CoreComponents ${LANG_ENGLISH} "Core G-Rump application files (required)"
LangString DESC_DesktopApp ${LANG_ENGLISH} "G-Rump Desktop - Electron-based GUI application"
LangString DESC_CLI ${LANG_ENGLISH} "G-Rump CLI - Command-line interface tools (grump-cli)"
LangString DESC_Templates ${LANG_ENGLISH} "Sample project templates for quick start"
LangString DESC_Shortcuts ${LANG_ENGLISH} "Desktop and Start Menu shortcuts"
LangString DESC_Documentation ${LANG_ENGLISH} "Documentation and help files"

; ============================================
; INSTALLER SECTIONS
; ============================================

; Core Components (Required)
Section "Core Components" SEC01
    SectionIn RO
    SetOutPath "$INSTDIR"
    SetOverwrite ifnewer
    
    DetailPrint "Installing G-Rump Core Components..."
    
    ; Create directory structure
    CreateDirectory "$INSTDIR\bin"
    CreateDirectory "$INSTDIR\lib"
    CreateDirectory "$INSTDIR\resources"
    CreateDirectory "$INSTDIR\templates"
    CreateDirectory "$INSTDIR\assets"
    
    ; Install main executable
    File /oname=G-Rump.exe "dist\G-Rump.exe"
    File "LICENSE.txt"
    File "README.txt"
    File "CHANGELOG.txt"
    
    ; Install resources
    SetOutPath "$INSTDIR\resources"
    File /r "resources\*.*"
    
    ; Install assets
    SetOutPath "$INSTDIR\assets"
    File /r "assets\*.*"
    
    ; Create app data directory
    CreateDirectory "$LOCALAPPDATA\G-Rump"
    CreateDirectory "$LOCALAPPDATA\G-Rump\config"
    CreateDirectory "$LOCALAPPDATA\G-Rump\logs"
    CreateDirectory "$LOCALAPPDATA\G-Rump\cache"
    
    ; Write configuration
    SetOutPath "$LOCALAPPDATA\G-Rump\config"
    File "installer-config.json"
    
    DetailPrint "Core Components installed successfully."
SectionEnd

; Desktop Application
Section "G-Rump Desktop" SEC02
    SetOutPath "$INSTDIR"
    
    DetailPrint "Installing G-Rump Desktop Application..."
    
    ; Install Electron app files
    File /r "desktop-app\*.*"
    
    ; Register application
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\App Paths\G-Rump.exe" "" "$INSTDIR\G-Rump.exe"
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\App Paths\G-Rump.exe" "Path" "$INSTDIR"
    
    ; Register file associations
    WriteRegStr HKCR "G-RumpProject" "" "G-Rump Project File"
    WriteRegStr HKCR "G-RumpProject\DefaultIcon" "" "$INSTDIR\assets\logo.ico"
    WriteRegStr HKCR "G-RumpProject\shell\open\command" "" '"$INSTDIR\G-Rump.exe" "%1"'
    WriteRegStr HKCR ".grump" "" "G-RumpProject"
    
    DetailPrint "Desktop Application installed successfully."
SectionEnd

; CLI Tools
Section "G-Rump CLI" SEC03
    SetOutPath "$INSTDIR\bin"
    
    DetailPrint "Installing G-Rump CLI Tools..."
    
    ; Install CLI wrapper script
    FileOpen $0 "$INSTDIR\bin\grump.bat" w
    FileWrite $0 "@echo off$$\n"
    FileWrite $0 ":: G-Rump CLI Wrapper$$\n"
    FileWrite $0 ":: This script ensures grump-cli is available globally$$\n"
    FileWrite $0 "$$\n"
    FileWrite $0 'if not exist "$INSTDIR\\node_modules\\grump-cli" ($$\n'
    FileWrite $0 "  echo Installing grump-cli...$$\n"
    FileWrite $0 "  call npm install -g grump-cli$$\n"
    FileWrite $0 '  if %ERRORLEVEL% neq 0 ($$\n'
    FileWrite $0 "    echo Failed to install grump-cli$$\n"
    FileWrite $0 "    exit /b 1$$\n"
    FileWrite $0 "  )$$\n"
    FileWrite $0 ")$$\n"
    FileWrite $0 "grump %*$$\n"
    FileClose $0
    
    ; Install PowerShell wrapper for modern Windows
    FileOpen $0 "$INSTDIR\bin\grump.ps1" w
    FileWrite $0 "# G-Rump CLI PowerShell Wrapper$$\n"
    FileWrite $0 "# This script ensures grump-cli is available globally$$\n"
    FileWrite $0 "$$\n"
    FileWrite $0 "$grumpPath = Get-Command grump -ErrorAction SilentlyContinue$$\n"
    FileWrite $0 "if (-not $grumpPath) {$$\n"
    FileWrite $0 "    Write-Host 'Installing grump-cli...' -ForegroundColor Cyan$$\n"
    FileWrite $0 "    npm install -g grump-cli$$\n"
    FileWrite $0 "    if ($LASTEXITCODE -ne 0) {$$\n"
    FileWrite $0 "        Write-Error 'Failed to install grump-cli'$$\n"
    FileWrite $0 "        exit 1$$\n"
    FileWrite $0 "    }$$\n"
    FileWrite $0 "}$$\n"
    FileWrite $0 "grump $args$$\n"
    FileClose $0
    
    ; Install CLI globally via npm
    DetailPrint "Installing grump-cli from npm..."
    nsExec::ExecToStack 'cmd.exe /c npm install -g grump-cli'
    Pop $0
    Pop $1
    
    ${If} $0 == "0"
        DetailPrint "grump-cli installed successfully."
    ${Else}
        DetailPrint "Warning: Could not install grump-cli automatically."
        DetailPrint "Please run: npm install -g grump-cli"
        MessageBox MB_OK|MB_ICONEXCLAMATION "Could not install grump-cli automatically.$\r$\nPlease run 'npm install -g grump-cli' after installation."
    ${EndIf}
    
    ; Add to PATH
    EnVar::SetHKLM
    EnVar::AddValue "Path" "$INSTDIR\bin"
    
    DetailPrint "CLI Tools installed successfully."
SectionEnd

; Sample Templates
Section "Sample Templates" SEC04
    SetOutPath "$INSTDIR\templates"
    
    DetailPrint "Downloading sample project templates..."
    
    ; Download templates zip
    NSISdl::download "https://templates.grump.dev/templates.zip" "$TEMP\grump-templates.zip"
    Pop $0
    
    ${If} $0 == "success"
        DetailPrint "Extracting templates..."
        nsisunz::Unzip "$TEMP\grump-templates.zip" "$INSTDIR\templates\"
        Pop $0
        ${If} $0 == "success"
            DetailPrint "Templates installed successfully."
        ${Else}
            DetailPrint "Warning: Could not extract templates."
        ${EndIf}
        Delete "$TEMP\grump-templates.zip"
    ${Else}
        DetailPrint "Warning: Could not download templates."
    ${EndIf}
SectionEnd

; Shortcuts
Section "Shortcuts" SEC05
    DetailPrint "Creating shortcuts..."
    
    ; Start Menu Shortcuts
    CreateDirectory "$SMPROGRAMS\G-Rump"
    CreateShortcut "$SMPROGRAMS\G-Rump\G-Rump Desktop.lnk" "$INSTDIR\G-Rump.exe" "" "$INSTDIR\assets\logo.ico" 0
    CreateShortcut "$SMPROGRAMS\G-Rump\G-Rump CLI.lnk" "%COMSPEC%" '/k grump --help' "$INSTDIR\assets\cli.ico" 0
    CreateShortcut "$SMPROGRAMS\G-Rump\Uninstall.lnk" "$INSTDIR\uninst.exe" "" "$INSTDIR\assets\uninstall.ico" 0
    
    ; Desktop Shortcut
    CreateShortcut "$DESKTOP\G-Rump.lnk" "$INSTDIR\G-Rump.exe" "" "$INSTDIR\assets\logo.ico" 0
    
    ; Quick Launch Shortcut (Windows 10/11)
    CreateShortcut "$QUICKLAUNCH\G-Rump.lnk" "$INSTDIR\G-Rump.exe" "" "$INSTDIR\assets\logo.ico" 0
    
    DetailPrint "Shortcuts created successfully."
SectionEnd

; Documentation
Section "Documentation" SEC06
    SetOutPath "$INSTDIR\docs"
    
    DetailPrint "Installing documentation..."
    
    File /r "docs\*.*"
    
    ; Create Start Menu shortcut for docs
    CreateShortcut "$SMPROGRAMS\G-Rump\Documentation.lnk" "$INSTDIR\docs\index.html" "" "" 0
    
    DetailPrint "Documentation installed successfully."
SectionEnd

; ============================================
; POST-INSTALLATION SECTION
; ============================================
Section -Post
    DetailPrint "Finalizing installation..."
    
    ; Write installation information
    WriteRegStr HKLM "${PRODUCT_UNINST_KEY}" "DisplayName" "${PRODUCT_NAME}"
    WriteRegStr HKLM "${PRODUCT_UNINST_KEY}" "UninstallString" "$INSTDIR\uninst.exe"
    WriteRegStr HKLM "${PRODUCT_UNINST_KEY}" "DisplayIcon" "$INSTDIR\assets\logo.ico"
    WriteRegStr HKLM "${PRODUCT_UNINST_KEY}" "DisplayVersion" "${PRODUCT_VERSION}"
    WriteRegStr HKLM "${PRODUCT_UNINST_KEY}" "Publisher" "${PRODUCT_PUBLISHER}"
    WriteRegStr HKLM "${PRODUCT_UNINST_KEY}" "URLInfoAbout" "${PRODUCT_WEB_SITE}"
    WriteRegStr HKLM "${PRODUCT_UNINST_KEY}" "HelpLink" "${PRODUCT_SUPPORT}"
    WriteRegStr HKLM "${PRODUCT_UNINST_KEY}" "InstallLocation" "$INSTDIR"
    WriteRegStr HKLM "${PRODUCT_UNINST_KEY}" "InstallSource" "$EXEDIR"
    
    ; Calculate installed size
    ${GetSize} "$INSTDIR" "/S=0K" $0 $1 $2
    IntFmt $0 "0x%08X" $0
    WriteRegDWORD HKLM "${PRODUCT_UNINST_KEY}" "EstimatedSize" "$0"
    
    ; Write uninstaller
    WriteUninstaller "$INSTDIR\uninst.exe"
    
    ; Create uninstaller shortcut
    CreateShortcut "$SMPROGRAMS\G-Rump\Uninstall G-Rump.lnk" "$INSTDIR\uninst.exe" "" "$INSTDIR\assets\uninstall.ico" 0
    
    ; Register with Windows Programs and Features
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${PRODUCT_NAME}" "ModifyPath" "$INSTDIR\uninst.exe"
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${PRODUCT_NAME}" "NoModify" "1"
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${PRODUCT_NAME}" "NoRepair" "1"
    
    ; Create Windows 10/11 Start Menu tile entry
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${PRODUCT_NAME}" "DisplayName" "${PRODUCT_NAME}"
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${PRODUCT_NAME}" "Comments" "AI-Powered Project Management Tool"
    
    DetailPrint "Installation complete!"
SectionEnd

; ============================================
; COMPONENT DESCRIPTIONS
; ============================================
!insertmacro MUI_FUNCTION_DESCRIPTION_BEGIN
!insertmacro MUI_DESCRIPTION_TEXT ${SEC01} $(DESC_CoreComponents)
!insertmacro MUI_DESCRIPTION_TEXT ${SEC02} $(DESC_DesktopApp)
!insertmacro MUI_DESCRIPTION_TEXT ${SEC03} $(DESC_CLI)
!insertmacro MUI_DESCRIPTION_TEXT ${SEC04} $(DESC_Templates)
!insertmacro MUI_DESCRIPTION_TEXT ${SEC05} $(DESC_Shortcuts)
!insertmacro MUI_DESCRIPTION_TEXT ${SEC06} $(DESC_Documentation)
!insertmacro MUI_FUNCTION_DESCRIPTION_END

; ============================================
; CUSTOM PAGES - NODE.JS CHECK
; ============================================
Function CheckNodePage
    ; Check if Node.js is installed
    nsExec::ExecToStack 'cmd.exe /c node --version 2>nul'
    Pop $0
    Pop $NodeVersion
    
    ${If} $0 == "0"
        StrCpy $NodeInstalled "1"
        ; Check version (simplified check for 20+)
        ${If} $NodeVersion == ""
            StrCpy $NodeInstalled "0"
        ${EndIf}
    ${Else}
        StrCpy $NodeInstalled "0"
    ${EndIf}
    
    ${If} $NodeInstalled == "1"
        DetailPrint "Node.js detected: $NodeVersion"
        Abort ; Skip this page if Node is already installed
    ${Else}
        ; Show Node.js installation dialog
        !insertmacro MUI_HEADER_TEXT "Node.js Required" "G-Rump requires Node.js 20 or later."
        
        nsDialogs::Create 1018
        Pop $0
        
        ${NSD_CreateLabel} 0 0 100% 30u "Node.js 20+ was not detected on your system.$\r$\n$\r$\nG-Rump CLI requires Node.js to function properly. Would you like to install it now?"
        Pop $0
        
        ${NSD_CreateCheckBox} 0 40u 100% 12u "Install Node.js 20 LTS (Recommended)"
        Pop $InstallNode
        ${NSD_Check} $InstallNode
        
        ${NSD_CreateLabel} 0 60u 100% 40u "Node.js will be downloaded and installed automatically.$\r$\n$\r$\nSize: ~30 MB$\r$\nDownload time: ~1-2 minutes"
        Pop $0
        
        nsDialogs::Show
    ${EndIf}
FunctionEnd

Function CheckNodePageLeave
    ${NSD_GetState} $InstallNode $0
    ${If} $0 == "${BST_CHECKED}"
        StrCpy $InstallNode "1"
    ${Else}
        StrCpy $InstallNode "0"
        MessageBox MB_OK|MB_ICONEXCLAMATION "Without Node.js, the G-Rump CLI will not function.$\r$\nYou can install Node.js later from https://nodejs.org/"
    ${EndIf}
FunctionEnd

; ============================================
; CUSTOM PAGES - DOCKER CHECK
; ============================================
Function CheckDockerPage
    ; Check if Docker is installed
    nsExec::ExecToStack 'cmd.exe /c docker --version 2>nul'
    Pop $0
    Pop $1
    
    ${If} $0 == "0"
        StrCpy $DockerInstalled "1"
    ${Else}
        StrCpy $DockerInstalled "0"
    ${EndIf}
    
    ${If} $DockerInstalled == "1"
        DetailPrint "Docker detected: $1"
        Abort ; Skip this page if Docker is already installed
    ${Else}
        ; Show Docker installation dialog
        !insertmacro MUI_HEADER_TEXT "Docker Optional" "Docker is recommended for containerized projects."
        
        nsDialogs::Create 1018
        Pop $0
        
        ${NSD_CreateLabel} 0 0 100% 40u "Docker was not detected on your system.$\r$\n$\r$\nDocker is optional but recommended for G-Rump container management features. You can continue without Docker and install it later if needed."
        Pop $0
        
        ${NSD_CreateCheckBox} 0 50u 100% 12u "Install Docker Desktop (Optional)"
        Pop $InstallDocker
        
        ${NSD_CreateLabel} 0 70u 100% 40u "Docker Desktop will be downloaded and installed.$\r$\n$\r$\nNote: This requires Windows 10/11 Pro or Enterprise, or WSL2 on Windows 10 Home.$\r$\nSize: ~500 MB$\r$\nDownload time: ~5-10 minutes"
        Pop $0
        
        nsDialogs::Show
    ${EndIf}
FunctionEnd

Function CheckDockerPageLeave
    ${NSD_GetState} $InstallDocker $0
    ${If} $0 == "${BST_CHECKED}"
        StrCpy $InstallDocker "1"
    ${Else}
        StrCpy $InstallDocker "0"
    ${EndIf}
FunctionEnd

; ============================================
; INSTALL DEPENDENCIES
; ============================================
Section "Install Dependencies" SEC07
    ; Install Node.js if requested
    ${If} $InstallNode == "1"
        DetailPrint "Downloading Node.js 20 LTS..."
        
        NSISdl::download "https://nodejs.org/dist/v20.11.0/node-v20.11.0-x64.msi" "$TEMP\node-installer.msi"
        Pop $0
        
        ${If} $0 == "success"
            DetailPrint "Installing Node.js..."
            ExecWait 'msiexec /i "$TEMP\node-installer.msi" /qn /norestart' $0
            ${If} $0 == "0"
                DetailPrint "Node.js installed successfully."
                ; Refresh environment variables
                SendMessage ${HWND_BROADCAST} ${WM_SETTINGCHANGE} 0 "STR:Environment" /TIMEOUT=5000
            ${Else}
                DetailPrint "Node.js installation failed. Error code: $0"
                MessageBox MB_OK|MB_ICONEXCLAMATION "Node.js installation failed. Please install manually from https://nodejs.org/"
            ${EndIf}
            Delete "$TEMP\node-installer.msi"
        ${Else}
            DetailPrint "Failed to download Node.js installer."
            MessageBox MB_OK|MB_ICONEXCLAMATION "Could not download Node.js. Please install manually from https://nodejs.org/"
        ${EndIf}
    ${EndIf}
    
    ; Install Docker if requested
    ${If} $InstallDocker == "1"
        DetailPrint "Downloading Docker Desktop..."
        
        NSISdl::download "https://desktop.docker.com/win/main/amd64/Docker%20Desktop%20Installer.exe" "$TEMP\docker-installer.exe"
        Pop $0
        
        ${If} $0 == "success"
            DetailPrint "Installing Docker Desktop..."
            ExecWait '"$TEMP\docker-installer.exe" install --quiet' $0
            ${If} $0 == "0"
                DetailPrint "Docker Desktop installed successfully."
            ${Else}
                DetailPrint "Docker Desktop installation failed. Error code: $0"
                MessageBox MB_OK|MB_ICONEXCLAMATION "Docker Desktop installation failed. Please install manually from https://www.docker.com/products/docker-desktop"
            ${EndIf}
            Delete "$TEMP\docker-installer.exe"
        ${Else}
            DetailPrint "Failed to download Docker Desktop installer."
            MessageBox MB_OK|MB_ICONEXCLAMATION "Could not download Docker Desktop. Please install manually from https://www.docker.com/products/docker-desktop"
        ${EndIf}
    ${EndIf}
SectionEnd

; ============================================
; UNINSTALLER SECTION
; ============================================
Section Uninstall
    DetailPrint "Uninstalling G-Rump..."
    
    ; Remove registry keys
    DeleteRegKey HKLM "${PRODUCT_UNINST_KEY}"
    DeleteRegKey HKLM "${PRODUCT_DIR_REGKEY}"
    DeleteRegKey HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${PRODUCT_NAME}"
    DeleteRegKey HKCR "G-RumpProject"
    DeleteRegKey HKCR ".grump"
    DeleteRegKey HKLM "Software\G-Rump"
    
    ; Remove from PATH
    EnVar::SetHKLM
    EnVar::DeleteValue "Path" "$INSTDIR\bin"
    
    ; Remove global npm package
    nsExec::ExecToStack 'cmd.exe /c npm uninstall -g grump-cli 2>nul'
    
    ; Remove shortcuts
    Delete "$SMPROGRAMS\G-Rump\G-Rump Desktop.lnk"
    Delete "$SMPROGRAMS\G-Rump\G-Rump CLI.lnk"
    Delete "$SMPROGRAMS\G-Rump\Documentation.lnk"
    Delete "$SMPROGRAMS\G-Rump\Uninstall G-Rump.lnk"
    Delete "$SMPROGRAMS\G-Rump\Uninstall.lnk"
    RMDir "$SMPROGRAMS\G-Rump"
    
    Delete "$DESKTOP\G-Rump.lnk"
    Delete "$QUICKLAUNCH\G-Rump.lnk"
    
    ; Remove application files
    Delete "$INSTDIR\G-Rump.exe"
    Delete "$INSTDIR\uninst.exe"
    Delete "$INSTDIR\LICENSE.txt"
    Delete "$INSTDIR\README.txt"
    Delete "$INSTDIR\CHANGELOG.txt"
    
    ; Remove directories
    RMDir /r "$INSTDIR\bin"
    RMDir /r "$INSTDIR\lib"
    RMDir /r "$INSTDIR\resources"
    RMDir /r "$INSTDIR\templates"
    RMDir /r "$INSTDIR\docs"
    RMDir /r "$INSTDIR\assets"
    RMDir /r "$INSTDIR\desktop-app"
    
    ; Remove app data (ask user)
    MessageBox MB_YESNO|MB_ICONQUESTION "Remove G-Rump configuration and user data?$$\nThis includes your settings and project history." IDNO skip_appdata
    RMDir /r "$LOCALAPPDATA\G-Rump"
skip_appdata:
    
    RMDir "$INSTDIR"
    
    DetailPrint "G-Rump has been uninstalled successfully."
    
    IfSilent +2
    MessageBox MB_OK|MB_ICONINFORMATION "G-Rump has been successfully removed from your computer."
SectionEnd

; ============================================
; UTILITY FUNCTIONS
; ============================================
Function .onInit
    ; Check for 64-bit Windows
    ${If} ${RunningX64}
        DetailPrint "64-bit Windows detected"
    ${Else}
        MessageBox MB_OK|MB_ICONSTOP "G-Rump requires 64-bit Windows. Please upgrade your system."
        Abort
    ${EndIf}
    
    ; Check Windows version (Windows 10 or later)
    ${If} ${AtLeastWin10}
        DetailPrint "Windows 10 or later detected"
    ${Else}
        MessageBox MB_OK|MB_ICONSTOP "G-Rump requires Windows 10 or later."
        Abort
    ${EndIf}
    
    ; Check for existing installation
    ReadRegStr $0 HKLM "${PRODUCT_UNINST_KEY}" "UninstallString"
    StrCmp $0 "" done
    
    ; Ask to uninstall previous version
    MessageBox MB_YESNO|MB_ICONQUESTION "G-Rump is already installed on your system.$\r$\nWould you like to remove the previous version before installing?" IDNO done
    
    ; Run uninstaller
    ExecWait '"$0" /S' $0
    ${If} $0 != "0"
        MessageBox MB_OK|MB_ICONSTOP "Failed to remove previous version. Please uninstall manually and try again."
        Abort
    ${EndIf}
    
done:
    ; Initialize variables
    StrCpy $NodeInstalled "0"
    StrCpy $DockerInstalled "0"
    StrCpy $InstallNode "0"
    StrCpy $InstallDocker "0"
    
    ; Set temporary directory
    StrCpy $TempDir "$TEMP\G-Rump-Setup"
    CreateDirectory "$TempDir"
FunctionEnd

Function .onGUIEnd
    ; Cleanup temporary files
    RMDir /r "$TempDir"
FunctionEnd

Function un.onInit
    ; Check if uninstaller is running with elevated privileges
    UserInfo::GetAccountType
    Pop $0
    ${If} $0 != "admin"
        MessageBox MB_OK|MB_ICONSTOP "Administrator privileges required to uninstall G-Rump."
        Abort
    ${EndIf}
FunctionEnd
