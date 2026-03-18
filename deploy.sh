#!/bin/bash
# AgentHQ deploy script
# Usage: bash deploy.sh
set -e

cd "$(dirname "$0")"

echo "🔨 Building AgentHQ..."
npm run build

echo "♻️  Restarting PM2..."
pm2 restart agenthq --update-env

echo "✅ Deploy complete! AgentHQ running at http://localhost:3002"
pm2 show agenthq | grep -E "status|uptime|restart"
