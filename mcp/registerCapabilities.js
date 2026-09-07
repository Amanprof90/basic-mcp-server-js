const { ResourceTemplate } = require("@modelcontextprotocol/sdk/server/mcp.js");
const { z } = require("zod");
const fs = require("fs");
const path = require("path");

const githubToken = process.env.GITHUB_TOKEN;

// Shared GitHub fetch helper — keeps the 4 GitHub tools below from
// repeating the same fetch/header/status-code handling.
async function githubRequest(apiPath, options = {}) {
  const response = await fetch(`https://api.github.com${apiPath}`, {
    method: options.method || "GET",
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${githubToken}`,
      "X-GitHub-Api-Version": "2026-03-10",
      "Content-Type": "application/json",
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (!response.ok) {
  const errorBody = await response.text();

  console.error("===== GITHUB ERROR =====");
  console.error("API:", apiPath);
  console.error("Method:", options.method || "GET");
  console.error("Status:", response.status);
  console.error("Body:", errorBody);
  console.error(
    "Permissions:",
    response.headers.get("x-accepted-github-permissions")
  );
  console.error("========================");

  const error = new Error(
    `GitHub API request failed with status ${response.status}.`
  );

  error.status = response.status;
  throw error;
}

  return response.json();
}

function mapGithubError(error, notFoundMessage) {
  if (error.status === 404) return notFoundMessage;
  if (error.status === 401) return "GitHub authentication failed.";
  if (error.status === 403) return "GitHub denied the request. Check token permissions or rate limits.";
  if (error.status) return `GitHub API request failed with status ${error.status}.`;
  return "Unable to connect to GitHub.";
}

const notionToken = process.env.NOTION_TOKEN;

async function notionRequest(apiPath, options = {}) {
  const response = await fetch(`https://api.notion.com${apiPath}`, {
    method: options.method || "GET",
    headers: {
      Authorization: `Bearer ${notionToken}`,
      "Notion-Version": "2026-03-11",
      "Content-Type": "application/json",
    },
    body: options.body
      ? JSON.stringify(options.body)
      : undefined,
  });

  if (!response.ok) {
    const errorBody = await response.text();

    const error = new Error(
      `Notion API request failed with status ${response.status}: ${errorBody}`
    );

    error.status = response.status;
    throw error;
  }

  return response.json();
}


function registerCapabilities(server) {
  // =========================================================
  // TOOLS
  // =========================================================

  // get_time
  server.registerTool(
    "get_time",
    {
      title: "Get Current Time",
      description: "Returns the current local date and time.",
      inputSchema: {},
    },
    async () => {
      return {
        content: [{ type: "text", text: new Date().toString() }],
      };
    }
  );

  // calculator
  server.registerTool(
    "calculator",
    {
      title: "Basic Calculator",
      description: "Performs basic arithmetic operations on two numbers.",
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
              content: [{ type: "text", text: "Cannot divide by zero." }],
              isError: true,
            };
          }
          result = a / b;
          break;

        default:
          return {
            content: [{ type: "text", text: "Unsupported operation." }],
            isError: true,
          };
      }

      return {
        content: [{ type: "text", text: String(result) }],
      };
    }
  );

  // text_stats
  server.registerTool(
    "text_stats",
    {
      title: "Text Statistics",
      description: "Returns basic statistics about a piece of text.",
      inputSchema: {
        text: z.string().describe("The text to analyze."),
      },
    },
    async ({ text }) => {
      const characters = text.length;
      const words = text.trim().split(/\s+/).filter(Boolean).length;
      const lines = text === "" ? 0 : text.split(/\r?\n/).length;

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ characters, words, lines }),
          },
        ],
      };
    }
  );


  //----------------------------------------------
  // NOTION INTEGRATION CAPABILITIES
  //----------------------------------------------
    //SERCH TOOL
  server.registerTool(
  "search_notion",
  {
    title: "Search Notion",
    description: "Searches Notion pages shared with this MCP connection.",
    inputSchema: {
      query: z.string().min(1).describe("Text to search for in Notion."),
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
  },
  async ({ query }) => {
    try {
      const result = await notionRequest("/v1/search", {
        method: "POST",
        body: {
          query,
          filter: {
            property: "object",
            value: "page",
          },
        },
      });

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              result.results.map((page) => ({
                id: page.id,
                url: page.url,
                title:
                  page.properties?.title?.title?.[0]?.plain_text ||
                  page.properties?.Name?.title?.[0]?.plain_text ||
                  "Untitled",
              })),
              null,
              2
            ),
          },
        ],
      };
    } catch (error) {
      console.error("Notion search error:", error);

      return {
        isError: true,
        content: [
          {
            type: "text",
            text: `Unable to search Notion: ${error.message}`,
          },
        ],
      };
    }
  }
);

