# AiLert Health Monitoring Script - PowerShell Version
param(
    [Parameter(Position=0)]
    [string]$Command,

    [Parameter(Position=1)]
    [string]$Parameter1
)

# Configuration
$Services = @(
    @{Name="user-service"; Port=3001}
    @{Name="newsletter-service"; Port=3002}
    @{Name="content-service"; Port=3003}
    @{Name="crm-service"; Port=3004}
    @{Name="analytics-service"; Port=3005}
    @{Name="frontend"; Port=3000}
)

$Infrastructure = @(
    @{Name="postgres"; Port=5432}
    @{Name="redis"; Port=6379}
    @{Name="elasticsearch"; Port=9200}
    @{Name="rabbitmq"; Port=5672}
    @{Name="api-gateway"; Port=8000}
)

$MonitoringInterval = if ($env:MONITORING_INTERVAL) { [int]$env:MONITORING_INTERVAL } else { 30 }
$LogFile = "logs\health-monitor.log"

# Helper functions
function Write-Info {
    param([string]$Message)
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    Write-Host "[INFO] $Message" -ForegroundColor Blue
    Add-Content -Path $LogFile -Value "$timestamp [INFO] $Message"
}

function Write-Success {
    param([string]$Message)
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    Write-Host "[SUCCESS] $Message" -ForegroundColor Green
    Add-Content -Path $LogFile -Value "$timestamp [SUCCESS] $Message"
}

function Write-Warning {
    param([string]$Message)
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    Write-Host "[WARNING] $Message" -ForegroundColor Yellow
    Add-Content -Path $LogFile -Value "$timestamp [WARNING] $Message"
}

function Write-Error {
    param([string]$Message)
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    Write-Host "[ERROR] $Message" -ForegroundColor Red
    Add-Content -Path $LogFile -Value "$timestamp [ERROR] $Message"
}

# Create logs directory
if (-not (Test-Path "logs")) {
    New-Item -ItemType Directory -Path "logs" -Force | Out-Null
}

# Check if service is healthy
function Test-ServiceHealth {
    param(
        [string]$ServiceName,
        [int]$Port
    )

    $healthUrl = "http://localhost:$Port/health"

    try {
        $response = Invoke-WebRequest -Uri $healthUrl -TimeoutSec 5 -UseBasicParsing -ErrorAction Stop
        if ($response.StatusCode -eq 200) {
            Write-Success "$ServiceName is healthy"
            return $true
        } else {
            Write-Error "$ServiceName returned status code $($response.StatusCode)"
            return $false
        }
    } catch {
        Write-Error "$ServiceName is unhealthy or unreachable: $($_.Exception.Message)"
        return $false
    }
}

# Check if infrastructure service is running
function Test-InfrastructureHealth {
    param(
        [string]$ServiceName,
        [int]$Port
    )

    try {
        $tcpClient = New-Object System.Net.Sockets.TcpClient
        $tcpClient.ConnectAsync("localhost", $Port).Wait(5000)

        if ($tcpClient.Connected) {
            Write-Success "$ServiceName is running"
            $tcpClient.Close()
            return $true
        } else {
            Write-Error "$ServiceName is not running or unreachable"
            return $false
        }
    } catch {
        Write-Error "$ServiceName is not running or unreachable: $($_.Exception.Message)"
        return $false
    }
}

# Check Docker container status
function Test-ContainerStatus {
    param([string]$ContainerName)

    try {
        $containerInfo = docker ps --format "table {{.Names}}\t{{.Status}}" | Select-String $ContainerName

        if ($containerInfo) {
            $status = docker inspect --format='{{.State.Status}}' $ContainerName 2>$null
            if ($status -eq "running") {
                Write-Success "Container $ContainerName is running"
                return $true
            } else {
                Write-Error "Container $ContainerName is not running (status: $status)"
                return $false
            }
        } else {
            Write-Error "Container $ContainerName not found"
            return $false
        }
    } catch {
        Write-Error "Error checking container $ContainerName : $($_.Exception.Message)"
        return $false
    }
}

# Get service metrics
function Get-ServiceMetrics {
    param(
        [string]$ServiceName,
        [int]$Port
    )

    $metricsUrl = "http://localhost:$Port/metrics"

    try {
        $response = Invoke-WebRequest -Uri $metricsUrl -TimeoutSec 5 -UseBasicParsing -ErrorAction Stop
        if ($response.StatusCode -eq 200) {
            Write-Info "$ServiceName metrics are available"
        }
    } catch {
        Write-Warning "$ServiceName metrics are not available"
    }
}

