# Security Scan Report

**Generated:** 2025-10-30T19:59:36.000Z
**Status:** ❌ ISSUES FOUND

## Summary

- **Files Scanned:** 23
- **Total Vulnerabilities:** 297
- **High Severity:** 4
- **Medium Severity:** 94
- **Low Severity:** 199

## Findings

### HIGH Severity (4)

- **scripts\security-scan.js:19** - Use of eval() can lead to code injection vulnerabilities
  `eval(`

- **scripts\security-scan.js:19** - Use of eval() can lead to code injection vulnerabilities
  `eval(`

- **security-scan.js:254** - Use of eval() can lead to code injection vulnerabilities
  `eval(`

- **.env:0** - Sensitive file detected in repository
  `.env`

### MEDIUM Severity (94)

- **code-generators\generate-service.ts:104** - Potential hardcoded secrets detected
  `token`

- **code-generators\generate-service.ts:104** - Potential hardcoded secrets detected
  `token`

- **code-generators\generate-service.ts:173** - Potential hardcoded secrets detected
  `key`

- **debug-tools.ts:179** - Potential hardcoded secrets detected
  `key`

- **debug-tools.ts:179** - Potential hardcoded secrets detected
  `key`

- **debug-tools.ts:179** - Potential hardcoded secrets detected
  `key`

- **debug-tools.ts:179** - Potential hardcoded secrets detected
  `key`

- **debug-tools.ts:179** - Potential hardcoded secrets detected
  `key`

- **dev-onboarding.ts:269** - Potential hardcoded secrets detected
  `password`

- **dev-onboarding.ts:270** - Potential hardcoded secrets detected
  `PASSWORD`

- **dev-onboarding.ts:269** - Potential hardcoded secrets detected
  `password`

- **dev-onboarding.ts:270** - Potential hardcoded secrets detected
  `PASSWORD`

- **dev-onboarding.ts:269** - Potential hardcoded secrets detected
  `password`

- **dev-onboarding.ts:279** - Potential hardcoded secrets detected
  `SECRET`

- **dev-onboarding.ts:279** - Potential hardcoded secrets detected
  `secret`

- **dev-onboarding.ts:270** - Potential hardcoded secrets detected
  `PASSWORD`

- **dev-onboarding.ts:270** - Potential hardcoded secrets detected
  `PASSWORD`

- **dev-onboarding.ts:508** - Potential hardcoded secrets detected
  `key`

- **dev-utilities.ts:43** - Potential hardcoded secrets detected
  `Secret`

- **dev-utilities.ts:44** - Potential hardcoded secrets detected
  `secret`

- **dev-utilities.ts:44** - Potential hardcoded secrets detected
  `secret`

- **dev-utilities.ts:47** - Potential hardcoded secrets detected
  `SECRET`

- **dev-utilities.ts:47** - Potential hardcoded secrets detected
  `SECRET`

- **dev-utilities.ts:49** - Potential hardcoded secrets detected
  `KEY`

- **dev-utilities.ts:47** - Potential hardcoded secrets detected
  `SECRET`

- **dev-utilities.ts:49** - Potential hardcoded secrets detected
  `KEY`

- **dev-utilities.ts:47** - Potential hardcoded secrets detected
  `SECRET`

- **dev-utilities.ts:44** - Potential hardcoded secrets detected
  `secret`

- **dev-utilities.ts:44** - Potential hardcoded secrets detected
  `secret`

- **dev-utilities.ts:58** - Potential hardcoded secrets detected
  `key`

- **dev-utilities.ts:58** - Potential hardcoded secrets detected
  `key`

- **dev-utilities.ts:44** - Potential hardcoded secrets detected
  `secret`

- **dev-utilities.ts:44** - Potential hardcoded secrets detected
  `secret`

- **dev-utilities.ts:58** - Potential hardcoded secrets detected
  `key`

- **dev-utilities.ts:58** - Potential hardcoded secrets detected
  `key`

- **dev-utilities.ts:58** - Potential hardcoded secrets detected
  `key`

- **dev-utilities.ts:58** - Potential hardcoded secrets detected
  `key`

- **dev-utilities.ts:44** - Potential hardcoded secrets detected
  `secret`

- **dev-utilities.ts:47** - Potential hardcoded secrets detected
  `SECRET`

