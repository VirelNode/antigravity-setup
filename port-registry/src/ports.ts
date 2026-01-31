import chalk from 'chalk';
import {
  registerPort, unregisterPort, getPort, getAllPorts, searchPorts,
  createGroup, deleteGroup, addPortToGroup, removePortFromGroup, getGroup, getAllGroups,
  recordHistory, getPortHistory, getRecentHistory,
  type PortEntry, type PortGroup, type HistoryEntry
} from './db.js';
import { getPortProcess, isPortRunning, getAllListeningPorts } from './system.js';
import { identifyPort, formatIdentification, type PortIdentification } from './identify.js';

export function register(port: number, name: string, project?: string): void {
  registerPort(port, name, project);
  console.log(chalk.green(`✓ Registered port ${chalk.bold(port)}: ${name}`));
}

export function unregister(port: number): void {
  const existed = unregisterPort(port);
  if (existed) {
    console.log(chalk.yellow(`✓ Unregistered port ${chalk.bold(port)}`));
  } else {
    console.log(chalk.gray(`Port ${port} was not registered`));
  }
}

export function check(port: number): void {
  const entry = getPort(port);
  const process = getPortProcess(port);

  if (entry) {
    const status = process
      ? chalk.green(`RUNNING`) + chalk.gray(` (${process.command}, pid ${process.pid})`)
      : chalk.gray('NOT RUNNING');
    console.log(`${chalk.bold(entry.name)} - ${status}`);
    if (entry.project) {
      console.log(chalk.gray(`  Project: ${entry.project}`));
    }
  } else if (process) {
    console.log(chalk.yellow(`Not registered, currently ${chalk.red('IN USE')} by ${process.command} (pid ${process.pid})`));
  } else {
    console.log(chalk.gray(`Not registered, currently ${chalk.green('FREE')}`));
  }
}

export function list(): void {
  const ports = getAllPorts();

  if (ports.length === 0) {
    console.log(chalk.gray('No ports registered. Use `ports register <port> <name>` to add one.'));
    return;
  }

  console.log(chalk.bold('\nRegistered Ports:\n'));

  const maxNameLen = Math.max(...ports.map(p => p.name.length), 4);

  // Header
  console.log(
    chalk.gray('PORT'.padEnd(7)) +
    chalk.gray('NAME'.padEnd(maxNameLen + 2)) +
    chalk.gray('STATUS')
  );
  console.log(chalk.gray('─'.repeat(50)));

  for (const entry of ports) {
    const process = getPortProcess(entry.port);
    const status = process
      ? chalk.green('● RUNNING') + chalk.gray(` (${process.command})`)
      : chalk.gray('○ stopped');

    console.log(
      chalk.cyan(String(entry.port).padEnd(7)) +
      entry.name.padEnd(maxNameLen + 2) +
      status
    );
  }

  console.log();
}

export function scan(): void {
  const listening = getAllListeningPorts();
  const registered = getAllPorts();
  const registeredSet = new Set(registered.map(p => p.port));

  if (listening.length === 0) {
    console.log(chalk.gray('No listening ports found.'));
    return;
  }

  console.log(chalk.bold('\nListening Ports:\n'));

  // Header
  console.log(
    chalk.gray('PORT'.padEnd(7)) +
    chalk.gray('PROCESS'.padEnd(16)) +
    chalk.gray('PID'.padEnd(10)) +
    chalk.gray('REGISTERED')
  );
  console.log(chalk.gray('─'.repeat(60)));

  for (const p of listening) {
    const regEntry = registered.find(r => r.port === p.port);
    const regStatus = regEntry
      ? chalk.cyan(`✓ ${regEntry.name}`)
      : chalk.yellow('✗ unregistered');

    console.log(
      chalk.green(String(p.port).padEnd(7)) +
      p.command.padEnd(16) +
      chalk.gray(String(p.pid).padEnd(10)) +
      regStatus
    );
  }

  // Summary
  const unregistered = listening.filter(p => !registeredSet.has(p.port));
  if (unregistered.length > 0) {
    console.log(chalk.yellow(`\n${unregistered.length} unregistered port(s).`));
    console.log(chalk.gray(`Use ${chalk.white('ports identify <port>')} for details, or ${chalk.white('ports scan --smart')} for auto-suggestions.\n`));
  }

  console.log();
}

export async function identify(port: number): Promise<void> {
  console.log(chalk.gray(`Analyzing port ${port}...`));
  const id = await identifyPort(port);
  console.log(formatIdentification(id));
}

