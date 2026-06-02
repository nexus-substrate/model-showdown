# model-showdown

Model comparison pipeline for [nexus-agents](https://github.com/nexus-substrate/nexus-agents). Evaluates how different AI models and voting strategies handle the same task.

## Pipeline

```
delegate_to_model → create_expert → execute_expert → consensus_vote (×5 strategies)
```

1. **Delegate** a task to find the optimal model
2. **Create** a specialized expert agent
3. **Execute** the expert on the task
4. **Vote** on the result using all 5 consensus strategies:
   - `simple_majority` — 50%+ agreement
   - `supermajority` — 67%+ agreement
   - `unanimous` — 100% agreement
   - `proof_of_learning` — evidence-based consensus
   - `higher_order` — Bayesian-optimal aggregation

## Quick start

```bash
pnpm install
pnpm test        # Run 54 unit tests
pnpm typecheck   # TypeScript strict mode
pnpm build       # Compile to dist/
```

## Usage as a library

```typescript
import { runShowdown, generateReport } from 'model-showdown';
import type { ToolCaller } from 'model-showdown';

const caller: ToolCaller = {
  call: async (tool, args) => await mcpClient.callTool(tool, args),
};

const result = await runShowdown(caller, {
  task: 'Implement a rate limiter with sliding window',
});

console.log(generateReport(result, 'markdown'));
```

## Live integration mode

```bash
# 1. Create src/live-bridge.ts with your MCP client
# 2. Run:
NEXUS_LIVE=true npx tsx src/run-live.ts

# Custom task:
NEXUS_LIVE=true SHOWDOWN_TASK="Build a REST API" npx tsx src/run-live.ts
```

## MCP tools covered

| Tool | Purpose | Safety |
|------|---------|--------|
| `delegate_to_model` | Route task to optimal model | Read-only routing |
| `list_experts` | List available expert types | Read-only discovery |
| `create_expert` | Create specialized agent | Stateful but ephemeral |
| `execute_expert` | Run expert on task | Bounded by timeout |
| `consensus_vote` | Multi-model consensus | 5 strategies tested |

## Report formats

- **markdown** — Strategy comparison table with agreement scores
- **json** — Full showdown result as structured JSON
- **text** — Compact terminal output with per-strategy results

## Project structure

```
src/
  types.ts              # Zod schemas matching live MCP responses
  fixtures/
    mock-responses.ts   # Mock data for all tools + 5 strategy variants
  pipeline.ts           # Showdown pipeline (delegate → create → execute → vote×5)
  reporter.ts           # Report formatter with strategy comparison
  live-caller.ts        # Live mode ToolCaller bridge
  run-live.ts           # CLI entry point for live integration testing
  index.ts              # Public API exports
```

## License

MIT
