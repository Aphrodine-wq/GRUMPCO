@echo off
REM ============================================================================
REM G-Rump Windows Installer Build Script
REM Builds the professional NSIS installer for G-Rump
REM Version: 1.0.0
REM ============================================================================

setlocal EnableDelayedExpansion

echo.
echo ╔══════════════════════════════════════════════════════════════════════════════╗
echo ║                                                                              ║
echo ║                    G-RUMP WINDOWS INSTALLER BUILDER                          ║
echo ║                         Version 1.0.0                                        ║
echo ║                                                                              ║
echo ╚══════════════════════════════════════════════════════════════════════════════╝
echo.

REM ============================================================================
REM Configuration
REM ============================================================================
set "APP_NAME=G-Rump"
set "APP_VERSION=1.0.0"
set "NSIS_SCRIPT=installer.nsi"
set "OUTPUT_NAME=G-Rump-Setup-v1.0.0.exe"
set "NSIS_PATH=C:\Program Files (x86)\NSIS"
set "MAKENSIS=%NSIS_PATH%\makensis.exe"

REM Colors for output (using PowerShell for colored output)
set "GREEN=[32m"
set "RED=[31m"
set "YELLOW=[33m"
set "CYAN=[36m"
set "NC=[0m"

REM ============================================================================
REM Check Prerequisites
REM ============================================================================
echo [INFO] Checking prerequisites...
echo.

REM Check if running on Windows 10/11
ver | findstr /i "10\." >nul
if %ERRORLEVEL% NEQ 0 (
    ver | findstr /i "11\." >nul
    if %ERRORLEVEL% NEQ 0 (
        echo [WARNING] This script is designed for Windows 10/11
    )
)

REM Check for NSIS installation
if not exist "%MAKENSIS%" (
    echo [ERROR] NSIS not found at %NSIS_PATH%
    echo.
    echo Please install NSIS from: https://nsis.sourceforge.io/Download
    echo.
    echo Or specify the path manually by running:
    echo   set NSIS_PATH=^<your_nsis_path^>
    echo   build-installer.bat
    echo.
    exit /b 1
)

echo [OK] NSIS found: %MAKENSIS%

REM Check for required NSIS plugins
echo [INFO] Checking NSIS plugins...

set "PLUGINS_REQUIRED=nsisunz NSISdl EnVar nsDialogs"
set "MISSING_PLUGINS="

for %%p in (%PLUGINS_REQUIRED%) do (
    if not exist "%NSIS_PATH%\Plugins\x86-unicode\%%p.dll" (
        if not exist "%NSIS_PATH%\Plugins\x86-ansi\%%p.dll" (
            set "MISSING_PLUGINS=!MISSING_PLUGINS! %%p"
        )
    )
)

if not "!MISSING_PLUGINS!"=="" (
    echo [WARNING] Missing NSIS plugins:!MISSING_PLUGINS!
    echo.
    echo Please install the following plugins:
    echo.
    echo 1. nsisunz - For ZIP extraction
    echo    Download: https://nsis.sourceforge.io/Nsisunz_plug-in
    echo.
    echo 2. NSISdl - For downloading files
    echo    Download: https://nsis.sourceforge.io/NSISdl_plug-in
    echo.
    echo 3. EnVar - For PATH manipulation
    echo    Download: https://nsis.sourceforge.io/EnVar_plug-in
    echo.
    echo 4. nsDialogs - For custom dialogs
    echo    Usually included with NSIS 3.0+
    echo.
    echo Would you like to continue anyway? Some features may not work.
    choice /C YN /M "Continue"
    if %ERRORLEVEL% NEQ 1 (
        exit /b 1
    )
) else (
    echo [OK] All required plugins found
)

REM Check for source files
echo [INFO] Checking source files...

if not exist "%NSIS_SCRIPT%" (
    echo [ERROR] NSIS script not found: %NSIS_SCRIPT%
    exit /b 1
)
echo [OK] NSIS script found

REM Check for required directories and files
set "REQUIRED_DIRS=dist assets resources docs"
set "MISSING_DIRS="

for %%d in (%REQUIRED_DIRS%) do (
    if not exist "%%d" (
        set "MISSING_DIRS=!MISSING_DIRS! %%d"
    )
)

