import { execSync } from 'child_process';
import { readFileSync, existsSync, readdirSync } from 'fs';
import { join, dirname, basename } from 'path';
import chalk from 'chalk';

// Well-known ports
const KNOWN_PORTS: Record<number, { name: string; category: string }> = {
  22: { name: 'SSH', category: 'system' },
  80: { name: 'HTTP', category: 'web' },
  443: { name: 'HTTPS', category: 'web' },
  3000: { name: 'Dev Server (React/Node)', category: 'dev' },
  3001: { name: 'Dev Server', category: 'dev' },
  5173: { name: 'Vite', category: 'dev' },
  5432: { name: 'PostgreSQL', category: 'database' },
  6379: { name: 'Redis', category: 'database' },
  8080: { name: 'HTTP Proxy/API', category: 'web' },
  8081: { name: 'HTTP Alt', category: 'web' },
  8888: { name: 'Jupyter Notebook', category: 'dev' },
  9090: { name: 'Prometheus', category: 'monitoring' },
  9200: { name: 'Elasticsearch', category: 'database' },
  11434: { name: 'Ollama', category: 'ai' },
  11435: { name: 'Ollama Alt', category: 'ai' },
  27017: { name: 'MongoDB', category: 'database' },
};

// Process name patterns
const PROCESS_PATTERNS: Array<{ pattern: RegExp; name: string; category: string }> = [
  { pattern: /^node$/, name: 'Node.js', category: 'runtime' },
  { pattern: /^python3?$/, name: 'Python', category: 'runtime' },
  { pattern: /^uvicorn$/, name: 'Uvicorn (FastAPI/ASGI)', category: 'web' },
  { pattern: /^gunicorn$/, name: 'Gunicorn (WSGI)', category: 'web' },
  { pattern: /^nginx$/, name: 'Nginx', category: 'web' },
  { pattern: /^postgres$/, name: 'PostgreSQL', category: 'database' },
  { pattern: /^redis-server$/, name: 'Redis', category: 'database' },
  { pattern: /^mongod$/, name: 'MongoDB', category: 'database' },
  { pattern: /^ollama$/, name: 'Ollama', category: 'ai' },
  { pattern: /^syncthing$/, name: 'Syncthing', category: 'sync' },
  { pattern: /^ttyd$/, name: 'ttyd (Web Terminal)', category: 'dev' },
  { pattern: /^code$/, name: 'VS Code', category: 'dev' },
  { pattern: /^jupyter/, name: 'Jupyter', category: 'dev' },
];

export interface ProcessDetails {
  pid: number;
  command: string;
  cmdline: string[];
  cwd: string | null;
  user: string | null;
}

export interface ProjectInfo {
  path: string;
  name: string;
  type: 'node' | 'python' | 'rust' | 'go' | 'unknown';
  description?: string;
}

export interface PortIdentification {
  port: number;
  process: ProcessDetails | null;
  knownService: { name: string; category: string } | null;
  processType: { name: string; category: string } | null;
  project: ProjectInfo | null;
  httpInfo: HttpProbeResult | null;
  suggestedName: string;
}

export interface HttpProbeResult {
  status: number;
  server?: string;
  contentType?: string;
  title?: string;
  framework?: string;
}

export function getProcessDetails(pid: number): ProcessDetails | null {
  try {
    const command = execSync(`ps -p ${pid} -o comm= 2>/dev/null`, { encoding: 'utf-8' }).trim();

    // Get cmdline from /proc
    let cmdline: string[] = [];
    try {
      const cmdlineRaw = readFileSync(`/proc/${pid}/cmdline`, 'utf-8');
      cmdline = cmdlineRaw.split('\0').filter(Boolean);
    } catch {}

    // Get cwd from /proc
    let cwd: string | null = null;
    try {
      cwd = execSync(`readlink /proc/${pid}/cwd 2>/dev/null`, { encoding: 'utf-8' }).trim();
    } catch {}

    // Get user
    let user: string | null = null;
    try {
      user = execSync(`ps -p ${pid} -o user= 2>/dev/null`, { encoding: 'utf-8' }).trim();
    } catch {}

    return { pid, command, cmdline, cwd, user };
  } catch {
    return null;
  }
}

