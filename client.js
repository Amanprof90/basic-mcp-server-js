const { Client } = require("@modelcontextprotocol/sdk/client/index.js");

const {
  StdioClientTransport,
} = require("@modelcontextprotocol/sdk/client/stdio.js");

const client = new Client({
  name: "basic-mcp-client",
  version: "1.0.0",
});

const transport = new StdioClientTransport({
  command: "node",
  args: ["server.js"],
});

async function main() {
  await client.connect(transport);

  const tools = await client.listTools();

  console.dir(tools, { depth: null });

  const result = await client.callTool({
    name: "get_time",
    arguments: {},
  });

  console.log("Time result:");
  console.log(result);

  const calculation = await client.callTool({
    name: "calculator",
    arguments: {
      a: 20,
      b: 5,
      operation: "divide",
    },
  });

  console.log("Calculator result:");
  console.log(calculation);

    const textStats = await client.callTool({
        name: "text_stats",
        arguments: {
            text: "Hello MCP world",
        },
    });

    console.log("Text statistics:");
    console.log(textStats);
}

main();