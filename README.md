# xerus-pod

Provider-agnostic compute plane for the Xerus AI platform.

## Architecture

```
xerus_backend (API) ───────> xerus-pod (compute plane)
                                   │
                     ┌─────────────┼──────────────┐
                     │             │              │
              ComputeProvider  RuntimeProvider  Orchestrator
              (where it runs)  (what runs)     (decisions)
                     │             │
              ┌──────┤      ┌──────┤
              │      │      │      │
           Hetzner  DO   Daytona  E2B    ... (add any provider)
           local    AWS  Docker
```

**Two interfaces, swap any provider:**

| Interface | Implementations | Purpose |
|-----------|----------------|---------|
| `ComputeProvider` | Hetzner, DigitalOcean, AWS EC2, local-docker | Where machines run |
| `RuntimeProvider` | Daytona, E2B, Docker | What manages sandboxes |

## Quick Start

```bash
# 1. Copy dev defaults (includes pre-configured API key)
cp config/dev.env.example .env

# 2. Start Daytona stack
npm run setup

# 3. Register xerus-sandbox snapshot
npm run setup  # setup.sh handles snapshot registration

# 4. Point xerus_backend at local Daytona (in xerus/xerus_backend/.env):
#    DAYTONA_API_URL=http://localhost:3000/api
#    DAYTONA_API_KEY=xerus-local-dev-key

# 5. Check status
npm run status
npm run health
npm run capacity
```

No dashboard login needed. `DAYTONA_API_KEY` in `.env` is passed as `ADMIN_API_KEY` to the Daytona stack, so it works immediately.

## Provider Selection

Two env vars control everything:

```bash
POD_COMPUTE_PROVIDER=hetzner       # or: digitalocean, local-docker
POD_RUNTIME_PROVIDER=daytona       # or: e2b, docker
```

Each provider reads its own env vars (`HETZNER_API_TOKEN`, `DAYTONA_API_URL`, etc.).

```bash
# See available providers
npm run providers
```

## File Structure

```
xerus-pod/
├── src/
│   ├── orchestrator.ts              # CLI (provider-agnostic)
│   ├── config.ts                    # Env-based provider selection
│   ├── capacity.ts                  # Sandbox slot math
│   ├── health.ts                    # Health evaluation
│   ├── types.ts                     # Provider-agnostic types
│   └── providers/
│       ├── registry.ts              # Factory registry
│       ├── compute/
│       │   ├── compute-provider.ts  # Interface
│       │   ├── hetzner.provider.ts  # Hetzner Cloud
│       │   └── local-docker.provider.ts
│       └── runtime/
│           ├── runtime-provider.ts  # Interface
│           └── daytona.provider.ts  # Self-hosted Daytona
│
├── scripts/
│   ├── setup.sh                     # Generic dispatcher
│   ├── health-check.sh
│   ├── compute/{provider}/          # Per-provider scripts
│   └── runtime/{provider}/          # Per-runtime scripts
│
├── skills/
│   ├── compute/{provider}/SKILL.md  # Operational knowledge
│   └── runtime/{provider}/SKILL.md
│
├── config/
│   ├── dev.env.example
│   ├── prod.env.example
│   └── runtime/{provider}/          # Runtime-specific configs
│
└── TEST_PLAN.md
```

## Adding a New Provider

1. Create `src/providers/compute/yourprovider.provider.ts`
2. Implement the `ComputeProvider` interface
3. Call `registerComputeProvider('yourprovider', factory)` at module scope
4. Import it in `orchestrator.ts`
5. Add env loading in `config.ts`
6. Add scripts in `scripts/compute/yourprovider/`

Same pattern for runtime providers.

## Tests

```bash
npm test              # All tests (45)
npm run test:unit     # Unit only
npm run typecheck     # Type checking
```

## Connecting to Backend

One env var in `xerus_backend/.env`:

```bash
DAYTONA_API_URL=http://localhost:3000/api    # local
DAYTONA_API_URL=http://<vps-ip>:3000/api     # production
```
