// RuntimeProvider — abstract interface for sandbox runtimes
// Implementations: Daytona, E2B, raw Docker

import type { RunnerInfo } from '../../types.js';

export interface SandboxInfo {
    id: string;
    machine_id?: string;
    state: string;
    created_at: string;
}

export interface SandboxImage {
    id: string;
    name: string;
    state: string;
}

export interface RuntimeHealth {
    api_healthy: boolean;
    api_latency_ms: number;
    image_registered: boolean;
    runner_count: number;
}

export interface RuntimeProvider {
    readonly name: string;

    listSandboxes(): Promise<SandboxInfo[]>;
    getSandboxCount(): Promise<number>;
    listImages(): Promise<SandboxImage[]>;
    hasImage(name: string): Promise<boolean>;
    listRunners(): Promise<RunnerInfo[]>;
    checkHealth(): Promise<RuntimeHealth>;
    validateConfig(): Promise<void>;
}

export interface RuntimeProviderConfig {
    provider: string;
    [key: string]: unknown;
}

export interface DaytonaConfig extends RuntimeProviderConfig {
    provider: 'daytona';
    api_url: string;
    api_key: string;
    image_name: string;
}

export interface E2BConfig extends RuntimeProviderConfig {
    provider: 'e2b';
    api_key: string;
    template_id: string;
}

export interface DockerRuntimeConfig extends RuntimeProviderConfig {
    provider: 'docker';
    socket?: string;
    network?: string;
    base_image: string;
}
