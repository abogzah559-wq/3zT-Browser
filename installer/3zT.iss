; 3zT Browser - Windows installer (Inno Setup 6.6 or newer, for the dark wizard)
; build: ISCC installer\3zT.iss /DAppVersion=0.8.0
; expects the app folder in dist\3zT (made by scripts\build_win.py)

#ifndef AppVersion
  #define AppVersion "0.0.0"
#endif
#define AppExe "3zT.exe"
; same keys the browser writes when it registers itself (src/main.js: registerBrowser)
#define AppKey "Software\Clients\StartMenuInternet\3zT Browser"
#define ProgId "3zTBrowserHTML"

[Setup]
AppId={{8C3D2F4E-7A1B-4E5C-9F3A-3A7B1D0E2C61}
AppName=3zT
AppVersion={#AppVersion}
AppVerName=3zT {#AppVersion}
AppPublisher=3zo
AppPublisherURL=https://github.com/abogzah559-wq/3zT-Browser
AppSupportURL=https://github.com/abogzah559-wq/3zT-Browser/issues
AppUpdatesURL=https://github.com/abogzah559-wq/3zT-Browser/releases
VersionInfoProductName=3zT Browser Setup
VersionInfoDescription=3zT Browser Setup
VersionInfoVersion={#AppVersion}
; per-user install: no admin prompt, same as Chrome's per-user install
PrivilegesRequired=lowest
DefaultDirName={localappdata}\Programs\3zT
DefaultGroupName=3zT
DisableProgramGroupPage=yes
DisableDirPage=auto
OutputDir=..\dist
OutputBaseFilename=3zT-Browser-Setup
SetupIconFile=..\assets\icon.ico
UninstallDisplayIcon={app}\{#AppExe}
UninstallDisplayName=3zT
Compression=lzma2/max
SolidCompression=yes
LZMAUseSeparateProcess=yes
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
MinVersion=10.0
; dark wizard
WizardStyle=modern dark
WizardSizePercent=100
WizardImageFile=wizard.png
WizardSmallImageFile=wizard-small.png
; close a running 3zT before updating it
CloseApplications=yes
RestartApplications=no
ShowLanguageDialog=auto

[Languages]
Name: "en"; MessagesFile: "compiler:Default.isl"
Name: "ar"; MessagesFile: "Arabic.isl"

[Messages]
en.SetupWindowTitle=3zT Browser Setup
ar.SetupWindowTitle=إعداد متصفح 3zT
en.WelcomeLabel1=Welcome to the 3zT Browser Setup
ar.WelcomeLabel1=مرحباً بك في إعداد متصفح 3zT
en.WelcomeLabel2=This will install 3zT, a light Chromium browser, on your computer.%n%nYour Chrome bookmarks, look and extensions can be brought over the first time it opens.
ar.WelcomeLabel2=بيتم تثبيت 3zT، متصفح خفيف مبني على كروميوم.%n%nتقدر تنقل مفضلة كروم وإضافاته أول ما تفتحه.

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"

[Files]
Source: "..\dist\3zT\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{autoprograms}\3zT"; Filename: "{app}\{#AppExe}"; AppUserModelID: "com.3zo.3ztbrowser"
Name: "{autodesktop}\3zT"; Filename: "{app}\{#AppExe}"; Tasks: desktopicon; AppUserModelID: "com.3zo.3ztbrowser"

[Registry]
; let Windows list 3zT as a browser (Settings > Default apps). The user still picks the default himself.
Root: HKCU; Subkey: "Software\Classes\{#ProgId}"; ValueType: string; ValueData: "3zT HTML Document"; Flags: uninsdeletekey
Root: HKCU; Subkey: "Software\Classes\{#ProgId}\DefaultIcon"; ValueType: string; ValueData: """{app}\{#AppExe}"",0"
Root: HKCU; Subkey: "Software\Classes\{#ProgId}\shell\open\command"; ValueType: string; ValueData: """{app}\{#AppExe}"" ""%1"""
Root: HKCU; Subkey: "Software\Classes\{#ProgId}\Application"; ValueType: string; ValueName: "ApplicationName"; ValueData: "3zT"
Root: HKCU; Subkey: "Software\Classes\{#ProgId}\Application"; ValueType: string; ValueName: "ApplicationIcon"; ValueData: """{app}\{#AppExe}"",0"
Root: HKCU; Subkey: "{#AppKey}"; ValueType: string; ValueData: "3zT"; Flags: uninsdeletekey
Root: HKCU; Subkey: "{#AppKey}\DefaultIcon"; ValueType: string; ValueData: """{app}\{#AppExe}"",0"
Root: HKCU; Subkey: "{#AppKey}\shell\open\command"; ValueType: string; ValueData: """{app}\{#AppExe}"""
Root: HKCU; Subkey: "{#AppKey}\Capabilities"; ValueType: string; ValueName: "ApplicationName"; ValueData: "3zT"
Root: HKCU; Subkey: "{#AppKey}\Capabilities"; ValueType: string; ValueName: "ApplicationIcon"; ValueData: """{app}\{#AppExe}"",0"
Root: HKCU; Subkey: "{#AppKey}\Capabilities"; ValueType: string; ValueName: "ApplicationDescription"; ValueData: "A light browser built on Chromium"
Root: HKCU; Subkey: "{#AppKey}\Capabilities\StartMenu"; ValueType: string; ValueName: "StartMenuInternet"; ValueData: "3zT Browser"
Root: HKCU; Subkey: "{#AppKey}\Capabilities\URLAssociations"; ValueType: string; ValueName: "http"; ValueData: "{#ProgId}"
Root: HKCU; Subkey: "{#AppKey}\Capabilities\URLAssociations"; ValueType: string; ValueName: "https"; ValueData: "{#ProgId}"
Root: HKCU; Subkey: "{#AppKey}\Capabilities\FileAssociations"; ValueType: string; ValueName: ".htm"; ValueData: "{#ProgId}"
Root: HKCU; Subkey: "{#AppKey}\Capabilities\FileAssociations"; ValueType: string; ValueName: ".html"; ValueData: "{#ProgId}"
Root: HKCU; Subkey: "{#AppKey}\Capabilities\FileAssociations"; ValueType: string; ValueName: ".pdf"; ValueData: "{#ProgId}"
Root: HKCU; Subkey: "{#AppKey}\Capabilities\FileAssociations"; ValueType: string; ValueName: ".svg"; ValueData: "{#ProgId}"
Root: HKCU; Subkey: "{#AppKey}\Capabilities\FileAssociations"; ValueType: string; ValueName: ".webp"; ValueData: "{#ProgId}"
Root: HKCU; Subkey: "Software\RegisteredApplications"; ValueType: string; ValueName: "3zT Browser"; ValueData: "{#AppKey}\Capabilities"; Flags: uninsdeletevalue

[Run]
Filename: "{app}\{#AppExe}"; Description: "{cm:LaunchProgram,3zT}"; Flags: nowait postinstall skipifsilent

; silent update: the browser was opened while this setup was running -> open it again now
Filename: "{app}\{#AppExe}"; Parameters: "{code:RelaunchParams}"; Flags: nowait; Check: WantRelaunch

[UninstallDelete]
Type: filesandordirs; Name: "{app}\resources\app"

[Code]
{ silent updates (src/updater.js): the browser writes these files in %APPDATA%\3zT Browser\update }
function UpdDir(): String;
begin
  Result := ExpandConstant('{userappdata}\3zT Browser\update');
end;

function WantRelaunch(): Boolean;
begin
  Result := FileExists(UpdDir() + '\relaunch.flag');
end;

function RelaunchParams(Param: String): String;
var
  S: AnsiString;
begin
  Result := '';
  if LoadStringFromFile(UpdDir() + '\relaunch.flag', S) then Result := String(S);
  DeleteFile(UpdDir() + '\relaunch.flag');
end;

procedure CurStepChanged(CurStep: TSetupStep);
begin
  { files are in place: the browser may start normally from now on }
  if CurStep = ssPostInstall then
  begin
    DeleteFile(UpdDir() + '\installing.lock');
    DeleteFile(UpdDir() + '\pending.json');
  end;
end;
