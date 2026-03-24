// Daytona runtime provider — uses Daytona REST API

import type { RuntimeProvider, RuntimeHealth, DaytonaConfig, RuntimeProviderConfig, SandboxInfo, SandboxImage } from './runtime-provider.js';
import type { RunnerInfo } from '../../types.js';
import { registerRuntimeProvider } from '../registry.js';

interface DaytonaRunnerResponse {
    id: string;
    name: string;
    domain?: string;
    state?: string;
    resources?: { cpu?: number; memory?: number; disk?: number };
    createdAt?: string;
}

interface DaytonaSandboxResponse {
    id: string;
    runnerId?: string;
    state?: string;
    createdAt?: string;
}

export class DaytonaProvider implements RuntimeProvider {
    readonly name = 'daytona';
    private readonly apiUrl: string;
    private readonly apiKey: string;
    private readonly imageName: string;

    constructor(config: DaytonaConfig) {
        this.apiUrl = config.api_url;
        this.apiKey = config.api_key;
        this.imageName = config.image_name ?? 'xerus-sandbox';
    }

    async listSandboxes(): Promise<SandboxInfo[]> {
        const data = await this.api<DaytonaSandboxResponse[]>('/sandbox');
        return data.map(s => ({
            id: s.id,
            machine_id: s.runnerId,
            state: s.state ?? 'unknown',
            created_at: s.createdAt ?? '',
        }));
    }

    async getSandboxCount(): Promise<number> {
        const sandboxes = await this.listSandboxes();
        return sandboxes.length;
    }

    async listImages(): Promise<SandboxImage[]> {
        return this.api<SandboxImage[]>('/snapshot');
    }

    async hasImage(name: string): Promise<boolean> {
        const images = await this.listImages();
        return images.some(i => i.name === name);
    }

    async listRunners(): Promise<RunnerInfo[]> {
        const data = await this.api<DaytonaRunnerResponse[]>('/runner');
        const sandboxes = await this.listSandboxes();

        return data.map(r => ({
            id: r.id,
            name: r.name,
            domain: r.domain ?? '',
            cpu: r.resources?.cpu ?? 4,
            memory: r.resources?.memory ?? 8,
            disk: r.resources?.disk ?? 50,
            state: r.state === 'active' ? 'healthy' as const : 'degraded' as const,
            sandbox_count: sandboxes.filter(s => s.machine_id === r.id).length,
            created_at: r.createdAt ?? '',
        }));
    }

    async checkHealth(): Promise<RuntimeHealth> {
        const baseUrl = this.apiUrl.replace('/api', '');
        const start = Date.now();
        let api_healthy = false;

        try {
            const resp = await fetch(`${baseUrl}/health`);
            api_healthy = resp.ok;
        } catch {
            // Network failure (DNS, connection refused, timeout)
            api_healthy = false;
        }

        const api_latency_ms = Date.now() - start;
        let image_registered = false;
        let runner_count = 0;

        if (api_healthy) {
            // These may fail independently even when API is healthy
            try { image_registered = await this.hasImage(this.imageName); } catch { image_registered = false; }
            try { runner_count = (await this.listRunners()).length; } catch { runner_count = 0; }
        }

        return { api_healthy, api_latency_ms, image_registered, runner_count };
    }

    async validateConfig(): Promise<void> {
        const health = await this.checkHealth();
        if (!health.api_healthy) {
            throw new Error(`Daytona API not reachable at ${this.apiUrl}`);
        }
    }

    private async api<T>(path: string): Promise<T> {
        const resp = await fetch(`${this.apiUrl}${path}`, {
            headers: { Authorization: `Bearer ${this.apiKey}` },
        });
        if (!resp.ok) {
            throw new Error(`Daytona API ${path}: ${resp.status} ${resp.statusText}`);
        }
        return resp.json() as Promise<T>;
    }
}

registerRuntimeProvider('daytona', (config) => new DaytonaProvider(config as DaytonaConfig));
