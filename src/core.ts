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

  if (request.format !== undefined && request.format !== "markdown") {
    throw new Error("Only markdown format is supported.");
  }
  if (
    request.baseRef !== undefined &&
    (typeof request.baseRef !== "string" || request.baseRef.trim().length === 0)
  ) {
    throw new Error("baseRef must be a non-empty string when supplied.");
  }
  if (
    request.validationCommands !== undefined &&
    (!Array.isArray(request.validationCommands) ||
      request.validationCommands.some(
        (command) => typeof command !== "string" || command.trim().length === 0,
      ))
  ) {
    throw new Error("validationCommands must be an array of non-empty strings.");
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
