#!/usr/bin/env node

/**
 * Comprehensive Rebranding Script
 * Systematically rebrand from "DatatechtonCRM/datatechtoncrm" to "DatatechtonCRM/datatechtoncrm"
 *
 * Usage: node scripts/rebrand-to-datatechtoncrm.js [--dry-run] [--backup]
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Configuration
const DRY_RUN = process.argv.includes('--dry-run');
const CREATE_BACKUP = process.argv.includes('--backup') || DRY_RUN;
const BACKUP_DIR = path.join(__dirname, '..', '.rebranding-backup');

// Replacement mappings
const REPLACEMENTS = [
  // Exact case-sensitive replacements
  { from: 'DatatechtonCRM', to: 'DatatechtonCRM', description: 'Brand name (PascalCase)' },
  { from: 'datatechtoncrm', to: 'datatechtoncrm', description: 'Brand name (lowercase)' },
  { from: 'Datatechtoncrm', to: 'Datatechtoncrm', description: 'Brand name (Capitalized)' },

  // NPM scope
  { from: '@datatechtoncrm/', to: '@datatechtoncrm/', description: 'NPM package scope' },

  // Specific instances
  { from: 'datatechtoncrm-platform', to: 'datatechtoncrm-platform', description: 'Platform name' },
  { from: 'datatechtoncrm-frontend', to: 'datatechtoncrm-frontend', description: 'Frontend package' },
  { from: 'datatechtoncrm_db', to: 'datatechtoncrm_db', description: 'Database name' },
  { from: 'datatechtoncrm-staging', to: 'datatechtoncrm-staging', description: 'Staging env' },
  { from: 'datatechtoncrm-production', to: 'datatechtoncrm-production', description: 'Production env' },
  { from: 'admin@datatechtoncrm.dev', to: 'admin@datatechtoncrm.dev', description: 'Admin email' },
  { from: 'datatechtoncrm/datatechtoncrm_rabbitmq_password', to: 'datatechtoncrm/datatechtoncrm_rabbitmq_password', description: 'RabbitMQ credentials' },

  // Kubernetes namespace
  { from: 'namespace: datatechtoncrm', to: 'namespace: datatechtoncrm', description: 'K8s namespace' },
  { from: '-n datatechtoncrm', to: '-n datatechtoncrm', description: 'K8s namespace flag' },

  // Docker registry
  { from: 'ghcr.io/your-username/datatechtoncrm', to: 'ghcr.io/your-username/datatechtoncrm', description: 'Docker registry' },
  { from: 'datatechtoncrm/', to: 'datatechtoncrm/', description: 'Docker image prefix' },
];

// File patterns to process
const FILE_PATTERNS = [
  '**/*.ts',
  '**/*.tsx',
  '**/*.js',
  '**/*.jsx',
  '**/*.json',
  '**/*.md',
  '**/*.sql',
  '**/*.yml',
  '**/*.yaml',
  '**/*.sh',
  '**/*.ps1',
  '**/*.env.example',
  '**/Dockerfile*',
];

// Directories to exclude
const EXCLUDE_DIRS = [
  'node_modules',
  '.git',
  'dist',
  'build',
  '.next',
  'coverage',
  '.rebranding-backup',
  '.jest-cache',
];

// Statistics
const stats = {
  filesScanned: 0,
  filesModified: 0,
  replacementsMade: 0,
  errors: [],
  modifiedFiles: [],
};

/**
 * Create backup of the entire project
 */
function createBackup() {
  console.log('\n📦 Creating backup...');

  if (fs.existsSync(BACKUP_DIR)) {
    console.log('   Removing old backup...');
    fs.rmSync(BACKUP_DIR, { recursive: true, force: true });
  }

  fs.mkdirSync(BACKUP_DIR, { recursive: true });

  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFile = path.join(BACKUP_DIR, `pre-rebrand-${timestamp}.tar.gz`);

    console.log(`   Creating archive: ${backupFile}`);

    // Create a simple directory copy instead of tar for cross-platform compatibility
    const rootDir = path.join(__dirname, '..');
    copyDirectory(rootDir, path.join(BACKUP_DIR, 'project'), EXCLUDE_DIRS.concat(['.rebranding-backup']));

    console.log('   ✅ Backup created successfully');
    console.log(`   📁 Backup location: ${BACKUP_DIR}`);

    return true;
  } catch (error) {
    console.error('   ❌ Backup failed:', error.message);
    return false;
  }
}

/**
 * Copy directory recursively (for backup)
 */
function copyDirectory(src, dest, exclude = []) {
  const entries = fs.readdirSync(src, { withFileTypes: true });

  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    // Skip excluded directories
    if (exclude.includes(entry.name)) {
      continue;
    }

    if (entry.isDirectory()) {
      copyDirectory(srcPath, destPath, exclude);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

/**
 * Check if file should be excluded
 */
function shouldExclude(filePath) {
  return EXCLUDE_DIRS.some(dir => filePath.includes(path.sep + dir + path.sep) || filePath.includes(path.sep + dir));
}

/**
 * Get all files matching patterns
 */
function getAllFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir, { withFileTypes: true });

  for (const file of files) {
    const filePath = path.join(dir, file.name);

    if (shouldExclude(filePath)) {
      continue;
    }

    if (file.isDirectory()) {
      getAllFiles(filePath, fileList);
    } else {
      // Check if file matches any pattern
      const ext = path.extname(file.name);
      const basename = path.basename(file.name);
      const shouldInclude =
        ['.ts', '.tsx', '.js', '.jsx', '.json', '.md', '.sql', '.yml', '.yaml', '.sh', '.ps1'].includes(ext) ||
        basename === 'Dockerfile' ||
        basename.startsWith('Dockerfile.') ||
        basename.endsWith('.env.example');

      if (shouldInclude) {
        fileList.push(filePath);
      }
    }
  }

  return fileList;
}

