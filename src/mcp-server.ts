#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { reviewRepository } from "./core.js";

const server = new McpServer({ name: "repository-inspector", version: "2.0.0" });

const nonBlankString = z.string().refine((value) => value.trim().length > 0, {
  message: "Must be a non-empty string.",
});

server.tool(
  "review_repository",
  "Inspects a Git repository and returns a review report.",
  {
    repo_path: nonBlankString.describe("Repository path to inspect."),
    baseRef: nonBlankString.optional(),
    validationCommands: z.array(nonBlankString).optional(),
  },
  async (input) => {
    const result = await reviewRepository({
      repositoryPath: input.repo_path,
      baseRef: input.baseRef,
      validationCommands: input.validationCommands,
    });
    return {
      content: [{ type: "text", text: result.report }],
    };
  },
);

await server.connect(new StdioServerTransport());
