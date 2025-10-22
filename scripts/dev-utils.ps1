# AiLert Development Utilities - PowerShell Version
param(
    [Parameter(Position=0)]
    [string]$Command,

    [Parameter(Position=1)]
    [string]$Parameter1,

    [Parameter(Position=2)]
    [string]$Parameter2
)

# Colors for output
$Colors = @{
    Red = "Red"
    Green = "Green"
    Yellow = "Yellow"
    Blue = "Blue"
    Cyan = "Cyan"
}

# Helper functions
function Write-Info {
    param([string]$Message)
    Write-Host "[INFO] $Message" -ForegroundColor $Colors.Blue
}

function Write-Success {
    param([string]$Message)
    Write-Host "[SUCCESS] $Message" -ForegroundColor $Colors.Green
}

function Write-Warning {
    param([string]$Message)
    Write-Host "[WARNING] $Message" -ForegroundColor $Colors.Yellow
}

function Write-Error {
    param([string]$Message)
    Write-Host "[ERROR] $Message" -ForegroundColor $Colors.Red
}

# Check prerequisites
function Test-Prerequisites {
    Write-Info "Checking prerequisites..."

    $allGood = $true

    # Check Docker
    if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
        Write-Error "Docker is not installed"
        $allGood = $false
    }

    # Check Docker Compose
    if (-not (Get-Command docker-compose -ErrorAction SilentlyContinue)) {
        Write-Error "Docker Compose is not installed"
        $allGood = $false
    }

    # Check Node.js
    if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
        Write-Error "Node.js is not installed"
        $allGood = $false
    } else {
        # Check Node.js version
        $nodeVersion = (node -v).Substring(1).Split('.')[0]
        if ([int]$nodeVersion -lt 18) {
            Write-Error "Node.js version 18 or higher is required. Current: $(node -v)"
            $allGood = $false
        }
    }

    if ($allGood) {
        Write-Success "All prerequisites are met"
        return $true
    } else {
        return $false
    }
}

# Install dependencies for all services
function Install-Dependencies {
    Write-Info "Installing dependencies for all services..."

    # Root dependencies
    npm install

    # Service dependencies
    Get-ChildItem -Path "services" -Directory | ForEach-Object {
        $packageJsonPath = Join-Path $_.FullName "package.json"
        if (Test-Path $packageJsonPath) {
            Write-Info "Installing dependencies for $($_.Name)..."
            Push-Location $_.FullName
            npm install
            Pop-Location
        }
    }

    # Frontend dependencies
    if (Test-Path "frontend/package.json") {
        Write-Info "Installing frontend dependencies..."
        Push-Location "frontend"
        npm install
        Pop-Location
    }

    Write-Success "All dependencies installed"
}

# Update dependencies for all services
function Update-Dependencies {
    Write-Info "Updating dependencies for all services..."

    # Root dependencies
    npm update

    # Service dependencies
    Get-ChildItem -Path "services" -Directory | ForEach-Object {
        $packageJsonPath = Join-Path $_.FullName "package.json"
        if (Test-Path $packageJsonPath) {
            Write-Info "Updating dependencies for $($_.Name)..."
            Push-Location $_.FullName
            npm update
            Pop-Location
        }
    }

    # Frontend dependencies
    if (Test-Path "frontend/package.json") {
        Write-Info "Updating frontend dependencies..."
        Push-Location "frontend"
        npm update
        Pop-Location
    }

    Write-Success "All dependencies updated"
}

# Clean all node_modules and reinstall
function Reset-Dependencies {
    Write-Info "Cleaning all node_modules and reinstalling..."

    # Remove all node_modules
    Get-ChildItem -Path . -Name "node_modules" -Recurse -Directory | ForEach-Object {
        $fullPath = Join-Path (Get-Location) $_
        Write-Info "Removing $fullPath"
        Remove-Item $fullPath -Recurse -Force -ErrorAction SilentlyContinue
    }

    # Remove package-lock.json files
    Get-ChildItem -Path . -Name "package-lock.json" -Recurse -File | ForEach-Object {
        Remove-Item $_ -Force
    }

    # Reinstall
    Install-Dependencies

    Write-Success "Clean install completed"
}

