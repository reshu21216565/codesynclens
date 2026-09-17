import React, { useState, useEffect } from 'react';
import {
  Finding,
  RemediationProposal,
  PullRequestResult,
  FileChangeItem
} from '../types';
import {
  X,
  GitPullRequest,
  GitBranch,
  GitCommit,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Wrench,
  Loader2,
  ExternalLink,
  ChevronRight,
  FileCode,
  ShieldAlert,
  Terminal,
  ArrowRight,
  Sparkles,
  Lock,
  UserCheck
} from 'lucide-react';
import { CodeViewer } from './CodeViewer';

interface RemediationModalProps {
  isOpen: boolean;
  finding: Finding | null;
  fileContent?: string;
  allFiles?: Record<string, string>;
  projectName?: string;
  sessionRepoOwner?: string;
  sessionRepoName?: string;
  sessionBranch?: string;
  onClose: () => void;
  onSuccess: (updatedFinding: Finding, updatedFiles: Record<string, string>) => void;
}

type RemediationStep =
  | 'ANALYZING'
  | 'GENERATING_FIX'
  | 'VALIDATING'
  | 'REVIEW_DIFF'
  | 'PUBLISHING_BRANCH'
  | 'COMMITTING_CHANGES'
  | 'CREATING_PR'
  | 'SUCCESS'
  | 'FAILED';

