# XploitX CTF Platform // Database Security & Threat Defense Architecture

## 1. Executive Summary & Security Boundary
The XploitX CTF platform strictly isolates untrusted participants and intentionally vulnerable challenge containers from the high-trust platform command zone.

```
                         UNTRUSTED PUBLIC INTERNET
                                     │
                                     ▼
                          ┌─────────────────────┐
                          │   XploitX Frontend  │
                          └──────────┬──────────┘
                                     │ HTTPS
                                     ▼
                          ┌─────────────────────┐
                          │   XploitX Backend   │
                          │ (Express + RBAC +   │
                          │  Validation Shield) │
                          └──────────┬──────────┘
                                     │ Authenticated TLS + IP Egress
                                     ▼
                          ┌─────────────────────┐
                          │    MongoDB Atlas    │
                          │   (🔒 ZERO PUBLIC)  │
                          └─────────────────────┘

                       ISOLATED LOW-TRUST SANDBOX
                                     │
                                     ▼
                          ┌─────────────────────┐
                          │    Docker Engine    │
                          │   (ctf-sandbox Net) │
                          └──────────┬──────────┘
                                     │
                    ┌────────────────┼────────────────┐
                    ▼                ▼                ▼
               Web Mission      Pwn Mission      Crypto Mission
              (Zero DB URI)    (Zero DB URI)    (Zero DB URI)
```

**Core Invariants**:
1. Challenge sandboxes and participants **never** receive MongoDB connection strings, credentials, or network routing to Atlas.
2. If an intentionally vulnerable challenge container is breached via Remote Code Execution (RCE), the attack terminates inside the container. It cannot pivot to MongoDB Atlas or the platform backend.
3. The platform database is accessible **only** by the trusted backend API server.

---

## 2. MongoDB Atlas Network Hardening
1. **Zero 0.0.0.0/0 in Production**:
   - The production Atlas IP Access List must **never** include `0.0.0.0/0`.
   - Atlas network access must be restricted to:
     - Cloud Provider Private Networking (AWS PrivateLink, GCP Private Service Connect, or Azure Private Endpoint), OR
     - Exact static egress IP addresses of the backend production server cluster.
2. **Mandatory TLS Encryption**:
   - All connections require TLS 1.3/1.2 (`mongodb+srv://`).
   - Insecure flags (such as `tlsAllowInvalidCertificates=true`) are forbidden.

---

## 3. Least-Privilege Database Role Separation
The platform uses distinct database user identities adhering strictly to the principle of least privilege:

| Database User | Scope / Role | Permissions | Forbidden Capabilities |
| :--- | :--- | :--- | :--- |
| `xploitx_app` | Runtime Application Service | `readWrite` on `xploitx_production` collection data | Cannot create users, drop database, modify cluster networking, or alter Atlas organization settings |
| `xploitx_migration` | Deployment & Schema Migration | `readWrite`, `dbAdmin` on `xploitx_production` | Used only during CI/CD maintenance windows |
| `xploitx_backup` | Disaster Recovery & Backup Agent | `backup` role on cluster | Cannot read decrypted authentication secrets |

*Note: The application backend never uses the Atlas Organization Owner or Project Admin account.*

---

## 4. Secret Management & `.env` Hygiene
- `MONGODB_URI` and cryptographic secrets are stored exclusively in deployment secret managers or local environment files (`.env`).
- All `.env*` files are strictly listed in `.gitignore` and excluded from version control.
- A sanitized `.env.example` template provides placeholders only.
- The `MONGODB_URI` is automatically redacted from all application logs, error traces, and WebSocket broadcasts.

---

## 5. Mongoose Schemas, Input Validation & Mass-Assignment Shield
1. **Strict Schemas**:
   - Every Mongoose model enforces `{ strict: true }` to reject unapproved fields.
2. **Selective Field Protection**:
   - Sensitive fields (`password_hash`, `mfa_secret`, `flag_value`) are configured with `select: false`.
   - Serialization transforms (`toJSON` and `toObject`) automatically delete sensitive properties.
3. **NoSQL Injection Shield**:
   - Recursive sanitization middleware automatically strips MongoDB query operators (`$`, `.`) and prototype pollution keys (`__proto__`, `constructor`, `prototype`).
4. **ObjectId & Identifier Validation**:
   - Parameterized routes enforce valid UUID, 24-character hexadecimal ObjectId, or safe slug formats (`validateIdParam`). Arbitrary objects or invalid strings are rejected with HTTP 400.
5. **Mass-Assignment Protection**:
   - Privileged fields (`role`, `isAdmin`, `score`, `points`, `is_first_blood`, `permissions`, `is_banned`) are stripped from participant update payloads.
6. **Query & Pagination Limits**:
   - Pagination requests are clamped server-side (`limit <= 100`, `page >= 1`).
   - Text searches escape regex special characters to defeat ReDoS attacks.
   - Client-supplied aggregation pipeline stages are blocked.

---

## 6. Docker Sandbox Isolation
1. **Zero Secret Injection**:
   - Spawned containers only receive safe challenge metadata: `CHALLENGE_ID`, `TEAM_ID`, `PORT`.
   - Host platform secrets (`MONGODB_URI`, `JWT_SECRET`, `REDIS_URL`) are never injected into containers.
2. **Network Bridge Isolation**:
   - Sandboxes run on an isolated Docker network bridge (`ctf-sandbox`).
   - The container bridge is isolated from host loopback and internal platform control planes.

---

## 7. Error Sanitization & Observability
- All database errors (`MongoServerError`, `E11000 duplicate key error`, connection timeouts) are intercepted by the centralized error handler.
- Error responses are translated into sanitized application codes:
  - `RESOURCE_ALREADY_EXISTS` (409)
  - `DATABASE_TIMEOUT` (503)
  - `DATABASE_ERROR` (500)
- Collection names, index names, driver traces, and database hostnames are never sent to clients.
- Every response includes an `X-Request-ID` correlation header for server-side audit tracing.

---

## 8. Database Credential Rotation Procedure
When rotating the MongoDB Atlas application password:
1. In Atlas Access Management, create a secondary application user (e.g. `xploitx_app_v2`) with identical `readWrite` permissions.
2. Update the `MONGODB_URI` environment variable in the production deployment manager.
3. Trigger a rolling restart of the backend service cluster. The connection pool establishes new connections with the updated credentials.
4. Verify backend health via `GET /api/v1/health` and test platform read/write operations.
5. In Atlas, delete the deprecated application user credentials.

---

## 9. Incident Response Runbook: Suspected Database Leak
In the event of suspected database credential compromise:
1. **Immediate Revocation**: Delete or rotate the compromised Atlas database user immediately in the Atlas Console.
2. **IP Access Lockdown**: If not using VPC peering, immediately restrict the IP access list to the exact backend host IP.
3. **Session Invalidation**: Invoke the administrative token revocation endpoint or restart the backend service to clear active session states.
4. **Atlas Audit Review**: Inspect Atlas Database Auditing logs to verify query patterns, accessed collections, and client source IPs.
5. **Data Integrity Audit**: Verify score tables, submissions, and flag collections against signed audit logs. If tampering is identified, restore authoritative state from the latest point-in-time backup.
