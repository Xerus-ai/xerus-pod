// Config — loads provider selection and provider-specific settings from env vars

import type { ComputeProviderConfig } from './providers/compute/compute-provider.js';
import type { RuntimeProviderConfig } from './providers/runtime/runtime-provider.js';
import type { CapacityThresholds } from './types.js';

export interface PodConfig {
    compute: ComputeProviderConfig;
    runtime: RuntimeProviderConfig;
    thresholds?: Partial<CapacityThresholds>;
    image_name: string;
}

export function loadConfigFromEnv(): PodConfig {
    const computeProvider = getEnvOrThrow('POD_COMPUTE_PROVIDER');
    const runtimeProvider = getEnvOrThrow('POD_RUNTIME_PROVIDER');

    return {
        compute: loadComputeConfig(computeProvider),
        runtime: loadRuntimeConfig(runtimeProvider),
        image_name: process.env.POD_IMAGE_NAME ?? 'xerus-sandbox',
    };
}

function loadComputeConfig(provider: string): ComputeProviderConfig {
    switch (provider) {
        case 'hetzner':
            return {
                provider: 'hetzner',
                api_token: getEnvOrThrow('HETZNER_API_TOKEN'),
                default_location: process.env.HETZNER_LOCATION ?? 'nbg1',
                default_server_type: process.env.HETZNER_SERVER_TYPE ?? 'cx32',
                default_image: process.env.HETZNER_IMAGE ?? 'ubuntu-24.04',
                ssh_key_name: process.env.HETZNER_SSH_KEY ?? 'xerus',
            };
        case 'digitalocean':
            return {
                provider: 'digitalocean',
                api_token: getEnvOrThrow('DO_API_TOKEN'),
                default_region: process.env.DO_REGION ?? 'nyc1',
                default_size: process.env.DO_SIZE ?? 's-4vcpu-8gb',
                default_image: process.env.DO_IMAGE ?? 'ubuntu-24-04-x64',
                ssh_key_id: getEnvOrThrow('DO_SSH_KEY_ID'),
            };
        case 'local-docker':
            return {
                provider: 'local-docker',
                docker_socket: process.env.DOCKER_SOCKET,
                network: process.env.DOCKER_NETWORK ?? 'xerus-pod',
            };
        default:
            throw new Error(`Unknown compute provider: '${provider}'`);
    }
}

function loadRuntimeConfig(provider: string): RuntimeProviderConfig {
    switch (provider) {
        case 'daytona':
            return {
                provider: 'daytona',
                api_url: process.env.DAYTONA_API_URL ?? 'http://localhost:3000/api',
                api_key: getEnvOrThrow('DAYTONA_API_KEY'),
                image_name: process.env.POD_IMAGE_NAME ?? 'xerus-sandbox',
            };
        case 'e2b':
            return {
                provider: 'e2b',
                api_key: getEnvOrThrow('E2B_API_KEY'),
                template_id: getEnvOrThrow('E2B_TEMPLATE_ID'),
            };
        case 'docker':
            return {
                provider: 'docker',
                socket: process.env.DOCKER_SOCKET,
                network: process.env.DOCKER_NETWORK ?? 'xerus-pod',
                base_image: process.env.DOCKER_SANDBOX_IMAGE ?? 'xerus-sandbox:latest',
            };
        default:
            throw new Error(`Unknown runtime provider: '${provider}'`);
    }
}

function getEnvOrThrow(key: string): string {
    const value = process.env[key];
    if (!value) throw new Error(`${key} is required`);
    return value;
}
