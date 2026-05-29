#!/usr/bin/env bash
# ==============================================================================
# YP Arena OS: AWS EC2 Central SaaS Server Deployment & Setup Automation
# ==============================================================================
# This script automates installing Node, PM2, Nginx, Certbot, configuring Nginx
# as a reverse proxy, and enabling SSL (HTTPS) with Let's Encrypt on Ubuntu.
# ==============================================================================

# Exit immediately if any command exits with a non-zero status
set -e

# Clear screen
clear

echo "======================================================================="
echo "       YP ARENA OS - AWS EC2 CLOUD SAAS SERVER BOOTSTRAPPER"
echo "======================================================================="
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then
  echo "ERROR: Please run this script as root (using sudo)."
  echo "Example: sudo bash bootstrap-ec2.sh"
  exit 1
fi

# ------------------------------------------------------------------------------
# 1. Gather Inputs
# ------------------------------------------------------------------------------
echo ">>> [1/5] Gathering deployment configurations..."
read -p "Enter your Cloud Subdomain (e.g. api.yparenaos.com): " SAAS_SUBDOMAIN
while [ -z "$SAAS_SUBDOMAIN" ]; do
  echo "Subdomain is required to generate SSL certificates!"
  read -p "Enter your Cloud Subdomain (e.g. api.yparenaos.com): " SAAS_SUBDOMAIN
done

read -p "Enter Administrator Email (for Let's Encrypt notifications): " OWNER_EMAIL
while [ -z "$OWNER_EMAIL" ]; do
  echo "Email is required for SSL certification registry!"
  read -p "Enter Administrator Email: " OWNER_EMAIL
done

read -p "Enter Server Host Port (default: 5000): " PORT
PORT=${PORT:-5000}

echo ""
echo "Configuration summary:"
echo "  - Subdomain: $SAAS_SUBDOMAIN"
echo "  - Email:     $OWNER_EMAIL"
echo "  - Node Port: $PORT"
echo ""
read -p "Proceed with automated setup? (y/n): " PROCEED
if [[ ! "$PROCEED" =~ ^[Yy]$ ]]; then
  echo "Setup aborted by user."
  exit 1
fi

# ------------------------------------------------------------------------------
# 2. Package Updates & Node.js Installation
# ------------------------------------------------------------------------------
echo ""
echo ">>> [2/5] Updating packages and installing Node.js 20 LTS..."
apt-get update -y
apt-get install -y curl git build-essential nginx certbot python3-certbot-nginx

# Install NodeSource PPA for Node 20
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs

# Verify installation
echo "Node.js version: $(node -v)"
echo "NPM version:     $(npm -v)"

# Install PM2 globally
npm install pm2 -g

# ------------------------------------------------------------------------------
# 3. Setup Project Dependencies & Daemon Process
# ------------------------------------------------------------------------------
echo ""
echo ">>> [3/5] Setting up local directory dependencies and running service..."
cd "$(dirname "$0")"

# Install node dependencies
npm install

# Start central server under PM2 control
pm2 delete yp-saas-server 2>/null || true
pm2 start server.js --name yp-saas-server --env PORT=$PORT
pm2 save

# Output startup script command for systemctl boot
echo "Registering PM2 startup configuration..."
pm2 startup systemd | tail -n 1 | bash || true

# ------------------------------------------------------------------------------
# 4. Nginx Reverse Proxy Setup
# ------------------------------------------------------------------------------
echo ""
echo ">>> [4/5] Automating Nginx reverse proxy configuration..."

# Write Nginx configuration block
cat > /etc/nginx/sites-available/yparena-saas <<EOF
server {
    listen 80;
    server_name $SAAS_SUBDOMAIN;

    location / {
        proxy_pass http://localhost:$PORT;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
    }
}
EOF

# Activate configurations
ln -sf /etc/nginx/sites-available/yparena-saas /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Test and reload Nginx
nginx -t
systemctl restart nginx
echo "✅ Nginx reverse proxy configured successfully."

# ------------------------------------------------------------------------------
# 5. Let's Encrypt Automated SSL Generation
# ------------------------------------------------------------------------------
echo ""
echo ">>> [5/5] Provisioning Let's Encrypt SSL certificate..."

# Run certbot to automate SSL certificates
certbot --nginx -d $SAAS_SUBDOMAIN --non-interactive --agree-tos --email $OWNER_EMAIL --redirect

echo ""
echo "======================================================================="
echo "        CLOUD SAAS CENTRAL SERVER BOOTSTRAP COMPLETE!"
echo "======================================================================="
echo "Your licensing engine is now running securely over HTTPS at:"
echo "👉 https://$SAAS_SUBDOMAIN"
echo ""
echo "Management commands:"
echo "  - View logs: pm2 logs yp-saas-server"
echo "  - Restart:   pm2 restart yp-saas-server"
echo "======================================================================="