- **dev-utilities.ts:49** - Potential hardcoded secrets detected
  `KEY`

- **dev-utilities.ts:47** - Potential hardcoded secrets detected
  `SECRET`

- **dev-utilities.ts:49** - Potential hardcoded secrets detected
  `KEY`

- **dev-utilities.ts:49** - Potential hardcoded secrets detected
  `KEY`

- **dev-utilities.ts:47** - Potential hardcoded secrets detected
  `SECRET`

- **dev-utilities.ts:49** - Potential hardcoded secrets detected
  `KEY`

- **dev-utilities.ts:47** - Potential hardcoded secrets detected
  `SECRET`

- **dev-utilities.ts:49** - Potential hardcoded secrets detected
  `KEY`

- **dev-utilities.ts:44** - Potential hardcoded secrets detected
  `secret`

- **dev-utilities.ts:43** - Potential hardcoded secrets detected
  `Secret`

- **dev-utilities.ts:47** - Potential hardcoded secrets detected
  `SECRET`

- **dev-utilities.ts:43** - Potential hardcoded secrets detected
  `Secret`

- **dev-utilities.ts:43** - Potential hardcoded secrets detected
  `Secret`

- **dev-utilities.ts:47** - Potential hardcoded secrets detected
  `SECRET`

- **dev-utilities.ts:47** - Potential hardcoded secrets detected
  `SECRET`

- **dev-utilities.ts:47** - Potential hardcoded secrets detected
  `SECRET`

- **dev-utilities.ts:44** - Potential hardcoded secrets detected
  `secret`

- **dev-utilities.ts:44** - Potential hardcoded secrets detected
  `secret`

- **dev-utilities.ts:44** - Potential hardcoded secrets detected
  `secret`

- **dev-utilities.ts:44** - Potential hardcoded secrets detected
  `secret`

- **dev-utilities.ts:43** - Potential hardcoded secrets detected
  `Secret`

- **scripts\generate-report.js:132** - Potential hardcoded secrets detected
  `key`

- **scripts\generate-report.js:612** - Potential hardcoded secrets detected
  `Key`

- **scripts\quality-gates.js:450** - Potential hardcoded secrets detected
  `key`

- **scripts\security-scan.js:25** - Direct use of exec() should be carefully reviewed for command injection
  `exec(`

- **scripts\security-scan.js:44** - Potential hardcoded secrets detected
  `password`

- **scripts\security-scan.js:44** - Potential hardcoded secrets detected
  `secret`

- **scripts\security-scan.js:44** - Potential hardcoded secrets detected
  `key`

- **scripts\security-scan.js:44** - Potential hardcoded secrets detected
  `token`

- **scripts\security-scan.js:44** - Potential hardcoded secrets detected
  `secret`

- **scripts\security-scan.js:44** - Potential hardcoded secrets detected
  `secret`

- **scripts\security-scan.js:44** - Potential hardcoded secrets detected
  `key`

- **scripts\security-scan.js:44** - Potential hardcoded secrets detected
  `key`

- **scripts\security-scan.js:44** - Potential hardcoded secrets detected
  `key`

- **security-scan.js:242** - Potential hardcoded secrets detected
  `password`

- **security-scan.js:242** - Potential hardcoded secrets detected
  `secret`

- **security-scan.js:242** - Potential hardcoded secrets detected
  `key`

- **security-scan.js:242** - Potential hardcoded secrets detected
  `token`

- **security-scan.js:242** - Potential hardcoded secrets detected
  `secret`

- **security-scan.js:242** - Potential hardcoded secrets detected
  `key`

- **security-scan.js:242** - Potential hardcoded secrets detected
  `key`

- **security-scan.js:242** - Potential hardcoded secrets detected
  `password`

- **security-scan.js:242** - Potential hardcoded secrets detected
  `password`

- **security-scan.js:242** - Potential hardcoded secrets detected
  `secret`

- **security-scan.js:242** - Potential hardcoded secrets detected
  `secret`

- **security-scan.js:242** - Potential hardcoded secrets detected
  `secret`

- **security-scan.js:242** - Potential hardcoded secrets detected
  `secret`

- **security-scan.js:242** - Potential hardcoded secrets detected
  `key`

- **security-scan.js:242** - Potential hardcoded secrets detected
  `secret`

- **security-scan.js:242** - Potential hardcoded secrets detected
  `key`

