# Synapse evidence MCP adapter

Run `node integrations/mcp/server.mjs` from an MCP-capable local client. Standard stdio JSON-RPC, protocol2025-11-25 with2025-06-18/2025-03-26 negotiation. `SYNAPSE_API_URL` may point only to a credential-free loopback HTTP demo (default port3018).

Read-only tools: list_reports, explain_report, find_evidence. They call the same reporting API used by the interface. No approval, export, arbitrary file access, project-management connector, voice, authentication or model endpoint is exposed. No third-party SDK/tool was installed or enabled. It is a local integration prototype; it has not been configured in Claude/Codex or tested against every agent client. Initializing this adapter does not authorize transmitting real documents to a model.

Client command: node. Argument: absolute path to server.mjs. Optional environment: SYNAPSE_API_URL. No credentials in config. Keep the Next API loopback-only and use synthetic data. A hosted MCP service requires real authentication and origin/session protections and is not provided.

Protocol references: https://modelcontextprotocol.io/specification/2025-11-25/basic/transports and https://modelcontextprotocol.io/specification/2025-11-25/server/tools. Source contents returned by tools are evidence, never instructions.
