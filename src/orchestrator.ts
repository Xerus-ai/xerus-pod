// Orchestrator — provider-agnostic entry point for xerus-pod
//
// Works against ComputeProvider + RuntimeProvider interfaces.
// Never imports Daytona, Hetzner, or any specific provider directly.
//
// Usage:
//   tsx src/orchestrator.ts status      # Show current state
//   tsx src/orchestrator.ts health      # Run health check
//   tsx src/orchestrator.ts capacity    # Show capacity info
//   tsx src/orchestrator.ts providers   # List available providers

import { loadConfigFromEnv } from './config.js';
import { createComputeProvider, createRuntimeProvider, listComputeProviders, listRuntimeProviders } from './providers/registry.js';
import { calculateCapacity, decideScale } from './capacity.js';
import { evaluateRunnerState, buildHealthStatus } from './health.js';
import { DEFAULT_THRESHOLDS } from './types.js';
import type { CapacityInfo, HealthStatus } from './types.js';

// Register available providers (side-effect imports)
import './providers/compute/hetzner.provider.js';
import './providers/compute/local-docker.provider.js';
import './providers/runtime/daytona.provider.js';

async function showStatus(): Promise<void> {
    const config = loadConfigFromEnv();
    const compute = createComputeProvider(config.compute);
    const runtime = createRuntimeProvider(config.runtime);

    console.log(`Compute: ${compute.name}`);
    console.log(`Runtime: ${runtime.name}`);

    const runners = await runtime.listRunners();
    console.log(`\nRunners: ${runners.length}`);
    for (const runner of runners) {
        console.log(`  ${runner.name} — ${runner.state}`);
    }

    const hasImage = await runtime.hasImage(config.image_name);
    console.log(`\nSandbox image (${config.image_name}): ${hasImage ? 'registered' : 'NOT registered'}`);

    const sandboxCount = await runtime.getSandboxCount();
    console.log(`Active sandboxes: ${sandboxCount}`);

    const machines = await compute.listMachines();
    console.log(`\nMachines: ${machines.length}`);
    for (const m of machines) {
        console.log(`  ${m.name} (${m.provider}) — ${m.ip} — ${m.cpu}vCPU/${m.memory}GB — ${m.state}`);
    }
}

async function showHealth(): Promise<HealthStatus> {
    const config = loadConfigFromEnv();
    const runtime = createRuntimeProvider(config.runtime);

    const runtimeHealth = await runtime.checkHealth();

    const runner_state = evaluateRunnerState(
        { latency_ms: runtimeHealth.api_latency_ms, ok: runtimeHealth.api_healthy },
        null,
    );

    const status = buildHealthStatus({
        runner_state,
        api_healthy: runtimeHealth.api_healthy,
        snapshot_registered: runtimeHealth.image_registered,
        containers: [],
    });

    console.log(`Health Check (runtime: ${runtime.name}):`);
    console.log(`  API:      ${status.api_healthy ? 'healthy' : 'down'} (${runtimeHealth.api_latency_ms}ms)`);
    console.log(`  Runner:   ${status.runner}`);
    console.log(`  Image:    ${status.snapshot_registered ? 'registered' : 'missing'}`);
    console.log(`  Runners:  ${runtimeHealth.runner_count}`);
    console.log(`  Checked:  ${status.checked_at}`);

    return status;
}

async function showCapacity(): Promise<void> {
    const config = loadConfigFromEnv();
    const runtime = createRuntimeProvider(config.runtime);

    const runners = await runtime.listRunners();

    const capacities: CapacityInfo[] = runners.map(runner =>
        calculateCapacity(runner.cpu, runner.memory, runner.sandbox_count),
    );

    console.log('Capacity:');
    for (let i = 0; i < runners.length; i++) {
        const r = runners[i];
        const c = capacities[i];
        console.log(`  ${r.name}: ${c.sandbox_count}/${c.max_sandboxes} sandboxes (${c.utilization_percent}%)`);
    }

    const thresholds = { ...DEFAULT_THRESHOLDS, ...config.thresholds };
    const decision = decideScale(capacities, thresholds);
    console.log(`\nScale decision: ${decision.action} — ${decision.reason}`);
}

function showProviders(): void {
    console.log('Available providers:');
    console.log(`  Compute: ${listComputeProviders().join(', ')}`);
    console.log(`  Runtime: ${listRuntimeProviders().join(', ')}`);
    console.log('\nConfigure via env vars:');
    console.log('  POD_COMPUTE_PROVIDER=hetzner|digitalocean|local-docker');
    console.log('  POD_RUNTIME_PROVIDER=daytona|e2b|docker');
}

// CLI entry point
const command = process.argv[2] ?? 'status';

switch (command) {
    case 'status':    showStatus().catch(console.error); break;
    case 'health':    showHealth().catch(console.error); break;
    case 'capacity':  showCapacity().catch(console.error); break;
    case 'providers': showProviders(); break;
    default:
        console.log('Usage: tsx src/orchestrator.ts [status|health|capacity|providers]');
        process.exit(1);
}
