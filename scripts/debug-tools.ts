#!/usr/bin/env node

/**
 * Debug Tools for Development
 * Provides debugging utilities, performance monitoring, and troubleshooting tools
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { log } from './shared/Logger';
import { PlatformService } from './shared/PlatformService';

interface DiagnosticsResult {
  timestamp: string;
  system: SystemInfo;
  node: NodeInfo;
  dependencies: Record<string, DependencyInfo>;
  services: Record<string, boolean>;
  ports: PortInfo[];
  diskSpace: DiskSpaceInfo;
}

interface SystemInfo {
  platform: string;
  arch: string;
  release: string;
  hostname: string;
  uptime: number;
  loadavg: number[];
  totalmem: number;
  freemem: number;
  cpus: number;
}

interface NodeInfo {
  version: string;
  platform: string;
  arch: string;
  pid: number;
  uptime: number;
  memoryUsage: NodeJS.MemoryUsage;
  env: Record<string, string>;
}

interface DependencyInfo {
  available: boolean;
  version?: string;
  error?: string;
}

interface PortInfo {
  port: number;
  process: string | null;
  inUse: boolean;
}

interface DiskSpaceInfo {
  available: string;
  used: string;
  total: string;
}

interface PerformanceSample {
  timestamp: number;
  memory: NodeJS.MemoryUsage;
  cpu: NodeJS.CpuUsage;
  uptime: number;
}

interface LogAnalysis {
  totalLines: number;
  errorCount: number;
  warningCount: number;
  infoCount: number;
  recentErrors: LogError[];
  commonErrors: Record<string, number>;
  timeRange: { start: Date | null; end: Date | null };
}

interface LogError {
  timestamp: Date | null;
  message: string;
  file: string;
}

class DebugTools {
  private options: {
    verbose: boolean;
    output: string;
  };

  private platformService: PlatformService;

  constructor(options: { verbose?: boolean; output?: string } = {}) {
    this.options = {
      verbose: options.verbose || false,
      output: options.output || 'console',
    };

    this.platformService = new PlatformService();
  }

  // System diagnostics
  async systemDiagnostics(): Promise<DiagnosticsResult> {
    log.info('Running system diagnostics...');

    // Create progress tracker
    const progress = performanceOptimizer.createProgressTracker(
      'system-diagnostics',
      6,
      'Collecting system information...'
    );

    try {
      const diagnostics: DiagnosticsResult = {
        timestamp: new Date().toISOString(),
        system: {
          platform: os.platform(),
          arch: os.arch(),
          release: os.release(),
          hostname: os.hostname(),
          uptime: os.uptime(),
          loadavg: os.loadavg(),
          totalmem: os.totalmem(),
          freemem: os.freemem(),
          cpus: os.cpus().length,
        },
        node: {
          version: process.version,
          platform: process.platform,
          arch: process.arch,
          pid: process.pid,
          uptime: process.uptime(),
          memoryUsage: process.memoryUsage(),
          env: {
            NODE_ENV: process.env.NODE_ENV || 'Not set',
            PORT: process.env.PORT || 'Not set',
            DATABASE_URL: process.env.DATABASE_URL ? '[REDACTED]' : 'Not set',
            REDIS_URL: process.env.REDIS_URL ? '[REDACTED]' : 'Not set',
          },
        },
        dependencies: {},
        services: {},
        ports: [],
        diskSpace: { available: 'Unknown', used: 'Unknown', total: 'Unknown' },
      };

      progress.increment(1, 'Basic system info collected');

      // Execute diagnostic operations in parallel with timeout protection
      const diagnosticOperations = [
        {
          name: 'dependencies',
          operation: () => this.checkDependencies(),
          timeout: 15000,
        },
        {
          name: 'services',
          operation: () => this.checkServices(),
          timeout: 10000,
        },
        {
          name: 'ports',
          operation: () => this.checkPorts(),
          timeout: 20000,
        },
        {
          name: 'diskSpace',
          operation: () => this.checkDiskSpace(),
          timeout: 5000,
        },
      ];

      const results = await performanceOptimizer.executeInParallel(
        diagnosticOperations,
        async (operation, index) => {
          try {
            const result = await performanceOptimizer.withTimeout(
              operation.operation,
              {
                timeout: operation.timeout,
                message: `${operation.name} check timed out`,
              }
            );

            progress.increment(1, `${operation.name} check completed`);

            return { name: operation.name, result, error: null };
          } catch (error) {
            log.warn(`${operation.name} check failed:`, { error });
            progress.increment(1, `${operation.name} check failed`);

            return { name: operation.name, result: null, error };
          }
        },
        {
          maxConcurrency: 4,
          failFast: false,
          progressCallback: (completed, total) => {
            // Progress is handled individually above
          },
        }
      );

      // Merge results back into diagnostics
      results.forEach(result => {
        if (result && result.result !== null) {
          switch (result.name) {
            case 'dependencies':
              diagnostics.dependencies = result.result;
              break;
            case 'services':
              diagnostics.services = result.result;
              break;
            case 'ports':
              diagnostics.ports = result.result;
              break;
            case 'diskSpace':
              diagnostics.diskSpace = result.result;
              break;
          }
        }
      });

      progress.complete('System diagnostics completed');

      if (this.options.output === 'json') {
        process.stdout.write(JSON.stringify(diagnostics, null, 2));
      } else {
        this.displayDiagnostics(diagnostics);
      }

      return diagnostics;
    } catch (error) {
      progress.fail('System diagnostics failed');
      throw error;
    } finally {
      performanceOptimizer.removeProgressTracker('system-diagnostics');
    }
  }

  private displayDiagnostics(diagnostics: DiagnosticsResult): void {
    const separator = '='.repeat(60);

    log.info(`\n${separator}`);
    log.info('SYSTEM DIAGNOSTICS');
    log.info(separator);

    // System info
    log.info(`\nSystem Information:`);
    log.info(
      `Platform: ${diagnostics.system.platform} ${diagnostics.system.arch}`
    );
    log.info(`Release: ${diagnostics.system.release}`);
    log.info(`Hostname: ${diagnostics.system.hostname}`);
    log.info(
      `Uptime: ${Math.floor(diagnostics.system.uptime / 3600)}h ${Math.floor((diagnostics.system.uptime % 3600) / 60)}m`
    );
    log.info(`CPUs: ${diagnostics.system.cpus}`);
    log.info(
      `Memory: ${Math.round(diagnostics.system.freemem / 1024 / 1024)}MB free / ${Math.round(diagnostics.system.totalmem / 1024 / 1024)}MB total`
    );

    // Node.js info
    log.info(`\nNode.js Information:`);
    log.info(`Version: ${diagnostics.node.version}`);
    log.info(`PID: ${diagnostics.node.pid}`);
    log.info(`Uptime: ${Math.floor(diagnostics.node.uptime)}s`);
    log.info(`Memory Usage:`);
    Object.entries(diagnostics.node.memoryUsage).forEach(([key, value]) => {
      log.info(`  ${key}: ${Math.round(value / 1024 / 1024)}MB`);
    });

    // Environment
    log.info(`\nEnvironment:`);
    Object.entries(diagnostics.node.env).forEach(([key, value]) => {
      log.info(`${key}: ${value}`);
    });

    // Dependencies
    log.info(`\nDependencies:`);
    Object.entries(diagnostics.dependencies).forEach(([dep, info]) => {
      const status = info.available ? '✅' : '❌';

      log.info(`${status} ${dep}: ${info.version || 'Not found'}`);
    });

    // Services
    log.info(`\nServices:`);
    Object.entries(diagnostics.services).forEach(([service, status]) => {
      const icon = status ? '✅' : '❌';

      log.info(`${icon} ${service}: ${status ? 'Running' : 'Not running'}`);
    });

    // Ports
    log.info(`\nPort Usage:`);
    diagnostics.ports.forEach(port => {
      log.info(`Port ${port.port}: ${port.process || 'Available'}`);
    });

    // Disk space
    log.info(`\nDisk Space:`);
    log.info(`Available: ${diagnostics.diskSpace.available}`);
    log.info(`Used: ${diagnostics.diskSpace.used}`);
    log.info(`Total: ${diagnostics.diskSpace.total}`);

    log.info(`\n${separator}`);
  }

  private async checkDependencies(): Promise<Record<string, DependencyInfo>> {
    // Use caching for dependency checks (5 minute TTL)
    return performanceOptimizer.cached(
      'system-dependencies',
      async () => {
        const dependencyNames = [
          'npm',
          'docker',
          'docker-compose',
          'git',
          'psql',
          'redis-cli',
        ];
        const dependencies: Record<string, DependencyInfo> = {
          node: { available: true, version: process.version },
        };

        // Check dependencies in parallel
        const results = await performanceOptimizer.executeInParallel(
          dependencyNames,
          async name => {
            try {
              const executableInfo = await performanceOptimizer.withTimeout(
                () => this.platformService.findExecutable(name),
                {
                  timeout: 3000,
                  message: `Dependency check for ${name} timed out`,
                }
              );

              if (executableInfo && executableInfo.available) {
                return {
                  name,
                  info: {
                    available: true,
                    version: executableInfo.version || 'Unknown version',
                  },
                };
              } else {
                return {
                  name,
                  info: {
                    available: false,
                    error: `${name} not found in PATH`,
                  },
                };
              }
            } catch (error) {
              return {
                name,
                info: {
                  available: false,
                  error: `${name} check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
                },
              };
            }
          },
          { maxConcurrency: 3, failFast: false }
        );

        // Merge results
        results.forEach(result => {
          if (result) {
            dependencies[result.name] = result.info;
          }
        });

        return dependencies;
      },
      300000 // 5 minutes cache
    );
  }

  private async checkServices(): Promise<Record<string, boolean>> {
    const services: Record<string, boolean> = {};

    // Check Docker services
    try {
      const output = execSync('docker-compose ps --format json', {
        encoding: 'utf8',
        stdio: 'pipe',
      });

      const containers = JSON.parse(`[${output.trim().split('\n').join(',')}]`);

      containers.forEach((container: { Service: string; State: string }) => {
        services[container.Service] = container.State === 'running';
      });
    } catch (error) {
      log.debug('Docker Compose not available or no services running');
    }

    // Check Node.js processes
    try {
      const command = this.platformService.getProcessListCommand();
      const result = await this.platformService.executeCommand(command);

      if (result.success) {
        services['node-services'] = result.output.includes('node');
      } else {
        services['node-services'] = false;
      }
    } catch (error) {
      services['node-services'] = false;
    }

    return services;
  }

  private async checkPorts(): Promise<PortInfo[]> {
    // Use shorter cache for port checks (1 minute TTL) as port usage changes frequently
    return performanceOptimizer.cached(
      'port-usage-check',
      async () => {
        const commonPorts = [
          3000, 3001, 8000, 8001, 8002, 8003, 8004, 5432, 6379, 9200, 5672,
          1025, 8025, 9090, 16686,
        ];

        // Check ports in parallel with higher concurrency since they're quick
        const results = await performanceOptimizer.executeInParallel(
          commonPorts,
          async port => {
            try {
              const portUsage = await performanceOptimizer.withTimeout(
                () => this.platformService.checkPortUsage(port),
                { timeout: 2000, message: `Port ${port} check timed out` }
              );

              if (portUsage) {
                return {
                  port,
                  process:
                    portUsage.process || `PID: ${portUsage.pid}` || 'Unknown',
                  inUse: true,
                };
              } else {
                return { port, process: null, inUse: false };
              }
            } catch (error) {
              log.debug(`Failed to check port ${port}`, { error });
              return { port, process: null, inUse: false };
            }
          },
          { maxConcurrency: 8, failFast: false }
        );

        return results.filter(result => result !== null) as PortInfo[];
      },
      60000 // 1 minute cache
    );
  }

  private async checkDiskSpace(): Promise<DiskSpaceInfo> {
    try {
      const command = this.platformService.getDiskSpaceCommand();
      const result = await this.platformService.executeCommand(command);

      if (!result.success) {
        return {
          available: 'Unknown',
          used: 'Unknown',
          total: 'Unknown',
        };
      }

      const platform = this.platformService.getOperatingSystem();

      if (platform === 'windows') {
        // Parse Windows dir output
        const lines = result.output.split('\n');
        const lastLine = lines[lines.length - 2];
        const match = lastLine?.match(/(\d+)\s+bytes\s+free/);

        if (match && match[1]) {
          const freeBytes = parseInt(match[1], 10);

          return {
            available: this.formatBytes(freeBytes),
            used: 'N/A',
            total: 'N/A',
          };
        }
      } else {
        // Parse Unix df output
        const lines = result.output.split('\n');
        const dataLine = lines[1];

        if (dataLine) {
          const parts = dataLine.trim().split(/\s+/);

          return {
            available: parts[3] || 'Unknown',
            used: parts[2] || 'Unknown',
            total: parts[1] || 'Unknown',
          };
        }
      }
    } catch (error) {
      log.error('Failed to check disk space', { error });
    }

    return {
      available: 'Unknown',
      used: 'Unknown',
      total: 'Unknown',
    };
  }

  private formatBytes(bytes: number): string {
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];

    if (bytes === 0) return '0 Bytes';

    const i = Math.floor(Math.log(bytes) / Math.log(1024));

    return `${Math.round((bytes / Math.pow(1024, i)) * 100) / 100} ${sizes[i]}`;
  }

  // Performance monitoring
  async performanceMonitor(duration = 30): Promise<void> {
    log.info(`Starting performance monitoring for ${duration} seconds...`);

    const samples: PerformanceSample[] = [];
    const progress = performanceOptimizer.createProgressTracker(
      'performance-monitor',
      duration,
      'Collecting performance samples...'
    );

    let sampleCount = 0;

    return new Promise<void>(resolve => {
      const interval = setInterval(() => {
        const sample: PerformanceSample = {
          timestamp: Date.now(),
          memory: process.memoryUsage(),
          cpu: process.cpuUsage(),
          uptime: process.uptime(),
        };

        samples.push(sample);
        sampleCount++;
        progress.update(sampleCount, `Collected ${sampleCount} samples`);

        if (this.options.verbose) {
          log.info(
            `Memory: ${Math.round(sample.memory.heapUsed / 1024 / 1024)}MB, CPU: ${sample.cpu.user + sample.cpu.system}μs`
          );
        }
      }, 1000);

      setTimeout(() => {
        clearInterval(interval);
        progress.complete('Performance monitoring completed');
        performanceOptimizer.removeProgressTracker('performance-monitor');

        // Analyze performance with measurement
        performanceOptimizer
          .measurePerformance(
            () => Promise.resolve(this.analyzePerformance(samples)),
            'performance-analysis'
          )
          .then(() => resolve());
      }, duration * 1000);
    });
  }

  private analyzePerformance(samples: PerformanceSample[]): void {
    if (samples.length === 0) return;

    const memoryUsage = samples.map(s => s.memory.heapUsed);
    const avgMemory =
      memoryUsage.reduce((a, b) => a + b, 0) / memoryUsage.length;
    const maxMemory = Math.max(...memoryUsage);
    const minMemory = Math.min(...memoryUsage);

    const separator = '='.repeat(60);

    log.info(`\n${separator}`);
    log.info('PERFORMANCE ANALYSIS');
    log.info(separator);
    log.info(`Samples collected: ${samples.length}`);
    log.info(`Average memory usage: ${Math.round(avgMemory / 1024 / 1024)}MB`);
    log.info(`Peak memory usage: ${Math.round(maxMemory / 1024 / 1024)}MB`);
    log.info(`Minimum memory usage: ${Math.round(minMemory / 1024 / 1024)}MB`);

    // Memory leak detection
    const memoryTrend = this.calculateTrend(memoryUsage);

    if (memoryTrend > 0.1) {
      log.warning(
        'Potential memory leak detected - memory usage is trending upward'
      );
    } else {
      log.success('Memory usage appears stable');
    }

    log.info(separator);
  }

  private calculateTrend(values: number[]): number {
    if (values.length < 2) return 0;

    const n = values.length;
    const sumX = (n * (n - 1)) / 2;
    const sumY = values.reduce((a, b) => a + b, 0);
    const sumXY = values.reduce((sum, y, x) => sum + x * y, 0);
    const sumXX = values.reduce((sum, _, x) => sum + x * x, 0);

    return (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  }

  // Log analysis
  async analyzeLogs(logPath = 'logs'): Promise<void> {
    log.info('Analyzing application logs...');

    if (!fs.existsSync(logPath)) {
      log.warning(`Log directory not found: ${logPath}`);
      return;
    }

    const logFiles = fs
      .readdirSync(logPath)
      .filter(file => file.endsWith('.log'))
      .map(file => path.join(logPath, file));

    if (logFiles.length === 0) {
      log.warning('No log files found');
      return;
    }

    const progress = performanceOptimizer.createProgressTracker(
      'log-analysis',
      logFiles.length,
      'Analyzing log files...'
    );

    try {
      const analysis: LogAnalysis = {
        totalLines: 0,
        errorCount: 0,
        warningCount: 0,
        infoCount: 0,
        recentErrors: [],
        commonErrors: {},
        timeRange: { start: null, end: null },
      };

      // Process log files in parallel
      const fileAnalyses = await performanceOptimizer.executeInParallel(
        logFiles,
        async (logFile, index) => {
          try {
            const result = await performanceOptimizer.withTimeout(
              () => this.analyzeLogFile(logFile),
              {
                timeout: 10000,
                message: `Log file analysis timed out: ${logFile}`,
              }
            );

            progress.increment(1, `Analyzed ${path.basename(logFile)}`);
            return result;
          } catch (error) {
            log.warn(`Failed to analyze log file: ${logFile}`, { error });
            progress.increment(1, `Failed: ${path.basename(logFile)}`);
            return null;
          }
        },
        { maxConcurrency: 3, failFast: false }
      );

      // Merge all file analyses
      fileAnalyses.forEach(fileAnalysis => {
        if (fileAnalysis) {
          analysis.totalLines += fileAnalysis.totalLines;
          analysis.errorCount += fileAnalysis.errorCount;
          analysis.warningCount += fileAnalysis.warningCount;
          analysis.infoCount += fileAnalysis.infoCount;

          // Merge recent errors (keep most recent 10)
          analysis.recentErrors.push(...fileAnalysis.recentErrors);
          analysis.recentErrors = analysis.recentErrors
            .sort(
              (a, b) =>
                (b.timestamp?.getTime() || 0) - (a.timestamp?.getTime() || 0)
            )
            .slice(0, 10);

          // Merge common errors
          Object.entries(fileAnalysis.commonErrors).forEach(
            ([error, count]) => {
              analysis.commonErrors[error] =
                (analysis.commonErrors[error] || 0) + count;
            }
          );

          // Update time range
          if (fileAnalysis.timeRange.start) {
            if (
              !analysis.timeRange.start ||
              fileAnalysis.timeRange.start < analysis.timeRange.start
            ) {
              analysis.timeRange.start = fileAnalysis.timeRange.start;
            }
          }
          if (fileAnalysis.timeRange.end) {
            if (
              !analysis.timeRange.end ||
              fileAnalysis.timeRange.end > analysis.timeRange.end
            ) {
              analysis.timeRange.end = fileAnalysis.timeRange.end;
            }
          }
        }
      });

      progress.complete('Log analysis completed');
      this.displayLogAnalysis(analysis);
    } catch (error) {
      progress.fail('Log analysis failed');
      throw error;
    } finally {
      performanceOptimizer.removeProgressTracker('log-analysis');
    }
  }

  private async analyzeLogFile(logFile: string): Promise<LogAnalysis> {
    const content = fs.readFileSync(logFile, 'utf8');
    const lines = content.split('\n').filter(line => line.trim());

    const analysis: LogAnalysis = {
      totalLines: lines.length,
      errorCount: 0,
      warningCount: 0,
      infoCount: 0,
      recentErrors: [],
      commonErrors: {},
      timeRange: { start: null, end: null },
    };

    // Process lines in batches to avoid blocking
    await performanceOptimizer.executeBatched(
      lines,
      async batch => {
        return batch.map(line => {
          if (line.includes('ERROR') || line.includes('error')) {
            analysis.errorCount++;

            // Extract error message
            const errorMatch = line.match(/error[:\s]+(.+)/i);
            if (errorMatch && errorMatch[1]) {
              const errorMsg = errorMatch[1].substring(0, 100);
              analysis.commonErrors[errorMsg] =
                (analysis.commonErrors[errorMsg] || 0) + 1;

              if (analysis.recentErrors.length < 10) {
                analysis.recentErrors.push({
                  timestamp: this.extractTimestamp(line),
                  message: errorMsg,
                  file: path.basename(logFile),
                });
              }
            }
          } else if (line.includes('WARN') || line.includes('warning')) {
            analysis.warningCount++;
          } else if (line.includes('INFO') || line.includes('info')) {
            analysis.infoCount++;
          }

          // Extract timestamp for time range
          const timestamp = this.extractTimestamp(line);
          if (timestamp) {
            if (
              !analysis.timeRange.start ||
              timestamp < analysis.timeRange.start
            ) {
              analysis.timeRange.start = timestamp;
            }
            if (!analysis.timeRange.end || timestamp > analysis.timeRange.end) {
              analysis.timeRange.end = timestamp;
            }
          }

          return line; // Return processed line
        });
      },
      1000 // Process 1000 lines at a time
    );

    return analysis;
  }

  private extractTimestamp(line: string): Date | null {
    // Try to extract ISO timestamp
    const isoMatch = line.match(/(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})/);

    if (isoMatch && isoMatch[1]) {
      return new Date(isoMatch[1]);
    }

    // Try to extract other common timestamp formats
    const dateMatch = line.match(/(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})/);

    if (dateMatch && dateMatch[1]) {
      return new Date(dateMatch[1]);
    }

    return null;
  }

  private displayLogAnalysis(analysis: LogAnalysis): void {
    const separator = '='.repeat(60);

    log.info(`\n${separator}`);
    log.info('LOG ANALYSIS');
    log.info(separator);
    log.info(`Total log lines: ${analysis.totalLines}`);
    log.info(`Errors: ${analysis.errorCount}`);
    log.info(`Warnings: ${analysis.warningCount}`);
    log.info(`Info messages: ${analysis.infoCount}`);

    if (analysis.timeRange.start && analysis.timeRange.end) {
      log.info(
        `Time range: ${analysis.timeRange.start.toISOString()} to ${analysis.timeRange.end.toISOString()}`
      );
    }

    if (analysis.recentErrors.length > 0) {
      log.error(`\nRecent Errors:`);
      analysis.recentErrors.forEach(error => {
        log.info(`  [${error.file}] ${error.message}`);
      });
    }

    if (Object.keys(analysis.commonErrors).length > 0) {
      log.warning(`\nMost Common Errors:`);
      const sortedErrors = Object.entries(analysis.commonErrors)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5);

      sortedErrors.forEach(([error, count]) => {
        log.info(`  ${count}x: ${error}`);
      });
    }

    log.info(separator);
  }

  // Database debugging
  async debugDatabase(): Promise<void> {
    log.info('Running database diagnostics...');

    try {
      // Check database connection
      const dbUrl = process.env.DATABASE_URL;

      if (!dbUrl) {
        log.error('DATABASE_URL not configured');

        return;
      }

      // Try to connect and run basic queries
      const testQueries = [
        'SELECT version();',
        'SELECT current_database();',
        "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';",
      ];

      for (const query of testQueries) {
        try {
          const result = execSync(`psql "${dbUrl}" -c "${query}"`, {
            encoding: 'utf8',
            stdio: 'pipe',
          });

          log.success(`✅ ${query}`);
          if (this.options.verbose) {
            log.info(result);
          }
        } catch (error: unknown) {
          log.error(
            `❌ ${query}`,
            error instanceof Error ? error : new Error('Unknown error')
          );
        }
      }

      // Check for common issues
      await this.checkDatabaseIssues();
    } catch (error: unknown) {
      log.error(
        `Database diagnostics failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  private async checkDatabaseIssues(): Promise<void> {
    const issues: string[] = [];

    try {
      // Check if psql is available
      const psqlInfo = await this.platformService.findExecutable('psql');

      if (!psqlInfo || !psqlInfo.available) {
        issues.push('PostgreSQL client (psql) not available');

        return;
      }

      const dbUrl = process.env.DATABASE_URL;

      if (!dbUrl) {
        issues.push('DATABASE_URL not configured');

        return;
      }

      // Check for long-running queries using cross-platform command
      const longQueriesCommand =
        this.platformService.getDatabaseCommands().postgres;
      const longQueriesResult = await this.platformService.executeCommand({
        ...longQueriesCommand,
        fallback: `psql "${dbUrl}" -c "SELECT pid, now() - pg_stat_activity.query_start AS duration, query FROM pg_stat_activity WHERE (now() - pg_stat_activity.query_start) > interval '5 minutes';"`,
      });

      if (longQueriesResult.success && longQueriesResult.output.includes('(')) {
        issues.push('Long-running queries detected');
      }

      // Check for locks using cross-platform command
      const locksResult = await this.platformService.executeCommand({
        ...longQueriesCommand,
        fallback: `psql "${dbUrl}" -c "SELECT count(*) FROM pg_locks WHERE NOT granted;"`,
      });

      if (locksResult.success) {
        const lockCount = parseInt(
          locksResult.output.match(/\d+/)?.[0] || '0',
          10
        );

        if (lockCount > 0) {
          issues.push(`${lockCount} blocked queries detected`);
        }
      }
    } catch (error: unknown) {
      issues.push(
        `Unable to check database issues: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }

    if (issues.length > 0) {
      log.warning(`\nDatabase Issues:`);
      issues.forEach(issue => log.warning(`  ⚠️  ${issue}`));
    } else {
      log.success(`\nNo database issues detected`);
    }
  }

  // Network debugging
  async debugNetwork(): Promise<void> {
    log.info('Running network diagnostics...');

    const endpoints = [
      { name: 'Frontend', url: 'http://localhost:3000' },
      { name: 'API Gateway', url: 'http://localhost:8000' },
      { name: 'User Service', url: 'http://localhost:8001/health' },
      { name: 'Newsletter Service', url: 'http://localhost:8002/health' },
      { name: 'CRM Service', url: 'http://localhost:8003/health' },
      { name: 'Analytics Service', url: 'http://localhost:8004/health' },
    ];

    const progress = performanceOptimizer.createProgressTracker(
      'network-diagnostics',
      endpoints.length,
      'Checking endpoint health...'
    );

    log.info(`\nEndpoint Health Checks:`);

    try {
      // Check all endpoints in parallel
      const results = await performanceOptimizer.executeInParallel(
        endpoints,
        async endpoint => {
          try {
            const startTime = Date.now();

            // Use curl with timeout protection
            const result = await performanceOptimizer.withTimeout(
              () =>
                new Promise<string>((resolve, reject) => {
                  try {
                    const output = execSync(
                      `curl -s -o /dev/null -w "%{http_code}" --max-time 5 "${endpoint.url}"`,
                      {
                        encoding: 'utf8',
                        stdio: 'pipe',
                      }
                    );
                    resolve(output);
                  } catch (error) {
                    reject(error);
                  }
                }),
              {
                timeout: 7000,
                message: `Health check timeout for ${endpoint.name}`,
              }
            );

            const responseTime = Date.now() - startTime;
            const statusCode = result.trim();

            progress.increment(1, `Checked ${endpoint.name}`);

            return {
              name: endpoint.name,
              statusCode,
              responseTime,
              success: statusCode === '200',
              error: null,
            };
          } catch (error) {
            progress.increment(1, `Failed ${endpoint.name}`);
            return {
              name: endpoint.name,
              statusCode: 'N/A',
              responseTime: 0,
              success: false,
              error:
                error instanceof Error ? error.message : 'Connection failed',
            };
          }
        },
        { maxConcurrency: 4, failFast: false }
      );

      progress.complete('Network diagnostics completed');

      // Display results
      results.forEach(result => {
        if (result) {
          if (result.success) {
            log.success(
              `✅ ${result.name}: ${result.statusCode} (${result.responseTime}ms)`
            );
          } else {
            log.error(
              `❌ ${result.name}: ${result.error || result.statusCode} (${result.responseTime}ms)`
            );
          }
        }
      });
    } catch (error) {
      progress.fail('Network diagnostics failed');
      throw error;
    } finally {
      performanceOptimizer.removeProgressTracker('network-diagnostics');
    }
  }
}

// CLI interface
function showHelp(): void {
  const helpText = `
Debug Tools

Comprehensive debugging utilities for development troubleshooting.

Usage:
  node debug-tools.js <command> [options]

Commands:
  diagnostics     Run complete system diagnostics
  performance     Monitor performance for specified duration
  logs           Analyze application logs
  database       Debug database connectivity and performance
  network        Test network connectivity to services
  monitor        Start real-time monitoring dashboard
  clear-cache    Clear performance optimization cache

Options:
  --verbose      Show detailed output
  --output json  Output results in JSON format
  --duration N   Duration for performance monitoring (seconds)
  --log-path P   Path to log files directory
  --no-cache     Disable caching for this run

Examples:
  node debug-tools.js diagnostics
  node debug-tools.js performance --duration 60
  node debug-tools.js logs --log-path ./logs
  node debug-tools.js database --verbose
  node debug-tools.js clear-cache
`;

  log.info(helpText);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    showHelp();

    return;
  }

  const command = args[0];
  const options = {
    verbose: args.includes('--verbose'),
    output: args.includes('--output')
      ? args[args.indexOf('--output') + 1] || 'console'
      : 'console',
    duration: args.includes('--duration')
      ? parseInt(args[args.indexOf('--duration') + 1] || '30', 10)
      : 30,
    logPath: args.includes('--log-path')
      ? args[args.indexOf('--log-path') + 1] || 'logs'
      : 'logs',
    noCache: args.includes('--no-cache'),
  };

  // Clear cache if requested
  if (options.noCache) {
    performanceOptimizer.clearCache();
    log.info('Performance cache cleared for this run');
  }

  const debugTools = new DebugTools(options);

  try {
    // Measure overall performance of the command
    const { result, duration, memoryDelta } =
      await performanceOptimizer.measurePerformance(async () => {
        switch (command) {
          case 'diagnostics':
            return await debugTools.systemDiagnostics();
          case 'performance':
            await debugTools.performanceMonitor(options.duration);
            return 'Performance monitoring completed';
          case 'logs':
            await debugTools.analyzeLogs(options.logPath);
            return 'Log analysis completed';
          case 'database':
            await debugTools.debugDatabase();
            return 'Database diagnostics completed';
          case 'network':
            await debugTools.debugNetwork();
            return 'Network diagnostics completed';
          case 'monitor':
            log.info('Starting monitoring dashboard...');
            await debugTools.systemDiagnostics();
            await debugTools.performanceMonitor(10);
            await debugTools.analyzeLogs(options.logPath);
            return 'Monitoring dashboard completed';
          case 'clear-cache':
            performanceOptimizer.clearCache();
            const stats = performanceOptimizer.getCacheStats();
            log.success(
              `Cache cleared. Current cache size: ${stats.size} entries`
            );
            return 'Cache cleared';
          default:
            log.error(`Unknown command: ${command}`);
            showHelp();
            process.exit(1);
        }
      }, `debug-tools-${command}`);

    // Show performance summary if verbose
    if (options.verbose) {
      const memUsage = performanceOptimizer.getMemoryUsage();
      log.info('\n📊 Performance Summary:');
      log.info(`⏱️  Execution time: ${duration}ms`);
      log.info(`💾 Memory delta: ${Math.round(memoryDelta / 1024)}KB`);
      log.info(`🗄️  Cache size: ${Math.round(memUsage.cacheSize / 1024)}KB`);
      log.info(
        `🧠 Current heap: ${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`
      );
    }
  } catch (error: unknown) {
    log.error(
      `Debug command failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
    if (options.verbose && error instanceof Error) {
      log.error(error.stack || 'No stack trace available');
    }
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(error => {
    log.error('Debug tools failed:', error);
    process.exit(1);
  });
}

export { DebugTools };
