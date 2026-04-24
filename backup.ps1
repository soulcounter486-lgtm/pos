# POS 자동 백업 스크립트
$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$backupPath = "D:\pos\backup\$timestamp"

# node_modules, .next, .telecode, backup 제외하고 복사
$src = "D:\pos"
$exclude = @("node_modules", ".next", ".telecode", "backup", ".git")

if (!(Test-Path "D:\pos\backup")) { New-Item -ItemType Directory -Path "D:\pos\backup" -Force | Out-Null }

# 소스 파일 가져오기
$files = Get-ChildItem -Path $src -File -Exclude $exclude

# 새 디렉토리 생성
New-Item -ItemType Directory -Path $backupPath -Force | Out-Null

# 파일 복사
foreach ($f in $files) {
    try {
        Copy-Item -Path $f.FullName -Destination "$backupPath\$($f.Name)" -Force -ErrorAction Stop
    } catch {
        # 무시
    }
}

# 하위 디렉토리 복사 (exclude 제외)
$dirs = Get-ChildItem -Path $src -Directory -Exclude $exclude
foreach ($d in $dirs) {
    try {
        $destDir = "$backupPath\$($d.Name)"
        New-Item -ItemType Directory -Path $destDir -Force | Out-Null
        Copy-Item -Path "$($d.FullName)\*" -Destination $destDir -Recurse -Force -Exclude $exclude -ErrorAction Stop
    } catch {
        # 무시
    }
}

Write-Host "✅ 백업 완료: $backupPath" -ForegroundColor Green