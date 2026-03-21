#!/bin/bash
set -e

echo "🦞 AgentHQ Installer"
echo "===================="

# 1. Check prerequisites
echo "Checking prerequisites..."
command -v node >/dev/null 2>&1 || { echo "❌ Node.js not found. Install Node 22+: curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash - && sudo apt-get install -y nodejs"; exit 1; }
NODE_MAJOR=$(node -v | cut -d. -f1 | tr -d v)
if [ "$NODE_MAJOR" -lt 22 ]; then
  echo "❌ Node $NODE_MAJOR found. Need Node 22+: curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash - && sudo apt-get install -y nodejs"
  exit 1
fi
command -v python3 >/dev/null 2>&1 || { echo "❌ Python3 not found. Install: sudo apt-get install -y python3"; exit 1; }
command -v git >/dev/null 2>&1 || { echo "❌ Git not found. Install: sudo apt-get install -y git"; exit 1; }
echo "✅ Prerequisites OK (Node $(node -v), Python $(python3 --version | cut -d' ' -f2))"

# 2. Clone or update
echo ""
echo "Downloading AgentHQ..."
INSTALL_DIR="${HOME}/.openclaw/workspace/agenthq"
mkdir -p "$(dirname "$INSTALL_DIR")"
if [ -d "$INSTALL_DIR/.git" ]; then
  echo "Updating existing install..."
  cd "$INSTALL_DIR" && git pull
elif [ -d "$INSTALL_DIR" ]; then
  echo "Using existing directory..."
  cd "$INSTALL_DIR"
else
  git clone https://github.com/98kiran/agenthq.git "$INSTALL_DIR"
  cd "$INSTALL_DIR"
fi

# 3. Python dependencies
echo ""
echo "Installing Python dependencies..."
set +e
pip3 install -r requirements.txt --break-system-packages 2>&1
PIP_STATUS=$?
if [ $PIP_STATUS -ne 0 ]; then
  echo "Retrying with --user..."
  pip3 install -r requirements.txt --user 2>&1 || true
fi
set -e

# 4. Setup (SQLite by default)
echo ""
echo "Running setup..."
bash setup.sh sqlite

# 5. Start with PM2
echo ""
echo "Starting AgentHQ..."
npx pm2 start npm --name agenthq -- start
npx pm2 save

# 6. Print success
PORT=$(grep '^PORT=' .env.local 2>/dev/null | cut -d= -f2 || echo 3000)
PASSWORD=$(grep '^AUTH_PASSWORD=' .env.local 2>/dev/null | cut -d= -f2)
echo ""
echo "================================"
echo "  🦞 AgentHQ is ready!"
echo "  URL: http://localhost:${PORT:-3000}"
echo "  Password: $PASSWORD"
echo "================================"
echo ""
echo "Remote server? Run: ssh your-server -L ${PORT:-3000}:127.0.0.1:${PORT:-3000}"
echo "Then open http://localhost:${PORT:-3000} in your browser."
