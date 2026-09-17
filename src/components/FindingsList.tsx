import React, { useState, useMemo } from 'react';
import { Finding, FindingCategory, FindingSeverity, FindingStatus } from '../types';
import { Search, Filter, CheckCircle2, AlertTriangle, ShieldAlert, Bug, Flame, Trash2, Sparkles, ChevronRight, GitPullRequest } from 'lucide-react';

interface FindingsListProps {
  findings: Finding[];
  onSelectFinding: (finding: Finding) => void;
  selectedFindingId?: string;
  activeCategoryFilter?: string;
  onClearCategoryFilter?: () => void;
}

export const FindingsList: React.FC<FindingsListProps> = ({
  findings,
  onSelectFinding,
  selectedFindingId,
  activeCategoryFilter = 'ALL',
  onClearCategoryFilter
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>(activeCategoryFilter || 'ALL');
  const [severityFilter, setSeverityFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Sync category filter if changed from parent
  React.useEffect(() => {
    if (activeCategoryFilter) {
      setCategoryFilter(activeCategoryFilter);
    }
  }, [activeCategoryFilter]);

  const filteredFindings = useMemo(() => {
    return findings.filter((f) => {
      // Search
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesTitle = f.title.toLowerCase().includes(query);
        const matchesFile = f.file.toLowerCase().includes(query);
        const matchesEvidence = f.evidence.toLowerCase().includes(query);
        const matchesSource = f.provenance.source.toLowerCase().includes(query);
        if (!matchesTitle && !matchesFile && !matchesEvidence && !matchesSource) {
          return false;
        }
      }

      // Category
      if (categoryFilter !== 'ALL') {
        if (categoryFilter === 'SECURITY' && f.category !== 'SECURITY' && f.category !== 'SECRET') {
          return false;
        }
        if (categoryFilter !== 'SECURITY' && f.category !== categoryFilter) {
          return false;
        }
      }

      // Severity
      if (severityFilter !== 'ALL' && f.severity !== severityFilter) {
        return false;
      }

      // Status
      if (statusFilter !== 'ALL' && f.status !== statusFilter) {
        return false;
      }

      return true;
    });
  }, [findings, searchQuery, categoryFilter, severityFilter, statusFilter]);

  const getCategoryIcon = (cat: FindingCategory) => {
    switch (cat) {
      case 'SECURITY':
      case 'SECRET':
        return <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />;
      case 'BUG':
        return <Bug className="w-3.5 h-3.5 text-orange-600" />;
      case 'CODE_SMELL':
        return <Flame className="w-3.5 h-3.5 text-amber-600" />;
      case 'DEAD_CODE':
        return <Trash2 className="w-3.5 h-3.5 text-zinc-500" />;
      default:
        return <Sparkles className="w-3.5 h-3.5 text-purple-600" />;
    }
  };

  const getSeverityBadge = (sev: FindingSeverity) => {
    switch (sev) {
      case 'CRITICAL':
        return <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-100 text-rose-800 tracking-wider">CRITICAL</span>;
      case 'HIGH':
        return <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-orange-100 text-orange-800 tracking-wider">HIGH</span>;
      case 'MEDIUM':
        return <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-800 tracking-wider">MEDIUM</span>;
      case 'LOW':
        return <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-800 tracking-wider">LOW</span>;
      case 'INFO':
        return <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-zinc-100 text-zinc-700 tracking-wider">INFO</span>;
    }
  };

  return (
    <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden shadow-xs">
      {/* Controls Bar */}
      <div className="p-4 border-b border-zinc-200 bg-zinc-50/50 flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input
            type="text"
            placeholder="Search findings, files, or rules..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs border border-zinc-300 rounded-md bg-white focus:outline-hidden focus:ring-1 focus:ring-zinc-900"
          />
        </div>

        {/* Filters */}
        <div className="flex items-center flex-wrap gap-2 text-xs">
          {/* Category Filter */}
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-2.5 py-1.5 border border-zinc-300 rounded-md bg-white text-zinc-700 font-medium"
          >
            <option value="ALL">All Categories</option>
            <option value="SECURITY">Security & Secrets</option>
            <option value="BUG">Bugs & Logic</option>
            <option value="CODE_SMELL">Code Smells</option>
            <option value="DEAD_CODE">Dead Code</option>
          </select>

          {/* Severity Filter */}
          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="px-2.5 py-1.5 border border-zinc-300 rounded-md bg-white text-zinc-700 font-medium"
          >
            <option value="ALL">All Severities</option>
            <option value="CRITICAL">Critical</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-2.5 py-1.5 border border-zinc-300 rounded-md bg-white text-zinc-700 font-medium"
          >
            <option value="ALL">All Statuses</option>
            <option value="OPEN">Open</option>
            <option value="FIXED">Fixed</option>
            <option value="VERIFIED">Verified</option>
          </select>

          {(categoryFilter !== 'ALL' || severityFilter !== 'ALL' || statusFilter !== 'ALL' || searchQuery) && (
            <button
              onClick={() => {
                setCategoryFilter('ALL');
                setSeverityFilter('ALL');
                setStatusFilter('ALL');
                setSearchQuery('');
                if (onClearCategoryFilter) onClearCategoryFilter();
              }}
              className="text-xs text-zinc-500 hover:text-zinc-900 underline ml-1"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Findings Table List */}
      <div className="divide-y divide-zinc-100">
        {filteredFindings.length === 0 ? (
          <div className="p-12 text-center text-zinc-500 text-xs">
            No findings match the current filter criteria.
          </div>
        ) : (
          filteredFindings.map((finding) => {
            const isSelected = selectedFindingId === finding.id;
            return (
              <div
                key={finding.id}
                onClick={() => onSelectFinding(finding)}
                className={`w-full p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-left transition-colors cursor-pointer group ${
                  isSelected ? 'bg-zinc-100/70 border-l-4 border-l-zinc-900' : 'hover:bg-zinc-50'
                }`}
              >
                {/* Left info */}
                <div className="flex items-start gap-3 min-w-0">
                  <div className="pt-0.5 shrink-0">
                    {getSeverityBadge(finding.severity)}
                  </div>

                  <div className="space-y-0.5 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-semibold text-zinc-900 group-hover:text-black truncate">
                        {finding.title}
                      </span>
                      {finding.status === 'VERIFIED' && (
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 font-medium flex items-center gap-1">
                          <CheckCircle2 className="w-2.5 h-2.5" />
                          Verified Fix
                        </span>
                      )}
                      {finding.fix?.pullRequestUrl && (
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-purple-100 text-purple-800 font-bold flex items-center gap-1">
                          <GitPullRequest className="w-2.5 h-2.5 text-purple-700" />
                          PR #{finding.fix.pullRequestNumber}
                        </span>
                      )}
                      {finding.status === 'FIXED' && !finding.fix?.pullRequestUrl && (
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-blue-100 text-blue-800 font-medium">
                          Fixed
                        </span>
                      )}
                    </div>

                    <p className="text-xs font-mono text-zinc-500 truncate">
                      {finding.file}:{finding.lineStart}
                    </p>
                  </div>
                </div>

                {/* Right provenance & category */}
                <div className="flex items-center justify-between sm:justify-end gap-3 text-xs shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-zinc-100">
                  <div className="flex items-center gap-1.5 text-zinc-600">
                    {getCategoryIcon(finding.category)}
                    <span className="font-medium capitalize">{finding.category.replace('_', ' ').toLowerCase()}</span>
                  </div>

                  <span className="text-zinc-300">·</span>

                  <span className="text-xs font-medium text-zinc-500 max-w-[160px] truncate" title={finding.provenance.source}>
                    {finding.provenance.source}
                  </span>

                  {finding.provenance.corroboratedBy && finding.provenance.corroboratedBy.length > 0 && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-600 font-medium" title={`Corroborated by ${finding.provenance.corroboratedBy.join(', ')}`}>
                      +{finding.provenance.corroboratedBy.length} Corroborated
                    </span>
                  )}

                  <ChevronRight className="w-4 h-4 text-zinc-300 group-hover:text-zinc-600 transition-colors ml-1" />
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
