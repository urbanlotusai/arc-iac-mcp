# ARC IaC MCP Server

A Model Context Protocol (MCP) server that gives AI assistants direct access to [SourceFuse ARC](https://registry.terraform.io/namespaces/sourcefuse) Terraform modules. Browse, search, scaffold, compare, and security-scan any of the 58+ ARC modules — all from a natural language conversation.

**Live endpoint:** `https://mcp-theta-silk.vercel.app/mcp`  
**Source:** `github.com/urbanlotusai/arc-iac-mcp`

---

## What It Does

Instead of manually browsing the Terraform Registry, opening GitHub tabs, and hand-writing module blocks, you can ask your AI assistant:

> *"Scaffold an arc-eks module called production and check it for security issues"*

The assistant calls the right tools, gets the correct version from the Registry, generates the HCL, runs tfsec against it, and returns the scaffold with a security report — all in one response.

---

## Quick Start

### Claude Desktop

Edit `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "arc-iac": {
      "url": "https://mcp-theta-silk.vercel.app/mcp"
    }
  }
}
```

Restart Claude Desktop. The server appears under the tools (⚙) panel.

### Claude Code CLI

```bash
claude mcp add arc-iac --transport http https://mcp-theta-silk.vercel.app/mcp
```

Or add it to your project's `.mcp.json`:

```json
{
  "mcpServers": {
    "arc-iac": {
      "type": "http",
      "url": "https://mcp-theta-silk.vercel.app/mcp"
    }
  }
}
```

### Kiro

**User-level** (`~/.kiro/settings/mcp.json`) — applies to all your projects:

```json
{
  "mcpServers": {
    "arc-iac": {
      "url": "https://mcp-theta-silk.vercel.app/mcp",
      "autoApprove": ["*"],
      "disabled": false
    }
  }
}
```

**Project-level** (`.kiro/settings/mcp.json` in your repo) — shared with your team automatically:

```json
{
  "mcpServers": {
    "arc-iac": {
      "url": "https://mcp-theta-silk.vercel.app/mcp",
      "autoApprove": ["*"]
    }
  }
}
```

Open via `Cmd+Shift+P` → **MCP Configuration**.

### Cursor / Windsurf

`.cursor/mcp.json` or `.codeium/windsurf/mcp_config.json`:

```json
{
  "mcpServers": {
    "arc-iac": {
      "url": "https://mcp-theta-silk.vercel.app/mcp"
    }
  }
}
```

---

## Tools Reference

All tools use the module's **short name** (e.g. `arc-eks`, not `terraform-aws-arc-eks`).

---

### `arc_list_modules`

Lists all 58 SourceFuse ARC modules with name, description, download count, and latest version.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `sort` | `"downloads" \| "name"` | No | Sort order. Omit for default Registry order. |

**Example prompt:** *"List all ARC modules sorted by downloads"*

**Sample output:**
```json
[
  { "name": "arc-tags", "description": "Resource tagging", "downloads": 115318, "version": "1.1.1" },
  { "name": "arc-db", "description": "RDS Aurora/Proxy — HA database", "downloads": 8793, "version": "2.0.3" }
]
```

---

### `arc_search_modules`

Full-text search across module names and descriptions.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `q` | `string` | Yes | Search keyword e.g. `eks`, `load balancer`, `kafka` |

**Example prompt:** *"Search for ARC modules related to networking"*

---

### `arc_get_module`

Full detail for one module: all inputs, outputs, AWS resources it creates, README, and version list.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `name` | `string` | Yes | Module short name e.g. `arc-eks` |

**Example prompt:** *"Show me full details for arc-network"*

---

### `arc_get_inputs`

Returns only the input variables for a module. Each input includes `name`, `type`, `description`, `default`, and `required`.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `name` | `string` | Yes | Module short name |

**Example prompt:** *"What inputs does arc-eks require?"*

**Sample output:**
```json
[
  { "name": "vpc_config", "type": "object", "description": "VPC configuration", "default": null, "required": true },
  { "name": "kubernetes_version", "type": "string", "description": "K8s version", "default": "1.29", "required": false }
]
```

---

### `arc_get_outputs`

Returns the output values exported by a module.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `name` | `string` | Yes | Module short name |

**Example prompt:** *"What does arc-eks output?"*

---

### `arc_get_resources`

Lists the Terraform resources (AWS and other providers) that a module creates.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `name` | `string` | Yes | Module short name |

**Example prompt:** *"What AWS resources does arc-network create?"*

**Sample output:**
```json
[
  { "type": "aws_vpc", "name": "main" },
  { "type": "aws_subnet", "name": "private" },
  { "type": "aws_nat_gateway", "name": "this" }
]
```

---

### `arc_get_versions`

Lists all released versions of a module. The first item is always the latest.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `name` | `string` | Yes | Module short name |

**Example prompt:** *"What versions of arc-eks are available?"*

**Sample output:**
```json
[
  { "version": "6.0.2", "latest": true },
  { "version": "6.0.1", "latest": false }
]
```

---

### `arc_find_by_resource`

Scans the entire ARC catalog and returns all modules that provision a specific AWS resource type.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `resource` | `string` | Yes | Terraform resource type e.g. `aws_eks_cluster`, `aws_s3_bucket` |

> **Note:** This tool fetches all 58 modules in parallel and may take 10–20 seconds on first run.

**Example prompt:** *"Which ARC modules create an aws_s3_bucket?"*

---

### `arc_compare_modules`

Side-by-side diff of two modules. Shows which inputs, outputs, and AWS resources each has — and which are shared vs unique.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `module_a` | `string` | Yes | First module short name |
| `module_b` | `string` | Yes | Second module short name |

**Example prompt:** *"Compare arc-eks and arc-ecs"*

**Sample output:**
```json
{
  "module_a": { "name": "arc-eks", "version": "6.0.2", "downloads": 4283 },
  "module_b": { "name": "arc-ecs", "version": "2.0.1", "downloads": 890 },
  "resources": {
    "aws_eks_cluster":  { "in_a": true,  "in_b": false },
    "aws_ecs_cluster":  { "in_a": false, "in_b": true  },
    "aws_iam_role":     { "in_a": true,  "in_b": true  }
  },
  "inputs": { ... },
  "outputs": { ... }
}
```

---

### `arc_scaffold`

Generates a ready-to-paste HCL `module` block. Required inputs are uncommented with a `# REQUIRED` marker. Optional inputs are commented out with their default values shown.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `name` | `string` | Yes | Module short name |
| `instance_name` | `string` | No | Logical name for the block e.g. `main`, `production`. Defaults to `this`. |

**Example prompt:** *"Scaffold an arc-network module called production"*

**Sample output:**
```hcl
module "production" {
  source  = "sourcefuse/arc-network/aws"
  version = "6.0.11"

  # --- required inputs ---
  namespace = "" # REQUIRED — string
  vpc_cidr  = "" # REQUIRED — string

  # --- optional inputs (uncomment to override defaults) ---
  # availability_zones     = "[]"   # optional — list(string)
  # enable_nat_gateway     = "true" # optional — bool
}
```

---

### `arc_scan_hcl`

Runs a static security scan (powered by [tfsec](https://github.com/aquasecurity/tfsec)) on any Terraform/HCL code. Returns findings grouped by severity with rule IDs, descriptions, and an overall security score out of 100.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `hcl` | `string` | Yes | Terraform/HCL code to scan |

> **Note:** The scan service may take up to 60 seconds on first call after a period of inactivity (cold start on Cloud Run).

**Example prompt:** *"Scan this HCL for security issues: `resource "aws_s3_bucket" "data" { bucket = "my-bucket" }`"*

**Sample output:**
```
## Security Scan — provided HCL
**Score: 90/100** | ✅ 9 passed | ❌ 1 failed

### 🟠 HIGH (1)
- **AVD-AWS-0092**: S3 encryption at rest is not enabled
```

---

### `arc_validate_module`

Combines `arc_scaffold` and `arc_scan_hcl` in a single call — generates the HCL scaffold and immediately runs a security scan against it. The most efficient way to assess a module before adopting it.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `name` | `string` | Yes | Module short name |
| `instance_name` | `string` | No | Logical instance name. Defaults to `this`. |

**Example prompt:** *"Validate arc-security-group for me"*

**Returns:** The full HCL scaffold followed by the security report.

---

## MCP Resource

In addition to tools, the server exposes one MCP resource that AI clients can read as background context.

| URI | MIME | Description |
|-----|------|-------------|
| `arc://sourcefuse/modules` | `application/json` | Full catalog of all ARC modules from registry.terraform.io |

---

## Example Workflows

### Scaffold a full EKS stack

```
"Give me scaffolds for arc-network, arc-eks, and arc-eks-addon wired together"
```

The assistant will call `arc_scaffold` three times, then use `arc_get_outputs` / `arc_get_inputs` to wire the outputs of one module into the inputs of the next.

---

### Find the right module for a task

```
"I need to set up a message queue. Which ARC module should I use?"
```

Calls `arc_search_modules` with relevant keywords, returns matching modules with descriptions and download counts.

---

### Security review before PR

```
"Scan the following Terraform before I raise a PR: <paste HCL>"
```

Calls `arc_scan_hcl`, returns a severity-grouped report with a score. If issues are found, you can ask the assistant to suggest fixes.

---

### Module selection decision

```
"Compare arc-eks and arc-ecs. I need to run 10 microservices — which is better?"
```

Calls `arc_compare_modules`, returns a structured diff. The assistant reasons over the result and makes a recommendation.

---

## Architecture

```
AI Client (Claude Desktop / Claude Code / Kiro)
        │
        │  JSON-RPC over HTTPS (MCP Streamable HTTP)
        ▼
ARC IaC MCP Server  (Node.js + Express)
  ├── Path 1: known session     → reuse transport  (Render persistent)
  ├── Path 2: initialize        → create session, issue mcp-session-id
  └── Path 3: no session        → stateless bypass (Vercel serverless)
        │
        ├── registry.terraform.io/v1  (module metadata, inputs, outputs)
        │     namespace: sourcefuse
        │
        └── arc-iac-scan-service  (Google Cloud Run)
              tfsec static analysis
```

**Transport:** MCP Streamable HTTP with three-path session handling — supports both persistent-process deployments (Render) and serverless (Vercel).

**Data source:** All module data is fetched live from the public Terraform Registry. No database, no stale cache.

---

## Self-Hosting

### Option A — Render (recommended for teams)

The repo includes `render.yaml`. Connect it in the Render dashboard:

1. Go to [dashboard.render.com/new/web](https://dashboard.render.com/new/web)
2. Connect `urbanlotusai/arc-iac-mcp`
3. Render auto-reads `render.yaml` → click **Deploy**

Your endpoint: `https://arc-iac-mcp.onrender.com/mcp`

### Option B — Vercel

```bash
git clone https://github.com/urbanlotusai/arc-iac-mcp
cd arc-iac-mcp
npm install
npm run build
npx vercel deploy --prod
```

### Option C — Any Node.js host

```bash
git clone https://github.com/urbanlotusai/arc-iac-mcp
cd arc-iac-mcp
npm install
npm run build
PORT=3000 node dist/index.js
```

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | *(none — stdio mode)* | Set to any port to start HTTP server mode |
| `SCAN_SERVICE_URL` | `https://arc-iac-scan-service-...run.app` | Override the tfsec scan service URL |

When `PORT` is not set, the server starts in **stdio mode** for local Claude Desktop use.

---

## Local Development

```bash
git clone https://github.com/urbanlotusai/arc-iac-mcp
cd arc-iac-mcp
npm install

# Run in dev mode (no build step)
PORT=3000 npm run dev
```

Test with MCP Inspector:

```bash
npx @modelcontextprotocol/inspector node dist/index.js
```

Opens a browser UI at `http://localhost:5173` — invoke any tool and inspect the raw JSON-RPC request/response.

Test via curl (no session required):

```bash
curl -s -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "arc_scaffold",
      "arguments": { "name": "arc-eks", "instance_name": "production" }
    }
  }'
```

---

## Troubleshooting

**"Server not initialized" error**

This was a known issue (fixed). Update your client config to point to the current endpoint. If self-hosting, pull the latest code — the fix is in `src/index.ts` (three-path session handler).

**Tools list is empty / only resources show**

The client may be sending `tools/list` before `initialize`. Ensure your MCP client version supports Streamable HTTP. Claude Desktop 1.x, Claude Code CLI, and Kiro all work.

**`arc_find_by_resource` is slow**

Expected — it fetches all 58 modules in parallel from the Terraform Registry. Typical time is 10–20 seconds depending on Registry latency.

**`arc_scan_hcl` / `arc_validate_module` timeout**

The tfsec scan service (Google Cloud Run) may have a cold start of 30–60 seconds after a period of inactivity. Retry once — subsequent calls are fast.

**Scaffold shows wrong version**

Ensure you're on the latest server version. An earlier bug used `versions[0]` (oldest) instead of `mod.version` (latest). Fixed in commit `66f4966`.

---

## Module Naming Convention

All tools accept the **short name** without the `terraform-aws-` prefix:

| ✅ Correct | ❌ Wrong |
|-----------|---------|
| `arc-eks` | `terraform-aws-arc-eks` |
| `arc-network` | `sourcefuse/arc-network/aws` |
| `arc-db` | `arc_db` |

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Runtime | Node.js 18+ |
| Language | TypeScript 5 |
| MCP SDK | `@modelcontextprotocol/sdk` v1.29 |
| HTTP | Express 4 |
| Data source | Terraform Registry API (public) |
| Security scan | tfsec via Google Cloud Run |
| Hosting | Vercel (live) + Render (optional) |

---

## Contributing

1. Fork `urbanlotusai/arc-iac-mcp`
2. `npm install && npm run dev`
3. Add tools in `src/tools.ts` following the existing pattern
4. `npm run build` — must compile clean
5. Open a pull request

All tools must handle errors gracefully (use the `err()` helper) and return `{ content: [{ type: 'text', text: '...' }] }`.
