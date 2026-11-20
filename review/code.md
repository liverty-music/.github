<!--
Adapted from the `code-review` command of anthropics/claude-plugins-official
(plugins/code-review/commands/code-review.md), Copyright Anthropic, Apache
License 2.0. Changes: the review covers the scope the workflow chose (the whole
pull request, or only the commits pushed since the last review); the
eligibility check is done by the workflow before this runs; Claude's earlier
findings are read from a file the workflow writes, because `gh pr view
--comments` does not list inline review comments; the review subagents are
required, not optional (without that wording, Claude 5.5 models reviewed alone
and launched none); the bug agents read the surrounding code and may report a
bug that needs a particular state to occur; certainty is decided by the
validation step, not by silence at the finding step; the plugin's agent that
lists the CLAUDE.md files and its summary agent are dropped and its two
CLAUDE.md agents are one, so the review agents start at once (each stage ran in
sequence and added to the review time).
-->

Provide a code review for a pull request. The workflow has written everything
you need to know about this run to `.review-kit/run/context.md`: read it first.
It gives the pull request URL, the scope of this review, and the paths of the
files described below.

**Scope.** When the scope is `full`, review every change in the pull request
(`gh pr diff <PR>`). When it is `increment`, review only the changes in the
increment diff file: the commits pushed since Claude last reviewed this pull
request. Read the whole pull request diff for context, but flag only problems
that the increment introduces or makes wrong. Earlier commits were reviewed
already.

**Earlier findings.** The previous-findings file lists what Claude already
reported on this pull request. Do not report any of them again, and do not
contradict them. If the increment fixes one, say nothing about it.

**Agent assumptions (applies to all agents and subagents):**
- All tools are functional and will work without error. Do not test tools or make exploratory calls. Make sure this is clear to every subagent that is launched.
- Only call a tool if it is required to complete the task. Every tool call should have a clear purpose.
- Give every subagent the pull request title and description, the scope, and the paths of the increment diff and the previous-findings file.

**The subagents are required.** Steps 1 and 2 below launch subagents. You must
launch them, even when the change looks small or you have already read all of
it. Do not review the diff yourself in place of the review agents. When step 1
returns candidate issues, do not end the run before the validation subagents of
step 2 have reported; when it returns none, there is nothing to validate and you
go on to step 4. A run in which the agents of step 1 were not launched is a
failed run. Launch the agents of one step in a single message so that they run
in parallel.

To do this, follow these steps precisely:

1. Launch 3 sonnet agents in parallel, in a single message, to independently review the changes in scope. Each agent should return the list of issues, where each issue includes a description and the reason it was flagged (e.g. "CLAUDE.md adherence", "bug"). The agents should do the following:

   Agent 1: CLAUDE.md compliance agent
   Find the relevant CLAUDE.md files: the root CLAUDE.md, if it exists, and any CLAUDE.md in a directory that contains a file changed in scope (or in one of its parents). Audit the changes against them. When evaluating CLAUDE.md compliance for a file, consider only the CLAUDE.md files that share a file path with the file or its parents. Quote the exact rule for each issue.

   Agent 2: bug agent, the code and its contract
   Read the changed code, then read what it touches: the callers, the callees, the types and the specs or documents that state its contract. Look for code that does the wrong thing: logic errors, wrong or lost error codes, a missing nil or empty case, a wrong order of operations, an unchecked precondition, a security or data-integrity problem. Report the file and line and the concrete scenario in which it goes wrong.

   Agent 3: bug agent, production conditions
   Look at the changed code under the conditions that production brings and tests rarely cover: a retried or redelivered message, two requests at once, a dependency that is down or slow, the first use with empty or cold state, stale cached state, a partial failure halfway through, a rollback or a re-run. Also check that the change keeps the contract of everything it replaces or renames (the old behaviour, error codes, locking order, ordering of side effects). Report the file and line and the concrete scenario in which it goes wrong.

   **What to report.** Report a finding when you can describe a concrete scenario (an input, or a state that can occur in production) in which the changed code goes wrong, and name the code path that leads there. A bug that shows only in some states, such as a retry, a race, a failed dependency or the first open, counts. Also report:
   - Code that will fail to compile or parse (syntax errors, type errors, missing imports, unresolved references)
   - Clear, unambiguous CLAUDE.md violations where you can quote the exact rule being broken

   You do not need to be certain: the validation step that follows decides. A finding without a concrete scenario is a guess; leave it out.

   Do NOT flag:
   - Code style or quality concerns
   - Subjective suggestions or improvements
   - Anything listed in the previous-findings file

   In addition to the above, each subagent should be told the pull request title and description. This will help provide context regarding the author's intent.

