# Quick Infrastructure Validation Script
Write-Host "=== DatatechtonCRM Quick Infrastructure Check ===" -ForegroundColor Cyan
Write-Host ""

# Check Docker
Write-Host "Checking Docker..." -ForegroundColor Blue
if (Get-Command docker -ErrorAction SilentlyContinue) {
    Write-Host "✓ Docker is installed" -ForegroundColor Green
    try {
        docker info | Out-Null
        Write-Host "✓ Docker daemon is running" -ForegroundColor Green
    } catch {
        Write-Host "✗ Docker daemon is not running" -ForegroundColor Red
    }
} else {
    Write-Host "✗ Docker is not installed" -ForegroundColor Red
}

# Check Docker Compose
if (Get-Command docker-compose -ErrorAction SilentlyContinue) {
    Write-Host "✓ Docker Compose is installed" -ForegroundColor Green
} else {
    Write-Host "✗ Docker Compose is not installed" -ForegroundColor Red
}

# Check Node.js
if (Get-Command node -ErrorAction SilentlyContinue) {
    $nodeVersion = node -v
    Write-Host "✓ Node.js is installed ($nodeVersion)" -ForegroundColor Green
} else {
    Write-Host "✗ Node.js is not installed" -ForegroundColor Red
}

# Check project structure
Write-Host ""
Write-Host "Checking project structure..." -ForegroundColor Blue

$requiredDirs = @("services", "frontend", "k8s", "infrastructure", "scripts")
foreach ($dir in $requiredDirs) {
    if (Test-Path $dir) {
        Write-Host "✓ $dir directory exists" -ForegroundColor Green
    } else {
        Write-Host "✗ $dir directory missing" -ForegroundColor Red
    }
}

$requiredFiles = @("docker-compose.yml", "package.json", ".env.example")
foreach ($file in $requiredFiles) {
    if (Test-Path $file) {
        Write-Host "✓ $file exists" -ForegroundColor Green
    } else {
        Write-Host "✗ $file missing" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "Quick validation complete!" -ForegroundColor Cyan
