import { execSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { log } from './Logger';

export type OperatingSystem = 'windows' | 'macos' | 'linux' | 'unknown';

export interface CommandResult {
  success: boolean;
  output: string;
  error?: string;
  exitCode?: number;
}

export interface PlatformCommand {
  windows?: string;
  macos?: string;
  linux?: string;
  fallback?: string;
}

export interface ProcessInfo {
  pid: number;
  name: string;
  cpu?: number;
  memory?: number;
  command?: string;
}

export interface PortInfo {
  port: number;
  protocol: 'tcp' | 'udp';
  state: string;
  pid?: number | undefined;
  process?: string | undefined;
}

export interface ExecutableInfo {
  name: string;
  path: string;
  version?: string | undefined;
  available: boolean;
}

export class PlatformService {
  private os: OperatingSystem;

  constructor() {
    this.os = this.detectOperatingSystem();
  }

  getOperatingSystem(): OperatingSystem {
    return this.os;
  }

  private detectOperatingSystem(): OperatingSystem {
    const platform = os.platform();

    switch (platform) {
      case 'win32':
        return 'windows';
      case 'darwin':
        return 'macos';
      case 'linux':
        return 'linux';
      default:
        log.warning(`Unknown platform: ${platform}, treating as linux`);

        return 'unknown';
    }
  }

  async executeCommand(command: PlatformCommand): Promise<CommandResult> {
    const cmd = this.selectCommand(command);

    if (!cmd) {
      return {
        success: false,
        output: '',
        error: 'No suitable command found for current platform',
      };
    }

    try {
      log.debug(`Executing command: ${cmd}`);
      const output = execSync(cmd, {
        encoding: 'utf8',
        stdio: 'pipe',
        timeout: 30000, // 30 second timeout
      });

      return {
        success: true,
        output: output.trim(),
        exitCode: 0,
      };
    } catch (error: unknown) {
      // Try fallback command if available and primary command failed
      if (command.fallback && cmd !== command.fallback) {
        log.debug(
          `Primary command failed, trying fallback: ${command.fallback}`
        );
        try {
          const output = execSync(command.fallback, {
            encoding: 'utf8',
            stdio: 'pipe',
            timeout: 30000,
          });

          return {
            success: true,
            output: output.trim(),
            exitCode: 0,
          };
        } catch (fallbackError: unknown) {
          const fallbackErr = fallbackError as { message?: string };

          log.debug(
            `Fallback command also failed: ${fallbackErr.message || 'Unknown error'}`
          );
        }
      }

      const err = error as {
        stdout?: string;
        message?: string;
        status?: number;
      };

      return {
        success: false,
        output: err.stdout || '',
        error: err.message || 'Unknown error',
        exitCode: err.status || 1,
      };
    }
  }

  private selectCommand(command: PlatformCommand): string | null {
    // Try platform-specific command first
    switch (this.os) {
      case 'windows':
        if (command.windows) return command.windows;
        break;
      case 'macos':
        if (command.macos) return command.macos;
        break;
      case 'linux':
        if (command.linux) return command.linux;
        break;
    }

    // Fall back to generic command
    return command.fallback || null;
  }

  getPortCheckCommand(port: number): PlatformCommand {
    return {
      windows: `netstat -ano | findstr :${port}`,
      macos: `lsof -i :${port}`,
      linux: `lsof -i :${port}`,
      fallback: `netstat -an | grep :${port}`,
    };
  }

  getProcessListCommand(): PlatformCommand {
    return {
      windows: 'tasklist',
      macos: 'ps aux',
      linux: 'ps aux',
      fallback: 'ps',
    };
  }

  getDiskSpaceCommand(): PlatformCommand {
    return {
      windows: 'dir /-c',
      macos: 'df -h .',
      linux: 'df -h .',
      fallback: 'df -h',
    };
  }

  normalizePath(filePath: string): string {
    return path.normalize(filePath);
  }

  joinPath(...paths: string[]): string {
    return path.join(...paths);
  }

  isExecutableAvailable(executable: string): boolean {
    try {
      const command =
        this.os === 'windows' ? `where ${executable}` : `which ${executable}`;

      execSync(command, { stdio: 'pipe' });

      return true;
    } catch {
      return false;
    }
  }

  getPathSeparator(): string {
    return path.sep;
  }

  async getProcessList(): Promise<ProcessInfo[]> {
    const command = this.getProcessListCommand();
    const result = await this.executeCommand(command);

    if (!result.success) {
      log.warning('Failed to get process list', { error: result.error });

      return [];
    }

    return this.parseProcessList(result.output);
  }

  async checkPortUsage(port: number): Promise<PortInfo | null> {
    const command = this.getPortCheckCommand(port);
    const result = await this.executeCommand(command);

    if (!result.success) {
      return null;
    }

    return this.parsePortInfo(result.output, port);
  }

  async findExecutable(name: string): Promise<ExecutableInfo | null> {
    const command = this.os === 'windows' ? `where ${name}` : `which ${name}`;

    try {
      const output = execSync(command, {
        encoding: 'utf8',
        stdio: 'pipe',
      });

      const executablePath = output.trim().split('\n')[0] || '';

      return {
        name,
        path: executablePath,
        available: true,
        version: await this.getExecutableVersion(name),
      };
    } catch {
      return {
        name,
        path: '',
        available: false,
      };
    }
  }

  async getExecutableVersion(name: string): Promise<string | undefined> {
    const versionCommands = [
      `${name} --version`,
      `${name} -v`,
      `${name} version`,
    ];

    for (const cmd of versionCommands) {
      try {
        const output = execSync(cmd, {
          encoding: 'utf8',
          stdio: 'pipe',
          timeout: 5000,
        });

        // Extract version number from output
        const versionMatch = output.match(/(\d+\.\d+\.\d+)/);

        if (versionMatch) {
          return versionMatch[1];
        }
      } catch {
        // Continue to next command
      }
    }

    return undefined;
  }

  getEnvironmentVariable(name: string): string | undefined {
    return process.env[name];
  }

  setEnvironmentVariable(name: string, value: string): void {
    process.env[name] = value;
  }

  getHomeDirectory(): string {
    return os.homedir();
  }

  getTempDirectory(): string {
    return os.tmpdir();
  }

  getCurrentWorkingDirectory(): string {
    return process.cwd();
  }

  async createDirectory(dirPath: string): Promise<boolean> {
    try {
      await fs.promises.mkdir(dirPath, { recursive: true });

      return true;
    } catch (error) {
      log.error(`Failed to create directory: ${dirPath}`, error as Error);

      return false;
    }
  }

  async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.promises.access(filePath);

      return true;
    } catch {
      return false;
    }
  }

  async directoryExists(dirPath: string): Promise<boolean> {
    try {
      const stats = await fs.promises.stat(dirPath);

      return stats.isDirectory();
    } catch {
      return false;
    }
  }

  getSystemInfo(): Record<string, unknown> {
    return {
      platform: this.os,
      arch: os.arch(),
      release: os.release(),
      hostname: os.hostname(),
      uptime: os.uptime(),
      totalMemory: os.totalmem(),
      freeMemory: os.freemem(),
      cpus: os.cpus(),
      networkInterfaces: os.networkInterfaces(),
      loadAverage: os.loadavg(),
    };
  }

  private parseProcessList(output: string): ProcessInfo[] {
    const processes: ProcessInfo[] = [];
    const lines = output.split('\n').slice(1); // Skip header

    for (const line of lines) {
      if (!line.trim()) continue;

      try {
        const process = this.parseProcessLine(line);

        if (process) {
          processes.push(process);
        }
      } catch (error) {
        log.debug(`Failed to parse process line: ${line}`, { error });
      }
    }

    return processes;
  }

  private parseProcessLine(line: string): ProcessInfo | null {
    const parts = line.trim().split(/\s+/);

    if (this.os === 'windows') {
      // Windows tasklist format: Image Name, PID, Session Name, Session#, Mem Usage
      if (parts.length >= 5 && parts[0] && parts[1] && parts[4]) {
        return {
          pid: parseInt(parts[1], 10),
          name: parts[0],
          memory: this.parseMemoryUsage(parts[4]),
        };
      }
    } else {
      // Unix ps aux format: USER PID %CPU %MEM VSZ RSS TTY STAT START TIME COMMAND
      if (parts.length >= 11 && parts[1] && parts[2] && parts[3]) {
        return {
          pid: parseInt(parts[1], 10),
          name: parts.slice(10).join(' '),
          cpu: parseFloat(parts[2]),
          memory: parseFloat(parts[3]),
          command: parts.slice(10).join(' '),
        };
      }
    }

    return null;
  }

  private parseMemoryUsage(memStr: string): number {
    // Parse memory usage from strings like "1,234 K" or "12,345"
    const numStr = memStr.replace(/[,\s]/g, '');
    const num = parseInt(numStr, 10);

    if (memStr.includes('K')) {
      return num * 1024;
    } else if (memStr.includes('M')) {
      return num * 1024 * 1024;
    }

    return num;
  }

  private parsePortInfo(output: string, port: number): PortInfo | null {
    const lines = output.split('\n');

    for (const line of lines) {
      if (line.includes(`:${port}`)) {
        try {
          if (this.os === 'windows') {
            // Windows netstat format: Proto Local Address Foreign Address State PID
            const parts = line.trim().split(/\s+/);

            if (parts.length >= 5 && parts[0] && parts[3] && parts[4]) {
              return {
                port,
                protocol: parts[0].toLowerCase() as 'tcp' | 'udp',
                state: parts[3],
                pid: parseInt(parts[4], 10),
              };
            }
          } else {
            // Unix lsof format varies, but typically includes PID and command
            const pidMatch = line.match(/\s+(\d+)\s+/);
            const processMatch = line.match(/\s+(\w+)\s+/);

            return {
              port,
              protocol: line.includes('TCP') ? 'tcp' : 'udp',
              state: 'LISTEN',
              pid:
                pidMatch && pidMatch[1] ? parseInt(pidMatch[1], 10) : undefined,
              process:
                processMatch && processMatch[1] ? processMatch[1] : undefined,
            };
          }
        } catch (error) {
          log.debug(`Failed to parse port info line: ${line}`, { error });
        }
      }
    }

    return null;
  }

  getKillProcessCommand(pid: number): PlatformCommand {
    return {
      windows: `taskkill /PID ${pid} /F`,
      macos: `kill -9 ${pid}`,
      linux: `kill -9 ${pid}`,
      fallback: `kill ${pid}`,
    };
  }

  getServiceStatusCommand(serviceName: string): PlatformCommand {
    return {
      windows: `sc query "${serviceName}"`,
      macos: `launchctl list | grep ${serviceName}`,
      linux: `systemctl status ${serviceName}`,
      fallback: `ps aux | grep ${serviceName}`,
    };
  }

  getDockerCommand(): PlatformCommand {
    return {
      windows: 'docker',
      macos: 'docker',
      linux: 'docker',
      fallback: 'docker',
    };
  }

  getDatabaseCommands(): Record<string, PlatformCommand> {
    return {
      postgres: {
        windows: 'psql',
        macos: 'psql',
        linux: 'psql',
        fallback: 'psql',
      },
      mysql: {
        windows: 'mysql',
        macos: 'mysql',
        linux: 'mysql',
        fallback: 'mysql',
      },
      redis: {
        windows: 'redis-cli',
        macos: 'redis-cli',
        linux: 'redis-cli',
        fallback: 'redis-cli',
      },
    };
  }
}
