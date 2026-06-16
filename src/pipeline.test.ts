/**
 * Tests for model-showdown pipeline — multi-tool composition.
 */

import { describe, it, expect, vi } from 'vitest';
import type { ToolCaller } from './pipeline.js';
import {
  delegateTask,
  createExpert,
  executeExpert,
  voteWithStrategy,
  buildProposal,
  toStrategyResult,
  computeAgreement,
  runShowdown,
  withTimeout,
  ToolCallTimeoutError,
} from './pipeline.js';
import type { ShowdownConfig, VotingStrategy } from './types.js';
import {
  MOCK_DELEGATE_CODEX,
  MOCK_DELEGATE_CLAUDE,
  MOCK_CREATE_CODE_EXPERT,
  MOCK_CREATE_ARCH_EXPERT,
  MOCK_EXECUTE_CODE,
  MOCK_EXECUTE_ARCH,
  MOCK_VOTE_MAJORITY_APPROVED,
  MOCK_VOTE_UNANIMOUS_REJECTED,
  STRATEGY_MOCKS,
} from './fixtures/mock-responses.js';

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function mockCaller(
  responses: Record<string, unknown>,
): ToolCaller & { calls: Array<{ tool: string; args: Record<string, unknown> }> } {
  const calls: Array<{ tool: string; args: Record<string, unknown> }> = [];
  return {
    calls,
    call: vi.fn(async (tool: string, args: Record<string, unknown>) => {
      calls.push({ tool, args });
      const response = responses[tool];
      if (response === undefined) throw new Error(`Unexpected tool: ${tool}`);
      return response;
    }),
  };
}

/** Caller that returns strategy-specific vote mocks. */
function strategyAwareCaller(): ToolCaller & { calls: Array<{ tool: string; args: Record<string, unknown> }> } {
  const calls: Array<{ tool: string; args: Record<string, unknown> }> = [];
  return {
    calls,
    call: vi.fn(async (tool: string, args: Record<string, unknown>) => {
      calls.push({ tool, args });
      if (tool === 'delegate_to_model') return MOCK_DELEGATE_CODEX;
      if (tool === 'create_expert') return MOCK_CREATE_CODE_EXPERT;
      if (tool === 'execute_expert') return MOCK_EXECUTE_CODE;
      if (tool === 'consensus_vote') {
        const strategy = args['strategy'] as string;
        return STRATEGY_MOCKS[strategy] ?? MOCK_VOTE_MAJORITY_APPROVED;
      }
      throw new Error(`Unexpected tool: ${tool}`);
    }),
  };
}

// ---------------------------------------------------------------------------
// Individual steps
// ---------------------------------------------------------------------------

describe('delegateTask', () => {
  it('calls delegate_to_model and parses', async () => {
    const caller = mockCaller({ delegate_to_model: MOCK_DELEGATE_CODEX });
    const result = await delegateTask(caller, 'Compare testing frameworks', 'code');
    expect(result.recommended_model).toBe('codex-5.3');
    expect(caller.calls[0]?.args).toEqual({ task: 'Compare testing frameworks', preferred_capability: 'code' });
  });

  it('omits capability when not provided', async () => {
    const caller = mockCaller({ delegate_to_model: MOCK_DELEGATE_CLAUDE });
    await delegateTask(caller, 'Architecture review');
    expect(caller.calls[0]?.args).toEqual({ task: 'Architecture review' });
  });
});

describe('createExpert', () => {
  it('creates code expert', async () => {
    const caller = mockCaller({ create_expert: MOCK_CREATE_CODE_EXPERT });
    const result = await createExpert(caller, 'code_expert');
    expect(result.status).toBe('ready');
    expect(result.role).toBe('code_expert');
  });

  it('creates architecture expert', async () => {
    const caller = mockCaller({ create_expert: MOCK_CREATE_ARCH_EXPERT });
    const result = await createExpert(caller, 'architecture_expert');
    expect(result.expertId).toBe('architecture-expert');
  });
});

