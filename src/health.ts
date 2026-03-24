// Health check — monitors Daytona API, runner, and containers

import type { HealthStatus, RunnerState, ContainerStatus } from './types.js';

const HEALTHY_PING_MS = 2000;
const DEGRADED_PING_MS = 5000;
const OVERLOADED_CPU_PERCENT = 90;
const OVERLOADED_MEMORY_PERCENT = 90;
const RECOVERY_THRESHOLD = 3;

interface PingResult {
    latency_ms: number;
    ok: boolean;
}

interface RunnerMetrics {
    cpu_percent: number;
    memory_percent: number;
    sandbox_count: number;
}

export function evaluateRunnerState(
    ping: PingResult | null,
    metrics: RunnerMetrics | null,
): RunnerState {
    if (!ping || !ping.ok) return 'unreachable';
    if (ping.latency_ms > DEGRADED_PING_MS) return 'degraded';

    if (metrics) {
        if (
            metrics.cpu_percent >= OVERLOADED_CPU_PERCENT ||
            metrics.memory_percent >= OVERLOADED_MEMORY_PERCENT
        ) {
            return 'overloaded';
        }
    }

    return 'healthy';
}

export function shouldRecover(
    consecutive_failures: number,
): { action: 'retry' | 'recover' } {
    if (consecutive_failures >= RECOVERY_THRESHOLD) {
        return { action: 'recover' };
    }
    return { action: 'retry' };
}

export function buildHealthStatus(params: {
    runner_state: RunnerState;
    api_healthy: boolean;
    snapshot_registered: boolean;
    containers: ContainerStatus[];
}): HealthStatus {
    return {
        runner: params.runner_state,
        api_healthy: params.api_healthy,
        snapshot_registered: params.snapshot_registered,
        containers: params.containers,
        checked_at: new Date().toISOString(),
    };
}
