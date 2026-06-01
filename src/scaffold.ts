import type { ModuleDetail, Input } from './registry.js';

// ─── Dependency detection ───────────────────────────────────────────────────

const SUPPORT_RULES: Array<{
  pattern: RegExp;
  arcModule: string;
  instance: string;
  ref: string;
}> = [
  { pattern: /^tags$/,                                arcModule: 'arc-tags',           instance: 'tags',    ref: 'module.tags.tags' },
  { pattern: /^vpc_id$/,                              arcModule: 'arc-network',        instance: 'network', ref: 'module.network.vpc_id' },
  { pattern: /^subnet_ids?$/,                         arcModule: 'arc-network',        instance: 'network', ref: 'module.network.private_subnet_ids' },
  { pattern: /^vpc_config$/,                          arcModule: 'arc-network',        instance: 'network', ref: '{\n    subnet_ids         = module.network.private_subnet_ids\n    security_group_ids = [module.network.default_security_group_id]\n  }' },
  { pattern: /^db_subnet_group_data$/,                arcModule: 'arc-network',        instance: 'network', ref: '{\n    name       = "${var.namespace}-${var.environment}-db-subnet-group"\n    subnet_ids = module.network.private_subnet_ids\n  }' },
  { pattern: /^kms_key_id$|^kms_arn$|^kms_key_arn$/, arcModule: 'arc-kms',            instance: 'kms',     ref: 'module.kms.key_arn' },
  { pattern: /^kms_data$/,                            arcModule: 'arc-kms',            instance: 'kms',     ref: '{ key_id = module.kms.key_id, key_arn = module.kms.key_arn }' },
  { pattern: /^security_group_ids?$/,                 arcModule: 'arc-security-group', instance: 'sg',      ref: '[module.sg.id]' },
];

export interface SupportDep { arcModule: string; instance: string; }

export function detectSupportingModules(inputs: Input[]): SupportDep[] {
  const seen = new Set<string>();
  const result: SupportDep[] = [];
  for (const input of inputs.filter(i => i.required)) {
    for (const rule of SUPPORT_RULES) {
      if (rule.pattern.test(input.name) && !seen.has(rule.arcModule)) {
        seen.add(rule.arcModule);
        result.push({ arcModule: rule.arcModule, instance: rule.instance });
      }
    }
  }
  return result;
}

function refForInput(name: string, availableDeps: SupportDep[]): string | null {
  const depModules = new Set(availableDeps.map(d => d.arcModule));
  for (const rule of SUPPORT_RULES) {
    if (rule.pattern.test(name) && depModules.has(rule.arcModule)) return rule.ref;
  }
  return null;
}

// ─── HCL type → Terraform type string ──────────────────────────────────────

function tfType(hclType: string): string {
  const t = hclType.toLowerCase().trim();
  if (t.startsWith('list')) return 'list(string)';
  if (t.startsWith('map')) return 'map(string)';
  if (t.startsWith('object') || t.startsWith('set')) return 'any';
  if (t === 'bool' || t === 'boolean') return 'bool';
  if (t === 'number') return 'number';
  return 'string';
}

// ─── File generators ─────────────────────────────────────────────────────────

function buildVersionsTf(mods: ModuleDetail[]): string {
  // Detect if any module uses helm or kubernetes resources
  const resources = mods.flatMap(m => (m.root?.resources ?? []).map(r => r.type));
  const needsHelm = resources.some(r => r.startsWith('helm_'));
  const needsK8s  = resources.some(r => r.startsWith('kubernetes_'));

  const lines = [
    'terraform {',
    '  required_version = ">= 1.3.0"',
    '',
    '  required_providers {',
    '    aws = {',
    '      source  = "hashicorp/aws"',
    '      version = ">= 5.0"',
    '    }',
  ];
  if (needsHelm) {
    lines.push('    helm = {', '      source  = "hashicorp/helm"', '      version = ">= 2.0"', '    }');
  }
  if (needsK8s) {
    lines.push('    kubernetes = {', '      source  = "hashicorp/kubernetes"', '      version = ">= 2.0"', '    }');
  }
  lines.push('  }', '}');
  return lines.join('\n');
}

