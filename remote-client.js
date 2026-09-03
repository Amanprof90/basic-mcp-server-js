const { Client } = require("@modelcontextprotocol/sdk/client/index.js");

const {
    StreamableHTTPClientTransport,
} = require("@modelcontextprotocol/sdk/client/streamableHttp.js");


async function main() {

    // =========================================================
    // 1. CREATE MCP CLIENT
    // =========================================================

    const client = new Client(
        {
            name: "basic-remote-mcp-client",
            version: "1.0.0",
        },
        {
            capabilities: {},
        }
    );


    // =========================================================
    // 2. CONNECT TO REMOTE MCP SERVER
    // =========================================================

    const transport = new StreamableHTTPClientTransport(
    new URL("https://basic-mcp-server-js.onrender.com/mcp")
    );

    // const transport = new StreamableHTTPClientTransport(
    //     new URL("http://localhost:3000/mcp")
    // );

    await client.connect(transport);

    console.log("Connected to remote MCP server.");


    // =========================================================
    // 3. LIST TOOLS
    // =========================================================

    console.log("\n================ TOOLS ================\n");

    const tools = await client.listTools();

    console.dir(tools, {
        depth: null,
    });


    // =========================================================
    // 4. CALL get_time
    // =========================================================

    console.log("\n================ GET TIME ================\n");

    const timeResult = await client.callTool({
        name: "get_time",
        arguments: {},
    });

    console.dir(timeResult, {
        depth: null,
    });


    // =========================================================
    // 5. CALL calculator
    // =========================================================

    console.log("\n================ CALCULATOR ================\n");

    const calculatorResult = await client.callTool({
        name: "calculator",
        arguments: {
            a: 10,
            b: 10,
            operation: "multiply",
        },
    });

    console.dir(calculatorResult, {
        depth: null,
    });


    // =========================================================
    // 6. CALL text_stats
    // =========================================================

    console.log("\n================ TEXT STATS ================\n");

    const textStatsResult = await client.callTool({
        name: "text_stats",
        arguments: {
            text: "MCP allows AI systems to interact with external tools.",
        },
    });

    console.dir(textStatsResult, {
        depth: null,
    });


    // =========================================================
    // 7. LIST RESOURCES
    // =========================================================

    console.log("\n================ RESOURCES ================\n");

    const resources = await client.listResources();

    console.dir(resources, {
        depth: null,
    });


    // =========================================================
    // 8. READ STATIC RESOURCE
    // =========================================================

    console.log("\n================ COMPANY RESOURCE ================\n");

    const companyResource = await client.readResource({
        uri: "company://about",
    });

    console.dir(companyResource, {
        depth: null,
    });


    // =========================================================
    // 9. LIST RESOURCE TEMPLATES
    // =========================================================

    console.log(
        "\n================ RESOURCE TEMPLATES ================\n"
    );

    const resourceTemplates = await client.listResourceTemplates();

    console.dir(resourceTemplates, {
        depth: null,
    });


    // =========================================================
    // 10. READ DYNAMIC RESOURCE
    // =========================================================

    console.log(
        "\n================ DYNAMIC RESOURCE ================\n"
    );

    const productResource = await client.readResource({
        uri: "company://products/erp",
    });

    console.dir(productResource, {
        depth: null,
    });


    // =========================================================
    // 11. LIST PROMPTS
    // =========================================================

    console.log("\n================ PROMPTS ================\n");

    const prompts = await client.listPrompts();

    console.dir(prompts, {
        depth: null,
    });


    // =========================================================
    // 12. GET review_pr PROMPT
    // =========================================================

    console.log("\n================ REVIEW PR PROMPT ================\n");

    const reviewPrompt = await client.getPrompt({
        name: "review_pr",
        arguments: {
            owner: "Amanprof90",
            repo: "basic-mcp",
            pullNumber: "1",
        },
    });

    console.dir(reviewPrompt, {
        depth: null,
    });


    // =========================================================
    // 13. CLOSE CONNECTION
    // =========================================================

    await transport.close();

    console.log("\nRemote MCP test completed successfully.");
}


main().catch((error) => {

    console.error("\nClient error:", error);

    process.exit(1);
});