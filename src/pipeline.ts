/**
 * Model showdown pipeline.
 *
 * Chains: delegate_to_model → create_expert → execute_expert → consensus_vote (×5 strategies)
 */

import {
  DelegateResponseSchema,
  CreateExpertResponseSchema,
  ExecuteExpertResponseSchema,
  VoteResponseSchema,
  VOTING_STRATEGIES,
  type DelegateResponse,
  type CreateExpertResponse,
  type ExecuteExpertResponse,
  type VoteResponse,
  type VotingStrategy,
  type ShowdownConfig,
  type ShowdownResult,
  type ModelEvaluation,
  type StrategyResult,
} from './types.js';

// ---------------------------------------------------------------------------
// ToolCaller interface
// ---------------------------------------------------------------------------

export interface ToolCaller {
  call(tool: string, args: Record<string, unknown>): Promise<unknown>;
}

/** Default per-call timeout for remote tool calls (ms). */
export const DEFAULT_TIMEOUT_MS = 30_000;

/** Error thrown when a tool call exceeds its configured timeout. */
export class ToolCallTimeoutError extends Error {
  constructor(toolName: string, timeoutMs: number) {
    super(`Tool call '${toolName}' timed out after ${timeoutMs}ms`);
    this.name = 'ToolCallTimeoutError';
  }
}

/**
 * Wrap a ToolCaller so every call is bounded by `timeoutMs`.
 *
 * Uses an AbortController (so cooperating callers can cancel in-flight work)
 * combined with Promise.race, guaranteeing the returned promise settles even
 * if the underlying call hangs forever.
 */
export function withTimeout(
  caller: ToolCaller,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): ToolCaller {
  return {
    call(tool: string, args: Record<string, unknown>): Promise<unknown> {
      const controller = new AbortController();
      const callArgs = { ...args, signal: controller.signal };
      return new Promise<unknown>((resolve, reject) => {
        const timer = setTimeout(() => {
          controller.abort();
          reject(new ToolCallTimeoutError(tool, timeoutMs));
        }, timeoutMs);
        caller.call(tool, callArgs).then(
          (value) => { clearTimeout(timer); resolve(value); },
          (err) => { clearTimeout(timer); reject(err); },
        );
      });
    },
  };
}

// ---------------------------------------------------------------------------
// Step 1: Route task to optimal model
// ---------------------------------------------------------------------------

export async function delegateTask(
  caller: ToolCaller,
  task: string,
  capability?: string,
): Promise<DelegateResponse> {
  const args: Record<string, unknown> = { task };
  if (capability !== undefined) args['preferred_capability'] = capability;
  const raw = await caller.call('delegate_to_model', args);
  return DelegateResponseSchema.parse(raw);
}

// ---------------------------------------------------------------------------
// Step 2: Create expert for evaluation
// ---------------------------------------------------------------------------

export async function createExpert(
  caller: ToolCaller,
  role: string,
): Promise<CreateExpertResponse> {
  const raw = await caller.call('create_expert', { role });
  return CreateExpertResponseSchema.parse(raw);
}

// ---------------------------------------------------------------------------
// Step 3: Execute expert analysis
// ---------------------------------------------------------------------------

export async function executeExpert(
  caller: ToolCaller,
  expertId: string,
  task: string,
): Promise<ExecuteExpertResponse> {
  const raw = await caller.call('execute_expert', { expertId, task });
  return ExecuteExpertResponseSchema.parse(raw);
}

// ---------------------------------------------------------------------------
// Step 4: Vote on quality with a specific strategy
// ---------------------------------------------------------------------------

