# AiLert Infrastructure Validation Script for Windows PowerShell
param(
    [switch]$Detailed = $false
)

# Colors for output
$Red = "Red"
$Green = "Green"
$Yellow = "Yellow"
$Blue = "Blue"
$Cyan = "Cyan"

# Counters
$TotalChecks = 0
$PassedChecks = 0
$FailedChecks = 0

function Write-Info {
    param([string]$Message)
    Write-Host "[INFO] $Message" -ForegroundColor $Blue
}

function Write-Success {
    param([string]$Message)
    Write-Host "[✓] $Message" -ForegroundColor $Green
    $script:PassedChecks++
}

function Write-Warning {
    param([string]$Message)
    Write-Host "[!] $Message" -ForegroundColor $Yellow
}

function Write-Error {
    param([string]$Message)
    Write-Host "[✗] $Message" -ForegroundColor $Red
    $script:FailedChecks++
}

function Test-Command {
    param([string]$Command, [string]$Name)
    $script:TotalChecks++

    if (Get-Command $Command -ErrorAction SilentlyContinue) {
        Write-Success "$Name is installed"
        return $true
    } else {
        Write-Error "$Name is not installed"
        return $false
    }
}

function Test-DockerService {
    param([string]$Service, [int]$Port)
    $script:TotalChecks++

    try {
        $status = docker-compose ps $Service 2>$null
        if ($status -match "Up") {
            Write-Success "$Service is running"

            # Check if port is accessible
            $connection = Test-NetConnection -ComputerName "localhost" -Port $Port -InformationLevel Quiet -WarningAction SilentlyContinue
            if ($connection) {
                Write-Success "$Service is accessible on port $Port"
            } else {
                Write-Warning "$Service is running but port $Port is not accessible"
            }
            return $true
        } else {
            Write-Error "$Service is not running"
            return $false
        }
    } catch {
        Write-Error "$Service status check failed"
        return $false
    }
}

function Test-Endpoint {
    param([string]$Url, [string]$Name)
    $script:TotalChecks++

    try {
        $response = Invoke-WebRequest -Uri $Url -Method GET -TimeoutSec 5 -UseBasicParsing
        if ($response.StatusCode -eq 200) {
            Write-Success "$Name endpoint is accessible"
            return $true
        } else {
            Write-Error "$Name endpoint returned status $($response.StatusCode)"
            return $false
        }
    } catch {
        Write-Error "$Name endpoint is not accessible ($Url)"
        return $false
    }
}

function Test-FileExists {
    param([string]$Path, [string]$Name)
    $script:TotalChecks++

    if (Test-Path $Path -PathType Leaf) {
        Write-Success "$Name exists"
        return $true
    } else {
        Write-Error "$Name does not exist ($Path)"
        return $false
    }
}

function Test-DirectoryExists {
    param([string]$Path, [string]$Name)
    $script:TotalChecks++

    if (Test-Path $Path -PathType Container) {
        Write-Success "$Name directory exists"
        return $true
    } else {
        Write-Error "$Name directory does not exist ($Path)"
        return $false
    }
}

# Main validation
Write-Host "=== AiLert Infrastructure Validation ===" -ForegroundColor $Cyan
Write-Host "$(Get-Date)"
Write-Host ""

# Check prerequisites
Write-Info "Checking prerequisites..."
Test-Command "docker" "Docker"
Test-Command "docker-compose" "Docker Compose"
Test-Command "node" "Node.js"
Test-Command "npm" "npm"

# Check Node.js version
if (Get-Command node -ErrorAction SilentlyContinue) {
    $nodeVersion = node -v
    $versionNumber = [int]($nodeVersion -replace 'v(\d+)\..*', '$1')
    $script:TotalChecks++
    if ($versionNumber -ge 18) {
        Write-Success "Node.js version is 18 or higher ($nodeVersion)"
    } else {
        Write-Error "Node.js version must be 18 or higher (current: $nodeVersion)"
    }
}

Write-Host ""

# Check project structure
Write-Info "Checking project structure..."
Test-DirectoryExists "services" "Services"
Test-DirectoryExists "frontend" "Frontend"
Test-DirectoryExists "k8s" "Kubernetes manifests"
Test-DirectoryExists "infrastructure" "Infrastructure"
Test-DirectoryExists "scripts" "Scripts"
Test-DirectoryExists ".vscode" "VS Code configuration"

# Check configuration files
Write-Info "Checking configuration files..."
Test-FileExists "docker-compose.yml" "Docker Compose configuration"
Test-FileExists "docker-compose.prod.yml" "Production Docker Compose configuration"
Test-FileExists "docker-compose.override.yml" "Development Docker Compose override"
Test-FileExists ".env.example" "Environment example file"
Test-FileExists "package.json" "Root package.json"
Test-FileExists ".github/workflows/ci-cd.yml" "CI/CD workflow"
Test-FileExists ".hadolint.yaml" "Hadolint configuration"

# Check service directories and files
Write-Info "Checking service structure..."
$services = @("user-service", "newsletter-service", "content-service", "crm-service", "analytics-service")
foreach ($service in $services) {
    Test-DirectoryExists "services/$service" "$service directory"
    Test-FileExists "services/$service/Dockerfile" "$service Dockerfile"
    Test-FileExists "k8s/$service.yaml" "$service Kubernetes manifest"
}

Write-Host ""