- **security-scan.js:242** - Potential hardcoded secrets detected
  `secret`

- **shared\ErrorHandler.ts:10** - Potential hardcoded secrets detected
  `key`

- **shared\Logger.ts:30** - Potential hardcoded secrets detected
  `key`

- **shared\Logger.ts:30** - Potential hardcoded secrets detected
  `key`

- **shared\Logger.ts:30** - Potential hardcoded secrets detected
  `key`

### LOW Severity (199)

- **dev-utilities.ts:116** - Dynamic environment variable access should be validated
  `process.env[varName]`

- **dev-utilities.ts:116** - Dynamic environment variable access should be validated
  `process.env[varName]`

- **run-integration-tests.js:18** - Console.log statements should be replaced with proper logging
  `console.log(`

- **run-integration-tests.js:18** - Console.log statements should be replaced with proper logging
  `console.log(`

- **run-integration-tests.js:18** - Console.log statements should be replaced with proper logging
  `console.log(`

- **run-integration-tests.js:18** - Console.log statements should be replaced with proper logging
  `console.log(`

- **run-integration-tests.js:18** - Console.log statements should be replaced with proper logging
  `console.log(`

- **scripts\aggregate-test-results.js:13** - Console.log statements should be replaced with proper logging
  `console.log(`

- **scripts\aggregate-test-results.js:13** - Console.log statements should be replaced with proper logging
  `console.log(`

- **scripts\aggregate-test-results.js:13** - Console.log statements should be replaced with proper logging
  `console.log(`

- **scripts\aggregate-test-results.js:13** - Console.log statements should be replaced with proper logging
  `console.log(`

- **scripts\aggregate-test-results.js:13** - Console.log statements should be replaced with proper logging
  `console.log(`

- **scripts\aggregate-test-results.js:13** - Console.log statements should be replaced with proper logging
  `console.log(`

- **scripts\aggregate-test-results.js:13** - Console.log statements should be replaced with proper logging
  `console.log(`

- **scripts\aggregate-test-results.js:13** - Console.log statements should be replaced with proper logging
  `console.log(`

- **scripts\aggregate-test-results.js:13** - Console.log statements should be replaced with proper logging
  `console.log(`

- **scripts\aggregate-test-results.js:13** - Console.log statements should be replaced with proper logging
  `console.log(`

- **scripts\aggregate-test-results.js:13** - Console.log statements should be replaced with proper logging
  `console.log(`

- **scripts\aggregate-test-results.js:13** - Console.log statements should be replaced with proper logging
  `console.log(`

- **scripts\aggregate-test-results.js:13** - Console.log statements should be replaced with proper logging
  `console.log(`

- **scripts\aggregate-test-results.js:13** - Console.log statements should be replaced with proper logging
  `console.log(`

- **scripts\aggregate-test-results.js:13** - Console.log statements should be replaced with proper logging
  `console.log(`

- **scripts\aggregate-test-results.js:13** - Console.log statements should be replaced with proper logging
  `console.log(`

- **scripts\aggregate-test-results.js:13** - Console.log statements should be replaced with proper logging
  `console.log(`

- **scripts\aggregate-test-results.js:13** - Console.log statements should be replaced with proper logging
  `console.log(`

- **scripts\aggregate-test-results.js:13** - Console.log statements should be replaced with proper logging
  `console.log(`

- **scripts\aggregate-test-results.js:13** - Console.log statements should be replaced with proper logging
  `console.log(`

- **scripts\aggregate-test-results.js:13** - Console.log statements should be replaced with proper logging
  `console.log(`

- **scripts\aggregate-test-results.js:13** - Console.log statements should be replaced with proper logging
  `console.log(`

- **scripts\aggregate-test-results.js:13** - Console.log statements should be replaced with proper logging
  `console.log(`

- **scripts\analyze-performance.js:35** - Console.log statements should be replaced with proper logging
  `console.log(`

- **scripts\analyze-performance.js:35** - Console.log statements should be replaced with proper logging
  `console.log(`

- **scripts\analyze-performance.js:35** - Console.log statements should be replaced with proper logging
  `console.log(`

- **scripts\analyze-performance.js:35** - Console.log statements should be replaced with proper logging
  `console.log(`

- **scripts\analyze-performance.js:35** - Console.log statements should be replaced with proper logging
  `console.log(`