export function detectProject(cwd: string | null): ProjectInfo | null {
  if (!cwd || !existsSync(cwd)) return null;

  // Walk up to find project root
  let dir = cwd;
  for (let i = 0; i < 10; i++) {
    // Check for package.json (Node)
    const pkgPath = join(dir, 'package.json');
    if (existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
        return {
          path: dir,
          name: pkg.name || basename(dir),
          type: 'node',
          description: pkg.description,
        };
      } catch {}
    }

    // Check for pyproject.toml (Python)
    const pyprojectPath = join(dir, 'pyproject.toml');
    if (existsSync(pyprojectPath)) {
      try {
        const content = readFileSync(pyprojectPath, 'utf-8');
        const nameMatch = content.match(/name\s*=\s*"([^"]+)"/);
        const descMatch = content.match(/description\s*=\s*"([^"]+)"/);
        return {
          path: dir,
          name: nameMatch?.[1] || basename(dir),
          type: 'python',
          description: descMatch?.[1],
        };
      } catch {}
    }

    // Check for Cargo.toml (Rust)
    if (existsSync(join(dir, 'Cargo.toml'))) {
      return { path: dir, name: basename(dir), type: 'rust' };
    }

    // Check for go.mod (Go)
    if (existsSync(join(dir, 'go.mod'))) {
      return { path: dir, name: basename(dir), type: 'go' };
    }

    // Check for .git (generic project root)
    if (existsSync(join(dir, '.git'))) {
      return { path: dir, name: basename(dir), type: 'unknown' };
    }

    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  return null;
}

export function matchProcessPattern(command: string): { name: string; category: string } | null {
  for (const p of PROCESS_PATTERNS) {
    if (p.pattern.test(command)) {
      return { name: p.name, category: p.category };
    }
  }
  return null;
}

export async function probeHttp(port: number, timeout = 2000): Promise<HttpProbeResult | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const response = await fetch(`http://localhost:${port}/`, {
      signal: controller.signal,
      headers: { 'User-Agent': 'port-registry/1.0' },
    });

    clearTimeout(timeoutId);

    const result: HttpProbeResult = {
      status: response.status,
      server: response.headers.get('server') || undefined,
      contentType: response.headers.get('content-type') || undefined,
    };

    // Try to get title from HTML
    if (result.contentType?.includes('text/html')) {
      try {
        const text = await response.text();
        const titleMatch = text.match(/<title>([^<]+)<\/title>/i);
        if (titleMatch) result.title = titleMatch[1].trim();

        // Detect frameworks
        if (text.includes('__NEXT_DATA__')) result.framework = 'Next.js';
        else if (text.includes('ng-version')) result.framework = 'Angular';
        else if (text.includes('data-reactroot') || text.includes('__REACT')) result.framework = 'React';
        else if (text.includes('data-v-')) result.framework = 'Vue';
        else if (text.includes('Swagger') || text.includes('swagger')) result.framework = 'Swagger/OpenAPI';
      } catch {}
    }

    // Check for API responses
    if (result.contentType?.includes('application/json')) {
      result.framework = 'JSON API';
    }

    return result;
  } catch {
    return null;
  }
}

export function generateSuggestedName(id: PortIdentification): string {
  // Priority: project name > http title > known service > process type > command
  if (id.project?.name) {
    const suffix = id.httpInfo?.framework ? ` (${id.httpInfo.framework})` : '';
    return `${id.project.name}${suffix}`;
  }

  if (id.httpInfo?.title && id.httpInfo.title.length < 40) {
    return id.httpInfo.title;
  }

  if (id.knownService) {
    return id.knownService.name;
  }

  if (id.processType) {
    return `${id.processType.name} Service`;
  }

  if (id.process?.command) {
    return id.process.command;
  }

  return `Port ${id.port}`;
}

