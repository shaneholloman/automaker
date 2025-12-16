/**
 * POST /diffs endpoint - Get diffs for a worktree
 */

import type { Request, Response } from "express";
import { exec } from "child_process";
import { promisify } from "util";
import path from "path";
import fs from "fs/promises";
import { getErrorMessage, logError } from "../common.js";
import { appendUntrackedFileDiffs, generateDiffsForNonGitDirectory } from "../../common.js";

const execAsync = promisify(exec);

/**
 * Check if a path is a git repository
 */
async function isGitRepo(repoPath: string): Promise<boolean> {
  try {
    await execAsync("git rev-parse --is-inside-work-tree", { cwd: repoPath });
    return true;
  } catch {
    return false;
  }
}

export function createDiffsHandler() {
  return async (req: Request, res: Response): Promise<void> => {
    try {
      const { projectPath, featureId } = req.body as {
        projectPath: string;
        featureId: string;
      };

      if (!projectPath || !featureId) {
        res
          .status(400)
          .json({
            success: false,
            error: "projectPath and featureId required",
          });
        return;
      }

      const worktreePath = path.join(
        projectPath,
        ".automaker",
        "worktrees",
        featureId
      );

      try {
        await fs.access(worktreePath);

        // Check if worktree is a git repository
        const isRepo = await isGitRepo(worktreePath);

        if (!isRepo) {
          // Not a git repo - list all files and treat them as new
          const result = await generateDiffsForNonGitDirectory(worktreePath);
          res.json({
            success: true,
            diff: result.diff,
            files: result.files,
            hasChanges: result.files.length > 0,
          });
          return;
        }

        const { stdout: diff } = await execAsync("git diff HEAD", {
          cwd: worktreePath,
          maxBuffer: 10 * 1024 * 1024,
        });
        const { stdout: status } = await execAsync("git status --porcelain", {
          cwd: worktreePath,
        });

        const files = status
          .split("\n")
          .filter(Boolean)
          .map((line) => {
            const statusChar = line[0];
            const filePath = line.slice(3);
            const statusMap: Record<string, string> = {
              M: "Modified",
              A: "Added",
              D: "Deleted",
              R: "Renamed",
              C: "Copied",
              U: "Updated",
              "?": "Untracked",
            };
            return {
              status: statusChar,
              path: filePath,
              statusText: statusMap[statusChar] || "Unknown",
            };
          });

        // Generate synthetic diffs for untracked (new) files
        // git diff HEAD doesn't include untracked files, so we need to generate them
        const combinedDiff = await appendUntrackedFileDiffs(worktreePath, diff, files);

        res.json({
          success: true,
          diff: combinedDiff,
          files,
          hasChanges: files.length > 0,
        });
      } catch (innerError) {
        // Worktree doesn't exist - fallback to main project path
        logError(innerError, "Worktree access failed, falling back to main project");

        try {
          // Check if main project is a git repo
          const isRepo = await isGitRepo(projectPath);

          if (!isRepo) {
            // Not a git repo - list all files and treat them as new
            const result = await generateDiffsForNonGitDirectory(projectPath);
            res.json({
              success: true,
              diff: result.diff,
              files: result.files,
              hasChanges: result.files.length > 0,
            });
            return;
          }

          // Try main project path for git diffs
          const { stdout: diff } = await execAsync("git diff HEAD", {
            cwd: projectPath,
            maxBuffer: 10 * 1024 * 1024,
          });
          const { stdout: status } = await execAsync("git status --porcelain", {
            cwd: projectPath,
          });

          const files = status
            .split("\n")
            .filter(Boolean)
            .map((line) => {
              const statusChar = line[0];
              const filePath = line.slice(3);
              const statusMap: Record<string, string> = {
                M: "Modified",
                A: "Added",
                D: "Deleted",
                R: "Renamed",
                C: "Copied",
                U: "Updated",
                "?": "Untracked",
              };
              return {
                status: statusChar,
                path: filePath,
                statusText: statusMap[statusChar] || "Unknown",
              };
            });

          const combinedDiff = await appendUntrackedFileDiffs(projectPath, diff, files);

          res.json({
            success: true,
            diff: combinedDiff,
            files,
            hasChanges: files.length > 0,
          });
        } catch (fallbackError) {
          logError(fallbackError, "Fallback to main project also failed");
          res.json({ success: true, diff: "", files: [], hasChanges: false });
        }
      }
    } catch (error) {
      logError(error, "Get worktree diffs failed");
      res.status(500).json({ success: false, error: getErrorMessage(error) });
    }
  };
}
