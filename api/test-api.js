#!/usr/bin/env node
/**
 * API Test Script
 * Uses curl to test API endpoints
 * 
 * Usage:
 *   node test-api.js                    # Test against http://localhost:4000
 *   API_URL=http://localhost:3000 node test-api.js  # Test against custom URL
 * 
 * Requirements:
 *   - curl must be installed
 *   - API server must be running
 *   - Database must be set up with migrations and seeds
 * 
 * Tests:
 *   - Health checks
 *   - Authentication (register, login)
 *   - User management (get, update)
 *   - Role management (assign, remove)
 */

import { execSync } from 'child_process'

// Configuration
const BASE_URL = process.env.API_URL || 'http://localhost:4000'
const API_BASE = `${BASE_URL}/api`

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
}

// Helper functions
function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`)
}

function logSection(title) {
  console.log('\n' + '='.repeat(60))
  log(title, 'cyan')
  console.log('='.repeat(60))
}

function logTest(name) {
  log(`\n▶ ${name}`, 'yellow')
}

function curl(method, endpoint, options = {}) {
  const { body, headers = {}, token } = options
  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE}${endpoint}`
  
  let cmd = `curl -sS -X ${method} "${url}"`
  
  // Add headers
  const allHeaders = { ...headers }
  if (token) {
    allHeaders['Authorization'] = `Bearer ${token}`
  }
  if (body && !allHeaders['Content-Type']) {
    allHeaders['Content-Type'] = 'application/json'
  }
  
  for (const [key, value] of Object.entries(allHeaders)) {
    cmd += ` -H "${key}: ${value}"`
  }
  
  // Add body
  if (body) {
    const bodyStr = typeof body === 'string' ? body : JSON.stringify(body)
    cmd += ` -d '${bodyStr}'`
  }
  
  try {
    const output = execSync(cmd, { encoding: 'utf-8', stdio: 'pipe' })
    return { success: true, data: JSON.parse(output), raw: output }
  } catch (error) {
    try {
      const errorOutput = error.stdout || error.stderr || error.message
      const parsed = JSON.parse(errorOutput)
      return { success: false, data: parsed, raw: errorOutput }
    } catch {
      return { success: false, data: { error: errorOutput }, raw: errorOutput }
    }
  }
}

function assert(condition, message) {
  if (!condition) {
    log(`❌ FAIL: ${message}`, 'red')
    return false
  }
  return true
}

function testResult(result, expectApiSuccess = true) {
  // Check if curl executed successfully
  if (!result.success) {
    log(`✗ Curl command failed`, 'red')
    console.log(result.raw)
    return false
  }
  
  // Check API response
  const apiOk = result.data?.ok === true
  if (apiOk === expectApiSuccess) {
    log(`✓ ${expectApiSuccess ? 'Success' : 'Expected failure'}`, 'green')
    if (result.data && Object.keys(result.data).length > 0) {
      console.log(JSON.stringify(result.data, null, 2))
    }
    return true
  } else {
    log(`✗ ${expectApiSuccess ? 'Failed' : 'Unexpected success'}`, 'red')
    console.log(JSON.stringify(result.data, null, 2))
    return false
  }
}

// Test functions
let authToken = null
let testUserId = null

