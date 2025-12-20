// Root ESLint Configuration
// Note: This configuration will be updated after installing dependencies

module.exports = [
  // Global ignores
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/.vite/**',
      '**/coverage/**',
      '.git/**',
      '*.min.js',
      'frontend/build/**'
    ],
 },
  
  // Basic JavaScript configuration
  {
    files: ['**/*.js', '**/*.cjs'],
    rules: {
      'no-console': 'warn',
      'no-unused-vars': 'warn',
      'no-undef': 'error',
    }
  }
];