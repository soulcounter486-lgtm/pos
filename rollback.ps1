# POS 시스템 롤백 스크립트
$backups = Get-ChildItem D:\pos\backup -Directory | Sort-Object Name -Descending

if ($backups.Count -eq 0) {
    Write-Host "❌ 백업이 없습니다"
    exit
}

Write-Host "`n사용 가능한 백업 목록:"
for ($i=0; $i -lt $backups.Count; $i++) {
    Write-Host "  [$i] $($backups[$i].Name)"
}

$selection = Read-Host "`n롤백할 백업 번호를 입력하세요"
$selected = $backups[$selection]

if (-not $selected) {
    Write-Host "❌ 잘못된 번호입니다"
    exit
}

$confirm = Read-Host "정말 $($selected.Name) 로 롤백하시겠습니까? (y/N)"
if ($confirm -ne "y") {
    Write-Host "롤백 취소됨"
    exit
}

Copy-Item -Path $selected.FullName\* -Destination D:\pos -Recurse -Force

Write-Host "✅ 롤백 완료: $($selected.Name)"
