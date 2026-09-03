const {
    McpServer,
} = require("@modelcontextprotocol/sdk/server/mcp.js");

const {
    StreamableHTTPServerTransport,
} = require("@modelcontextprotocol/sdk/server/streamableHttp.js");

const http = require("http");

const {
    registerCapabilities,
} = require("./mcp/registerCapabilities");


function createMcpServer() {

    const server = new McpServer({
        name: "basic-remote-mcp-server",
        version: "1.0.0",
    });

    registerCapabilities(server);

    return server;
}


const httpServer = http.createServer(async (req, res) => {

    console.log(`${req.method} ${req.url}`);

    if (req.url !== "/mcp") {
        res.writeHead(404);
        res.end("Not Found");
        return;
    }

    try {

        // Create a fresh MCP server for this request
        const server = createMcpServer();

        // Stateless Streamable HTTP transport
        const transport = new StreamableHTTPServerTransport({
            sessionIdGenerator: undefined,
        });


        // Connect MCP server to HTTP transport
        await server.connect(transport);

        // Let MCP handle the request
        await transport.handleRequest(req, res);

        // Cleanup
        res.on("close", () => {
            transport.close().catch(() => {});
            server.close().catch(() => {});
        });

    } catch (error) {

        console.error("MCP request error:", error);

        if (!res.headersSent) {

            res.writeHead(500, {
                "Content-Type": "application/json",
            });

            res.end(
                JSON.stringify({
                    error: "Internal MCP server error",
                })
            );
        }
    }
});


const PORT = process.env.PORT || 3000;
const HOST = "0.0.0.0";


httpServer.listen(PORT, HOST, () => {

    console.log(
        `MCP HTTP server running on http://${HOST}:${PORT}/mcp`
    );

});