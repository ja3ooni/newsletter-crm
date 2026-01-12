# DatatechtonCRM Development Debugging Utilities for Windows
param(
    [Parameter(Mandatory=$false)]
    [ValidateSet("enable-debug", "attach", "logs", "monitor", "test-endpoints", "profile-memory", "heap-dump", "stress-test", "debug-session")]
    [string]$Action,

    [string]$Service,
    [int]$Port = 9229,
    [string]$Filter,
    [int]$Lines = 100,
    [int]$Interval = 5,
    [int]$Duration = 60,
    [int]$Concurrent = 10
)

# Set error action preference
$ErrorActionPreference = "Stop"

# Colors for output
function Write-Info {
    param([string]$Message)
    Write-Host "[INFO] $Message" -ForegroundColor Blue
}

function Write-Success {
    param([string]$Message)
    Write-Host "[SUCCESS] $Message" -ForegroundColor Green
}

function Write-Warning {
    param([string]$Message)
    Write-Host "[WARNING] $Message" -ForegroundColor Yellow
}

function Write-Error {
    param([string]$Message)
    Write-Host "[ERROR] $Message" -ForegroundColor Red
}

# Enable debug mode for specific service
function Enable-Debug {
    param(
        [string]$ServiceName,
        [int]$DebugPort = 9229
    )

    if (-not $ServiceName) {
        Write-Error "Service name is required"
        Write-Host "Usage: .\dev-debug.ps1 -Action enable-debug -Service <service-name> [-Port <debug-port>]"
        Write-Host "Available services: user-service, newsletter-service, content-service, crm-service, analytics-service"
        return
    }

    Write-Info "Enabling debug mode for $ServiceName on port $DebugPort..."

    # Stop the service
    docker-compose stop $ServiceName

    # Start with debug mode
    docker-compose run --rm -p "${DebugPort}:${DebugPort}" $ServiceName node --inspect=0.0.0.0:$DebugPort --inspect-brk dist/index.js

    Write-Success "Debug mode enabled for $ServiceName. Connect your debugger to localhost:$DebugPort"
}

# Attach debugger to running service
function Attach-Debugger {
    param(
        [string]$ServiceName,
        [int]$DebugPort = 9229
    )

    if (-not $ServiceName) {
        Write-Error "Service name is required"
        Write-Host "Usage: .\dev-debug.ps1 -Action attach -Service <service-name> [-Port <debug-port>]"
        return
    }

    Write-Info "Attaching debugger to $ServiceName..."

    # Check if service is running
    $runningServices = docker-compose ps --services --filter "status=running"
    if ($runningServices -notcontains $ServiceName) {
        Write-Error "$ServiceName is not running"
        return
    }

    # Get container ID
    $containerId = docker-compose ps -q $ServiceName

    # Enable debug mode in running container
    docker exec $containerId kill -USR1 1

    Write-Success "Debugger attached to $ServiceName. Connect to localhost:$DebugPort"
}

# Show service logs with filtering
function Show-Logs {
    param(
        [string]$ServiceName,
        [string]$FilterText,
        [int]$LineCount = 100
    )

    if (-not $ServiceName) {
        Write-Info "Available services:"
        docker-compose config --services
        Write-Host ""
        $ServiceName = Read-Host "Enter service name"
    }

    Write-Info "Showing logs for $ServiceName (last $LineCount lines)..."

    if ($FilterText) {
        docker-compose logs --tail=$LineCount $ServiceName | Select-String -Pattern $FilterText
    } else {
        docker-compose logs --tail=$LineCount -f $ServiceName
    }
}

