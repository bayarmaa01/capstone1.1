# Azure Network Security Group Configuration

## Required Inbound Rules for HTTPS

### 1. HTTP (Port 80)
- **Name**: HTTP
- **Port**: 80
- **Protocol**: TCP
- **Source**: Any
- **Destination**: Any
- **Action**: Allow
- **Priority**: 100

### 2. HTTPS (Port 443)
- **Name**: HTTPS
- **Port**: 443
- **Protocol**: TCP
- **Source**: Any
- **Destination**: Any
- **Action**: Allow
- **Priority**: 110

### 3. SSH (Port 22) - Optional for management
- **Name**: SSH
- **Port**: 22
- **Protocol**: TCP
- **Source**: Your IP address
- **Destination**: Any
- **Action**: Allow
- **Priority**: 120

## How to Configure in Azure Portal

1. **Navigate to your VM**
   - Go to Azure Portal
   - Find your Virtual Machine
   - Click on "Networking"

2. **Add Inbound Port Rules**
   - Click "Add inbound port rule"
   - Configure HTTP rule (port 80)
   - Click "Add"
   - Configure HTTPS rule (port 443)
   - Click "Add"

3. **Verify Rules**
   - Ensure both rules appear in the list
   - Check priority order (lower number = higher priority)

## Azure CLI Commands

```bash
# Get VM resource group name
az vm show --name your-vm-name --query resourceGroup -o tsv

# Add HTTP rule
az network nsg rule create \
  --resource-group your-resource-group \
  --nsg-name your-nsg-name \
  --name HTTP \
  --protocol tcp \
  --direction inbound \
  --priority 100 \
  --source-address-prefixes '*' \
  --source-port-ranges '*' \
  --destination-address-prefixes '*' \
  --destination-port-ranges 80 \
  --access allow

# Add HTTPS rule
az network nsg rule create \
  --resource-group your-resource-group \
  --nsg-name your-nsg-name \
  --name HTTPS \
  --protocol tcp \
  --direction inbound \
  --priority 110 \
  --source-address-prefixes '*' \
  --source-port-ranges '*' \
  --destination-address-prefixes '*' \
  --destination-port-ranges 443 \
  --access allow
```

## Troubleshooting

### Check NSG Rules
```bash
# List all NSG rules
az network nsg rule list --resource-group your-resource-group --nsg-name your-nsg-name --output table
```

### Check Effective Security Rules
```bash
# Check effective rules for VM NIC
az network nic list-effective-nsg \
  --resource-group your-resource-group \
  --name your-vm-name-nic \
  --output table
```

## Important Notes

- **Priority**: Lower numbers have higher priority
- **Source**: Use `*` for any IP, or specify your IP for SSH
- **Destination**: Usually `*` for VM network interface
- **Protocol**: TCP for web traffic
- **Action**: Allow to permit traffic
