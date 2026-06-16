/**
 * model-showdown — Model comparison pipeline.
 *
 * Chains: delegate_to_model → create_expert → execute_expert → consensus_vote (×5 strategies)
 */

export {
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

export type {
  DelegateResponse,
  CreateExpertResponse,
  ExecuteExpertResponse,
  VoteResponse,
  VotingStrategy,
  ModelEvaluation,
  StrategyResult,
  ShowdownResult,
  ShowdownConfig,
} from './types.js';

export {
  delegateTask,
  createExpert,
  executeExpert,
  voteWithStrategy,
  buildProposal,
  toStrategyResult,
  computeAgreement,
  runShowdown,
} from './pipeline.js';

export type { ToolCaller } from './pipeline.js';

export { generateReport } from './reporter.js';

export type { ReportFormat } from './reporter.js';