# Monitor service performance
function Monitor-Performance {
    param(
        [string]$ServiceName,
        [int]$IntervalSeconds = 5
    )

    if (-not $ServiceName) {
        Write-Error "Service name is required"
        Write-Host "Usage: .\dev-debug.ps1 -Action monitor -Service <service-name> [-Interval <interval-seconds>]"
        return
    }

    Write-Info "Monitoring performance for $ServiceName (interval: ${IntervalSeconds}s)..."

    while ($true) {
        Clear-Host
        Write-Host "=== Performance Monitor for $ServiceName ===" -ForegroundColor Cyan
        Get-Date
        Write-Host ""

        # Get container stats
        docker stats --no-stream --format "table {{.Name}}`t{{.CPUPerc}}`t{{.MemUsage}}`t{{.NetIO}}`t{{.BlockIO}}" | Where-Object { $_ -match $ServiceName }

        # Get service-specific metrics if available
        switch ($ServiceName) {
            "user-service" {
                try {
                    $metrics = Invoke-RestMethod -Uri "http://localhost:3001/metrics" -TimeoutSec 5
                    Write-Host "Metrics available" -ForegroundColor Green
                } catch {
                    Write-Host "Metrics not available" -ForegroundColor Yellow
                }
            }
            "newsletter-service" {
                try {
                    $metrics = Invoke-RestMethod -Uri "http://localhost:3002/metrics" -TimeoutSec 5
                    Write-Host "Metrics available" -ForegroundColor Green
                } catch {
                    Write-Host "Metrics not available" -ForegroundColor Yellow
                }
            }
            default {
                Write-Host "Service-specific metrics not configured"
            }
        }

        Start-Sleep -Seconds $IntervalSeconds
    }
}

# Test service endpoints
function Test-Endpoints {
    param([string]$ServiceName)

    $services = @()

    if (-not $ServiceName) {
        Write-Info "Testing all service endpoints..."
        $services = @(
            @{Name="user-service"; Port=3001},
            @{Name="newsletter-service"; Port=3002},
            @{Name="content-service"; Port=3003},
            @{Name="crm-service"; Port=3004},
            @{Name="analytics-service"; Port=3005}
        )
    } else {
        switch ($ServiceName) {
            "user-service" { $services = @(@{Name="user-service"; Port=3001}) }
            "newsletter-service" { $services = @(@{Name="newsletter-service"; Port=3002}) }
            "content-service" { $services = @(@{Name="content-service"; Port=3003}) }
            "crm-service" { $services = @(@{Name="crm-service"; Port=3004}) }
            "analytics-service" { $services = @(@{Name="analytics-service"; Port=3005}) }
            default {
                Write-Error "Unknown service: $ServiceName"
                return
            }
        }
    }

    foreach ($svc in $services) {
        Write-Host "`nTesting $($svc.Name) endpoints:" -ForegroundColor Cyan

        # Health check
        try {
            $response = Invoke-RestMethod -Uri "http://localhost:$($svc.Port)/health" -TimeoutSec 5
            Write-Host "  ✓ Health check: OK" -ForegroundColor Green
        } catch {
            Write-Host "  ✗ Health check: FAILED" -ForegroundColor Red
        }

        # Ready check
        try {
            $response = Invoke-RestMethod -Uri "http://localhost:$($svc.Port)/ready" -TimeoutSec 5
            Write-Host "  ✓ Ready check: OK" -ForegroundColor Green
        } catch {
            Write-Host "  ✗ Ready check: FAILED" -ForegroundColor Red
        }

        # Metrics endpoint
        try {
            $response = Invoke-RestMethod -Uri "http://localhost:$($svc.Port)/metrics" -TimeoutSec 5
            Write-Host "  ✓ Metrics: Available" -ForegroundColor Green
        } catch {
            Write-Host "  ! Metrics: Not available" -ForegroundColor Yellow
        }

        # API documentation
        try {
            $response = Invoke-RestMethod -Uri "http://localhost:$($svc.Port)/docs" -TimeoutSec 5
            Write-Host "  ✓ API Docs: Available" -ForegroundColor Green
        } catch {
            Write-Host "  ! API Docs: Not available" -ForegroundColor Yellow
        }
    }
}

