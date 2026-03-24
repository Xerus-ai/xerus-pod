// Local Docker compute provider — for development
// "Machine" = a Docker container on the local Docker daemon

import type { ComputeProvider, LocalDockerConfig, ComputeProviderConfig } from './compute-provider.js';
import type { Machine, MachineSpec, MachineState } from '../../types.js';
import { registerComputeProvider } from '../registry.js';
import { spawnSync } from 'child_process';

const VALID_NAME = /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/;

function validateDockerName(value: string, label: string): void {
    if (!VALID_NAME.test(value)) {
        throw new Error(`Invalid ${label}: '${value}'. Must match ${VALID_NAME}`);
    }
}

function docker(...args: string[]): string {
    const result = spawnSync('docker', args, { encoding: 'utf-8', stdio: 'pipe' });
    if (result.status !== 0) {
        throw new Error(`docker ${args[0]} failed: ${result.stderr.trim()}`);
    }
    return result.stdout.trim();
}

export class LocalDockerProvider implements ComputeProvider {
    readonly name = 'local-docker';
    private readonly network: string;

    constructor(config: LocalDockerConfig) {
        this.network = config.network ?? 'xerus-pod';
    }

    async createMachine(spec: MachineSpec): Promise<Machine> {
        validateDockerName(spec.name, 'machine name');
        validateDockerName(this.network, 'network name');

        const id = docker(
            'run', '-d',
            '--name', spec.name,
            '--network', this.network,
            '--label', 'app=xerus-pod',
            spec.image,
            'sleep', 'infinity',
        );

        return {
            id,
            name: spec.name,
            ip: '127.0.0.1',
            cpu: 4,
            memory: 8,
            disk: 50,
            state: 'running',
            region: 'local',
            provider: 'local-docker',
            created_at: new Date().toISOString(),
        };
    }

    async deleteMachine(id: string): Promise<void> {
        validateDockerName(id, 'container id');
        docker('rm', '-f', id);
    }

    async listMachines(): Promise<Machine[]> {
        const output = docker(
            'ps', '-a',
            '--filter', 'label=app=xerus-pod',
            '--format', '{{.ID}}\t{{.Names}}\t{{.Status}}',
        );

        if (!output) return [];

        return output.split('\n').map(line => {
            const [id, name, status] = line.split('\t');
            return {
                id,
                name,
                ip: '127.0.0.1',
                cpu: 4,
                memory: 8,
                disk: 50,
                state: status.startsWith('Up') ? 'running' as const : 'stopped' as const,
                region: 'local',
                provider: 'local-docker',
                created_at: '',
            };
        });
    }

    async getMachine(id: string): Promise<Machine> {
        const machines = await this.listMachines();
        const machine = machines.find(m => m.id === id || m.name === id);
        if (!machine) throw new Error(`Machine not found: ${id}`);
        return machine;
    }

    async getMachineState(id: string): Promise<MachineState> {
        const machine = await this.getMachine(id);
        return machine.state;
    }

    async validateConfig(): Promise<void> {
        const result = spawnSync('docker', ['info'], { encoding: 'utf-8', stdio: 'pipe' });
        if (result.status !== 0) {
            throw new Error('Docker is not available. Is Docker running?');
        }
    }
}

registerComputeProvider('local-docker', (config) =>
    new LocalDockerProvider(config as LocalDockerConfig),
);
