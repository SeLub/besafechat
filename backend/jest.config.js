module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testMatch: [
    '**/tests/**/*.spec.ts',
    '**/__tests__/**/*.spec.ts',
    '**/?(*.)+(spec|test).ts',
  ],
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  testEnvironment: 'node',
  collectCoverageFrom: ['**/src/**/*.(t|j)s'],
  coverageDirectory: './coverage',
  // Handle ESM modules - skip transforming node_modules that have ESM issues
  moduleNameMapper: {
    '^uuid$': require.resolve('uuid'),
  },
  globals: {
    'ts-jest': {
      tsconfig: {
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
        types: ['jest', 'node'],
      },
    },
  },
};
