# xerus-pod Test Plan

> **Status**: Planning (March 2026)
> **Scope**: Test strategy for Xerus compute infrastructure manager
> **Rule**: Prefer real services over mocks. Clean up everything you create.

---

## Test Architecture

```
                        ┌─────────────────────────────┐
                        │      Test Pyramid            │
                        │                              │
                        │     /  E2E (manual)  \       │
                        │    / Hetzner staging   \     │
                        │   /────────────────────\    │
                        │  / Integration (CI)     \   │
                        │ / Local Docker + Daytona  \  │
                        │/──────────────────────────\ │
                        │  Unit (CI, fast, no I/O)    │
                        │  Cloud-init, capacity math,  │
                        │  config validation, types    │
                        └─────────────────────────────┘
```

---

## Layer 1: Unit Tests (CI — no external deps)

Pure logic, no network, no Docker. Run in < 5 seconds.

### 1.1 Cloud-Init Generation

| TC | Description | Input | Expected |
|----|-------------|-------|----------|
| CI-001 | Generate valid cloud-init YAML for Hetzner runner | `{ apiUrl, runnerToken, snapshot }` | Valid YAML with Docker install + Daytona runner container |
| CI-002 | cloud-init includes correct Daytona API URL | `{ apiUrl: 'https://api.xerus.app:3000' }` | `DAYTONA_API_URL=https://api.xerus.app:3000` in env |
| CI-003 | cloud-init includes runner token | `{ runnerToken: 'tok_abc' }` | `DAYTONA_RUNNER_TOKEN=tok_abc` in env |
| CI-004 | cloud-init escapes special chars in token | `{ runnerToken: "tok_ab'c$d" }` | Properly escaped in YAML |
| CI-005 | cloud-init rejects empty API URL | `{ apiUrl: '' }` | Throws validation error |
| CI-006 | cloud-init rejects empty runner token | `{ runnerToken: '' }` | Throws validation error |
| CI-007 | Generated YAML is parseable | any valid input | `yaml.parse()` succeeds |

### 1.2 Capacity Calculation

| TC | Description | Input | Expected |
|----|-------------|-------|----------|
| CAP-001 | Calculate sandbox slots from VPS specs | `{ cpu: 4, memory: 8GB }` | 4-6 slots (1 vCPU + 1GB per sandbox) |
| CAP-002 | Runner at 0% capacity | `{ slots: 6, active: 0 }` | `{ utilization: 0, hasCapacity: true }` |
| CAP-003 | Runner at 80% capacity (threshold) | `{ slots: 6, active: 5 }` | `{ utilization: 83, hasCapacity: false }` |
| CAP-004 | Runner at 100% capacity | `{ slots: 6, active: 6 }` | `{ utilization: 100, hasCapacity: false }` |
| CAP-005 | Select runner with most available capacity | 3 runners with varying load | Picks runner with lowest utilization |
| CAP-006 | No runner has capacity | all runners full | Returns null (triggers provisioning) |
| CAP-007 | Runner is empty (teardown candidate) | `{ active: 0, age: '2h' }` | `{ canTeardown: true }` |
| CAP-008 | Runner is empty but too new | `{ active: 0, age: '5m' }` | `{ canTeardown: false }` (grace period) |

### 1.3 Config Validation

| TC | Description | Input | Expected |
|----|-------------|-------|----------|
| CFG-001 | Valid Hetzner config | `{ apiToken, location, serverType }` | Passes validation |
| CFG-002 | Missing Hetzner API token | `{ location, serverType }` | Throws `ConfigValidationError` |
| CFG-003 | Invalid server type | `{ serverType: 'xxx' }` | Throws with valid options listed |
| CFG-004 | Valid local-docker config | `{ dockerSocket }` | Passes validation |
| CFG-005 | Provider selection | `{ provider: 'hetzner' }` | Returns HetznerProvider class |
| CFG-006 | Unknown provider | `{ provider: 'azure' }` | Throws `UnsupportedProviderError` |

### 1.4 Health Check Logic

| TC | Description | Input | Expected |
|----|-------------|-------|----------|
| HC-001 | Healthy runner response | `{ ping: 50ms, cpu: 40%, sandboxes: 3 }` | `status: 'healthy'` |
| HC-002 | Slow runner response | `{ ping: 5000ms }` | `status: 'degraded'` |
| HC-003 | No response (timeout) | `{ ping: timeout }` | `status: 'unreachable'` |
| HC-004 | Runner overloaded | `{ cpu: 95%, memory: 90% }` | `status: 'overloaded'` |
| HC-005 | Consecutive failures trigger recovery | 3 x `unreachable` | `action: 'recover'` |
| HC-006 | Single failure does not trigger recovery | 1 x `unreachable` | `action: 'retry'` |

---

## Layer 2: Integration Tests (CI — Local Docker + Daytona)