# Profile service memory usage
function Profile-Memory {
    param(
        [string]$ServiceName,
        [int]$DurationSeconds = 60
    )

    if (-not $ServiceName) {
        Write-Error "Service name is required"
        Write-Host "Usage: .\dev-debug.ps1 -Action profile-memory -Service <service-name> [-Duration <duration-seconds>]"
        return
    }

    Write-Info "Profiling memory usage for $ServiceName for ${DurationSeconds} seconds..."

    # Create output directory
    $profileDir = "profiles\$(Get-Date -Format 'yyyyMMdd')"
    if (-not (Test-Path $profileDir)) {
        New-Item -ItemType Directory -Path $profileDir -Force | Out-Null
    }

    $outputFile = "$profileDir\$ServiceName-memory-$(Get-Date -Format 'HHmmss').log"

    # Monitor memory usage
    for ($i = 1; $i -le $DurationSeconds; $i++) {
        $timestamp = Get-Date -Format "HH:mm:ss"
        $memUsage = docker stats --no-stream --format "{{.MemUsage}}" | Select-String $ServiceName
        "$timestamp $memUsage" | Out-File -FilePath $outputFile -Append
        Start-Sleep -Seconds 1
    }

    Write-Success "Memory profile saved to $outputFile"
}

# Generate heap dump
function New-HeapDump {
    param([string]$ServiceName)

    if (-not $ServiceName) {
        Write-Error "Service name is required"
        Write-Host "Usage: .\dev-debug.ps1 -Action heap-dump -Service <service-name>"
        return
    }

    Write-Info "Generating heap dump for $ServiceName..."

    # Get container ID
    $containerId = docker-compose ps -q $ServiceName

    if (-not $containerId) {
        Write-Error "$ServiceName is not running"
        return
    }

    # Create dumps directory
    $dumpDir = "dumps\$(Get-Date -Format 'yyyyMMdd')"
    if (-not (Test-Path $dumpDir)) {
        New-Item -ItemType Directory -Path $dumpDir -Force | Out-Null
    }

    $dumpFile = "$dumpDir\$ServiceName-heap-$(Get-Date -Format 'HHmmss').heapsnapshot"

    # Generate heap dump
    $nodeScript = @"
const v8 = require('v8');
const fs = require('fs');
const heapSnapshot = v8.getHeapSnapshot();
const fileName = '/tmp/heap.heapsnapshot';
const fileStream = fs.createWriteStream(fileName);
heapSnapshot.pipe(fileStream);
console.log('Heap dump generated at', fileName);
"@

    docker exec $containerId node -e $nodeScript

    # Copy dump from container
    docker cp "${containerId}:/tmp/heap.heapsnapshot" $dumpFile

    Write-Success "Heap dump saved to $dumpFile"
    Write-Info "You can analyze this dump in Chrome DevTools > Memory tab"
}

# Stress test specific service
function Start-StressTest {
    param(
        [string]$ServiceName,
        [int]$ConcurrentRequests = 10,
        [int]$DurationSeconds = 30
    )

    if (-not $ServiceName) {
        Write-Error "Service name is required"
        Write-Host "Usage: .\dev-debug.ps1 -Action stress-test -Service <service-name> [-Concurrent <concurrent-requests>] [-Duration <duration-seconds>]"
        return
    }

    # Get service port
    $port = switch ($ServiceName) {
        "user-service" { 3001 }
        "newsletter-service" { 3002 }
        "content-service" { 3003 }
        "crm-service" { 3004 }
        "analytics-service" { 3005 }
        default {
            Write-Error "Unknown service: $ServiceName"
            return
        }
    }

    Write-Info "Running stress test on $ServiceName (port $port) with $ConcurrentRequests concurrent requests for ${DurationSeconds}s..."

    # Check if service is healthy first
    try {
        Invoke-RestMethod -Uri "http://localhost:$port/health" -TimeoutSec 5 | Out-Null
    } catch {
        Write-Error "$ServiceName is not healthy. Cannot run stress test."
        return
    }

    # Simple PowerShell-based stress test
    $jobs = @()

    for ($i = 1; $i -le $ConcurrentRequests; $i++) {
        $job = Start-Job -ScriptBlock {
            param($Port, $Duration)
            for ($j = 1; $j -le $Duration; $j++) {
                try {
                    Invoke-RestMethod -Uri "http://localhost:$Port/health" -TimeoutSec 5 | Out-Null
                } catch {
                    # Ignore errors during stress test
                }
                Start-Sleep -Seconds 1
            }
        } -ArgumentList $port, $DurationSeconds

        $jobs += $job
    }

    # Wait for all jobs to complete
    $jobs | Wait-Job | Out-Null
    $jobs | Remove-Job

    Write-Success "Stress test completed"
}