export async function voteWithStrategy(
  caller: ToolCaller,
  proposal: string,
  strategy: VotingStrategy,
): Promise<VoteResponse> {
  const raw = await caller.call('consensus_vote', { proposal, strategy });
  return VoteResponseSchema.parse(raw);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function buildProposal(
  delegation: DelegateResponse,
  expertResult: ExecuteExpertResponse,
): string {
  const alternatives = delegation.alternatives
    .map((a) => `${a.model} (score: ${a.score})`)
    .join(', ');

  return [
    `Model recommendation: ${delegation.recommended_model}`,
    `Reasoning: ${delegation.reasoning}`,
    alternatives ? `Alternatives: ${alternatives}` : '',
    `Expert analysis (confidence: ${expertResult.confidence}):`,
    expertResult.output.slice(0, 2000),
  ]
    .filter(Boolean)
    .join('\n');
}

export function toStrategyResult(vote: VoteResponse): StrategyResult {
  return {
    strategy: vote.strategy as VotingStrategy,
    decision: vote.decision,
    approvalPercentage: vote.approvalPercentage,
    voteCounts: vote.voteCounts,
    durationMs: vote.durationMs,
  };
}

export function computeAgreement(results: readonly StrategyResult[]): number {
  if (results.length === 0) return 0;
  const decisions = results.map((r) => r.decision);
  const approvedCount = decisions.filter((d) => d === 'approved').length;
  const rejectedCount = decisions.filter((d) => d === 'rejected').length;
  const majorityCount = Math.max(approvedCount, rejectedCount);
  return majorityCount / results.length;
}

function inferExpertRole(task: string): string {
  const lower = task.toLowerCase();
  if (lower.includes('security') || lower.includes('vulnerab')) return 'security_expert';
  if (lower.includes('architect') || lower.includes('design')) return 'architecture_expert';
  if (lower.includes('test') || lower.includes('qa')) return 'testing_expert';
  if (lower.includes('doc') || lower.includes('readme')) return 'documentation_expert';
  if (lower.includes('deploy') || lower.includes('ci/cd')) return 'devops_expert';
  if (lower.includes('research') || lower.includes('paper')) return 'research_expert';
  if (lower.includes('product') || lower.includes('user stor')) return 'pm_expert';
  if (lower.includes('ux') || lower.includes('usability')) return 'ux_expert';
  return 'code_expert';
}

// ---------------------------------------------------------------------------
// Full pipeline
// ---------------------------------------------------------------------------

export async function runShowdown(
  caller: ToolCaller,
  config: ShowdownConfig,
): Promise<ShowdownResult> {
  const errors: string[] = [];
  const strategies = config.strategies ?? VOTING_STRATEGIES;
  const boundedCaller = withTimeout(caller, config.timeoutMs);

  // Step 1: Delegate
  const delegation = await delegateTask(boundedCaller, config.task, config.preferredCapability);

  // Step 2: Create expert
  const role = config.expertRole ?? inferExpertRole(config.task);
  const expert = await createExpert(boundedCaller, role);

  // Step 3: Execute expert
  const expertTask = `Evaluate this model recommendation for the task: "${config.task}"\n\n` +
    `Recommended: ${delegation.recommended_model}\n` +
    `Reasoning: ${delegation.reasoning}`;
  const expertResult = await executeExpert(boundedCaller, expert.expertId, expertTask);

  // Build evaluation
  const evaluation: ModelEvaluation = {
    task: config.task,
    recommendedModel: delegation.recommended_model,
    reasoning: delegation.reasoning,
    alternatives: delegation.alternatives.map((a) => ({ model: a.model, score: a.score })),
    expertRole: expert.role,
    expertOutput: expertResult.output,
    expertConfidence: expertResult.confidence,
  };

  // Step 4: Vote with each strategy
  const proposal = buildProposal(delegation, expertResult);
  const strategyResults: StrategyResult[] = [];

  for (const strategy of strategies) {
    try {
      const vote = await voteWithStrategy(boundedCaller, proposal, strategy);
      strategyResults.push(toStrategyResult(vote));
    } catch (e) {
      errors.push(`${strategy} vote failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  const strategyAgreement = computeAgreement(strategyResults);

  return { evaluation, strategyResults, strategyAgreement, errors };
}
