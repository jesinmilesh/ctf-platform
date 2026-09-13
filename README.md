# XPLOITX // CYBER BATTLEFIELD
### Next-Generation Tactical Cybersecurity Capture The Flag (CTF) Platform

XPLOITX CTF is a production-grade, state-of-the-art cybersecurity competition platform engineered around the high-stakes **cyber-battlefield / mission-control visual identity**. 

The client is built strictly with **Pure HTML5, CSS3, and Vanilla JavaScript** (Zero frameworks: No React, Next.js, Vue, Angular, or Tailwind) delivering an ultra-fast, responsive tactical HUD. The backend is powered by a high-throughput **Node.js & Express API engine**, real-time **WebSocket pub/sub telemetry grid**, authoritative **PostgreSQL & Redis** storage, and a **dedicated Docker Sandbox Instance Server** with atomic port allocation.

---

## ⚔️ Visual Design Identity & Command Aesthetic

- **Command Center Palette**: Tactical Void (`#05070a`, `#0a0e13`), Radiant Terminal Green (`#00ff9c`), Intelligence Cyan (`#00d8f6`), Alert Crimson (`#ff3b5c`), Warning Amber (`#ffb020`), and Deep Cobalt (`#14243b`).
- **Typography**: Mission-critical display fonts (`Orbitron`, `Chakra Petch`) paired with high-legibility monospace telemetry (`JetBrains Mono`).
- **Tactical Micro-Animations**: Scanlines, radar sweep indicators, subtle HUD borders, pulse animations, and real-time first blood broadcast flashes.
- **Zero Placeholder Guarantee**: 100% functional components backed by authoritative server calculations—no mock numbers, random stats, or static facades.

---

## 🏛️ System Architecture

