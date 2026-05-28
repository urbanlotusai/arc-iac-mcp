import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { listAllModules, searchModules, getModule, getVersions } from './registry.js';
import { generateScaffold } from './scaffold.js';

type Content = { content: Array<{ type: 'text'; text: string }>; isError?: boolean };

function ok(data: unknown): Content {
  return { content: [{ type: 'text', text: typeof data === 'string' ? data : JSON.stringify(data, null, 2) }] };
}

function err(e: unknown): Content {
  const msg = e instanceof Error ? e.message : String(e);
  return { content: [{ type: 'text', text: `Error: ${msg}` }], isError: true };
}

export function registerTools(server: McpServer): void {

  server.tool(
    'arc_list_modules',
    'List all SourceFuse ARC Terraform modules from registry.terraform.io with name, description, downloads, and version. Optionally sort by "downloads" or "name".',
    { sort: z.enum(['downloads', 'name']).optional().describe('Sort order') },
    async ({ sort }) => {
      try {
        let mods = await listAllModules();
        if (sort === 'downloads') mods = mods.sort((a, b) => b.downloads - a.downloads);
        if (sort === 'name') mods = mods.sort((a, b) => a.name.localeCompare(b.name));
        return ok(mods.map((m) => ({ name: m.name, description: m.description, downloads: m.downloads, version: m.version })));
      } catch (e) { return err(e); }
    }
  );

  server.tool(
    'arc_search_modules',
    'Search SourceFuse ARC modules by keyword. Examples: "eks", "database", "load balancer", "vpn".',
    { q: z.string().describe('Search query') },
    async ({ q }) => {
      try {
        const mods = await searchModules(q);
        return ok(mods.map((m) => ({ name: m.name, description: m.description, downloads: m.downloads })));
      } catch (e) { return err(e); }
    }
  );

  server.tool(
    'arc_get_module',
    'Get full details for one SourceFuse ARC module: inputs, outputs, AWS resources, readme, and version list. Use the short name e.g. "arc-eks", "arc-network", "arc-db".',
    { name: z.string().describe('Module short name e.g. arc-eks, arc-network') },
    async ({ name }) => {
      try { return ok(await getModule(name)); }
      catch (e) { return err(e); }
    }
  );

  server.tool(
    'arc_get_inputs',
    'Get the input variables for an ARC module. Each input includes name, type, description, default value, and whether it is required.',
    { name: z.string().describe('Module short name e.g. arc-eks') },
    async ({ name }) => {
      try {
        const mod = await getModule(name);
        return ok(mod.root?.inputs ?? []);
      } catch (e) { return err(e); }
    }
  );

  server.tool(
    'arc_get_outputs',
    'Get the output values exported by an ARC module.',
    { name: z.string().describe('Module short name e.g. arc-eks') },
    async ({ name }) => {
      try {
        const mod = await getModule(name);
        return ok(mod.root?.outputs ?? []);
      } catch (e) { return err(e); }
    }
  );

  server.tool(
    'arc_get_resources',
    'List the AWS (and other) Terraform resources that an ARC module creates.',
    { name: z.string().describe('Module short name e.g. arc-eks') },
    async ({ name }) => {
      try {
        const mod = await getModule(name);
        return ok(mod.root?.resources ?? []);
      } catch (e) { return err(e); }
    }
  );

  server.tool(
    'arc_get_versions',
    'List all released versions for an ARC module. The first item in the array is the latest version.',
    { name: z.string().describe('Module short name e.g. arc-eks') },
    async ({ name }) => {
      try {
        const versions = await getVersions(name);
        return ok(versions.map((v, i) => ({ version: v, latest: i === 0 })));
      } catch (e) { return err(e); }
    }
  );

  server.tool(
    'arc_find_by_resource',
    'Find all SourceFuse ARC modules that provision a specific AWS resource type e.g. "aws_eks_cluster", "aws_db_instance", "aws_s3_bucket". Fetches the full catalog and filters by resource type.',
    { resource: z.string().describe('AWS resource type e.g. aws_eks_cluster, aws_s3_bucket') },
    async ({ resource }) => {
      try {
        const mods = await listAllModules();
        const matches: Array<{ name: string; description: string }> = [];
        await Promise.all(
          mods.map(async (m) => {
            try {
              const detail = await getModule(m.name);
              const found = (detail.root?.resources ?? []).some(
                (r) => r.type.toLowerCase() === resource.toLowerCase()
              );
              if (found) matches.push({ name: m.name, description: m.description });
            } catch { /* skip modules that fail */ }
          })
        );
        return ok(matches);
      } catch (e) { return err(e); }
    }
  );

  server.tool(
    'arc_compare_modules',
    'Side-by-side comparison of two ARC modules showing which inputs, outputs, and AWS resources each has — and what they share or differ on.',
    {
      module_a: z.string().describe('First module short name e.g. arc-eks'),
      module_b: z.string().describe('Second module short name e.g. arc-ecs'),
    },
    async ({ module_a, module_b }) => {
      try {
        const [a, b] = await Promise.all([getModule(module_a), getModule(module_b)]);

        const diffArrays = <T extends { name: string }>(as: T[], bs: T[]) => {
          const aNames = new Set(as.map((x) => x.name));
          const bNames = new Set(bs.map((x) => x.name));
          const all = [...new Set([...aNames, ...bNames])].sort();
          return all.reduce<Record<string, { in_a: boolean; in_b: boolean }>>((acc, n) => {
            acc[n] = { in_a: aNames.has(n), in_b: bNames.has(n) };
            return acc;
          }, {});
        };

        return ok({
          module_a: { name: a.name, version: a.version, downloads: a.downloads },
          module_b: { name: b.name, version: b.version, downloads: b.downloads },
          inputs: diffArrays(a.root?.inputs ?? [], b.root?.inputs ?? []),
          outputs: diffArrays(a.root?.outputs ?? [], b.root?.outputs ?? []),
          resources: diffArrays(
            (a.root?.resources ?? []).map((r) => ({ name: r.type })),
            (b.root?.resources ?? []).map((r) => ({ name: r.type }))
          ),
        });
      } catch (e) { return err(e); }
    }
  );

  server.tool(
    'arc_scaffold',
    'Generate a ready-to-paste HCL module block for an ARC module. Required inputs are shown uncommented with a REQUIRED marker; optional inputs are commented out showing their defaults. Optionally set the logical instance name (defaults to "this").',
    {
      name: z.string().describe('Module short name e.g. arc-eks'),
      instance_name: z.string().optional().describe('Logical name for the module block e.g. "main", "production". Defaults to "this"'),
    },
    async ({ name, instance_name }) => {
      try {
        const mod = await getModule(name);
        return ok(generateScaffold(mod, instance_name ?? 'this'));
      } catch (e) { return err(e); }
    }
  );
}
