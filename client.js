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
  try {
    // 1. Connect client to MCP server
    await client.connect(transport);

    // 2. Discover available tools
    const tools = await client.listTools();

    console.log("Available tools:");
    console.dir(tools, { depth: null });

    // 3. Discover available resources
    const resources = await client.listResources();

    console.log("\nAvailable resources:");
    console.dir(resources, { depth: null });

    // 4. Call GitHub repository tool
    const repository = await client.callTool({
      name: "get_repository",
      arguments: {
        owner: "Amanprof90",
        repo: "basic-mcp-server-js",
      },
    });

    console.log("\nRepository result:");
    console.dir(repository, { depth: null });

    // 5. Call get_issue tool
    const issueResult = await client.callTool({
      name: "get_issue",
      arguments: {
        owner: "Amanprof90",
        repo: "basic-mcp-server-js",
        issueNumber: 1,
      },
    });

    console.log("\nIssue result:");
    console.dir(issueResult, { depth: null });

    // 6. Call get_pull_request tool
    const pullRequestResult = await client.callTool({
      name: "get_pull_request",
      arguments: {
        owner: "Amanprof90",
        repo: "basic-mcp-server-js",
        pullNumber: "1",
      },
    });

    console.log("\nPull Request result:");
    console.dir(pullRequestResult, { depth: null });

    // 7. Call get_file tool
    const file = await client.callTool({
      name: "get_file",
      arguments: {
        owner: "Amanprof90",
        repo: "basic-mcp-server-js",
        path: "server.js",
      },
    });

    console.log("\nFile result:");
    console.dir(file, { depth: null });

    // 8. Discover available prompts
    const prompts = await client.listPrompts();

    console.log("\nAvailable prompts:");
    console.dir(prompts, { depth: null });

    // 9. Get review_pr prompt
    const prompt = await client.getPrompt({
      name: "review_pr",
      arguments: {
        owner: "Amanprof90",
        repo: "basic-mcp-server-js",

        // IMPORTANT:
        // Server schema expects a NUMBER.
        pullNumber: 1,
      },
    });

    console.log("\nPrompt result:");
    console.dir(prompt, { depth: null });

    // 10. Read static resource
    console.error("\nBEFORE resources/read");

    const resource = await client.readResource({
      uri: "company://about",
    });

    console.log("Company resource:");
    console.dir(resource, { depth: null });

    // 11. Read dynamic resource
    const product = await client.readResource({
      uri: "company://products/erp",
    });

    console.log("\nProduct resource:");
    console.dir(product, { depth: null });

    // 12. Call get_time tool
    const result = await client.callTool({
      name: "get_time",
      arguments: {},
    });

    console.log("\nTime result:");
    console.dir(result, { depth: null });

    // 13. Call calculator tool
    const calculation = await client.callTool({
      name: "calculator",
      arguments: {
        a: 20,
        b: 5,
        operation: "divide",
      },
    });

    console.log("\nCalculator result:");
    console.dir(calculation, { depth: null });

    // 14. Call text_stats tool
    const textStats = await client.callTool({
      name: "text_stats",
      arguments: {
        text: "Hello MCP world",
      },
    });

    console.log("\nText statistics:");
    console.dir(textStats, { depth: null });
  } catch (error) {
    console.error("\nCLIENT ERROR:");
    console.error(error);
  } finally {
    // Close MCP connection
    await client.close();
  }
}

main();