# XploitX Docker Agent

```
 __  ______  _     ___  ___ _______  __
 \ \/ /  _ \| |   / _ \|_ _|_   _\ \/ /
  >  <| |_) | |  | | | || |  | |  >  <
 /_/\_\  __/|_|__|_|_|_|___| |_| /_/\_\
       |_|  |_____|         DOCKER AGENT
```

A standalone, secure Node.js daemon that bridges your local **Docker Desktop** 
on Windows with the **XploitX Production Backend** over an authenticated, 
outbound-only WebSocket channel.

---

## Architecture

```
INTERNET
   │
   ▼
Vercel (Frontend) → Production API (Render/VPS)
                          │
               Authenticated WSS Channel
                          │
                          ▼
              [YOUR WINDOWS PC]
              XploitX Docker Agent
                          │
                          ▼
                   Docker Desktop
                 ┌──────┬──────┐
                Web1   Web2   PWN
              :41001 :41002 :41003
```

### Security Guarantees
- **Outbound-only**: Agent initiates connection to backend. No inbound ports required.
- **Zero Docker API exposure**: `//./pipe/docker_engine` never exposed to internet.
- **Typed command interface**: Only `START_INSTANCE`, `STOP_INSTANCE`, `RESTART_INSTANCE` accepted.
- **Container isolation**: memory cap, CPU quota, PID limit, `no-new-privileges`.
- **One-time pairing code**: `XPL-XXXX-XXXX` expires in 15 minutes and is single-use.

---

## Prerequisites

1. **Node.js 18+** — [nodejs.org](https://nodejs.org)
2. **Docker Desktop for Windows** — [docker.com](https://www.docker.com/products/docker-desktop/)
3. **XploitX Backend** running and accessible (Render / local)

---

## Installation

```powershell
# 1. Navigate to the agent directory
cd xploitx-docker-agent

# 2. Install dependencies
npm install
```

---

## Pairing (First-Time Setup)

### Step 1: Generate a Pairing Code (Admin Dashboard)

1. Login to the **Admin C2 Room** → **Infrastructure** tab.
2. Click **⚡ PAIR NEW AGENT**.
3. Copy the code: e.g. `XPL-8F7K-2M4Q` *(valid for 15 minutes)*.

### Step 2: Pair the Agent (Windows PC)

```powershell
npm run pair XPL-8F7K-2M4Q
```

This exchanges the code for permanent credentials and writes them to `config/agent.json`.

> ⚠ **Store `config/agent.json` securely** — it contains your agent secret. Never commit it to git.

---

## Starting the Agent

```powershell
npm start
```

**Expected output:**
```
[AGENT] XploitX Docker Agent v1.0.0 starting...
[AGENT] Docker Engine: ONLINE (Windows named pipe)
[AGENT] WebSocket channel: CONNECTED to wss://your-backend.render.com
[AGENT] Agent ID: agent-abc12345-f3a9
[AGENT] Status: ONLINE — awaiting instance commands
```

The Admin Dashboard **Infrastructure** tab will show the agent as `● ONLINE`.

---

## Operations Reference

| Command | Description |
|---------|-------------|
| `npm start` | Start the agent daemon |
| `npm run pair <CODE>` | Pair agent with backend using pairing code |
| `npm test` | Run unit + integration test suite |
| `npm run test:pipeline` | Full E2E pipeline test (requires backend) |

---

## Configuration

Edit `config/default.env`:

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT_RANGE_START` | `41000` | Start of agent port range |
| `PORT_RANGE_END` | `41999` | End of agent port range |
| `NETWORK_MODE` | `LAN` | `LOCAL`, `LAN`, or `CUSTOM_DOMAIN` |
| `INSTANCE_DEFAULT_TTL_MINUTES` | `30` | Container auto-terminate timeout |
| `HEALTH_CHECK_MAX_RETRIES` | `15` | Container readiness probe attempts |

---

## Networking Modes

| Mode | Target Host | Use Case |
|------|-------------|----------|
| `LOCAL` | `127.0.0.1` | Testing on same machine |
| `LAN` | Auto-detected LAN IP | On-site campus CTF (same WiFi) |
| `CUSTOM_DOMAIN` | Your tunnel URL | Remote internet CTF |

For remote CTFs, use a **Cloudflare Tunnel** or **ngrok** and set:
```env
NETWORK_MODE=CUSTOM_DOMAIN
CUSTOM_DOMAIN=https://ctf.your-domain.com
```

---

## Pairing Credentials (config/agent.json)

After successful pairing, `config/agent.json` is created:

```json
{
  "agentId": "agent-abc12345-f3a9",
  "agentSecret": "<64-char-hex>",
  "backendWssUrl": "wss://your-backend.render.com/api/v1/agents/channel"
}
```

> ⚠ Add `config/agent.json` to `.gitignore`!

---

## Troubleshooting

| Symptom | Solution |
|---------|----------|
| `Docker Engine not reachable` | Start Docker Desktop, wait for it to fully load |
| `AGENT_OFFLINE` on participant page | Run `npm start` on your Windows PC |
| Pairing code expired | Generate a new code from Admin Dashboard |
| Port conflicts | Check `PORT_RANGE_START`/`END` in `config/default.env` |
| Agent reconnect loop | Check backend URL and firewall rules |

---

## Security Notes

- Run the agent **only on the Windows PC that hosts Docker Desktop**.
- The agent uses **outbound WebSocket only** — no inbound firewall rules needed.
- Containers run with: `--memory=256m --cpus=0.5 --pids-limit=64 --security-opt no-new-privileges`.
- Port range `41000-41999` should be accessible only from participants' network.

---

*XploitX Engineering Team — Secure Container Orchestration Agent v1.0.0*
