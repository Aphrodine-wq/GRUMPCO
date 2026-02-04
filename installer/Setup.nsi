; G-Rump Windows Installer - NSIS script
; Build: npm run installer:exe (or run installer:stage then makensis installer/Setup.nsi) from repo root

!define PRODUCT_NAME "G-Rump"
!define PRODUCT_VERSION "2.1.0"
!define PRODUCT_PUBLISHER "G-Rump"
!define PRODUCT_URL "https://github.com/Aphrodine-wq/G-rump.com"
!define LAUNCHER_BAT "Start G-Rump.bat"

;--------------------------------
; General

Name "${PRODUCT_NAME}"
OutFile "Output\Setup.exe"
InstallDir "$LOCALAPPDATA\Programs\${PRODUCT_NAME}"
InstallDirRegKey HKCU "Software\${PRODUCT_NAME}" "InstallPath"
RequestExecutionLevel user
SetCompressor lzma

;--------------------------------
; Pages

Page directory
Page instfiles

UninstPage uninstConfirm
UninstPage instfiles

;--------------------------------
; Install section

Section "MainSection" SEC01
  SetOutPath "$INSTDIR\backend"
  File /r "stage\backend\*.*"

  ; Optional: frontend (copy if staged)
  IfFileExists "stage\frontend" 0 +3
  SetOutPath "$INSTDIR\frontend"
  File /r "stage\frontend\*.*"

  ; Optional: intent-compiler (copy if staged)
  IfFileExists "stage\intent-compiler" 0 +3
  SetOutPath "$INSTDIR\intent-compiler"
  File /r "stage\intent-compiler\*.*"

  ; Start Menu shortcuts
  CreateDirectory "$SMPROGRAMS\${PRODUCT_NAME}"
  CreateShortCut "$SMPROGRAMS\${PRODUCT_NAME}\Start G-Rump Backend.lnk" "$INSTDIR\backend\${LAUNCHER_BAT}" "" "" 0
  CreateShortCut "$SMPROGRAMS\${PRODUCT_NAME}\Uninstall ${PRODUCT_NAME}.lnk" "$INSTDIR\uninstall.exe" "" "$INSTDIR\uninstall.exe" 0

  ; Add/Remove Programs
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${PRODUCT_NAME}" "DisplayName" "${PRODUCT_NAME}"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${PRODUCT_NAME}" "UninstallString" "$INSTDIR\uninstall.exe"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${PRODUCT_NAME}" "DisplayVersion" "${PRODUCT_VERSION}"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${PRODUCT_NAME}" "Publisher" "${PRODUCT_PUBLISHER}"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${PRODUCT_NAME}" "URLInfoAbout" "${PRODUCT_URL}"
  WriteRegStr HKCU "Software\${PRODUCT_NAME}" "InstallPath" "$INSTDIR"

  WriteUninstaller "$INSTDIR\uninstall.exe"
SectionEnd

;--------------------------------
; Uninstall section

Section "Uninstall"
  RMDir /r "$INSTDIR\backend"
  RMDir /r "$INSTDIR\frontend"
  RMDir /r "$INSTDIR\intent-compiler"
  Delete "$INSTDIR\uninstall.exe"
  RMDir "$INSTDIR"

  Delete "$SMPROGRAMS\${PRODUCT_NAME}\Start G-Rump Backend.lnk"
  Delete "$SMPROGRAMS\${PRODUCT_NAME}\Uninstall ${PRODUCT_NAME}.lnk"
  RMDir "$SMPROGRAMS\${PRODUCT_NAME}"

  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${PRODUCT_NAME}"
  DeleteRegKey HKCU "Software\${PRODUCT_NAME}"
SectionEnd
