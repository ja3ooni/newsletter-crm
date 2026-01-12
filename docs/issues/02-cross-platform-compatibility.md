# 🚨 CRITICAL: Cross-Platform Compatibility Issues

**Priority:** Critical **Labels:** critical, bug, cross-platform,
developer-tools **Milestone:** Week 1 **Estimated Effort:** 4-6 hours

## 🔍 Problem Description

Developer tools fail on different operating systems due to platform-specific
commands and file system differences. This prevents developers on Windows from
using the tools effectively and limits team adoption.

## 📊 Current Issues

### Platform-Specific Commands:

- `lsof -i :port` - Unix/Linux only, not available on Windows
- `psql` - Different installation paths across platforms
- File path separators (`/` vs `\`)
- Process management commands differ

### Affected Tools:

- `scripts/debug-tools.js` - Port checking, process management
- `scripts/dev-utilities.js` - Database operations, service management
- `scripts/setup-dev.sh` - Bash script, Windows needs PowerShell equivalent

### Specific Failures:

```javascript
// This fails on Windows:
execSync('lsof -i :8000');

// This has path issues:
execSync('psql "postgresql://..."');

// File paths break on Windows:
const logPath = 'logs/app.log'; // Should use path.join()
```

## 🎯 Acceptance Criteria

### Cross-Platform Support:

- [ ] **All tools work on Windows, macOS, and Linux**
- [ ] Graceful fallbacks for platform-specific commands
- [ ] Clear error messages for unsupported operations
- [ ] Consistent behavior across platforms

### Command Alternatives:

- [ ] Windows alternatives for Unix commands
- [ ] OS detection and appropriate command selection
- [ ] Fallback mechanisms when commands are unavailable
- [ ] Path handling works on all platforms

### Testing:

- [ ] Tested on Windows 10/11
- [ ] Tested on macOS (latest)
- [ ] Tested on Ubuntu Linux
- [ ] All core functionality works on each platform

## 🛠️ Implementation Plan

### Step 1: OS Detection (1 hour)

```javascript
const os = require('os');

function getOperatingSystem() {
  const platform = os.platform();
  switch (platform) {
    case 'win32':
      return 'windows';
    case 'darwin':
      return 'macos';
    case 'linux':
      return 'linux';
    default:
      return 'unknown';
  }
}

function isWindows() {
  return getOperatingSystem() === 'windows';
}

function isUnix() {
  return ['macos', 'linux'].includes(getOperatingSystem());
}
```

### Step 2: Command Alternatives (2-3 hours)

#### Port Checking:

```javascript
function getPortCheckCommand(port) {
  const os = getOperatingSystem();
  switch (os) {
    case 'windows':
      return `netstat -ano | findstr :${port}`;
    case 'macos':
    case 'linux':
      return `lsof -i :${port}`;
    default:
      throw new Error(`Port checking not supported on ${os}`);
  }
}

async function checkPort(port) {
  try {
    const command = getPortCheckCommand(port);
    const result = execSync(command, { encoding: 'utf8', stdio: 'pipe' });
    return parsePortOutput(result, getOperatingSystem());
  } catch (error) {
    // Port is likely available
    return { port, inUse: false };
  }
}
```

#### Process Management:

```javascript
function getProcessListCommand() {
  const os = getOperatingSystem();
  switch (os) {
    case 'windows':
      return 'tasklist /fo csv';
    case 'macos':
    case 'linux':
      return 'ps aux';
    default:
      throw new Error(`Process listing not supported on ${os}`);
  }
}
```

#### Database Commands:

```javascript
function getDatabaseCommand(dbUrl, query) {
  const os = getOperatingSystem();
  const psqlPath = findPsqlPath(os);

  if (!psqlPath) {
    throw new Error(
      'PostgreSQL client (psql) not found. Please install PostgreSQL client tools.'
    );
  }

  return `"${psqlPath}" "${dbUrl}" -c "${query}"`;
}

function findPsqlPath(os) {
  const commonPaths = {
    windows: [
      'C:\\Program Files\\PostgreSQL\\*\\bin\\psql.exe',
      'C:\\Program Files (x86)\\PostgreSQL\\*\\bin\\psql.exe',
    ],
    macos: [
      '/usr/local/bin/psql',
      '/opt/homebrew/bin/psql',
      '/Applications/Postgres.app/Contents/Versions/*/bin/psql',
    ],
    linux: ['/usr/bin/psql', '/usr/local/bin/psql'],
  };

  // Implementation to find psql in common locations
  return findExecutableInPaths(commonPaths[os] || []);
}
```

### Step 3: File Path Handling (30 minutes)

```javascript
const path = require('path');

// Before:
const logFile = 'logs/app.log';

// After:
const logFile = path.join('logs', 'app.log');

// Before:
const servicePath = `services/${serviceName}`;

// After:
const servicePath = path.join('services', serviceName);
```

### Step 4: PowerShell Scripts for Windows (1 hour)

Create Windows equivalents for bash scripts:

- `scripts/setup-dev.ps1` ✅ (already exists)
- `scripts/dev-utils.ps1` ✅ (already exists)
- Ensure they have feature parity with bash versions

## 📋 Files to Modify

### Primary Files:

- `scripts/debug-tools.js` - Add OS detection and command alternatives
- `scripts/dev-utilities.js` - Cross-platform service management
- `scripts/dev-onboarding.js` - Platform-specific setup steps

### Supporting Files:

- `scripts/utils/platform.js` - New utility for OS detection
- `scripts/utils/commands.js` - New utility for command alternatives
- `docs/development/setup-guide.md` - Platform-specific instructions

### PowerShell Scripts (verify/enhance):

- `scripts/setup-dev.ps1` - Windows setup
- `scripts/dev-utils.ps1` - Windows utilities

## 🧪 Testing Strategy

### Platform Testing Matrix:

| Feature             | Windows | macOS | Linux | Status    |
| ------------------- | ------- | ----- | ----- | --------- |
| System Diagnostics  | ❌      | ✅    | ✅    | Needs Fix |
| Port Checking       | ❌      | ✅    | ✅    | Needs Fix |
| Process Management  | ❌      | ✅    | ✅    | Needs Fix |
| Database Operations | ❌      | ✅    | ✅    | Needs Fix |
| Service Management  | ❌      | ✅    | ✅    | Needs Fix |
| Log Analysis        | ✅      | ✅    | ✅    | Working   |

### Test Cases:

```bash
# Test on each platform:
node scripts/debug-tools.js diagnostics
node scripts/debug-tools.js performance --duration 30
node scripts/debug-tools.js network
node scripts/dev-utilities.js service status
node scripts/dev-utilities.js validate-env
```

## 📈 Success Metrics

### Before Fix:

- **Windows compatibility: 20%**
- **macOS compatibility: 95%**
- **Linux compatibility: 90%**
- **Cross-platform features: 3/10**

### After Fix (Target):

- **Windows compatibility: 95%**
- **macOS compatibility: 100%**
- **Linux compatibility: 100%**
- **Cross-platform features: 10/10**

## 🚨 Impact Assessment

### Current Impact:

- **Windows developers cannot use tools**
- **Team adoption limited to Unix users**
- **Inconsistent developer experience**
- **Setup failures on Windows**

### Business Impact:

- **Reduced team productivity**
- **Platform lock-in to Unix systems**
- **Higher onboarding friction**
- **Developer satisfaction issues**

## 🔧 Implementation Details

### Error Handling Strategy:

```javascript
async function executeWithFallback(
  primaryCommand,
  fallbackCommand,
  errorMessage
) {
  try {
    return await execSync(primaryCommand, { encoding: 'utf8' });
  } catch (primaryError) {
    if (fallbackCommand) {
      try {
        return await execSync(fallbackCommand, { encoding: 'utf8' });
      } catch (fallbackError) {
        throw new Error(`${errorMessage}: ${fallbackError.message}`);
      }
    }
    throw new Error(`${errorMessage}: ${primaryError.message}`);
  }
}
```

### Graceful Degradation:

```javascript
async function checkPortAvailability(port) {
  try {
    return await checkPort(port);
  } catch (error) {
    logger.warn(
      `Port checking not available on this platform: ${error.message}`
    );
    return { port, inUse: 'unknown', error: error.message };
  }
}
```

## 🔗 Dependencies

### Required for Implementation:

- OS detection utilities
- Command alternative mappings
- Path handling utilities
- Error handling patterns

### External Dependencies:

- Node.js `os` module
- Node.js `path` module
- Platform-specific command line tools

## 📞 Assignment

**Assignee:** [To be assigned] **Reviewer:** [Tech Lead] **Due Date:** End of
Day 3

## 💬 Implementation Notes

### Testing Approach:

1. **Local Testing:** Test on available platforms
2. **CI/CD Integration:** Add cross-platform testing to pipeline
3. **Community Testing:** Ask team members to test on their platforms
4. **Documentation:** Update setup guides with platform-specific instructions

### Rollout Strategy:

1. **Phase 1:** Implement OS detection and basic alternatives
2. **Phase 2:** Add comprehensive command alternatives
3. **Phase 3:** Test and refine on all platforms
4. **Phase 4:** Update documentation and training

---

**Created:** [Current Date] **Status:** Ready to Start **Priority:** 🚨 CRITICAL