//gET TOOL
server.registerTool(
  "get_notion_page",
  {
    title: "Get Notion Page",
    description: "Retrieves a Notion page by its ID.",
    inputSchema: {
      pageId: z.string().min(1).describe("Notion page ID."),
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
  },
  async ({ pageId }) => {
    try {
      const page = await notionRequest(
        `/v1/pages/${encodeURIComponent(pageId)}`
      );

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(page, null, 2),
          },
        ],
      };
    } catch (error) {
      console.error("Notion get page error:", error);

      return {
        isError: true,
        content: [
          {
            type: "text",
            text: `Unable to retrieve Notion page: ${error.message}`,
          },
        ],
      };
    }
  }
);
//APPEND TOOL

server.registerTool(
  "append_notion_content",
  {
    title: "Append Notion Content",
    description: "Appends a paragraph to a Notion page.",
    inputSchema: {
      pageId: z.string().min(1).describe("Notion page ID."),
      text: z.string().min(1).describe("Text to append."),
    },
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true,
    },
  },
  async ({ pageId, text }) => {
    try {
      const result = await notionRequest(
        `/v1/blocks/${encodeURIComponent(pageId)}/children`,
        {
          method: "PATCH",
          body: {
            children: [
              {
                object: "block",
                type: "paragraph",
                paragraph: {
                  rich_text: [
                    {
                      type: "text",
                      text: {
                        content: text,
                      },
                    },
                  ],
                },
              },
            ],
          },
        }
      );

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                success: true,
                appendedText: text,
                blocksCreated: result.results?.length ?? 0,
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error) {
      console.error("Notion append error:", error);

      return {
        isError: true,
        content: [
          {
            type: "text",
            text: `Unable to append Notion content: ${error.message}`,
          },
        ],
      };
    }
  }
);

