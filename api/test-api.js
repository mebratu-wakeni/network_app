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
 *   - User status toggle (admin only)
 *   - User permissions (get roles and rules)
 *   - User search
 *   - Profile management (update profile, change password)
 *   - Avatar management (remove avatar, upload manual test required)
 *   - Role management (assign, remove)
 *   - Rule management (assign, remove)
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
  
  logTest('POST /api/auth/login - Login with newly registered user')
  if (!testUsername) {
    log('⚠ Cannot test login - no user was registered', 'yellow')
    failed++
  } else {
    result = curl('POST', '/auth/login', {
      body: {
        username: testUsername,
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
  }
  
  logTest('POST /api/auth/login - Invalid credentials (should fail)')
  if (!testUsername) {
    log('⚠ Skipping invalid login test - no test user', 'yellow')
    failed++
  } else {
    result = curl('POST', '/auth/login', {
      body: {
        username: testUsername,
        password: 'wrongpassword'
      }
    })
    if (testResult(result, false) && assert(result.data.ok === false, 'Invalid login should fail')) {
      passed++
    } else {
      failed++
    }
  }
  
  // ============================================
  // User Management
  // ============================================
  logSection('User Management')
  
  if (!authToken) {
    log('⚠ Skipping authenticated tests - no token available', 'yellow')
    failed++
  } else if (!testUserId) {
    log('⚠ Skipping user management tests - no test user ID available', 'yellow')
    failed++
  } else {
    logTest('GET /api/users/:id - Get user profile')
    result = curl('GET', `/users/${testUserId}`, { token: authToken })
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
    result = curl('PUT', `/users/${testUserId}`, {
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
  // Role Management (Requires Admin)
  // ============================================
  logSection('Role Management (Admin Only)')
  
  if (!authToken) {
    log('⚠ Skipping role management tests - no token available', 'yellow')
    failed++
  } else {
    // Try to test role assignment - these will fail if user is not admin, which is expected
    logTest('POST /api/users/:id/roles - Assign role by name (may fail if not admin)')
    result = curl('POST', `/users/${testUserId || 2}/roles`, {
      token: authToken,
      body: {
        roleName: 'viewer'
      }
    })
    // This test will pass if user is admin, or if it correctly returns 403 for non-admin
    if (result.success) {
      if (result.data.ok === true) {
        log('✓ User has admin privileges', 'green')
        passed++
      } else if (result.data.error && result.data.error.includes('Forbidden')) {
        log('✓ Correctly requires admin role (403 Forbidden)', 'green')
        passed++
      } else {
        log('⚠ Unexpected response', 'yellow')
        console.log(JSON.stringify(result.data, null, 2))
        failed++
      }
    } else {
      failed++
    }
    
    // Skip remaining role tests if user doesn't have admin
    if (result.data?.ok === true) {
      logTest('POST /api/users/:id/roles - Assign role by ID')
      result = curl('POST', `/users/${testUserId || 2}/roles`, {
        token: authToken,
        body: {
          roleId: 5
        }
      })
      if (testResult(result)) {
        passed++
      } else {
        failed++
      }
      
      logTest('POST /api/users/:id/roles - Invalid role (should fail)')
      result = curl('POST', `/users/${testUserId || 2}/roles`, {
        token: authToken,
        body: {
          roleName: 'nonexistent_role'
        }
      })
      if (testResult(result, false)) {
        passed++
      } else {
        failed++
      }
      
      logTest('DELETE /api/users/:id/roles - Remove role by name')
      result = curl('DELETE', `/users/${testUserId || 2}/roles`, {
        token: authToken,
        body: {
          roleName: 'viewer'
        }
      })
      if (testResult(result)) {
        passed++
      } else {
        failed++
      }
    } else {
      log('⚠ Skipping remaining role tests - user does not have admin role', 'yellow')
      // Don't count as failed - this is expected if user is not admin
    }
  }
  
  // ============================================
  // Rule Management (Admin Only)
  // ============================================
  logSection('Rule Management (Admin Only)')
  
  if (!authToken) {
    log('⚠ Skipping rule management tests - no token available', 'yellow')
    failed++
  } else {
    logTest('POST /api/users/:id/rules - Assign rule by key (may fail if not admin)')
    result = curl('POST', `/users/${testUserId || 2}/rules`, {
      token: authToken,
      body: {
        ruleKey: 'products.read'
      }
    })
    if (result.success) {
      if (result.data.ok === true) {
        log('✓ User has admin privileges - rule assigned', 'green')
        passed++
      } else if (result.data.error && result.data.error.includes('Forbidden')) {
        log('✓ Correctly requires admin role (403 Forbidden)', 'green')
        passed++
      } else {
        log('⚠ Unexpected response', 'yellow')
        console.log(JSON.stringify(result.data, null, 2))
        failed++
      }
    } else {
      failed++
    }
    
    // Only test rule removal if user has admin and rule was assigned
    if (result.data?.ok === true && result.data?.assigned === true) {
      logTest('DELETE /api/users/:id/rules - Remove rule by key')
      result = curl('DELETE', `/users/${testUserId || 2}/rules`, {
        token: authToken,
        body: {
          ruleKey: 'products.read'
        }
      })
      if (testResult(result)) {
        passed++
      } else {
        failed++
      }
    }
  }
  
  // ============================================
  // User Status Toggle (Admin Only)
  // ============================================
  logSection('User Status Toggle (Admin Only)')
  
  if (!authToken) {
    log('⚠ Skipping status toggle tests - no token available', 'yellow')
    failed++
  } else {
    logTest('PATCH /api/users/:id/toggle-status - Toggle user status (may fail if not admin)')
    result = curl('PATCH', `/users/${testUserId || 2}/toggle-status`, {
      token: authToken
    })
    if (result.success) {
      if (result.data.ok === true) {
        log('✓ User has admin privileges - status toggled', 'green')
        passed++
        
        // Toggle back to original state
        logTest('PATCH /api/users/:id/toggle-status - Toggle status back')
        const toggleBackResult = curl('PATCH', `/users/${testUserId || 2}/toggle-status`, {
          token: authToken
        })
        if (testResult(toggleBackResult)) {
          passed++
        } else {
          failed++
        }
      } else if (result.data.error && result.data.error.includes('Forbidden')) {
        log('✓ Correctly requires admin role (403 Forbidden)', 'green')
        passed++
      } else {
        log('⚠ Unexpected response', 'yellow')
        console.log(JSON.stringify(result.data, null, 2))
        failed++
      }
    } else {
      failed++
    }
  }
  
  // ============================================
  // User Permissions
  // ============================================
  logSection('User Permissions')
  
  if (!authToken) {
    log('⚠ Skipping permissions tests - no token available', 'yellow')
    failed++
  } else if (!testUserId) {
    log('⚠ Skipping permissions tests - no test user ID available', 'yellow')
    failed++
  } else {
    logTest('GET /api/users/:id/permissions - Get user permissions')
    result = curl('GET', `/users/${testUserId}/permissions`, { token: authToken })
    if (testResult(result) && assert(result.data.roles, 'Should return roles object')) {
      if (assert(result.data.directlyAssignedRules, 'Should return directlyAssignedRules array')) {
        log('✓ Response structure correct', 'green')
        passed++
      } else {
        failed++
      }
    } else {
      failed++
    }
  }
  
  // ============================================
  // User Search
  // ============================================
  logSection('User Search')
  
  if (!authToken) {
    log('⚠ Skipping search tests - no token available', 'yellow')
    failed++
  } else {
    logTest('POST /api/users/search - Search users')
    result = curl('POST', '/users/search', {
      token: authToken,
      body: {
        searchQuery: 'test',
        tableConfig: {
          limit: 10,
          offset: 0,
          sortBy: 'username',
          orderBy: 'asc'
        }
      }
    })
    if (testResult(result) && assert(result.data.users, 'Should return users array')) {
      passed++
    } else {
      failed++
    }
    
    logTest('POST /api/users/search - Search with empty query')
    result = curl('POST', '/users/search', {
      token: authToken,
      body: {
        searchQuery: '',
        tableConfig: {
          limit: 5,
          offset: 0
        }
      }
    })
    if (testResult(result) && assert(result.data.total >= 0, 'Should return total count')) {
      passed++
    } else {
      failed++
    }
  }
  
  // ============================================
  // Profile Management
  // ============================================
  logSection('Profile Management')
  
  if (!authToken) {
    log('⚠ Skipping profile tests - no token available', 'yellow')
    failed++
  } else {
    logTest('PATCH /api/users/profile - Update own profile')
    result = curl('PATCH', '/users/profile', {
      token: authToken,
      body: {
        displayName: 'Updated Profile Name',
        email: `test${Date.now()}@example.com`
      }
    })
    if (testResult(result) && assert(result.data.user, 'Should return updated user')) {
      passed++
    } else {
      failed++
    }
    
    logTest('POST /api/users/change-password - Change password')
    result = curl('POST', '/users/change-password', {
      token: authToken,
      body: {
        currentPassword: 'password123',
        newPassword: 'newpassword123',
        confirmPassword: 'newpassword123'
      }
    })
    if (testResult(result) && assert(result.data.ok === true, 'Should change password')) {
      passed++
      // Update password back for subsequent tests
      logTest('POST /api/users/change-password - Change password back')
      const changeBackResult = curl('POST', '/users/change-password', {
        token: authToken,
        body: {
          currentPassword: 'newpassword123',
          newPassword: 'password123',
          confirmPassword: 'password123'
        }
      })
      if (testResult(changeBackResult)) {
        passed++
      } else {
        failed++
      }
    } else {
      failed++
    }
    
    logTest('POST /api/users/change-password - Wrong current password (should fail)')
    result = curl('POST', '/users/change-password', {
      token: authToken,
      body: {
        currentPassword: 'wrongpassword',
        newPassword: 'newpassword123',
        confirmPassword: 'newpassword123'
      }
    })
    if (testResult(result, false) && assert(result.data.error, 'Should fail with wrong password')) {
      passed++
    } else {
      failed++
    }
    
    logTest('POST /api/users/change-password - Passwords don\'t match (should fail)')
    result = curl('POST', '/users/change-password', {
      token: authToken,
      body: {
        currentPassword: 'password123',
        newPassword: 'newpassword123',
        confirmPassword: 'differentpassword'
      }
    })
    if (testResult(result, false)) {
      passed++
    } else {
      failed++
    }
  }
  
  // ============================================
  // Avatar Management
  // ============================================
  logSection('Avatar Management')
  
  if (!authToken) {
    log('⚠ Skipping avatar tests - no token available', 'yellow')
    failed++
  } else {
    logTest('DELETE /api/users/avatar - Remove avatar')
    result = curl('DELETE', '/users/avatar', { token: authToken })
    if (testResult(result) && assert(result.data.ok === true, 'Should remove avatar')) {
      if (assert(result.data.user.avatar_key === null, 'Avatar key should be null')) {
        passed++
      } else {
        failed++
      }
    } else {
      failed++
    }
    
    logTest('POST /api/users/avatar - Upload avatar (skipped - requires file upload)')
    log('⚠ Avatar upload test skipped - requires multipart/form-data file upload', 'yellow')
    log('   To test manually, use: curl -X POST http://localhost:4000/api/users/avatar \\', 'yellow')
    log('     -H "Authorization: Bearer $TOKEN" \\', 'yellow')
    log('     -F "avatar=@/path/to/image.jpg"', 'yellow')
    log('   Then test removal with: curl -X DELETE http://localhost:4000/api/users/avatar \\', 'yellow')
    log('     -H "Authorization: Bearer $TOKEN"', 'yellow')
    // Note: File uploads require multipart/form-data which is complex with curl in Node
    // This would require a more sophisticated approach or a real file
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