Requires Docker running. Uses Daytona's docker-compose for a real local control plane. Slower (~30-60s per test). Clean up after each test.

### 2.1 Local Docker Provider

| TC | Description | Steps | Expected | Cleanup |
|----|-------------|-------|----------|---------|
| LD-001 | Create local runner container | Call `localProvider.createRunner()` | Docker container running, returns container ID | Remove container |
| LD-002 | List running runners | Create 2 runners, call `listRunners()` | Returns 2 entries with correct IDs | Remove both |
| LD-003 | Delete runner container | Create then delete | Container removed, `listRunners()` returns 0 | None (already cleaned) |
| LD-004 | Runner health check via Docker API | Create runner, call `checkHealth()` | Returns container stats (cpu, memory) | Remove container |
| LD-005 | Create runner with env vars | Pass `{ DAYTONA_API_URL, DAYTONA_RUNNER_TOKEN }` | Container has correct env vars | Remove container |
| LD-006 | Create runner is idempotent | Call `createRunner()` twice with same name | Second call returns existing, doesn't duplicate | Remove container |

### 2.2 Daytona Integration (Local Docker-Compose)

Prerequisites: `docker-compose up` from `docs/daytona/docker/docker-compose.yaml`

| TC | Description | Steps | Expected | Cleanup |
|----|-------------|-------|----------|---------|
| DT-001 | Runner registers with local Daytona | Start runner container pointing at local Daytona API | Runner appears in `GET /api/runner` list | Stop runner, deregister |
| DT-002 | Create sandbox on local runner | Register runner, call Daytona `POST /api/sandbox` | Sandbox created on local runner | Delete sandbox, deregister runner |
| DT-003 | Sandbox lifecycle: create -> stop -> delete | Full lifecycle on local runner | Each state transition succeeds | None (deleted) |
| DT-004 | Runner deregistration cleans up | Register then deregister runner | Runner removed from Daytona, no orphaned sandboxes | None |

### 2.3 CLI Integration

| TC | Description | Command | Expected |
|----|-------------|---------|----------|
| CLI-001 | `xerus-pod status` with no runners | `xerus-pod status` | "No runners configured" |
| CLI-002 | `xerus-pod up --provider local` | `xerus-pod up --provider local` | Local runner container created, status shows 1 runner |
| CLI-003 | `xerus-pod down` | `xerus-pod down` | All runners stopped and removed |
| CLI-004 | `xerus-pod scale --runners 3 --provider local` | Scale command | 3 Docker containers running |
| CLI-005 | `xerus-pod health` | Health check command | Table showing runner health status |
| CLI-006 | `xerus-pod up` with missing config | No `.env` or config file | Error with clear message about required config |

---

## Layer 3: E2E Tests (Manual — Real Hetzner)

Run manually before production deployments. Costs real money (~$0.01 per test run). Document results.

### 3.1 Hetzner VPS Provisioning

| TC | Description | Steps | Expected | Cleanup |
|----|-------------|-------|----------|---------|
| HZ-001 | Provision CX22 VPS | Call `hetznerProvider.createRunner({ type: 'cx22', location: 'nbg1' })` | VPS running within 60s, SSH accessible | Delete VPS |
| HZ-002 | Cloud-init bootstraps runner | Wait for cloud-init completion (~2-3 min) | Docker running, Daytona runner container up | Delete VPS |
| HZ-003 | Runner registers with control plane | Check Daytona API after cloud-init | Runner listed in `/api/runner` | Delete VPS, deregister |
| HZ-004 | Create sandbox on Hetzner runner | Full flow: provision VPS -> runner registers -> create sandbox | Sandbox accessible, workspace cloned | Delete sandbox, VPS |
| HZ-005 | Delete VPS cleans up | Delete VPS via Hetzner API | VPS gone, runner deregistered from Daytona | None |
| HZ-006 | Provision in different locations | `nbg1` (Nuremberg), `fsn1` (Falkenstein), `hel1` (Helsinki) | VPS created in each DC | Delete all |

### 3.2 Auto-Scaling E2E

| TC | Description | Steps | Expected | Cleanup |
|----|-------------|-------|----------|---------|
| AS-001 | Auto-provision when capacity full | Fill existing runner to 80%, trigger new sandbox request | New VPS provisioned automatically | Delete new VPS |
| AS-002 | Auto-teardown when empty | Remove all sandboxes from a runner, wait for grace period | Runner VPS deleted after idle timeout | None |
| AS-003 | Health recovery after VPS failure | Kill a runner VPS, wait for health check cycle | New VPS provisioned, sandboxes restored from snapshots | Delete replacement VPS |

### 3.3 Failure Scenarios

