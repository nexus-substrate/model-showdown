/**
 * Tests for Zod schema validation — all MCP tool contracts.
 */

import { describe, it, expect } from 'vitest';
import {
  DelegateInputSchema,
  DelegateResponseSchema,
  CreateExpertInputSchema,
  CreateExpertResponseSchema,
  ExecuteExpertInputSchema,
  ExecuteExpertResponseSchema,
  VoteInputSchema,
  VoteResponseSchema,
  VOTING_STRATEGIES,
} from './types.js';
import {
  MOCK_DELEGATE_CODEX,
  MOCK_DELEGATE_CLAUDE,
  MOCK_DELEGATE_WITH_GOVERNANCE,
  MOCK_CREATE_CODE_EXPERT,
  MOCK_CREATE_ARCH_EXPERT,
  MOCK_EXECUTE_CODE,
  MOCK_EXECUTE_ARCH,
  MOCK_VOTE_MAJORITY_APPROVED,
  MOCK_VOTE_UNANIMOUS_REJECTED,
  MOCK_VOTE_POL_APPROVED,
  MOCK_VOTE_HIGHER_ORDER_APPROVED,
  EXPECTED_EXPERT_ROLES,
} from './fixtures/mock-responses.js';

// ============================================================================
// delegate_to_model
// ============================================================================

describe('DelegateInputSchema', () => {
  it('accepts minimal input', () => {
    expect(DelegateInputSchema.safeParse({ task: 'test' }).success).toBe(true);
  });

  it('accepts all capabilities', () => {
    for (const cap of ['reasoning', 'context', 'speed', 'code']) {
      const r = DelegateInputSchema.safeParse({ task: 'test', preferred_capability: cap });
      expect(r.success).toBe(true);
    }
  });

  it('rejects empty task', () => {
    expect(DelegateInputSchema.safeParse({ task: '' }).success).toBe(false);
  });
});

describe('DelegateResponseSchema', () => {
  it('parses codex response', () => {
    const r = DelegateResponseSchema.safeParse(MOCK_DELEGATE_CODEX);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.recommended_model).toBe('codex-5.3');
      expect(r.data.alternatives).toHaveLength(3);
    }
  });

  it('parses claude response', () => {
    const r = DelegateResponseSchema.safeParse(MOCK_DELEGATE_CLAUDE);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.recommended_model).toBe('claude-opus');
    }
  });

  it('parses response with governance', () => {
    const r = DelegateResponseSchema.safeParse(MOCK_DELEGATE_WITH_GOVERNANCE);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.governance).toBeDefined();
      expect(r.data.governance?.votingThreshold).toBe('supermajority');
    }
  });

  it('accepts response without governance', () => {
    const r = DelegateResponseSchema.safeParse(MOCK_DELEGATE_CODEX);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.governance).toBeUndefined();
    }
  });
});

// ============================================================================
// create_expert
// ============================================================================

describe('CreateExpertInputSchema', () => {
  it('accepts all 9 roles', () => {
    for (const role of EXPECTED_EXPERT_ROLES) {
      const r = CreateExpertInputSchema.safeParse({ role });
      expect(r.success).toBe(true);
    }
  });

  it('rejects invalid role', () => {
    expect(CreateExpertInputSchema.safeParse({ role: 'invalid' }).success).toBe(false);
  });
});

describe('CreateExpertResponseSchema', () => {
  it('parses code expert', () => {
    const r = CreateExpertResponseSchema.safeParse(MOCK_CREATE_CODE_EXPERT);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.status).toBe('ready');
      expect(r.data.role).toBe('code_expert');
    }
  });

  it('parses architecture expert', () => {
    const r = CreateExpertResponseSchema.safeParse(MOCK_CREATE_ARCH_EXPERT);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.expertId).toBe('architecture-expert');
    }
  });
});

// ============================================================================
// execute_expert
// ============================================================================

describe('ExecuteExpertInputSchema', () => {
  it('accepts valid input', () => {
    const r = ExecuteExpertInputSchema.safeParse({ expertId: 'code-expert', task: 'Analyze this' });
    expect(r.success).toBe(true);
  });

  it('rejects empty expertId', () => {
    expect(ExecuteExpertInputSchema.safeParse({ expertId: '', task: 'test' }).success).toBe(false);
  });

  it('rejects empty task', () => {
    expect(ExecuteExpertInputSchema.safeParse({ expertId: 'x', task: '' }).success).toBe(false);
  });
});

describe('ExecuteExpertResponseSchema', () => {
  it('parses code expert output', () => {
    const r = ExecuteExpertResponseSchema.safeParse(MOCK_EXECUTE_CODE);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.confidence).toBeGreaterThan(0);
      expect(r.data.tokensUsed).toBeGreaterThan(0);
    }
  });

  it('parses architecture expert output', () => {
    const r = ExecuteExpertResponseSchema.safeParse(MOCK_EXECUTE_ARCH);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.output).toContain('plugin-based');
    }
  });
});

// ============================================================================
// consensus_vote
// ============================================================================

describe('VoteInputSchema', () => {
  it('accepts all 5 strategies', () => {
    for (const strategy of VOTING_STRATEGIES) {
      const r = VoteInputSchema.safeParse({ proposal: 'Test', strategy });
      expect(r.success).toBe(true);
    }
  });

  it('rejects empty proposal', () => {
    expect(VoteInputSchema.safeParse({ proposal: '' }).success).toBe(false);
  });
});

describe('VoteResponseSchema', () => {
  it('parses majority approved', () => {
    const r = VoteResponseSchema.safeParse(MOCK_VOTE_MAJORITY_APPROVED);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.decision).toBe('approved');
  });

  it('parses unanimous rejected', () => {
    const r = VoteResponseSchema.safeParse(MOCK_VOTE_UNANIMOUS_REJECTED);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.decision).toBe('rejected');
  });

  it('parses proof_of_learning', () => {
    const r = VoteResponseSchema.safeParse(MOCK_VOTE_POL_APPROVED);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.strategy).toBe('proof_of_learning');
  });

  it('parses higher_order', () => {
    const r = VoteResponseSchema.safeParse(MOCK_VOTE_HIGHER_ORDER_APPROVED);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.strategy).toBe('higher_order');
  });
});
