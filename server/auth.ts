import crypto from 'crypto';
import { jsonStore } from './json_store';
import { UserProfile, UserRole } from '../src/types';

export interface UserRecord {
  id: string;
  email: string;
  passwordHash: string;
  name: string;
  role: UserRole;
  status: 'active' | 'suspended';
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string;
}

export interface SessionRecord {
  id: string;
  userId: string;
  tokenHash: string;
  createdAt: string;
  expiresAt: string;
}

const USERS_COLLECTION = 'users';
const SESSIONS_COLLECTION = 'sessions';
const PROFILES_COLLECTION = 'profiles';

// Ensure JSON collections exist
jsonStore.initCollection(USERS_COLLECTION, []);
jsonStore.initCollection(SESSIONS_COLLECTION, []);
jsonStore.initCollection(PROFILES_COLLECTION, []);

/**
 * Hashes a plaintext password using pbkdf2Sync with random salt.
 */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

/**
 * Verifies a plaintext password against a stored salt:hash string using timingSafeEqual.
 */
export function verifyPassword(password: string, combinedHash: string): boolean {
  try {
    const [salt, storedHash] = combinedHash.split(':');
    if (!salt || !storedHash) return false;
    const computedHash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
    const storedBuf = Buffer.from(storedHash, 'hex');
    const computedBuf = Buffer.from(computedHash, 'hex');
    if (storedBuf.length !== computedBuf.length) return false;
    return crypto.timingSafeEqual(storedBuf, computedBuf);
  } catch (e) {
    return false;
  }
}

/**
 * Computes SHA-256 hash of session token for safe storage.
 */
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Normalizes email address (trim + lowercase).
 */
export function normalizeEmail(email: string): string {
  return (email || '').trim().toLowerCase();
}

/**
 * Registers a new user. Returns error if email exists.
 */
export function registerUser(payload: {
  name: string;
  email: string;
  password: string;
  role?: UserRole;
  age?: number;
  sex?: string;
  height?: number;
  weight?: number;
}): { success: true; user: UserRecord; profile: UserProfile; token: string } | { success: false; code: string; message: string } {
  const name = (payload.name || '').trim();
  const email = normalizeEmail(payload.email);
  const password = payload.password || '';

  if (!name) {
    return { success: false, code: 'INVALID_NAME', message: 'Full name is required.' };
  }
  if (!email || !email.includes('@')) {
    return { success: false, code: 'INVALID_EMAIL', message: 'A valid email address is required.' };
  }
  if (!password || password.length < 6) {
    return { success: false, code: 'WEAK_PASSWORD', message: 'Password must be at least 6 characters long.' };
  }

  // Check duplicate email
  const existingUser = jsonStore.findOne<UserRecord>(USERS_COLLECTION, u => normalizeEmail(u.email) === email);
  if (existingUser) {
    return {
      success: false,
      code: 'ACCOUNT_EXISTS',
      message: 'An account with this email already exists. Please log in instead.'
    };
  }

  const userId = `usr_${crypto.randomUUID()}`;
  const now = new Date().toISOString();
  const pwdHash = hashPassword(password);
  const role: UserRole = payload.role || 'USER';

  const userRecord: UserRecord = {
    id: userId,
    email,
    passwordHash: pwdHash,
    name,
    role,
    status: 'active',
    createdAt: now,
    updatedAt: now,
    lastLoginAt: now
  };

  jsonStore.insert<UserRecord>(USERS_COLLECTION, userRecord);

  // Initialize brand-new UserProfile with ZERO seeded measurements
  const profileRecord: UserProfile = {
    id: userId,
    name,
    email,
    role,
    age: payload.age || 30,
    sex: (payload.sex as any) || 'male',
    height: payload.height || 170,
    weight: payload.weight || 70,
    existingConditions: [],
    medications: '',
    activityLevel: 'moderately_active',
    smokingStatus: 'non_smoker',
    createdAt: now,
    updatedAt: now,
    profileCompleted: true
  };

  jsonStore.insert<UserProfile>(PROFILES_COLLECTION, profileRecord);

  // Create active session
  const { token } = createSession(userId);

  return {
    success: true,
    user: userRecord,
    profile: profileRecord,
    token
  };
}

