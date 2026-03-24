import { loadConfigFromEnv } from '../config';

describe('loadConfigFromEnv', () => {
    const originalEnv = process.env;

    beforeEach(() => {
        process.env = { ...originalEnv };
    });

    afterAll(() => {
        process.env = originalEnv;
    });

    it('throws when POD_COMPUTE_PROVIDER is missing', () => {
        delete process.env.POD_COMPUTE_PROVIDER;
        expect(() => loadConfigFromEnv()).toThrow('POD_COMPUTE_PROVIDER is required');
    });

    it('throws when POD_RUNTIME_PROVIDER is missing', () => {
        process.env.POD_COMPUTE_PROVIDER = 'local-docker';
        delete process.env.POD_RUNTIME_PROVIDER;
        expect(() => loadConfigFromEnv()).toThrow('POD_RUNTIME_PROVIDER is required');
    });

    it('throws for unknown compute provider', () => {
        process.env.POD_COMPUTE_PROVIDER = 'azure';
        process.env.POD_RUNTIME_PROVIDER = 'daytona';
        process.env.DAYTONA_API_KEY = 'test';
        expect(() => loadConfigFromEnv()).toThrow("Unknown compute provider: 'azure'");
    });

    it('throws for unknown runtime provider', () => {
        process.env.POD_COMPUTE_PROVIDER = 'local-docker';
        process.env.POD_RUNTIME_PROVIDER = 'lambda';
        expect(() => loadConfigFromEnv()).toThrow("Unknown runtime provider: 'lambda'");
    });

    it('loads local-docker + daytona config', () => {
        process.env.POD_COMPUTE_PROVIDER = 'local-docker';
        process.env.POD_RUNTIME_PROVIDER = 'daytona';
        process.env.DAYTONA_API_KEY = 'test-key';

        const config = loadConfigFromEnv();

        expect(config.compute.provider).toBe('local-docker');
        expect(config.runtime.provider).toBe('daytona');
        expect(config.runtime['api_key']).toBe('test-key');
        expect(config.image_name).toBe('xerus-sandbox');
    });

    it('loads hetzner + daytona config', () => {
        process.env.POD_COMPUTE_PROVIDER = 'hetzner';
        process.env.POD_RUNTIME_PROVIDER = 'daytona';
        process.env.HETZNER_API_TOKEN = 'hcloud-token';
        process.env.DAYTONA_API_KEY = 'daytona-key';
        process.env.HETZNER_LOCATION = 'fsn1';

        const config = loadConfigFromEnv();

        expect(config.compute.provider).toBe('hetzner');
        expect(config.compute['api_token']).toBe('hcloud-token');
        expect(config.compute['default_location']).toBe('fsn1');
    });

    it('throws when hetzner token is missing', () => {
        process.env.POD_COMPUTE_PROVIDER = 'hetzner';
        process.env.POD_RUNTIME_PROVIDER = 'daytona';
        process.env.DAYTONA_API_KEY = 'key';
        delete process.env.HETZNER_API_TOKEN;

        expect(() => loadConfigFromEnv()).toThrow('HETZNER_API_TOKEN is required');
    });

    it('throws when daytona key is missing', () => {
        process.env.POD_COMPUTE_PROVIDER = 'local-docker';
        process.env.POD_RUNTIME_PROVIDER = 'daytona';
        delete process.env.DAYTONA_API_KEY;

        expect(() => loadConfigFromEnv()).toThrow('DAYTONA_API_KEY is required');
    });

    it('uses custom POD_IMAGE_NAME', () => {
        process.env.POD_COMPUTE_PROVIDER = 'local-docker';
        process.env.POD_RUNTIME_PROVIDER = 'daytona';
        process.env.DAYTONA_API_KEY = 'key';
        process.env.POD_IMAGE_NAME = 'custom-image';

        const config = loadConfigFromEnv();
        expect(config.image_name).toBe('custom-image');
    });

    it('loads e2b runtime config', () => {
        process.env.POD_COMPUTE_PROVIDER = 'local-docker';
        process.env.POD_RUNTIME_PROVIDER = 'e2b';
        process.env.E2B_API_KEY = 'e2b-key';
        process.env.E2B_TEMPLATE_ID = 'tmpl-123';

        const config = loadConfigFromEnv();
        expect(config.runtime.provider).toBe('e2b');
        expect(config.runtime['api_key']).toBe('e2b-key');
        expect(config.runtime['template_id']).toBe('tmpl-123');
    });

    it('loads digitalocean compute config', () => {
        process.env.POD_COMPUTE_PROVIDER = 'digitalocean';
        process.env.POD_RUNTIME_PROVIDER = 'daytona';
        process.env.DO_API_TOKEN = 'do-token';
        process.env.DO_SSH_KEY_ID = 'key-123';
        process.env.DAYTONA_API_KEY = 'key';

        const config = loadConfigFromEnv();
        expect(config.compute.provider).toBe('digitalocean');
        expect(config.compute['api_token']).toBe('do-token');
    });
});
