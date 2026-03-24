# Daytona Runtime Management

Operational knowledge for self-hosted Daytona sandbox runtime.

## Architecture

Daytona is a multi-service stack:

| Service | Port | Purpose |
|---------|------|---------|
| API | 3000 | REST API (NestJS) |
| Runner | 3003 | Sandbox lifecycle (Go) |
| Proxy | 4000 | Preview URL routing |
| SSH Gateway | 2222 | SSH into sandboxes |
| PostgreSQL | 5432 | Daytona metadata |
| Redis | 6379 | Caching, queues |
| Registry | 6000 | Docker image registry |
| MinIO | 9000/9001 | Object storage |
| Dex | 5556 | OIDC auth |

## Start/Stop

```bash
# Start (from xerus-pod root)
docker compose -f config/runtime/daytona/docker-compose.yaml up -d

# Stop
docker compose -f config/runtime/daytona/docker-compose.yaml down

# Stop + delete volumes (full reset)
docker compose -f config/runtime/daytona/docker-compose.yaml down -v
```

## Dashboard

- URL: `http://localhost:3000/dashboard`
- Login: `dev@daytona.io` / `password`
- API Keys: Settings > API Keys

## Snapshot (sandbox image)

Register the xerus-sandbox snapshot:
```bash
DAYTONA_API_KEY=<key> bash scripts/runtime/daytona/register-snapshot.sh
```

## Health Check

```bash
# API health
curl http://localhost:3000/health

# List runners
curl -H "Authorization: Bearer <key>" http://localhost:3000/api/runner

# List snapshots
curl -H "Authorization: Bearer <key>" http://localhost:3000/api/snapshot

# List sandboxes
curl -H "Authorization: Bearer <key>" http://localhost:3000/api/sandbox
```

## Connecting Backend

Set one env var in `xerus_backend/.env`:
```
DAYTONA_API_URL=http://localhost:3000/api    # local dev
DAYTONA_API_URL=http://<vps-ip>:3000/api     # production
```