if not "!MISSING_DIRS!"=="" (
    echo [WARNING] Missing directories:!MISSING_DIRS!
    echo.
    echo The following directories should exist:
    echo   - dist	r	Desktop app build files
    echo   - assets	r	Installer assets (icons, banners)
    echo   - resources	Application resources
    echo   - docs		r	Documentation files
    echo.
    echo Would you like to create placeholder directories?
    choice /C YN /M "Create directories"
    if %ERRORLEVEL% EQU 1 (
        for %%d in (%MISSING_DIRS%) do (
            mkdir "%%d" 2>nul
            echo [CREATED] Directory: %%d
        )
    )
)

REM Check for icon files
if not exist "assets\logo.ico" (
    echo [WARNING] Logo icon not found: assets\logo.ico
    echo         Creating placeholder...
    if not exist "assets" mkdir assets
    echo. > assets\logo.ico
)

if not exist "assets\installer-header.bmp" (
    echo [WARNING] Installer header image not found: assets\installer-header.bmp
    echo         Creating placeholder...
    echo. > assets\installer-header.bmp
)

if not exist "assets\welcome.bmp" (
    echo [WARNING] Welcome image not found: assets\welcome.bmp
    echo         Creating placeholder...
    echo. > assets\welcome.bmp
)

REM Check for license file
if not exist "LICENSE.txt" (
    echo [WARNING] License file not found: LICENSE.txt
    echo         Creating placeholder...
    (
        echo G-Rump License
        echo.
        echo Copyright (c) 2024 G-Rump Team
        echo All rights reserved.
        echo.
        echo This software is provided as-is, without warranty of any kind.
    ) > LICENSE.txt
)

REM Check for README
if not exist "README.txt" (
    echo [WARNING] README not found: README.txt
    echo         Creating placeholder...
    (
        echo G-Rump v1.0.0
        echo.
        echo Thank you for installing G-Rump!
        echo.
        echo Quick Start:
        echo   1. Launch G-Rump from the Start Menu or Desktop
        echo   2. Use 'grump --help' in your terminal for CLI commands
        echo   3. Visit https://grump.dev/docs for full documentation
        echo.
        echo For support, visit: https://grump.dev/support
    ) > README.txt
)

REM Check for CHANGELOG
if not exist "CHANGELOG.txt" (
    echo [WARNING] Changelog not found: CHANGELOG.txt
    echo         Creating placeholder...
    (
        echo G-Rump Changelog
        echo.
        echo Version 1.0.0
        echo -------------------
        echo - Initial release
        echo - Desktop application with Electron
        echo - CLI tools with grump-cli
        echo - Project template support
        echo - Docker integration
    ) > CHANGELOG.txt
)

echo.
echo [OK] All checks complete

REM ============================================================================
REM Prepare Build Environment
REM ============================================================================
echo.
echo ══════════════════════════════════════════════════════════════════════════════
echo   BUILDING INSTALLER
echo ══════════════════════════════════════════════════════════════════════════════
echo.

REM Create build log
set "BUILD_LOG=build-%date:~-4,4%%date:~-10,2%%date:~-7,2%_%time:~0,2%%time:~3,2%%time:~6,2%.log"
set "BUILD_LOG=%BUILD_LOG: =0%"

echo Build started at %date% %time% > %BUILD_LOG%
echo. >> %BUILD_LOG%

REM ============================================================================
REM Build Installer
REM ============================================================================
echo [INFO] Compiling NSIS installer...
echo         Script: %NSIS_SCRIPT%
echo         Output: %OUTPUT_NAME%
echo.

REM Run makensis with verbose output
"%MAKENSIS%" /V4 "%NSIS_SCRIPT%" >> %BUILD_LOG% 2>&1

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] Installer compilation failed!
    echo [ERROR] Check %BUILD_LOG% for details
    echo.
    type %BUILD_LOG%
    exit /b 1
)

REM ============================================================================
REM Post-Build
REM ============================================================================
echo.
echo [OK] Installer compiled successfully!
echo.

REM Check if output file was created
if not exist "%OUTPUT_NAME%" (
    echo [ERROR] Output file not found: %OUTPUT_NAME%
    exit /b 1
)

