!include "MUI2.nsh"
!include "nsDialogs.nsh"
!include "LogicLib.nsh"

!define APPNAME "YP Arena OS Smartlaunch System"
!define COMPANYNAME "YP Arena OS"
!define DESCRIPTION "Unified Café Management System Installer"
!define VERSIONMAJOR 1
!define VERSIONMINOR 0

Name "${APPNAME}"
OutFile "YP-Arena-OS-Unified-Installer.exe"
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
  SectionIn RO ; Optional: Make it required if you want, or leave it checkable
  SetOutPath "$INSTDIR\Server"
  
  ; Include the server app build
  File /r "..\server-engine\release-builds\win-unpacked\*"
  
  CreateShortcut "$DESKTOP\YP Arena OS Server.lnk" "$INSTDIR\Server\YP Arena OS Server.exe"

  ; Write the license key to the root of the installation folder
  FileOpen $4 "$INSTDIR\license.key" w
  FileWrite $4 $LicenseKey
  FileClose $4
SectionEnd

Section "Administrator Dashboard" SecAdmin
  SetOutPath "$INSTDIR\Administrator"
  
  ; Include the admin app build
  File /r "..\admin-dashboard\release-builds\win-unpacked\*"
  
  CreateShortcut "$DESKTOP\YP Arena OS Administrator.lnk" "$INSTDIR\Administrator\YP Arena OS Administrator.exe"
SectionEnd

Section "Client Terminal (PC App)" SecClient
  SetOutPath "$INSTDIR\Client"
  
  ; Include the client app build
  File /r "..\pc-client\release-builds\win-unpacked\*"
  
  CreateShortcut "$DESKTOP\YP Arena OS Client.lnk" "$INSTDIR\Client\YP Arena OS Client.exe"
SectionEnd

;--------------------------------
; Descriptions

LangString DESC_SecServer ${LANG_ENGLISH} "Installs the Edge Server Node for managing the café locally."
LangString DESC_SecAdmin ${LANG_ENGLISH} "Installs the React-based Administrator Dashboard."
LangString DESC_SecClient ${LANG_ENGLISH} "Installs the Kiosk Terminal Client for gaming PCs."

!insertmacro MUI_FUNCTION_DESCRIPTION_BEGIN
  !insertmacro MUI_DESCRIPTION_TEXT ${SecServer} $(DESC_SecServer)
  !insertmacro MUI_DESCRIPTION_TEXT ${SecAdmin} $(DESC_SecAdmin)
  !insertmacro MUI_DESCRIPTION_TEXT ${SecClient} $(DESC_SecClient)
!insertmacro MUI_FUNCTION_DESCRIPTION_END

;--------------------------------
; Uninstaller Section

Section "Uninstall"
  Delete "$DESKTOP\YP Arena OS Server.lnk"
  Delete "$DESKTOP\YP Arena OS Administrator.lnk"
  Delete "$DESKTOP\YP Arena OS Client.lnk"
  RMDir /r "$INSTDIR"
SectionEnd