- **scripts\analyze-performance.js:35** - Console.log statements should be replaced with proper logging
  `console.log(`

- **scripts\analyze-performance.js:35** - Console.log statements should be replaced with proper logging
  `console.log(`

- **scripts\analyze-performance.js:35** - Console.log statements should be replaced with proper logging
  `console.log(`

- **scripts\analyze-performance.js:35** - Console.log statements should be replaced with proper logging
  `console.log(`

- **scripts\analyze-performance.js:35** - Console.log statements should be replaced with proper logging
  `console.log(`

- **scripts\analyze-performance.js:35** - Console.log statements should be replaced with proper logging
  `console.log(`

- **scripts\analyze-performance.js:35** - Console.log statements should be replaced with proper logging
  `console.log(`

- **scripts\analyze-performance.js:35** - Console.log statements should be replaced with proper logging
  `console.log(`

- **scripts\analyze-performance.js:35** - Console.log statements should be replaced with proper logging
  `console.log(`

- **scripts\analyze-performance.js:35** - Console.log statements should be replaced with proper logging
  `console.log(`

- **scripts\analyze-performance.js:35** - Console.log statements should be replaced with proper logging
  `console.log(`

- **scripts\analyze-performance.js:35** - Console.log statements should be replaced with proper logging
  `console.log(`

- **scripts\analyze-performance.js:35** - Console.log statements should be replaced with proper logging
  `console.log(`

- **scripts\analyze-performance.js:35** - Console.log statements should be replaced with proper logging
  `console.log(`

- **scripts\analyze-performance.js:35** - Console.log statements should be replaced with proper logging
  `console.log(`

- **scripts\generate-report.js:14** - Console.log statements should be replaced with proper logging
  `console.log(`

- **scripts\generate-report.js:14** - Console.log statements should be replaced with proper logging
  `console.log(`

- **scripts\generate-report.js:14** - Console.log statements should be replaced with proper logging
  `console.log(`

- **scripts\generate-report.js:14** - Console.log statements should be replaced with proper logging
  `console.log(`

- **scripts\generate-report.js:14** - Console.log statements should be replaced with proper logging
  `console.log(`

- **scripts\generate-report.js:14** - Console.log statements should be replaced with proper logging
  `console.log(`

- **scripts\generate-report.js:14** - Console.log statements should be replaced with proper logging
  `console.log(`

- **scripts\generate-report.js:14** - Console.log statements should be replaced with proper logging
  `console.log(`

- **scripts\generate-report.js:14** - Console.log statements should be replaced with proper logging
  `console.log(`

- **scripts\generate-report.js:14** - Console.log statements should be replaced with proper logging
  `console.log(`

- **scripts\generate-report.js:14** - Console.log statements should be replaced with proper logging
  `console.log(`

- **scripts\generate-report.js:14** - Console.log statements should be replaced with proper logging
  `console.log(`

- **scripts\generate-report.js:14** - Console.log statements should be replaced with proper logging
  `console.log(`

- **scripts\generate-report.js:14** - Console.log statements should be replaced with proper logging
  `console.log(`

- **scripts\generate-report.js:14** - Console.log statements should be replaced with proper logging
  `console.log(`

- **scripts\generate-report.js:14** - Console.log statements should be replaced with proper logging
  `console.log(`

- **scripts\generate-report.js:14** - Console.log statements should be replaced with proper logging
  `console.log(`

- **scripts\generate-report.js:14** - Console.log statements should be replaced with proper logging
  `console.log(`

- **scripts\generate-report.js:14** - Console.log statements should be replaced with proper logging
  `console.log(`

- **scripts\generate-report.js:14** - Console.log statements should be replaced with proper logging
  `console.log(`

- **scripts\generate-report.js:14** - Console.log statements should be replaced with proper logging
  `console.log(`

- **scripts\generate-report.js:14** - Console.log statements should be replaced with proper logging
  `console.log(`

- **scripts\generate-report.js:14** - Console.log statements should be replaced with proper logging
  `console.log(`

- **scripts\generate-report.js:14** - Console.log statements should be replaced with proper logging
  `console.log(`

- **scripts\generate-report.js:14** - Console.log statements should be replaced with proper logging
  `console.log(`

- **scripts\quality-gates.js:36** - Console.log statements should be replaced with proper logging
  `console.log(`

