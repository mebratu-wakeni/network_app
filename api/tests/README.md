# API Test Guide

## Prerequisites
- Node 20 is required for this repo.
- From repo root, run `nvm use` before running API commands.

## Structure
- `tests/unit/`: deterministic service/repository tests (mocked collaborators or in-memory DB)
- `tests/integration/`: HTTP contract tests with `supertest`
- `tests/helpers/`: shared setup utilities
- `tests/setup/`: global test environment setup

## Commands
- `npm test`: run all tests once
- `npm run test:watch`: run tests in watch mode
- `npm run test:integration`: run integration tests only
- `npm run test:coverage`: run tests with coverage report

## Conventions
- Keep business-rule tests in service-level unit files first.
- Use integration tests for request/response contracts, schema validation, and error middleware behavior.
- Prefer small deterministic fixtures over broad seeded datasets.