```text
xploitx-ctf/
│
├── frontend/
│   ├── public/                     # Participant Web Portal (Vanilla HTML/CSS/JS)
│   │   ├── index.html              # Landing Page & Live Battlefield Telemetry
│   │   ├── login.html              # Operative Authentication
│   │   ├── register.html           # New Operative Enlistment
│   │   ├── rules.html              # Engagement Protocols & Rules of Engagement
│   │   ├── announcements.html      # C2 Intel Dispatches & Directives
│   │   ├── dashboard.html          # Operative Command Center HUD
│   │   ├── challenges.html         # Active Operations Catalog & Tactical Filters
│   │   ├── challenge.html          # Mission Dossier, Sandbox Terminal & Flag Submission
│   │   ├── scoreboard.html         # Live Dynamic Leaderboard & Podium
│   │   ├── team.html               # Squad Management & Access Tokens
│   │   ├── profile.html            # Operative Dossier, Solves & Clearance Level
│   │   └── activity.html           # Real-time Combat Intercept Feed
│   │
│   ├── admin/                      # C2 Control Room (Vanilla HTML/CSS/JS)
│   │   ├── index.html              # Clearance Gateway & Redirection Hub
│   │   ├── login.html              # C2 Admin Authentication
│   │   ├── dashboard.html          # High-Level Strategic Operations Telemetry
│   │   ├── challenges.html         # Target Inventory & CRUD Operations
│   │   ├── challenge-editor.html   # Mission Studio with Pre-Publish Verification
│   │   ├── categories.html         # Sector Taxonomy & Order Management
│   │   ├── users.html              # Operative Registry & Clearance Overrides
│   │   ├── teams.html              # Squad Roster & Disqualification Controls
│   │   ├── submissions.html        # Real-time Submission Audit Stream
│   │   ├── scoreboard.html         # Master Scoreboard Oversight & Manual Adjustments
│   │   ├── announcements.html      # Intel Dispatcher (WebSocket Broadcast)
│   │   ├── analytics.html          # Solve Decay Curves & Category Penetration Rates
│   │   ├── instances.html          # Docker Container Sandbox Oversight
│   │   ├── audit.html              # Cryptographic Security Audit Trail
│   │   └── settings.html           # Competition Config, Flag Prefixes & Freezes
│   │
│   └── assets/                     # Shared Design System & Component Library
│       ├── css/
│       │   ├── variables.css       # Design Tokens, Radii, Palette, Glows
│       │   ├── reset.css           # Modern CSS Reset
│       │   ├── global.css          # Core Typography & Layout Foundations
│       │   ├── components.css      # Reusable Tactical UI Elements (Cards, Buttons, Badges)
│       │   ├── animations.css      # Keyframe Glows, Scanlines & Radar Pulses
│       │   ├── responsive.css      # Breakpoint Grid (Mobile, Tablet, Desktop, Wide)
│       │   ├── public.css          # Participant Battlefield Styling
│       │   └── admin.css           # C2 Control Room Styling
│       │
│       └── js/
│           ├── api.js              # Central Typed API Client
│           ├── auth.js             # Session State & Role Guard
│           ├── storage.js          # LocalStorage Wrapper
│           ├── utils.js            # XSS Protection, Time, XP & Coordinate Formatters
│           ├── websocket.js        # Live WebSocket Client with Exponential Backoff
│           │
│           └── components/         # Dynamic Vanilla JS Components
│               ├── navbar.js       # Tactical Navigation Bar
│               ├── sidebar.js      # Admin C2 Sidebar
│               ├── modal.js        # Tactical Dialogue Modal
│               ├── toast.js        # Cyberpunk Toast Notifications
│               ├── dialog.js       # Confirmation Dialog with Keyboard Traps
│               ├── challengeCard.js# Mission Card Generator with Status Badges
│               ├── scoreCard.js    # Telemetry Stat Card with Glow Accents
│               ├── leaderboard.js  # Podium & Score Table Generator
│               ├── notification.js # Critical Advisory Banner
│               ├── instancePanel.js# Live Container Sandbox Controller & Countdown
│               ├── missionHeader.js# Mission Telemetry Dossier Header
│               └── activityFeed.js # Live Combat Activity Stream
│
├── backend/                        # High-Performance Node.js / Express Server
│   ├── server.js                   # Unified Express Engine & WebSocket Server (Port 4000)
│   ├── config/database.js          # Dual-Mode Database (PostgreSQL + Resilient In-Memory)
│   ├── routes/                     # Modular API Routers (auth, challenges, teams, admin, etc.)
│   ├── controllers/                # Controller Handlers
│   ├── services/                   # Business Logic & Algorithms
│   │   ├── authService.js          # JWT & Token Validation
│   │   ├── challengeService.js     # Challenge Catalog, Hints & Pre-Publish Validation
│   │   ├── scoringService.js       # Quadratic Dynamic Scoring Decay
│   │   ├── submissionService.js    # Multi-Type Flag Checking & Race-Safe First Blood
│   │   ├── leaderboardService.js   # Rank Tie-Breaking & Timestamp Resolution
│   │   ├── fileService.js          # Isolated Asset Streaming & SHA-256 Checksums
│   │   └── instanceService.js      # Sandbox Client for Dedicated Instance Server
│   ├── realtime/                   # Real-time EventBus & WebSocket Server
│   │   ├── eventBus.js             # Redis Pub/Sub with Standalone Fallback
│   │   └── wsServer.js             # Client Registry, Auth Verification & Dispatches
│   ├── middleware/                 # Auth Guards, Admin Clearance, Rate Limiting, Error Handling
│   └── database/                   # PostgreSQL Migration & Seeding Scripts
│       ├── schema.sql              # Production DDL Schema
│       └── seed.sql                # Official 60-Target Mission Catalog & Seeds
│
├── instance-server/                # Dedicated Container Sandbox Microservice (Port 5000)
│   ├── index.js                    # Express Microservice with Bearer Token Auth
│   ├── dockerManager.js            # Docker Engine / Emulation Driver & Lifecycle Hooks
│   ├── portAllocator.js            # Atomic Concurrency-Safe Port Allocator (41000–41999)
│   ├── security.js                 # Container Hardening (CapDrop, ReadOnlyRoot, Quotas)
│   ├── healthChecker.js            # Active TCP & HTTP Readiness Probes
│   ├── instanceRouter.js           # Subdomain Resolver (`inst-<id>.xploitxctf.me`)
│   ├── cleanupWorker.js            # Automated 15-Second Expired Container Reaper
│   └── reconciliation.js          # Startup State Reconciliation Engine
│
├── challenge-storage/              # Isolated Secure Challenge File Storage
├── nginx/                          # Production Reverse Proxy Configuration
│   └── nginx.conf                  # Static Caching, WebSocket Proxying & Subdomain Wildcards
├── .github/workflows/              # Automated CI/CD Pipelines
│   ├── ci.yml                      # Test Suite, Syntax & Migration Validation
│   ├── security.yml                # Secret Scanning, Dependency Audits & Hardening
│   └── deploy.yml                  # Production Deployments (Vercel & Docker Host)
├── docker-compose.yml              # Complete Production Stack Orchestration
└── test/
    └── verify.js                   # 12-Point Automated Comprehensive Production Test Suite
```