# Check system resources
function Test-SystemResources {
    Write-Info "Checking system resources..."

    # CPU usage
    $cpu = Get-WmiObject -Class Win32_Processor | Measure-Object -Property LoadPercentage -Average
    Write-Info "CPU Usage: $([math]::Round($cpu.Average, 1))%"

    # Memory usage
    $memory = Get-WmiObject -Class Win32_OperatingSystem
    $memoryUsage = [math]::Round((($memory.TotalVisibleMemorySize - $memory.FreePhysicalMemory) / $memory.TotalVisibleMemorySize) * 100, 1)
    Write-Info "Memory Usage: $memoryUsage%"

    # Disk usage
    $disk = Get-WmiObject -Class Win32_LogicalDisk -Filter "DeviceID='C:'"
    $diskUsage = [math]::Round((($disk.Size - $disk.FreeSpace) / $disk.Size) * 100, 1)
    Write-Info "Disk Usage: $diskUsage%"

    # Docker stats
    if (Get-Command docker -ErrorAction SilentlyContinue) {
        Write-Info "Docker container stats:"
        docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}" | Select-Object -First 10
    }
}

# Send alert (placeholder for integration with alerting systems)
function Send-Alert {
    param(
        [string]$Message,
        [string]$Severity = "warning"
    )

    Write-Warning "ALERT [$Severity]: $Message"

    # Add integrations here:
    # - Slack webhook
    # - Email notification
    # - Teams webhook

    # Example Teams webhook (uncomment and configure)
    # if ($env:TEAMS_WEBHOOK_URL) {
    #     $body = @{
    #         text = "AiLert Alert [$Severity]: $Message"
    #     } | ConvertTo-Json
    #
    #     Invoke-RestMethod -Uri $env:TEAMS_WEBHOOK_URL -Method Post -Body $body -ContentType "application/json"
    # }
}

# Comprehensive health check
function Invoke-HealthCheck {
    Write-Info "Starting comprehensive health check..."

    $failedServices = @()
    $failedInfrastructure = @()

    # Check application services
    Write-Info "Checking application services..."
    foreach ($service in $Services) {
        if (-not (Test-ServiceHealth -ServiceName $service.Name -Port $service.Port)) {
            $failedServices += "$($service.Name):$($service.Port)"
        }
        Get-ServiceMetrics -ServiceName $service.Name -Port $service.Port
    }

    # Check infrastructure services
    Write-Info "Checking infrastructure services..."
    foreach ($service in $Infrastructure) {
        if (-not (Test-InfrastructureHealth -ServiceName $service.Name -Port $service.Port)) {
            $failedInfrastructure += "$($service.Name):$($service.Port)"
        }
    }

    # Check Docker containers
    Write-Info "Checking Docker containers..."
    $containers = @(
        "ailert-user-service",
        "ailert-newsletter-service",
        "ailert-content-service",
        "ailert-crm-service",
        "ailert-analytics-service",
        "ailert-frontend",
        "ailert-postgres",
        "ailert-redis",
        "ailert-elasticsearch",
        "ailert-rabbitmq",
        "ailert-api-gateway"
    )

    foreach ($container in $containers) {
        Test-ContainerStatus -ContainerName $container | Out-Null
    }

    # Check system resources
    Test-SystemResources

    # Report results
    if ($failedServices.Count -eq 0 -and $failedInfrastructure.Count -eq 0) {
        Write-Success "All services are healthy"
    } else {
        if ($failedServices.Count -gt 0) {
            $failedList = $failedServices -join ', '
            Send-Alert -Message "Failed application services: $failedList" -Severity "critical"
        }

        if ($failedInfrastructure.Count -gt 0) {
            $failedList = $failedInfrastructure -join ', '
            Send-Alert -Message "Failed infrastructure services: $failedList" -Severity "critical"
        }
    }

    Write-Info "Health check completed"
}

# Continuous monitoring
function Start-ContinuousMonitoring {
    Write-Info "Starting continuous monitoring (interval: ${MonitoringInterval}s)"
    Write-Info "Press Ctrl+C to stop monitoring"

    try {
        while ($true) {
            Invoke-HealthCheck
            Write-Host ""
            Start-Sleep -Seconds $MonitoringInterval
        }
    } catch [System.Management.Automation.PipelineStoppedException] {
        Write-Info "Monitoring stopped by user"
    }
}

# Service recovery attempt
function Invoke-ServiceRecovery {
    param([string]$ServiceName)

    Write-Info "Attempting to recover service: $ServiceName"

    # Try to restart the service
    try {
        docker-compose restart $ServiceName
        Write-Success "Service $ServiceName restarted successfully"

        # Wait a bit and check if it's healthy
        Start-Sleep -Seconds 10

        $servicePort = switch ($ServiceName) {
            "user-service" { 3001 }
            "newsletter-service" { 3002 }
            "content-service" { 3003 }
            "crm-service" { 3004 }
            "analytics-service" { 3005 }
            "frontend" { 3000 }
            default { 3000 }
        }

        if (Test-ServiceHealth -ServiceName $ServiceName -Port $servicePort) {
            Write-Success "Service $ServiceName is now healthy after restart"
            return $true
        } else {
            Write-Error "Service $ServiceName is still unhealthy after restart"
            return $false
        }
    } catch {
        Write-Error "Failed to restart service $ServiceName : $($_.Exception.Message)"
        return $false
    }
}

