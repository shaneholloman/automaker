# Phase 1: Core Types & Configuration

**Status:** `completed`
**Dependencies:** Phase 0 (Analysis)
**Estimated Effort:** Small (type definitions only)

---

## Objective

Define all Cursor-specific types and extend existing types to support the new provider.

---

## Tasks

### Task 1.1: Create Cursor Model Definitions

**Status:** `completed`

**File:** `libs/types/src/cursor-models.ts`

```typescript
/**
 * Cursor CLI Model IDs
 * Reference: https://cursor.com/docs
 */
export type CursorModelId =
  | 'auto' // Auto-select best model
  | 'claude-sonnet-4' // Claude Sonnet 4
  | 'claude-sonnet-4-thinking' // Claude Sonnet 4 with extended thinking
  | 'gpt-4o' // GPT-4o
  | 'gpt-4o-mini' // GPT-4o Mini
  | 'gemini-2.5-pro' // Gemini 2.5 Pro
  | 'o3-mini'; // O3 Mini

/**
 * Cursor model metadata
 */
export interface CursorModelConfig {
  id: CursorModelId;
  label: string;
  description: string;
  hasThinking: boolean;
  tier: 'free' | 'pro';
}

/**
 * Complete model map for Cursor CLI
 */
export const CURSOR_MODEL_MAP: Record<CursorModelId, CursorModelConfig> = {
  auto: {
    id: 'auto',
    label: 'Auto (Recommended)',
    description: 'Automatically selects the best model for each task',
    hasThinking: false,
    tier: 'free',
  },
  'claude-sonnet-4': {
    id: 'claude-sonnet-4',
    label: 'Claude Sonnet 4',
    description: 'Anthropic Claude Sonnet 4 via Cursor',
    hasThinking: false,
    tier: 'pro',
  },
  'claude-sonnet-4-thinking': {
    id: 'claude-sonnet-4-thinking',
    label: 'Claude Sonnet 4 (Thinking)',
    description: 'Claude Sonnet 4 with extended thinking enabled',
    hasThinking: true,
    tier: 'pro',
  },
  'gpt-4o': {
    id: 'gpt-4o',
    label: 'GPT-4o',
    description: 'OpenAI GPT-4o via Cursor',
    hasThinking: false,
    tier: 'pro',
  },
  'gpt-4o-mini': {
    id: 'gpt-4o-mini',
    label: 'GPT-4o Mini',
    description: 'OpenAI GPT-4o Mini (faster, cheaper)',
    hasThinking: false,
    tier: 'free',
  },
  'gemini-2.5-pro': {
    id: 'gemini-2.5-pro',
    label: 'Gemini 2.5 Pro',
    description: 'Google Gemini 2.5 Pro via Cursor',
    hasThinking: false,
    tier: 'pro',
  },
  'o3-mini': {
    id: 'o3-mini',
    label: 'O3 Mini',
    description: 'OpenAI O3 Mini reasoning model',
    hasThinking: true,
    tier: 'pro',
  },
};

/**
 * Helper: Check if model has thinking capability
 */
export function cursorModelHasThinking(modelId: CursorModelId): boolean {
  return CURSOR_MODEL_MAP[modelId]?.hasThinking ?? false;
}

/**
 * Helper: Get display name for model
 */
export function getCursorModelLabel(modelId: CursorModelId): string {
  return CURSOR_MODEL_MAP[modelId]?.label ?? modelId;
}

/**
 * Helper: Get all cursor model IDs
 */
export function getAllCursorModelIds(): CursorModelId[] {
  return Object.keys(CURSOR_MODEL_MAP) as CursorModelId[];
}
```

### Task 1.2: Create Cursor CLI Types

**Status:** `completed`

**File:** `libs/types/src/cursor-cli.ts`

```typescript
import { CursorModelId } from './cursor-models';

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
```

### Task 1.3: Extend ModelProvider Type

**Status:** `completed`

**File:** `libs/types/src/settings.ts`

Find and update:

```typescript
// BEFORE:
export type ModelProvider = 'claude';

// AFTER:
export type ModelProvider = 'claude' | 'cursor';
```

### Task 1.4: Add Cursor Profile Config Type

**Status:** `skipped` (not needed - thinking is embedded in model ID)

**File:** `libs/types/src/settings.ts`

Add after existing AIProfile interface:

