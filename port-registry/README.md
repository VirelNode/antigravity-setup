# Port Registry

Simple CLI tool to track what you use ports for. No more "what the hell is running on port 8080?"

## Installation

```bash
cd port-registry
npm install
npm run build
npm link  # Makes `ports` available globally
```

## Quick Start

```bash
# See what's running
ports scan

# Smart scan with auto-identification
ports scan --smart

# Register everything automatically
ports register-all --confirm

# Or register manually
ports register 3001 "Memory Dashboard" -p ~/projects/my-app

# List your registered ports
ports list

# Check a specific port
ports check 3001
```

## Commands Reference

### Basic Commands

| Command | Alias | Description |
|---------|-------|-------------|
| `ports list` | `ls` | List all registered ports with status |
| `ports register <port> <name>` | - | Register a port with description |
| `ports unregister <port>` | - | Remove port from registry |
| `ports check <port>` | - | Check if port is registered/running |
| `ports find <query>` | `search` | Search by name, project, or port |

**Examples:**
```bash
ports register 3001 "Memory Dashboard" -p ~/projects/memory
ports list
ports find memory
ports check 3001
ports unregister 3001
```

### Discovery Commands

| Command | Alias | Description |
|---------|-------|-------------|
| `ports scan` | - | List all listening ports on system |
| `ports scan --smart` | - | Auto-identify with suggestions |
| `ports identify <port>` | `id` | Deep analysis of a port |
| `ports register-all` | - | Preview auto-registration |
| `ports register-all --confirm` | - | Auto-register all ports |
| `ports conflicts` | - | Find unexpected processes |

**Examples:**
```bash
# See all listening ports
ports scan

# Get smart suggestions for unregistered ports
ports scan --smart

# Deep dive on a specific port
ports identify 8080
# Shows: process, cmdline, cwd, project, HTTP probe, framework detection

# Auto-register everything
ports register-all          # Preview
ports register-all --confirm  # Do it

# Check for hijacked ports
ports conflicts
```

### Group Commands

Organize related ports into groups.

| Command | Description |
|---------|-------------|
| `ports group create <name>` | Create a group |
| `ports group delete <name>` | Delete a group |
| `ports group add <group> <port>` | Add port to group |
| `ports group remove <group> <port>` | Remove port from group |
| `ports group list` | List all groups |
| `ports group show <name>` | Show group details |

**Examples:**
```bash
# Create a group with ports
ports group create "dev-stack" -d "Development services" -p "3001,8080,5432"

# Add/remove ports
ports group add dev-stack 6379
ports group remove dev-stack 5432

# View groups
ports group list
ports group show dev-stack
```

### History Commands

Track when ports start/stop.

| Command | Description |
|---------|-------------|
| `ports history` | Show recent activity |
| `ports history <port>` | Show history for specific port |
| `ports track` | Record current status to history |

**Examples:**
```bash
# Record current state
ports track

# View history
ports history
ports history 3001 -n 20
```

### UI Commands

| Command | Alias | Description |
|---------|-------|-------------|
| `ports watch` | `tui` | Interactive dashboard |

**Controls:**
- `Tab` - Switch between panels
- `j/k` or arrows - Navigate
- `r` - Refresh
- `q` - Quit

## Smart Identification

The `identify` and `scan --smart` commands detect:

- **Process details** - Command, args, PID, user, working directory
- **Project detection** - Walks up from cwd to find:
  - `package.json` (Node.js)
  - `pyproject.toml` (Python)
  - `Cargo.toml` (Rust)
  - `go.mod` (Go)
  - `.git` (any project)
- **Well-known ports** - PostgreSQL (5432), Redis (6379), etc.
- **HTTP probing** - Hits web ports to detect:
  - Response status
  - Server header
  - Page title
  - Framework (React, Vue, Next.js, Swagger, etc.)

## Storage

Data stored in `~/.config/port-registry/ports.db` (SQLite)

## All Options

```
ports --help
ports <command> --help
```

## Tips

1. **First run**: `ports scan --smart` to see what you've got
2. **Bulk register**: `ports register-all --confirm`
3. **Group services**: `ports group create "myapp" -p "3001,3002,5432"`
4. **Monitor changes**: Set up `ports track` in a cron job
5. **Quick search**: `ports find dashboard`