- **scripts\quality-gates.js:36** - Console.log statements should be replaced with proper logging
  `console.log(`

- **scripts\quality-gates.js:36** - Console.log statements should be replaced with proper logging
  `console.log(`

- **scripts\quality-gates.js:36** - Console.log statements should be replaced with proper logging
  `console.log(`

- **scripts\quality-gates.js:36** - Console.log statements should be replaced with proper logging
  `console.log(`

- **scripts\quality-gates.js:36** - Console.log statements should be replaced with proper logging
  `console.log(`

- **scripts\quality-gates.js:36** - Console.log statements should be replaced with proper logging
  `console.log(`

- **scripts\quality-gates.js:36** - Console.log statements should be replaced with proper logging
  `console.log(`

- **scripts\quality-gates.js:36** - Console.log statements should be replaced with proper logging
  `console.log(`

- **scripts\quality-gates.js:36** - Console.log statements should be replaced with proper logging
  `console.log(`

- **scripts\quality-gates.js:36** - Console.log statements should be replaced with proper logging
  `console.log(`

- **scripts\quality-gates.js:36** - Console.log statements should be replaced with proper logging
  `console.log(`

- **scripts\quality-gates.js:36** - Console.log statements should be replaced with proper logging
  `console.log(`

- **scripts\quality-gates.js:36** - Console.log statements should be replaced with proper logging
  `console.log(`

- **scripts\quality-gates.js:36** - Console.log statements should be replaced with proper logging
  `console.log(`

- **scripts\quality-gates.js:36** - Console.log statements should be replaced with proper logging
  `console.log(`

- **scripts\quality-gates.js:36** - Console.log statements should be replaced with proper logging
  `console.log(`

- **scripts\quality-gates.js:36** - Console.log statements should be replaced with proper logging
  `console.log(`

- **scripts\quality-gates.js:36** - Console.log statements should be replaced with proper logging
  `console.log(`

- **scripts\quality-gates.js:36** - Console.log statements should be replaced with proper logging
  `console.log(`

- **scripts\quality-gates.js:36** - Console.log statements should be replaced with proper logging
  `console.log(`

- **scripts\quality-gates.js:36** - Console.log statements should be replaced with proper logging
  `console.log(`

- **scripts\quality-gates.js:36** - Console.log statements should be replaced with proper logging
  `console.log(`

- **scripts\quality-gates.js:36** - Console.log statements should be replaced with proper logging
  `console.log(`

- **scripts\quality-gates.js:36** - Console.log statements should be replaced with proper logging
  `console.log(`

- **scripts\quality-gates.js:36** - Console.log statements should be replaced with proper logging
  `console.log(`

- **scripts\quality-gates.js:36** - Console.log statements should be replaced with proper logging
  `console.log(`

- **scripts\quality-gates.js:36** - Console.log statements should be replaced with proper logging
  `console.log(`

- **scripts\quality-gates.js:36** - Console.log statements should be replaced with proper logging
  `console.log(`

- **scripts\quality-gates.js:36** - Console.log statements should be replaced with proper logging
  `console.log(`

- **scripts\quality-gates.js:36** - Console.log statements should be replaced with proper logging
  `console.log(`

- **scripts\quality-gates.js:36** - Console.log statements should be replaced with proper logging
  `console.log(`

- **scripts\quality-gates.js:36** - Console.log statements should be replaced with proper logging
  `console.log(`

- **scripts\quality-gates.js:36** - Console.log statements should be replaced with proper logging
  `console.log(`

- **scripts\quality-gates.js:36** - Console.log statements should be replaced with proper logging
  `console.log(`

- **scripts\quality-gates.js:36** - Console.log statements should be replaced with proper logging
  `console.log(`

- **scripts\quality-gates.js:36** - Console.log statements should be replaced with proper logging
  `console.log(`

- **scripts\quality-gates.js:36** - Console.log statements should be replaced with proper logging
  `console.log(`

- **scripts\security-scan.js:31** - Use of spawn() should validate inputs to prevent command injection
  `spawn(`

- **scripts\security-scan.js:70** - Console.log statements should be replaced with proper logging
  `console.log(`

- **scripts\security-scan.js:70** - Console.log statements should be replaced with proper logging
  `console.log(`

