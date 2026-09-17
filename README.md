# AI Code Review & Vulnerability Detection Agent

An AI-powered code review assistant that analyzes source code, identifies bugs, security vulnerabilities, and code smells, explains each issue in plain language, suggests fixes — and **verifies that the fix actually works** before it's proposed.

---

## Problem Statement

Developers spend significant time manually reviewing source code for bugs, security vulnerabilities, and maintainability issues. This project builds an AI-powered code review assistant that automates that process end-to-end.

**Domain:** Software Engineering
**Technology:** LLM, Static Analysis, NLP

---

## What Makes This Different

Most AI code review tools — including well-known ones like GitHub Copilot Autofix, and smaller open-source tools like OpenHands Resolver, FixO Dev, and Mr. Code Fixer — generate a fix and stop there. The developer has to trust that the AI's suggestion is correct.

**This project closes that gap.** For every fix it proposes, the tool:
1. Runs the original code and captures the failure (crash, wrong output, vulnerability trigger)
2. Applies the AI-generated fix
3. Re-runs the code with the same inputs
4. Shows a verified before/after result directly alongside the fix — proof, not just a promise

This is referred to throughout the project as **execution-verified fixing**.

---

## Features

| Requirement | How it's implemented |
|---|---|
| Source code input | Paste code or connect a GitHub repository |
| Bug detection | LLM-based logic analysis |
| Security issue detection | Static analysis engine (Bandit / Semgrep) + LLM cross-check |
| Code smell detection | LLM-based quality analysis (duplication, complexity, naming) |
| Severity classification | Rule-based table, upgradeable to an impact × likelihood matrix |
| Explanation of issues | Plain-language reasoning generated per issue |
| Suggested improvements | AI-generated fix with before/after diff |
| **Verification (differentiator)** | Sandboxed re-execution of code before and after the fix |

---

## Architecture

```
Source code
    │
    ├──► Static Analysis Layer (Bandit / Semgrep)
    │         → known vulnerability & quality patterns
    │
    ├──► LLM Layer (Claude / GPT)
    │         → logic bugs, explanations, fix generation
    │
    ├──► Verification Layer
    │         → sandboxed execution before & after fix
    │         → confirms the fix resolves the issue
    │
    └──► Merge, Dedupe & Rank Layer
              → combines findings, assigns severity, sorts by risk

              ▼
        Report / UI (issue list, explanation, fix, verified result)
```

---

## Tech Stack

- **Frontend:** Streamlit
- **Backend:** Python (FastAPI, if scaling beyond a single-page app)
- **Static Analysis:** Bandit (security), Pylint/Flake8 (quality), Semgrep (optional, multi-language)
- **AI Model:** Claude / GPT via API
- **Execution Sandbox:** Python `subprocess` with timeout and restricted temp directory
- **GitHub Integration:** PyGithub / GitHub REST API (branch → commit → pull request)

---

## Severity Classification

Each issue is assigned a severity so the most urgent problems surface first:

| Severity | Examples |
|---|---|
| Critical | Hardcoded secrets, SQL injection, remote code execution |
| High | Crashes, unhandled exceptions, auth bypass |
| Medium | Weak input validation, missing error handling |
| Low | Code smells, style issues, unused imports |

---

## How It Works (Pipeline)

1. **Input** — user pastes code or points to a GitHub repo
2. **Static scan** — Bandit/Semgrep runs and returns known issues
3. **AI review** — the code is sent to the LLM with a structured prompt, returning bugs, smells, explanations, and fixes as JSON
4. **Merge & dedupe** — overlapping findings from both layers are combined
5. **Verify** — original code is executed in a sandbox, the fix is applied, and the code is executed again to confirm resolution
6. **Report** — results are displayed with severity, explanation, fix, and verification status
7. **(Optional) GitHub PR** — a new branch is created, the fix is committed, and a pull request is opened with the AI's explanation and verification result in the PR description — never pushed directly to `main`

---

## Example Output

```json
{
  "file": "auth.py",
  "line": 42,
  "type": "security",
  "cwe": "CWE-89",
  "title": "SQL injection via string concatenation",
  "severity": "Critical",
  "explanation": "User input from `username` is inserted directly into the query string, allowing an attacker to bypass authentication.",
  "suggested_fix": "cursor.execute('SELECT * FROM users WHERE name = ?', (username,))",
  "verification": {
    "before": "Query succeeded with malicious input — authentication bypassed",
    "after": "Query safely parameterized — malicious input rejected",
    "status": "Verified Fixed"
  },
  "confidence": 0.93
}
```

---

## Roadmap

- [ ] Code input + static analysis (Bandit) integration
- [ ] LLM-based bug and code smell detection
- [ ] Severity classification and issue merging/dedup
- [ ] Execution sandbox for before/after verification
- [ ] GitHub branch → commit → pull request automation
- [ ] Dashboard view for repo-wide scanning
- [ ] Test coverage overlap signal (flag bugs in untested code paths)

---

## Comparable Tools (Prior Art)

This project builds on ideas already proven — in part — by existing tools, while adding execution-verified fixing, which none of them currently offer:

- **GitHub Copilot Autofix** — mainstream, relies on CI passing rather than immediate verification
- **OpenHands GitHub Resolver** — open-source coding agent, fixes issues tagged in a repo
- **FixO Dev Bot** — mention-triggered AI fix bot, opens PRs automatically
- **Mr. Code Fixer** — autonomous CLI bot that scans issues and opens PRs after running tests
- **Trevyn** — PR-review bot with one-click "apply fix" commits

---

## Disclaimer

This tool assists human reviewers — it does not replace them. AI-generated fixes and static analysis findings may include false positives or miss context-specific issues. All fixes are opened as pull requests for human review, never pushed directly to a production branch.

---

## License

Add your chosen license here (e.g., MIT).
