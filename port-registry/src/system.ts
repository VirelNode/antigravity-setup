import { execSync } from 'child_process';

export interface ProcessInfo {
  pid: number;
  command: string;
}

export function getPortProcess(port: number): ProcessInfo | null {
  try {
    // Use lsof to find process using the port
    const output = execSync(`lsof -i :${port} -t 2>/dev/null`, { encoding: 'utf-8' });
    const pid = parseInt(output.trim().split('\n')[0], 10);

    if (isNaN(pid)) return null;

    // Get command name for the PID
    const command = execSync(`ps -p ${pid} -o comm= 2>/dev/null`, { encoding: 'utf-8' }).trim();

    return { pid, command };
  } catch {
    return null;
  }
}

export function isPortRunning(port: number): boolean {
  return getPortProcess(port) !== null;
}

export interface ListeningPort {
  port: number;
  pid: number;
  command: string;
  protocol: 'tcp' | 'tcp6';
}

export function getAllListeningPorts(): ListeningPort[] {
  try {
    const output = execSync('lsof -i -P -n 2>/dev/null | grep LISTEN', { encoding: 'utf-8' });
    const ports: ListeningPort[] = [];
    const seen = new Set<number>();

    for (const line of output.trim().split('\n')) {
      const parts = line.split(/\s+/);
      if (parts.length < 9) continue;

      const command = parts[0];
      const pid = parseInt(parts[1], 10);
      const type = parts[4].toLowerCase() as 'tcp' | 'tcp6';
      const address = parts[8];

      // Extract port from address like *:3001 or 127.0.0.1:8080
      const portMatch = address.match(/:(\d+)$/);
      if (!portMatch) continue;

      const port = parseInt(portMatch[1], 10);
      if (seen.has(port)) continue;
      seen.add(port);

      ports.push({ port, pid, command, protocol: type.startsWith('ipv6') ? 'tcp6' : 'tcp' });
    }

    return ports.sort((a, b) => a.port - b.port);
  } catch {
    return [];
  }
}
