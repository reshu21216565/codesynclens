import React, { useState } from 'react';
import { Finding, AnalysisSession, AnalysisSummary } from './types';
import { DEMO_PROJECT_FILES } from './engine/demoData';
import { Header } from './components/Header';
import { LandingHero } from './components/LandingHero';
import { InputModal } from './components/InputModal';
import { AnalysisProgress } from './components/AnalysisProgress';
import { SummaryCard } from './components/SummaryCard';
import { FindingsList } from './components/FindingsList';
import { FindingDetail } from './components/FindingDetail';
import { RemediationModal } from './components/RemediationModal';
import { IntegrationsModal } from './components/IntegrationsModal';
import { SecurityValidationView } from './components/SecurityValidationView';
import { CodeLensFooter } from './components/CodeLensFooter';
import { ArrowLeft, RefreshCw, CheckCircle2 } from 'lucide-react';

interface Stage {
  id: string;
  label: string;
  status: 'pending' | 'running' | 'completed';
}

const DEFAULT_STAGES: Stage[] = [
  { id: 'prep', label: 'Preparing project workspace', status: 'pending' },
  { id: 'index', label: 'Indexing source files & AST structures', status: 'pending' },
  { id: 'security', label: 'Scanning security & hardcoded secrets', status: 'pending' },
  { id: 'bugs', label: 'Detecting defects & control flow bugs', status: 'pending' },
  { id: 'smells', label: 'Analyzing code smells & maintainability', status: 'pending' },
  { id: 'deadcode', label: 'Inspecting dead code & symbol graph', status: 'pending' },
  { id: 'orchestrate', label: 'Deduplicating & normalizing evidence', status: 'pending' },
];

