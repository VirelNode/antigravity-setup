# Antigravity Proxy Setup

One-click setup to use Claude through Google's Antigravity infrastructure.

## What's Included

- **Antigravity Claude Proxy** - Routes Claude API calls through Antigravity
- **Desktop Launchers** - Start/stop with a click (Linux)
- **Port Registry** - Simple CLI to track your local services (bonus tool)

## Prerequisites

1. **Antigravity desktop app** - installed and running
2. **Node.js 18+** - `sudo apt install nodejs npm`

## Quick Start

```bash
git clone https://github.com/YOURUSER/antigravity-setup.git
cd antigravity-setup
./install.sh
```

The installer will:
1. Check for Node.js
2. Install the proxy globally
3. Add desktop shortcuts
4. Prompt you to authenticate with Google

## Usage

### Desktop Icons (Linux)
| Icon | Action |
|------|--------|
| **Antigravity-Start** | Start proxy on port 8081 |
| **Antigravity-Dashboard** | Open web UI |
| **Antigravity-Stop** | Stop proxy |

### Command Line
```bash
# Start the proxy
antigravity-claude-proxy start

# Check status
curl http://localhost:8081/health

# Use with Claude Code
ANTHROPIC_BASE_URL=http://localhost:8081 claude
```

## Port Registry (Bonus)

Track what you're running on which ports:

```bash
cd port-registry
npm install && npm run build
npm link

# Then use it
ports register 3000 "My App"
ports list
ports scan
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Proxy won't start | Check if Antigravity app is running |
| Auth failed | Run `antigravity-claude-proxy accounts add` |
| Port in use | Check with `lsof -i :8081` |

**Logs:** `/tmp/antigravity-proxy.log`

## License

MIT
