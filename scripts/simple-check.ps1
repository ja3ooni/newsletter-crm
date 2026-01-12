# Simple Infrastructure Check
Write-Host "=== DatatechtonCRM Infrastructure Check ===" -ForegroundColor Cyan

# Check Docker
if (Get-Command docker -ErrorAction SilentlyContinue) {
    Write-Host "OK Docker is installed" -ForegroundColor Green
} else {
    Write-Host "X Docker is not installed" -ForegroundColor Red
}

# Check Docker Compose
if (Get-Command docker-compose -ErrorAction SilentlyContinue) {
    Write-Host "OK Docker Compose is installed" -ForegroundColor Green
} else {
    Write-Host "X Docker Compose is not installed" -ForegroundColor Red
}

# Check Node.js
if (Get-Command node -ErrorAction SilentlyContinue) {
    $nodeVersion = node -v
    Write-Host "OK Node.js is installed ($nodeVersion)" -ForegroundColor Green
} else {
    Write-Host "X Node.js is not installed" -ForegroundColor Red
}

# Check project files
if (Test-Path "docker-compose.yml") {
    Write-Host "OK docker-compose.yml exists" -ForegroundColor Green
} else {
    Write-Host "X docker-compose.yml missing" -ForegroundColor Red
}

if (Test-Path "package.json") {
    Write-Host "OK package.json exists" -ForegroundColor Green
} else {
    Write-Host "X package.json missing" -ForegroundColor Red
}

Write-Host "Check complete!" -ForegroundColor Cyan