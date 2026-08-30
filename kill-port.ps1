# Script to kill process on port 5000
Write-Host "Checking for processes on port 5000..." -ForegroundColor Yellow

$processes = netstat -ano | findstr :5000 | findstr LISTENING

if ($processes) {
    $pid = ($processes -split '\s+')[-1]
    Write-Host "Found process with PID: $pid" -ForegroundColor Yellow
    Write-Host "Killing process..." -ForegroundColor Yellow
    taskkill /F /PID $pid
    Write-Host "✅ Process killed successfully!" -ForegroundColor Green
    Start-Sleep -Seconds 2
} else {
    Write-Host "✅ No process found on port 5000" -ForegroundColor Green
}

Write-Host ""
Write-Host "Port 5000 is now free. You can start the server." -ForegroundColor Green