function buildVariablesTf(
  allMods: Array<{ detail: ModuleDetail; instance: string }>,
  crossRefDeps: SupportDep[],
): string {
  // Collect every required input that is NOT satisfied by a cross-reference.
  // Deduplicate by variable name (common inputs like environment/namespace/name appear in every module).
  const seen = new Set<string>();
  const blocks: string[] = [];

  for (const { detail } of allMods) {
    for (const input of (detail.root?.inputs ?? []).filter(i => i.required)) {
      if (refForInput(input.name, crossRefDeps)) continue; // provided by another module
      if (seen.has(input.name)) continue;
      seen.add(input.name);
      blocks.push([
        `variable "${input.name}" {`,
        `  description = ${JSON.stringify(input.description || input.name)}`,
        `  type        = ${tfType(input.type)}`,
        '}',
      ].join('\n'));
    }
  }

  return blocks.join('\n\n');
}

function buildOutputsTf(mod: ModuleDetail, instanceName: string): string {
  const outputs = mod.root?.outputs ?? [];
  if (outputs.length === 0) return '';
  return outputs.map(o => [
    `output "${instanceName}_${o.name}" {`,
    `  description = ${JSON.stringify(o.description || o.name)}`,
    `  value       = module.${instanceName}.${o.name}`,
    '}',
  ].join('\n')).join('\n\n');
}

function buildModuleBlock(
  detail: ModuleDetail,
  instanceName: string,
  crossRefDeps: SupportDep[],
): string {
  const inputs  = detail.root?.inputs ?? [];
  const required = inputs.filter(i => i.required);
  const optional = inputs.filter(i => !i.required);
  const lines: string[] = [
    `module "${instanceName}" {`,
    `  source  = "sourcefuse/${detail.name}/aws"`,
    `  version = "${detail.version}"`,
    '',
  ];

  if (required.length > 0) {
    lines.push('  # --- required ---');
    for (const i of required) {
      const ref = refForInput(i.name, crossRefDeps);
      lines.push(ref
        ? `  ${i.name} = ${ref}`
        : `  ${i.name} = var.${i.name}`
      );
    }
    lines.push('');
  }

  if (optional.length > 0) {
    lines.push('  # --- optional (uncomment to override defaults) ---');
    for (const i of optional) {
      const def = i.default === null || i.default === undefined ? 'null'
        : typeof i.default === 'string' ? `"${i.default}"`
        : JSON.stringify(i.default);
      lines.push(`  # ${i.name} = ${def}`);
    }
    lines.push('');
  }

  lines.push('}');
  return lines.join('\n');
}


// ─── Public API ──────────────────────────────────────────────────────────────

export type ScaffoldFiles = Record<string, string>;

export function generateScaffold(
  mod: ModuleDetail,
  instanceName = 'this',
  supportingMods: Array<{ detail: ModuleDetail; instance: string }> = [],
): ScaffoldFiles {
  const crossRefDeps: SupportDep[] = supportingMods.map(s => ({
    arcModule: s.detail.name,
    instance: s.instance,
  }));

  const allMods = [...supportingMods, { detail: mod, instance: instanceName }];
  const files: ScaffoldFiles = {};

  // Each supporting module gets its own file: network.tf, kms.tf, tags.tf, etc.
  for (const { detail, instance } of supportingMods) {
    files[`${instance}.tf`] = buildModuleBlock(detail, instance, []);
  }

  // Primary module always goes in main.tf
  files['main.tf'] = buildModuleBlock(mod, instanceName, crossRefDeps);

  const variables = buildVariablesTf(allMods, crossRefDeps);
  if (variables.trim()) files['variables.tf'] = variables;

  const outputs = buildOutputsTf(mod, instanceName);
  if (outputs.trim()) files['outputs.tf'] = outputs;

  files['versions.tf'] = buildVersionsTf(allMods.map(m => m.detail));

  return files;
}

// Canonical file order for display
const FILE_ORDER = ['versions.tf', 'variables.tf', 'main.tf', 'outputs.tf'];

export function formatScaffoldFiles(files: ScaffoldFiles): string {
  const ordered = [
    ...FILE_ORDER.filter(f => f in files),
    ...Object.keys(files).filter(f => !FILE_ORDER.includes(f)).sort(),
  ];
  return ordered
    .map(filename => `### ${filename}\n\`\`\`hcl\n${files[filename]}\n\`\`\``)
    .join('\n\n');
}
