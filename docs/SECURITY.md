# SwasthAI Security Architecture & Governance Policy

This document outlines security practices, RBAC boundaries, secret management, and vulnerability reporting procedures for SwasthAI.

---

## 1. Authentication & Session Security

- **JSON Web Tokens (JWT)**: Sessions are signed using `JWT_SECRET`. Tokens expire after 24 hours.
- **Password Storage**: Passwords in seed scripts and data stores are hashed using SHA-256 (`crypto.createHash('sha256')`).
- **Token Storage**: Client tokens are securely stored in browser `localStorage` and sent via `Authorization: Bearer <token>` headers.

---

## 2. Role-Based Access Control (RBAC) Matrix

Permissions are strictly enforced via middleware (`server/rbac.ts` and `authenticateUser`):

| Permission String | USER (Patient) | OPERATOR | ADMIN | SUPER_ADMIN |
| :--- | :---: | :---: | :---: | :---: |
| `user.profile.read` | ✅ | ✅ | ✅ | ✅ |
| `user.checkups.run` | ✅ | ❌ | ✅ | ✅ |
| `admin.portal.access` | ❌ | ✅ | ✅ | ✅ |
| `admin.patients.list` | ❌ | ✅ | ✅ | ✅ |
| `admin.patients.inspect_full` | ❌ | ❌ | ✅ | ✅ |
| `admin.audit.read` | ❌ | ❌ | ✅ | ✅ |
| `admin.simulation.execute` | ❌ | ❌ | ✅ | ✅ |
| `admin.system.reset` | ❌ | ❌ | ❌ | ✅ |

---

## 3. Telemetry & PHI Data Isolation

- **Zero Fabrication Invariant**: Missing or untested screening modules are never assigned assumed normal values or fabricated metric data.
- **Safe Diagnostic Logging**: Operational logs output technical timing metrics only. Raw audio buffers, image pixels, and personal health identifiers (PHI) are strictly excluded from log outputs.
- **CORS Configuration**: Express CORS is enabled to protect REST endpoints against unauthorized cross-origin requests.

---

## 4. Secret Management

- Secrets are never committed to source control.
- `.gitignore` explicitly excludes `.env`, `.env.local`, and build artifacts.
- `.env.example` provides non-sensitive dev fallbacks.

---

## 5. Vulnerability Disclosure Policy

If you discover a potential security vulnerability in SwasthAI, please report it directly by emailing security@swasthai.org or creating a confidential security advisory on GitHub.
