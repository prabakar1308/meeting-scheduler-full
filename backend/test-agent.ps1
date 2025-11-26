$headers = @{"Content-Type" = "application/json"}
$body = @{
    sessionId = "test-session-20251126104700"
    message = "Find a time to meet with alice@example.com tomorrow at 2 PM"
} | ConvertTo-Json

Write-Host ""
Write-Host "Testing Agent Chat Endpoint" -ForegroundColor Cyan
Write-Host "===========================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Sending request..." -ForegroundColor Yellow

try {
    $response = Invoke-RestMethod -Uri "http://localhost:4000/agent-chat/message" -Method Post -Headers $headers -Body $body -TimeoutSec 90
    Write-Host ""
    Write-Host "SUCCESS!" -ForegroundColor Green
    Write-Host ""
    Write-Host ($response | ConvertTo-Json -Depth 10)
} catch {
    Write-Host ""
    Write-Host "ERROR!" -ForegroundColor Red
    Write-Host $_.Exception.Message
}

Write-Host ""
Write-Host "Check the backend terminal for detailed logs" -ForegroundColor Magenta
