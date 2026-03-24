import { calculateMaxSandboxes, calculateCapacity, decideScale, selectBestRunner } from '../capacity';
import { DEFAULT_THRESHOLDS } from '../types';
import type { CapacityInfo, CapacityThresholds } from '../types';

// CAP-001: Calculate sandbox slots from VPS specs
describe('calculateMaxSandboxes', () => {
    it('returns correct slots for CX32 (4 vCPU, 8GB)', () => {
        const slots = calculateMaxSandboxes(4, 8);
        // 4-1=3 CPU slots, 8-2=6 memory slots, min=3
        expect(slots).toBe(3);
    });

    it('returns correct slots for CX42 (8 vCPU, 16GB)', () => {
        const slots = calculateMaxSandboxes(8, 16);
        // 8-1=7 CPU, 16-2=14 memory, min=7
        expect(slots).toBe(7);
    });

    it('returns 0 when resources too small', () => {
        expect(calculateMaxSandboxes(1, 1)).toBe(0);
    });

    it('returns 0 for zero resources', () => {
        expect(calculateMaxSandboxes(0, 0)).toBe(0);
    });
});

// CAP-002 through CAP-004: Capacity at various utilization levels
describe('calculateCapacity', () => {
    it('reports 0% utilization with no sandboxes', () => {
        const cap = calculateCapacity(4, 8, 0);
        expect(cap.utilization_percent).toBe(0);
        expect(cap.has_capacity).toBe(true);
        expect(cap.sandbox_count).toBe(0);
    });

    it('reports correct utilization near threshold', () => {
        // CX32: max 3 sandboxes, 2 active = 67%
        const cap = calculateCapacity(4, 8, 2);
        expect(cap.utilization_percent).toBe(67);
        expect(cap.has_capacity).toBe(true);
    });

    it('reports 100% when at max capacity', () => {
        const cap = calculateCapacity(4, 8, 3);
        expect(cap.utilization_percent).toBe(100);
        expect(cap.has_capacity).toBe(false);
    });

    it('reports 100% when resources are zero', () => {
        const cap = calculateCapacity(0, 0, 0);
        expect(cap.utilization_percent).toBe(100);
        expect(cap.has_capacity).toBe(false);
    });
});

// CAP-005: Select runner with most available capacity
describe('selectBestRunner', () => {
    it('picks runner with lowest utilization', () => {
        const runners: CapacityInfo[] = [
            { total_cpu: 4, total_memory: 8, used_cpu: 2, used_memory: 2, sandbox_count: 2, max_sandboxes: 3, utilization_percent: 67, has_capacity: true },
            { total_cpu: 8, total_memory: 16, used_cpu: 1, used_memory: 1, sandbox_count: 1, max_sandboxes: 7, utilization_percent: 14, has_capacity: true },
            { total_cpu: 4, total_memory: 8, used_cpu: 3, used_memory: 3, sandbox_count: 3, max_sandboxes: 3, utilization_percent: 100, has_capacity: false },
        ];
        const best = selectBestRunner(runners);
        expect(best).not.toBeNull();
        expect(best!.utilization_percent).toBe(14);
    });

    // CAP-006: No runner has capacity
    it('returns null when all runners are full', () => {
        const runners: CapacityInfo[] = [
            { total_cpu: 4, total_memory: 8, used_cpu: 3, used_memory: 3, sandbox_count: 3, max_sandboxes: 3, utilization_percent: 100, has_capacity: false },
        ];
        expect(selectBestRunner(runners)).toBeNull();
    });

    it('returns null for empty array', () => {
        expect(selectBestRunner([])).toBeNull();
    });
});

// Scale decisions
describe('decideScale', () => {
    const thresholds: CapacityThresholds = { ...DEFAULT_THRESHOLDS, max_runners: 3, min_runners: 1 };

    it('scales up when no runners exist and min_runners > 0', () => {
        const decision = decideScale([], thresholds);
        expect(decision.action).toBe('scale_up');
    });

    it('returns none when no runners and max_runners is 0', () => {
        const disabled = { ...thresholds, max_runners: 0, min_runners: 0 };
        const decision = decideScale([], disabled);
        expect(decision.action).toBe('none');
    });

    it('scales up when all runners above threshold', () => {
        const runners: CapacityInfo[] = [
            { total_cpu: 4, total_memory: 8, used_cpu: 3, used_memory: 3, sandbox_count: 3, max_sandboxes: 3, utilization_percent: 100, has_capacity: false },
        ];
        const decision = decideScale(runners, thresholds);
        expect(decision.action).toBe('scale_up');
    });

    it('does not scale up past max_runners', () => {
        const runners: CapacityInfo[] = Array.from({ length: 3 }, () => ({
            total_cpu: 4, total_memory: 8, used_cpu: 3, used_memory: 3,
            sandbox_count: 3, max_sandboxes: 3, utilization_percent: 100, has_capacity: false,
        }));
        const decision = decideScale(runners, thresholds);
        expect(decision.action).toBe('none');
    });

    it('scales down idle runner', () => {
        const runners: CapacityInfo[] = [
            { total_cpu: 4, total_memory: 8, used_cpu: 2, used_memory: 2, sandbox_count: 2, max_sandboxes: 3, utilization_percent: 67, has_capacity: true },
            { total_cpu: 4, total_memory: 8, used_cpu: 0, used_memory: 0, sandbox_count: 0, max_sandboxes: 3, utilization_percent: 0, has_capacity: true },
        ];
        const decision = decideScale(runners, thresholds);
        expect(decision.action).toBe('scale_down');
    });

    it('does not scale below min_runners', () => {
        const runners: CapacityInfo[] = [
            { total_cpu: 4, total_memory: 8, used_cpu: 0, used_memory: 0, sandbox_count: 0, max_sandboxes: 3, utilization_percent: 0, has_capacity: true },
        ];
        const decision = decideScale(runners, thresholds);
        expect(decision.action).toBe('none');
    });

    it('returns none when within thresholds', () => {
        const runners: CapacityInfo[] = [
            { total_cpu: 8, total_memory: 16, used_cpu: 3, used_memory: 3, sandbox_count: 3, max_sandboxes: 7, utilization_percent: 43, has_capacity: true },
        ];
        const decision = decideScale(runners, thresholds);
        expect(decision.action).toBe('none');
    });
});
