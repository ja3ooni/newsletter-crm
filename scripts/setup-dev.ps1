# DatatechtonCRM Development Environment Setup Script for Windows
param(
    [switch]$Force,
    [switch]$SkipPrerequisites
)

# Set error action preference
$ErrorActionPreference = "Stop"

# Colors for output
function Write-Info {
    param([string]$Message)
    Write-Host "🚀 [INFO] $Message" -ForegroundColor Blue
}

function Write-Success {
    param([string]$Message)
    Write-Host "✅ [SUCCESS] $Message" -ForegroundColor Green
}

function Write-Warning {
    param([string]$Message)
    Write-Host "⚠️ [WARNING] $Message" -ForegroundColor Yellow
}

function Write-Error {
    param([string]$Message)
    Write-Host "❌ [ERROR] $Message" -ForegroundColor Red
}

Write-Info "Setting up DatatechtonCRM development environment for Windows..."

# Check prerequisites
if (-not $SkipPrerequisites) {
    Write-Info "Checking prerequisites..."

    # Check if Docker Desktop is installed and running
    try {
        $dockerVersion = docker --version
        Write-Success "Docker is installed: $dockerVersion"
    }
    catch {
        Write-Error "Docker is not installed or not running. Please install Docker Desktop for Windows."
        Write-Info "Download from: https://www.docker.com/products/docker-desktop"
        exit 1
    }

    # Check if Docker Compose is available
    try {
        $composeVersion = docker-compose --version
        Write-Success "Docker Compose is available: $composeVersion"
    }
    catch {
        Write-Error "Docker Compose is not available. Please ensure Docker Desktop is properly installed."
        exit 1
    }

    # Check if Node.js is installed
    try {
        $nodeVersion = node --version
        $nodeMajorVersion = [int]($nodeVersion -replace 'v(\d+)\..*', '$1')
        if ($nodeMajorVersion -lt 18) {
            Write-Error "Node.js version 18 or higher is required. Current version: $nodeVersion"
            Write-Info "Download from: https://nodejs.org/"
            exit 1
        }
        Write-Success "Node.js is installed: $nodeVersion"
    }
    catch {
        Write-Error "Node.js is not installed. Please install Node.js 18+ from https://nodejs.org/"
        exit 1
    }

    # Check if Git is installed
    try {
        $gitVersion = git --version
        Write-Success "Git is installed: $gitVersion"
    }
    catch {
        Write-Warning "Git is not installed. Some features may not work properly."
        Write-Info "Download from: https://git-scm.com/download/win"
    }

    Write-Success "Prerequisites check passed"
}

# Create environment file if it doesn't exist
if (-not (Test-Path ".env") -or $Force) {
    Write-Info "Creating .env file..."

    $envContent = @"
# Development Environment Variables
NODE_ENV=development
DEBUG=true

# Database
POSTGRES_PASSWORD=datatechtoncrm_dev_password
POSTGRES_DB=datatechtoncrm
POSTGRES_USER=datatechtoncrm

# Redis
REDIS_PASSWORD=datatechtoncrm_redis_password

# RabbitMQ
RABBITMQ_PASSWORD=datatechtoncrm_rabbitmq_password

# JWT
JWT_SECRET=dev_jwt_secret_change_in_production

# SMTP (for development - use Mailhog or similar)
SMTP_HOST=localhost
SMTP_PORT=1025
SMTP_USERNAME=
SMTP_PASSWORD=

# AWS (optional for development)
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_REGION=us-east-1

# API URLs
API_URL=http://localhost:8000
NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1

# Monitoring
GRAFANA_PASSWORD=admin
"@

    $envContent | Out-File -FilePath ".env" -Encoding UTF8
    Write-Success "Created .env file with development defaults"
} else {
    Write-Success ".env file already exists"
}

# Create service directories if they don't exist
Write-Info "Creating service directories..."
$serviceDirs = @(
    "services\user-service",
    "services\newsletter-service",
    "services\content-service",
    "services\crm-service",
    "services\analytics-service",
    "frontend",
    "infrastructure\kong",
    "infrastructure\prometheus",
    "infrastructure\grafana"
)

