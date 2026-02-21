module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testMatch: [
    '**/tests/**/*.spec.ts',
    '**/__tests__/**/*.spec.ts',
  ],
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      tsconfig: {
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
        module: 'commonjs',
        types: ['jest', 'node'],
      },
    }],
  },
  moduleNameMapper: {
    '^uuid$': require.resolve('uuid'),
  },
  collectCoverageFrom: ['**/src/**/*.(t|j)s'],
  coverageDirectory: './coverage',
};