export async function identifyPort(port: number, pid?: number): Promise<PortIdentification> {
  // Get PID if not provided
  if (!pid) {
    try {
      const output = execSync(`lsof -i :${port} -t 2>/dev/null`, { encoding: 'utf-8' });
      pid = parseInt(output.trim().split('\n')[0], 10);
    } catch {}
  }

  const process = pid ? getProcessDetails(pid) : null;
  const knownService = KNOWN_PORTS[port] || null;
  const processType = process ? matchProcessPattern(process.command) : null;
  const project = process?.cwd ? detectProject(process.cwd) : null;

  // Only probe HTTP for likely web ports
  const likelyWeb = port >= 3000 && port < 65535 &&
    (processType?.category === 'web' || processType?.category === 'dev' ||
     knownService?.category === 'web' || !knownService);
  const httpInfo = likelyWeb ? await probeHttp(port) : null;

  const id: PortIdentification = {
    port,
    process,
    knownService,
    processType,
    project,
    httpInfo,
    suggestedName: '',
  };

  id.suggestedName = generateSuggestedName(id);

  return id;
}

export function formatIdentification(id: PortIdentification): string {
  const lines: string[] = [];

  lines.push(chalk.bold(`\nPort ${chalk.cyan(id.port)}`));
  lines.push(chalk.gray('─'.repeat(50)));

  if (id.process) {
    lines.push(`${chalk.gray('Process:')}    ${id.process.command} ${chalk.gray(`(PID ${id.process.pid})`)}`);
    if (id.process.user) {
      lines.push(`${chalk.gray('User:')}       ${id.process.user}`);
    }
    if (id.process.cmdline.length > 1) {
      const args = id.process.cmdline.slice(1).join(' ');
      const truncated = args.length > 60 ? args.slice(0, 60) + '...' : args;
      lines.push(`${chalk.gray('Args:')}       ${truncated}`);
    }
    if (id.process.cwd) {
      lines.push(`${chalk.gray('Working Dir:')} ${id.process.cwd}`);
    }
  } else {
    lines.push(chalk.gray('No process found (port may be free)'));
  }

  if (id.knownService) {
    lines.push(`${chalk.gray('Known As:')}   ${chalk.yellow(id.knownService.name)} ${chalk.gray(`[${id.knownService.category}]`)}`);
  }

  if (id.processType && id.processType.name !== id.knownService?.name) {
    lines.push(`${chalk.gray('Runtime:')}    ${chalk.blue(id.processType.name)}`);
  }

  if (id.project) {
    lines.push(`${chalk.gray('Project:')}    ${chalk.green(id.project.name)} ${chalk.gray(`(${id.project.type})`)}`);
    lines.push(`${chalk.gray('Path:')}       ${id.project.path}`);
    if (id.project.description) {
      lines.push(`${chalk.gray('Description:')} ${id.project.description}`);
    }
  }

  if (id.httpInfo) {
    lines.push(`${chalk.gray('HTTP:')}       ${chalk.green(`${id.httpInfo.status}`)} ${id.httpInfo.server ? chalk.gray(`(${id.httpInfo.server})`) : ''}`);
    if (id.httpInfo.title) {
      lines.push(`${chalk.gray('Title:')}      ${id.httpInfo.title}`);
    }
    if (id.httpInfo.framework) {
      lines.push(`${chalk.gray('Framework:')}  ${chalk.magenta(id.httpInfo.framework)}`);
    }
  }

  lines.push('');
  lines.push(`${chalk.gray('Suggested:')}  ${chalk.bold(id.suggestedName)}`);
  lines.push(chalk.gray(`             ports register ${id.port} "${id.suggestedName}"`));

  return lines.join('\n');
}