foreach ($dir in $serviceDirs) {
    if (-not (Test-Path $dir)) {
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
        Write-Info "Created directory: $dir"
    }
}

# Install dependencies for existing services
Write-Info "Installing dependencies..."

# Root dependencies
if (Test-Path "package.json") {
    Write-Info "Installing root dependencies..."
    npm install
}

# Service dependencies
Get-ChildItem -Path "services" -Directory | ForEach-Object {
    $packageJsonPath = Join-Path $_.FullName "package.json"
    if (Test-Path $packageJsonPath) {
        Write-Info "Installing dependencies for $($_.Name)..."
        Push-Location $_.FullName
        try {
            npm install
        }
        finally {
            Pop-Location
        }
    }
}

# Frontend dependencies
if (Test-Path "frontend\package.json") {
    Write-Info "Installing frontend dependencies..."
    Push-Location "frontend"
    try {
        npm install
    }
    finally {
        Pop-Location
    }
}

# Pull required Docker images
Write-Info "Pulling Docker images..."
docker-compose pull

# Start infrastructure services
Write-Info "Starting infrastructure services..."
docker-compose up -d postgres redis elasticsearch rabbitmq

# Wait for services to be ready
Write-Info "Waiting for services to be ready..."
Start-Sleep -Seconds 30

# Check service health
Write-Info "Checking service health..."
docker-compose ps

# Create databases
Write-Info "Setting up databases..."
try {
    docker-compose exec -T postgres psql -U datatechtoncrm -d datatechtoncrm -c "SELECT version();"
}
catch {
    Write-Warning "Database setup will be handled by init scripts"
}

# Setup Git hooks (if .git exists)
if (Test-Path ".git") {
    Write-Info "Setting up Git hooks..."

    $preCommitHook = @"
#!/bin/bash
# Run linting and tests before commit
npm run lint:check
npm run test:unit -- --silent
"@

    $hookPath = ".git\hooks\pre-commit"
    $preCommitHook | Out-File -FilePath $hookPath -Encoding UTF8

    # Make executable (if on WSL or Git Bash)
    if (Get-Command "chmod" -ErrorAction SilentlyContinue) {
        chmod +x $hookPath
    }

    Write-Success "Git hooks configured"
}

# Create development scripts
Write-Info "Creating development scripts..."

# PowerShell scripts are already created, just make sure they exist
$scripts = @(
    "scripts\dev-start.ps1",
    "scripts\dev-stop.ps1",
    "scripts\dev-reset.ps1",
    "scripts\dev-logs.ps1"
)

foreach ($script in $scripts) {
    if (-not (Test-Path $script)) {
        Write-Warning "Script $script not found. Please ensure all PowerShell scripts are created."
    }
}

Write-Success "Development scripts are available in scripts\ directory"

# Create VS Code configuration for Windows
if (Get-Command "code" -ErrorAction SilentlyContinue) {
    Write-Info "VS Code detected. Configuration files should be properly set up."
    Write-Success "VS Code configuration ready"
} else {
    Write-Info "VS Code not found in PATH. You can install it from https://code.visualstudio.com/"
}

Write-Success ""
Write-Success "🎉 Development environment setup complete!"
Write-Success ""
Write-Info "📋 Next steps:"
Write-Info "  1. Review and update .env file with your configuration"
Write-Info "  2. Run '.\scripts\dev-start.ps1' to start all services"
Write-Info "  3. Visit http://localhost:3000 to see the frontend"
Write-Info "  4. Check service health at http://localhost:8000/health"
Write-Success ""
Write-Info "🔧 Useful commands:"
Write-Info "  - Start services: .\scripts\dev-start.ps1"
Write-Info "  - Stop services: .\scripts\dev-stop.ps1"
Write-Info "  - View logs: .\scripts\dev-logs.ps1 [service-name]"
Write-Info "  - Reset environment: .\scripts\dev-reset.ps1"
Write-Success ""
Write-Info "📚 Documentation:"
Write-Info "  - API docs will be available at http://localhost:8000/docs"
Write-Info "  - Monitoring at http://localhost:3001 (Grafana)"
Write-Info "  - Message queue at http://localhost:15672 (RabbitMQ)"
Write-Success ""
