/** @type {import('ts-jest/dist/types').InitialOptionsTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jest-environment-node',
  moduleNameMapper: {
    '^@src/(.*)$': '<rootDir>/src/$1'
  }
};