/**
 * Process a single file
 */
function processFile(filePath) {
  stats.filesScanned++;

  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;
    let replacementsInFile = 0;

    // Apply all replacements
    for (const replacement of REPLACEMENTS) {
      const regex = new RegExp(escapeRegex(replacement.from), 'g');
      const matches = content.match(regex);

      if (matches) {
        content = content.replace(regex, replacement.to);
        replacementsInFile += matches.length;
        modified = true;
      }
    }

    if (modified) {
      stats.filesModified++;
      stats.replacementsMade += replacementsInFile;
      stats.modifiedFiles.push({
        path: filePath,
        replacements: replacementsInFile
      });

      if (!DRY_RUN) {
        fs.writeFileSync(filePath, content, 'utf8');
      }

      return true;
    }

    return false;
  } catch (error) {
    stats.errors.push({
      file: filePath,
      error: error.message
    });
    return false;
  }
}

/**
 * Escape special regex characters
 */
function escapeRegex(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Print progress bar
 */
function printProgress(current, total) {
  const percentage = Math.round((current / total) * 100);
  const barLength = 30;
  const filled = Math.round((barLength * current) / total);
  const bar = '█'.repeat(filled) + '░'.repeat(barLength - filled);

  process.stdout.write(`\r   Progress: [${bar}] ${percentage}% (${current}/${total})`);
}

/**
 * Print summary
 */
function printSummary() {
  console.log('\n\n📊 Rebranding Summary');
  console.log('═══════════════════════════════════════════');
  console.log(`   Mode: ${DRY_RUN ? '🔍 DRY RUN (no changes made)' : '✏️  LIVE (changes applied)'}`);
  console.log(`   Files scanned: ${stats.filesScanned}`);
  console.log(`   Files modified: ${stats.filesModified}`);
  console.log(`   Total replacements: ${stats.replacementsMade}`);
  console.log(`   Errors: ${stats.errors.length}`);

  if (stats.errors.length > 0) {
    console.log('\n❌ Errors encountered:');
    stats.errors.forEach(err => {
      console.log(`   - ${err.file}: ${err.error}`);
    });
  }

  if (stats.modifiedFiles.length > 0 && stats.modifiedFiles.length <= 20) {
    console.log('\n📝 Modified files:');
    stats.modifiedFiles.forEach(file => {
      console.log(`   - ${path.relative(process.cwd(), file.path)} (${file.replacements} replacements)`);
    });
  } else if (stats.modifiedFiles.length > 20) {
    console.log(`\n📝 Modified ${stats.modifiedFiles.length} files (showing first 20):`);
    stats.modifiedFiles.slice(0, 20).forEach(file => {
      console.log(`   - ${path.relative(process.cwd(), file.path)} (${file.replacements} replacements)`);
    });
    console.log(`   ... and ${stats.modifiedFiles.length - 20} more files`);
  }

  console.log('\n═══════════════════════════════════════════');
}

/**
 * Main execution
 */
function main() {
  console.log('\n╔════════════════════════════════════════════╗');
  console.log('║   DatatechtonCRM Rebranding Script        ║');
  console.log('║   DatatechtonCRM → DatatechtonCRM                  ║');
  console.log('╚════════════════════════════════════════════╝');

  if (DRY_RUN) {
    console.log('\n🔍 Running in DRY RUN mode - no changes will be made');
  }

  // Create backup if requested
  if (CREATE_BACKUP) {
    if (!createBackup()) {
      console.log('\n⚠️  Backup failed. Continue anyway? (Ctrl+C to cancel)');
      // In production, you'd want to wait for user input here
    }
  }

  // Get all files to process
  console.log('\n🔍 Scanning files...');
  const rootDir = path.join(__dirname, '..');
  const files = getAllFiles(rootDir);
  console.log(`   Found ${files.length} files to process\n`);

  // Show replacement plan
  console.log('📋 Replacement Plan:');
  REPLACEMENTS.forEach(r => {
    console.log(`   "${r.from}" → "${r.to}" (${r.description})`);
  });
  console.log('');

  // Process all files
  console.log('🔄 Processing files...');
  files.forEach((file, index) => {
    processFile(file);
    if ((index + 1) % 10 === 0 || index === files.length - 1) {
      printProgress(index + 1, files.length);
    }
  });

  // Print summary
  printSummary();

  // Final recommendations
  console.log('\n💡 Next Steps:');
  if (DRY_RUN) {
    console.log('   1. Review the changes above');
    console.log('   2. Run without --dry-run to apply changes: node scripts/rebrand-to-datatechtoncrm.js --backup');
  } else {
    console.log('   1. ✅ Review the modified files');
    console.log('   2. ✅ Run tests: npm test');
    console.log('   3. ✅ Test locally: npm run dev');
    console.log('   4. ✅ Update environment variables in .env files');
    console.log('   5. ✅ Update Kubernetes secrets and configmaps');
    console.log('   6. ✅ Update any external references (DNS, GitHub settings, etc.)');
    console.log('   7. ✅ Commit changes: git add . && git commit -m "rebrand: Complete rebranding from DatatechtonCRM to DatatechtonCRM"');

    if (CREATE_BACKUP) {
      console.log(`\n💾 Backup available at: ${BACKUP_DIR}`);
      console.log('   To restore: copy contents back to project root');
    }
  }

  console.log('\n✨ Rebranding script completed!\n');

  // Exit code based on errors
  process.exit(stats.errors.length > 0 ? 1 : 0);
}

// Run the script
if (require.main === module) {
  main();
}

module.exports = { main, REPLACEMENTS };
