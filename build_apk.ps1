$orig = $PWD.Path
$scratch = "C:\Users\mohammed\.gemini\antigravity\brain\b1aa06b4-9ab3-49c0-ba2a-b12cb2ead6c6\scratch\compass_clash"

Write-Host "Copying project to $scratch"
robocopy compass_clash $scratch /E /XD build .dart_tool .idea

Set-Location -Path $scratch

Write-Host "Removing non-Android platforms to avoid symlink issues..."
Remove-Item -Recurse -Force windows -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force macos -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force linux -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force web -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force ios -ErrorAction SilentlyContinue

Write-Host "Cleaning project..."
C:\src\flutter\bin\flutter.bat clean

Write-Host "Building APK..."
C:\src\flutter\bin\flutter.bat build apk --release

if (Test-Path "build\app\outputs\flutter-apk\app-release.apk") {
    Write-Host "Copying APK back to workspace..."
    New-Item -ItemType Directory -Force -Path "$orig\compass_clash\build\app\outputs\flutter-apk"
    Copy-Item "build\app\outputs\flutter-apk\app-release.apk" -Destination "$orig\compass_clash\build\app\outputs\flutter-apk\app-release.apk" -Force
    Write-Host "Build successful."
} else {
    Write-Host "APK build failed."
    exit 1
}