# Generate service boilerplate
function New-Service {
    param([string]$ServiceName)

    if (-not $ServiceName) {
        Write-Error "Service name is required"
        Write-Host "Usage: .\dev-utils.ps1 generate-service <service-name>"
        return
    }

    $serviceDir = "services\$ServiceName"

    if (Test-Path $serviceDir) {
        Write-Error "Service $ServiceName already exists"
        return
    }

    Write-Info "Generating service: $ServiceName"

    # Create service directory structure
    New-Item -ItemType Directory -Path "$serviceDir\src\controllers" -Force | Out-Null
    New-Item -ItemType Directory -Path "$serviceDir\src\services" -Force | Out-Null
    New-Item -ItemType Directory -Path "$serviceDir\src\models" -Force | Out-Null
    New-Item -ItemType Directory -Path "$serviceDir\src\middleware" -Force | Out-Null
    New-Item -ItemType Directory -Path "$serviceDir\src\utils" -Force | Out-Null
    New-Item -ItemType Directory -Path "$serviceDir\src\types" -Force | Out-Null
    New-Item -ItemType Directory -Path "$serviceDir\tests\unit" -Force | Out-Null
    New-Item -ItemType Directory -Path "$serviceDir\tests\integration" -Force | Out-Null
    New-Item -ItemType Directory -Path "$serviceDir\docs" -Force | Out-Null

    # Create package.json
    $packageJson = @"
{
  "name": "@ailert/$ServiceName",
  "version": "1.0.0",
  "description": "AiLert $ServiceName Service",
  "main": "dist/index.js",
  "scripts": {
    "build": "tsc",
    "dev": "ts-node-dev --respawn --transpile-only src/index.ts",
    "dev:debug": "ts-node-dev --inspect=0.0.0.0:9229 --respawn --transpile-only src/index.ts",
    "start": "node dist/index.js",
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "lint": "eslint src/**/*.ts",
    "lint:fix": "eslint src/**/*.ts --fix",
    "format": "prettier --write src/**/*.ts",
    "format:check": "prettier --check src/**/*.ts",
    "type-check": "tsc --noEmit"
  },
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "helmet": "^7.1.0",
    "morgan": "^1.10.0",
    "dotenv": "^16.3.1",
    "joi": "^17.11.0",
    "winston": "^3.11.0"
  },
  "devDependencies": {
    "@types/express": "^4.17.21",
    "@types/cors": "^2.8.17",
    "@types/morgan": "^1.9.9",
    "@types/node": "^20.9.0",
    "@types/jest": "^29.5.8",
    "typescript": "^5.3.2",
    "ts-node-dev": "^2.0.0",
    "jest": "^29.7.0",
    "ts-jest": "^29.1.1",
    "supertest": "^6.3.3",
    "@types/supertest": "^2.0.16"
  }
}
"@

    Set-Content -Path "$serviceDir\package.json" -Value $packageJson

    # Create TypeScript config
    $tsConfig = @"
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
"@

    Set-Content -Path "$serviceDir\tsconfig.json" -Value $tsConfig

    # Create basic index.ts
    $indexTs = @"
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(morgan('combined'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    service: '$ServiceName',
    timestamp: new Date().toISOString(),
  });
});