# Check if Docker is running
Write-Info "Checking Docker daemon..."
$script:TotalChecks++
try {
    docker info | Out-Null
    Write-Success "Docker daemon is running"
}
catch {
    Write-Error "Docker daemon is not running"
    Write-Host "Please start Docker and run this script again" -ForegroundColor $Yellow
    exit 1
}

Write-Host ""

# Check Docker Compose services
Write-Info "Checking Docker Compose services..."
if (Test-Path "docker-compose.yml") {
    try {
        $servicesInCompose = docker-compose config --services 2>$null
        if ($servicesInCompose) {
            Write-Success "Docker Compose configuration is valid"

            # Check if any services are running
            $runningServices = docker-compose ps --services --filter "status=running" 2>$null
            if ($runningServices) {
                Write-Info "Running services: $($runningServices -join ', ')"

                # Check specific services
                if ($runningServices -contains "postgres") { Test-DockerService "postgres" 5432 }
                if ($runningServices -contains "redis") { Test-DockerService "redis" 6379 }
                if ($runningServices -contains "elasticsearch") { Test-DockerService "elasticsearch" 9200 }
                if ($runningServices -contains "rabbitmq") { Test-DockerService "rabbitmq" 5672 }

                # Check application services if running
                $servicePorts = @{
                    "user-service" = 3001
                    "newsletter-service" = 3002
                    "content-service" = 3003
                    "crm-service" = 3004
                    "analytics-service" = 3005
                }

                foreach ($service in $services) {
                    if ($runningServices -contains $service) {
                        Test-DockerService $service $servicePorts[$service]
                    }
                }
            } else {
                Write-Warning "No services are currently running"
                Write-Info "Run 'docker-compose up -d' to start services"
            }
        } else {
            Write-Error "Docker Compose configuration is invalid"
        }
    } catch {
        Write-Error "Failed to check Docker Compose configuration"
    }
}

Write-Host ""

# Check service endpoints (if services are running)
Write-Info "Checking service endpoints..."
try {
    $runningServices = docker-compose ps --services --filter "status=running" 2>$null

    if ($runningServices -contains "user-service") {
        Test-Endpoint "http://localhost:3001/health" "User Service health"
    }

    if ($runningServices -contains "newsletter-service") {
        Test-Endpoint "http://localhost:3002/health" "Newsletter Service health"
    }

    if ($runningServices -contains "content-service") {
        Test-Endpoint "http://localhost:3003/health" "Content Service health"
    }

    if ($runningServices -contains "crm-service") {
        Test-Endpoint "http://localhost:3004/health" "CRM Service health"
    }

    if ($runningServices -contains "analytics-service") {
        Test-Endpoint "http://localhost:3005/health" "Analytics Service health"
    }

    if ($runningServices -contains "frontend") {
        Test-Endpoint "http://localhost:3000" "Frontend"
    }

    if ($runningServices -contains "api-gateway") {
        Test-Endpoint "http://localhost:8000/health" "API Gateway health"
    }
} catch {
    Write-Warning "Could not check running services"
}

Write-Host ""

# Check monitoring services
Write-Info "Checking monitoring services..."
try {
    $runningServices = docker-compose ps --services --filter "status=running" 2>$null

    if ($runningServices -contains "prometheus") {
        Test-Endpoint "http://localhost:9090/-/healthy" "Prometheus"
    }

    if ($runningServices -contains "grafana") {
        Test-Endpoint "http://localhost:3001/api/health" "Grafana"
    }
} catch {
    Write-Warning "Could not check monitoring services"
}

Write-Host ""

# Check development tools
Write-Info "Checking development tools..."
try {
    $runningServices = docker-compose ps --services --filter "status=running" 2>$null

    if ($runningServices -contains "mailhog") {
        Test-Endpoint "http://localhost:8025" "MailHog"
    }

    if ($runningServices -contains "pgadmin") {
        Test-Endpoint "http://localhost:5050" "pgAdmin"
    }

    if ($runningServices -contains "redis-commander") {
        Test-Endpoint "http://localhost:8081" "Redis Commander"
    }

    if ($runningServices -contains "kibana") {
        Test-Endpoint "http://localhost:5601/api/status" "Kibana"
    }
} catch {
    Write-Warning "Could not check development tools"
}

Write-Host ""

# Check security configurations
Write-Info "Checking security configurations..."

# Check for secrets in git
$script:TotalChecks++
if ((Test-Path ".gitignore") -and (Get-Content ".gitignore" | Select-String "\.env")) {
    Write-Success ".env file is properly ignored by git"
} else {
    Write-Warning ".env file may not be properly ignored by git"
}

# Check Dockerfile security
foreach ($service in $services) {
    $dockerfile = "services/$service/Dockerfile"
    if (Test-Path $dockerfile) {
        $script:TotalChecks++
        $content = Get-Content $dockerfile -Raw
        if ($content -match "USER.*nodejs") {
            Write-Success "$service Dockerfile uses non-root user"
        } else {
            Write-Warning "$service Dockerfile may be running as root"
        }
    }
}

Write-Host ""

# Summary
Write-Host "=== Validation Summary ===" -ForegroundColor $Cyan
Write-Host "Total checks: $TotalChecks"
Write-Host "Passed: $PassedChecks" -ForegroundColor $Green
Write-Host "Failed: $FailedChecks" -ForegroundColor $Red

if ($FailedChecks -eq 0) {
    Write-Host "✓ All checks passed! Infrastructure is ready." -ForegroundColor $Green
    exit 0
}
else {
    Write-Host "✗ $FailedChecks checks failed. Please address the issues above." -ForegroundColor $Red
    exit 1
}
