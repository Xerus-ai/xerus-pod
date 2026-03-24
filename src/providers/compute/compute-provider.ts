// ComputeProvider — abstract interface for provisioning machines
// Implementations: Hetzner, DigitalOcean, AWS EC2, local-docker

import type { Machine, MachineSpec, MachineState } from '../../types.js';

export interface ComputeProvider {
    readonly name: string;

    createMachine(spec: MachineSpec): Promise<Machine>;
    deleteMachine(id: string): Promise<void>;
    listMachines(): Promise<Machine[]>;
    getMachine(id: string): Promise<Machine>;
    getMachineState(id: string): Promise<MachineState>;
    validateConfig(): Promise<void>;
}

export interface ComputeProviderConfig {
    provider: string;
    [key: string]: unknown;
}

export interface HetznerConfig extends ComputeProviderConfig {
    provider: 'hetzner';
    api_token: string;
    default_location: string;
    default_server_type: string;
    default_image: string;
    ssh_key_name: string;
}

export interface DigitalOceanConfig extends ComputeProviderConfig {
    provider: 'digitalocean';
    api_token: string;
    default_region: string;
    default_size: string;
    default_image: string;
    ssh_key_id: string;
}

export interface LocalDockerConfig extends ComputeProviderConfig {
    provider: 'local-docker';
    docker_socket?: string;
    network?: string;
}
