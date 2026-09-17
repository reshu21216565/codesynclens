# 🔍 CodeLens

**AI-Powered Code Review & Vulnerability Detection Platform**

[![Tests](https://img.shields.io/badge/tests-46%2B%20passed-brightgreen)](#)
[![Security](https://img.shields.io/badge/security-runtime%20%2B%20static-blue)](#)
[![AI](https://img.shields.io/badge/AI-Gemini-purple)](#)
[![TypeScript](https://img.shields.io/badge/TypeScript-ready-blue)](#)
[![Node.js](https://img.shields.io/badge/Node.js-backend-green)](#)
[![License](https://img.shields.io/badge/license-MIT-lightgrey)](#)

> CodeLens doesn't just find vulnerabilities — it helps developers understand, fix, validate, and verify them.

---

## 🚨 The Problem

Modern software applications are built from thousands of lines of code, third-party dependencies, APIs, authentication flows, and interconnected components.

Traditional code review and security tools often create a fragmented experience:

- Developers receive large numbers of findings without sufficient context.
- Static analysis cannot always determine how a vulnerability behaves at runtime.
- AI-generated explanations may not be backed by actual security evidence.
- Security findings are often disconnected from the code that caused them.
- Developers are told that something is vulnerable, but not given a clear path to remediation.
- After fixing a vulnerability, developers still need to manually verify whether the issue is actually resolved.
- Security testing is frequently treated as a separate process rather than part of the development lifecycle.

The result is a gap between:

`Finding a vulnerability` → `Understanding it` → `Fixing it` → `Proving it is fixed`

---

## 💡 Our Solution

**CodeLens**

CodeLens is an AI-powered developer security platform designed to close that gap.

It combines source-code intelligence, AI reasoning, runtime security validation, remediation guidance, and verification into a single workflow.

Our approach:

```text
CONNECT
   ↓
ANALYZE
   ↓
UNDERSTAND
   ↓
DETECT
   ↓
REMEDIATE
   ↓
VALIDATE
   ↓
VERIFY
   ↓
REPORT
```

Instead of simply producing a vulnerability list, CodeLens attempts to understand the application from multiple perspectives:

### 1. Source Intelligence

Analyze the actual codebase to identify:

- Security vulnerabilities
- Exposed secrets
- Bugs
- Logical issues
- Code smells
- Dead code
- Maintainability risks
- Potential security weaknesses

### 2. AI-Powered Understanding

Every important finding can be enriched with:

- Root-cause explanation
- Affected code
- Evidence
- Severity
- Confidence
- Potential impact
- Recommended remediation

### 3. Runtime Security Validation

CodeLens extends beyond static code inspection by providing a dedicated Security Validation layer for authorized running applications.

This allows security findings to be investigated against actual application behavior and runtime evidence.

### 4. Remediation

Instead of leaving developers with a vulnerability report, CodeLens provides actionable remediation guidance and supports the process of applying fixes.

### 5. Verification

After remediation, the application can be analyzed again to determine whether the original issue has actually been resolved.

This creates a crucial distinction:

`FIXED ≠ VERIFIED`

A vulnerability should not simply be marked as fixed because code was changed.

It should be re-analyzed and validated.

---

## ⭐ What Makes CodeLens Different?

### 1. From Detection to Verification

Most security workflows stop at:

**"Vulnerability Found"**

CodeLens is designed around:

```text
Vulnerability Found
        ↓
Why does it exist?
        ↓
How can it be fixed?
        ↓
Was the fix applied?
        ↓
Is the vulnerability actually gone?
        ↓
Did the fix introduce another problem?
```

This creates a closed-loop security workflow rather than a one-time scan.

### 2. Static + Runtime Security

CodeLens combines two complementary perspectives:

**Static Analysis**
"What does the source code tell us?"

**Runtime Validation**
"How does the application actually behave?"

Combining both creates a stronger foundation for security assessment than relying exclusively on either source inspection or AI reasoning.

### 3. Evidence-Backed AI

AI is not treated as the vulnerability scanner itself.

CodeLens separates:

`Detection & Evidence` from `AI Explanation & Reasoning`

This is important because an AI model should not simply invent a vulnerability and present it as a confirmed security issue.

The platform is designed to ground explanations in actual findings, source evidence, and runtime assessment results.

---

## 🧠 Core Features

### 🔎 Intelligent Code Analysis

Analyze repositories and source code to detect:

- Security issues
- Bugs
- Secrets
- Logic problems
- Code smells
- Dead code
- Maintainability issues

### 🛡️ Security Validation

A dedicated security assessment workflow for authorized running applications.

Features include:

- Target-based security validation
- Runtime vulnerability discovery
- Evidence collection
- Severity classification
- Security findings dashboard
- Security assessment history
- Detailed vulnerability information

### 🤖 AI Root-Cause Analysis

Use AI to transform technical findings into developer-friendly explanations.

For every finding:

- **WHAT** happened?
- **WHY** did it happen?
- **WHERE** is it happening?
- **WHAT** is the impact?
- **HOW** should it be fixed?

### 🛠️ Intelligent Remediation

CodeLens can provide actionable remediation guidance and assist developers in understanding the changes required to address a vulnerability.

The goal is to move from:

`Finding → Developer figures out the rest`

to:

`Finding → Explanation → Remediation → Verification`

### 🔄 Verified Remediation

One of the core ideas behind CodeLens is the concept of Verified Remediation.

A security issue progresses through states such as:

```text
OPEN
  ↓
FIXED
  ↓
RE-ANALYZED
  ↓
VERIFIED
```

This allows the system to distinguish between:

*"The developer changed the code."*

and

*"The security issue has been independently re-validated."*

The long-term goal is to make remediation measurable rather than assumed.

### 🧩 SentinelAI - Security Assessment Assistant

CodeLens includes a dedicated AI security assistant called SentinelAI.

SentinelAI is designed to operate on the context of the latest security assessment.

Developers can ask questions such as:

- What is the most critical issue?
- Explain this vulnerability.
- Why is this vulnerability dangerous?
- What part of the application is affected?
- How should I remediate this?
- What evidence supports this finding?
- What could happen if this remains unresolved?
- Explain this finding in simple terms.
- What should I fix first?

The assistant is grounded in the assessment context rather than acting as an independent source of vulnerability claims.

### 📄 Security Assessment Reports

CodeLens can generate a professional security assessment report containing:

- Assessment information
- Target information
- Executive summary
- Vulnerability statistics
- Severity distribution
- Detailed findings
- Evidence
- Impact
- Remediation guidance
- Verification status
- Assessment timestamps

This makes the output useful not only for developers but also for security teams, reviewers, and project stakeholders.

### 📊 Developer-Centric Findings

Each finding is designed to provide actionable context rather than just a vulnerability name.

A typical finding contains:

- Severity
- Rule / Finding ID
- Confidence
- File / Endpoint
- Line / Location
- Evidence
- Root Cause
- Impact
- Recommendation
- Status
- Verification

This reduces the gap between security analysis and actual development work.

---

## 🏗️ Architecture

```text
                    ┌──────────────────────┐
                    │      CodeLens UI     │
                    └──────────┬───────────┘
                               │
              ┌────────────────┴────────────────┐
              │                                 │
       Source Analysis                  Security Validation
              │                                 │
              ▼                                 ▼
     ┌─────────────────┐              ┌──────────────────┐
     │ Code Intelligence│              │ Runtime Security │
     │ Engine           │              │ Assessment Engine│
     └────────┬────────┘              └────────┬─────────┘
              │                                 │
              └────────────────┬────────────────┘
                               ▼
                     ┌─────────────────────┐
                     │ Finding Normalizer  │
                     │ & Evidence Layer    │
                     └──────────┬──────────┘
                                │
                    ┌───────────┴───────────┐
                    ▼                       ▼
             ┌─────────────┐        ┌─────────────┐
             │ AI Reasoning│        │ Verification│
             │ & Explain   │        │ & Re-analysis│
             └──────┬──────┘        └──────┬──────┘
                    │                       │
                    └───────────┬───────────┘
                                ▼
                     ┌─────────────────────┐
                     │ Security Dashboard  │
                     │ + SentinelAI         │
                     │ + PDF Reports        │
                     └─────────────────────┘
```

---

## 🔐 Security-First Design

Security tools themselves must be designed responsibly.

CodeLens follows an authorization-first approach for runtime validation.

Runtime security testing should only be performed against applications and environments where the user has explicit authorization to test.

The architecture is designed to keep security validation isolated from normal source analysis and to avoid treating AI-generated output as verified security evidence.

---

## 🚀 Future Roadmap

CodeLens is designed as a foundation for a much larger developer security platform.

**Phase 1 — Intelligent Detection**
- Multi-language source analysis
- Vulnerability detection
- Secret detection
- Bug detection
- Code quality analysis
- AI explanations

**Phase 2 — Security Validation**
- Runtime application testing
- API security validation
- Authentication-flow testing
- OpenAPI analysis
- Security regression testing

**Phase 3 — Verified Remediation**
```text
Detect
  ↓
Explain
  ↓
Generate Fix
  ↓
Apply Fix
  ↓
Re-scan
  ↓
Runtime Validation
  ↓
Verify
```

**Phase 4 — Security Intelligence**
Future versions can introduce:
- Attack-path correlation
- Vulnerability relationship graphs
- Dependency/CVE intelligence
- Supply-chain risk analysis
- Security posture tracking
- Commit-to-commit security comparison
- Historical vulnerability trends
- Automated regression detection

**Phase 5 — Developer Security Infrastructure**
Long-term integrations can include:
- GitHub Pull Request security reviews
- CI/CD security gates
- Automated security checks before deployment
- Team security dashboards
- Security policies
- Compliance mapping
- Automated remediation workflows
- Continuous application security monitoring

---

## 🧪 Testing & Validation

CodeLens has been tested across multiple analysis and security-validation scenarios.

**Current Validation**
> 46+ tests validated

The test suite and validation process cover areas including:

- Source ingestion
- Repository analysis
- Finding generation
- Severity handling
- Security detection
- Runtime validation
- Finding normalization
- AI explanations
- Remediation workflows
- Verification flows
- Error handling
- API behavior
- UI states

*The test count should be updated whenever the validation suite changes.*

---

## 🏆 Why CodeLens?

**Traditional approach:**
```text
Scan
 ↓
Large list of vulnerabilities
 ↓
Developer manually investigates
 ↓
Developer manually fixes
 ↓
Developer manually tests again
```

**CodeLens vision:**
```text
Connect
 ↓
Analyze
 ↓
Understand
 ↓
Detect
 ↓
Remediate
 ↓
Validate
 ↓
Verify
 ↓
Report
```

The fundamental idea is simple:

> "Security should not end when a vulnerability is detected."

It should end when the developer has enough evidence to understand the vulnerability, remediate it, and verify that the risk has actually been addressed.

---

## 🎯 Our Vision

CodeLens aims to evolve from an AI code-review tool into an intelligent Application Security Lifecycle Platform.

Our long-term vision is to create a system that understands the relationship between:

```text
CODE
  ↕
VULNERABILITY
  ↕
RUNTIME BEHAVIOR
  ↕
EVIDENCE
  ↕
REMEDIATION
  ↕
VERIFICATION
```

This enables developers to move from reactive vulnerability discovery toward continuous, evidence-driven application security.

---

## 👥 Built For

CodeLens is designed for:
- Developers
- Security engineers
- Software teams
- Startups
- Hackathon teams
- DevSecOps teams
- Application security teams
- Organizations building security-sensitive applications

---

## ⚙️ Technology Stack

- **Frontend**: React + TypeScript
- **Backend**: Node.js + Express
- **AI**: Gemini
- **Source Analysis**: Code intelligence and analysis engines
- **Runtime Security**: Dedicated security validation engine
- **Repository Integration**: GitHub
- **Development**: Vite
- **Reporting**: Structured PDF security reports

---

## 🛣️ Long-Term Vision

CodeLens is not intended to be just another vulnerability scanner.

The vision is to create an intelligent security layer that follows software throughout its lifecycle:

```text
Developer Writes Code
        ↓
CodeLens Reviews It
        ↓
Vulnerability Detected
        ↓
AI Explains The Risk
        ↓
Developer Applies Fix
        ↓
CodeLens Re-analyzes
        ↓
Application Is Runtime Validated
        ↓
Fix Is Verified
        ↓
Security Report Generated
        ↓
Continuous Security Monitoring
```

**Detect less blindly.**
**Understand more deeply.**
**Fix intelligently.**
**Verify everything.**

*CodeLens — See the Risk. Understand the Code. Prove the Fix.*
