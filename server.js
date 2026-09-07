const path = require("path");
require("dotenv").config({
  path: path.join(__dirname, ".env"),
  quiet: true,
});

console.error("===== MCP PROCESS DEBUG =====");
console.error("UPDATE_ISSUE EXECUTED");
console.error("Server file:", __filename);
console.error("Working directory:", process.cwd());
console.error("GITHUB_TOKEN loaded:", Boolean(process.env.GITHUB_TOKEN));
console.error("=============================");

const { McpServer } = require("@modelcontextprotocol/sdk/server/mcp.js");
const {
  StdioServerTransport,
} = require("@modelcontextprotocol/sdk/server/stdio.js");

const { registerCapabilities } = require("./mcp/registerCapabilities");

const server = new McpServer({
  name: "basic-mcp-server",
  version: "1.0.0",
});

registerCapabilities(server);

async function testGithubAuth() {
  try {
    const response = await fetch("https://api.github.com/user", {
      method: "GET",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
        "X-GitHub-Api-Version": "2026-03-10",
      },
    });

    const data = await response.json();

    console.error("=== CLAUDE GITHUB AUTH TEST ===");
    console.error(
      "GITHUB_TOKEN loaded:",
      Boolean(process.env.GITHUB_TOKEN)
    );
    console.error("GitHub status:", response.status);
    console.error("GitHub login:", data.login || "NO LOGIN");
    console.error("================================");
  } catch (error) {
    console.error(
      "GitHub auth diagnostic failed:",
      error.message
    );
  }
}

async function main() {
  // Proves exactly which server.js Claude launched.
  console.error("🔥 DEV SERVER STARTED:", __filename);

  // Diagnostic: verifies the token available to Claude's process.
  await testGithubAuth();

  const transport = new StdioServerTransport();

  await server.connect(transport);

  console.error("MCP server running over STDIO");
}

main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});