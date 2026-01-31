import blessed from 'blessed';
import { getAllPorts, type PortEntry } from './db.js';
import { getPortProcess, getAllListeningPorts, type ListeningPort } from './system.js';

export function startTui(): void {
  const screen = blessed.screen({
    smartCSR: true,
    title: 'Port Registry'
  });

  // Header
  const header = blessed.box({
    top: 0,
    left: 0,
    width: '100%',
    height: 3,
    content: '{center}{bold}Port Registry{/bold}{/center}',
    tags: true,
    style: {
      fg: 'white',
      bg: 'blue'
    }
  });

  // Registered ports table
  const registeredBox = blessed.box({
    top: 3,
    left: 0,
    width: '50%',
    height: '50%-3',
    label: ' Registered Ports ',
    border: { type: 'line' },
    style: {
      border: { fg: 'cyan' },
      label: { fg: 'cyan', bold: true }
    }
  });

  const registeredList = blessed.list({
    parent: registeredBox,
    top: 0,
    left: 1,
    right: 1,
    bottom: 0,
    tags: true,
    style: {
      selected: { bg: 'blue' }
    }
  });

  // All listening ports
  const listeningBox = blessed.box({
    top: 3,
    left: '50%',
    width: '50%',
    height: '50%-3',
    label: ' All Listening Ports ',
    border: { type: 'line' },
    style: {
      border: { fg: 'yellow' },
      label: { fg: 'yellow', bold: true }
    }
  });

  const listeningList = blessed.list({
    parent: listeningBox,
    top: 0,
    left: 1,
    right: 1,
    bottom: 0,
    tags: true,
    style: {
      selected: { bg: 'blue' }
    }
  });

  // Status/details box
  const statusBox = blessed.box({
    top: '50%',
    left: 0,
    width: '100%',
    height: '50%-1',
    label: ' Port Details ',
    border: { type: 'line' },
    content: 'Select a port for details',
    style: {
      border: { fg: 'green' },
      label: { fg: 'green', bold: true }
    },
    tags: true
  });

  // Footer
  const footer = blessed.box({
    bottom: 0,
    left: 0,
    width: '100%',
    height: 1,
    content: ' {bold}q{/bold} quit | {bold}r{/bold} refresh | {bold}Tab{/bold} switch panel ',
    tags: true,
    style: {
      fg: 'white',
      bg: 'blue'
    }
  });

  screen.append(header);
  screen.append(registeredBox);
  screen.append(listeningBox);
  screen.append(statusBox);
  screen.append(footer);

  let activePanel: 'registered' | 'listening' = 'registered';
  let registeredPorts: PortEntry[] = [];
  let listeningPorts: ListeningPort[] = [];

  function refresh(): void {
    registeredPorts = getAllPorts();
    listeningPorts = getAllListeningPorts();

    // Update registered list
    const regItems = registeredPorts.map(p => {
      const proc = getPortProcess(p.port);
      const status = proc ? '{green-fg}●{/green-fg}' : '{gray-fg}○{/gray-fg}';
      return `${status} {cyan-fg}${String(p.port).padEnd(6)}{/cyan-fg} ${p.name}`;
    });
    registeredList.setItems(regItems.length ? regItems : ['{gray-fg}No registered ports{/gray-fg}']);

    // Update listening list
    const listenItems = listeningPorts.map(p => {
      const registered = registeredPorts.find(r => r.port === p.port);
      const regStatus = registered ? '{cyan-fg}✓{/cyan-fg}' : '{yellow-fg}?{/yellow-fg}';
      return `${regStatus} {green-fg}${String(p.port).padEnd(6)}{/green-fg} ${p.command}`;
    });
    listeningList.setItems(listenItems.length ? listenItems : ['{gray-fg}No listening ports{/gray-fg}']);

    updateStatus();
    screen.render();
  }

  function updateStatus(): void {
    const list = activePanel === 'registered' ? registeredList : listeningList;
    const idx = (list as any).selected || 0;

    if (activePanel === 'registered' && registeredPorts[idx]) {
      const p = registeredPorts[idx];
      const proc = getPortProcess(p.port);
      statusBox.setContent(
        `{bold}Port:{/bold} ${p.port}\n` +
        `{bold}Name:{/bold} ${p.name}\n` +
        `{bold}Project:{/bold} ${p.project || 'N/A'}\n` +
        `{bold}Status:{/bold} ${proc ? `{green-fg}Running{/green-fg} (${proc.command}, PID ${proc.pid})` : '{gray-fg}Stopped{/gray-fg}'}\n` +
        `{bold}Registered:{/bold} ${p.created_at}`
      );
    } else if (activePanel === 'listening' && listeningPorts[idx]) {
      const p = listeningPorts[idx];
      const registered = registeredPorts.find(r => r.port === p.port);
      statusBox.setContent(
        `{bold}Port:{/bold} ${p.port}\n` +
        `{bold}Process:{/bold} ${p.command} (PID ${p.pid})\n` +
        `{bold}Protocol:{/bold} ${p.protocol}\n` +
        `{bold}Registered:{/bold} ${registered ? `{cyan-fg}Yes{/cyan-fg} - ${registered.name}` : '{yellow-fg}No{/yellow-fg}'}`
      );
    }
    screen.render();
  }

  function setActivePanel(panel: 'registered' | 'listening'): void {
    activePanel = panel;
    registeredBox.style.border = { fg: panel === 'registered' ? 'white' : 'cyan' };
    listeningBox.style.border = { fg: panel === 'listening' ? 'white' : 'yellow' };
    updateStatus();
  }

  // Key bindings
  screen.key(['q', 'C-c'], () => process.exit(0));
  screen.key('r', refresh);
  screen.key('tab', () => {
    setActivePanel(activePanel === 'registered' ? 'listening' : 'registered');
  });

  registeredList.key(['up', 'down'], updateStatus);
  listeningList.key(['up', 'down'], updateStatus);

  registeredList.on('focus', () => setActivePanel('registered'));
  listeningList.on('focus', () => setActivePanel('listening'));

  // Enable mouse and keyboard for lists
  registeredList.focus();
  (registeredList as any).interactive = true;
  (listeningList as any).interactive = true;

  screen.key('j', () => {
    const list = activePanel === 'registered' ? registeredList : listeningList;
    (list as any).down();
    updateStatus();
  });
  screen.key('k', () => {
    const list = activePanel === 'registered' ? registeredList : listeningList;
    (list as any).up();
    updateStatus();
  });

  // Auto-refresh every 2 seconds
  setInterval(refresh, 2000);

  refresh();
  screen.render();
}