---

## ⚡ Core Engine Features

### 1. Dynamic Quadratic Scoring Engine
Mission values decay dynamically as more squads conquer them, prioritizing early breakthroughs:
$$\text{Points} = \text{round}\left( \text{Min} + (\text{Base} - \text{Min}) \times \left( \frac{\text{Decay} - \text{Solves}}{\text{Decay} - 1} \right)^2 \right)$$
- If $\text{Solves} = 1$, the mission yields maximum $\text{Base}$ points.
- Once $\text{Solves} \ge \text{Decay}$, the mission drops to its guaranteed $\text{Minimum}$ floor.
- Dynamic recalculation updates past solves and broadcasts telemetry immediately over WebSockets.

### 2. Multi-Type Flag Validation Engine
Supports 4 distinct verification algorithms:
1. **`STATIC`**: Strict exact matching with configurable case-sensitivity.
2. **`REGEX`**: Regular expression validation (e.g., `^XploitXβ\{lcg_[a-z0-9_]{16}\}$`).
3. **`DYNAMIC`**: Deterministic HMAC-SHA256 flags generated per operative:
   $$\text{Flag} = \text{XploitX}\beta\{\text{HMAC}(\text{Secret}, \text{UserId} + \text{ChallengeId})\}$$
4. **`MULTIPLE_ACCEPTED_FLAGS`**: Array of authorized flags for multi-stage solutions.

### 3. Dedicated Container Sandbox Orchestration
Missions requiring active network targets are isolated via the dedicated `instance-server`:
- **Atomic Port Allocator**: Mutex-locked reservations across the dedicated `41000–41999` range.
- **Subdomain Routing**: Dedicated wildcard resolution to `http://inst-<instanceId>.xploitxctf.me`.
- **Active Readiness Probes**: TCP / HTTP socket verification before marking sandboxes ready.
- **Automated Lifecycle**: 15-minute countdown timers with automated 15-second background sweep reapers.
- **Strict Hardening**: `no-new-privileges`, capability drops (`ALL`), memory limits (`256MB`), and CPU quotas (`0.50`).

### 4. Real-Time Telemetry & Event Envelopes
All tactical battlefield events flow through the Redis / WebSocket bus with standardized envelopes:
```json
{
  "event": "FLAG_CAPTURED",
  "channel": "battlefield",
  "data": {
    "challengeId": "ch-01",
    "challengeTitle": "Last Digit",
    "userName": "infiltrator_zero",
    "teamName": "Ghost Protocol",
    "points": 500,
    "isFirstBlood": true
  },
  "timestamp": "2026-09-13T16:20:00.000Z"
}
```

---

## 🚀 Quickstart & Deployment

### Prerequisites
- **Node.js**: v18.0.0 or higher (Tested on Node.js v20 LTS & v24)
- **Docker & Docker Compose**: (Required for containerized targets & production deployment)

### 1. Local Development (Dual Servers)

```bash
# Clone repository
git clone https://github.com/jesinmilesh/ctf-platform.git
cd ctf-platform

# Install dependencies
npm install

# Run comprehensive automated test suite (12 test suites)
npm test

# Launch Main Backend & Static Portal (Port 4000)
npm run dev

# In a separate terminal, launch the Dedicated Instance Server (Port 5000)
npm run instance-server
```