2. Merge the issues that two agents reported for the same cause. Then, for each remaining issue, launch one sonnet subagent to validate it; launch all of them in a single message. These subagents should get the PR title and description along with a description of the issue. The agent's job is to follow the stated scenario through the code and decide whether it can really happen, and that the issue lies within the scope. Keep the issue when the scenario can occur and the code does not already handle it; reject it when the scenario is impossible, is handled elsewhere (cite where), or is outside the scope. For example, if an issue such as "variable is not defined" was flagged, the subagent's job would be to validate that is actually true in the code. Another example would be CLAUDE.md issues. The agent should validate that the CLAUDE.md rule that was violated is scoped for this file and is actually violated.

3. Filter out any issues that were not validated in step 2. This step will give us our list of high signal issues for our review.

4. Output a summary of the review findings to the terminal:
   - If issues were found, list each issue with a brief description.
   - If no issues were found, state: "No issues found. Checked for bugs and CLAUDE.md compliance."

   If no issues were found, post a summary comment using `gh pr comment` and stop. For an `increment` review, say which commits it covered (the range in the context file).

   If issues were found, continue to step 5.

5. Create a list of all comments that you plan on leaving. This is only for you to make sure you are comfortable with the comments. Do not post this list anywhere.

6. Post inline comments for each issue using `mcp__github_inline_comment__create_inline_comment` with `confirmed: true`. For each comment:
   - Provide a brief description of the issue
   - For small, self-contained fixes, include a committable suggestion block
   - For larger fixes (6+ lines, structural changes, or changes spanning multiple locations), describe the issue and suggested fix without a suggestion block
   - Never post a committable suggestion UNLESS committing the suggestion fixes the issue entirely. If follow up steps are required, do not leave a committable suggestion.

   **IMPORTANT: Only post ONE comment per unique issue. Do not post duplicate comments.**

Use this list when evaluating issues in Steps 1 and 2 (these are false positives, do NOT flag):

- Pre-existing issues, including anything outside the scope of this review
- Something that appears to be a bug but is actually correct
- Pedantic nitpicks that a senior engineer would not flag
- Issues that a linter will catch (do not run the linter to verify)
- General code quality concerns (e.g., lack of test coverage, general security issues) unless explicitly required in CLAUDE.md
- Issues mentioned in CLAUDE.md but explicitly silenced in the code (e.g., via a lint ignore comment)

Notes:

- Use gh CLI to interact with GitHub (e.g., fetch pull requests, create comments). Do not use web fetch.
- Create a todo list before starting.
- You must cite and link each issue in inline comments (e.g., if referring to a CLAUDE.md, include a link to it).
- If no issues are found, post a comment with the following format:

---

## Code review

No issues found. Checked for bugs and CLAUDE.md compliance.

---

- When linking to code in inline comments, follow the following format precisely, otherwise the Markdown preview won't render correctly: https://github.com/anthropics/claude-code/blob/c21d3c10bc8e898b7ac1a2d745bdc9bc4e423afe/package.json#L10-L15
  - Requires full git sha
  - You must provide the full sha. Commands like `https://github.com/owner/repo/blob/$(git rev-parse HEAD)/foo/bar` will not work, since your comment will be directly rendered in Markdown.
  - Repo name must match the repo you're code reviewing
  - # sign after the file name
  - Line range format is L[start]-L[end]
  - Provide at least 1 line of context before and after, centered on the line you are commenting about (eg. if you are commenting about lines 5-6, you should link to `L4-7`)
