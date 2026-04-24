# POS 백업 스크립트 - 전체 파일 백업
$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$backupPath = "D:\pos\backup\$timestamp"

if (!(Test-Path "D:\pos\backup")) { New-Item -ItemType Directory -Path "D:\pos\backup" -Force | Out-Null }
New-Item -ItemType Directory -Path $backupPath -Force | Out-Null

$excludeDirs = @("node_modules", ".next", ".telecode", "backup", ".git")

# 루트 디렉토리의 전체 파일 복사
Get-ChildItem -Path "D:\pos" -File | ForEach-Object {
    Copy-Item -Path $_.FullName -Destination "$backupPath\$($_.Name)" -Force
}

# 하위 디렉토리 복사 (exclude 제외)
Get-ChildItem -Path "D:\pos" -Directory -Exclude $excludeDirs | ForEach-Object {
    $destDir = "$backupPath\$($_.Name)"
    New-Item -ItemType Directory -Path $destDir -Force | Out-Null
    Copy-Item -Path "$($_.FullName)\*" -Destination $destDir -Recurse -Force -ErrorAction SilentlyContinue
}

$fileCount = (Get-ChildItem -Path $backupPath -Recurse -File).Count
Write-Host "백업 완료: $backupPath" -ForegroundColor Green
Write-Host "파일 수: $fileCount 개" -ForegroundColor Gray