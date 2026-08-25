const { McpServer } = require("@modelcontextprotocol/sdk/server/mcp.js");

const {
    StreamableHTTPServerTransport,
} = require("@modelcontextprotocol/sdk/server/streamableHttp.js");

const http = require("http");

const { z } = require("zod");

// ============================================================
// CREATE A FRESH MCP SERVER INSTANCE
// ============================================================

function createMcpServer() {
    const server = new McpServer({
        name: "basic-remote-mcp-server",
        version: "1.0.0",
    });

    // ==========================================================
    // TOOL: GET TIME
    // ==========================================================

    server.registerTool(
        "get_time",
        {
            title: "Get Current Time",

            description: "Returns the current local date and time.",

            inputSchema: {},
        },

        async () => {
            return {
                content: [
                    {
                        type: "text",
                        text: new Date().toString(),
                    },
                ],
            };
        }
    );

    //calculator tool.
server.registerTool(
    "calculator",
    {
        title: "Basic Calculator",

        description:
            "Performs basic arithmetic operations on two numbers.",

        inputSchema: {
            a: z.number().describe("First number."),

            b: z.number().describe("Second number."),

            operation: z
                .enum(["add", "subtract", "multiply", "divide"])
                .describe("Arithmetic operation to perform."),
        },
    },

    async ({ a, b, operation }) => {
        let result;

        switch (operation) {
            case "add":
                result = a + b;
                break;

            case "subtract":
                result = a - b;
                break;

            case "multiply":
                result = a * b;
                break;

            case "divide":
                if (b === 0) {
                    return {
                        content: [
                            {
                                type: "text",
                                text: "Cannot divide by zero.",
                            },
                        ],
                        isError: true,
                    };
                }

                result = a / b;
                break;

            default:
                return {
                    content: [
                        {
                            type: "text",
                            text: "Unsupported operation.",
                        },
                    ],
                    isError: true,
                };
        }

        return {
            content: [
                {
                    type: "text",
                    text: String(result),
                },
            ],
        };
    }
);

//text stats tool.
server.registerTool(
    "text_stats",
    {
        title: "Text Statistics",

        description:
            "Returns basic statistics about a piece of text.",

        inputSchema: {
            text: z
                .string()
                .describe("The text to analyze."),
        },
    },

    async ({ text }) => {
        const characters = text.length;

        const words = text
            .trim()
            .split(/\s+/)
            .filter(Boolean).length;

        const lines =
            text === ""
                ? 0
                : text.split(/\r?\n/).length;

        return {
            content: [
                {
                    type: "text",
                    text: JSON.stringify({
                        characters,
                        words,
                        lines,
                    }),
                },
            ],
        };
    }
);

    return server;
}



// ============================================================
// HTTP SERVER
// ============================================================

const httpServer = http.createServer(async (req, res) => {
    console.log(`${req.method} ${req.url}`);

    // ----------------------------------------------------------
    // Only accept MCP requests on /mcp
    // ----------------------------------------------------------

    if (req.url !== "/mcp") {
        res.writeHead(404);
        res.end("Not Found");
        return;
    }

    try {
        // --------------------------------------------------------
        // Create a NEW MCP server for this HTTP request
        // --------------------------------------------------------

        const server = createMcpServer();

        // --------------------------------------------------------
        // Create a NEW stateless HTTP transport
        // --------------------------------------------------------

        const transport = new StreamableHTTPServerTransport({
            sessionIdGenerator: undefined,
        });

        // --------------------------------------------------------
        // Connect THIS server to THIS transport
        // --------------------------------------------------------

        await server.connect(transport);

        // --------------------------------------------------------
        // Let MCP transport process the HTTP request
        // --------------------------------------------------------

        await transport.handleRequest(req, res);

        // --------------------------------------------------------
        // Cleanup
        // --------------------------------------------------------

        res.on("close", () => {
            transport.close().catch(() => { });
            server.close().catch(() => { });
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

// ============================================================
// START HTTP SERVER
// ============================================================

const PORT = process.env.PORT || 3000;
const HOST = "0.0.0.0";
httpServer.listen(PORT, HOST, () => {
    console.log(
        `MCP HTTP server running on http://${HOST}:${PORT}/mcp`
    );
});