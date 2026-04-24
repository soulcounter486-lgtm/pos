# POS 서버 영구 실행 스크립트 (백그라운드)
$ErrorActionPreference = "SilentlyContinue"

# 포트 설정
$PORT = 5000

Write-Host "=== POS 서버 시작 ===" -ForegroundColor Cyan

# 1. 기존 프로세스 정리
$nodeProcs = Get-Process -Name node -ErrorAction SilentlyContinue
if ($nodeProcs) {
    Write-Host "기존 프로세스 정리..." -ForegroundColor Yellow
    Stop-Process -Name node -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 3
}

# 2. 백업 생성
Write-Host "백업 생성..." -ForegroundColor Cyan
./backup.ps1 | Out-Null

# 3. 서버 시작 (백그라운드)
Write-Host "서버 시작 (포트 $PORT)..." -ForegroundColor Cyan
$bgJob = Start-Job -ScriptBlock {
    Set-Location "D:\pos"
    npx next dev -H 0.0.0.0 -p 5000
}

# 4. 대기 및 확인
Start-Sleep -Seconds 10

$test = Test-NetConnection -ComputerName localhost -Port $PORT -WarningAction SilentlyContinue
if ($test.TcpTestSucceeded) {
    Write-Host "✅ 로컬 서버 OK: http://localhost:$PORT" -ForegroundColor Green
    
    # 5. ngrok 확인
    Write-Host "ngrok 확인..." -ForegroundColor Cyan
    try {
        $resp = Invoke-RestMethod -Uri "http://localhost:4040/api/tunnels" -ErrorAction SilentlyContinue
        $url = $resp.tunnels[0].public_url -replace "http", "https"
        Write-Host "✅ 외부 주소: $url" -ForegroundColor Green
    } catch {
        Write-Host "⚠ ngrok 재시작 필요" -ForegroundColor Yellow
        Start-Job -ScriptBlock { ngrok http 5000 } | Out-Null
        Start-Sleep -Seconds 5
    }
} else {
    Write-Host "❌ 서버 시작 실패" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "=== 서버 실행 완료 ===" -ForegroundColor Green
Write-Host "중지: Get-Job | Stop-Job" -ForegroundColor Gray