export type FindingCategory =
  | 'BUG'
  | 'SECURITY'
  | 'SECRET'
  | 'CODE_SMELL'
  | 'DEAD_CODE'
  | 'DEPENDENCY'
  | 'AI_OBSERVATION'
  | 'OTHER';

export type FindingSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';

export type ConfidenceLevel = 'HIGH' | 'MEDIUM' | 'LOW';

export type FindingStatus = 'OPEN' | 'FIX_PROPOSED' | 'FIXED' | 'VERIFIED' | 'IGNORED' | 'VALIDATION_FAILED';

export interface FindingProvenance {
  source: string;
  providerId: string;
  ruleId?: string;
  rawAnalyzerInfo?: string;
  corroboratedBy?: string[];
}

export interface FileChangeItem {
  filePath: string;
  originalContent?: string;
  updatedContent: string;
  diffSummary?: string;
}

export interface ValidationCheckItem {
  name: string;
  passed: boolean;
  details: string;
  type?: 'PATCH_CLEAN' | 'AST_RECHECK' | 'LINT_BUILD' | 'SECURITY';
}

export interface ValidationReport {
  overallPassed: boolean;
  checks: ValidationCheckItem[];
  reanalysisSummary?: string;
  executionLogs?: string[];
}

export interface FindingFix {
  description: string;
  originalSnippet?: string;
  fixedSnippet?: string;
  applied: boolean;
  appliedAt?: string;
  canAutoRemediate?: boolean;
  safetyReason?: string;
  changes?: FileChangeItem[];
  branchName?: string;
  commitSha?: string;
  commitMessage?: string;
  pullRequestNumber?: number;
  pullRequestUrl?: string;
  pullRequestTitle?: string;
  validationStatus?: 'PASSED' | 'FAILED' | 'SKIPPED';
  verificationStatus?: 'VERIFIED' | 'STILL_PRESENT' | 'REGRESSION' | 'UNAVAILABLE';
  validationResults?: ValidationReport;
}

export interface RemediationProposal {
  findingId: string;
  canFix: boolean;
  safetyReason: string;
  explanation: string;
  commitMessage: string;
  prTitle: string;
  prBody: string;
  changes: FileChangeItem[];
  validation: ValidationReport;
  verificationStatus: 'VERIFIED' | 'STILL_PRESENT' | 'REGRESSION' | 'UNAVAILABLE';
  suggestedBranchName: string;
}

export interface PullRequestResult {
  success: boolean;
  targetRepo?: string;
  notice?: string;
  pullRequest: {
    number: number;
    url: string;
    title: string;
    state: string;
    createdAt: string;
  };
  branch: {
    name: string;
    ref: string;
    url: string;
  };
  commit: {
    sha: string;
    message: string;
    url: string;
  };
  verificationStatus: 'VERIFIED' | 'STILL_PRESENT' | 'REGRESSION' | 'UNAVAILABLE';
  validationResults?: ValidationReport;
  warning?: string;
}

export interface VerificationResult {
  status: 'VERIFIED' | 'STILL_PRESENT' | 'REGRESSION' | 'UNAVAILABLE';
  message: string;
  verifiedAt: string;
  verifier: string;
  previousFindingId?: string;
}

export interface Finding {
  id: string;
  category: FindingCategory;
  title: string;
  severity: FindingSeverity;
  confidence: ConfidenceLevel;
  provenance: FindingProvenance;
  file: string;
  lineStart: number;
  lineEnd: number;
  columnStart?: number;
  columnEnd?: number;
  codeSnippet: string;
  evidence: string;
  explanation?: string;
  impact?: string;
  recommendation?: string;
  suggestedCode?: string;
  isAiObservation: boolean;
  status: FindingStatus;
  fix?: FindingFix;
  verification?: VerificationResult;
}

export interface AnalysisSummary {
  projectName: string;
  analysisMode: 'REAL' | 'DEMO';
  totalFiles: number;
  linesOfCode: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  infoCount: number;
  categoryCounts: Record<FindingCategory, number>;
  durationMs: number;
  providersUsed: string[];
  timestamp: string;
}

export interface AnalysisSession {
  id: string;
  projectName: string;
  sourceType: 'GITHUB' | 'UPLOAD' | 'PASTE' | 'DEMO';
  sourceDetail: string;
  timestamp: string;
  files: Record<string, string>;
  findings: Finding[];
  summary: AnalysisSummary;
  status: 'IDLE' | 'PREPARING' | 'ANALYZING' | 'EXPLAINING' | 'COMPLETED' | 'FAILED';
  currentStage?: string;
  error?: string;
  repoOwner?: string;
  repoName?: string;
  defaultBranch?: string;
}

export interface CapabilityProviderInfo {
  id: string;
  name: string;
  category: string;
  capabilities: FindingCategory[];
  status: 'AVAILABLE' | 'CONNECTED' | 'RUNNING' | 'COMPLETED' | 'UNAVAILABLE' | 'REQUIRES_CONFIGURATION';
  version?: string;
  lastExecution?: string;
  isExternal: boolean;
  description: string;
  supportedLanguages: string[];
}

export interface FileItem {
  path: string;
  content: string;
  language?: string;
}

export interface SecurityValidationFinding {
  id: string;
  type: string;
  severity: FindingSeverity;
  url: string;
  evidence: string;
  description: string;
  remediation: string;
  parameter?: string;
  payload?: string;
  fingerprint?: string;
  timestamp?: string;
  aiExplanation?: string;
}

export interface SecurityValidationSummary {
  targetUrl: string;
  scanMode: 'quick' | 'standard' | 'full';
  totalFindings: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  infoCount: number;
  urlsCrawled: number;
  durationMs: number;
  timestamp: string;
  engineVersion: string;
  stateBreakdown?: Record<string, { total: number; success: number; failed: number }>;
}

export interface SecurityValidationSession {
  id: string;
  targetUrl: string;
  authorized: boolean;
  status: 'IDLE' | 'STARTING' | 'SCANNING' | 'GENERATING_REPORT' | 'COMPLETED' | 'FAILED';
  currentPhase?: string;
  progressPercent?: number;
  findings: SecurityValidationFinding[];
  summary?: SecurityValidationSummary;
  rawJsonPath?: string;
  error?: string;
  logs: string[];
}

