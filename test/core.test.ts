import { expect, it } from "vitest";
import { reviewRepository } from "../src/core.js";
import type { ReviewRequest } from "../src/types.js";

it("rejects invalid shared inputs before repository inspection", async () => {
  const valid: ReviewRequest = { repositoryPath: "not-a-repository", baseRef: "HEAD" };
  const cases: [Partial<ReviewRequest>, RegExp][] = [
    [{ repositoryPath: undefined }, /repositoryPath/],
    [{ repositoryPath: "" }, /repositoryPath/],
    [{ repositoryPath: " " }, /repositoryPath/],
    [{ baseRef: " " }, /baseRef/],
    [{ validationCommands: [" "] }, /validationCommands/],
    [{ format: "json" } as unknown as Partial<ReviewRequest>, /markdown/],
    [{ validationCommands: "node -p 42" } as unknown as Partial<ReviewRequest>, /validationCommands/],
  ];

  for (const [input, message] of cases) {
    await expect(reviewRepository({ ...valid, ...input })).rejects.toThrow(message);
  }
});
