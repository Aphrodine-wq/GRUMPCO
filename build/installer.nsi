; G-Rump Windows Installer
; Simplified NSIS Script
; Installs G-Rump Desktop Application to Program Files

SetCompressor /SOLID lzma
Unicode true
RequestExecutionLevel admin

; Includes
!include "MUI2.nsh"
!include "x64.nsh"

; Product Information
!define PRODUCT_NAME "G-Rump"
!define PRODUCT_VERSION "1.0.0"
!define PRODUCT_PUBLISHER "G-Rump Team"
!define PRODUCT_WEB "https://grump.dev"

; UI Configuration
!define MUI_FINISHPAGE_RUN "$INSTDIR\G-Rump.exe"
!define MUI_FINISHPAGE_RUN_TEXT "Launch G-Rump"
!define MUI_FINISHPAGE_RUN_NOTCHECKED

; Installer
Name "${PRODUCT_NAME} ${PRODUCT_VERSION}"
OutFile "G-Rump-Setup-v${PRODUCT_VERSION}.exe"
InstallDir "$PROGRAMFILES\G-Rump"
InstallDirRegKey HKLM "Software\${PRODUCT_NAME}" "InstallDir"
ShowInstDetails nevershow
ShowUninstDetails nevershow

; MUI Pages
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH

!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES

!insertmacro MUI_LANGUAGE "English"

; ============================================
; INSTALLER SECTION
; ============================================
Section "Install G-Rump"
  SetOverwrite ifnewer

  ; Create install directory
  SetOutPath "$INSTDIR"

  ; Copy all files from G-Rump-dist
  File /r "G-Rump-dist\*.*"

  ; Create uninstaller
  WriteUninstaller "$INSTDIR\uninstall.exe"

  ; Create Start Menu shortcuts
  CreateDirectory "$SMPROGRAMS\G-Rump"
  CreateShortcut "$SMPROGRAMS\G-Rump\G-Rump.lnk" "$INSTDIR\G-Rump.exe" "" "$INSTDIR\G-Rump.exe" 0
  CreateShortcut "$SMPROGRAMS\G-Rump\Uninstall.lnk" "$INSTDIR\uninstall.exe" "" "$INSTDIR\uninstall.exe" 0

  ; Create Desktop shortcut
  CreateShortcut "$DESKTOP\G-Rump.lnk" "$INSTDIR\G-Rump.exe" "" "$INSTDIR\G-Rump.exe" 0

  ; Registry entries
  WriteRegStr HKLM "Software\${PRODUCT_NAME}" "InstallDir" "$INSTDIR"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${PRODUCT_NAME}" "DisplayName" "${PRODUCT_NAME} ${PRODUCT_VERSION}"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${PRODUCT_NAME}" "UninstallString" "$INSTDIR\uninstall.exe"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${PRODUCT_NAME}" "InstallLocation" "$INSTDIR"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${PRODUCT_NAME}" "Publisher" "${PRODUCT_PUBLISHER}"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${PRODUCT_NAME}" "URLInfoAbout" "${PRODUCT_WEB}"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${PRODUCT_NAME}" "DisplayVersion" "${PRODUCT_VERSION}"

  DetailPrint "Installation complete!"
SectionEnd

; ============================================
; UNINSTALLER SECTION
; ============================================
Section "Uninstall"
  ; Remove files and directory
  RMDir /r "$INSTDIR"

  ; Remove shortcuts
  RMDir /r "$SMPROGRAMS\G-Rump"
  Delete "$DESKTOP\G-Rump.lnk"

  ; Remove registry entries
  DeleteRegKey HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${PRODUCT_NAME}"
  DeleteRegKey HKLM "Software\${PRODUCT_NAME}"
SectionEnd
