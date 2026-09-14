# XploitX // Dedicated Instance Worker Microservice

The **Instance Worker** is a self-contained, separately deployable microservice designed to run exclusively on the dedicated Linux Docker host.

---

## Production Architecture

```
                    ┌─────────────────────────┐
                    │   XploitX Backend API   │
                    │   Persistent Node.js    │
                    └────────────┬────────────┘
                                 │
                                 │ Internal HTTP (Private Network / VPC)
                                 │ Header: x-instance-worker-auth
                                 ▼
                    ┌─────────────────────────┐
                    │ XploitX Instance Worker │
                    │ Port: 5050 (Internal)   │
                    └────────────┬────────────┘
                                 │
                                 │ Host Unix Domain Socket
                                 │ /var/run/docker.sock
                                 ▼
                    ┌─────────────────────────┐
                    │   Host Docker Engine    │
                    │   (Linux Daemon)        │
                    └────────────┬────────────┘
                                 │
            ┌────────────────────┼────────────────────┐
            ▼                    ▼                    ▼
       Challenge A          Challenge B          Challenge C
       Port 41001           Port 41002           Port 41003
```

---

## Security Architecture

1. **Zero Public Daemon Exposure**: The Docker daemon does **not** expose TCP port 2375 to the public internet. It remains bound exclusively to the private host socket `/var/run/docker.sock`.
2. **Machine-to-Machine Authentication**: All endpoints under `/internal/*` require a pre-shared service secret sent in the `x-instance-worker-auth` header.
3. **Hardened Container Defaults**:
   - Capabilities dropped: `--cap-drop=ALL`
   - Privileges escalated prevented: `no-new-privileges:true`
   - Zero host filesystem mounts allowed
   - Docker socket mount prohibited
   - Hard resource limits enforced (CPU: 0.50, Memory: 256MB, PIDs: 128)

---

## Deployment on Linux Docker Host

### 1. Prerequisites
- Linux Server (Ubuntu 22.04 LTS / Debian 12 recommended)
- Docker Engine installed (`apt-get install docker-ce docker-ce-cli containerd.io`)
- Node.js 20+ LTS

### 2. Installation
```bash
git clone https://github.com/jesinmilesh/ctf-platform.git /opt/xploitx
cd /opt/xploitx/instance-worker
npm install --production
```

### 3. Configuration (`.env`)
Create `/opt/xploitx/instance-worker/.env`:
```env
INTERNAL_WORKER_PORT=5050
INSTANCE_WORKER_BIND_HOST=0.0.0.0
INSTANCE_WORKER_AUTH_SECRET=generate_a_64_character_random_hex_secret
DOCKER_SOCKET=/var/run/docker.sock
DOCKER_NETWORK=xploitx-instances
```

### 4. Systemd Service Setup
Create `/etc/systemd/system/xploitx-worker.service`:
```ini
[Unit]
Description=XploitX Docker Instance Worker
After=network.target docker.service
Requires=docker.service

[Service]
Type=simple
User=root
WorkingDirectory=/opt/xploitx/instance-worker
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=5
EnvironmentFile=/opt/xploitx/instance-worker/.env

[Install]
WantedBy=multi-user.target
```

Enable and start:
```bash
sudo systemctl daemon-reload
sudo systemctl enable --now xploitx-worker
```

---

## API Reference

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/internal/health` | Service health check (unauthenticated) |
| `GET` | `/internal/docker/status` | Host Docker Engine status & version |
| `POST` | `/internal/networks/ensure` | Ensures bridge network `xploitx-instances` exists |
| `POST` | `/internal/instances` | Spawns, starts, and health-checks a challenge container |
| `GET` | `/internal/instances` | Lists all containers with label `xploitx.managed=true` |
| `GET` | `/internal/instances/:id` | Inspects container details and health status |
| `POST` | `/internal/instances/:id/restart` | Restarts container and re-probes health |
| `POST` | `/internal/instances/:id/stop` | Stops container |
| `DELETE` | `/internal/instances/:id` | Terminates and removes container |
| `POST` | `/internal/reconcile` | Reconciles managed containers against active instances |
