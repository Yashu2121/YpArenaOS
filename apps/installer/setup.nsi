!include "MUI2.nsh"
!include "nsDialogs.nsh"
!include "LogicLib.nsh"

; Enable premium solid LZMA compression to make the unified installer extremely compact
SetCompressor /SOLID lzma

!define APPNAME "YP Arena OS Smartlaunch System"
!define COMPANYNAME "YP Arena OS"
!define DESCRIPTION "Unified Café Management System Installer"
!define VERSIONMAJOR 1
!define VERSIONMINOR 0

Name "${APPNAME}"
OutFile "YP-Arena-OS-Unified-Installer-Release.exe"
InstallDir "$PROGRAMFILES64\${COMPANYNAME}"
RequestExecutionLevel admin

Var LicenseKey
Var LicenseKeyInput

;--------------------------------
; Interface Settings
!define MUI_ABORTWARNING

;--------------------------------
; Pages

!insertmacro MUI_PAGE_COMPONENTS
!insertmacro MUI_PAGE_DIRECTORY

Page custom LicensePageShow LicensePageLeave

!insertmacro MUI_PAGE_INSTFILES

!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES

;--------------------------------
; Languages
!insertmacro MUI_LANGUAGE "English"

;--------------------------------
; Custom License Key Page Functions

Function LicensePageShow
  nsDialogs::Create 1018
  Pop $0
  
  ${NSD_CreateLabel} 0 0 100% 24u "Please enter your YP Arena OS Cafe Enterprise License Key to activate the system. If you do not have a license key, please contact your YP Arena OS representative."
  Pop $1
  
  ${NSD_CreateText} 0 30u 100% 12u ""
  Pop $LicenseKeyInput
  
  nsDialogs::Show
FunctionEnd

Function LicensePageLeave
  ${NSD_GetText} $LicenseKeyInput $LicenseKey
  
  StrCmp $LicenseKey "" 0 +3
    MessageBox MB_ICONEXCLAMATION "License Key is required to complete the installation."
    Abort
FunctionEnd

;--------------------------------
; Installer Sections

Section "Server Engine (Edge Node)" SecServer
  SetOutPath "$INSTDIR\Server"
  
  DetailPrint "Installing Server Engine..."
  File /r "..\server-engine\release-builds\win-unpacked\*"
  
  CreateShortcut "$DESKTOP\YP Arena OS Server.lnk" "$INSTDIR\Server\YpArenaos Server.exe"

  ; Write the license key to the root of the installation folder
  FileOpen $4 "$INSTDIR\license.key" w
  FileWrite $4 $LicenseKey
  FileClose $4
SectionEnd

Section "Administrator Dashboard" SecAdmin
  SetOutPath "$INSTDIR\Administrator"
  
  DetailPrint "Installing Administrator Dashboard..."
  File /r "..\admin-dashboard\release-builds\win-unpacked\*"
  
  CreateShortcut "$DESKTOP\YP Arena OS Administrator.lnk" "$INSTDIR\Administrator\YP Arena OS Administrator.exe"
SectionEnd

Section "Client Terminal (PC App)" SecClient
  SetOutPath "$INSTDIR\Client"
  
  DetailPrint "Installing Client Terminal (PC App)..."
  File /r "..\pc-client\release-builds\win-unpacked\*"
  
  CreateShortcut "$DESKTOP\YP Arena OS Client.lnk" "$INSTDIR\Client\YP Arena OS Client.exe"
SectionEnd

;--------------------------------
; Descriptions

LangString DESC_SecServer ${LANG_ENGLISH} "Installs the Edge Server Node for managing the café locally."
LangString DESC_SecAdmin ${LANG_ENGLISH} "Installs the React/Next-based Administrator Dashboard."
LangString DESC_SecClient ${LANG_ENGLISH} "Installs the Kiosk Terminal Client for gaming PCs."

!insertmacro MUI_FUNCTION_DESCRIPTION_BEGIN
  !insertmacro MUI_DESCRIPTION_TEXT ${SecServer} $(DESC_SecServer)
  !insertmacro MUI_DESCRIPTION_TEXT ${SecAdmin} $(DESC_SecAdmin)
  !insertmacro MUI_DESCRIPTION_TEXT ${SecClient} $(DESC_SecClient)
!insertmacro MUI_FUNCTION_DESCRIPTION_END

;--------------------------------
; Post-Install Section
Section -Post
  SetOutPath "$INSTDIR"
  WriteUninstaller "$INSTDIR\uninstall.exe"
  
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APPNAME}" "DisplayName" "${APPNAME}"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APPNAME}" "UninstallString" '"$INSTDIR\uninstall.exe"'
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APPNAME}" "Publisher" "${COMPANYNAME}"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APPNAME}" "DisplayVersion" "${VERSIONMAJOR}.${VERSIONMINOR}"
SectionEnd

;--------------------------------
; Uninstaller Section

Section "Uninstall"
  Delete "$DESKTOP\YP Arena OS Server.lnk"
  Delete "$DESKTOP\YP Arena OS Administrator.lnk"
  Delete "$DESKTOP\YP Arena OS Client.lnk"
  Delete "$INSTDIR\uninstall.exe"
  DeleteRegKey HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APPNAME}"
  RMDir /r "$INSTDIR"
SectionEnd
