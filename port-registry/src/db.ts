import Database from 'better-sqlite3';
import { homedir } from 'os';
import { join } from 'path';
import { mkdirSync, existsSync } from 'fs';

const CONFIG_DIR = join(homedir(), '.config', 'port-registry');
const DB_PATH = join(CONFIG_DIR, 'ports.db');

// Ensure config directory exists
if (!existsSync(CONFIG_DIR)) {
  mkdirSync(CONFIG_DIR, { recursive: true });
}

const db = new Database(DB_PATH);

// Initialize schema
db.exec(`
  CREATE TABLE IF NOT EXISTS ports (
    port INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    project TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS groups (
    name TEXT PRIMARY KEY,
    description TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS group_ports (
    group_name TEXT NOT NULL,
    port INTEGER NOT NULL,
    PRIMARY KEY (group_name, port),
    FOREIGN KEY (group_name) REFERENCES groups(name) ON DELETE CASCADE,
    FOREIGN KEY (port) REFERENCES ports(port) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    port INTEGER NOT NULL,
    event TEXT NOT NULL,
    process TEXT,
    pid INTEGER,
    timestamp TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_history_port ON history(port);
  CREATE INDEX IF NOT EXISTS idx_history_timestamp ON history(timestamp);
`);

export interface PortEntry {
  port: number;
  name: string;
  project: string | null;
  created_at: string;
}

export function registerPort(port: number, name: string, project?: string): void {
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO ports (port, name, project, created_at)
    VALUES (?, ?, ?, CURRENT_TIMESTAMP)
  `);
  stmt.run(port, name, project ?? null);
}

export function unregisterPort(port: number): boolean {
  const stmt = db.prepare('DELETE FROM ports WHERE port = ?');
  const result = stmt.run(port);
  return result.changes > 0;
}

export function getPort(port: number): PortEntry | undefined {
  const stmt = db.prepare('SELECT * FROM ports WHERE port = ?');
  return stmt.get(port) as PortEntry | undefined;
}

export function getAllPorts(): PortEntry[] {
  const stmt = db.prepare('SELECT * FROM ports ORDER BY port');
  return stmt.all() as PortEntry[];
}

export function searchPorts(query: string): PortEntry[] {
  const stmt = db.prepare(`
    SELECT * FROM ports
    WHERE name LIKE ? OR project LIKE ? OR CAST(port AS TEXT) LIKE ?
    ORDER BY port
  `);
  const pattern = `%${query}%`;
  return stmt.all(pattern, pattern, pattern) as PortEntry[];
}

// Groups
export interface PortGroup {
  name: string;
  description: string | null;
  created_at: string;
  ports: number[];
}

export function createGroup(name: string, description?: string): void {
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO groups (name, description, created_at)
    VALUES (?, ?, CURRENT_TIMESTAMP)
  `);
  stmt.run(name, description ?? null);
}

export function deleteGroup(name: string): boolean {
  const stmt = db.prepare('DELETE FROM groups WHERE name = ?');
  const result = stmt.run(name);
  return result.changes > 0;
}

export function addPortToGroup(groupName: string, port: number): void {
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO group_ports (group_name, port) VALUES (?, ?)
  `);
  stmt.run(groupName, port);
}

export function removePortFromGroup(groupName: string, port: number): void {
  const stmt = db.prepare('DELETE FROM group_ports WHERE group_name = ? AND port = ?');
  stmt.run(groupName, port);
}

export function getGroup(name: string): PortGroup | undefined {
  const groupStmt = db.prepare('SELECT * FROM groups WHERE name = ?');
  const group = groupStmt.get(name) as { name: string; description: string | null; created_at: string } | undefined;
  if (!group) return undefined;

  const portsStmt = db.prepare('SELECT port FROM group_ports WHERE group_name = ? ORDER BY port');
  const ports = (portsStmt.all(name) as { port: number }[]).map(p => p.port);

  return { ...group, ports };
}

export function getAllGroups(): PortGroup[] {
  const groupsStmt = db.prepare('SELECT * FROM groups ORDER BY name');
  const groups = groupsStmt.all() as { name: string; description: string | null; created_at: string }[];

  return groups.map(g => {
    const portsStmt = db.prepare('SELECT port FROM group_ports WHERE group_name = ? ORDER BY port');
    const ports = (portsStmt.all(g.name) as { port: number }[]).map(p => p.port);
    return { ...g, ports };
  });
}

// History
export interface HistoryEntry {
  id: number;
  port: number;
  event: 'start' | 'stop' | 'register' | 'unregister';
  process: string | null;
  pid: number | null;
  timestamp: string;
}

export function recordHistory(port: number, event: string, process?: string, pid?: number): void {
  const stmt = db.prepare(`
    INSERT INTO history (port, event, process, pid) VALUES (?, ?, ?, ?)
  `);
  stmt.run(port, event, process ?? null, pid ?? null);
}

export function getPortHistory(port: number, limit = 50): HistoryEntry[] {
  const stmt = db.prepare(`
    SELECT * FROM history WHERE port = ? ORDER BY timestamp DESC LIMIT ?
  `);
  return stmt.all(port, limit) as HistoryEntry[];
}

export function getRecentHistory(limit = 100): HistoryEntry[] {
  const stmt = db.prepare(`
    SELECT * FROM history ORDER BY timestamp DESC LIMIT ?
  `);
  return stmt.all(limit) as HistoryEntry[];
}

export function pruneHistory(daysOld = 30): number {
  const stmt = db.prepare(`
    DELETE FROM history WHERE timestamp < datetime('now', '-' || ? || ' days')
  `);
  const result = stmt.run(daysOld);
  return result.changes;
}

export function closeDb(): void {
  db.close();
}
