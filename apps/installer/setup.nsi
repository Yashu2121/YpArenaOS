!include "MUI2.nsh"
!include "nsDialogs.nsh"
!include "LogicLib.nsh"

!define APPNAME "YP Arena OS Smartlaunch System"
!define COMPANYNAME "YP Arena OS"
!define DESCRIPTION "Unified Café Management System Web Installer"
!define VERSIONMAJOR 1
!define VERSIONMINOR 0

; ==============================================================================
; USER CONFIGURATION: CHANGE THIS URL TO YOUR ACTUAL AWS S3 BUCKET URL
; ==============================================================================
!define BASE_DOWNLOAD_URL "https://yparenaos-dist-yashu.s3.amazonaws.com"

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
; Helper Function to Download and Extract Archives via PowerShell
; Stack input: ZipFilename, TargetSubfolder
;--------------------------------
Function DownloadAndExtract
  Pop $R0 ; TargetSubfolder (e.g. "$INSTDIR\Server")
  Pop $R1 ; ZipFilename (e.g. "YP-Arena-OS-Edge-Server.zip")

  DetailPrint "Creating directory $R0..."
  CreateDirectory "$R0"

  DetailPrint "Downloading $R1 from the cloud..."
  ; Invoke PowerShell to download the zip file securely using TLS 1.2
  nsExec::ExecToLog 'powershell -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri \"${BASE_DOWNLOAD_URL}/$R1\" -OutFile \"$TEMP\$R1\""'
  Pop $0 ; Exit Code

  ${If} $0 != 0
    MessageBox MB_ICONSTOP "Failed to download $R1. Please check your internet connection and verify that the file exists in your S3 bucket."
    Abort
  ${EndIf}

  DetailPrint "Extracting $R1 to $R0..."
  ; Invoke PowerShell to extract the zip file
  nsExec::ExecToLog 'powershell -Command "Expand-Archive -Path \"$TEMP\$R1\" -DestinationPath \"$R0\" -Force"'
  Pop $0 ; Exit Code

  ${If} $0 != 0
    MessageBox MB_ICONSTOP "Failed to extract $R1."
    Abort
  ${EndIf}

  DetailPrint "Cleaning up temporary files..."
  Delete "$TEMP\$R1"
FunctionEnd

;--------------------------------
; Installer Sections

Section "Server Engine (Edge Node)" SecServer
  SetOutPath "$INSTDIR\Server"
  
  ; Download and extract Server package
  Push "YP-Arena-OS-Edge-Server.zip"
  Push "$INSTDIR\Server"
  Call DownloadAndExtract
  
  CreateShortcut "$DESKTOP\YP Arena OS Server.lnk" "$INSTDIR\Server\YpArenaos Server.exe"

  ; Write the license key to the root of the installation folder
  FileOpen $4 "$INSTDIR\license.key" w
  FileWrite $4 $LicenseKey
  FileClose $4
SectionEnd

Section "Administrator Dashboard" SecAdmin
  SetOutPath "$INSTDIR\Administrator"
  
  ; Download and extract Admin package
  Push "YP-Arena-OS-Admin-Dashboard.zip"
  Push "$INSTDIR\Administrator"
  Call DownloadAndExtract
  
  CreateShortcut "$DESKTOP\YP Arena OS Administrator.lnk" "$INSTDIR\Administrator\YP Arena OS Administrator.exe"
SectionEnd

Section "Client Terminal (PC App)" SecClient
  SetOutPath "$INSTDIR\Client"
  
  ; Download and extract Client Kiosk package
  Push "YP-Arena-OS-Kiosk-Client.zip"
  Push "$INSTDIR\Client"
  Call DownloadAndExtract
  
  CreateShortcut "$DESKTOP\YP Arena OS Client.lnk" "$INSTDIR\Client\YP Arena OS Client.exe"
SectionEnd

;--------------------------------
; Descriptions

LangString DESC_SecServer ${LANG_ENGLISH} "Downloads and installs the Edge Server Node for managing the café locally."
LangString DESC_SecAdmin ${LANG_ENGLISH} "Downloads and installs the React-based Administrator Dashboard."
LangString DESC_SecClient ${LANG_ENGLISH} "Downloads and installs the Kiosk Terminal Client for gaming PCs."

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