- **scripts\security-scan.js:70** - Console.log statements should be replaced with proper logging
  `console.log(`

- **scripts\security-scan.js:70** - Console.log statements should be replaced with proper logging
  `console.log(`

- **scripts\security-scan.js:70** - Console.log statements should be replaced with proper logging
  `console.log(`

- **scripts\security-scan.js:70** - Console.log statements should be replaced with proper logging
  `console.log(`

- **scripts\security-scan.js:70** - Console.log statements should be replaced with proper logging
  `console.log(`

- **scripts\security-scan.js:70** - Console.log statements should be replaced with proper logging
  `console.log(`

- **scripts\security-scan.js:70** - Console.log statements should be replaced with proper logging
  `console.log(`

- **scripts\security-scan.js:70** - Console.log statements should be replaced with proper logging
  `console.log(`

- **scripts\security-scan.js:70** - Console.log statements should be replaced with proper logging
  `console.log(`

- **scripts\security-scan.js:70** - Console.log statements should be replaced with proper logging
  `console.log(`

- **scripts\security-scan.js:70** - Console.log statements should be replaced with proper logging
  `console.log(`

- **scripts\security-scan.js:70** - Console.log statements should be replaced with proper logging
  `console.log(`

- **scripts\security-scan.js:70** - Console.log statements should be replaced with proper logging
  `console.log(`

- **scripts\security-scan.js:70** - Console.log statements should be replaced with proper logging
  `console.log(`

- **scripts\security-scan.js:70** - Console.log statements should be replaced with proper logging
  `console.log(`

- **scripts\security-scan.js:70** - Console.log statements should be replaced with proper logging
  `console.log(`

- **scripts\security-scan.js:70** - Console.log statements should be replaced with proper logging
  `console.log(`

- **scripts\test-results-processor.js:243** - Console.log statements should be replaced with proper logging
  `console.log(`

- **scripts\test-results-processor.js:243** - Console.log statements should be replaced with proper logging
  `console.log(`

- **scripts\test-results-processor.js:243** - Console.log statements should be replaced with proper logging
  `console.log(`

- **scripts\test-results-processor.js:243** - Console.log statements should be replaced with proper logging
  `console.log(`

- **scripts\test-results-processor.js:243** - Console.log statements should be replaced with proper logging
  `console.log(`

- **scripts\test-results-processor.js:243** - Console.log statements should be replaced with proper logging
  `console.log(`

- **scripts\test-results-processor.js:243** - Console.log statements should be replaced with proper logging
  `console.log(`

- **scripts\test-results-processor.js:243** - Console.log statements should be replaced with proper logging
  `console.log(`

- **scripts\test-results-processor.js:243** - Console.log statements should be replaced with proper logging
  `console.log(`

- **security-scan.js:39** - Console.log statements should be replaced with proper logging
  `console.log(`

- **security-scan.js:39** - Console.log statements should be replaced with proper logging
  `console.log(`

- **security-scan.js:39** - Console.log statements should be replaced with proper logging
  `console.log(`

- **security-scan.js:39** - Console.log statements should be replaced with proper logging
  `console.log(`

- **security-scan.js:39** - Console.log statements should be replaced with proper logging
  `console.log(`

- **security-scan.js:39** - Console.log statements should be replaced with proper logging
  `console.log(`

- **security-scan.js:39** - Console.log statements should be replaced with proper logging
  `console.log(`

- **security-scan.js:39** - Console.log statements should be replaced with proper logging
  `console.log(`

- **security-scan.js:39** - Console.log statements should be replaced with proper logging
  `console.log(`

- **security-scan.js:39** - Console.log statements should be replaced with proper logging
  `console.log(`

- **security-scan.js:39** - Console.log statements should be replaced with proper logging
  `console.log(`

- **security-scan.js:39** - Console.log statements should be replaced with proper logging
  `console.log(`

- **security-scan.js:39** - Console.log statements should be replaced with proper logging
  `console.log(`

- **security-scan.js:39** - Console.log statements should be replaced with proper logging
  `console.log(`

- **security-scan.js:39** - Console.log statements should be replaced with proper logging
  `console.log(`

- **security-scan.js:39** - Console.log statements should be replaced with proper logging
  `console.log(`

- **security-scan.js:39** - Console.log statements should be replaced with proper logging
  `console.log(`

