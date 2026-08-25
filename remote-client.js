const { Client } = require("@modelcontextprotocol/sdk/client/index.js");

const {
  StreamableHTTPClientTransport,
} = require("@modelcontextprotocol/sdk/client/streamableHttp.js");

const client = new Client({
  name: "basic-remote-mcp-client",
  version: "1.0.0",
});

const transport = new StreamableHTTPClientTransport(
  new URL("https://basic-mcp-server-js.onrender.com/mcp")
);

async function main() {
  // ==========================================================
  // CONNECT
  // ==========================================================

  await client.connect(transport);

  console.log("Connected to remote MCP server.");

  // ==========================================================
  // DISCOVER TOOLS
  // ==========================================================

  const tools = await client.listTools();

  console.log("\nAvailable tools:");

  console.dir(tools, { depth: null });

  // ==========================================================
  // TOOL 1: GET TIME
  // ==========================================================

  const timeResult = await client.callTool({
    name: "get_time",
    arguments: {},
  });

  console.log("\nTime result:");

  console.dir(timeResult, { depth: null });

  // ==========================================================
  // TOOL 2: CALCULATOR
  // ==========================================================

  const calculation = await client.callTool({
    name: "calculator",
    arguments: {
      a: 20,
      b: 5,
      operation: "multiply",
    },
  });

  console.log("\nCalculator result:");

  console.dir(calculation, { depth: null });

  // ==========================================================
  // TOOL 3: TEXT STATS
  // ==========================================================

  const textResult = await client.callTool({
    name: "text_stats",
    arguments: {
      text: "MCP connects AI applications with external tools.",
    },
  });

  console.log("\nText statistics result:");

  console.dir(textResult, { depth: null });
}

main().catch((error) => {
  console.error("Client error:", error);
});