REM Get file size
for %%F in ("%OUTPUT_NAME%") do set "FILE_SIZE=%%~zF"
set /a "FILE_SIZE_MB=%FILE_SIZE% / 1024 / 1024"

echo ══════════════════════════════════════════════════════════════════════════════
echo   BUILD COMPLETE
echo ══════════════════════════════════════════════════════════════════════════════
echo.
echo   Installer:  %OUTPUT_NAME%
echo   Size:       %FILE_SIZE% bytes (%FILE_SIZE_MB% MB)
echo   Location:   %CD%\%OUTPUT_NAME%
echo   Log:        %CD%\%BUILD_LOG%
echo.

REM ============================================================================
REM Optional: Sign the installer
REM ============================================================================
if exist "%SIGNTOOL_PATH%" (
    echo [INFO] Code signing available
    echo         Would you like to sign the installer?
    choice /C YN /M "Sign installer"
    if %ERRORLEVEL% EQU 1 (
        call :SignInstaller
    )
) else (
    echo [INFO] Code signing not configured
    echo         Set SIGNTOOL_PATH environment variable to enable signing
    echo         Example: set SIGNTOOL_PATH=C:\Program Files (x86)\Windows Kits\10\bin\x64\signtool.exe
)

REM ============================================================================
REM Summary
REM ============================================================================
echo.
echo ══════════════════════════════════════════════════════════════════════════════
echo   INSTALLER DETAILS
echo ══════════════════════════════════════════════════════════════════════════════
echo.
echo   To install G-Rump, run:
echo     %OUTPUT_NAME%
echo.
echo   Features included:
echo     [x] G-Rump Desktop Application
echo     [x] G-Rump CLI Tools (grump-cli)
echo     [x] Node.js 20+ check and installation
echo     [x] Docker optional installation
echo     [x] Project templates
echo     [x] Desktop and Start Menu shortcuts
echo     [x] PATH configuration
echo     [x] Professional uninstaller
echo.
echo ══════════════════════════════════════════════════════════════════════════════
echo   Next Steps
echo ══════════════════════════════════════════════════════════════════════════════
echo.
echo   1. Test the installer on a clean Windows machine
echo   2. Verify all components install correctly
echo   3. Test the uninstaller
echo   4. Distribute to users
echo.
echo   For support, visit: https://grump.dev/support
echo.

REM ============================================================================
REM Functions
REM ============================================================================

:SignInstaller
echo.
echo [INFO] Signing installer...

if not exist "%CERTIFICATE_PATH%" (
    echo [ERROR] Certificate not found: %CERTIFICATE_PATH%
    echo         Set CERTIFICATE_PATH environment variable
    goto :EOF
)

"%SIGNTOOL_PATH%" sign /f "%CERTIFICATE_PATH%" /t http://timestamp.digicert.com /v "%OUTPUT_NAME%"

if %ERRORLEVEL% EQU 0 (
    echo [OK] Installer signed successfully
) else (
    echo [ERROR] Signing failed
)

goto :EOF

:Help
echo.
echo Usage: build-installer.bat [options]
echo.
echo Options:
echo   /help, /h, /?    Show this help message
echo   /clean           Clean previous build artifacts
echo   /test            Run tests after building
echo   /sign            Sign the installer (requires certificate)
echo.
echo Environment Variables:
echo   NSIS_PATH        Path to NSIS installation (default: C:\Program Files (x86)\NSIS)
echo   SIGNTOOL_PATH    Path to signtool.exe for code signing
echo   CERTIFICATE_PATH Path to code signing certificate
echo.
goto :EOF

:Clean
echo.
echo [INFO] Cleaning build artifacts...
if exist "*.exe" del /Q "*.exe" 2>nul
if exist "build-*.log" del /Q "build-*.log" 2>nul
echo [OK] Clean complete
goto :EOF

REM ============================================================================
REM Handle Command Line Arguments
REM ============================================================================
if "%~1"=="/help" goto :Help
if "%~1"=="/h" goto :Help
if "%~1"=="/?" goto :Help
if "%~1"=="/clean" goto :Clean

endlocal
pause
