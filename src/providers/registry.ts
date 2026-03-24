// Provider registry — maps provider names to factory functions

import type { ComputeProvider, ComputeProviderConfig } from './compute/compute-provider.js';
import type { RuntimeProvider, RuntimeProviderConfig } from './runtime/runtime-provider.js';

type ComputeFactory = (config: ComputeProviderConfig) => ComputeProvider;
type RuntimeFactory = (config: RuntimeProviderConfig) => RuntimeProvider;

const computeProviders = new Map<string, ComputeFactory>();
const runtimeProviders = new Map<string, RuntimeFactory>();

export function registerComputeProvider(name: string, factory: ComputeFactory): void {
    computeProviders.set(name, factory);
}

export function registerRuntimeProvider(name: string, factory: RuntimeFactory): void {
    runtimeProviders.set(name, factory);
}

export function createComputeProvider(config: ComputeProviderConfig): ComputeProvider {
    const factory = computeProviders.get(config.provider);
    if (!factory) {
        const available = Array.from(computeProviders.keys()).join(', ');
        throw new Error(`Unknown compute provider: '${config.provider}'. Available: ${available}`);
    }
    return factory(config);
}

export function createRuntimeProvider(config: RuntimeProviderConfig): RuntimeProvider {
    const factory = runtimeProviders.get(config.provider);
    if (!factory) {
        const available = Array.from(runtimeProviders.keys()).join(', ');
        throw new Error(`Unknown runtime provider: '${config.provider}'. Available: ${available}`);
    }
    return factory(config);
}

export function listComputeProviders(): string[] {
    return Array.from(computeProviders.keys());
}

export function listRuntimeProviders(): string[] {
    return Array.from(runtimeProviders.keys());
}

export function clearProviders(): void {
    computeProviders.clear();
    runtimeProviders.clear();
}
