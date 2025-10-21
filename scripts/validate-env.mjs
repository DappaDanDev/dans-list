#!/usr/bin/env node

/**
 * Environment Variable Validation Script
 * Validates that all required environment variables are present
 * Used in CI/CD and pre-deployment checks
 */

import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

// ANSI color codes for output
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  reset: '\x1b[0m',
};

// Define required environment variables
const requiredEnvVars = {
  development: [
    // No strict requirements for development
  ],
  production: [
    'OPENAI_API_KEY',
    'DATABASE_URL',
    'BASE_SEPOLIA_RPC',
    'PRIVATE_KEY',
    'ENVIO_API_KEY',
  ],
};

// Optional environment variables with defaults
const optionalEnvVars = {
  'PORT': '3000',
  'NODE_ENV': 'development',
  'LOG_LEVEL': 'info',
};

function validateEnvironment() {
  const env = process.env.NODE_ENV || 'development';
  const missing = [];
  const warnings = [];

  console.log(`🔍 Validating environment variables for ${colors.yellow}${env}${colors.reset} environment...\n`);

  // Check required variables
  const required = requiredEnvVars[env] || requiredEnvVars.development;
  for (const varName of required) {
    if (!process.env[varName]) {
      missing.push(varName);
    }
  }

  // Check for .env.local file
  const envLocalPath = join(process.cwd(), '.env.local');
  if (!existsSync(envLocalPath)) {
    warnings.push('.env.local file not found. Create it from .env.example');
  }

  // Check optional variables and suggest defaults
  for (const [varName, defaultValue] of Object.entries(optionalEnvVars)) {
    if (!process.env[varName]) {
      console.log(`ℹ️  ${varName} not set, will use default: ${defaultValue}`);
    }
  }

  // Report results
  if (missing.length > 0) {
    console.error(`\n${colors.red}❌ Missing required environment variables:${colors.reset}`);
    missing.forEach(varName => {
      console.error(`   - ${varName}`);
    });

    if (warnings.length > 0) {
      console.warn(`\n${colors.yellow}⚠️  Warnings:${colors.reset}`);
      warnings.forEach(warning => {
        console.warn(`   - ${warning}`);
      });
    }

    console.error(`\n${colors.red}Environment validation failed!${colors.reset}`);
    console.log('\nTo fix this:');
    console.log('1. Copy .env.example to .env.local');
    console.log('2. Fill in the missing values');
    console.log('3. Run this script again\n');

    process.exit(1);
  }

  if (warnings.length > 0) {
    console.warn(`\n${colors.yellow}⚠️  Warnings:${colors.reset}`);
    warnings.forEach(warning => {
      console.warn(`   - ${warning}`);
    });
  }

  console.log(`\n${colors.green}✅ Environment validation passed!${colors.reset}\n`);

  // Additional checks for production
  if (env === 'production') {
    console.log('Additional production checks:');

    // Check if OpenAI key looks valid (starts with sk-)
    if (process.env.OPENAI_API_KEY && !process.env.OPENAI_API_KEY.startsWith('sk-')) {
      console.warn(`${colors.yellow}⚠️  OPENAI_API_KEY doesn't start with 'sk-' - verify it's valid${colors.reset}`);
    }

    // Check if DATABASE_URL is properly formatted
    if (process.env.DATABASE_URL && !process.env.DATABASE_URL.startsWith('postgresql://')) {
      console.warn(`${colors.yellow}⚠️  DATABASE_URL should start with 'postgresql://'${colors.reset}`);
    }

    console.log(`${colors.green}✅ Production checks complete${colors.reset}\n`);
  }
}

// Run validation
try {
  validateEnvironment();
} catch (error) {
  console.error(`${colors.red}Error during validation: ${error.message}${colors.reset}`);
  process.exit(1);
}