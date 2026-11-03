import { changedFiles } from "./git.js";
import { markdownReport } from "./report.js";
import type { ReviewRequest, ReviewResult } from "./types.js";
import { runValidations } from "./validation.js";

export async function reviewRepository(request: ReviewRequest): Promise<ReviewResult> {
  if (
    typeof request.repositoryPath !== "string" ||
    request.repositoryPath.trim().length === 0
  ) {
    throw new Error("repositoryPath must be a non-empty string.");
  }

  const files = changedFiles(request.repositoryPath, request.baseRef);
  const validations = await runValidations(
    request.validationCommands ?? [],
    request.repositoryPath,
  );
  return {
    report: markdownReport({
      repositoryPath: request.repositoryPath,
      changedFiles: files,
      validationResults: validations,
    }),
    validationResults: validations,
  };
}
