#!/usr/bin/env node

import { program } from 'commander';
import {
  register, unregister, check, list, scan, identify, smartScan, registerAll,
  find, conflicts,
  groupCreate, groupDelete, groupAdd, groupRemove, groupList, groupShow,
  history, trackChanges
} from './ports.js';
import { startTui } from './tui.js';

program
  .name('ports')
  .description('Track what you use ports for')
  .version('1.0.0');

// === Basic Commands ===

program
  .command('register <port> <name>')
  .description('Register a port with a description')
  .option('-p, --project <path>', 'Associate with a project path')
  .action((port: string, name: string, options: { project?: string }) => {
    const portNum = parseInt(port, 10);
    if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
      console.error('Error: Port must be a number between 1 and 65535');
      process.exit(1);
    }
    register(portNum, name, options.project);
  });

program
  .command('unregister <port>')
  .description('Remove a port from the registry')
  .action((port: string) => {
    const portNum = parseInt(port, 10);
    if (isNaN(portNum)) {
      console.error('Error: Invalid port number');
      process.exit(1);
    }
    unregister(portNum);
  });

program
  .command('check <port>')
  .description('Check if a port is registered and/or running')
  .action((port: string) => {
    const portNum = parseInt(port, 10);
    if (isNaN(portNum)) {
      console.error('Error: Invalid port number');
      process.exit(1);
    }
    check(portNum);
  });

program
  .command('list')
  .alias('ls')
  .description('List all registered ports with their status')
  .action(() => {
    list();
  });

program
  .command('find <query>')
  .alias('search')
  .description('Search for ports by name, project, or port number')
  .action((query: string) => {
    find(query);
  });

// === Discovery Commands ===

program
  .command('scan')
  .description('Scan system for all listening ports')
  .option('-s, --smart', 'Auto-identify ports with smart suggestions')
  .action(async (options: { smart?: boolean }) => {
    if (options.smart) {
      await smartScan();
    } else {
      scan();
    }
  });

program
  .command('identify <port>')
  .alias('id')
  .description('Deep analysis of a specific port (process, project, HTTP probe)')
  .action(async (port: string) => {
    const portNum = parseInt(port, 10);
    if (isNaN(portNum)) {
      console.error('Error: Invalid port number');
      process.exit(1);
    }
    await identify(portNum);
  });

program
  .command('register-all')
  .description('Auto-register all unregistered ports with smart names')
  .option('-c, --confirm', 'Actually perform the registration')
  .action(async (options: { confirm?: boolean }) => {
    await registerAll(options.confirm ?? false);
  });

program
  .command('conflicts')
  .description('Find ports running unexpected processes')
  .action(() => {
    conflicts();
  });

// === Group Commands ===

const groupCmd = program
  .command('group')
  .description('Manage port groups');

groupCmd
  .command('create <name>')
  .description('Create a new port group')
  .option('-d, --description <desc>', 'Group description')
  .option('-p, --ports <ports>', 'Comma-separated list of ports to add')
  .action((name: string, options: { description?: string; ports?: string }) => {
    const ports = options.ports?.split(',').map(p => parseInt(p.trim(), 10)).filter(p => !isNaN(p));
    groupCreate(name, options.description, ports);
  });

groupCmd
  .command('delete <name>')
  .alias('rm')
  .description('Delete a port group')
  .action((name: string) => {
    groupDelete(name);
  });

groupCmd
  .command('add <group> <port>')
  .description('Add a port to a group')
  .action((group: string, port: string) => {
    const portNum = parseInt(port, 10);
    if (isNaN(portNum)) {
      console.error('Error: Invalid port number');
      process.exit(1);
    }
    groupAdd(group, portNum);
  });

groupCmd
  .command('remove <group> <port>')
  .description('Remove a port from a group')
  .action((group: string, port: string) => {
    const portNum = parseInt(port, 10);
    if (isNaN(portNum)) {
      console.error('Error: Invalid port number');
      process.exit(1);
    }
    groupRemove(group, portNum);
  });

groupCmd
  .command('list')
  .alias('ls')
  .description('List all port groups')
  .action(() => {
    groupList();
  });

groupCmd
  .command('show <name>')
  .description('Show details of a specific group')
  .action((name: string) => {
    groupShow(name);
  });

// === History Commands ===

program
  .command('history [port]')
  .description('Show port activity history')
  .option('-n, --limit <n>', 'Number of entries to show', '50')
  .action((port: string | undefined, options: { limit: string }) => {
    const portNum = port ? parseInt(port, 10) : undefined;
    const limit = parseInt(options.limit, 10) || 50;
    history(portNum, limit);
  });

program
  .command('track')
  .description('Record current port status changes to history')
  .action(() => {
    trackChanges();
  });

// === UI Commands ===

program
  .command('watch')
  .alias('tui')
  .description('Open interactive TUI dashboard')
  .action(() => {
    startTui();
  });

// Default to list if no command
if (process.argv.length === 2) {
  list();
} else {
  program.parse();
}
