import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import express from 'express';
import cors from 'cors';
import { registerTools } from './tools.js';
import { registerResources } from './resources.js';

function createServer(): McpServer {
  const server = new McpServer({ name: 'arc-iac', version: '1.0.0' });
  registerTools(server);
  registerResources(server);
  return server;
}

const port = process.env.PORT ? parseInt(process.env.PORT) : undefined;

if (port) {
  // HTTP mode — hosted, globally accessible
  const app = express();
  app.use(cors());
  app.use(express.json());

  app.get('/', (_req, res) => {
    res.json({
      name: 'ARC IaC MCP Server',
      version: '1.0.0',
      description: 'SourceFuse ARC Terraform module browser — 10 tools for listing, searching, scaffolding, and comparing modules from registry.terraform.io',
      mcp_endpoint: '/mcp',
      tools: [
        'arc_list_modules', 'arc_search_modules', 'arc_get_module',
        'arc_get_inputs', 'arc_get_outputs', 'arc_get_resources',
        'arc_get_versions', 'arc_find_by_resource', 'arc_compare_modules', 'arc_scaffold',
      ],
    });
  });

  app.all('/mcp', async (req, res) => {
    const server = createServer();
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  });

  app.listen(port, () => {
    process.stderr.write(`arc-iac MCP server running on port ${port}\n`);
    process.stderr.write(`MCP endpoint: http://localhost:${port}/mcp\n`);
  });
} else {
  // stdio mode — local Claude Desktop
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
