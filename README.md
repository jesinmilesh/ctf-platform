# XPLOITX // CYBER BATTLEFIELD

Next-Generation Tactical Cybersecurity Capture The Flag (CTF) Platform.

Built strictly with **Pure HTML5, CSS3, and Vanilla JavaScript** on the client (No React, Next.js, Vue, Angular, or Tailwind) and a clean, layered **Node.js & Express API + WebSocket** engine on the server.

---

## ⚔️ Visual Design Identity

- **Dark Command Center Aesthetic** (`#05070a`, `#0a0e13`, `#0d1218`)
- **Tactical Cyber UI**: Radiant Terminal Green (`#00ff9c`), Intelligence Cyan (`#00d8f6`), Alert Crimson (`#ff3b5c`), and Amber (`#ffb020`)
- **Technical Typography**: Orbitron, Chakra Petch, and JetBrains Mono
- **Live Real-time Telemetry**: WebSocket pub/sub for First Blood alerts, score updates, and urgent C2 intel broadcasts

---

## 🏛️ System Architecture

```text
xploitx-ctf/
│
├── public/                     # Participant Web Portal (Vanilla HTML/CSS/JS)
│   ├── index.html              # Landing Page & Live Battlefield Telemetry
│   ├── login.html              # Operative Authentication
│   ├── register.html           # New Operative Enlistment
│   ├── rules.html              # Engagement Protocols & Rules
│   ├── announcements.html      # C2 Intel Dispatches
│   ├── dashboard.html          # Operative Command Center HUD
│   ├── challenges.html         # Active Operations Catalog & Filters
│   ├── challenge.html          # Single Mission Dossier & Flag Capture Terminal
│   ├── scoreboard.html         # Live Leaderboard & Podium
│   ├── team.html               # Squad Management & Access Codes
│   ├── profile.html            # Operative Dossier & Clearance
│   └── activity.html           # Real-time Combat Intercept Feed
│
├── admin/                      # C2 Control Room (Vanilla HTML/CSS/JS)
│   ├── index.html              # Clearance Gateway / Redirect
│   ├── login.html              # C2 Admin Authentication
│   ├── dashboard.html          # High-Level Operations Telemetry
│   ├── challenges.html         # Target Inventory & CRUD Actions
│   ├── challenge-editor.html   # Multi-tab Mission Studio
│   ├── categories.html         # Sector Taxonomy & Order
│   ├── users.html              # Operative Registry & Clearance Management
│   ├── teams.html              # Squad Management & Disqualification
│   ├── submissions.html        # Real-time Submission Audit Stream
│   ├── scoreboard.html         # Master Scoreboard Oversight
│   ├── announcements.html      # Intel & Advisory Dispatcher
│   ├── analytics.html          # Solve Rates & Category Distributions
│   ├── instances.html          # Docker Container Sandboxes
│   ├── audit.html              # Security Audit Trail
│   └── settings.html           # Competition Config & Flag Prefix
│
├── assets/                     # Shared Design System & Component Library
│   ├── css/
│   │   ├── variables.css       # Design Tokens, Radii, Palette
│   │   ├── reset.css           # Modern CSS Reset
│   │   ├── global.css          # Core Typography & Layout
│   │   ├── components.css      # Reusable Tactical UI Elements
│   │   ├── animations.css      # Keyframe Glows & Radar Pulses
│   │   ├── responsive.css      # Desktop, Laptop, Tablet, Mobile Breakpoints
│   │   ├── public.css          # Participant Battlefield Styling
│   │   └── admin.css           # C2 Control Room Styling
│   │
│   └── js/
│       ├── api.js              # Central API Client
│       ├── auth.js             # Session State & Role Guard
│       ├── storage.js          # LocalStorage Wrapper
│       ├── utils.js            # XSS Protection, Time & XP Formatters
│       ├── websocket.js        # Live WebSocket Client & Auto-reconnect
│       │
│       ├── components/         # Dynamic Vanilla JS Components
│       │   ├── navbar.js       # Tactical Navigation Bar
│       │   ├── sidebar.js      # Admin C2 Sidebar
│       │   ├── modal.js        # Tactical Dialogue Modal
│       │   ├── toast.js        # Cyberpunk Toast Notifications
│       │   ├── challengeCard.js# Mission Card Generator
│       │   ├── scoreCard.js    # Telemetry Stat Card
│       │   ├── leaderboard.js  # Podium & Score Table Generator
│       │   └── notification.js # Critical Advisory Banner
│       │
│       ├── public/             # Public Page Controllers
│       └── admin/              # Admin Page Controllers
│
├── backend/                    # Layered Express.js & WebSocket Engine
│   ├── server.js               # Express Server & WebSocket Server
│   ├── config/database.js      # Dual-mode Database (Postgres + In-Memory Fallback)
│   ├── routes/                 # Express Routers
│   ├── controllers/            # Controller Handlers
│   ├── services/               # Core Business Logic & Algorithms
│   │   ├── authService.js      # Registration & Session Validation
│   │   ├── challengeService.js # Challenge Catalog & Hint Management
│   │   ├── scoringService.js   # Dynamic Quadratic Scoring Decay
│   │   ├── submissionService.js# Flag Checking & First Blood Detection
│   │   ├── leaderboardService.js# Rank Tie-Breaking & Score Timeline
│   │   └── instanceService.js  # Container Sandbox Lifecycle
│   └── middleware/             # Auth, Roles, Rate Limiting, Error Handling
│
├── challenge-files/            # Isolated Secure Challenge File Storage (Rule 29)
├── database/                   # PostgreSQL Schema & Seed Scripts
│   ├── schema.sql
│   └── seed.sql
└── docker/                     # Containerized Challenge Targets
```

---

## 🚀 Quickstart

### Prerequisites
- Node.js 18+ (tested on Node.js v24)
- npm 9+

### Installation & Launch
```bash
# 1. Install dependencies
npm install

# 2. Run automated test suite
npm test

# 3. Launch unified battlefield engine
npm run dev
```

The system will start on **`http://localhost:4000`**:
- **Participant Battlefield**: `http://localhost:4000/`
- **Missions Catalog**: `http://localhost:4000/challenges.html`
- **Live Scoreboard**: `http://localhost:4000/scoreboard.html`
- **Operative Command Center**: `http://localhost:4000/dashboard.html`
- **C2 Admin Control Room**: `http://localhost:4000/admin/`

---

## 🔑 Demo Access Credentials

| Role | Username / Callsign | Password |
| :--- | :--- | :--- |
| **Commander / Admin** | `admin` | `admin123` |
| **Operative (Player)** | `jesin` | `player123` |
| **Operative (Player)** | `zero_day` | `player123` |

---

## 🛡️ Security Protocol Compliance

1. **Challenge File Isolation (Rule 29)**: No challenge assets reside in public static folders. Files are served exclusively through `/api/files/:fileId` with authorization validation.
2. **Flag Validation**: Flag checks are strictly executed server-side with support for Static strings, Regular Expressions, and dynamic prefix/suffix enforcement (`XploitX{...}`).
3. **Dynamic Scoring**: Quadratic decay formula guarantees high stakes for First Blood while naturally balancing sector score inflation.
4. **Rate Limiting**: Sliding window rate limiter prevents submission brute-forcing and denial of service.
