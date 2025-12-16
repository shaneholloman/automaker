/**
 * Common utilities shared across all route modules
 */

import { createLogger } from "../lib/logger.js";
import fs from "fs/promises";
import path from "path";

type Logger = ReturnType<typeof createLogger>;

// Max file size for generating synthetic diffs (1MB)
const MAX_SYNTHETIC_DIFF_SIZE = 1024 * 1024;

// Binary file extensions to skip
const BINARY_EXTENSIONS = new Set([
  ".png", ".jpg", ".jpeg", ".gif", ".bmp", ".ico", ".webp", ".svg",
  ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx",
  ".zip", ".tar", ".gz", ".rar", ".7z",
  ".exe", ".dll", ".so", ".dylib",
  ".mp3", ".mp4", ".wav", ".avi", ".mov", ".mkv",
  ".ttf", ".otf", ".woff", ".woff2", ".eot",
  ".db", ".sqlite", ".sqlite3",
  ".pyc", ".pyo", ".class", ".o", ".obj",
]);

/**
 * Check if a file is likely binary based on extension
 */
function isBinaryFile(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  return BINARY_EXTENSIONS.has(ext);
}

/**
 * Generate a synthetic unified diff for an untracked (new) file
 * This is needed because `git diff HEAD` doesn't include untracked files
 */
export async function generateSyntheticDiffForNewFile(
  basePath: string,
  relativePath: string
): Promise<string> {
  const fullPath = path.join(basePath, relativePath);

  try {
    // Check if it's a binary file
    if (isBinaryFile(relativePath)) {
      return `diff --git a/${relativePath} b/${relativePath}
new file mode 100644
index 0000000..0000000
Binary file ${relativePath} added
`;
    }

    // Get file stats to check size
    const stats = await fs.stat(fullPath);
    if (stats.size > MAX_SYNTHETIC_DIFF_SIZE) {
      const sizeKB = Math.round(stats.size / 1024);
      return `diff --git a/${relativePath} b/${relativePath}
new file mode 100644
index 0000000..0000000
--- /dev/null
+++ b/${relativePath}
@@ -0,0 +1 @@
+[File too large to display: ${sizeKB}KB]
`;
    }

    // Read file content
    const content = await fs.readFile(fullPath, "utf-8");
    const lines = content.split("\n");

    // Remove trailing empty line if the file ends with newline
    if (lines.length > 0 && lines[lines.length - 1] === "") {
      lines.pop();
    }

    // Generate diff format
    const lineCount = lines.length;
    const addedLines = lines.map(line => `+${line}`).join("\n");

    return `diff --git a/${relativePath} b/${relativePath}
new file mode 100644
index 0000000..0000000
--- /dev/null
+++ b/${relativePath}
@@ -0,0 +1,${lineCount} @@
${addedLines}
`;
  } catch (error) {
    // If we can't read the file, return a placeholder diff
    return `diff --git a/${relativePath} b/${relativePath}
new file mode 100644
index 0000000..0000000
--- /dev/null
+++ b/${relativePath}
@@ -0,0 +1 @@
+[Unable to read file content]
`;
  }
}

/**
 * Generate synthetic diffs for all untracked files and combine with existing diff
 */
export async function appendUntrackedFileDiffs(
  basePath: string,
  existingDiff: string,
  files: Array<{ status: string; path: string }>
): Promise<string> {
  // Find untracked files (status "?")
  const untrackedFiles = files.filter(f => f.status === "?");

  if (untrackedFiles.length === 0) {
    return existingDiff;
  }

  // Generate synthetic diffs for each untracked file
  const syntheticDiffs = await Promise.all(
    untrackedFiles.map(f => generateSyntheticDiffForNewFile(basePath, f.path))
  );

  // Combine existing diff with synthetic diffs
  const combinedDiff = existingDiff + syntheticDiffs.join("");

  return combinedDiff;
}

/**
 * List all files in a directory recursively (for non-git repositories)
 * Excludes hidden files/folders and common build artifacts
 */
export async function listAllFilesInDirectory(
  basePath: string,
  relativePath: string = ""
): Promise<string[]> {
  const files: string[] = [];
  const fullPath = path.join(basePath, relativePath);

  // Directories to skip
  const skipDirs = new Set([
    "node_modules", ".git", ".automaker", "dist", "build",
    ".next", ".nuxt", "__pycache__", ".cache", "coverage"
  ]);

  try {
    const entries = await fs.readdir(fullPath, { withFileTypes: true });

    for (const entry of entries) {
      // Skip hidden files/folders (except we want to allow some)
      if (entry.name.startsWith(".") && entry.name !== ".env") {
        continue;
      }

      const entryRelPath = relativePath ? `${relativePath}/${entry.name}` : entry.name;

      if (entry.isDirectory()) {
        if (!skipDirs.has(entry.name)) {
          const subFiles = await listAllFilesInDirectory(basePath, entryRelPath);
          files.push(...subFiles);
        }
      } else if (entry.isFile()) {
        files.push(entryRelPath);
      }
    }
  } catch {
    // Ignore errors (permission denied, etc.)
  }

  return files;
}

/**
 * Generate diffs for all files in a non-git directory
 * Treats all files as "new" files
 */
export async function generateDiffsForNonGitDirectory(
  basePath: string
): Promise<{ diff: string; files: Array<{ status: string; path: string; statusText: string }> }> {
  const allFiles = await listAllFilesInDirectory(basePath);

  const files = allFiles.map(filePath => ({
    status: "?",
    path: filePath,
    statusText: "New",
  }));

  // Generate synthetic diffs for all files
  const syntheticDiffs = await Promise.all(
    files.map(f => generateSyntheticDiffForNewFile(basePath, f.path))
  );

  return {
    diff: syntheticDiffs.join(""),
    files,
  };
}

/**
 * Get error message from error object
 */
export function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error";
}

/**
 * Create a logError function for a specific logger
 * This ensures consistent error logging format across all routes
 */
export function createLogError(logger: Logger) {
  return (error: unknown, context: string): void => {
    logger.error(`❌ ${context}:`, error);
  };
}
