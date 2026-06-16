/**
 * Mock responses for model-showdown pipeline tests.
 *
 * Each mock matches the LIVE Zod schema in types.ts.
 */

import type {
  DelegateResponse,
  CreateExpertResponse,
  ExecuteExpertResponse,
  VoteResponse,
} from '../types.js';

// ============================================================================
// delegate_to_model
// ============================================================================

export const MOCK_DELEGATE_CODEX: DelegateResponse = {
  recommended_model: 'codex-5.3',
  reasoning: 'Selected codex-5.3 (score: 97.0) because: complex reasoning required, code generation task, preferred: code, plan billing (cost ignored)',
  capabilities: { reasoning: 10, contextWindow: 400000, codeGeneration: 10, speed: 7, cost: 5 },
  estimated_tokens: 28,
  alternatives: [
    { model: 'codex-5.2', score: 95, tradeoff: 'faster but less capable' },
    { model: 'claude-opus', score: 85, tradeoff: 'different tradeoffs' },
    { model: 'claude-sonnet', score: 84, tradeoff: 'cheaper but less capable' },
  ],
};

export const MOCK_DELEGATE_CLAUDE: DelegateResponse = {
  recommended_model: 'claude-opus',
  reasoning: 'Selected claude-opus (score: 92.0) because: complex reasoning required, architecture task, preferred: reasoning',
  capabilities: { reasoning: 10, contextWindow: 200000, codeGeneration: 9, speed: 6, cost: 10 },
  estimated_tokens: 35,
  alternatives: [
    { model: 'claude-sonnet', score: 88, tradeoff: 'faster but less capable' },
    { model: 'codex-5.3', score: 82, tradeoff: 'different tradeoffs' },
  ],
};

export const MOCK_DELEGATE_WITH_GOVERNANCE: DelegateResponse = {
  recommended_model: 'claude-opus',
  reasoning: 'Selected claude-opus for security review requiring supermajority',
  capabilities: { reasoning: 10, contextWindow: 200000, codeGeneration: 9, speed: 6, cost: 10 },
  estimated_tokens: 40,
  alternatives: [],
  governance: {
    domain: 'security',
    votingThreshold: 'supermajority',
    promotionReason: 'Security-related task requires elevated consensus',
  },
};

// ============================================================================
// create_expert
// ============================================================================

export const MOCK_CREATE_CODE_EXPERT: CreateExpertResponse = {
  expertId: 'code-expert',
  role: 'code_expert',
  capabilities: ['task_execution', 'code_generation', 'code_review', 'tool_use', 'collaboration'],
  status: 'ready',
};

export const MOCK_CREATE_ARCH_EXPERT: CreateExpertResponse = {
  expertId: 'architecture-expert',
  role: 'architecture_expert',
  capabilities: ['task_execution', 'research', 'collaboration'],
  status: 'ready',
};

export const MOCK_CREATE_SECURITY_EXPERT: CreateExpertResponse = {
  expertId: 'security-expert',
  role: 'security_expert',
  capabilities: ['task_execution', 'code_review', 'research'],
  status: 'ready',
};

// ============================================================================
// execute_expert
// ============================================================================

export const MOCK_EXECUTE_CODE: ExecuteExpertResponse = {
  expertId: 'code-expert',
  output: 'Vitest is recommended for TypeScript projects. It offers native ESM support, fast HMR-based execution, and first-class TypeScript integration. Jest remains viable for larger codebases with extensive mocking needs.',
  confidence: 0.88,
  tokensUsed: 1250,
};

export const MOCK_EXECUTE_ARCH: ExecuteExpertResponse = {
  expertId: 'architecture-expert',
  output: 'A plugin-based architecture with an event bus provides the best extensibility. Use a pipeline pattern for sequential processing stages with well-defined contracts between steps.',
  confidence: 0.82,
  tokensUsed: 980,
};

export const MOCK_EXECUTE_TIMEOUT: ExecuteExpertResponse = {
  expertId: 'code-expert',
  output: '',
  confidence: 0,
  tokensUsed: 0,
};

// ============================================================================
// consensus_vote — per strategy
// ============================================================================

export const MOCK_VOTE_MAJORITY_APPROVED: VoteResponse = {
  proposal: 'The model recommendation and expert analysis are sound.',
  strategy: 'simple_majority',
  decision: 'approved',
  approvalPercentage: 83.3,
  voteCounts: { approve: 5, reject: 1, abstain: 0, error: 0 },
  votes: [
    { role: 'architect', decision: 'approve', confidence: 0.9, reasoning: 'Sound recommendation.', simulated: false, error: false },
    { role: 'security', decision: 'approve', confidence: 0.85, reasoning: 'No concerns.', simulated: false, error: false },
    { role: 'devex', decision: 'approve', confidence: 0.8, reasoning: 'Good developer experience.', simulated: false, error: false },
    { role: 'ai_ml', decision: 'approve', confidence: 0.95, reasoning: 'Optimal model selection.', simulated: false, error: false },
    { role: 'pm', decision: 'approve', confidence: 0.7, reasoning: 'Aligns with goals.', simulated: false, error: false },
    { role: 'catfish', decision: 'reject', confidence: 0.6, reasoning: 'Could be faster.', simulated: false, error: false },
  ],
  durationMs: 12500,
  simulateVotes: false,
};

export const MOCK_VOTE_SUPERMAJORITY_APPROVED: VoteResponse = {
  ...MOCK_VOTE_MAJORITY_APPROVED,
  strategy: 'supermajority',
};

export const MOCK_VOTE_UNANIMOUS_REJECTED: VoteResponse = {
  proposal: 'The model recommendation and expert analysis are sound.',
  strategy: 'unanimous',
  decision: 'rejected',
  approvalPercentage: 83.3,
  voteCounts: { approve: 5, reject: 1, abstain: 0, error: 0 },
  votes: MOCK_VOTE_MAJORITY_APPROVED.votes,
  durationMs: 13100,
  simulateVotes: false,
};

export const MOCK_VOTE_POL_APPROVED: VoteResponse = {
  ...MOCK_VOTE_MAJORITY_APPROVED,
  strategy: 'proof_of_learning',
  approvalPercentage: 80.0,
  durationMs: 15200,
};

export const MOCK_VOTE_HIGHER_ORDER_APPROVED: VoteResponse = {
  ...MOCK_VOTE_MAJORITY_APPROVED,
  strategy: 'higher_order',
  approvalPercentage: 85.0,
  durationMs: 14800,
};

/** Maps strategy name to mock vote response. */
export const STRATEGY_MOCKS: Record<string, VoteResponse> = {
  simple_majority: MOCK_VOTE_MAJORITY_APPROVED,
  supermajority: MOCK_VOTE_SUPERMAJORITY_APPROVED,
  unanimous: MOCK_VOTE_UNANIMOUS_REJECTED,
  proof_of_learning: MOCK_VOTE_POL_APPROVED,
  higher_order: MOCK_VOTE_HIGHER_ORDER_APPROVED,
};

export const EXPECTED_EXPERT_ROLES = [
  'code_expert', 'architecture_expert', 'security_expert',
  'documentation_expert', 'testing_expert', 'devops_expert',
  'research_expert', 'pm_expert', 'ux_expert',
];
