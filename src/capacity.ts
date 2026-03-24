// Capacity monitoring — calculates sandbox slots and scale decisions

import type {
    CapacityInfo,
    CapacityThresholds,
    ScaleDecision,
} from './types.js';

const CPU_PER_SANDBOX = 1;
const MEMORY_PER_SANDBOX_GB = 1;
const RESERVED_CPU = 1;        // Reserved for OS + Daytona services
const RESERVED_MEMORY_GB = 2;  // Reserved for OS + Daytona services

export function calculateMaxSandboxes(cpu: number, memory_gb: number): number {
    const available_cpu = Math.max(0, cpu - RESERVED_CPU);
    const available_memory = Math.max(0, memory_gb - RESERVED_MEMORY_GB);

    const cpu_slots = Math.floor(available_cpu / CPU_PER_SANDBOX);
    const memory_slots = Math.floor(available_memory / MEMORY_PER_SANDBOX_GB);

    return Math.min(cpu_slots, memory_slots);
}

export function calculateCapacity(
    cpu: number,
    memory_gb: number,
    active_sandboxes: number,
): CapacityInfo {
    const max_sandboxes = calculateMaxSandboxes(cpu, memory_gb);
    const utilization = max_sandboxes > 0
        ? Math.round((active_sandboxes / max_sandboxes) * 100)
        : 100;

    return {
        total_cpu: cpu,
        total_memory: memory_gb,
        used_cpu: active_sandboxes * CPU_PER_SANDBOX,
        used_memory: active_sandboxes * MEMORY_PER_SANDBOX_GB,
        sandbox_count: active_sandboxes,
        max_sandboxes,
        utilization_percent: utilization,
        has_capacity: active_sandboxes < max_sandboxes,
    };
}

export function decideScale(
    runners: CapacityInfo[],
    thresholds: CapacityThresholds,
): ScaleDecision {
    if (runners.length === 0) {
        if (thresholds.min_runners <= 0 || thresholds.max_runners <= 0) {
            return { action: 'none', reason: 'Auto-scaling disabled (max_runners=0)' };
        }
        return { action: 'scale_up', reason: 'No runners available' };
    }

    // Check if all runners are above scale_up threshold
    const all_overloaded = runners.every(
        r => r.utilization_percent >= thresholds.scale_up_percent,
    );

    if (all_overloaded && runners.length < thresholds.max_runners) {
        return {
            action: 'scale_up',
            reason: `All ${runners.length} runners above ${thresholds.scale_up_percent}% utilization`,
        };
    }

    // Check if any runner is below scale_down threshold (candidate for teardown)
    const idle_runners = runners.filter(
        r => r.utilization_percent <= thresholds.scale_down_percent && r.sandbox_count === 0,
    );

    if (idle_runners.length > 0 && runners.length > thresholds.min_runners) {
        return {
            action: 'scale_down',
            reason: `${idle_runners.length} idle runner(s) below ${thresholds.scale_down_percent}% utilization`,
        };
    }

    return { action: 'none', reason: 'Capacity within thresholds' };
}

export function selectBestRunner(runners: CapacityInfo[]): CapacityInfo | null {
    const available = runners.filter(r => r.has_capacity);
    if (available.length === 0) return null;

    // Pick runner with lowest utilization
    return available.reduce((best, runner) =>
        runner.utilization_percent < best.utilization_percent ? runner : best,
    );
}
