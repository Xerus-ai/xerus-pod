// Capacity monitoring — calculates sandbox slots and scale decisions

import type {
    CapacityInfo,
    CapacityThresholds,
    ScaleDecision,
} from './types.js';

const RESERVED_CPU = 1;        // Reserved for OS + Daytona services
const RESERVED_MEMORY_GB = 2;  // Reserved for OS + Daytona services

export type PlanType = 'pro' | 'max' | 'ultra';

export const PLAN_RESOURCES: Record<PlanType, { cpu: number; memory_gb: number }> = {
    pro:   { cpu: 1, memory_gb: 2 },
    max:   { cpu: 2, memory_gb: 4 },
    ultra: { cpu: 4, memory_gb: 8 },
};

// Weighted average CPU/memory per sandbox across a plan mix.
// Default assumes uniform Pro plan when plan mix is unknown.
const DEFAULT_CPU_PER_SANDBOX = 1;
const DEFAULT_MEMORY_PER_SANDBOX_GB = 2;

export function calculateMaxSandboxes(
    cpu: number,
    memory_gb: number,
    avg_cpu_per_sandbox = DEFAULT_CPU_PER_SANDBOX,
    avg_memory_per_sandbox = DEFAULT_MEMORY_PER_SANDBOX_GB,
): number {
    const available_cpu = Math.max(0, cpu - RESERVED_CPU);
    const available_memory = Math.max(0, memory_gb - RESERVED_MEMORY_GB);

    const cpu_slots = Math.floor(available_cpu / avg_cpu_per_sandbox);
    const memory_slots = Math.floor(available_memory / avg_memory_per_sandbox);

    return Math.min(cpu_slots, memory_slots);
}

export function calculateWeightedResources(
    plan_counts: Partial<Record<PlanType, number>>,
): { avg_cpu: number; avg_memory: number; total_cpu: number; total_memory: number } {
    let total_cpu = 0;
    let total_memory = 0;
    let total_sandboxes = 0;

    for (const [plan, count] of Object.entries(plan_counts) as [PlanType, number][]) {
        const resources = PLAN_RESOURCES[plan];
        if (resources && count > 0) {
            total_cpu += resources.cpu * count;
            total_memory += resources.memory_gb * count;
            total_sandboxes += count;
        }
    }

    return {
        avg_cpu: total_sandboxes > 0 ? total_cpu / total_sandboxes : DEFAULT_CPU_PER_SANDBOX,
        avg_memory: total_sandboxes > 0 ? total_memory / total_sandboxes : DEFAULT_MEMORY_PER_SANDBOX_GB,
        total_cpu,
        total_memory,
    };
}

export function calculateCapacity(
    cpu: number,
    memory_gb: number,
    active_sandboxes: number,
    plan_counts?: Partial<Record<PlanType, number>>,
): CapacityInfo {
    const weighted = plan_counts
        ? calculateWeightedResources(plan_counts)
        : { avg_cpu: DEFAULT_CPU_PER_SANDBOX, avg_memory: DEFAULT_MEMORY_PER_SANDBOX_GB, total_cpu: active_sandboxes * DEFAULT_CPU_PER_SANDBOX, total_memory: active_sandboxes * DEFAULT_MEMORY_PER_SANDBOX_GB };

    const max_sandboxes = calculateMaxSandboxes(cpu, memory_gb, weighted.avg_cpu, weighted.avg_memory);
    const utilization = max_sandboxes > 0
        ? Math.round((active_sandboxes / max_sandboxes) * 100)
        : 100;

    return {
        total_cpu: cpu,
        total_memory: memory_gb,
        used_cpu: weighted.total_cpu,
        used_memory: weighted.total_memory,
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
