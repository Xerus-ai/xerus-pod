// Hetzner Cloud compute provider — uses Hetzner API directly

import type { ComputeProvider, HetznerConfig, ComputeProviderConfig } from './compute-provider.js';
import type { Machine, MachineSpec, MachineState } from '../../types.js';
import { registerComputeProvider } from '../registry.js';

interface HetznerServerResponse {
    id: number;
    name: string;
    status: string;
    public_net: { ipv4: { ip: string }; ipv6: { ip: string } };
    server_type: { name: string; cores: number; memory: number; disk: number };
    datacenter: { name: string; location: { name: string } };
    labels: Record<string, string>;
    created: string;
}

export class HetznerProvider implements ComputeProvider {
    readonly name = 'hetzner';
    private readonly token: string;
    private readonly baseUrl = 'https://api.hetzner.cloud/v1';

    constructor(config: HetznerConfig) {
        this.token = config.api_token;
    }

    async createMachine(spec: MachineSpec): Promise<Machine> {
        const resp = await this.api<{ server: HetznerServerResponse }>('POST', '/servers', {
            name: spec.name,
            server_type: spec.size,
            location: spec.region,
            image: spec.image,
            ssh_keys: [spec.ssh_key],
            labels: { ...spec.labels, app: 'xerus-pod' },
        });
        return this.toMachine(resp.server);
    }

    async deleteMachine(id: string): Promise<void> {
        await this.api('DELETE', `/servers/${id}`);
    }

    async listMachines(): Promise<Machine[]> {
        const resp = await this.api<{ servers: HetznerServerResponse[] }>(
            'GET', '/servers?label_selector=app=xerus-pod',
        );
        return resp.servers.map(s => this.toMachine(s));
    }

    async getMachine(id: string): Promise<Machine> {
        const resp = await this.api<{ server: HetznerServerResponse }>('GET', `/servers/${id}`);
        return this.toMachine(resp.server);
    }

    async getMachineState(id: string): Promise<MachineState> {
        const machine = await this.getMachine(id);
        return machine.state;
    }

    async validateConfig(): Promise<void> {
        await this.api('GET', '/ssh_keys?per_page=1');
    }

    private toMachine(server: HetznerServerResponse): Machine {
        return {
            id: String(server.id),
            name: server.name,
            ip: server.public_net.ipv4.ip,
            cpu: server.server_type.cores,
            memory: server.server_type.memory,
            disk: server.server_type.disk,
            state: this.mapState(server.status),
            region: server.datacenter.location.name,
            provider: 'hetzner',
            created_at: server.created,
            raw: server,
        };
    }

    private mapState(status: string): MachineState {
        const map: Record<string, MachineState> = {
            running: 'running',
            off: 'stopped',
            starting: 'starting',
            stopping: 'starting',     // Transitional — not yet stopped
            migrating: 'starting',    // Transitional — not fully available
            rebuilding: 'starting',
            deleting: 'stopped',
        };
        return map[status] ?? 'unknown';
    }

    private async api<T = unknown>(method: string, path: string, body?: unknown): Promise<T> {
        const resp = await fetch(`${this.baseUrl}${path}`, {
            method,
            headers: {
                Authorization: `Bearer ${this.token}`,
                'Content-Type': 'application/json',
            },
            body: body ? JSON.stringify(body) : undefined,
        });
        if (!resp.ok) {
            throw new Error(`Hetzner API ${method} ${path}: ${resp.status} ${resp.statusText}`);
        }
        if (resp.status === 204) return {} as T;
        return resp.json() as Promise<T>;
    }
}

registerComputeProvider('hetzner', (config) => new HetznerProvider(config as HetznerConfig));