```typescript
/**
 * Cursor-specific profile configuration
 * Note: For Cursor, thinking is embedded in model ID (e.g., 'claude-sonnet-4-thinking')
 */
export interface CursorProfileConfig {
  model: CursorModelId;
  // No separate thinkingLevel needed - embedded in model ID
}
```

### Task 1.5: Update ModelOption Interface

**Status:** `completed`

**File:** `libs/types/src/model-display.ts`

Update the hardcoded provider type to use ModelProvider:

```typescript
// BEFORE (line 24):
export interface ModelOption {
  id: AgentModel;
  label: string;
  description: string;
  badge?: string;
  provider: 'claude'; // ❌ Hardcoded
}

// AFTER:
import { ModelProvider } from './settings.js';

export interface ModelOption {
  id: AgentModel | CursorModelId; // Union for both providers
  label: string;
  description: string;
  badge?: string;
  provider: ModelProvider; // ✅ Supports both 'claude' and 'cursor'
}
```

### Task 1.6: Extend DEFAULT_MODELS

**Status:** `completed`

**File:** `libs/types/src/model.ts`

Add cursor default model:

```typescript
// BEFORE:
export const DEFAULT_MODELS = {
  claude: 'claude-opus-4-5-20251101',
} as const;

// AFTER:
export const DEFAULT_MODELS = {
  claude: 'claude-opus-4-5-20251101',
  cursor: 'auto', // Cursor's recommended default
} as const;
```

### Task 1.7: Update Type Exports

**Status:** `completed`

**File:** `libs/types/src/index.ts`

Add exports:

```typescript
// Cursor types
export * from './cursor-models.js';
export * from './cursor-cli.js';
```

---

## Verification

### Test 1: Type Compilation

```bash
cd libs/types
pnpm build
```

**Expected:** No compilation errors

### Test 2: Import Check

Create a temporary test file:

```typescript
// test-cursor-types.ts
import {
  CursorModelId,
  CursorModelConfig,
  CURSOR_MODEL_MAP,
  cursorModelHasThinking,
  CursorStreamEvent,
  CursorCliConfig,
  ModelProvider,
} from '@automaker/types';

// Should compile without errors
const model: CursorModelId = 'claude-sonnet-4';
const provider: ModelProvider = 'cursor';
const hasThinking = cursorModelHasThinking('claude-sonnet-4-thinking');
console.log(model, provider, hasThinking);
```

```bash
npx tsc test-cursor-types.ts --noEmit
rm test-cursor-types.ts
```

**Expected:** No errors

### Test 3: Model Map Validity

```typescript
// In Node REPL or test file
import { CURSOR_MODEL_MAP, CursorModelId } from '@automaker/types';

const modelIds = Object.keys(CURSOR_MODEL_MAP) as CursorModelId[];
console.log('Models:', modelIds.length);

// All models should have required fields
for (const [id, config] of Object.entries(CURSOR_MODEL_MAP)) {
  console.assert(config.id === id, `ID mismatch: ${id}`);
  console.assert(typeof config.label === 'string', `Missing label: ${id}`);
  console.assert(typeof config.hasThinking === 'boolean', `Missing hasThinking: ${id}`);
  console.assert(['free', 'pro'].includes(config.tier), `Invalid tier: ${id}`);
}
console.log('All models valid');
```

**Expected:** All assertions pass

---

## Verification Checklist

Before marking this phase complete:

- [ ] `libs/types/src/cursor-models.ts` created with all model definitions
- [ ] `libs/types/src/cursor-cli.ts` created with CLI types
- [ ] `libs/types/src/settings.ts` extended with `cursor` provider
- [ ] `libs/types/src/index.ts` exports new types
- [ ] `pnpm build` succeeds in libs/types
- [ ] No TypeScript errors in dependent packages
- [ ] Model map contains all expected models

---

## Files Changed

| File                              | Action | Description                   |
| --------------------------------- | ------ | ----------------------------- |
| `libs/types/src/cursor-models.ts` | Create | Model definitions and helpers |
| `libs/types/src/cursor-cli.ts`    | Create | CLI and stream event types    |
| `libs/types/src/settings.ts`      | Modify | Add `cursor` to ModelProvider |
| `libs/types/src/index.ts`         | Modify | Export new types              |

---

## Notes

- Model IDs may need updating as Cursor adds/removes models
- The `hasThinking` property is critical for UI display
- Stream event types must match actual CLI output exactly
