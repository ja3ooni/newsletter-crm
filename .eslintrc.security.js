module.exports = {
  extends: ['./.eslintrc.js'],
  plugins: ['security'],
  rules: {
    // Security-specific rules
    'security/detect-unsafe-regex': 'error',
    'security/detect-buffer-noassert': 'error',
    'security/detect-child-process': 'warn',
    'security/detect-disable-mustache-escape': 'error',
    'security/detect-eval-with-expression': 'error',
    'security/detect-no-csrf-before-method-override': 'error',
    'security/detect-non-literal-fs-filename': 'warn',
    'security/detect-non-literal-regexp': 'warn',
    'security/detect-non-literal-require': 'warn',
    'security/detect-object-injection': 'warn',
    'security/detect-possible-timing-attacks': 'warn',
    'security/detect-pseudoRandomBytes': 'error',
    'security/detect-bidi-characters': 'error',

    // Additional security rules
    'no-eval': 'error',
    'no-implied-eval': 'error',
    'no-new-func': 'error',
    'no-script-url': 'error',

    // Console logging rules (security concern in production)
    'no-console': process.env.NODE_ENV === 'production' ? 'error' : 'warn',

    // Crypto-related rules
    'no-restricted-globals': [
      'error',
      {
        name: 'Math.random',
        message: 'Use crypto.randomBytes() for cryptographic purposes',
      },
    ],

    // Prevent dangerous patterns
    'no-restricted-syntax': [
      'error',
      {
        selector:
          "CallExpression[callee.object.name='crypto'][callee.property.name='createCipherGCM']",
        message:
          'Use crypto.createCipheriv() instead of deprecated createCipherGCM()',
      },
      {
        selector:
          "CallExpression[callee.object.name='crypto'][callee.property.name='createDecipherGCM']",
        message:
          'Use crypto.createDecipheriv() instead of deprecated createDecipherGCM()',
      },
      {
        selector:
          "CallExpression[callee.object.name='crypto'][callee.property.name='createCipher']",
        message: 'Use crypto.createCipheriv() for better security',
      },
      {
        selector:
          "CallExpression[callee.object.name='crypto'][callee.property.name='createDecipher']",
        message: 'Use crypto.createDecipheriv() for better security',
      },
    ],
  },

  overrides: [
    {
      files: ['**/*.test.ts', '**/*.test.js', '**/tests/**/*'],
      rules: {
        // Relax some security rules for test files
        'security/detect-non-literal-fs-filename': 'off',
        'security/detect-child-process': 'off',
        'no-console': 'off',
      },
    },
    {
      files: ['scripts/**/*'],
      rules: {
        // Allow some patterns in build scripts
        'security/detect-child-process': 'off',
        'security/detect-non-literal-fs-filename': 'off',
        'no-console': 'off',
      },
    },
  ],
};