- **security-scan.js:39** - Console.log statements should be replaced with proper logging
  `console.log(`

- **security-scan.js:39** - Console.log statements should be replaced with proper logging
  `console.log(`

- **security-scan.js:39** - Console.log statements should be replaced with proper logging
  `console.log(`

- **security-scan.js:39** - Console.log statements should be replaced with proper logging
  `console.log(`

- **security-scan.js:39** - Console.log statements should be replaced with proper logging
  `console.log(`

- **security-scan.js:39** - Console.log statements should be replaced with proper logging
  `console.log(`

- **security-scan.js:39** - Console.log statements should be replaced with proper logging
  `console.log(`

- **security-scan.js:39** - Console.log statements should be replaced with proper logging
  `console.log(`

- **security-scan.js:39** - Console.log statements should be replaced with proper logging
  `console.log(`

- **security-scan.js:39** - Console.log statements should be replaced with proper logging
  `console.log(`

- **security-scan.js:39** - Console.log statements should be replaced with proper logging
  `console.log(`

- **security-scan.js:39** - Console.log statements should be replaced with proper logging
  `console.log(`

- **security-scan.js:39** - Console.log statements should be replaced with proper logging
  `console.log(`

- **security-scan.js:39** - Console.log statements should be replaced with proper logging
  `console.log(`

- **security-scan.js:39** - Console.log statements should be replaced with proper logging
  `console.log(`

- **security-scan.js:39** - Console.log statements should be replaced with proper logging
  `console.log(`

- **security-scan.js:39** - Console.log statements should be replaced with proper logging
  `console.log(`

- **security-scan.js:39** - Console.log statements should be replaced with proper logging
  `console.log(`

- **security-scan.js:39** - Console.log statements should be replaced with proper logging
  `console.log(`

- **security-scan.js:39** - Console.log statements should be replaced with proper logging
  `console.log(`

- **shared\ErrorHandler.ts:451** - Dynamic environment variable access should be validated
  `process.env[varName]`

- **shared\Logger.ts:111** - Console.log statements should be replaced with proper logging
  `console.log(`

- **shared\Logger.ts:111** - Console.log statements should be replaced with proper logging
  `console.log(`

- **shared\Logger.ts:111** - Console.log statements should be replaced with proper logging
  `console.log(`

- **shared\Logger.ts:111** - Console.log statements should be replaced with proper logging
  `console.log(`

- **shared\Logger.ts:111** - Console.log statements should be replaced with proper logging
  `console.log(`

- **shared\Logger.ts:111** - Console.log statements should be replaced with proper logging
  `console.log(`

- **shared\Logger.ts:111** - Console.log statements should be replaced with proper logging
  `console.log(`

- **shared\Logger.ts:111** - Console.log statements should be replaced with proper logging
  `console.log(`

- **shared\Logger.ts:111** - Console.log statements should be replaced with proper logging
  `console.log(`

- **shared\Logger.ts:111** - Console.log statements should be replaced with proper logging
  `console.log(`

- **shared\PlatformService.ts:290** - Dynamic environment variable access should be validated
  `process.env[name]`

- **shared\PlatformService.ts:290** - Dynamic environment variable access should be validated
  `process.env[name]`

- **__tests__\setup\global-setup.ts:11** - Console.log statements should be replaced with proper logging
  `console.log(`

- **__tests__\setup\global-setup.ts:11** - Console.log statements should be replaced with proper logging
  `console.log(`

- **__tests__\setup\global-setup.ts:11** - Console.log statements should be replaced with proper logging
  `console.log(`

- **__tests__\setup\global-setup.ts:11** - Console.log statements should be replaced with proper logging
  `console.log(`

- **__tests__\setup\global-teardown.ts:11** - Console.log statements should be replaced with proper logging
  `console.log(`

- **__tests__\setup\global-teardown.ts:11** - Console.log statements should be replaced with proper logging
  `console.log(`

- **__tests__\setup\global-teardown.ts:11** - Console.log statements should be replaced with proper logging
  `console.log(`

## Recommendations

- Address all HIGH severity vulnerabilities immediately
- Review and fix MEDIUM severity issues
- Replace eval() usage with safer alternatives
- Run security scans regularly in CI/CD pipeline
- Keep dependencies updated and monitor for vulnerabilities
- Use environment variables for sensitive configuration
