# Context Management

When the context window is getting full:

1. Compact the conversation before reaching the context limit.
2. Preserve:
    - Current task and objective
    - Files modified
    - Important implementation decisions
    - Bugs discovered and their causes
    - Commands already executed
    - Test/build results
    - Remaining TODOs
    - Important constraints
3. After compaction, continue the task from the compacted summary.
4. Do not restart the task from scratch.
5. Do not repeat investigation that has already been completed.
6. Before making changes, inspect the current state of the files rather than relying only on conversation history.

For long-running tasks, maintain a concise progress summary in:
`.opencode/progress.md`

Update it whenever a major implementation step is completed.