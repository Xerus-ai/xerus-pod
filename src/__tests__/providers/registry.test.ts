import {
    registerComputeProvider,
    registerRuntimeProvider,
    createComputeProvider,
    createRuntimeProvider,
    listComputeProviders,
    listRuntimeProviders,
    clearProviders,
} from '../../providers/registry';
import type { ComputeProvider } from '../../providers/compute/compute-provider';
import type { RuntimeProvider } from '../../providers/runtime/runtime-provider';

describe('Provider Registry', () => {
    beforeEach(() => {
        clearProviders();
    });

    it('throws for unregistered compute provider', () => {
        expect(() => createComputeProvider({ provider: 'nonexistent' }))
            .toThrow("Unknown compute provider: 'nonexistent'");
    });

    it('throws for unregistered runtime provider', () => {
        expect(() => createRuntimeProvider({ provider: 'nonexistent' }))
            .toThrow("Unknown runtime provider: 'nonexistent'");
    });

    it('registers and creates compute provider', () => {
        const mockProvider: ComputeProvider = {
            name: 'test-compute',
            createMachine: jest.fn(),
            deleteMachine: jest.fn(),
            listMachines: jest.fn(),
            getMachine: jest.fn(),
            getMachineState: jest.fn(),
            validateConfig: jest.fn(),
        };

        registerComputeProvider('test-compute', () => mockProvider);
        const provider = createComputeProvider({ provider: 'test-compute' });
        expect(provider.name).toBe('test-compute');
    });

    it('registers and creates runtime provider', () => {
        const mockProvider: RuntimeProvider = {
            name: 'test-runtime',
            listSandboxes: jest.fn(),
            getSandboxCount: jest.fn(),
            listImages: jest.fn(),
            hasImage: jest.fn(),
            listRunners: jest.fn(),
            checkHealth: jest.fn(),
            validateConfig: jest.fn(),
        };

        registerRuntimeProvider('test-runtime', () => mockProvider);
        const provider = createRuntimeProvider({ provider: 'test-runtime' });
        expect(provider.name).toBe('test-runtime');
    });

    it('lists registered providers', () => {
        registerComputeProvider('list-test', () => ({ name: 'list-test' }) as any);
        registerRuntimeProvider('list-test-rt', () => ({ name: 'list-test-rt' }) as any);

        expect(listComputeProviders()).toContain('list-test');
        expect(listRuntimeProviders()).toContain('list-test-rt');
    });

    it('starts empty after clear', () => {
        expect(listComputeProviders()).toHaveLength(0);
        expect(listRuntimeProviders()).toHaveLength(0);
    });
});
