#!/bin/bash
set -e

echo "╔════════════════════════════════════════════════════════╗"
echo "║     Antigravity Claude Proxy - One-Click Installer     ║"
echo "╚════════════════════════════════════════════════════════╝"
echo

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Check for Node.js
echo "[1/5] Checking for Node.js..."
if ! command -v node &> /dev/null; then
    echo ""
    echo "❌ Node.js not found!"
    echo ""
    echo "Install it first:"
    echo "  Ubuntu/Debian: sudo apt install nodejs npm"
    echo "  Or visit: https://nodejs.org/"
    echo ""
    exit 1
fi
NODE_VERSION=$(node -v)
echo "  ✓ Found Node.js $NODE_VERSION"

# Check for npm
echo "[2/5] Checking for npm..."
if ! command -v npm &> /dev/null; then
    echo ""
    echo "❌ npm not found!"
    echo ""
    echo "Install it: sudo apt install npm"
    echo ""
    exit 1
fi
echo "  ✓ Found npm $(npm -v)"

# Install the proxy
echo "[3/5] Installing antigravity-claude-proxy..."
sudo npm install -g antigravity-claude-proxy
echo "  ✓ Installed"

# Copy desktop launchers
echo "[4/5] Setting up desktop launchers..."
if [ -d "$HOME/Desktop" ]; then
    cp "$SCRIPT_DIR"/Antigravity-*.desktop "$HOME/Desktop/"
    chmod +x "$HOME/Desktop"/Antigravity-*.desktop
    echo "  ✓ Desktop icons ready"
else
    echo "  ⚠ No Desktop folder found, skipping icons"
fi

# Check if Antigravity app is running (for auto-auth)
echo "[5/5] Checking authentication..."
if antigravity-claude-proxy accounts list 2>/dev/null | grep -q "@"; then
    echo "  ✓ Already authenticated!"
    AUTHENTICATED=true
else
    AUTHENTICATED=false
fi

echo ""
echo "╔════════════════════════════════════════════════════════╗"
echo "║              ✓ Installation Complete!                  ║"
echo "╚════════════════════════════════════════════════════════╝"
echo ""

if [ "$AUTHENTICATED" = false ]; then
    echo "⚡ NEXT STEP: Authenticate with your Google account"
    echo ""
    echo "   Make sure the Antigravity app is open, then run:"
    echo ""
    echo "   antigravity-claude-proxy accounts add"
    echo ""
    read -p "Want to do this now? [Y/n] " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Nn]$ ]]; then
        echo ""
        echo "Opening authentication..."
        antigravity-claude-proxy accounts add
    fi
else
    echo "You're all set! Use the desktop icons to start the proxy."
fi

echo ""
echo "📖 Usage:"
echo "   • Click 'Antigravity-Start' on your desktop"
echo "   • Or run: antigravity-claude-proxy start"
echo ""