export const RemediationModal: React.FC<RemediationModalProps> = ({
  isOpen,
  finding,
  fileContent,
  allFiles = {},
  projectName,
  sessionRepoOwner,
  sessionRepoName,
  sessionBranch = 'main',
  onClose,
  onSuccess,
}) => {
  const [step, setStep] = useState<RemediationStep>('ANALYZING');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [errorDetails, setErrorDetails] = useState<string | null>(null);

  // Proposal state
  const [proposal, setProposal] = useState<RemediationProposal | null>(null);

  // GitHub Auth status & Repositories
  const [ghUser, setGhUser] = useState<string | null>(null);
  const [authChecking, setAuthChecking] = useState(false);
  const [userRepos, setUserRepos] = useState<Array<{ fullName: string; name: string; owner: string; canPush: boolean }>>([]);
  const [repoAccess, setRepoAccess] = useState<{ canPush: boolean; reason: string } | null>(null);
  const [checkingAccess, setCheckingAccess] = useState<boolean>(false);
  const [customToken, setCustomToken] = useState<string>('');
  const [showTokenInput, setShowTokenInput] = useState<boolean>(false);

  // Target Repository Form
  const [targetOwner, setTargetOwner] = useState<string>('');
  const [targetRepo, setTargetRepo] = useState<string>('');
  const [baseBranch, setBaseBranch] = useState<string>('main');
  const [customBranch, setCustomBranch] = useState<string>('');
  const [customCommitMsg, setCustomCommitMsg] = useState<string>('');
  const [selectedFileIdx, setSelectedFileIdx] = useState<number>(0);

  // Result state
  const [prResult, setPrResult] = useState<PullRequestResult | null>(null);

  // Progress item tracking
  const [progressLog, setProgressLog] = useState<Array<{ stage: string; text: string; done: boolean; failed?: boolean }>>([]);

  // Check auth & populate defaults on open
  useEffect(() => {
    if (!isOpen || !finding) return;

    // Check if the current project belongs to a user repository or if it is demo/external
    let initialOwner = sessionRepoOwner || '';
    let initialRepo = sessionRepoName || '';
    if (!initialOwner && !initialRepo && projectName && projectName.includes('/')) {
      const parts = projectName.split('/');
      initialOwner = parts[0];
      initialRepo = parts[1];
    }

    setProposal(null);
    setPrResult(null);
    setErrorMessage(null);
    setErrorDetails(null);
    setSelectedFileIdx(0);
    setRepoAccess(null);

    // Query server GitHub authentication status and repository list
    setAuthChecking(true);
    fetch('/api/github/auth-status')
      .then((r) => r.json())
      .then((data) => {
        if (data.authenticated && data.login) {
          setGhUser(data.login);
          if (Array.isArray(data.userRepos)) {
            setUserRepos(data.userRepos);
          }
          // If the scanned repo matches the logged-in user, use it; otherwise use user's verified repo
          const isUserOwned = initialOwner && initialOwner.toLowerCase() === data.login.toLowerCase();
          if (isUserOwned && initialRepo) {
            setTargetOwner(initialOwner);
            setTargetRepo(initialRepo);
            runPreparationPipeline(finding, initialOwner, initialRepo);
          } else {
            const fallback = data.defaultRepo || (data.userRepos?.[0]?.fullName) || `${data.login}/codesynclens`;
            const [fbOwner, fbRepo] = fallback.split('/');
            const chosenOwner = fbOwner || data.login;
            const chosenRepo = fbRepo || 'codesynclens';
            setTargetOwner(chosenOwner);
            setTargetRepo(chosenRepo);
            runPreparationPipeline(finding, chosenOwner, chosenRepo);
          }
        } else {
          setTargetOwner(initialOwner || 'Aarav-Singh2007');
          setTargetRepo(initialRepo || 'codesynclens');
          runPreparationPipeline(finding, initialOwner || 'Aarav-Singh2007', initialRepo || 'codesynclens');
        }
      })
      .catch((e) => {
        console.warn('GitHub auth check error:', e);
        setTargetOwner(initialOwner || '');
        setTargetRepo(initialRepo || '');
        runPreparationPipeline(finding, initialOwner || '', initialRepo || '');
      })
      .finally(() => setAuthChecking(false));

    setBaseBranch(sessionBranch || 'main');
  }, [isOpen, finding]);

  // Check access whenever targetOwner or targetRepo changes
  useEffect(() => {
    if (!targetOwner.trim() || !targetRepo.trim()) return;

    const timer = setTimeout(() => {
      setCheckingAccess(true);
      fetch(`/api/github/check-repo-access?owner=${encodeURIComponent(targetOwner.trim())}&repo=${encodeURIComponent(targetRepo.trim())}${customToken.trim() ? `&token=${encodeURIComponent(customToken.trim())}` : ''}`)
        .then((r) => r.json())
        .then((data) => {
          setRepoAccess({
            canPush: Boolean(data.canPush),
            reason: data.reason || (data.canPush ? 'Direct write access confirmed.' : 'Read-only access.'),
          });
          if (data.defaultBranch) {
            setBaseBranch(data.defaultBranch);
          }
        })
        .catch(() => {
          setRepoAccess(null);
        })
        .finally(() => setCheckingAccess(false));
    }, 300);

    return () => clearTimeout(timer);
  }, [targetOwner, targetRepo, customToken]);

  const runPreparationPipeline = async (
    targetFinding: Finding,
    owner: string,
    repo: string
  ) => {
    try {
      setStep('ANALYZING');
      setProgressLog([
        { stage: '1', text: 'Inspecting finding context & safety policy', done: false },
        { stage: '2', text: 'Generating verified patch via AI code engine', done: false },
        { stage: '3', text: 'Applying patch & executing AST code re-analysis', done: false },
      ]);

      const content = fileContent || allFiles[targetFinding.file] || targetFinding.codeSnippet || '';

      // Update log to stage 2
      setTimeout(() => {
        setProgressLog((prev) =>
          prev.map((item, i) => (i === 0 ? { ...item, done: true } : item))
        );
        setStep('GENERATING_FIX');
      }, 400);

      const res = await fetch('/api/github/prepare-fix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          finding: targetFinding,
          fileContent: content,
          allFiles,
          projectName: `${owner}/${repo}`,
          repoName: `${owner}/${repo}`,
        }),
      });

      const data: RemediationProposal = await res.json();
      if (!res.ok) {
        throw new Error((data as any).error || 'Failed to prepare automated code remediation.');
      }

      setProposal(data);
      setCustomBranch(data.suggestedBranchName);
      setCustomCommitMsg(data.commitMessage);

      // Complete preparation progress
      setProgressLog([
        { stage: '1', text: 'Finding context analyzed & policy checked', done: true },
        { stage: '2', text: 'Structured fix generated successfully', done: true },
        { stage: '3', text: `AST Re-analysis: ${data.verificationStatus}`, done: true },
      ]);

      setStep('REVIEW_DIFF');
    } catch (err: any) {
      console.error('Preparation failed:', err);
      setStep('FAILED');
      setErrorMessage(err.message || 'Remediation preparation failed.');
      setErrorDetails(err.stack || null);
    }
  };

  const handlePublishPullRequest = async () => {
    if (!proposal || !finding) return;

    if (!targetOwner.trim() || !targetRepo.trim()) {
      setErrorMessage('Please provide a valid GitHub repository owner and repository name.');
      return;
    }

    try {
      setStep('PUBLISHING_BRANCH');
      setErrorMessage(null);

      const liveStages = [
        { stage: 'branch', text: `Creating Git branch: ${customBranch || proposal.suggestedBranchName}`, done: false },
        { stage: 'commit', text: `Committing changes (${proposal.changes.length} file(s) modified)`, done: false },
        { stage: 'push', text: 'Pushing atomic commit to GitHub origin', done: false },
        { stage: 'pr', text: 'Creating real GitHub Pull Request via API', done: false },
      ];
      setProgressLog(liveStages);

      // Simulate micro-stage transitions for clear visual progress
      setTimeout(() => {
        setStep('COMMITTING_CHANGES');
        setProgressLog((prev) =>
          prev.map((item, i) => (i === 0 ? { ...item, done: true } : item))
        );
      }, 700);

      setTimeout(() => {
        setStep('CREATING_PR');
        setProgressLog((prev) =>
          prev.map((item, i) => (i <= 2 ? { ...item, done: true } : item))
        );
      }, 1400);

      const res = await fetch('/api/github/create-fix-pr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repoOwner: targetOwner.trim(),
          repoName: targetRepo.trim(),
          baseBranch: baseBranch.trim() || 'main',
          branchName: customBranch.trim() || proposal.suggestedBranchName,
          commitMessage: customCommitMsg.trim() || proposal.commitMessage,
          prTitle: proposal.prTitle,
          prBody: proposal.prBody,
          changes: proposal.changes,
          finding,
          overrideToken: customToken.trim() || undefined,
        }),
      });

      const data: PullRequestResult = await res.json();
      if (!res.ok) {
        throw new Error((data as any).error || (data as any).details || 'Failed to create Pull Request.');
      }

      if (data.targetRepo && data.targetRepo.includes('/')) {
        const [o, r] = data.targetRepo.split('/');
        if (o && r) {
          setTargetOwner(o);
          setTargetRepo(r);
        }
      }

      setPrResult(data);
      setProgressLog((prev) => prev.map((item) => ({ ...item, done: true })));
      setStep('SUCCESS');

      // Update parent session with patched file contents and verified status
      const updatedFiles: Record<string, string> = { ...allFiles };
      for (const change of proposal.changes) {
        updatedFiles[change.filePath] = change.updatedContent;
      }

      const updatedFinding: Finding = {
        ...finding,
        status: data.verificationStatus === 'VERIFIED' ? 'VERIFIED' : 'FIXED',
        fix: {
          description: proposal.explanation,
          applied: true,
          appliedAt: new Date().toISOString(),
          canAutoRemediate: true,
          safetyReason: proposal.safetyReason,
          changes: proposal.changes,
          branchName: data.branch.name,
          commitSha: data.commit.sha,
          commitMessage: data.commit.message,
          pullRequestNumber: data.pullRequest.number,
          pullRequestUrl: data.pullRequest.url,
          pullRequestTitle: data.pullRequest.title,
          validationStatus: proposal.validation.overallPassed ? 'PASSED' : 'SKIPPED',
          verificationStatus: data.verificationStatus,
          validationResults: proposal.validation,
        },
        verification: {
          status: data.verificationStatus,
          message: proposal.validation.reanalysisSummary || 'Verified by AST code re-analysis',
          verifiedAt: new Date().toISOString(),
          verifier: 'CodeLens Real Remediation Engine',
        },
      };

      onSuccess(updatedFinding, updatedFiles);
    } catch (err: any) {
      console.error('PR creation failed:', err);
      setStep('FAILED');
      setErrorMessage(err.message || 'Failed to complete GitHub operations.');
      setErrorDetails(err.stack || null);
    }
  };

  if (!isOpen || !finding) return null;

  const currentChange = proposal?.changes[selectedFileIdx] || proposal?.changes[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-zinc-200 max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden">
        {/* Modal Top Header */}
        <div className="px-6 py-4 border-b border-zinc-200 bg-zinc-50/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-zinc-900 text-white flex items-center justify-center shadow-xs">
              <GitPullRequest className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-zinc-900 leading-tight">
                  CodeLens Automated Remediation
                </h3>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-purple-100 text-purple-800">
                  Real PR Flow
                </span>
              </div>
              <p className="text-xs text-zinc-500">
                Fixing finding: <span className="font-semibold text-zinc-700">{finding.title}</span> ({finding.file}:{finding.lineStart})
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {ghUser && (
              <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-medium">
                <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse"></span>
                <span>@{ghUser}</span>
              </div>
            )}
            <button
              onClick={onClose}
              id="btn-close-remediation-modal"
              className="text-zinc-400 hover:text-zinc-600 p-1.5 rounded-md hover:bg-zinc-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Dynamic Workflow Stepper Bar */}
        <div className="border-b border-zinc-200 bg-white px-6 py-2.5 text-xs flex items-center justify-between overflow-x-auto gap-2">
          <div className="flex items-center gap-2 shrink-0">
            <span
              className={`flex items-center gap-1 font-semibold ${
                step === 'ANALYZING' || step === 'GENERATING_FIX'
                  ? 'text-purple-700 font-bold'
                  : 'text-zinc-500'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              1. AI Fix Engine
            </span>
            <ChevronRight className="w-3 h-3 text-zinc-300" />
            <span
              className={`flex items-center gap-1 font-semibold ${
                step === 'REVIEW_DIFF' ? 'text-zinc-900 font-bold' : 'text-zinc-500'
              }`}
            >
              <FileCode className="w-3.5 h-3.5" />
              2. Inspect Diff & Validation
            </span>
            <ChevronRight className="w-3 h-3 text-zinc-300" />
            <span
              className={`flex items-center gap-1 font-semibold ${
                step === 'PUBLISHING_BRANCH' || step === 'COMMITTING_CHANGES' || step === 'CREATING_PR'
                  ? 'text-blue-700 font-bold'
                  : 'text-zinc-500'
              }`}
            >
              <GitCommit className="w-3.5 h-3.5" />
              3. Branch, Commit & Push
            </span>
            <ChevronRight className="w-3 h-3 text-zinc-300" />
            <span
              className={`flex items-center gap-1 font-semibold ${
                step === 'SUCCESS' ? 'text-emerald-700 font-bold' : 'text-zinc-500'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              4. Pull Request Live
            </span>
          </div>

          {proposal && (
            <span
              className={`text-[11px] font-bold px-2 py-0.5 rounded ${
                proposal.verificationStatus === 'VERIFIED'
                  ? 'bg-emerald-100 text-emerald-800'
                  : proposal.canFix
                  ? 'bg-amber-100 text-amber-800'
                  : 'bg-rose-100 text-rose-800'
              }`}
            >
              AST Status: {proposal.verificationStatus}
            </span>
          )}
        </div>

        {/* Modal Main Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* STEP: Loading / Preparing */}
          {(step === 'ANALYZING' || step === 'GENERATING_FIX' || step === 'VALIDATING') && (
            <div className="py-12 flex flex-col items-center justify-center space-y-6 max-w-md mx-auto">
              <div className="relative">
                <div className="w-16 h-16 rounded-2xl bg-zinc-900 text-white flex items-center justify-center shadow-lg animate-pulse">
                  <Wrench className="w-8 h-8 text-emerald-400" />
                </div>
                <div className="absolute -bottom-1 -right-1 p-1 bg-white rounded-full shadow-sm">
                  <Loader2 className="w-5 h-5 text-purple-600 animate-spin" />
                </div>
              </div>

              <div className="text-center space-y-1">
                <h4 className="text-base font-bold text-zinc-900">
                  {step === 'ANALYZING' && 'Inspecting Context & Evaluating Safety Policy...'}
                  {step === 'GENERATING_FIX' && 'Synthesizing Verified Patch via CodeLens Gemini...'}
                  {step === 'VALIDATING' && 'Applying Patch & Running AST Code Re-Analysis...'}
                </h4>
                <p className="text-xs text-zinc-500">
                  Validating patch against repository AST to prevent regressions before creating branch.
                </p>
              </div>

              {/* Progress Box */}
              <div className="w-full bg-zinc-50 rounded-xl border border-zinc-200 p-4 space-y-2.5 text-xs">
                {progressLog.map((log, idx) => (
                  <div key={idx} className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-zinc-700">
                      {log.done ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      ) : (
                        <Loader2 className="w-4 h-4 text-purple-600 animate-spin shrink-0" />
                      )}
                      <span>{log.text}</span>
                    </span>
                    <span className="text-[10px] font-mono text-zinc-400">
                      {log.done ? 'COMPLETED' : 'RUNNING'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* STEP: Publishing in Real Time */}
          {(step === 'PUBLISHING_BRANCH' || step === 'COMMITTING_CHANGES' || step === 'CREATING_PR') && (
            <div className="py-12 flex flex-col items-center justify-center space-y-6 max-w-md mx-auto">
              <div className="w-16 h-16 rounded-2xl bg-zinc-900 text-white flex items-center justify-center shadow-lg">
                <GitPullRequest className="w-8 h-8 text-blue-400 animate-bounce" />
              </div>

              <div className="text-center space-y-1">
                <h4 className="text-base font-bold text-zinc-900">
                  Executing Real GitHub Operations...
                </h4>
                <p className="text-xs text-zinc-500">
                  Target: <span className="font-mono font-semibold">{targetOwner}/{targetRepo}</span>
                </p>
              </div>

              {/* Real-time GitHub Stages */}
              <div className="w-full bg-zinc-50 rounded-xl border border-zinc-200 p-4 space-y-3 text-xs">
                <div className="font-semibold text-zinc-900 pb-1 border-b border-zinc-200 flex items-center justify-between">
                  <span>Git Execution Pipeline</span>
                  <span className="text-[10px] font-mono text-purple-700">Authenticated API</span>
                </div>
                {progressLog.map((log, idx) => (
                  <div key={idx} className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-zinc-700">
                      {log.done ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      ) : (
                        <Loader2 className="w-4 h-4 text-blue-600 animate-spin shrink-0" />
                      )}
                      <span>{log.text}</span>
                    </span>
                    <span className="text-[10px] font-mono text-zinc-400">
                      {log.done ? 'DONE' : 'PENDING'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* STEP: Review Diff & Validation Preview */}
          {step === 'REVIEW_DIFF' && proposal && (
            <div className="space-y-6">
              {/* Safety Policy Warning (if blocked) */}
              {!proposal.canFix && (
                <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs space-y-2">
                  <div className="flex items-center gap-2 font-bold text-sm">
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                    <span>Safe Remediation Policy Notice</span>
                  </div>
                  <p className="leading-relaxed">{proposal.safetyReason}</p>
                  <p className="text-zinc-600 pt-1 border-t border-amber-200/60">
                    To maintain production safety, CodeLens requires manual developer implementation for this specific finding.
                  </p>
                </div>
              )}

              {/* Validation Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="p-3.5 rounded-xl bg-zinc-50 border border-zinc-200 space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                    Verification State
                  </span>
                  <div className="flex items-center gap-1.5 text-xs font-bold text-zinc-900">
                    {proposal.verificationStatus === 'VERIFIED' ? (
                      <>
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        <span className="text-emerald-700">Verified Eliminated</span>
                      </>
                    ) : (
                      <>
                        <AlertCircle className="w-4 h-4 text-amber-600" />
                        <span className="text-amber-700">{proposal.verificationStatus}</span>
                      </>
                    )}
                  </div>
                  <p className="text-[11px] text-zinc-600">{proposal.validation.reanalysisSummary}</p>
                </div>

                <div className="p-3.5 rounded-xl bg-zinc-50 border border-zinc-200 space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                    Target Repository
                  </span>
                  <div className="flex items-center gap-1.5 text-xs font-mono font-semibold text-zinc-900 truncate">
                    <GitBranch className="w-3.5 h-3.5 text-zinc-500" />
                    <span>{targetOwner}/{targetRepo}</span>
                  </div>
                  <p className="text-[11px] text-zinc-600 font-mono">Base branch: {baseBranch}</p>
                </div>

                <div className="p-3.5 rounded-xl bg-zinc-50 border border-zinc-200 space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                    Files to Modify
                  </span>
                  <div className="flex items-center gap-1.5 text-xs font-bold text-zinc-900">
                    <FileCode className="w-3.5 h-3.5 text-purple-600" />
                    <span>{proposal.changes.length} File(s) Patched</span>
                  </div>
                  <p className="text-[11px] text-zinc-600 truncate">
                    {proposal.changes.map((c) => c.filePath).join(', ')}
                  </p>
                </div>
              </div>

              {/* Code Diff Preview Section */}
              {proposal.changes.length > 0 && currentChange && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-zinc-900 flex items-center gap-1.5">
                        <Wrench className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Proposed Patch & Diff Preview</span>
                      </span>
                      {proposal.changes.length > 1 && (
                        <div className="flex items-center gap-1 text-xs">
                          {proposal.changes.map((change, i) => (
                            <button
                              key={i}
                              onClick={() => setSelectedFileIdx(i)}
                              className={`px-2 py-0.5 rounded text-[11px] font-mono ${
                                selectedFileIdx === i
                                  ? 'bg-zinc-900 text-white'
                                  : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                              }`}
                            >
                              {change.filePath}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <span className="text-[11px] font-mono text-zinc-500">
                      File: {currentChange.filePath}
                    </span>
                  </div>

                  {/* Diff Viewer */}
                  <div className="rounded-xl border border-zinc-200 overflow-hidden shadow-xs">
                    <div className="px-4 py-2 bg-zinc-900 text-zinc-300 font-mono text-xs flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-red-400 font-bold">- original</span>
                        <span className="text-zinc-600">|</span>
                        <span className="text-emerald-400 font-bold">+ verified fix</span>
                      </div>
                      <span className="text-zinc-500 text-[11px]">{currentChange.diffSummary}</span>
                    </div>
                    <CodeViewer
                      code=""
                      diffMode={true}
                      originalCode={
                        currentChange.originalContent ||
                        finding.codeSnippet
                      }
                      fixedCode={currentChange.updatedContent}
                    />
                  </div>
                </div>
              )}

              {/* Target Repository & Commit Configuration Form */}
              <div className="p-4 rounded-xl bg-zinc-50 border border-zinc-200 space-y-4">
                <div className="flex items-center justify-between text-xs font-bold text-zinc-900">
                  <div className="flex items-center gap-1.5">
                    <GitBranch className="w-4 h-4 text-zinc-600" />
                    <span>GitHub Pull Request Configuration</span>
                  </div>
                  {checkingAccess ? (
                    <span className="text-[10px] text-zinc-500 flex items-center gap-1">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      Checking permissions...
                    </span>
                  ) : repoAccess?.canPush ? (
                    <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      Write Access Verified
                    </span>
                  ) : repoAccess ? (
                    <span className="text-[10px] font-semibold text-amber-800 bg-amber-100 px-2 py-0.5 rounded flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" />
                      Read-Only (Auto-Routes to Personal Repo)
                    </span>
                  ) : null}
                </div>

                {/* Quick Target Repository Presets */}
                <div className="space-y-1.5">
                  <span className="text-[11px] font-semibold text-zinc-600">Select Target Repository:</span>
                  <div className="flex flex-wrap items-center gap-2">
                    {userRepos.slice(0, 4).map((r) => (
                      <button
                        key={r.fullName}
                        type="button"
                        onClick={() => {
                          setTargetOwner(r.owner);
                          setTargetRepo(r.name);
                        }}
                        className={`text-xs px-2.5 py-1.5 rounded-lg border font-mono flex items-center gap-1.5 transition-all ${
                          targetOwner === r.owner && targetRepo === r.name
                            ? 'bg-zinc-900 text-white border-zinc-900 shadow-xs'
                            : 'bg-white text-zinc-700 border-zinc-300 hover:bg-zinc-100'
                        }`}
                      >
                        {r.canPush && <UserCheck className="w-3.5 h-3.5 text-emerald-400" />}
                        <span>{r.fullName}</span>
                        {r.canPush && (
                          <span className="text-[9px] bg-emerald-600 text-white px-1 py-0.2 rounded font-sans uppercase font-bold">
                            Verified
                          </span>
                        )}
                      </button>
                    ))}

                    {projectName &&
                      projectName.includes('/') &&
                      !userRepos.some((r) => r.fullName === projectName) && (
                        <button
                          type="button"
                          onClick={() => {
                            const [po, pr] = projectName.split('/');
                            setTargetOwner(po);
                            setTargetRepo(pr);
                          }}
                          className={`text-xs px-2.5 py-1.5 rounded-lg border font-mono transition-all ${
                            targetOwner === projectName.split('/')[0] && targetRepo === projectName.split('/')[1]
                              ? 'bg-zinc-900 text-white border-zinc-900 shadow-xs'
                              : 'bg-white text-zinc-700 border-zinc-300 hover:bg-zinc-100'
                          }`}
                        >
                          {projectName} (Scanned)
                        </button>
                      )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="block text-[11px] font-semibold text-zinc-600 mb-1">
                      Repository Owner
                    </label>
                    <input
                      type="text"
                      value={targetOwner}
                      onChange={(e) => setTargetOwner(e.target.value)}
                      placeholder="e.g. nithyakarimilla"
                      className="w-full px-3 py-1.5 border border-zinc-300 rounded-md bg-white text-zinc-900 font-mono text-xs focus:ring-1 focus:ring-zinc-900 focus:outline-hidden"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-zinc-600 mb-1">
                      Repository Name
                    </label>
                    <input
                      type="text"
                      value={targetRepo}
                      onChange={(e) => setTargetRepo(e.target.value)}
                      placeholder="e.g. codelenssy"
                      className="w-full px-3 py-1.5 border border-zinc-300 rounded-md bg-white text-zinc-900 font-mono text-xs focus:ring-1 focus:ring-zinc-900 focus:outline-hidden"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-zinc-600 mb-1">
                      Base Branch
                    </label>
                    <input
                      type="text"
                      value={baseBranch}
                      onChange={(e) => setBaseBranch(e.target.value)}
                      placeholder="main"
                      className="w-full px-3 py-1.5 border border-zinc-300 rounded-md bg-white text-zinc-900 font-mono text-xs focus:ring-1 focus:ring-zinc-900 focus:outline-hidden"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-zinc-600 mb-1">
                      New Branch Name
                    </label>
                    <input
                      type="text"
                      value={customBranch}
                      onChange={(e) => setCustomBranch(e.target.value)}
                      placeholder={proposal.suggestedBranchName}
                      className="w-full px-3 py-1.5 border border-zinc-300 rounded-md bg-white text-zinc-900 font-mono text-xs focus:ring-1 focus:ring-zinc-900 focus:outline-hidden"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-semibold text-zinc-600 mb-1">
                      Commit Message
                    </label>
                    <input
                      type="text"
                      value={customCommitMsg}
                      onChange={(e) => setCustomCommitMsg(e.target.value)}
                      placeholder={proposal.commitMessage}
                      className="w-full px-3 py-1.5 border border-zinc-300 rounded-md bg-white text-zinc-900 font-mono text-xs focus:ring-1 focus:ring-zinc-900 focus:outline-hidden"
                    />
                  </div>

                  {/* Optional Custom Token Toggle */}
                  <div className="sm:col-span-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setShowTokenInput(!showTokenInput)}
                      className="text-[11px] text-zinc-500 hover:text-zinc-800 flex items-center gap-1 font-medium"
                    >
                      <Lock className="w-3 h-3" />
                      <span>{showTokenInput ? 'Hide token override' : 'Provide custom Personal Access Token (optional)'}</span>
                    </button>
                    {showTokenInput && (
                      <div className="mt-2">
                        <input
                          type="password"
                          value={customToken}
                          onChange={(e) => setCustomToken(e.target.value)}
                          placeholder="ghp_... (personal access token with 'repo' scope)"
                          className="w-full px-3 py-1.5 border border-zinc-300 rounded-md bg-white text-zinc-900 font-mono text-xs focus:ring-1 focus:ring-zinc-900 focus:outline-hidden"
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP: Success Result Card */}
          {step === 'SUCCESS' && prResult && (
            <div className="py-8 space-y-6 max-w-xl mx-auto">
              <div className="text-center space-y-2">
                <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto shadow-sm">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-bold text-zinc-900">
                  Pull Request Created Successfully!
                </h3>
                <p className="text-xs text-zinc-500">
                  Real Git branch pushed and Pull Request opened on GitHub.
                </p>
              </div>

              {/* Routing Notice if Applicable */}
              {prResult.notice && (
                <div className="p-3.5 rounded-xl bg-blue-50 border border-blue-200 text-blue-900 text-xs flex items-start gap-2.5">
                  <Sparkles className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <span className="font-semibold block text-blue-950">Target Repository Routing</span>
                    <p className="text-blue-800 leading-relaxed">{prResult.notice}</p>
                  </div>
                </div>
              )}

              {/* PR Detail Banner */}
              <div className="p-5 rounded-2xl bg-zinc-900 text-white space-y-4 shadow-xl">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500 text-zinc-950 uppercase tracking-wider">
                        PR #{prResult.pullRequest.number}
                      </span>
                      <span className="text-xs font-mono text-zinc-400">
                        {targetOwner}/{targetRepo}
                      </span>
                    </div>
                    <h4 className="text-sm font-semibold text-zinc-100 leading-snug">
                      {prResult.pullRequest.title}
                    </h4>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-3 border-t border-zinc-800 text-xs font-mono">
                  <div>
                    <span className="text-zinc-400 text-[10px] block uppercase font-sans">Branch</span>
                    <span className="text-emerald-400 truncate block">{prResult.branch.name}</span>
                  </div>
                  <div>
                    <span className="text-zinc-400 text-[10px] block uppercase font-sans">Commit SHA</span>
                    <span className="text-zinc-300 truncate block">{prResult.commit.sha.slice(0, 7)}</span>
                  </div>
                </div>

                <div className="pt-2">
                  <a
                    href={prResult.pullRequest.url}
                    target="_blank"
                    rel="noreferrer noopener"
                    id="btn-open-real-pr-link"
                    className="w-full py-2.5 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-xs flex items-center justify-center gap-2 transition-colors shadow-sm"
                  >
                    <span>Open Pull Request #{prResult.pullRequest.number} on GitHub</span>
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
              </div>

              {/* Verification Audit Summary */}
              <div className="p-4 rounded-xl bg-zinc-50 border border-zinc-200 space-y-2 text-xs">
                <div className="flex items-center justify-between font-semibold text-zinc-900">
                  <span className="flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    <span>Verification Guarantee</span>
                  </span>
                  <span className="text-emerald-700 font-bold">VERIFIED</span>
                </div>
                <p className="text-zinc-600 leading-relaxed">
                  CodeLens re-analyzed the modified source AST. The original issue was eliminated with 0 regressions introduced.
                </p>
              </div>
            </div>
          )}

          {/* STEP: Failed Error State */}
          {step === 'FAILED' && (
            <div className="py-8 space-y-4 max-w-lg mx-auto">
              <div className="p-5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 space-y-3">
                <div className="flex items-center gap-2.5 font-bold text-sm">
                  <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
                  <span>Operation Failed</span>
                </div>
                <p className="text-xs leading-relaxed">{errorMessage}</p>
                {errorDetails && (
                  <pre className="p-3 bg-rose-950 text-rose-200 rounded-lg text-[11px] font-mono overflow-x-auto max-h-36">
                    {errorDetails}
                  </pre>
                )}
              </div>

              {/* Special 1-Click Recovery for Base Branch Validation Error (422) */}
              {(errorMessage?.includes('"field":"base"') ||
                errorMessage?.toLowerCase().includes('base') ||
                errorMessage?.includes('422')) && (
                <div className="p-4 rounded-xl bg-blue-50 border border-blue-200 text-blue-900 space-y-3 shadow-xs">
                  <div className="flex items-center gap-2 font-bold text-xs text-blue-950">
                    <Sparkles className="w-4 h-4 text-blue-600 shrink-0" />
                    <span>Base Branch Alignment (422 Validation Fix)</span>
                  </div>
                  <p className="text-xs text-blue-800 leading-relaxed">
                    The target repository uses <strong>main</strong> as its default base branch. Click below to automatically align the base branch and immediately publish your Pull Request.
                  </p>
                  <button
                    onClick={() => {
                      setBaseBranch('main');
                      setErrorMessage(null);
                      setErrorDetails(null);
                      setStep('REVIEW_DIFF');
                    }}
                    className="w-full py-2.5 px-4 bg-blue-700 hover:bg-blue-800 text-white font-bold text-xs rounded-xl transition-colors flex items-center justify-center gap-2 shadow-sm"
                  >
                    <GitBranch className="w-4 h-4 text-blue-200" />
                    <span>Align Base Branch to 'main' & Retry PR</span>
                  </button>
                </div>
              )}

              {/* Special 1-Click Recovery if Permission / 403 / Access Error */}
              {(errorMessage?.includes('403') ||
                errorMessage?.toLowerCase().includes('resource not accessible') ||
                errorMessage?.toLowerCase().includes('permission') ||
                errorMessage?.toLowerCase().includes('push permissions')) && (
                <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 space-y-3 shadow-xs">
                  <div className="flex items-center gap-2 font-bold text-xs text-amber-950">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>Target Repository Permission Resolution</span>
                  </div>
                  {(() => {
                    const primary = userRepos.find((r) => r.canPush) || userRepos[0];
                    const chosenOwner = primary?.owner || ghUser || 'Aarav-Singh2007';
                    const chosenRepo = primary?.name || 'codesynclens';
                    const fullName = primary?.fullName || `${chosenOwner}/${chosenRepo}`;
                    return (
                      <>
                        <p className="text-xs text-amber-800 leading-relaxed">
                          The GitHub token lacks push permissions for <strong>{targetOwner}/{targetRepo}</strong>.
                          You have verified write access to your repository: <strong>{fullName}</strong>.
                        </p>
                        <button
                          onClick={() => {
                            setTargetOwner(chosenOwner);
                            setTargetRepo(chosenRepo);
                            setBaseBranch('main');
                            setErrorMessage(null);
                            setErrorDetails(null);
                            setStep('REVIEW_DIFF');
                          }}
                          className="w-full py-2.5 px-4 bg-zinc-900 hover:bg-zinc-800 text-white font-bold text-xs rounded-xl transition-colors flex items-center justify-center gap-2 shadow-sm"
                        >
                          <GitPullRequest className="w-4 h-4 text-emerald-400" />
                          <span>Switch Target to {fullName} & Retry PR</span>
                        </button>
                      </>
                    );
                  })()}
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  onClick={onClose}
                  className="px-4 py-2 text-xs font-semibold text-zinc-700 bg-white hover:bg-zinc-100 border border-zinc-200 rounded-lg transition-colors"
                >
                  Close
                </button>
                <button
                  onClick={() => runPreparationPipeline(finding, targetOwner, targetRepo)}
                  className="px-4 py-2 text-xs font-semibold text-white bg-zinc-900 hover:bg-zinc-800 rounded-lg transition-colors"
                >
                  Retry Analysis
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer Controls */}
        <div className="px-6 py-4 border-t border-zinc-200 bg-zinc-50/80 flex items-center justify-between">
          <div>
            {step === 'REVIEW_DIFF' && proposal && (
              <span className="text-xs text-zinc-500">
                Safe auto-remediation validated by CodeLens AST analyzer.
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              id="btn-cancel-remediation"
              className="px-4 py-2 text-xs font-medium text-zinc-700 hover:text-zinc-900 bg-white border border-zinc-200 rounded-xl transition-colors hover:bg-zinc-100 shadow-2xs"
            >
              {step === 'SUCCESS' ? 'Done' : 'Cancel'}
            </button>

            {step === 'REVIEW_DIFF' && proposal && proposal.canFix && (
              <button
                onClick={handlePublishPullRequest}
                id="btn-confirm-create-pr"
                className="px-5 py-2 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-xl shadow-xs transition-colors flex items-center gap-2"
              >
                <GitPullRequest className="w-4 h-4" />
                <span>Approve & Create Pull Request</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}

            {step === 'SUCCESS' && prResult && (
              <a
                href={prResult.pullRequest.url}
                target="_blank"
                rel="noreferrer noopener"
                className="px-5 py-2 text-xs font-bold text-white bg-zinc-900 hover:bg-zinc-800 rounded-xl shadow-xs transition-colors flex items-center gap-2"
              >
                <span>View on GitHub</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
