# POS 서버 백그라운드 실행 스크립트
param(
    [int]$port = 5000
)

$ErrorActionPreference = "Stop"

# 기존 프로세스 정리
$nodeProcs = Get-Process -Name node -ErrorAction SilentlyContinue
if ($nodeProcs) {
    Write-Host "기존 node 프로세스 종료 중..."
    Stop-Process -Name node -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2
}

$ngrokProcs = Get-Process -Name ngrok -ErrorAction SilentlyContinue
if ($ngrokProcs) {
    Write-Host "기존 ngrok 프로세스 종료 중..."
    Stop-Process -Name ngrok -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2
}

# 서버 시작 (숨김 모드)
Write-Host "서버 시작 중... (포트 $port)"
$serverJob = Start-Job -ScriptBlock {
    param($p)
    Set-Location "D:\pos"
    npx next dev -H 0.0.0.0 -p $p
} -ArgumentList $port

# 서버가 실행될 때까지 대기
Start-Sleep -Seconds 8

# 로컬 서버 확인
$testResult = Test-NetConnection -ComputerName localhost -Port $port -WarningAction SilentlyContinue
if ($testResult.TcpTestSucceeded) {
    Write-Host "✅ 로컬 서버 실행 완료: http://localhost:$port"
} else {
    Write-Host "❌ 로컬 서버 실행 실패"
    exit 1
}

# ngrok 시작
Write-Host "ngrok 터널 시작 중..."
$ngrokJob = Start-Job -ScriptBlock {
    ngrok http 5000 --log stdout
} 

Start-Sleep -Seconds 5

# ngrok URL 확인
try {
    $response = Invoke-RestMethod -Uri "http://localhost:4040/api/tunnels" -ErrorAction SilentlyContinue
    $url = $response.tunnels[0].public_url
    Write-Host "✅ 외부 접속 주소: $url"
} catch {
    Write-Host "⚠ ngrok 주소 확인 실패 - 기존 주소를 사용하세요"
}

Write-Host ""
Write-Host "=== 서버 실행 완료 ==="
Write-Host "로컬: http://localhost:$port"
Write-Host "外部: https://earthworm-paralyze-scabby.ngrok-free.dev"
Write-Host ""
Write-Host "중지하려면: Get-Job | Stop-Job"