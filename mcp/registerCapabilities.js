const { ResourceTemplate } = require("@modelcontextprotocol/sdk/server/mcp.js");
const { z } = require("zod");
const fs = require("fs");
const path = require("path");

const githubToken = process.env.GITHUB_TOKEN;

// Shared GitHub fetch helper — keeps the 4 GitHub tools below from
// repeating the same fetch/header/status-code handling.
async function githubRequest(apiPath) {
  const response = await fetch(`https://api.github.com${apiPath}`, {
    method: "GET",
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${githubToken}`,
      "X-GitHub-Api-Version": "2026-03-10",
    },
  });

  if (!response.ok) {
    const error = new Error(`GitHub API request failed with status ${response.status}.`);
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