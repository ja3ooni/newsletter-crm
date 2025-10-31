module.exports = {
  extends: ['../.eslintrc.js'],
  parserOptions: {
    project: './tsconfig.json',
    tsconfigRootDir: __dirname,
  },
  rules: {
    // Allow console.log in debug tools (will be replaced with proper logging)
    'no-console': 'off',
    // Allow any type for error handling during migration
    '@typescript-eslint/no-explicit-any': 'warn',
    // Allow require in mixed JS/TS environment
    '@typescript-eslint/no-var-requires': 'warn',
  },
  env: {
    node: true,
    es2020: true,
  },
};
