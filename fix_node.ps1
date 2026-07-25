$nodeFiles = git ls-files "node-v20.10.0-win-x64"
Write-Host "Files found: $($nodeFiles.Count)"
foreach ($f in $nodeFiles) {
    git update-index --force-remove $f
}
Write-Host "Index cleaned"
git commit -am "Remove node folder from git tracking"
git push
Write-Host "PUSHED"
