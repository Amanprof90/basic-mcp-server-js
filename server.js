require("dotenv").config({ quiet: true });

const {
  McpServer,
} = require("@modelcontextprotocol/sdk/server/mcp.js");

const {
  StdioServerTransport,
} = require("@modelcontextprotocol/sdk/server/stdio.js");

const { registerCapabilities } = require("./mcp/registerCapabilities");

const server = new McpServer({
  name: "basic-mcp-server",
  version: "1.0.0",
});

registerCapabilities(server);

async function main() {
  const transport = new StdioServerTransport();

  await server.connect(transport);

  console.error("MCP server running over STDIO");
}

main().catch((error) => {
  console.error("Server error:", error);
});