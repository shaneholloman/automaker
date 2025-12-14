/**
 * Claude Provider - Executes queries using Claude Agent SDK
 *
 * Wraps the @anthropic-ai/claude-agent-sdk for seamless integration
 * with the provider architecture.
 */

import { query, type Options } from "@anthropic-ai/claude-agent-sdk";
import { BaseProvider } from "./base-provider.js";
import {
  convertHistoryToMessages,
  normalizeContentBlocks,
} from "../lib/conversation-utils.js";
import type {
  ExecuteOptions,
  ProviderMessage,
  InstallationStatus,
  ModelDefinition,
} from "./types.js";

export class ClaudeProvider extends BaseProvider {
  getName(): string {
    return "claude";
  }

  /**
   * Execute a query using Claude Agent SDK
   */
  async *executeQuery(
    options: ExecuteOptions
  ): AsyncGenerator<ProviderMessage> {
    const {
      prompt,
      model,
      cwd,
      systemPrompt,
      maxTurns = 20,
      allowedTools,
      abortController,
      conversationHistory,
    } = options;

    // Build Claude SDK options
    const defaultTools = [
      "Read",
      "Write",
      "Edit",
      "Glob",
      "Grep",
      "Bash",
      "WebSearch",
      "WebFetch",
    ];
    const toolsToUse = allowedTools || defaultTools;

    const sdkOptions: Options = {
      model,
      systemPrompt,
      maxTurns,
      cwd,
      allowedTools: toolsToUse,
      permissionMode: "acceptEdits",
      sandbox: {
        enabled: true,
        autoAllowBashIfSandboxed: true,
      },
      abortController,
    };

    // Build prompt payload with conversation history
    let promptPayload: string | AsyncGenerator<any, void, unknown> | Array<any>;

    if (conversationHistory && conversationHistory.length > 0) {
      // Multi-turn conversation with history
      // Convert history to SDK message format
      // Note: When using async generator, SDK only accepts SDKUserMessage (type: 'user')
      // So we filter to only include user messages to avoid SDK errors
      const historyMessages = convertHistoryToMessages(conversationHistory);
      const hasAssistantMessages = historyMessages.some(
        (msg) => msg.type === "assistant"
      );

      if (hasAssistantMessages) {
        // If we have assistant messages, use async generator but filter to only user messages
        // This maintains conversation flow while respecting SDK type constraints
        promptPayload = (async function* () {
          // Filter to only user messages - SDK async generator only accepts SDKUserMessage
          const userHistoryMessages = historyMessages.filter(
            (msg) => msg.type === "user"
          );
          for (const msg of userHistoryMessages) {
            yield msg;
          }

          // Yield current prompt
          const normalizedPrompt = normalizeContentBlocks(prompt);
          const currentPrompt = {
            type: "user" as const,
            session_id: "",
            message: {
              role: "user" as const,
              content: normalizedPrompt,
            },
            parent_tool_use_id: null,
          };
          yield currentPrompt;
        })();
      } else {
        // Only user messages in history - can use async generator normally
        promptPayload = (async function* () {
          for (const msg of historyMessages) {
            yield msg;
          }

          // Yield current prompt
          const normalizedPrompt = normalizeContentBlocks(prompt);
          const currentPrompt = {
            type: "user" as const,
            session_id: "",
            message: {
              role: "user" as const,
              content: normalizedPrompt,
            },
            parent_tool_use_id: null,
          };
          yield currentPrompt;
        })();
      }
    } else if (Array.isArray(prompt)) {
      // Multi-part prompt (with images) - no history
      promptPayload = (async function* () {
        const multiPartPrompt = {
          type: "user" as const,
          session_id: "",
          message: {
            role: "user" as const,
            content: prompt,
          },
          parent_tool_use_id: null,
        };
        yield multiPartPrompt;
      })();
    } else {
      // Simple text prompt - no history
      promptPayload = prompt;
    }

    // Execute via Claude Agent SDK
    try {
      const stream = query({ prompt: promptPayload, options: sdkOptions });

      // Stream messages directly - they're already in the correct format
      for await (const msg of stream) {
        yield msg as ProviderMessage;
      }
    } catch (error) {
      console.error(
        "[ClaudeProvider] executeQuery() error during execution:",
        error
      );
      throw error;
    }
  }

  /**
   * Detect Claude SDK installation (always available via npm)
   */
  async detectInstallation(): Promise<InstallationStatus> {
    // Claude SDK is always available since it's a dependency
    const hasAnthropicKey = !!process.env.ANTHROPIC_API_KEY;
    const hasOAuthToken = !!process.env.CLAUDE_CODE_OAUTH_TOKEN;
    const hasApiKey = hasAnthropicKey || hasOAuthToken;

    const status: InstallationStatus = {
      installed: true,
      method: "sdk",
      hasApiKey,
      authenticated: hasApiKey,
    };

    return status;
  }

  /**
   * Get available Claude models
   */
  getAvailableModels(): ModelDefinition[] {
    const models = [
      {
        id: "claude-opus-4-5-20251101",
        name: "Claude Opus 4.5",
        modelString: "claude-opus-4-5-20251101",
        provider: "anthropic",
        description: "Most capable Claude model",
        contextWindow: 200000,
        maxOutputTokens: 16000,
        supportsVision: true,
        supportsTools: true,
        tier: "premium" as const,
        default: true,
      },
      {
        id: "claude-sonnet-4-20250514",
        name: "Claude Sonnet 4",
        modelString: "claude-sonnet-4-20250514",
        provider: "anthropic",
        description: "Balanced performance and cost",
        contextWindow: 200000,
        maxOutputTokens: 16000,
        supportsVision: true,
        supportsTools: true,
        tier: "standard" as const,
      },
      {
        id: "claude-3-5-sonnet-20241022",
        name: "Claude 3.5 Sonnet",
        modelString: "claude-3-5-sonnet-20241022",
        provider: "anthropic",
        description: "Fast and capable",
        contextWindow: 200000,
        maxOutputTokens: 8000,
        supportsVision: true,
        supportsTools: true,
        tier: "standard" as const,
      },
      {
        id: "claude-3-5-haiku-20241022",
        name: "Claude 3.5 Haiku",
        modelString: "claude-3-5-haiku-20241022",
        provider: "anthropic",
        description: "Fastest Claude model",
        contextWindow: 200000,
        maxOutputTokens: 8000,
        supportsVision: true,
        supportsTools: true,
        tier: "basic" as const,
      },
    ] satisfies ModelDefinition[];
    return models;
  }

  /**
   * Check if the provider supports a specific feature
   */
  supportsFeature(feature: string): boolean {
    const supportedFeatures = ["tools", "text", "vision", "thinking"];
    return supportedFeatures.includes(feature);
  }
}