export async function smartScan(): Promise<void> {
  const listening = getAllListeningPorts();
  const registered = getAllPorts();
  const registeredSet = new Set(registered.map(p => p.port));

  const unregistered = listening.filter(p => !registeredSet.has(p.port));

  if (unregistered.length === 0) {
    console.log(chalk.green('All listening ports are registered!'));
    return;
  }

  console.log(chalk.bold(`\nAnalyzing ${unregistered.length} unregistered port(s)...\n`));

  const identifications: PortIdentification[] = [];

  for (const p of unregistered) {
    process.stdout.write(chalk.gray(`  Scanning ${p.port}...`));
    const id = await identifyPort(p.port, p.pid);
    identifications.push(id);
    process.stdout.write(chalk.green(` ${id.suggestedName}\n`));
  }

  console.log(chalk.bold('\n\nSuggested registrations:\n'));
  console.log(chalk.gray('# Copy and run these commands:'));

  for (const id of identifications) {
    const projectFlag = id.project ? ` -p "${id.project.path}"` : '';
    console.log(`ports register ${id.port} "${id.suggestedName}"${projectFlag}`);
  }

  console.log(chalk.gray('\n# Or register all at once:'));
  console.log(chalk.yellow('ports register-all --confirm'));
}

export async function registerAll(confirm: boolean): Promise<void> {
  if (!confirm) {
    console.log(chalk.yellow('This will auto-register all unregistered ports.'));
    console.log(chalk.gray('Run with --confirm to proceed.\n'));

    // Show preview
    await smartScan();
    return;
  }

  const listening = getAllListeningPorts();
  const registered = getAllPorts();
  const registeredSet = new Set(registered.map(p => p.port));
  const unregistered = listening.filter(p => !registeredSet.has(p.port));

  console.log(chalk.bold(`Registering ${unregistered.length} port(s)...\n`));

  for (const p of unregistered) {
    const id = await identifyPort(p.port, p.pid);
    registerPort(p.port, id.suggestedName, id.project?.path);
    console.log(chalk.green(`✓ ${p.port}: ${id.suggestedName}`));
  }

  console.log(chalk.green(`\nDone! Registered ${unregistered.length} port(s).`));
}

// Find/search
export function find(query: string): void {
  const results = searchPorts(query);

  if (results.length === 0) {
    console.log(chalk.gray(`No ports found matching "${query}"`));
    return;
  }

  console.log(chalk.bold(`\nFound ${results.length} port(s) matching "${query}":\n`));

  for (const entry of results) {
    const proc = getPortProcess(entry.port);
    const status = proc
      ? chalk.green('● RUNNING') + chalk.gray(` (${proc.command})`)
      : chalk.gray('○ stopped');

    console.log(`${chalk.cyan(String(entry.port).padEnd(7))} ${entry.name}`);
    console.log(`        ${status}`);
    if (entry.project) {
      console.log(chalk.gray(`        ${entry.project}`));
    }
  }
  console.log();
}

// Conflicts - find when registered port is used by unexpected process
export function conflicts(): void {
  const registered = getAllPorts();
  const listening = getAllListeningPorts();
  const conflicts: Array<{ entry: PortEntry; expected: string; actual: string; pid: number }> = [];

  for (const entry of registered) {
    const proc = getPortProcess(entry.port);
    if (!proc) continue;

    // Check if the process name matches what we expect
    // Simple heuristic: check if registered name contains process name or vice versa
    const nameLower = entry.name.toLowerCase();
    const procLower = proc.command.toLowerCase();

    const seemsRelated =
      nameLower.includes(procLower) ||
      procLower.includes(nameLower.split(' ')[0]) ||
      nameLower.includes(procLower.split('-')[0]);

    if (!seemsRelated) {
      conflicts.push({
        entry,
        expected: entry.name,
        actual: proc.command,
        pid: proc.pid,
      });
    }
  }

  if (conflicts.length === 0) {
    console.log(chalk.green('✓ No conflicts detected. All ports running expected processes.'));
    return;
  }

  console.log(chalk.bold.red(`\n⚠ Found ${conflicts.length} conflict(s):\n`));

  for (const c of conflicts) {
    console.log(chalk.red(`Port ${chalk.bold(c.entry.port)}:`));
    console.log(`  Expected: ${chalk.cyan(c.expected)}`);
    console.log(`  Actual:   ${chalk.yellow(c.actual)} ${chalk.gray(`(pid ${c.pid})`)}`);
    if (c.entry.project) {
      console.log(chalk.gray(`  Project:  ${c.entry.project}`));
    }
    console.log();
  }
}

// Groups
export function groupCreate(name: string, description?: string, ports?: number[]): void {
  createGroup(name, description);
  if (ports) {
    for (const port of ports) {
      addPortToGroup(name, port);
    }
  }
  console.log(chalk.green(`✓ Created group "${name}"${ports ? ` with ${ports.length} port(s)` : ''}`));
}

export function groupDelete(name: string): void {
  const existed = deleteGroup(name);
  if (existed) {
    console.log(chalk.yellow(`✓ Deleted group "${name}"`));
  } else {
    console.log(chalk.gray(`Group "${name}" not found`));
  }
}

