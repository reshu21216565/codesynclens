import express, { Request, Response } from 'express';
import path from 'path';
import { GoogleGenAI } from '@google/genai';
import { orchestrator } from './src/engine/orchestrator';
import { capabilityRegistry } from './src/engine/capabilityRegistry';
import { fixVerifier } from './src/engine/fixVerifier';
import { remediationService } from './src/engine/remediationService';
import { securityValidationService } from './src/engine/securityValidationService';
import { Finding, SecurityValidationFinding } from './src/types';

// Lazy initialized Gemini client
let geminiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI | null {
  if (!geminiClient && process.env.GEMINI_API_KEY) {
    geminiClient = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return geminiClient;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));

  // 1. Health check
  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({
      status: 'ok',
      service: 'CodeLens API',
      timestamp: new Date().toISOString(),
      geminiConfigured: Boolean(process.env.GEMINI_API_KEY),
    });
  });

  // 2. Capability Registry and Provider health
  app.get('/api/capabilities', async (_req: Request, res: Response) => {
    try {
      const providers = await capabilityRegistry.getAllProvidersInfo();
      const capabilities = capabilityRegistry.getCapabilityList();
      res.json({
        providers,
        capabilities,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to retrieve capabilities' });
    }
  });

  // 3. Codebase Analysis Endpoint
  app.post('/api/analyze', async (req: Request, res: Response) => {
    try {
      const { files, projectName, mode } = req.body;
      if (!files || typeof files !== 'object' || Object.keys(files).length === 0) {
        return res.status(400).json({ error: 'No source files provided for analysis.' });
      }

      const result = await orchestrator.analyzeCodebase(
        files,
        projectName || 'project',
        mode === 'DEMO' ? 'DEMO' : 'REAL'
      );

      res.json(result);
    } catch (err: any) {
      console.error('Analysis error:', err);
      res.status(500).json({ error: err.message || 'Error occurred during code analysis.' });
    }
  });

  // 4. Gemini AI Explanation Engine (Server-side only)
  app.post('/api/explain', async (req: Request, res: Response) => {
    try {
      const { finding, contextCode } = req.body as { finding: Finding; contextCode?: string };
      if (!finding) {
        return res.status(400).json({ error: 'Finding object is required.' });
      }

      const ai = getGeminiClient();
      if (!ai) {
        // Fallback explanation grounded strictly in deterministic finding data
        return res.json({
          whyDetected: `Flagged under rule ${finding.provenance.ruleId || finding.category}: ${finding.title}`,
          whyMatters: finding.impact || 'Presents technical debt, security exposure, or potential runtime defect.',
          potentialImpact: finding.impact || 'May compromise system integrity or degrade maintainability.',
          recommendedChange: finding.recommendation || 'Refactor according to secure coding best practices.',
          exampleCode: finding.suggestedCode || null,
          aiGroundingNotice: 'Standard analyzer explanation (Gemini API key not configured in environment).',
        });
      }

      const prompt = `You are an expert developer security and code review assistant.
You are explaining an EXISTING analyzer finding.
DO NOT invent evidence.
DO NOT invent a rule ID.
DO NOT claim a scanner detected something that was not supplied.
If the evidence is insufficient, say so.

Finding Details:
- Title: ${finding.title}
- Category: ${finding.category}
- Severity: ${finding.severity}
- File: ${finding.file}:${finding.lineStart}
- Analyzer Source: ${finding.provenance.source} (${finding.provenance.ruleId || 'N/A'})
- Evidence: ${finding.evidence}
- Code Snippet:
\`\`\`
${finding.codeSnippet}
\`\`\`
${contextCode ? `Full Context Snippet:\n\`\`\`\n${contextCode}\n\`\`\`` : ''}

Respond with a JSON object strictly following this structure:
{
  "whyDetected": "1-2 clear technical sentences describing what triggered this finding",
  "whyMatters": "Clear explanation of the technical consequences and risks",
  "potentialImpact": "Specific real-world impact if deployed to production",
  "recommendedChange": "Concrete, actionable step-by-step guidance to resolve it",
  "exampleCode": "Clean, patched code snippet or null"
}`;

      const candidateModels = ['gemini-3.1-flash-lite', 'gemini-flash-latest', 'gemini-3.8-flash'];
      let responseText = '';

      for (const modelName of candidateModels) {
        try {
          const response = await ai.models.generateContent({
            model: modelName,
            contents: prompt,
            config: {
              systemInstruction: 'You are a professional code review intelligence assistant. You provide precise, mathematically and technically accurate code explanations. Return valid JSON only.',
              responseMimeType: 'application/json',
            },
          });
          if (response.text) {
            responseText = response.text;
            break;
          }
        } catch {
          // Upstream model unavailable or demand spike; smoothly try next candidate
          continue;
        }
      }
      try {
        const parsed = JSON.parse(responseText);
        return res.json(parsed);
      } catch {
        return res.json({
          whyDetected: `Triggered by ${finding.title}`,
          whyMatters: responseText,
          potentialImpact: finding.impact,
          recommendedChange: finding.recommendation,
          exampleCode: finding.suggestedCode,
        });
      }
    } catch (err: any) {
      console.error('Gemini explanation error:', err);
      res.json({
        whyDetected: `Triggered by rule ${req.body.finding?.provenance?.ruleId || 'N/A'}`,
        whyMatters: req.body.finding?.impact || 'Potential stability or security exposure.',
        potentialImpact: req.body.finding?.impact || 'Risk of runtime failure.',
        recommendedChange: req.body.finding?.recommendation || 'Apply recommended refactoring.',
        exampleCode: req.body.finding?.suggestedCode || null,
        aiGroundingNotice: 'Fallback generated due to upstream model timeout.',
      });
    }
  });

  // 5. Fix Verification Endpoint
  app.post('/api/verify', async (req: Request, res: Response) => {
    try {
      const { filePath, updatedContent, finding } = req.body;
      if (!filePath || !updatedContent || !finding) {
        return res.status(400).json({ error: 'filePath, updatedContent, and finding are required.' });
      }

      const verification = await fixVerifier.verifyFix(filePath, updatedContent, finding);
      res.json(verification);
    } catch (err: any) {
      console.error('Verification error:', err);
      res.status(500).json({ error: err.message || 'Verification process failed.' });
    }
  });

  // 6. GitHub Repository Ingestion Endpoint
  app.post('/api/github/fetch-repo', async (req: Request, res: Response) => {
    try {
      const { repoUrl, branch } = req.body;
      if (!repoUrl) {
        return res.status(400).json({ error: 'GitHub repository URL is required.' });
      }

      // Parse owner and repo name
      // e.g. https://github.com/facebook/react or github.com/owner/repo
      const match = repoUrl.match(/github\.com\/([^/]+)\/([^/]+?)(?:\.git|\/|$)/);
      if (!match) {
        return res.status(400).json({ error: 'Invalid GitHub URL format. Expected: https://github.com/owner/repo' });
      }

      const owner = match[1];
      const repo = match[2];
      const targetBranch = branch || 'main';

      // Fetch git tree from GitHub public API
      const headers: Record<string, string> = {
        'User-Agent': 'CodeLens-Review-Agent',
        'Accept': 'application/vnd.github.v3+json',
      };
      if (process.env.GITHUB_TOKEN) {
        headers['Authorization'] = `token ${process.env.GITHUB_TOKEN}`;
      }

      const treeUrl = `https://api.github.com/repos/${owner}/${repo}/git/trees/${targetBranch}?recursive=1`;
      const treeRes = await fetch(treeUrl, { headers });

      if (!treeRes.ok) {
        // Try fallback to 'master' branch if 'main' was 404
        if (treeRes.status === 404 && targetBranch === 'main') {
          const masterUrl = `https://api.github.com/repos/${owner}/${repo}/git/trees/master?recursive=1`;
          const masterRes = await fetch(masterUrl, { headers });
          if (masterRes.ok) {
            const masterData = await masterRes.json();
            return handleFetchedTree(owner, repo, 'master', masterData, res, headers);
          }
        }
        const errText = await treeRes.text();
        return res.status(treeRes.status).json({
          error: `GitHub API error (${treeRes.status}): ${treeRes.status === 403 ? 'Rate limit exceeded or repository is private. Set GITHUB_TOKEN in settings.' : 'Repository not found or branch does not exist.'}`,
          details: errText,
        });
      }

      const treeData = await treeRes.json();
      await handleFetchedTree(owner, repo, targetBranch, treeData, res, headers);
    } catch (err: any) {
      console.error('GitHub fetch error:', err);
      res.status(500).json({ error: err.message || 'Failed to fetch GitHub repository.' });
    }
  });

  async function handleFetchedTree(
    owner: string,
    repo: string,
    branch: string,
    treeData: any,
    res: Response,
    headers: Record<string, string>
  ) {
    if (!treeData.tree || !Array.isArray(treeData.tree)) {
      return res.status(400).json({ error: 'Repository tree is empty or inaccessible.' });
    }

    // Filter relevant source files (ts, js, py, go, java, json, etc. - skip binaries, images, package-locks)
    const validExtensions = ['.ts', '.tsx', '.js', '.jsx', '.py', '.go', '.java', '.json', '.sql', '.sh'];
    const candidates = treeData.tree.filter((item: any) => {
      if (item.type !== 'blob') return false;
      const p = item.path.toLowerCase();
      if (p.includes('node_modules/') || p.includes('.git/') || p.includes('dist/') || p.includes('build/')) {
        return false;
      }
      if (p.endsWith('package-lock.json') || p.endsWith('yarn.lock') || p.endsWith('bun.lock')) {
        return false;
      }
      return validExtensions.some(ext => p.endsWith(ext));
    });

    // Limit to first 25 key source files to stay performant and responsive
    const filesToFetch = candidates.slice(0, 25);
    const files: Record<string, string> = {};

    await Promise.all(
      filesToFetch.map(async (fileItem: any) => {
        try {
          const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${fileItem.path}`;
          const contentRes = await fetch(rawUrl, { headers });
          if (contentRes.ok) {
            const text = await contentRes.text();
            // Cap individual file size at 200KB
            if (text.length <= 200_000) {
              files[fileItem.path] = text;
            }
          }
        } catch {
          // ignore single file fetch failure
        }
      })
    );

    if (Object.keys(files).length === 0) {
      return res.status(400).json({
        error: 'No readable source files could be fetched from this repository branch.',
      });
    }

    res.json({
      repoName: `${owner}/${repo}`,
      repoOwner: owner,
      repoOnly: repo,
      branch,
      totalMatchedFiles: candidates.length,
      fetchedFilesCount: Object.keys(files).length,
      files,
    });
  }

  // 6b. GitHub Auto-Remediation: Generate & Validate Structured Fix
  app.post('/api/github/prepare-fix', async (req: Request, res: Response) => {
    try {
      const { finding, fileContent, allFiles, projectName, repoName } = req.body;
      if (!finding || !finding.file) {
        return res.status(400).json({ error: 'A valid finding object with file path is required.' });
      }

      const proposal = await remediationService.prepareRemediation(
        finding,
        fileContent || (allFiles && allFiles[finding.file]) || '',
        allFiles || {},
        projectName,
        repoName
      );

      res.json(proposal);
    } catch (err: any) {
      console.error('GitHub remediation prepare error:', err);
      res.status(500).json({ error: err.message || 'Failed to prepare automated code remediation.' });
    }
  });

  // 6c. GitHub Auto-Remediation: Create Real Git Branch, Commit, Push & Pull Request
  app.post('/api/github/create-fix-pr', async (req: Request, res: Response) => {
    try {
      const {
        repoOwner,
        repoName,
        baseBranch,
        branchName,
        commitMessage,
        prTitle,
        prBody,
        changes,
        finding,
      } = req.body;

      if (!repoOwner || !repoName) {
        return res.status(400).json({
          error: 'Target GitHub repository owner and repository name are required to publish a Pull Request.',
        });
      }

      if (!changes || !Array.isArray(changes) || changes.length === 0) {
        return res.status(400).json({
          error: 'At least one modified file change is required to create a commit and pull request.',
        });
      }

      if (!finding) {
        return res.status(400).json({ error: 'Finding context is required.' });
      }

      // Optional client header override (never logged or exposed)
      const overrideToken = (req.headers['x-github-token'] as string) || req.body.token || req.body.overrideToken;

      const result = await remediationService.createFixPullRequest({
        repoOwner,
        repoName,
        baseBranch,
        branchName,
        commitMessage: commitMessage || `fix(${finding.category?.toLowerCase() || 'code'}): resolve ${finding.title?.toLowerCase() || 'issue'}`,
        prTitle: prTitle || `CodeLens: Fix ${finding.title} in ${finding.file}`,
        prBody,
        changes,
        finding,
        overrideToken,
      });

      res.json(result);
    } catch (err: any) {
      console.error('GitHub PR creation error:', err);
      res.status(500).json({ error: err.message || 'Failed to create real GitHub Pull Request.' });
    }
  });

  // 6d. Check GitHub Authentication Status (Safe metadata only, no token leakage)
  app.get('/api/github/auth-status', async (req: Request, res: Response) => {
    try {
      const token = (req.headers['x-github-token'] as string) || process.env.GITHUB_TOKEN;
      if (!token) {
        return res.json({
          authenticated: false,
          hasServerToken: false,
          message: 'No GitHub token configured. Please configure GITHUB_TOKEN in your environment.',
        });
      }

      const userRes = await fetch('https://api.github.com/user', {
        headers: {
          Authorization: `token ${token.trim()}`,
          'User-Agent': 'CodeLens-AppSec-Agent',
        },
      });

      if (!userRes.ok) {
        return res.json({
          authenticated: false,
          hasServerToken: Boolean(process.env.GITHUB_TOKEN),
          message: `GitHub token rejected with status ${userRes.status}. Check permissions.`,
        });
      }

      const userData = await userRes.json();

      // Fetch user's own writable repositories so the UI can auto-populate
      let userRepos: Array<{ fullName: string; name: string; owner: string; canPush: boolean }> = [];
      try {
        const reposRes = await fetch('https://api.github.com/user/repos?sort=updated&per_page=30', {
          headers: {
            Authorization: `token ${token.trim()}`,
            'User-Agent': 'CodeLens-AppSec-Agent',
          },
        });
        if (reposRes.ok) {
          const list = await reposRes.json();
          if (Array.isArray(list)) {
            userRepos = list.map((r: any) => ({
              fullName: r.full_name,
              name: r.name,
              owner: r.owner?.login || userData.login,
              canPush: Boolean(r.permissions?.push),
            }));
          }
        }
      } catch (repoErr) {
        console.warn('Could not fetch user repos list:', repoErr);
      }

      const defaultRepo = userRepos.find((r) => r.canPush)?.fullName || `${userData.login}/codelenssy`;

      res.json({
        authenticated: true,
        hasServerToken: Boolean(process.env.GITHUB_TOKEN),
        login: userData.login,
        name: userData.name,
        avatarUrl: userData.avatar_url,
        userRepos,
        defaultRepo,
      });
    } catch (err: any) {
      res.json({
        authenticated: false,
        hasServerToken: Boolean(process.env.GITHUB_TOKEN),
        message: err.message || 'Error reaching GitHub API.',
      });
    }
  });

  // 6e. Check write permissions for a specific repository
  app.get('/api/github/check-repo-access', async (req: Request, res: Response) => {
    try {
      const owner = req.query.owner as string;
      const repo = req.query.repo as string;
      const overrideToken = (req.headers['x-github-token'] as string) || (req.query.token as string);
      const token = overrideToken || process.env.GITHUB_TOKEN;

      if (!owner || !repo) {
        return res.status(400).json({ error: 'Owner and repo parameters are required.' });
      }

      if (!token) {
        return res.json({ canPush: false, reason: 'No GitHub token configured.' });
      }

      const checkRes = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
        headers: {
          Authorization: `token ${token.trim()}`,
          'User-Agent': 'CodeLens-AppSec-Agent',
        },
      });

      if (!checkRes.ok) {
        return res.json({
          canPush: false,
          status: checkRes.status,
          reason: `Repository not accessible (${checkRes.status}). Check repository name or permissions.`,
        });
      }

      const data = await checkRes.json();
      const canPush = Boolean(data.permissions?.push);
      res.json({
        canPush,
        defaultBranch: data.default_branch || 'main',
        isFork: data.fork,
        isPrivate: data.private,
        reason: canPush
          ? 'Direct write and branch creation access confirmed.'
          : 'Read-only access. Direct push requires collaborator permissions; target your personal fork or connected repository instead.',
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to check repository access.' });
    }
  });

  // 7. Security Validation - Engine Health Check
  app.get('/api/security-validation/health', async (_req: Request, res: Response) => {
    try {
      const health = await securityValidationService.checkHealth();
      res.json(health);
    } catch (err: any) {
      res.status(500).json({
        available: false,
        message: err.message || 'Failed to check security validation health',
      });
    }
  });

function generateDefensiveMitigation(finding?: Partial<SecurityValidationFinding>) {
  const type = (finding?.type || '').toLowerCase();
  const evidence = (finding?.evidence || '').toLowerCase();
  const desc = (finding?.description || '').toLowerCase();

  if (evidence.includes('x-frame-options') || type.includes('clickjacking') || desc.includes('clickjacking')) {
    return {
      rootCause: 'The application or web server response omits the X-Frame-Options HTTP response header (and Content-Security-Policy frame-ancestors directive), permitting the site to be embedded within arbitrary <iframe> contexts.',
      impactAnalysis: 'Attackers can embed the target site inside an invisible or disguised iframe on a malicious domain to stage UI Redressing (Clickjacking), tricking authenticated users into clicking unauthorized actions.',
      defensiveMitigation: "Enforce X-Frame-Options: DENY or SAMEORIGIN across all server responses.\n\nIn Express.js:\nconst helmet = require('helmet');\napp.use(helmet.frameguard({ action: 'deny' }));\n\nIn Nginx:\nadd_header X-Frame-Options \"DENY\" always;",
      verificationGuidance: "Verify with curl:\ncurl -I http://127.0.0.1:3000/api/health | grep -i x-frame-options\nConfirm the header is returned with DENY or SAMEORIGIN.",
      aiGroundingNotice: 'Grounded in standard defensive application security standards.',
    };
  }

  if (evidence.includes('x-content-type-options') || desc.includes('mime')) {
    return {
      rootCause: 'The server does not send the X-Content-Type-Options: nosniff header, allowing browsers to perform MIME-type sniffing on responses.',
      impactAnalysis: 'Browsers may treat non-executable MIME types (e.g. image, text) as executable HTML/JavaScript, introducing script injection vectors on user-uploaded or dynamically generated content.',
      defensiveMitigation: "Enforce X-Content-Type-Options: nosniff on all responses.\n\nIn Express.js:\nconst helmet = require('helmet');\napp.use(helmet.noSniff());\n\nIn Nginx:\nadd_header X-Content-Type-Options \"nosniff\" always;",
      verificationGuidance: "Inspect response headers via curl:\ncurl -I <target_url> | grep -i x-content-type-options\nEnsure 'nosniff' is present.",
      aiGroundingNotice: 'Grounded in standard defensive application security standards.',
    };
  }

  if (evidence.includes('strict-transport-security') || desc.includes('hsts')) {
    return {
      rootCause: 'HTTP Strict Transport Security (HSTS) is not configured, allowing unencrypted HTTP connections or SSL stripping downgrades.',
      impactAnalysis: 'Users on untrusted or intercepted networks can have their communication decrypted or redirected over unencrypted HTTP, compromising session tokens and credentials.',
      defensiveMitigation: "Configure the Strict-Transport-Security header with a minimum 1-year duration and includeSubDomains.\n\nIn Express.js:\napp.use(helmet.hsts({ maxAge: 31536000, includeSubDomains: true, preload: true }));",
      verificationGuidance: "Verify response headers:\ncurl -s -D - https://<domain> -o /dev/null | grep -i strict-transport-security",
      aiGroundingNotice: 'Grounded in standard defensive application security standards.',
    };
  }

  if (evidence.includes('content-security-policy') || desc.includes('csp')) {
    return {
      rootCause: 'The application lacks a Content-Security-Policy (CSP) header to whitelist permitted sources of scripts, styles, objects, and frames.',
      impactAnalysis: 'Increases the blast radius of Cross-Site Scripting (XSS) vulnerabilities and allows unauthorized third-party data exfiltration.',
      defensiveMitigation: "Define a strict Content Security Policy limiting scripts to trusted origins or cryptographic nonces.\n\nIn Express.js:\napp.use(helmet.contentSecurityPolicy());\n\nExample Header:\nContent-Security-Policy: default-src 'self'; script-src 'self'; object-src 'none';",
      verificationGuidance: "Inspect HTTP response headers for Content-Security-Policy and test for policy enforcement.",
      aiGroundingNotice: 'Grounded in standard defensive application security standards.',
    };
  }

  if (evidence.includes('x-xss-protection')) {
    return {
      rootCause: 'The legacy X-XSS-Protection header is either missing or misconfigured in older browser environments.',
      impactAnalysis: 'In legacy browsers, missing filter controls may expose users to reflected XSS, though modern browsers rely on Content-Security-Policy.',
      defensiveMitigation: "Configure modern CSP headers or set X-XSS-Protection: 0 (or 1; mode=block for legacy audit compliance).\n\nIn Express.js:\napp.use(helmet.xssFilter());",
      verificationGuidance: "Inspect headers:\ncurl -I <target_url> | grep -i x-xss-protection",
      aiGroundingNotice: 'Grounded in standard defensive application security standards.',
    };
  }

  if (evidence.includes('unencrypted') || desc.includes('encryption') || desc.includes('https')) {
    return {
      rootCause: 'The endpoint was queried over an unencrypted plain HTTP transport connection rather than TLS/HTTPS.',
      impactAnalysis: 'All transmitted data (cookies, authorization headers, request bodies) is readable by network intermediaries and subject to Man-in-the-Middle tampering.',
      defensiveMitigation: "Deploy TLS certificates (via Let's Encrypt or reverse proxy) and enforce HTTP-to-HTTPS 301 redirection globally.",
      verificationGuidance: "Query http:// endpoint and verify it issues an immediate HTTP 301 redirect to https://.",
      aiGroundingNotice: 'Grounded in standard defensive application security standards.',
    };
  }

  return {
    rootCause: finding?.description || 'Potential security misconfiguration or exposed endpoint.',
    impactAnalysis: `Severity: ${finding?.severity || 'LOW'}. Target endpoint exhibits security finding: ${finding?.evidence || 'N/A'}.`,
    defensiveMitigation: finding?.remediation || 'Apply defensive HTTP header configurations, secure cookies, and input validation.',
    verificationGuidance: 'Re-run security validation scan to ensure the vulnerability signature is eliminated.',
    aiGroundingNotice: 'Defensive architecture guidance.',
  };
}

  // 8. Security Validation - Authorized Scan Execution
  app.post('/api/security-validation/scan', async (req: Request, res: Response) => {
    try {
      const { targetUrl, authorized, scanMode, enabledChecks, timeoutSeconds } = req.body;

      if (!authorized) {
        return res.status(400).json({
          error: 'Authorization confirmation required. You must check the authorization box confirming you are permitted to security-test this target.',
        });
      }

      if (!targetUrl || typeof targetUrl !== 'string' || !targetUrl.trim()) {
        return res.status(400).json({
          error: 'Target URL is required. Please provide a valid HTTP or HTTPS endpoint (e.g. http://127.0.0.1:3000/api/health).',
        });
      }

      // Pre-validate and normalize target URL upfront
      const urlCheck = securityValidationService.validateTargetUrl(targetUrl);
      if (!urlCheck.valid || !urlCheck.normalized) {
        return res.status(400).json({
          error: urlCheck.error || 'Invalid URL syntax. Please provide a well-formed URL (e.g. http://127.0.0.1:3000/api/health).',
        });
      }

      const result = await securityValidationService.runValidation(
        urlCheck.normalized,
        authorized,
        {
          scanMode: scanMode || 'quick',
          enabledChecks,
          timeoutSeconds: timeoutSeconds || 45,
        }
      );

      res.json(result);
    } catch (err: any) {
      res.status(400).json({
        error: err?.message || 'An error occurred during security validation execution.',
      });
    }
  });

  // 9. Security Validation - AI Technical Explanation & Defensive Mitigation
  app.post('/api/security-validation/explain', async (req: Request, res: Response) => {
    try {
      const { finding } = req.body as { finding: SecurityValidationFinding };
      if (!finding) {
        return res.status(400).json({ error: 'Finding object is required.' });
      }

      const ai = getGeminiClient();
      if (!ai) {
        return res.json(generateDefensiveMitigation(finding));
      }

      const prompt = `You are an expert application security engineer and defensive security architect.
Explain this security validation finding discovered during an authorized assessment:

Finding Type: ${finding.type}
Severity: ${finding.severity}
Target URL: ${finding.url}
Parameter: ${finding.parameter || 'N/A'}
Payload Tested: ${finding.payload || 'N/A'}
Evidence: ${finding.evidence}
Description: ${finding.description}
Standard Remediation: ${finding.remediation}

Provide actionable, purely defensive mitigation guidance for software engineers.
DO NOT provide attack payloads or exploitation tutorials.
Focus on defense-in-depth, configuration hardening, and code fixes.

Respond with valid JSON:
{
  "rootCause": "Detailed technical root cause of why this issue occurs",
  "impactAnalysis": "Realistic business & security impact (Confidentiality, Integrity, Availability)",
  "defensiveMitigation": "Concrete step-by-step developer instructions with code or configuration snippet",
  "verificationGuidance": "How the engineering team can safely verify the remediation"
}`;

      const candidateModels = ['gemini-3.1-flash-lite', 'gemini-flash-latest', 'gemini-3.8-flash'];
      let responseText = '';

      for (const modelName of candidateModels) {
        try {
          const response = await ai.models.generateContent({
            model: modelName,
            contents: prompt,
            config: {
              systemInstruction: 'You are an expert defensive security architect. Output strictly valid JSON without markdown fences.',
              responseMimeType: 'application/json',
            },
          });
          if (response.text) {
            responseText = response.text;
            break;
          }
        } catch {
          // Model temporarily unavailable or demand spike; smoothly try next candidate
          continue;
        }
      }

      if (responseText) {
        try {
          const parsed = JSON.parse(responseText);
          return res.json(parsed);
        } catch {
          // Fall through to structured domain mitigation
        }
      }

      return res.json(generateDefensiveMitigation(finding));
    } catch {
      return res.json(generateDefensiveMitigation(req.body?.finding));
    }
  });

  // 10. Security Validation - SentinelAI Context-Aware Chat Assistant
  app.post('/api/security-validation/chat', async (req: Request, res: Response) => {
    try {
      const { messages, assessment } = req.body as {
        messages: Array<{ role: 'user' | 'assistant'; content: string }>;
        assessment?: {
          targetUrl?: string;
          timestamp?: string;
          scanMode?: string;
          summary?: any;
          findings?: SecurityValidationFinding[];
          currentFinding?: SecurityValidationFinding | null;
        };
      };

      if (!assessment || !assessment.targetUrl || !Array.isArray(assessment.findings)) {
        return res.json({
          reply: 'No completed Security Validation assessment is currently available. Run a security assessment first.',
        });
      }

      const userQuestion = messages && messages.length > 0 ? messages[messages.length - 1].content : '';
      const findings = assessment.findings || [];
      const currentFinding = assessment.currentFinding;

      const ai = getGeminiClient();

      // Fallback generator when Gemini client or upstream is unavailable
      const generateLocalAssessmentReply = (query: string): string => {
        const q = query.toLowerCase();
        const critCount = findings.filter((f) => f.severity === 'CRITICAL').length;
        const highCount = findings.filter((f) => f.severity === 'HIGH').length;
        const medCount = findings.filter((f) => f.severity === 'MEDIUM').length;
        const lowCount = findings.filter((f) => f.severity === 'LOW').length;

        if (q.includes('serious') || q.includes('critical') || q.includes('most dangerous') || q.includes('severity')) {
          const highPrio = findings.filter((f) => f.severity === 'CRITICAL' || f.severity === 'HIGH');
          if (highPrio.length === 0) {
            return `In this assessment for ${assessment.targetUrl}, no Critical or High severity issues were detected. There are ${medCount} Medium and ${lowCount} Low severity findings.`;
          }
          return `Based on the latest assessment for ${assessment.targetUrl}, the most serious issues are:\n\n` +
            highPrio.map((f, i) => `${i + 1}. **[${f.severity}] ${f.type}** at \`${f.url}\`\n   • **Evidence**: ${f.evidence}\n   • **Fix**: ${f.remediation}`).join('\n\n');
        }

        if (q.includes('summary') || q.includes('summarize') || q.includes('overview')) {
          return `**Assessment Summary for ${assessment.targetUrl}**:\n` +
            `• **Total Findings**: ${findings.length}\n` +
            `• **Critical**: ${critCount}\n` +
            `• **High**: ${highCount}\n` +
            `• **Medium**: ${medCount}\n` +
            `• **Low**: ${lowCount}\n\n` +
            `Key vulnerabilities identified:\n` +
            findings.slice(0, 5).map((f) => `- **${f.type}** (${f.severity}) on \`${f.url}\``).join('\n');
        }

        if (q.includes('remediation') || q.includes('fix') || q.includes('priority') || q.includes('plan')) {
          return `**Recommended Remediation Priorities for ${assessment.targetUrl}**:\n\n` +
            findings.map((f, idx) => `**${idx + 1}. [${f.severity}] ${f.type}** (\`${f.url}\`)\n• **Problem**: ${f.description}\n• **Action**: ${f.remediation}`).join('\n\n');
        }

        if (currentFinding) {
          return `**Details for currently focused finding: ${currentFinding.type} (${currentFinding.severity})**\n\n` +
            `• **Target Endpoint**: \`${currentFinding.url}\`\n` +
            `• **Evidence**: \`${currentFinding.evidence}\`\n` +
            `• **Description**: ${currentFinding.description}\n` +
            `• **Remediation**: ${currentFinding.remediation}\n\n` +
            `*SentinelAI is synced with this finding. Let me know if you need specific configuration patches or verification steps.*`;
        }

        return `SentinelAI is synchronized with the latest Security Validation assessment for **${assessment.targetUrl}** (${findings.length} findings: ${critCount} Critical, ${highCount} High, ${medCount} Medium, ${lowCount} Low).\n\nYou can ask about specific vulnerabilities, evidence, impact, or request a prioritized remediation plan.`;
      };

      if (!ai) {
        return res.json({ reply: generateLocalAssessmentReply(userQuestion) });
      }

      // Compact structured representation of assessment to prevent token exhaustion
      const compactAssessment = {
        target: assessment.targetUrl,
        timestamp: assessment.timestamp,
        scanMode: assessment.scanMode || 'standard',
        totalFindings: findings.length,
        severityCounts: {
          critical: findings.filter((f) => f.severity === 'CRITICAL').length,
          high: findings.filter((f) => f.severity === 'HIGH').length,
          medium: findings.filter((f) => f.severity === 'MEDIUM').length,
          low: findings.filter((f) => f.severity === 'LOW').length,
        },
        currentFocusedFinding: currentFinding
          ? {
              type: currentFinding.type,
              severity: currentFinding.severity,
              url: currentFinding.url,
              evidence: currentFinding.evidence,
              description: currentFinding.description,
              remediation: currentFinding.remediation,
              parameter: currentFinding.parameter,
              payload: currentFinding.payload,
            }
          : null,
        findings: findings.slice(0, 35).map((f) => ({
          type: f.type,
          severity: f.severity,
          url: f.url,
          evidence: f.evidence,
          description: f.description,
          remediation: f.remediation,
          parameter: f.parameter || undefined,
          payload: f.payload || undefined,
        })),
      };

      const systemInstruction = `You are SentinelAI, the dedicated Security Validation Assistant inside CodeLens.
You are answering questions about the user's latest completed security assessment.
Use ONLY the supplied assessment data as factual evidence about detected vulnerabilities.
Do NOT invent findings, evidence, endpoints, severity levels, or scan results.
You may explain, summarize, correlate, and provide concrete technical remediation guidance.
Clearly distinguish scanner findings from your own explanatory reasoning.
If a finding is not in the assessment data, state clearly that it was not detected during this scan.
Never disclose internal API keys, passwords, environment variables, or private tokens.

When asked for remediation guidance on a finding:
- Explain what the problem is and why it occurs.
- Reference the actual affected endpoint and evidence from the assessment.
- Provide a concrete, defensive fix with configuration or code examples (e.g. Express/Helmet, Nginx headers, parameterized queries).
- Provide safe verification guidance (e.g. curl command).`;

      // Build conversation context
      const conversationFormatted = (messages || [])
        .slice(-6)
        .map((m) => `${m.role === 'user' ? 'User' : 'SentinelAI'}: ${m.content}`)
        .join('\n\n');

      const fullPrompt = `LATEST COMPLETED SECURITY ASSESSMENT DATA (JSON):
${JSON.stringify(compactAssessment, null, 2)}

CONVERSATION HISTORY:
${conversationFormatted}

Respond helpfully as SentinelAI to the user's latest question. Maintain technical rigor, clarity, and focus strictly on the provided assessment evidence.`;

      const candidateModels = ['gemini-3.1-flash-lite', 'gemini-flash-latest', 'gemini-3.8-flash'];
      let responseText = '';

      for (const modelName of candidateModels) {
        try {
          const response = await ai.models.generateContent({
            model: modelName,
            contents: fullPrompt,
            config: {
              systemInstruction,
              temperature: 0.2,
            },
          });
          if (response.text) {
            responseText = response.text;
            break;
          }
        } catch {
          continue;
        }
      }

      if (responseText) {
        return res.json({ reply: responseText });
      }

      // If all models hit limits or failed, return local assessment reply
      return res.json({ reply: generateLocalAssessmentReply(userQuestion) });
    } catch {
      return res.json({
        reply: 'SentinelAI is temporarily unavailable. Your security assessment is still available.',
      });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`CodeLens Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
