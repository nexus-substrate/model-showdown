/**
 * Zod schemas for model-showdown MCP tool contracts.
 *
 * Covers: delegate_to_model, create_expert, execute_expert, consensus_vote
 * Schemas match LIVE tool responses from nexus-agents MCP server.
 */

import { z } from 'zod';

// ============================================================================
// delegate_to_model
// ============================================================================

export const DelegateInputSchema = z.object({
  task: z.string().min(1),
  preferred_capability: z.enum(['reasoning', 'context', 'speed', 'code']).optional(),
  model_hint: z.string().optional(),
  estimate_tokens: z.boolean().optional(),
  billing_mode: z.enum(['plan', 'api']).optional(),
});

const AlternativeSchema = z.object({
  model: z.string(),
  score: z.number(),
  tradeoff: z.string(),
});

const GovernanceSchema = z.object({
  domain: z.string(),
  votingThreshold: z.string(),
  promotionReason: z.string(),
}).optional();

export const DelegateResponseSchema = z.object({
  recommended_model: z.string(),
  reasoning: z.string(),
  capabilities: z.object({
    reasoning: z.number(),
    contextWindow: z.number(),
    codeGeneration: z.number(),
    speed: z.number(),
    cost: z.number(),
  }),
  estimated_tokens: z.number(),
  alternatives: z.array(AlternativeSchema),
  governance: GovernanceSchema,
});

export type DelegateResponse = z.infer<typeof DelegateResponseSchema>;

// ============================================================================
// create_expert
// ============================================================================

export const CreateExpertInputSchema = z.object({
  role: z.enum([
    'code_expert', 'architecture_expert', 'security_expert',
    'documentation_expert', 'testing_expert', 'devops_expert',
    'research_expert', 'pm_expert', 'ux_expert',
  ]),
  modelPreference: z.string().optional(),
});

export const CreateExpertResponseSchema = z.object({
  expertId: z.string(),
  role: z.string(),
  capabilities: z.array(z.string()),
  status: z.string(),
});

export type CreateExpertResponse = z.infer<typeof CreateExpertResponseSchema>;

// ============================================================================
// execute_expert
// ============================================================================

export const ExecuteExpertInputSchema = z.object({
  expertId: z.string().min(1),
  task: z.string().min(1),
  context: z.record(z.unknown()).optional(),
});

export const ExecuteExpertResponseSchema = z.object({
  expertId: z.string(),
  output: z.string(),
  confidence: z.number(),
  tokensUsed: z.number(),
});

export type ExecuteExpertResponse = z.infer<typeof ExecuteExpertResponseSchema>;

// ============================================================================
// consensus_vote (reused from routing-oracle)
// ============================================================================

export const VOTING_STRATEGIES = [
  'simple_majority',
  'supermajority',
  'unanimous',
  'proof_of_learning',
  'higher_order',
] as const;

export type VotingStrategy = (typeof VOTING_STRATEGIES)[number];

export const VoteInputSchema = z.object({
  proposal: z.string().min(1).max(4000),
  strategy: z.enum(VOTING_STRATEGIES).optional(),
  quickMode: z.boolean().optional(),
  simulateVotes: z.boolean().optional(),
});

const AgentVoteSchema = z.object({
  role: z.string(),
  decision: z.enum(['approve', 'reject', 'abstain']),
  confidence: z.number(),
  reasoning: z.string(),
  simulated: z.boolean(),
  error: z.boolean(),
});

export const VoteResponseSchema = z.object({
  proposal: z.string(),
  strategy: z.string(),
  decision: z.enum(['approved', 'rejected', 'pending', 'timeout']),
  approvalPercentage: z.number(),
  voteCounts: z.object({
    approve: z.number(),
    reject: z.number(),
    abstain: z.number(),
    error: z.number(),
  }),
  votes: z.array(AgentVoteSchema),
  durationMs: z.number(),
  simulateVotes: z.boolean(),
});

export type VoteResponse = z.infer<typeof VoteResponseSchema>;

// ============================================================================
// Pipeline types
// ============================================================================

/** A single model evaluation run. */
export interface ModelEvaluation {
  readonly task: string;
  readonly recommendedModel: string;
  readonly reasoning: string;
  readonly alternatives: readonly { model: string; score: number }[];
  readonly expertRole: string;
  readonly expertOutput: string;
  readonly expertConfidence: number;
}

/** Result of voting on a model evaluation with a specific strategy. */
export interface StrategyResult {
  readonly strategy: VotingStrategy;
  readonly decision: string;
  readonly approvalPercentage: number;
  readonly voteCounts: { approve: number; reject: number; abstain: number; error: number };
  readonly durationMs: number;
}

/** Full showdown result comparing strategies. */
export interface ShowdownResult {
  readonly evaluation: ModelEvaluation;
  readonly strategyResults: readonly StrategyResult[];
  readonly strategyAgreement: number;
  readonly errors: readonly string[];
}

/** Pipeline configuration. */
export interface ShowdownConfig {
  readonly task: string;
  readonly preferredCapability?: 'reasoning' | 'context' | 'speed' | 'code';
  readonly expertRole?: string;
  readonly strategies?: readonly VotingStrategy[];
  /** Per-call timeout (ms) for remote tool calls. Omit to use the default. */
  readonly timeoutMs?: number;
}