export function groupAdd(groupName: string, port: number): void {
  const group = getGroup(groupName);
  if (!group) {
    console.log(chalk.red(`Group "${groupName}" not found`));
    return;
  }
  addPortToGroup(groupName, port);
  console.log(chalk.green(`✓ Added port ${port} to group "${groupName}"`));
}

export function groupRemove(groupName: string, port: number): void {
  removePortFromGroup(groupName, port);
  console.log(chalk.yellow(`✓ Removed port ${port} from group "${groupName}"`));
}

export function groupList(): void {
  const groups = getAllGroups();

  if (groups.length === 0) {
    console.log(chalk.gray('No groups defined. Use `ports group create <name>` to add one.'));
    return;
  }

  console.log(chalk.bold('\nPort Groups:\n'));

  for (const group of groups) {
    const runningCount = group.ports.filter(p => isPortRunning(p)).length;
    const statusColor = runningCount === group.ports.length ? chalk.green :
                        runningCount > 0 ? chalk.yellow : chalk.gray;

    console.log(`${chalk.cyan.bold(group.name)} ${chalk.gray(`(${runningCount}/${group.ports.length} running)`)}`);
    if (group.description) {
      console.log(chalk.gray(`  ${group.description}`));
    }

    for (const port of group.ports) {
      const entry = getPort(port);
      const proc = getPortProcess(port);
      const status = proc ? chalk.green('●') : chalk.gray('○');
      console.log(`  ${status} ${chalk.cyan(String(port).padEnd(6))} ${entry?.name || chalk.gray('(unregistered)')}`);
    }
    console.log();
  }
}

export function groupShow(name: string): void {
  const group = getGroup(name);
  if (!group) {
    console.log(chalk.red(`Group "${name}" not found`));
    return;
  }

  const runningCount = group.ports.filter(p => isPortRunning(p)).length;

  console.log(chalk.bold(`\nGroup: ${chalk.cyan(group.name)}`));
  if (group.description) {
    console.log(chalk.gray(group.description));
  }
  console.log(chalk.gray(`Status: ${runningCount}/${group.ports.length} running\n`));

  console.log(chalk.gray('PORT'.padEnd(7) + 'NAME'.padEnd(25) + 'STATUS'));
  console.log(chalk.gray('─'.repeat(50)));

  for (const port of group.ports) {
    const entry = getPort(port);
    const proc = getPortProcess(port);
    const status = proc
      ? chalk.green('● RUNNING') + chalk.gray(` (${proc.command})`)
      : chalk.gray('○ stopped');

    console.log(
      chalk.cyan(String(port).padEnd(7)) +
      (entry?.name || chalk.gray('(unregistered)')).padEnd(25) +
      status
    );
  }
  console.log();
}

// History
export function history(port?: number, limit = 50): void {
  const entries = port ? getPortHistory(port, limit) : getRecentHistory(limit);

  if (entries.length === 0) {
    console.log(chalk.gray('No history recorded yet.'));
    return;
  }

  const title = port ? `History for port ${port}` : 'Recent Port History';
  console.log(chalk.bold(`\n${title}:\n`));

  console.log(
    chalk.gray('TIMESTAMP'.padEnd(20)) +
    chalk.gray('PORT'.padEnd(7)) +
    chalk.gray('EVENT'.padEnd(12)) +
    chalk.gray('PROCESS')
  );
  console.log(chalk.gray('─'.repeat(60)));

  for (const entry of entries) {
    const eventColor = entry.event === 'start' ? chalk.green :
                       entry.event === 'stop' ? chalk.red :
                       entry.event === 'register' ? chalk.cyan :
                       chalk.yellow;

    const time = new Date(entry.timestamp).toLocaleString();
    console.log(
      chalk.gray(time.padEnd(20)) +
      chalk.cyan(String(entry.port).padEnd(7)) +
      eventColor(entry.event.padEnd(12)) +
      (entry.process ? `${entry.process} (${entry.pid})` : chalk.gray('-'))
    );
  }
  console.log();
}

// Track changes - meant to be run periodically to record history
export function trackChanges(): void {
  const registered = getAllPorts();
  const listening = getAllListeningPorts();
  const listeningSet = new Set(listening.map(p => p.port));

  let changes = 0;

  for (const entry of registered) {
    const proc = getPortProcess(entry.port);
    const lastHistory = getPortHistory(entry.port, 1)[0];

    if (proc && (!lastHistory || lastHistory.event === 'stop')) {
      recordHistory(entry.port, 'start', proc.command, proc.pid);
      console.log(chalk.green(`● ${entry.name} (${entry.port}) started`));
      changes++;
    } else if (!proc && lastHistory?.event === 'start') {
      recordHistory(entry.port, 'stop');
      console.log(chalk.red(`○ ${entry.name} (${entry.port}) stopped`));
      changes++;
    }
  }

  if (changes === 0) {
    console.log(chalk.gray('No changes detected.'));
  }
}