Access the interfaces:
- **Participant Battlefield**: [http://localhost:4000/](http://localhost:4000/)
- **Target Challenges**: [http://localhost:4000/challenges.html](http://localhost:4000/challenges.html)
- **Live Dynamic Scoreboard**: [http://localhost:4000/scoreboard.html](http://localhost:4000/scoreboard.html)
- **Operative Command Center**: [http://localhost:4000/dashboard.html](http://localhost:4000/dashboard.html)
- **C2 Admin Control Room**: [http://localhost:4000/admin/](http://localhost:4000/admin/)

---

### 2. Full Production Deployment with Docker Compose

Deploy the complete hardened stack (PostgreSQL, Redis, Core Backend, Dedicated Instance Server, and Nginx):

```bash
# Configure production secrets
cp .env.example .env
nano .env

# Launch entire production stack
docker-compose up -d --build

# Verify container health
docker-compose ps
```

---

## 🔑 Default Tactical Credentials

| Role | Callsign / Username | Password | Permissions |
| :--- | :--- | :--- | :--- |
| **C2 Commander (Admin)** | `admin` | `admin123` | Full access to C2 Admin Control Room (`/admin/`), CRUD missions, container sandboxes, audit trails, and scoring overrides. |
| **Field Operative** | `jesin` | `player123` | Member of `Team Alpha` (Sector Alpha Clearance). |
| **Field Operative** | `zero_day` | `player123` | Member of `Ghost Protocol`. |

---

## ⚙️ Environment Variables Reference

| Variable | Default Value | Purpose |
| :--- | :--- | :--- |
| `PORT` | `4000` | Port for Express API, WebSocket, and Static Web Delivery. |
| `NODE_ENV` | `production` | Node execution environment (`development` / `production`). |
| `DATABASE_URL` | `postgresql://postgres:postgres@localhost:5432/xploitx_ctf` | Authoritative PostgreSQL connection string. |
| `REDIS_URL` | `redis://localhost:6379` | Telemetry event bus & rate limiting cache. |
| `JWT_SECRET` | `c2_command_jwt_super_secret_key_change_in_production` | Cryptographic secret for operative session tokens. |
| `FLAG_HMAC_SECRET` | `xploitx_tactical_dynamic_flag_hmac_master_secret_2026` | Master key for dynamic per-user flag derivation. |
| `INSTANCE_SERVER_URL` | `http://localhost:5000` | Internal URL to Dedicated Instance Management Server. |
| `INSTANCE_SERVER_TOKEN`| `xploitx_internal_instance_auth_token_991823` | Pre-shared Bearer token for inter-service security. |
| `INSTANCE_PORT_MIN` | `41000` | Lower bound of dynamic sandbox port range. |
| `INSTANCE_PORT_MAX` | `41999` | Upper bound of dynamic sandbox port range. |
| `INSTANCE_DOMAIN_BASE` | `xploitxctf.me` | Base domain for wildcard sandbox routing (`inst-<id>.xploitxctf.me`). |

---

## 🧪 Comprehensive Verification Suite

The repository features an automated 12-suite validation script (`test/verify.js`):

```bash
npm test
```

Verifies:
1. **Quadratic Dynamic Scoring Decay** (Initial solves, decay slope, floor adherence).
2. **Flag Submission Engine** (`STATIC`, `REGEX`, `DYNAMIC` HMAC, and multiple flag arrays).
3. **Leaderboard Ranking & Tie-Breakers** (Timestamp precision for identical scores).
4. **Dedicated Port Allocator** (Range constraints, uniqueness, atomic lock releases).
5. **Real-time EventBus & Envelopes** (Pub/sub dispatch, envelope structure).
6. **Isolated File Management** (SHA-256 checksum generation, authorized streaming).
7. **Complete File Architecture** (All 12 public pages, 15 admin pages, 12 vanilla components, CI workflows).
8. **Concurrency Resistance** (10 simultaneous port allocations, race-safe First Blood solve assignment).
9. **Challenge Pre-Publishing Validation** (Missing fields, negative points, invalid categories).
10. **Dedicated Instance Server Orchestration** (Container lifecycle, health checks, domain formatting).
11. **Full End-to-End Simulation Scenario** (Author creates mission $\rightarrow$ operative solves $\rightarrow$ scoreboard updates).
12. **Core Express Engine & Static Routing** (55 tested asset and page routes responding 200 OK).

---

## 🔒 Security Compliance

- **Zero Client-Side Framework Vulnerabilities**: Built strictly with native web technologies.
- **Isolated Asset Storage**: Challenge assets are never served from static web roots; access requires valid session tickets via `/api/files/:fileId`.
- **Brute-Force Mitigation**: Sliding-window rate limiters across `/api/submissions` and `/api/auth`.
- **Strict Content Security**: HTTP headers governed by `helmet` and custom Content-Security-Policy rules.
- **Sandbox Isolation**: Containers execute as unprivileged users with read-only root filesystems, resource quotas, and stripped capabilities (`cap_drop: ALL`).

---

## 📜 License
Developed under the **MIT License** for the **XPLOITX Cyber Operations Team**.