| TC | Description | Steps | Expected |
|----|-------------|-------|----------|
| FAIL-001 | Hetzner API timeout | Simulate slow network | Retry with backoff, fail after max retries |
| FAIL-002 | Invalid Hetzner API token | Use expired/wrong token | Clear error: "Hetzner authentication failed" |
| FAIL-003 | Cloud-init fails | Corrupt cloud-init script | Health check detects unhealthy, marks for recovery |
| FAIL-004 | Daytona runner won't start | Missing Docker on VPS | Health check detects, logs error, marks unhealthy |
| FAIL-005 | VPS out of stock | Request unavailable server type | Error with suggestion to try different type/location |

---

## Layer 4: Provider Contract Tests (CI)

Ensure all providers implement the same interface correctly. Run against each provider.

```typescript
// provider.contract.test.ts — runs against EVERY provider
interface ProviderContract {
    createRunner(opts: RunnerOpts): Promise<Runner>;
    deleteRunner(runnerId: string): Promise<void>;
    listRunners(): Promise<Runner[]>;
    getRunnerHealth(runnerId: string): Promise<HealthStatus>;
}

// Each provider runs the same test suite:
describe.each([
    ['local-docker', new LocalDockerProvider()],
    // ['hetzner', new HetznerProvider()],  // only in staging
])('Provider: %s', (name, provider) => {
    it('creates a runner', async () => { ... });
    it('lists runners including the created one', async () => { ... });
    it('reports runner health', async () => { ... });
    it('deletes the runner', async () => { ... });
    it('list is empty after delete', async () => { ... });
});
```

---

## Test Environment Setup

### CI (GitHub Actions)

```yaml
# .github/workflows/test.yml
jobs:
  unit:
    runs-on: ubuntu-latest
    steps:
      - run: npm test -- --testPathPattern="unit"
    # No Docker needed, fast

  integration:
    runs-on: ubuntu-latest
    services:
      docker:
        image: docker:dind
        options: --privileged
    steps:
      - run: docker-compose -f templates/docker-compose.test.yaml up -d
      - run: npm test -- --testPathPattern="integration"
      - run: docker-compose -f templates/docker-compose.test.yaml down -v
    # Requires Docker, ~2 min

  # E2E: manual trigger only
  e2e-hetzner:
    if: github.event_name == 'workflow_dispatch'
    runs-on: ubuntu-latest
    environment: staging
    steps:
      - run: npm test -- --testPathPattern="e2e"
    # Costs money, manual only
```

### Local Dev

```bash
# Unit tests (no deps)
npm test -- --testPathPattern="unit"

# Integration tests (needs Docker)
docker-compose -f templates/docker-compose.test.yaml up -d
npm test -- --testPathPattern="integration"
docker-compose -f templates/docker-compose.test.yaml down -v

# E2E (needs Hetzner API key in .env)
HETZNER_API_TOKEN=xxx npm test -- --testPathPattern="e2e"
```

---

## Test Data Management

### Naming Convention
All test resources use prefix `xpod-test-` for easy identification and cleanup:
- VPS: `xpod-test-{timestamp}`
- Containers: `xpod-test-runner-{n}`
- Labels: `{ purpose: 'test', created_by: 'xerus-pod-ci' }`

### Cleanup Strategy

| Layer | Strategy |
|-------|----------|
| Unit | No cleanup needed (no external state) |
| Integration | `afterAll`: stop + remove Docker containers with `xpod-test-` prefix |
| E2E | `afterAll`: delete VPS with `xpod-test-` label. **Failsafe**: cron job deletes any `xpod-test-*` VPS older than 1 hour |

### Failsafe Cleanup Script
```bash
# Run daily in CI to catch leaked test resources
xerus-pod cleanup --prefix xpod-test --older-than 1h --force
```

---

## Coverage Targets

| Layer | Target | Rationale |
|-------|--------|-----------|
| Unit | 90%+ | Pure logic, easy to test |
| Integration | 70%+ | Docker-dependent, slower |
| E2E | Critical paths only | Costs money |
| Contract | 100% of interface methods | Ensures provider compatibility |

---

## Test Priority for MVP

### Must Have (before beta):
- [ ] CI-001 to CI-007 (cloud-init generation)
- [ ] CAP-001 to CAP-006 (capacity math)
- [ ] CFG-001 to CFG-006 (config validation)
- [ ] LD-001 to LD-003 (local Docker CRUD)
- [ ] CLI-001 to CLI-003 (basic CLI)
- [ ] HZ-001 to HZ-003 (Hetzner provisioning — manual)
- [ ] Provider contract tests

### Should Have (before GA):
- [ ] HC-001 to HC-006 (health check logic)
- [ ] DT-001 to DT-004 (Daytona integration)
- [ ] AS-001 to AS-002 (auto-scaling)
- [ ] FAIL-001 to FAIL-005 (failure scenarios)
- [ ] CLI-004 to CLI-006 (advanced CLI)

### Nice to Have:
- [ ] AS-003 (auto-recovery E2E)
- [ ] HZ-004 to HZ-006 (advanced Hetzner tests)
- [ ] Performance/load testing
- [ ] Multi-provider concurrent testing