/**
 * Authenticates user credentials. Returns error if invalid.
 */
export function loginUser(emailRaw: string, passwordRaw: string): {
  success: true;
  user: { id: string; name: string; email: string; role: UserRole };
  profile: UserProfile;
  token: string;
} | { success: false; code: string; message: string } {
  const email = normalizeEmail(emailRaw);
  const password = passwordRaw || '';

  if (!email || !password) {
    return { success: false, code: 'INVALID_CREDENTIALS', message: 'Invalid email or password.' };
  }

  const user = jsonStore.findOne<UserRecord>(USERS_COLLECTION, u => normalizeEmail(u.email) === email);
  if (!user || user.status !== 'active') {
    return { success: false, code: 'INVALID_CREDENTIALS', message: 'Invalid email or password.' };
  }

  const validPassword = verifyPassword(password, user.passwordHash);
  if (!validPassword) {
    return { success: false, code: 'INVALID_CREDENTIALS', message: 'Invalid email or password.' };
  }

  // Update last login
  const now = new Date().toISOString();
  jsonStore.update<UserRecord>(USERS_COLLECTION, u => u.id === user.id, { lastLoginAt: now, updatedAt: now });

  // Get or create profile
  let profile = jsonStore.findOne<UserProfile>(PROFILES_COLLECTION, p => p.id === user.id);
  if (!profile) {
    profile = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      age: 30,
      sex: 'male',
      height: 170,
      weight: 70,
      existingConditions: [],
      medications: '',
      createdAt: now,
      updatedAt: now,
      profileCompleted: true
    };
    jsonStore.insert<UserProfile>(PROFILES_COLLECTION, profile);
  }

  const { token } = createSession(user.id);

  return {
    success: true,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role
    },
    profile,
    token
  };
}

/**
 * Creates a server session record in sessions.json and returns plaintext token.
 */
export function createSession(userId: string): { session: SessionRecord; token: string } {
  const rawToken = `jwt_sk_${crypto.randomUUID().replace(/-/g, '')}_${Date.now()}`;
  const tokenHashVal = hashToken(rawToken);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days

  const session: SessionRecord = {
    id: `sess_${crypto.randomUUID()}`,
    userId,
    tokenHash: tokenHashVal,
    createdAt: now.toISOString(),
    expiresAt
  };

  jsonStore.insert<SessionRecord>(SESSIONS_COLLECTION, session);
  return { session, token: rawToken };
}

/**
 * Verifies raw token against active sessions. Returns user and profile if valid.
 */
export function verifySessionToken(token: string): { user: UserRecord; profile: UserProfile; session: SessionRecord } | null {
  if (!token) return null;
  const tokenHashVal = hashToken(token);
  const session = jsonStore.findOne<SessionRecord>(SESSIONS_COLLECTION, s => s.tokenHash === tokenHashVal);

  if (!session) return null;

  // Check expiration
  if (new Date(session.expiresAt).getTime() < Date.now()) {
    // Delete expired session
    jsonStore.delete<SessionRecord>(SESSIONS_COLLECTION, s => s.id === session.id);
    return null;
  }

  const user = jsonStore.findOne<UserRecord>(USERS_COLLECTION, u => u.id === session.userId);
  if (!user || user.status !== 'active') return null;

  let profile = jsonStore.findOne<UserProfile>(PROFILES_COLLECTION, p => p.id === user.id);
  if (!profile) {
    const now = new Date().toISOString();
    profile = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      age: 30,
      sex: 'male',
      height: 170,
      weight: 70,
      existingConditions: [],
      medications: '',
      createdAt: now,
      updatedAt: now,
      profileCompleted: true
    };
    jsonStore.insert<UserProfile>(PROFILES_COLLECTION, profile);
  }

  return { user, profile, session };
}

/**
 * Invalidates a session by raw token.
 */
export function logoutSession(token: string): boolean {
  if (!token) return false;
  const tokenHashVal = hashToken(token);
  const deletedCount = jsonStore.delete<SessionRecord>(SESSIONS_COLLECTION, s => s.tokenHash === tokenHashVal);
  return deletedCount > 0;
}
