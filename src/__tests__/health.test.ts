import { evaluateRunnerState, shouldRecover, buildHealthStatus } from '../health';

// HC-001: Healthy runner response
describe('evaluateRunnerState', () => {
    it('returns healthy for normal ping and metrics', () => {
        const state = evaluateRunnerState(
            { latency_ms: 50, ok: true },
            { cpu_percent: 40, memory_percent: 50, sandbox_count: 3 },
        );
        expect(state).toBe('healthy');
    });

    // HC-002: Slow runner response
    it('returns degraded for slow ping', () => {
        const state = evaluateRunnerState(
            { latency_ms: 6000, ok: true },
            { cpu_percent: 40, memory_percent: 50, sandbox_count: 3 },
        );
        expect(state).toBe('degraded');
    });

    // HC-003: No response
    it('returns unreachable when ping fails', () => {
        const state = evaluateRunnerState(null, null);
        expect(state).toBe('unreachable');
    });

    it('returns unreachable when ping is not ok', () => {
        const state = evaluateRunnerState(
            { latency_ms: 100, ok: false },
            null,
        );
        expect(state).toBe('unreachable');
    });

    // HC-004: Runner overloaded
    it('returns overloaded for high CPU', () => {
        const state = evaluateRunnerState(
            { latency_ms: 50, ok: true },
            { cpu_percent: 95, memory_percent: 50, sandbox_count: 5 },
        );
        expect(state).toBe('overloaded');
    });

    it('returns overloaded for high memory', () => {
        const state = evaluateRunnerState(
            { latency_ms: 50, ok: true },
            { cpu_percent: 40, memory_percent: 95, sandbox_count: 5 },
        );
        expect(state).toBe('overloaded');
    });

    it('returns healthy when metrics are null but ping ok', () => {
        const state = evaluateRunnerState(
            { latency_ms: 50, ok: true },
            null,
        );
        expect(state).toBe('healthy');
    });
});

// HC-005, HC-006: Recovery decisions
describe('shouldRecover', () => {
    it('retries on single failure', () => {
        expect(shouldRecover(1)).toEqual({ action: 'retry' });
    });

    it('retries on two failures', () => {
        expect(shouldRecover(2)).toEqual({ action: 'retry' });
    });

    it('recovers after three consecutive failures', () => {
        expect(shouldRecover(3)).toEqual({ action: 'recover' });
    });

    it('recovers after more than three failures', () => {
        expect(shouldRecover(5)).toEqual({ action: 'recover' });
    });
});

describe('buildHealthStatus', () => {
    it('builds a complete health status object', () => {
        const status = buildHealthStatus({
            runner_state: 'healthy',
            api_healthy: true,
            snapshot_registered: true,
            containers: [{ name: 'api', status: 'running', health: 'healthy' }],
        });

        expect(status.runner).toBe('healthy');
        expect(status.api_healthy).toBe(true);
        expect(status.snapshot_registered).toBe(true);
        expect(status.containers).toHaveLength(1);
        expect(status.checked_at).toBeDefined();
    });
});