export default function App() {
  const [activeView, setActiveView] = useState<'code' | 'security'>('code');
  const [session, setSession] = useState<AnalysisSession | null>(null);
  const [isInputModalOpen, setIsInputModalOpen] = useState(false);
  const [initialInputMethod, setInitialInputMethod] = useState<'GITHUB' | 'UPLOAD' | 'PASTE'>('GITHUB');
  const [isIntegrationsModalOpen, setIsIntegrationsModalOpen] = useState(false);
  const [selectedFinding, setSelectedFinding] = useState<Finding | null>(null);
  const [activeCategoryFilter, setActiveCategoryFilter] = useState<string>('ALL');

  // Remediation Modal State
  const [remediationFinding, setRemediationFinding] = useState<Finding | null>(null);
  const [isRemediationOpen, setIsRemediationOpen] = useState<boolean>(false);

  // Progress state
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [currentProjectName, setCurrentProjectName] = useState('project');
  const [stages, setStages] = useState<Stage[]>(DEFAULT_STAGES);

  // Helper to step through stages smoothly
  const runProgressSequence = async (onComplete: () => Promise<void>) => {
    setIsAnalyzing(true);
    const updated = [...DEFAULT_STAGES];

    for (let i = 0; i < updated.length; i++) {
      updated[i].status = 'running';
      setStages([...updated]);
      await new Promise((r) => setTimeout(r, 140));
      updated[i].status = 'completed';
      setStages([...updated]);
    }

    await onComplete();
    setIsAnalyzing(false);
  };

  // 1. Run Deterministic HackForge Demo
  const handleLoadDemo = async () => {
    setCurrentProjectName('HackForge-Demo-Repo');
    await runProgressSequence(async () => {
      try {
        const res = await fetch('/api/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            files: DEMO_PROJECT_FILES,
            projectName: 'hackforge-sample-repo',
            mode: 'DEMO',
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Demo analysis failed');

        const newSession: AnalysisSession = {
          id: `demo-${Date.now()}`,
          projectName: 'hackforge-sample-repo',
          sourceType: 'DEMO',
          sourceDetail: 'Curated HackForge multi-file demonstration suite',
          timestamp: new Date().toISOString(),
          files: DEMO_PROJECT_FILES,
          findings: data.findings,
          summary: data.summary,
          status: 'COMPLETED',
        };

        setSession(newSession);
        setSelectedFinding(null);
        setActiveCategoryFilter('ALL');
      } catch (err: any) {
        alert('Analysis failed: ' + err.message);
      }
    });
  };

  // 2. Run Real Code Analysis
  const handleSubmitInput = async (
    files: Record<string, string>,
    projectName: string,
    sourceType: 'GITHUB' | 'UPLOAD' | 'PASTE',
    detail: string
  ) => {
    setCurrentProjectName(projectName);
    await runProgressSequence(async () => {
      try {
        const res = await fetch('/api/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            files,
            projectName,
            mode: 'REAL',
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Code analysis failed');

        let repoOwner: string | undefined;
        let repoName: string | undefined;
        if (sourceType === 'GITHUB' && projectName.includes('/')) {
          const parts = projectName.split('/');
          repoOwner = parts[0];
          repoName = parts[1];
        }

        const newSession: AnalysisSession = {
          id: `real-${Date.now()}`,
          projectName,
          sourceType,
          sourceDetail: detail,
          timestamp: new Date().toISOString(),
          files,
          findings: data.findings,
          summary: data.summary,
          status: 'COMPLETED',
          repoOwner,
          repoName,
          defaultBranch: detail.match(/\(([^)]+)\)/)?.[1] || 'main',
        };

        setSession(newSession);
        setSelectedFinding(null);
        setActiveCategoryFilter('ALL');
      } catch (err: any) {
        alert('Analysis error: ' + err.message);
      }
    });
  };

  // 3. Apply proposed fix & run immediate real verification
  const handleApplyFix = async (finding: Finding, updatedCode: string) => {
    if (!session) return;
    const currentFileContent = session.files[finding.file] || '';
    const lines = currentFileContent.split('\n');
    const targetIdx = finding.lineStart - 1;

    if (targetIdx >= 0 && targetIdx < lines.length) {
      lines[targetIdx] = updatedCode;
      const patchedContent = lines.join('\n');

      // Update virtual file in session
      const updatedFiles = {
        ...session.files,
        [finding.file]: patchedContent,
      };

      // Call verification endpoint
      const verifyRes = await fetch('/api/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filePath: finding.file,
          updatedContent: patchedContent,
          finding,
        }),
      });
      const verificationResult = await verifyRes.json();

      // Update finding status
      const updatedFindings = session.findings.map((f) => {
        if (f.id === finding.id) {
          return {
            ...f,
            status: verificationResult.status === 'VERIFIED' ? ('VERIFIED' as const) : ('FIXED' as const),
            verification: verificationResult,
            suggestedCode: updatedCode,
          };
        }
        return f;
      });

      // Recalculate summary
      const newSession: AnalysisSession = {
        ...session,
        files: updatedFiles,
        findings: updatedFindings,
      };

      setSession(newSession);
      setSelectedFinding(updatedFindings.find((f) => f.id === finding.id) || null);
    }
  };

  // 4. Run verification pass on existing finding
  const handleRunVerification = async (finding: Finding) => {
    if (!session) return;
    const currentFileContent = session.files[finding.file] || '';

    const verifyRes = await fetch('/api/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filePath: finding.file,
        updatedContent: currentFileContent,
        finding,
      }),
    });
    const verificationResult = await verifyRes.json();

    const updatedFindings = session.findings.map((f) => {
      if (f.id === finding.id) {
        return {
          ...f,
          verification: verificationResult,
          status: verificationResult.status === 'VERIFIED' ? ('VERIFIED' as const) : f.status,
        };
      }
      return f;
    });

    setSession({
      ...session,
      findings: updatedFindings,
    });
    setSelectedFinding(updatedFindings.find((f) => f.id === finding.id) || null);
  };

  // 5. Update Finding Status (Fixed / Ignored / Open)
  const handleMarkStatus = (findingId: string, status: Finding['status']) => {
    if (!session) return;
    const updatedFindings = session.findings.map((f) => {
      if (f.id === findingId) {
        return { ...f, status };
      }
      return f;
    });
    setSession({ ...session, findings: updatedFindings });
    if (selectedFinding && selectedFinding.id === findingId) {
      setSelectedFinding({ ...selectedFinding, status });
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 flex flex-col font-sans antialiased selection:bg-zinc-900 selection:text-white">
      {/* Top Header */}
      <Header
        onNewAnalysis={() => {
          setActiveView('code');
          setInitialInputMethod('GITHUB');
          setIsInputModalOpen(true);
        }}
        onOpenIntegrations={() => setIsIntegrationsModalOpen(true)}
        onLoadDemo={() => {
          setActiveView('code');
          handleLoadDemo();
        }}
        analysisMode={session?.summary.analysisMode}
        hasActiveProject={Boolean(session)}
        activeView={activeView}
        onSelectView={(v) => setActiveView(v)}
      />

      {/* Main Content Area */}
      <main className="flex-1">
        {activeView === 'security' ? (
          <SecurityValidationView />
        ) : isAnalyzing ? (
          <AnalysisProgress
            currentStage="Analyzing source code"
            stages={stages}
            projectName={currentProjectName}
          />
        ) : !session ? (
          <LandingHero
            onSelectMethod={(method) => {
              setInitialInputMethod(method);
              setIsInputModalOpen(true);
            }}
            onLoadDemo={handleLoadDemo}
            onOpenSecurityValidation={() => setActiveView('security')}
          />
        ) : (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
            {/* Top Navigation Bar inside Project */}
            <div className="flex items-center justify-between">
              <button
                onClick={() => setSession(null)}
                id="btn-back-home"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-600 hover:text-zinc-900 transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Return to Landing</span>
              </button>

              <div className="flex items-center gap-3">
                <span className="text-xs text-zinc-500 hidden sm:inline">
                  Source: <span className="font-mono text-zinc-700">{session.sourceDetail}</span>
                </span>
                <button
                  onClick={() => {
                    if (session.sourceType === 'DEMO') {
                      handleLoadDemo();
                    } else {
                      handleSubmitInput(session.files, session.projectName, session.sourceType, session.sourceDetail);
                    }
                  }}
                  id="btn-rescan"
                  className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded bg-white hover:bg-zinc-100 border border-zinc-200 text-zinc-700 transition-colors"
                >
                  <RefreshCw className="w-3 h-3 text-zinc-500" />
                  <span>Re-scan</span>
                </button>
              </div>
            </div>

            {/* Health Summary Card */}
            <SummaryCard
              summary={session.summary}
              topFindings={session.findings.filter(
                (f) => f.severity === 'CRITICAL' || f.severity === 'HIGH'
              )}
              onSelectFinding={(finding) => setSelectedFinding(finding)}
              onFilterCategory={(cat) => setActiveCategoryFilter(cat)}
            />

            {/* Unified Findings List */}
            <div className="space-y-2">
              <div className="flex items-center justify-between px-1">
                <h3 className="text-sm font-bold text-zinc-900">
                  Comprehensive Findings ({session.findings.length})
                </h3>
                {activeCategoryFilter !== 'ALL' && (
                  <span className="text-xs text-zinc-500">
                    Filtered by: <span className="font-semibold text-zinc-800">{activeCategoryFilter}</span>
                  </span>
                )}
              </div>

              <FindingsList
                findings={session.findings}
                onSelectFinding={(f) => setSelectedFinding(f)}
                selectedFindingId={selectedFinding?.id}
                activeCategoryFilter={activeCategoryFilter}
                onClearCategoryFilter={() => setActiveCategoryFilter('ALL')}
              />
            </div>
          </div>
        )}
      </main>

      {/* Main Footer with Interactive TextHoverEffect (hidden on Security Validation view) */}
      {activeView !== 'security' && (
        <CodeLensFooter
          onNewAnalysis={() => {
            setInitialInputMethod('GITHUB');
            setIsInputModalOpen(true);
          }}
          onOpenIntegrations={() => setIsIntegrationsModalOpen(true)}
          onLoadDemo={handleLoadDemo}
          onSelectView={(view) => setActiveView(view)}
        />
      )}

      {/* Input Modal */}
      <InputModal
        isOpen={isInputModalOpen}
        initialMethod={initialInputMethod}
        onClose={() => setIsInputModalOpen(false)}
        onSubmit={handleSubmitInput}
      />

      {/* Finding Detail Modal */}
      {selectedFinding && session && (
        <FindingDetail
          finding={selectedFinding}
          fileContent={session.files[selectedFinding.file]}
          onClose={() => setSelectedFinding(null)}
          onApplyFix={handleApplyFix}
          onMarkStatus={handleMarkStatus}
          onRunVerification={handleRunVerification}
          onOpenRemediation={(finding) => {
            setRemediationFinding(finding);
            setIsRemediationOpen(true);
          }}
        />
      )}

      {/* CodeLens Real Remediation & Pull Request Modal */}
      {isRemediationOpen && remediationFinding && session && (
        <RemediationModal
          isOpen={isRemediationOpen}
          finding={remediationFinding}
          fileContent={session.files[remediationFinding.file]}
          allFiles={session.files}
          projectName={session.projectName}
          sessionRepoOwner={session.repoOwner}
          sessionRepoName={session.repoName}
          sessionBranch={session.defaultBranch || 'main'}
          onClose={() => {
            setIsRemediationOpen(false);
            setRemediationFinding(null);
          }}
          onSuccess={(updatedFinding, updatedFiles) => {
            setSession((prev) => {
              if (!prev) return null;
              return {
                ...prev,
                files: updatedFiles,
                findings: prev.findings.map((f) => (f.id === updatedFinding.id ? updatedFinding : f)),
              };
            });
            setSelectedFinding(updatedFinding);
          }}
        />
      )}

      {/* Integrations & Provider Registry Modal */}
      <IntegrationsModal
        isOpen={isIntegrationsModalOpen}
        onClose={() => setIsIntegrationsModalOpen(false)}
      />
    </div>
  );
}