//


  // update_server_config
  server.registerTool(
    "update_server_config",
    {
      description: "Safely update supported server configuration values.",
      inputSchema: {
        key: z.enum(["calculatorEnabled", "textStatsEnabled", "serverName"]),
        value: z.union([z.boolean(), z.string()]),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ key, value }) => {
      const configPath = path.join(__dirname, "data", "server-config.json");
      const config = JSON.parse(fs.readFileSync(configPath, "utf8"));

      if (key === "calculatorEnabled" || key === "textStatsEnabled") {
        if (typeof value !== "boolean") {
          return {
            isError: true,
            content: [{ type: "text", text: `${key} must be a boolean.` }],
          };
        }
      }

      if (key === "serverName" && typeof value !== "string") {
        return {
          isError: true,
          content: [{ type: "text", text: "serverName must be a string." }],
        };
      }

      config[key] = value;
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

      return {
        content: [
          {
            type: "text",
            text:
              `Write completed.\n` +
              `__dirname: ${__dirname}\n` +
              `configPath: ${configPath}\n` +
              `exists: ${fs.existsSync(configPath)}\n` +
              `cwd: ${process.cwd()}`,
          },
        ],
      };
    }
  );

    // write_workflow_file
  server.registerTool(
    "write_workflow_file",
    {
      title: "Write Workflow File",
      description:
        "Writes a file only inside the MCP workflow sandbox directory.",
      inputSchema: {
        fileName: z
          .string()
          .min(1)
          .describe("File path relative to the workflow sandbox."),
        content: z
          .string()
          .describe("Content to write into the file."),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },

    async ({ fileName, content }) => {
      try {
        const workflowDir = process.env.MCP_WORKFLOW_DIR
          ? path.resolve(process.env.MCP_WORKFLOW_DIR)
          : path.resolve(__dirname, "data", "workflow");

        const requestedPath = path.resolve(
          workflowDir,
          fileName
        );

        // Make sure the resolved path stays inside the sandbox.
        const relativePath = path.relative(
          workflowDir,
          requestedPath
        );

        if (
          relativePath.startsWith("..") ||
          path.isAbsolute(relativePath)
        ) {
          return {
            isError: true,
            content: [
              {
                type: "text",
                text: "Write denied: path is outside the workflow sandbox.",
              },
            ],
          };
        }

        fs.mkdirSync(workflowDir, { recursive: true });

        fs.writeFileSync(
          requestedPath,
          content,
          "utf8"
        );

        return {
          content: [
            {
              type: "text",
              text:
                `Write completed successfully.\n` +
                `Sandbox: ${workflowDir}\n` +
                `File: ${requestedPath}\n` +
                `Exists: ${fs.existsSync(requestedPath)}`,
            },
          ],
        };
      } catch (error) {
        console.error("Workflow file write error:", error);

        return {
          isError: true,
          content: [
            {
              type: "text",
              text: "Unable to write workflow file.",
            },
          ],
        };
      }
    }
  );

  // get_repository
  server.registerTool(
    "get_repository",
    {
      title: "Get GitHub Repository",
      description: "Retrieves repository information from GitHub.",
      inputSchema: {
        owner: z.string().min(1).describe("GitHub repository owner."),
        repo: z.string().min(1).describe("GitHub repository name."),
      },
    },
    async ({ owner, repo }) => {
      try {
        const data = await githubRequest(
          `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`
        );

        const repository = {
          name: data.name,
          fullName: data.full_name,
          owner: data.owner.login,
          description: data.description,
          visibility: data.visibility,
          language: data.language,
          stars: data.stargazers_count,
          forks: data.forks_count,
          openIssues: data.open_issues_count,
          defaultBranch: data.default_branch,
          url: data.html_url,
        };

        return {
          content: [{ type: "text", text: JSON.stringify(repository, null, 2) }],
        };
      } catch (error) {
        console.error("GitHub API error:", error);
        return {
          content: [
            {
              type: "text",
              text: mapGithubError(
                error,
                `Repository '${owner}/${repo}' was not found or is not accessible.`
              ),
            },
          ],
          isError: true,
        };
      }
    }
  );

  // get_file
  server.registerTool(
    "get_file",
    {
      title: "Get GitHub File",
      description: "Retrieves the contents of a file from a GitHub repository.",
      inputSchema: {
        owner: z.string().min(1).describe("GitHub repository owner."),
        repo: z.string().min(1).describe("GitHub repository name."),
        path: z.string().min(1).describe("Path of the file inside the repository."),
      },
    },
    async ({ owner, repo, path: filePath }) => {
      try {
        const encodedPath = filePath.split("/").map(encodeURIComponent).join("/");

        const data = await githubRequest(
          `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${encodedPath}`
        );

        if (data.type !== "file") {
          return {
            content: [{ type: "text", text: `'${filePath}' is not a file.` }],
            isError: true,
          };
        }

        const fileContent = Buffer.from(data.content, "base64").toString("utf-8");

        return {
          content: [{ type: "text", text: fileContent }],
        };
      } catch (error) {
        console.error("GitHub file API error:", error);
        return {
          content: [
            {
              type: "text",
              text: mapGithubError(
                error,
                `File '${filePath}' was not found in '${owner}/${repo}'.`
              ),
            },
          ],
          isError: true,
        };
      }
    }
  );

  // get_issue
  server.registerTool(
    "get_issue",
    {
      description: "Get a GitHub issue from a repository.",
      inputSchema: {
        owner: z.string().min(1).describe("GitHub repository owner."),
        repo: z.string().min(1).describe("GitHub repository name."),
        issueNumber: z.number().int().positive().describe("GitHub issue number."),
      },
    },
    async ({ owner, repo, issueNumber }) => {
      try {
        const issue = await githubRequest(
          `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues/${issueNumber}`
        );

        const result = {
          number: issue.number,
          title: issue.title,
          state: issue.state,
          author: issue.user?.login ?? null,
          body: issue.body,
          labels: issue.labels?.map((label) => label.name) ?? [],
          comments: issue.comments,
          createdAt: issue.created_at,
          updatedAt: issue.updated_at,
          url: issue.html_url,
          isPullRequest: Boolean(issue.pull_request),
        };

        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        const message = mapGithubError(
          error,
          `Issue #${issueNumber} was not found in ${owner}/${repo}.`
        );
        return {
          content: [{ type: "text", text: `Unable to get GitHub issue: ${message}` }],
          isError: true,
        };
      }
    }
  );

  // update_issue
server.registerTool(
  "update_issue",
  {
    title: "Update GitHub Issue",
    description: "Updates the state and/or labels of a GitHub issue.",

    inputSchema: {
      owner: z
        .string()
        .min(1)
        .describe("GitHub repository owner."),

      repo: z
        .string()
        .min(1)
        .describe("GitHub repository name."),

      issueNumber: z
        .number()
        .int()
        .positive()
        .describe("GitHub issue number."),

      state: z
        .enum(["open", "closed"])
        .optional()
        .describe("New issue state."),

      labels: z
        .array(z.string().min(1))
        .optional()
        .describe(
          "Complete replacement list of issue labels."
        ),
    },

    annotations: {
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: true,
      openWorldHint: true,
    },
  },

  async ({ owner, repo, issueNumber, state, labels }) => {
    try {
      // -----------------------------------------
      // 1. Validate that something is being changed
      // -----------------------------------------

      if (state === undefined && labels === undefined) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text:
                "At least one update field is required: state or labels.",
            },
          ],
        };
      }

      // -----------------------------------------
      // 2. Build GitHub PATCH request body
      // -----------------------------------------

      const body = {};

      if (state !== undefined) {
        body.state = state;
      }

      if (labels !== undefined) {
        body.labels = labels;
      }

      // -----------------------------------------
      // 3. Update GitHub issue
      // -----------------------------------------

      const updatedIssue = await githubRequest(
        `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(
          repo
        )}/issues/${issueNumber}`,
        {
          method: "PATCH",
          body,
        }
      );

      // -----------------------------------------
      // 4. Return only useful information
      // -----------------------------------------

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                number: updatedIssue.number,
                title: updatedIssue.title,
                state: updatedIssue.state,
                labels:
                  updatedIssue.labels?.map(
                    (label) => label.name
                  ) ?? [],
                updatedAt: updatedIssue.updated_at,
                url: updatedIssue.html_url,
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error) {
      console.error(
        "GitHub issue update error:",
        error
      );

      const message = mapGithubError(
        error,
        `Issue #${issueNumber} was not found in ${owner}/${repo}.`
      );

      return {
        isError: true,
        content: [
          {
            type: "text",
            text: `Unable to update GitHub issue: ${message}`,
          },
        ],
      };
    }
  }
);


  // get_pull_request
  server.registerTool(
    "get_pull_request",
    {
      description: "Get a GitHub pull request from a repository.",
      inputSchema: {
        owner: z.string().min(1).describe("GitHub repository owner."),
        repo: z.string().min(1).describe("GitHub repository name."),
        pullNumber: z.number().int().positive().describe("GitHub pull request number."),
      },
    },
    async ({ owner, repo, pullNumber }) => {
      try {
        const pullRequest = await githubRequest(
          `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pulls/${pullNumber}`
        );

        const result = {
          number: pullRequest.number,
          title: pullRequest.title,
          state: pullRequest.state,
          author: pullRequest.user?.login ?? null,
          body: pullRequest.body,
          sourceBranch: pullRequest.head?.ref ?? null,
          targetBranch: pullRequest.base?.ref ?? null,
          merged: pullRequest.merged,
          mergeable: pullRequest.mergeable,
          changedFiles: pullRequest.changed_files,
          additions: pullRequest.additions,
          deletions: pullRequest.deletions,
          commits: pullRequest.commits,
          comments: pullRequest.comments,
          reviewComments: pullRequest.review_comments,
          createdAt: pullRequest.created_at,
          updatedAt: pullRequest.updated_at,
          url: pullRequest.html_url,
        };

        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        const message = mapGithubError(
          error,
          `Pull request #${pullNumber} was not found in ${owner}/${repo}.`
        );
        return {
          content: [{ type: "text", text: `Unable to get GitHub pull request: ${message}` }],
          isError: true,
        };
      }
    }
  );

  // =========================================================
  // RESOURCES
  // =========================================================

  // company://about
  server.registerResource(
    "company-about",
    "company://about",
    {
      title: "LogicSyner Company Information",
      description: "Basic information about LogicSyner.",
      mimeType: "text/plain",
    },
    async (uri) => {
      console.error("RESOURCES CALLBACK EXECUTED", uri.href);
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "text/plain",
            text: "Hello from LogicSyner MCP resources.",
          },
        ],
      };
    }
  );

  // company://products/{product}
  server.registerResource(
    "company-product",
    new ResourceTemplate("company://products/{product}", { list: undefined }),
    {
      title: "LogicSyner Product Information",
      description: "Information about a LogicSyner product.",
      mimeType: "text/plain",
    },
    async (uri, variables) => {
      const product = variables.product;
      console.error("PRODUCT RESOURCE REQUESTED:", product);

      const products = {
        erp: {
          name: "ERP Solution",
          description: "Enterprise resource planning software for organizations.",
        },
        crm: {
          name: "CRM Solution",
          description: "Customer relationship management software.",
        },
        "ai-platform": {
          name: "AI Platform",
          description: "AI-powered software and automation solutions.",
        },
      };

      const data = products[product];

      if (!data) {
        throw new Error(`Product '${product}' not found.`);
      }

      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "text/plain",
            text: JSON.stringify(data, null, 2),
          },
        ],
      };
    }
  );

  // =========================================================
  // PROMPTS
  // =========================================================

  // review_pr
    server.registerPrompt(
        "review_pr",
        {
            title: "Review Pull Request",

            description:
                "Create a structured code-review workflow for a GitHub pull request.",

            argsSchema: {
                owner: z.string().min(1),
                repo: z.string().min(1),
                pullNumber: z.string().min(1),
            },
        },

        ({ owner, repo, pullNumber }) => {

            // MCP prompt arguments arrive as strings.
            // Convert pullNumber to a number for internal validation/use.
            const parsedPullNumber = Number(pullNumber);

            if (
                !Number.isInteger(parsedPullNumber) ||
                parsedPullNumber <= 0
            ) {
                throw new Error(
                    "pullNumber must be a positive integer."
                );
            }

            return {
                messages: [
                    {
                        role: "user",

                        content: {
                            type: "text",

                            text: `
Review GitHub pull request:

Repository: ${owner}/${repo}

Pull Request: #${parsedPullNumber}

Analyze the pull request for:

1. Correctness
2. Security
3. Performance
4. Error handling
5. Testing
6. Maintainability

Identify important problems first.

For each problem:

- Explain what is wrong.
- Explain why it matters.
- Suggest a concrete improvement.

Use the available GitHub tools to inspect the pull request
and relevant files before making conclusions.
                        `.trim(),
                        },
                    },
                ],
            };
        }
    );
}

module.exports = {
  registerCapabilities,
};