# Generate health report
function New-HealthReport {
    $reportFile = "reports\health-report-$(Get-Date -Format 'yyyyMMdd_HHmmss').html"

    if (-not (Test-Path "reports")) {
        New-Item -ItemType Directory -Path "reports" -Force | Out-Null
    }

    Write-Info "Generating health report: $reportFile"

    $htmlContent = @"
<!DOCTYPE html>
<html>
<head>
    <title>AiLert Health Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { background: #f0f0f0; padding: 20px; border-radius: 5px; }
        .service { margin: 10px 0; padding: 10px; border-left: 4px solid #ccc; }
        .healthy { border-left-color: #4CAF50; }
        .unhealthy { border-left-color: #f44336; }
        .warning { border-left-color: #ff9800; }
        .timestamp { color: #666; font-size: 0.9em; }
    </style>
</head>
<body>
    <div class="header">
        <h1>AiLert Health Report</h1>
        <p class="timestamp">Generated: $(Get-Date)</p>
    </div>

    <h2>Application Services</h2>
"@

    # Add service status to report
    foreach ($service in $Services) {
        if (Test-ServiceHealth -ServiceName $service.Name -Port $service.Port) {
            $htmlContent += "    <div class=`"service healthy`">✅ $($service.Name) - Healthy</div>`n"
        } else {
            $htmlContent += "    <div class=`"service unhealthy`">❌ $($service.Name) - Unhealthy</div>`n"
        }
    }

    $htmlContent += @"

    <h2>Infrastructure Services</h2>
"@

    # Add infrastructure status to report
    foreach ($service in $Infrastructure) {
        if (Test-InfrastructureHealth -ServiceName $service.Name -Port $service.Port) {
            $htmlContent += "    <div class=`"service healthy`">✅ $($service.Name) - Running</div>`n"
        } else {
            $htmlContent += "    <div class=`"service unhealthy`">❌ $($service.Name) - Not Running</div>`n"
        }
    }

    # Get system resources
    $cpu = Get-WmiObject -Class Win32_Processor | Measure-Object -Property LoadPercentage -Average
    $memory = Get-WmiObject -Class Win32_OperatingSystem
    $memoryUsage = [math]::Round((($memory.TotalVisibleMemorySize - $memory.FreePhysicalMemory) / $memory.TotalVisibleMemorySize) * 100, 1)
    $disk = Get-WmiObject -Class Win32_LogicalDisk -Filter "DeviceID='C:'"
    $diskUsage = [math]::Round((($disk.Size - $disk.FreeSpace) / $disk.Size) * 100, 1)

    $htmlContent += @"

    <h2>System Resources</h2>
    <div class="service">
        <p>CPU Usage: $([math]::Round($cpu.Average, 1))%</p>
        <p>Memory Usage: $memoryUsage%</p>
        <p>Disk Usage: $diskUsage%</p>
    </div>

</body>
</html>
"@

    Set-Content -Path $reportFile -Value $htmlContent -Encoding UTF8

    Write-Success "Health report generated: $reportFile"
}

# Main command handler
switch ($Command.ToLower()) {
    "check" {
        Invoke-HealthCheck
    }
    "monitor" {
        Start-ContinuousMonitoring
    }
    "recover" {
        Invoke-ServiceRecovery -ServiceName $Parameter1
    }
    "report" {
        New-HealthReport
    }
    default {
        Write-Host "AiLert Health Monitoring - PowerShell Version"
        Write-Host ""
        Write-Host "Usage: .\health-monitor.ps1 <command> [options]"
        Write-Host ""
        Write-Host "Commands:"
        Write-Host "  check                    Run single health check"
        Write-Host "  monitor                  Start continuous monitoring"
        Write-Host "  recover <service>        Attempt to recover a service"
        Write-Host "  report                   Generate HTML health report"
        Write-Host ""
        Write-Host "Environment Variables:"
        Write-Host "  MONITORING_INTERVAL      Monitoring interval in seconds (default: 30)"
        Write-Host "  TEAMS_WEBHOOK_URL        Teams webhook for alerts"
        Write-Host ""
        Write-Host "Examples:"
        Write-Host "  .\health-monitor.ps1 check"
        Write-Host "  .\health-monitor.ps1 monitor"
        Write-Host "  .\health-monitor.ps1 recover user-service"
        Write-Host "  `$env:MONITORING_INTERVAL=60; .\health-monitor.ps1 monitor"
    }
}
