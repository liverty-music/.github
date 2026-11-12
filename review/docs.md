Provide a review of a pull request that changes only Markdown: an OpenSpec change
(proposal, design, tasks, delta specs), an archive of one, a skill, or another
document. The workflow has written everything you need to know about this run
to `.review-kit/run/context.md`: read it first. It gives the pull request URL,
the scope of this review, and the paths of the files described below.

**Scope.** When the scope is `full`, review every change in the pull request
(`gh pr diff <PR>`). When it is `increment`, review only the changes in the
increment diff file, reading the rest for context. Earlier commits were
reviewed already.

**Earlier findings.** The previous-findings file lists what Claude already
reported on this pull request. Do not report any of them again, and do not
contradict them.

**What is already checked, so never flag it:** spelling, Markdown formatting,
the OpenSpec file layout and scenario format (`openspec validate --strict` runs
in CI), the forbidden-words list (`scripts/check-forbidden-words.py`), and
whether every scenario has a test (checked at archive). Do not flag style or
wording preferences either. Report a finding only when a reader who acts on the
document would build the wrong thing, or when the document breaks an explicit
rule in a CLAUDE.md.

**Agent assumptions (applies to all agents and subagents):**
- All tools are functional and will work without error. Do not test tools or make exploratory calls. Make sure this is clear to every subagent that is launched.
- Only call a tool if it is required to complete the task. Every tool call should have a clear purpose.
- Give every subagent the pull request title and description, the scope, and the paths of the increment diff and the previous-findings file.

Follow these steps precisely:

1. Launch a haiku agent to return a list of file paths (not their contents) for the root CLAUDE.md and any CLAUDE.md in a directory that contains a changed file.

2. Launch 3 agents in parallel. Each returns a list of issues, each with a description, the reason, and the file and line it is about.

   Agent 1 (sonnet): consistency inside the change. Read the changed artifacts of each OpenSpec change together. Flag a decision in design.md that no spec or task carries out, a task that contradicts the design or a spec, a delta spec that contradicts the proposal, a requirement whose scenarios do not test it, and a statement in one artifact that another artifact of the same change contradicts.

   Agent 2 (sonnet): consistency with the system. For each delta spec, read the living spec it changes (`openspec/specs/<same path>/spec.md`) and the specs it names. Flag a requirement that contradicts a living requirement the change does not modify, a MODIFIED requirement that silently drops a scenario or a condition of the living one, behaviour that no requirement defines but a task or the design assumes, and a claim about external behaviour (a library, a platform, a standard) stated as fact without a source. For an archive pull request, check instead that each living spec now reads as its delta said it would.

   Agent 3 (sonnet): CLAUDE.md compliance. Audit the changes against the CLAUDE.md files from step 1, considering for each file only the CLAUDE.md files that share a path with it or its parents. Quote the exact rule for each issue.

   **Only HIGH SIGNAL issues.** If you are not certain an issue is real, do not flag it.

3. For each issue, launch parallel subagents to validate it: that it is real, that it lies within the scope, and that it is not in the previous-findings file. Use sonnet for every issue.

4. Keep only the validated issues.

5. Output a summary to the terminal. If no issues were found, post a comment with `gh pr comment` in this format and stop (for an `increment` review, name the commits covered, as given in the context file):

---

## Document review

No issues found. Checked consistency within the change, with the living specs, and with CLAUDE.md.

---

6. Otherwise post one inline comment per issue with `mcp__github_inline_comment__create_inline_comment` and `confirmed: true`: a brief description, the evidence with a link, and a suggestion block only when committing it fixes the issue entirely. Link to files with the full commit sha and a line range, e.g. `https://github.com/<owner>/<repo>/blob/<full sha>/<path>#L4-L7`. Do not post duplicates.

Use gh CLI to interact with GitHub. Do not use web fetch.
