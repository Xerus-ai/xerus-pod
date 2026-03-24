// xerus-pod types — provider-agnostic compute plane

// ── Machine (provider-agnostic compute unit) ────────────────────────────
export interface MachineSpec {
    name: string;
    size: string;           // Provider-specific: 'cx32', 's-4vcpu-8gb', 't3.medium'
    region: string;         // Provider-specific: 'nbg1', 'nyc1', 'us-east-1'
    image: string;          // OS image identifier
    ssh_key: string;
    labels: Record<string, string>;
}

export interface Machine {
    id: string;
    name: string;
    ip: string;
    cpu: number;
    memory: number;         // GB
    disk: number;           // GB
    state: MachineState;
    region: string;
    provider: string;
    created_at: string;
    raw?: unknown;          // Provider-specific data preserved for debugging
}

export type MachineState = 'running' | 'stopped' | 'starting' | 'error' | 'unknown';

// ── Runner (runtime's view of a compute node) ───────────────────────────
export interface RunnerInfo {
    id: string;
    name: string;
    domain: string;
    cpu: number;
    memory: number;
    disk: number;
    state: RunnerState;
    sandbox_count: number;
    created_at: string;
}

export type RunnerState = 'healthy' | 'degraded' | 'unreachable' | 'overloaded';

// ── Health ───────────────────────────────────────────────────────────────
export interface HealthStatus {
    runner: RunnerState;
    api_healthy: boolean;
    snapshot_registered: boolean;
    containers: ContainerStatus[];
    checked_at: string;
}

export interface ContainerStatus {
    name: string;
    status: 'running' | 'stopped' | 'restarting';
    health: string;
}

// ── Capacity ─────────────────────────────────────────────────────────────
export interface CapacityInfo {
    total_cpu: number;
    total_memory: number;
    used_cpu: number;
    used_memory: number;
    sandbox_count: number;
    max_sandboxes: number;
    utilization_percent: number;
    has_capacity: boolean;
}

export interface CapacityThresholds {
    scale_up_percent: number;
    scale_down_percent: number;
    grace_period_minutes: number;
    min_runners: number;
    max_runners: number;
}

export const DEFAULT_THRESHOLDS: CapacityThresholds = {
    scale_up_percent: 80,
    scale_down_percent: 10,
    grace_period_minutes: 30,
    min_runners: 1,
    max_runners: 5,
};

export interface ScaleDecision {
    action: 'scale_up' | 'scale_down' | 'none';
    reason: string;
    target_machine?: string;
}