// Ready check endpoint
app.get('/ready', (req, res) => {
  res.status(200).json({
    status: 'ready',
    service: '$ServiceName',
    timestamp: new Date().toISOString(),
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`$ServiceName service running on port `${PORT}`);
});

export default app;
"@

    Set-Content -Path "$serviceDir\src\index.ts" -Value $indexTs

    # Copy Dockerfile
    Copy-Item "services\user-service\Dockerfile" "$serviceDir\Dockerfile"

    # Create basic test
    $healthTest = @"
import request from 'supertest';
import app from '../../src/index';

describe('Health Endpoints', () => {
  it('should return healthy status', async () => {
    const response = await request(app).get('/health');
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('healthy');
    expect(response.body.service).toBe('$ServiceName');
  });

  it('should return ready status', async () => {
    const response = await request(app).get('/ready');
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ready');
  });
});
"@

    Set-Content -Path "$serviceDir\tests\unit\health.test.ts" -Value $healthTest

    # Create Jest config
    $jestConfig = @"
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  testMatch: ['**/__tests__/**/*.ts', '**/?(*.)+(spec|test).ts'],
  transform: {
    '^.+\.ts$': 'ts-jest',
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
};
"@

    Set-Content -Path "$serviceDir\jest.config.js" -Value $jestConfig

    Write-Success "Service $ServiceName generated successfully"
    Write-Info "Next steps:"
    Write-Host "  1. cd $serviceDir"
    Write-Host "  2. npm install"
    Write-Host "  3. npm run dev"
}

# Run security audit
function Test-Security {
    Write-Info "Running security audit..."

    # Root audit
    npm audit --audit-level=moderate

    # Service audits
    Get-ChildItem -Path "services" -Directory | ForEach-Object {
        $packageJsonPath = Join-Path $_.FullName "package.json"
        if (Test-Path $packageJsonPath) {
            Write-Info "Auditing $($_.Name)..."
            Push-Location $_.FullName
            npm audit --audit-level=moderate
            Pop-Location
        }
    }

    # Frontend audit
    if (Test-Path "frontend/package.json") {
        Write-Info "Auditing frontend..."
        Push-Location "frontend"
        npm audit --audit-level=moderate
        Pop-Location
    }

    Write-Success "Security audit completed"
}

# Fix security vulnerabilities
function Repair-Security {
    Write-Info "Fixing security vulnerabilities..."

    # Root fix
    npm audit fix

    # Service fixes
    Get-ChildItem -Path "services" -Directory | ForEach-Object {
        $packageJsonPath = Join-Path $_.FullName "package.json"
        if (Test-Path $packageJsonPath) {
            Write-Info "Fixing $($_.Name)..."
            Push-Location $_.FullName
            npm audit fix
            Pop-Location
        }
    }

    # Frontend fix
    if (Test-Path "frontend/package.json") {
        Write-Info "Fixing frontend..."
        Push-Location "frontend"
        npm audit fix
        Pop-Location
    }

    Write-Success "Security fixes applied"
}

# Backup development data
function Backup-Data {
    $backupDir = "backups\$(Get-Date -Format 'yyyyMMdd_HHmmss')"

    Write-Info "Creating backup in $backupDir..."

    New-Item -ItemType Directory -Path $backupDir -Force | Out-Null

    # Backup databases
    docker-compose exec -T postgres pg_dumpall -U ailert | Out-File -FilePath "$backupDir\postgres_backup.sql" -Encoding UTF8

    # Backup Redis data
    docker-compose exec -T redis redis-cli --rdb - | Set-Content -Path "$backupDir\redis_backup.rdb" -AsByteStream

    Write-Success "Backup created in $backupDir"
}

# Restore development data
function Restore-Data {
    param([string]$BackupDir)

    if (-not $BackupDir) {
        Write-Error "Backup directory is required"
        Write-Host "Usage: .\dev-utils.ps1 restore-data <backup-directory>"
        return
    }

    if (-not (Test-Path $BackupDir)) {
        Write-Error "Backup directory does not exist: $BackupDir"
        return
    }

    Write-Info "Restoring data from $BackupDir..."

    # Restore PostgreSQL
    $postgresBackup = Join-Path $BackupDir "postgres_backup.sql"
    if (Test-Path $postgresBackup) {
        Get-Content $postgresBackup | docker-compose exec -T postgres psql -U ailert -d ailert
    }

    Write-Success "Data restored from $BackupDir"
}

# Main command handler
switch ($Command.ToLower()) {
    "check-prerequisites" {
        Test-Prerequisites
    }
    "install" {
        Install-Dependencies
    }
    "update" {
        Update-Dependencies
    }
    "clean-install" {
        Reset-Dependencies
    }
    "generate-service" {
        New-Service -ServiceName $Parameter1
    }
    "security-audit" {
        Test-Security
    }
    "security-fix" {
        Repair-Security
    }
    "backup" {
        Backup-Data
    }
    "restore" {
        Restore-Data -BackupDir $Parameter1
    }
    default {
        Write-Host "AiLert Development Utilities - PowerShell Version"
        Write-Host ""
        Write-Host "Usage: .\dev-utils.ps1 <command> [options]"
        Write-Host ""
        Write-Host "Commands:"
        Write-Host "  check-prerequisites           Check if all prerequisites are installed"
        Write-Host "  install                      Install dependencies for all services"
        Write-Host "  update                       Update dependencies for all services"
        Write-Host "  clean-install                Clean all node_modules and reinstall"
        Write-Host "  generate-service <name>      Generate boilerplate for new service"
        Write-Host "  security-audit               Run security audit for all services"
        Write-Host "  security-fix                 Fix security vulnerabilities"
        Write-Host "  backup                       Backup development data"
        Write-Host "  restore <backup-dir>         Restore data from backup"
        Write-Host ""
        Write-Host "Examples:"
        Write-Host "  .\dev-utils.ps1 generate-service billing-service"
        Write-Host "  .\dev-utils.ps1 backup"
        Write-Host "  .\dev-utils.ps1 restore backups\20231201_120000"
    }
}
