// const { Server } = require("@modelcontextprotocol/sdk/server/index.js");  //These are classes or blueprint of this server we are gona create 
const { McpServer } = require("@modelcontextprotocol/sdk/server/mcp.js");
const { StdioServerTransport } = require("@modelcontextprotocol/sdk/server/stdio.js");//class/blueprint to communicate with AI (Client)"
const { z } = require("zod");

// This is an instance or object of server class we goona use it for mcp 
const server = new McpServer(
  {
    name: "basic-mcp-server",
    version: "1.0.0",
  });

// Register Tool : gettime tool
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

//Calculator tool: with 4 operations +,-,/,*;
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

//Calculator tool:: text stats
server.registerTool(
  "text_stats",
  {
    title: "Text Statistics",
    description: "Returns basic statistics about a piece of text.",

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

    const lines = text === "" ? 0 : text.split(/\r?\n/).length;

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

const transport = new StdioServerTransport();
server.connect(transport);

