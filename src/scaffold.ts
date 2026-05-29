import type { ModuleDetail, Input } from './registry.js';

function formatDefault(val: unknown): string {
  if (val === null || val === undefined) return 'null';
  if (typeof val === 'string') return `"${val}"`;
  if (typeof val === 'object') return JSON.stringify(val);
  return String(val);
}

function inputLine(input: Input): string {
  if (input.required) {
    return `  ${input.name} = "" # REQUIRED — ${input.type}`;
  }
  return `  # ${input.name} = ${formatDefault(input.default)} # optional — ${input.type}`;
}

export function generateScaffold(mod: ModuleDetail, instanceName = 'this'): string {
  const latest = mod.version; // mod.version is always latest from the Registry detail endpoint
  const inputs = mod.root?.inputs ?? [];
  const required = inputs.filter((i) => i.required);
  const optional = inputs.filter((i) => !i.required);

  const lines: string[] = [
    `module "${instanceName}" {`,
    `  source  = "sourcefuse/${mod.name}/aws"`,
    `  version = "${latest}"`,
    '',
  ];

  if (required.length > 0) {
    lines.push('  # --- required inputs ---');
    required.forEach((i) => lines.push(inputLine(i)));
    lines.push('');
  }

  if (optional.length > 0) {
    lines.push('  # --- optional inputs (uncomment to override defaults) ---');
    optional.forEach((i) => lines.push(inputLine(i)));
    lines.push('');
  }

  lines.push('}');
  return lines.join('\n');
}