describe('executeExpert', () => {
  it('executes and returns output with confidence', async () => {
    const caller = mockCaller({ execute_expert: MOCK_EXECUTE_CODE });
    const result = await executeExpert(caller, 'code-expert', 'Evaluate this');
    expect(result.confidence).toBe(0.88);
    expect(result.output).toContain('Vitest');
  });
});

describe('voteWithStrategy', () => {
  it('passes strategy to consensus_vote', async () => {
    const caller = mockCaller({ consensus_vote: MOCK_VOTE_MAJORITY_APPROVED });
    await voteWithStrategy(caller, 'Test proposal', 'simple_majority');
    expect(caller.calls[0]?.args['strategy']).toBe('simple_majority');
  });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

describe('buildProposal', () => {
  it('includes model and expert output', () => {
    const proposal = buildProposal(MOCK_DELEGATE_CODEX, MOCK_EXECUTE_CODE);
    expect(proposal).toContain('codex-5.3');
    expect(proposal).toContain('Vitest');
    expect(proposal).toContain('confidence: 0.88');
  });

  it('includes alternatives', () => {
    const proposal = buildProposal(MOCK_DELEGATE_CODEX, MOCK_EXECUTE_CODE);
    expect(proposal).toContain('codex-5.2');
    expect(proposal).toContain('claude-opus');
  });

  it('truncates long expert output', () => {
    const longOutput = { ...MOCK_EXECUTE_CODE, output: 'x'.repeat(5000) };
    const proposal = buildProposal(MOCK_DELEGATE_CODEX, longOutput);
    expect(proposal.length).toBeLessThan(3000);
  });
});

describe('toStrategyResult', () => {
  it('extracts strategy result fields', () => {
    const result = toStrategyResult(MOCK_VOTE_MAJORITY_APPROVED);
    expect(result.strategy).toBe('simple_majority');
    expect(result.decision).toBe('approved');
    expect(result.approvalPercentage).toBe(83.3);
    expect(result.durationMs).toBe(12500);
  });
});

describe('computeAgreement', () => {
  it('returns 1.0 when all agree', () => {
    const results = [
      toStrategyResult(MOCK_VOTE_MAJORITY_APPROVED),
      toStrategyResult({ ...MOCK_VOTE_MAJORITY_APPROVED, strategy: 'supermajority' }),
    ];
    expect(computeAgreement(results)).toBe(1.0);
  });

  it('returns 0.8 when 4/5 agree', () => {
    const approved = toStrategyResult(MOCK_VOTE_MAJORITY_APPROVED);
    const rejected = toStrategyResult(MOCK_VOTE_UNANIMOUS_REJECTED);
    expect(computeAgreement([approved, approved, approved, approved, rejected])).toBe(0.8);
  });

  it('returns 0 for empty', () => {
    expect(computeAgreement([])).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Full pipeline
// ---------------------------------------------------------------------------

describe('runShowdown', () => {
  it('chains all 4 tools across 5 strategies', async () => {
    const caller = strategyAwareCaller();

    const config: ShowdownConfig = {
      task: 'Compare TypeScript testing frameworks',
      preferredCapability: 'code',
      expertRole: 'code_expert',
    };

    const result = await runShowdown(caller, config);

    expect(result.evaluation.recommendedModel).toBe('codex-5.3');
    expect(result.evaluation.expertRole).toBe('code_expert');
    expect(result.evaluation.expertConfidence).toBe(0.88);
    expect(result.strategyResults).toHaveLength(5);
    expect(result.errors).toHaveLength(0);

    // Verify tool call order
    const tools = caller.calls.map((c) => c.tool);
    expect(tools[0]).toBe('delegate_to_model');
    expect(tools[1]).toBe('create_expert');
    expect(tools[2]).toBe('execute_expert');
    // Remaining 5 are consensus_vote
    expect(tools.slice(3).every((t) => t === 'consensus_vote')).toBe(true);
    expect(tools).toHaveLength(8); // 3 + 5 strategies
  });

  it('computes strategy agreement', async () => {
    const caller = strategyAwareCaller();
    const result = await runShowdown(caller, { task: 'Test task' });

    // 4 approved + 1 rejected (unanimous) = 80% agreement
    expect(result.strategyAgreement).toBe(0.8);
  });

  it('infers expert role from task', async () => {
    const caller = strategyAwareCaller();
    const result = await runShowdown(caller, { task: 'Security audit of auth module' });

    // Should infer security_expert
    const createCall = caller.calls.find((c) => c.tool === 'create_expert');
    expect(createCall?.args['role']).toBe('security_expert');
    expect(result.evaluation.expertRole).toBe('code_expert'); // mock returns code_expert
  });

  it('uses custom strategies subset', async () => {
    const caller = strategyAwareCaller();
    const strategies: VotingStrategy[] = ['simple_majority', 'unanimous'];
    const result = await runShowdown(caller, { task: 'Test', strategies });

    expect(result.strategyResults).toHaveLength(2);
    const usedStrategies = result.strategyResults.map((s) => s.strategy);
    expect(usedStrategies).toContain('simple_majority');
    expect(usedStrategies).toContain('unanimous');
  });

  it('captures vote errors without stopping', async () => {
    let callCount = 0;
    const caller: ToolCaller = {
      call: async (tool: string, args: Record<string, unknown>) => {
        if (tool === 'delegate_to_model') return MOCK_DELEGATE_CODEX;
        if (tool === 'create_expert') return MOCK_CREATE_CODE_EXPERT;
        if (tool === 'execute_expert') return MOCK_EXECUTE_CODE;
        if (tool === 'consensus_vote') {
          callCount++;
          if (callCount === 3) throw new Error('vote timeout');
          return MOCK_VOTE_MAJORITY_APPROVED;
        }
        throw new Error(`Unexpected: ${tool}`);
      },
    };

    const result = await runShowdown(caller, { task: 'Test' });
    expect(result.strategyResults).toHaveLength(4); // 5 - 1 failed
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain('vote failed');
  });

  it('each strategy gets different strategy argument', async () => {
    const caller = strategyAwareCaller();
    await runShowdown(caller, { task: 'Test' });

    const voteStrategies = caller.calls
      .filter((c) => c.tool === 'consensus_vote')
      .map((c) => c.args['strategy']);

    expect(voteStrategies).toEqual([
      'simple_majority',
      'supermajority',
      'unanimous',
      'proof_of_learning',
      'higher_order',
    ]);
  });
});

// ---------------------------------------------------------------------------
// withTimeout
// ---------------------------------------------------------------------------

describe('withTimeout', () => {
  it('rejects with ToolCallTimeoutError when the call never resolves', async () => {
    const hanging: ToolCaller = {
      call: () => new Promise<unknown>(() => {}),
    };
    const bounded = withTimeout(hanging, 10);
    await expect(bounded.call('slow_tool', {})).rejects.toBeInstanceOf(ToolCallTimeoutError);
  });

  it('passes through a fast result', async () => {
    const fast: ToolCaller = {
      call: async () => ({ ok: true }),
    };
    const bounded = withTimeout(fast, 10_000);
    await expect(bounded.call('fast_tool', {})).resolves.toEqual({ ok: true });
  });

  it('propagates an underlying thrown error unchanged', async () => {
    const original = new Error('boom');
    const failing: ToolCaller = {
      call: async () => {
        throw original;
      },
    };
    const bounded = withTimeout(failing, 10_000);
    await expect(bounded.call('failing_tool', {})).rejects.toBe(original);
  });

  it('aborts the signal on timeout', async () => {
    let capturedSignal: AbortSignal | undefined;
    const hanging: ToolCaller = {
      call: (_tool: string, args: Record<string, unknown>) => {
        capturedSignal = args['signal'] as AbortSignal;
        return new Promise<unknown>(() => {});
      },
    };
    const bounded = withTimeout(hanging, 10);
    await expect(bounded.call('slow_tool', {})).rejects.toBeInstanceOf(ToolCallTimeoutError);
    expect(capturedSignal?.aborted).toBe(true);
  });
});