# Interactive debugging session
function Start-DebugSession {
    param([string]$ServiceName)

    if (-not $ServiceName) {
        Write-Info "Available services for debugging:"
        docker-compose config --services | Where-Object { $_ -match "(user|newsletter|content|crm|analytics)-service" }
        Write-Host ""
        $ServiceName = Read-Host "Enter service name"
    }

    Write-Info "Starting interactive debugging session for $ServiceName..."

    # Get container ID
    $containerId = docker-compose ps -q $ServiceName

    if (-not $containerId) {
        Write-Error "$ServiceName is not running"
        return
    }

    # Start interactive shell in container
    docker exec -it $containerId /bin/sh
}

# Main script logic
if (-not $Action) {
    Write-Host "DatatechtonCRM Development Debugging Utilities for Windows" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Usage: .\dev-debug.ps1 -Action <command> [options]" -ForegroundColor White
    Write-Host ""
    Write-Host "Commands:" -ForegroundColor Yellow
    Write-Host "  enable-debug     Enable debug mode for service" -ForegroundColor White
    Write-Host "  attach           Attach debugger to running service" -ForegroundColor White
    Write-Host "  logs             Show filtered logs for service" -ForegroundColor White
    Write-Host "  monitor          Monitor service performance" -ForegroundColor White
    Write-Host "  test-endpoints   Test service API endpoints" -ForegroundColor White
    Write-Host "  profile-memory   Profile memory usage" -ForegroundColor White
    Write-Host "  heap-dump        Generate heap dump" -ForegroundColor White
    Write-Host "  stress-test      Run stress test" -ForegroundColor White
    Write-Host "  debug-session    Start interactive debugging session" -ForegroundColor White
    Write-Host ""
    Write-Host "Examples:" -ForegroundColor Yellow
    Write-Host "  .\dev-debug.ps1 -Action enable-debug -Service user-service -Port 9229" -ForegroundColor Gray
    Write-Host "  .\dev-debug.ps1 -Action logs -Service newsletter-service -Filter error -Lines 50" -ForegroundColor Gray
    Write-Host "  .\dev-debug.ps1 -Action monitor -Service crm-service -Interval 10" -ForegroundColor Gray
    Write-Host "  .\dev-debug.ps1 -Action stress-test -Service user-service -Concurrent 20 -Duration 60" -ForegroundColor Gray
    exit
}

switch ($Action) {
    "enable-debug" { Enable-Debug -ServiceName $Service -DebugPort $Port }
    "attach" { Attach-Debugger -ServiceName $Service -DebugPort $Port }
    "logs" { Show-Logs -ServiceName $Service -FilterText $Filter -LineCount $Lines }
    "monitor" { Monitor-Performance -ServiceName $Service -IntervalSeconds $Interval }
    "test-endpoints" { Test-Endpoints -ServiceName $Service }
    "profile-memory" { Profile-Memory -ServiceName $Service -DurationSeconds $Duration }
    "heap-dump" { New-HeapDump -ServiceName $Service }
    "stress-test" { Start-StressTest -ServiceName $Service -ConcurrentRequests $Concurrent -DurationSeconds $Duration }
    "debug-session" { Start-DebugSession -ServiceName $Service }
}
