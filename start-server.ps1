# Script to start server after cleaning port
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Blue Print Financial - Server Starter" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Kill any process on port 5000
Write-Host "Step 1: Cleaning port 5000..." -ForegroundColor Yellow
$processes = netstat -ano | findstr :5000 | findstr LISTENING

if ($processes) {
    $pid = ($processes -split '\s+')[-1]
    Write-Host "   Found process with PID: $pid" -ForegroundColor Yellow
    taskkill /F /PID $pid 2>$null
    Write-Host "   ✅ Process killed" -ForegroundColor Green
    Start-Sleep -Seconds 2
} else {
    Write-Host "   ✅ Port 5000 is free" -ForegroundColor Green
}

Write-Host ""
Write-Host "Step 2: Starting server..." -ForegroundColor Yellow
Write-Host ""

# Start server
npm run dev
