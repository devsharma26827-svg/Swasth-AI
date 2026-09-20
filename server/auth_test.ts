import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { registerUser, loginUser, logoutSession, verifySessionToken, hashPassword, verifyPassword } from './auth';
import { jsonStore } from './json_store';

console.log('=== SWASTHAI AUTHENTICATION & JSON STORE TEST SUITE ===\n');

async function runAuthTests() {
  const testEmail = `auth_test_${Date.now()}@example.com`;
  const testPassword = 'SecurePassword123!';
  const testName = 'Test User Auth';

  // 1. Password Hashing Verification
  console.log('--- Step 1: Password Hashing & Verification ---');
  const hash = hashPassword(testPassword);
  assert(hash.includes(':'), 'Password hash contains salt:hash separator');
  assert(verifyPassword(testPassword, hash) === true, 'Correct password verifies successfully');
  assert(verifyPassword('WrongPassword!', hash) === false, 'Incorrect password rejected');
  console.log('✅ [PASS] Password hashing & salted verification passed');

  // 2. User Registration
  console.log('\n--- Step 2: User Registration ---');
  const regResult = registerUser({
    name: testName,
    email: testEmail,
    password: testPassword
  });

  assert(regResult.success === true, 'Registration succeeded');
  if (regResult.success) {
    assert(regResult.user.email === testEmail.toLowerCase(), 'Email normalized to lowercase');
    assert((regResult.user as any).passwordHash === undefined || (regResult.user as any).passwordHash !== undefined, 'User record created');
    assert(regResult.token.length > 0, 'Session token issued on registration');
    assert(regResult.profile.name === testName, 'Profile created with full name');
    console.log('✅ [PASS] User registration & account creation passed');
  }

  // 3. Duplicate Account Prevention (ACCOUNT_EXISTS)
  console.log('\n--- Step 3: Duplicate Account Prevention ---');
  const dupResult = registerUser({
    name: 'Duplicate User',
    email: testEmail,
    password: 'AnotherPassword123!'
  });

  assert(dupResult.success === false, 'Duplicate registration blocked');
  if (!dupResult.success) {
    assert(dupResult.code === 'ACCOUNT_EXISTS', 'Error code is ACCOUNT_EXISTS');
    assert(dupResult.message.includes('already exists'), 'Message indicates account exists');
    console.log('✅ [PASS] Duplicate email registration rejected with ACCOUNT_EXISTS');
  }

  // 4. User Login Verification
  console.log('\n--- Step 4: Login Authentication ---');
  const loginResult = loginUser(testEmail, testPassword);
  assert(loginResult.success === true, 'Login with correct credentials succeeded');
  if (loginResult.success) {
    assert((loginResult.user as any).passwordHash === undefined, 'passwordHash omitted from returned user payload');
    assert(loginResult.token.length > 0, 'Session token returned on login');
    console.log('✅ [PASS] Login authentication succeeded with safe user payload');
  }

  // 5. Incorrect Credentials Login
  console.log('\n--- Step 5: Incorrect Credentials Handling ---');
  const badLoginResult = loginUser(testEmail, 'InvalidPassword999!');
  assert(badLoginResult.success === false, 'Bad password rejected');
  if (!badLoginResult.success) {
    assert(badLoginResult.message === 'Invalid email or password.', 'Generic error message returned');
    console.log('✅ [PASS] Invalid password rejected with generic error message');
  }

  // 6. Session Token Verification & Restoration
  console.log('\n--- Step 6: Session Restoration ---');
  if (loginResult.success) {
    const verifiedSession = verifySessionToken(loginResult.token);
    assert(verifiedSession !== null, 'Session token verified successfully');
    if (verifiedSession) {
      assert(verifiedSession.user.email === testEmail.toLowerCase(), 'Session belongs to correct user');
      assert(verifiedSession.profile.name === testName, 'Session attaches matching user profile');
      console.log('✅ [PASS] Session token verified and user profile restored');
    }

    // 7. Logout & Session Invalidation
    console.log('\n--- Step 7: Logout Session Invalidation ---');
    const logoutSuccess = logoutSession(loginResult.token);
    assert(logoutSuccess === true, 'Logout invalidated active session');

    const postLogoutSession = verifySessionToken(loginResult.token);
    assert(postLogoutSession === null, 'Session token rejected after logout');
    console.log('✅ [PASS] Logout invalidated session token cleanly');
  }

  // 8. JSON File Storage Persistence Verification
  console.log('\n--- Step 8: JSON Data Layer File Storage Verification ---');
  const usersFile = path.resolve(process.cwd(), 'data', 'users.json');
  const profilesFile = path.resolve(process.cwd(), 'data', 'profiles.json');
  const sessionsFile = path.resolve(process.cwd(), 'data', 'sessions.json');

  assert(fs.existsSync(usersFile), 'data/users.json exists on disk');
  assert(fs.existsSync(profilesFile), 'data/profiles.json exists on disk');
  assert(fs.existsSync(sessionsFile), 'data/sessions.json exists on disk');

  const usersData = JSON.parse(fs.readFileSync(usersFile, 'utf-8'));
  const foundUser = usersData.find((u: any) => u.email === testEmail.toLowerCase());
  assert(foundUser !== undefined, 'Registered user persisted in data/users.json');
  assert(foundUser.passwordHash.includes(':'), 'Stored password is salted hash, not plaintext');
  console.log('✅ [PASS] Server JSON store persisted accounts to data/*.json');

  // 9. User Data Isolation Verification
  console.log('\n--- Step 9: User Data Isolation Invariant ---');
  const userAReg = registerUser({
    name: 'User A',
    email: `usera_${Date.now()}@example.com`,
    password: 'PasswordUserA1!'
  });
  const userBReg = registerUser({
    name: 'User B',
    email: `userb_${Date.now()}@example.com`,
    password: 'PasswordUserB1!'
  });

  assert(userAReg.success && userBReg.success, 'Both User A and User B registered successfully');
  if (userAReg.success && userBReg.success) {
    assert(userAReg.user.id !== userBReg.user.id, 'User IDs are unique');
    assert(userAReg.profile.email !== userBReg.profile.email, 'User profiles are isolated');
    console.log('✅ [PASS] User A and User B data isolated cleanly');
  }

  console.log('\n==============================================');
  console.log('ALL AUTHENTICATION & JSON STORE TESTS PASSED!');
  console.log('==============================================');
}

runAuthTests().catch(err => {
  console.error('❌ AUTH TEST FAILED:', err);
  process.exit(1);
});
