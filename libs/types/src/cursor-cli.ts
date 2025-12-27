import type { CursorModelId } from './cursor-models.js';

/**
 * Cursor CLI configuration file schema
 * Stored in: .automaker/cursor-config.json
 */
export interface CursorCliConfig {
  defaultModel?: CursorModelId;
  models?: CursorModelId[]; // Enabled models
  mcpServers?: string[]; // MCP server configs to load
  rules?: string[]; // .cursor/rules paths
}

/**
 * Cursor authentication status
 */
export interface CursorAuthStatus {
  authenticated: boolean;
  method: 'login' | 'api_key' | 'none';
  hasCredentialsFile?: boolean;
}

/**
 * NOTE: Reuse existing InstallationStatus from provider.ts
 * The existing type already has: installed, path, version, method, hasApiKey, authenticated
 *
 * Add 'login' to the method union if needed:
 * method?: 'cli' | 'npm' | 'brew' | 'sdk' | 'login';
 */

/**
 * Cursor stream-json event types (from CLI output)
 */
export interface CursorSystemEvent {
  type: 'system';
  subtype: 'init';
  apiKeySource: 'env' | 'flag' | 'login';
  cwd: string;
  session_id: string;
  model: string;
  permissionMode: string;
}

export interface CursorUserEvent {
  type: 'user';
  message: {
    role: 'user';
    content: Array<{ type: 'text'; text: string }>;
  };
  session_id: string;
}

export interface CursorAssistantEvent {
  type: 'assistant';
  message: {
    role: 'assistant';
    content: Array<{ type: 'text'; text: string }>;
  };
  session_id: string;
}

export interface CursorToolCallEvent {
  type: 'tool_call';
  subtype: 'started' | 'completed';
  call_id: string;
  tool_call: {
    readToolCall?: {
      args: { path: string };
      result?: {
        success?: {
          content: string;
          isEmpty: boolean;
          exceededLimit: boolean;
          totalLines: number;
          totalChars: number;
        };
      };
    };
    writeToolCall?: {
      args: { path: string; fileText: string; toolCallId?: string };
      result?: {
        success?: {
          path: string;
          linesCreated: number;
          fileSize: number;
        };
      };
    };
    function?: {
      name: string;
      arguments: string;
    };
  };
  session_id: string;
}

export interface CursorResultEvent {
  type: 'result';
  subtype: 'success' | 'error';
  duration_ms: number;
  duration_api_ms: number;
  is_error: boolean;
  result: string;
  session_id: string;
  request_id?: string;
  error?: string;
}

export type CursorStreamEvent =
  | CursorSystemEvent
  | CursorUserEvent
  | CursorAssistantEvent
  | CursorToolCallEvent
  | CursorResultEvent;