async function runTests() {
  logSection('API Test Suite')
  log(`Testing API at: ${BASE_URL}`, 'bright')
  
  let passed = 0
  let failed = 0
  
  // ============================================
  // Health Check
  // ============================================
  logSection('Health Checks')
  
  logTest('GET /health')
  let result = curl('GET', '/health')
  if (testResult(result) && assert(result.data.ok === true, 'Health check should return ok: true')) {
    passed++
  } else {
    failed++
  }
  
  logTest('GET /api/db-health')
  result = curl('GET', '/db-health')
  // Just log the result, don't count as pass/fail
  if (result.success && result.data) {
    log(`✓ Response received`, 'green')
    console.log(JSON.stringify(result.data, null, 2))
  } else {
    log(`⚠ No response or error`, 'yellow')
  }
  
  // ============================================
  // Authentication
  // ============================================
  logSection('Authentication')
  
  logTest('POST /api/auth/register - Register new user')
  const testUsername = `testuser_${Date.now()}`
  result = curl('POST', '/auth/register', {
    body: {
      username: testUsername,
      password: 'password123',
      display_name: 'Test User'
    }
  })
  if (testResult(result) && assert(result.data.ok === true, 'Registration should succeed')) {
    testUserId = result.data.user?.id
    passed++
  } else {
    failed++
  }
  
  logTest('POST /api/auth/register - Duplicate username (should fail)')
  result = curl('POST', '/auth/register', {
    body: {
      username: testUsername,
      password: 'password123',
      display_name: 'Test User 2'
    }
  })
  if (testResult(result, false) && assert(result.data.ok === false, 'Duplicate registration should fail')) {
    passed++
  } else {
    failed++
  }
  
  logTest('POST /api/auth/login - Login with username')
  result = curl('POST', '/auth/login', {
    body: {
      username: 'admin',
      password: 'password123'
    }
  })
  if (testResult(result) && assert(result.data.ok === true, 'Login should succeed')) {
    authToken = result.data.token
    log(`Token obtained: ${authToken.substring(0, 20)}...`, 'green')
    passed++
  } else {
    failed++
  }
  
  logTest('POST /api/auth/login - Invalid credentials (should fail)')
  result = curl('POST', '/auth/login', {
    body: {
      username: 'admin',
      password: 'wrongpassword'
    }
  })
  if (testResult(result, false) && assert(result.data.ok === false, 'Invalid login should fail')) {
    passed++
  } else {
    failed++
  }
  
  // ============================================
  // User Management
  // ============================================
  logSection('User Management')
  
  if (!authToken) {
    log('⚠ Skipping authenticated tests - no token available', 'yellow')
    failed++
  } else {
    logTest('GET /api/users/:id - Get user profile')
    result = curl('GET', '/users/2', { token: authToken })
    if (testResult(result) && assert(result.data.ok === true, 'Should get user profile')) {
      passed++
    } else {
      failed++
    }
    
    logTest('GET /api/users/:id - Invalid user (should fail)')
    result = curl('GET', '/users/99999', { token: authToken })
    if (testResult(result, false) && assert(result.data.ok === false, 'Invalid user should fail')) {
      passed++
    } else {
      failed++
    }
    
    logTest('PUT /api/users/:id - Update user profile')
    result = curl('PUT', '/users/2', {
      token: authToken,
      body: {
        display_name: 'Updated Name'
      }
    })
    if (testResult(result) && assert(result.data.ok === true, 'Should update user')) {
      passed++
    } else {
      failed++
    }
  }
  
  // ============================================
  // Role Management
  // ============================================
  logSection('Role Management')
  
  if (!authToken) {
    log('⚠ Skipping role management tests - no token available', 'yellow')
    failed++
  } else {
    logTest('POST /api/users/:id/roles - Assign role by name')
    result = curl('POST', '/users/2/roles', {
      token: authToken,
      body: {
        roleName: 'viewer'
      }
    })
    if (testResult(result) && assert(result.data.ok === true, 'Should assign role')) {
      passed++
    } else {
      failed++
    }
    
    logTest('POST /api/users/:id/roles - Assign role by ID')
    result = curl('POST', '/users/2/roles', {
      token: authToken,
      body: {
        roleId: 5
      }
    })
    if (testResult(result) && assert(result.data.ok === true, 'Should assign role by ID')) {
      passed++
    } else {
      failed++
    }
    
    logTest('POST /api/users/:id/roles - Invalid role (should fail)')
    result = curl('POST', '/users/2/roles', {
      token: authToken,
      body: {
        roleName: 'nonexistent_role'
      }
    })
    if (testResult(result, false) && assert(result.data.ok === false, 'Invalid role should fail')) {
      passed++
    } else {
      failed++
    }
    
    logTest('DELETE /api/users/:id/roles - Remove role by name')
    result = curl('DELETE', '/users/2/roles', {
      token: authToken,
      body: {
        roleName: 'viewer'
      }
    })
    if (testResult(result) && assert(result.data.ok === true, 'Should remove role')) {
      passed++
    } else {
      failed++
    }
    
    logTest('DELETE /api/users/:id/roles - Remove role by ID')
    result = curl('DELETE', '/users/2/roles', {
      token: authToken,
      body: {
        roleId: 5
      }
    })
    if (testResult(result) && assert(result.data.ok === true, 'Should remove role by ID')) {
      passed++
    } else {
      failed++
    }
    
    logTest('DELETE /api/users/:id/roles - Remove non-existent role (should return removed: false)')
    result = curl('DELETE', '/users/2/roles', {
      token: authToken,
      body: {
        roleName: 'viewer'
      }
    })
    if (testResult(result) && assert(result.data.removed === false, 'Should return removed: false')) {
      passed++
    } else {
      failed++
    }
  }
  
  // ============================================
  // Test Summary
  // ============================================
  logSection('Test Summary')
  log(`Total Tests: ${passed + failed}`, 'bright')
  log(`Passed: ${passed}`, 'green')
  log(`Failed: ${failed}`, failed > 0 ? 'red' : 'green')
  
  if (failed === 0) {
    log('\n🎉 All tests passed!', 'green')
    process.exit(0)
  } else {
    log('\n❌ Some tests failed', 'red')
    process.exit(1)
  }
}

// Run tests
runTests().catch(error => {
  log(`\n💥 Test suite error: ${error.message}`, 'red')
  console.error(error)
  process.exit(1)
})

