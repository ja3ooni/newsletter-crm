# Development Utilities Script for Windows PowerShell
# Collection of useful development commands and shortcuts

param(
    [Parameter(Position=0)]
    [string]$Command,

    [Parameter(Position=1, ValueFromRemainingArguments=$true)]
    [string[]]$Arguments
)

# Colors for output
function Write-Info {
    param([string]$Message)
    Write-Host "🔵 [INFO] $Message" -ForegroundColor Blue
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

# Show help
function Show-Help {
    Write-Host "Development Utilities" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Usage: .\scripts\dev-utils.ps1 <command> [options]"
    Write-Host ""
    Write-Host "Available commands:" -ForegroundColor Yellow
    Write-Host "  status          Show development environment status" -ForegroundColor Green
    Write-Host "  logs [service]  Show logs for all services or specific service" -ForegroundColor Green
    Write-Host "  restart [service] Restart all services or specific service" -ForegroundColor Green
    Write-Host "  clean           Clean all build artifacts and caches" -ForegroundColor Green
    Write-Host "  reset           Reset development environment" -ForegroundColor Green
    Write-Host "  test [pattern]  Run tests with optional pattern" -ForegroundColor Green
    Write-Host "  lint            Run linting and formatting" -ForegroundColor Green
    Write-Host "  build           Build all services" -ForegroundColor Green
    Write-Host "  db-reset        Reset database with fresh data" -ForegroundColor Green
    Write-Host "  generate        Interactive code generation" -ForegroundColor Green
    Write-Host "  debug <service> Start service in debug mode" -ForegroundColor Green
    Write-Host "  profile         Run performance profiling" -ForegroundColor Green
    Write-Host "  docs            Generate and serve documentation" -ForegroundColor Green
    Write-Host ""
    Write-Host "Examples:" -ForegroundColor Yellow
    Write-Host "  .\scripts\dev-utils.ps1 status"
    Write-Host "  .\scripts\dev-utils.ps1 logs user-service"
    Write-Host "  .\scripts\dev-utils.ps1 test newsletter"
    Write-Host "  .\scripts\dev-utils.ps1 debug user-service"
}

# Check development environment status
function Check-Status {
    Write-Info "Checking development environment status..."
    Write-Host ""

    # Check Docker services
    Write-Host "Docker Services:" -ForegroundColor Cyan
    try {
        if (Get-Command docker-compose -ErrorAction SilentlyContinue) {
            docker-compose ps
        } elseif (Get-Command docker -ErrorAction SilentlyContinue) {
            docker compose ps
        } else {
            Write-Error "Docker Compose not found"
        }
    } catch {
        Write-Error "Failed to check Docker services: $_"
    }
    Write-Host ""

    # Check Node.js processes
    Write-Host "Node.js Processes:" -ForegroundColor Cyan
    try {
        $nodeProcesses = Get-Process -Name "node" -ErrorAction SilentlyContinue
        if ($nodeProcesses) {
            $nodeProcesses | Format-Table -Property Id, ProcessName, CPU, WorkingSet
        } else {
            Write-Host "No Node.js processes running"
        }
    } catch {
        Write-Host "No Node.js processes running"
    }
    Write-Host ""

    # Check ports
    Write-Host "Port Usage:" -ForegroundColor Cyan
    $ports = @(3000, 3001, 8000, 8001, 8002, 8003, 8004, 5432, 6379, 9200, 5672, 1025, 8025)
    foreach ($port in $ports) {
        try {
            $connection = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
            if ($connection) {
                $process = Get-Process -Id $connection.OwningProcess -ErrorAction SilentlyContinue
                Write-Host "Port $port`: $($process.ProcessName)"
            }
        } catch {
            # Port not in use
        }
    }
    Write-Host ""

    # Check disk space
    Write-Host "Disk Usage:" -ForegroundColor Cyan
    Get-WmiObject -Class Win32_LogicalDisk | Where-Object {$_.DriveType -eq 3} |
        Select-Object DeviceID, @{Name="Size(GB)";Expression={[math]::Round($_.Size/1GB,2)}},
        @{Name="FreeSpace(GB)";Expression={[math]::Round($_.FreeSpace/1GB,2)}},
        @{Name="PercentFree";Expression={[math]::Round(($_.FreeSpace/$_.Size)*100,2)}} |
        Format-Table
    Write-Host ""

    # Check memory usage
    Write-Host "Memory Usage:" -ForegroundColor Cyan
    $memory = Get-WmiObject -Class Win32_OperatingSystem
    $totalMemory = [math]::Round($memory.TotalVisibleMemorySize/1MB, 2)
    $freeMemory = [math]::Round($memory.FreePhysicalMemory/1MB, 2)
    $usedMemory = $totalMemory - $freeMemory
    Write-Host "Total: $totalMemory GB, Used: $usedMemory GB, Free: $freeMemory GB"
}

# Show logs
function Show-Logs {
    param([string]$Service)

    if ([string]::IsNullOrEmpty($Service)) {
        Write-Info "Showing logs for all services..."
        if (Get-Command docker-compose -ErrorAction SilentlyContinue) {
            docker-compose logs -f --tail=100
        } else {
            docker compose logs -f --tail=100
        }
    } else {
        Write-Info "Showing logs for $Service..."
        if (Get-Command docker-compose -ErrorAction SilentlyContinue) {
            docker-compose logs -f --tail=100 $Service
        } else {
            docker compose logs -f --tail=100 $Service
        }
    }
}

# Restart services
function Restart-Services {
    param([string]$Service)

    if ([string]::IsNullOrEmpty($Service)) {
        Write-Info "Restarting all services..."
        if (Get-Command docker-compose -ErrorAction SilentlyContinue) {
            docker-compose restart
        } else {
            docker compose restart
        }

        # Restart Node.js processes
        $nodeProcesses = Get-Process -Name "node" -ErrorAction SilentlyContinue
        if ($nodeProcesses) {
            Write-Info "Restarting Node.js processes..."
            $nodeProcesses | Stop-Process -Force
            Start-Sleep -Seconds 2
            Start-Process -FilePath "npm" -ArgumentList "run", "dev" -NoNewWindow
        }
    } else {
        Write-Info "Restarting $Service..."
        if (Get-Command docker-compose -ErrorAction SilentlyContinue) {
            docker-compose restart $Service
        } else {
            docker compose restart $Service
        }
    }

    Write-Success "Services restarted"
}

# Clean build artifacts and caches
function Clean-Environment {
    Write-Info "Cleaning development environment..."

    # Clean Node.js artifacts
    Write-Info "Cleaning Node.js artifacts..."
    Get-ChildItem -Path . -Recurse -Directory -Name "node_modules" | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
    Get-ChildItem -Path . -Recurse -Directory -Name "dist" | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
    Get-ChildItem -Path . -Recurse -Directory -Name ".next" | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
    Get-ChildItem -Path . -Recurse -Directory -Name "coverage" | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue

    # Clean TypeScript cache
    Get-ChildItem -Path . -Recurse -File -Name "*.tsbuildinfo" | Remove-Item -Force -ErrorAction SilentlyContinue

    # Clean Jest cache
    try {
        npx jest --clearCache
    } catch {
        Write-Warning "Failed to clear Jest cache"
    }

    # Clean Docker artifacts
    Write-Info "Cleaning Docker artifacts..."
    try {
        docker system prune -f | Out-Null
    } catch {
        Write-Warning "Failed to clean Docker artifacts"
    }

    # Clean logs
    Write-Info "Cleaning logs..."
    Get-ChildItem -Path . -Recurse -File -Name "*.log" | Remove-Item -Force -ErrorAction SilentlyContinue

    Write-Success "Environment cleaned"
}

# Reset development environment
function Reset-Environment {
    Write-Warning "This will reset your entire development environment!"
    $confirmation = Read-Host "Are you sure? (y/N)"

    if ($confirmation -eq 'y' -or $confirmation -eq 'Y') {
        Write-Info "Resetting development environment..."

        # Stop all services
        if (Get-Command docker-compose -ErrorAction SilentlyContinue) {
            docker-compose down -v
        } else {
            docker compose down -v
        }

        # Kill Node.js processes
        Get-Process -Name "node" -ErrorAction SilentlyContinue | Stop-Process -Force

        # Clean environment
        Clean-Environment

        # Reinstall dependencies
        Write-Info "Reinstalling dependencies..."
        npm install

        # Restart infrastructure
        Write-Info "Starting infrastructure..."
        if (Get-Command docker-compose -ErrorAction SilentlyContinue) {
            docker-compose up -d postgres redis elasticsearch rabbitmq mailhog
        } else {
            docker compose up -d postgres redis elasticsearch rabbitmq mailhog
        }

        # Wait for services
        Start-Sleep -Seconds 10

        # Reset database
        Reset-Database

        Write-Success "Environment reset complete"
    } else {
        Write-Info "Reset cancelled"
    }
}

# Run tests
function Run-Tests {
    param([string]$Pattern)

    if ([string]::IsNullOrEmpty($Pattern)) {
        Write-Info "Running all tests..."
        npm test -- --silent
    } else {
        Write-Info "Running tests matching pattern: $Pattern"
        npm test -- --silent --testNamePattern="$Pattern"
    }
}

# Run linting and formatting
function Run-Lint {
    Write-Info "Running code quality checks..."
    node scripts/quality-tools/code-quality-check.js --fix
}

# Build all services
function Build-Services {
    Write-Info "Building all services..."

    # Build root project
    if (Test-Path "package.json") {
        $packageJson = Get-Content "package.json" | ConvertFrom-Json
        if ($packageJson.scripts.build) {
            npm run build
        }
    }

    # Build services
    Get-ChildItem -Path "services" -Directory | ForEach-Object {
        $serviceDir = $_.FullName
        $packageJsonPath = Join-Path $serviceDir "package.json"

        if (Test-Path $packageJsonPath) {
            $packageJson = Get-Content $packageJsonPath | ConvertFrom-Json
            if ($packageJson.scripts.build) {
                Write-Info "Building $($_.Name)..."
                Push-Location $serviceDir
                try {
                    npm run build
                } finally {
                    Pop-Location
                }
            }
        }
    }

    # Build frontend
    if (Test-Path "frontend/package.json") {
        $packageJson = Get-Content "frontend/package.json" | ConvertFrom-Json
        if ($packageJson.scripts.build) {
            Write-Info "Building frontend..."
            Push-Location "frontend"
            try {
                npm run build
            } finally {
                Pop-Location
            }
        }
    }

    Write-Success "All services built successfully"
}

# Reset database
function Reset-Database {
    Write-Info "Resetting database..."

    if (Test-Path "package.json") {
        $packageJson = Get-Content "package.json" | ConvertFrom-Json
        if ($packageJson.scripts."db:reset") {
            npm run db:reset
        } else {
            Write-Warning "No db:reset script found"

            # Manual database reset
            if (Get-Command docker-compose -ErrorAction SilentlyContinue) {
                docker-compose exec -T postgres psql -U datatechtoncrm -d datatechtoncrm -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
            } else {
                docker compose exec -T postgres psql -U datatechtoncrm -d datatechtoncrm -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
            }

            # Run migrations if available
            if ($packageJson.scripts."db:migrate") {
                npm run db:migrate
            }

            # Seed database if available
            if ($packageJson.scripts."db:seed") {
                npm run db:seed
            }
        }
    }

    Write-Success "Database reset complete"
}

# Interactive code generation
function Interactive-Generate {
    Write-Host "Code Generation Menu" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "1. Generate new service"
    Write-Host "2. Generate API endpoints"
    Write-Host "3. Generate React component"
    Write-Host "4. Generate database migration"
    Write-Host "5. Exit"
    Write-Host ""

    $choice = Read-Host "Select option (1-5)"

    switch ($choice) {
        "1" {
            $serviceName = Read-Host "Service name"
            node scripts/code-generators/generate-service.js $serviceName
        }
        "2" {
            $serviceName = Read-Host "Service name"
            $resourceName = Read-Host "Resource name"
            node scripts/code-generators/generate-api.js $serviceName $resourceName
        }
        "3" {
            $componentName = Read-Host "Component name"
            Write-Host "Generating React component: $componentName"
            # Add React component generator here
        }
        "4" {
            $migrationName = Read-Host "Migration name"
            Write-Host "Generating migration: $migrationName"
            # Add migration generator here
        }
        "5" {
            Write-Info "Exiting..."
        }
        default {
            Write-Error "Invalid option"
        }
    }
}

# Debug service
function Debug-Service {
    param([string]$Service)

    if ([string]::IsNullOrEmpty($Service)) {
        Write-Error "Service name required"
        Write-Host "Available services:"
        Get-ChildItem -Path "services" -Directory | Where-Object { $_.Name -ne "shared" } | ForEach-Object { Write-Host "  $($_.Name)" }
        return
    }

    $serviceDir = "services/$Service"

    if (-not (Test-Path $serviceDir)) {
        Write-Error "Service not found: $Service"
        return
    }

    Write-Info "Starting $Service in debug mode..."
    Write-Info "Debug port: 9229"
    Write-Info "Attach your debugger to localhost:9229"

    Push-Location $serviceDir
    try {
        npm run dev:debug
    } finally {
        Pop-Location
    }
}

# Performance profiling
function Run-Profiling {
    Write-Info "Running performance profiling..."

    # Check if performance tests exist
    if (Test-Path "tests/performance") {
        Write-Info "Running performance tests..."
        npm run test:performance
    } else {
        Write-Warning "No performance tests found"
    }

    # Profile memory usage
    Write-Info "Profiling memory usage..."
    node --inspect --max-old-space-size=4096 -e "
        const used = process.memoryUsage();
        console.log('Memory Usage:');
        for (let key in used) {
            console.log(\`\${key}: \${Math.round(used[key] / 1024 / 1024 * 100) / 100} MB\`);
        }
    "
}

# Generate and serve documentation
function Serve-Docs {
    Write-Info "Generating documentation..."

    # Generate API docs if available
    if (Test-Path "package.json") {
        $packageJson = Get-Content "package.json" | ConvertFrom-Json
        if ($packageJson.scripts."docs:generate") {
            npm run docs:generate
        }
    }

    # Generate TypeDoc if available
    if (Get-Command typedoc -ErrorAction SilentlyContinue) {
        typedoc --out docs/api src
    }

    # Serve documentation
    if (Test-Path "docs") {
        Write-Info "Serving documentation at http://localhost:8080"
        if (Get-Command python -ErrorAction SilentlyContinue) {
            Push-Location "docs"
            try {
                python -m http.server 8080
            } finally {
                Pop-Location
            }
        } elseif (Get-Command npx -ErrorAction SilentlyContinue) {
            npx serve docs -p 8080
        } else {
            Write-Error "No web server available to serve documentation"
        }
    } else {
        Write-Error "No documentation directory found"
    }
}

# Main command dispatcher
switch ($Command.ToLower()) {
    "status" {
        Check-Status
    }
    "logs" {
        Show-Logs $Arguments[0]
    }
    "restart" {
        Restart-Services $Arguments[0]
    }
    "clean" {
        Clean-Environment
    }
    "reset" {
        Reset-Environment
    }
    "test" {
        Run-Tests $Arguments[0]
    }
    "lint" {
        Run-Lint
    }
    "build" {
        Build-Services
    }
    "db-reset" {
        Reset-Database
    }
    "generate" {
        Interactive-Generate
    }
    "debug" {
        Debug-Service $Arguments[0]
    }
    "profile" {
        Run-Profiling
    }
    "docs" {
        Serve-Docs
    }
    { $_ -in @("help", "--help", "-h", "") } {
        Show-Help
    }
    default {
        Write-Error "Unknown command: $Command"
        Show-Help
        exit 1
    }
}
