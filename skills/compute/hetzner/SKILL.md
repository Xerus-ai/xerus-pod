# Hetzner Server Management

Manage Hetzner Cloud VPS instances for the Xerus compute plane using `hcloud` CLI.

## Prerequisites

- `hcloud` CLI installed: `brew install hcloud` or `apt install hcloud-cli`
- Context configured: `hcloud context create xerus` (prompts for API token)

## Common Operations

### List servers

```bash
hcloud server list -l app=xerus-pod
```

### Create a VPS

```bash
hcloud server create \
    --name xerus-pod-1 \
    --type cx32 \
    --location nbg1 \
    --image ubuntu-24.04 \
    --ssh-key xerus \
    --label app=xerus-pod \
    --label env=production
```

### Server types for Xerus

| Type | vCPU | RAM | Disk | Sandbox Slots | Monthly |
|------|------|-----|------|---------------|---------|
| cx22 | 2 | 4GB | 40GB | ~2 | ~$4 |
| cx32 | 4 | 8GB | 80GB | ~5 | ~$7 |
| cx42 | 8 | 16GB | 160GB | ~13 | ~$14 |
| cx52 | 16 | 32GB | 320GB | ~29 | ~$28 |

Slot formula: `min(cpu - 1, memory_gb - 2)` (1 vCPU + 1GB per sandbox, reserves for OS)

### Locations

| Code | City | Region |
|------|------|--------|
| nbg1 | Nuremberg | EU |
| fsn1 | Falkenstein | EU |
| hel1 | Helsinki | EU |
| ash | Ashburn | US |
| hil | Hillsboro | US |

### SSH into server

```bash
hcloud server ssh xerus-pod-1
```

### Delete server

```bash
hcloud server delete xerus-pod-1
```

### Delete all xerus-pod servers

```bash
hcloud server list -l app=xerus-pod -o noheader -o columns=name | xargs -I{} hcloud server delete {}
```

## Bootstrap Flow

1. `hcloud server create` with cloud-init
2. `scp config/prod.env root@<IP>:/opt/xerus-pod/.env`
3. `ssh root@<IP> 'cd /opt/xerus-pod && bash scripts/setup.sh --prod'`
4. Get API key from Daytona dashboard at `http://<IP>:3000/dashboard`
5. `ssh root@<IP> 'cd /opt/xerus-pod && DAYTONA_API_KEY=<key> bash scripts/register-snapshot.sh'`
6. Update `xerus_backend .env`: `DAYTONA_API_URL=http://<IP>:3000/api`

## SSH Key Setup

```bash
# Generate if needed
ssh-keygen -t ed25519 -C "xerus" -f ~/.ssh/xerus

# Add to Hetzner
hcloud ssh-key create --name xerus --public-key-from-file ~/.ssh/xerus.pub
```

## Firewall (recommended for prod)

```bash
hcloud firewall create --name xerus-fw

# SSH
hcloud firewall add-rule xerus-fw --direction in --protocol tcp --port 22 --source-ips 0.0.0.0/0

# Daytona API
hcloud firewall add-rule xerus-fw --direction in --protocol tcp --port 3000 --source-ips YOUR_BACKEND_IP/32

# Daytona Proxy (sandbox preview URLs)
hcloud firewall add-rule xerus-fw --direction in --protocol tcp --port 4000 --source-ips 0.0.0.0/0

# SSH Gateway (sandbox SSH access)
hcloud firewall add-rule xerus-fw --direction in --protocol tcp --port 2222 --source-ips YOUR_BACKEND_IP/32

# Apply to server
hcloud firewall apply-to-resource xerus-fw --type server --server xerus-pod-1
```
