import React, { useState } from 'react';
import { X, Github, Upload, Code2, AlertCircle, FileCode, Check } from 'lucide-react';
import JSZip from 'jszip';

interface InputModalProps {
  isOpen: boolean;
  initialMethod: 'GITHUB' | 'UPLOAD' | 'PASTE';
  onClose: () => void;
  onSubmit: (files: Record<string, string>, projectName: string, sourceType: 'GITHUB' | 'UPLOAD' | 'PASTE', detail: string) => void;
}

export const InputModal: React.FC<InputModalProps> = ({
  isOpen,
  initialMethod,
  onClose,
  onSubmit
}) => {
  const [method, setMethod] = useState<'GITHUB' | 'UPLOAD' | 'PASTE'>(initialMethod);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // GitHub state
  const [repoUrl, setRepoUrl] = useState('');
  const [branch, setBranch] = useState('main');

  // Paste state
  const [pastedFilename, setPastedFilename] = useState('sampleService.ts');
  const [pastedCode, setPastedCode] = useState(`import crypto from 'crypto';

// Sample function with security flaw & bug
export function processUserToken(userId: string) {
  const SECRET_API_KEY = "sk_live_fake_demo_key_948a8f12c8471";
  
  // Bug: off-by-one boundary
  const items = ["auth", "token", "refresh"];
  for (let i = 0; i <= items.length; i++) {
    console.log(items[i].toUpperCase());
  }

  // Security: weak hashing
  const hash = crypto.createHash("md5").update(userId).digest("hex");
  return { userId, hash, token: SECRET_API_KEY };
}`);

  // Upload state
  const [uploadedFiles, setUploadedFiles] = useState<Record<string, string> | null>(null);
  const [uploadFileName, setUploadFileName] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleZipUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.zip')) {
      setError('Please upload a valid .zip project archive.');
      return;
    }

    try {
      setLoading(true);
      const zip = new JSZip();
      const zipContent = await zip.loadAsync(file);
      const extracted: Record<string, string> = {};

      const validExts = ['.ts', '.tsx', '.js', '.jsx', '.py', '.go', '.java', '.json', '.sql', '.sh', '.html', '.css'];

      const promises: Promise<void>[] = [];

      zipContent.forEach((relativePath, zipEntry) => {
        if (zipEntry.dir) return;
        const lower = relativePath.toLowerCase();
        if (lower.includes('node_modules/') || lower.includes('.git/') || lower.includes('dist/')) return;

        if (validExts.some(ext => lower.endsWith(ext))) {
          promises.push(
            zipEntry.async('text').then(text => {
              if (text.length <= 200_000) {
                extracted[relativePath] = text;
              }
            })
          );
        }
      });

      await Promise.all(promises);

      if (Object.keys(extracted).length === 0) {
        setError('No supported source files (.ts, .js, .py, etc.) found in the archive.');
        setUploadedFiles(null);
      } else {
        setUploadedFiles(extracted);
        setUploadFileName(file.name);
      }
    } catch (err: any) {
      setError('Failed to extract ZIP archive: ' + (err.message || 'Unknown error'));
      setUploadedFiles(null);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (method === 'GITHUB') {
      if (!repoUrl.trim()) {
        setError('Please enter a GitHub repository URL.');
        return;
      }
      setLoading(true);
      try {
        const res = await fetch('/api/github/fetch-repo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ repoUrl: repoUrl.trim(), branch: branch.trim() || 'main' })
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'Failed to fetch repository from GitHub.');
        }
        onSubmit(data.files, data.repoName, 'GITHUB', `${data.repoName} (${data.branch})`);
        onClose();
      } catch (err: any) {
        setError(err.message || 'Failed to connect to GitHub repository.');
      } finally {
        setLoading(false);
      }
    } else if (method === 'UPLOAD') {
      if (!uploadedFiles || Object.keys(uploadedFiles).length === 0) {
        setError('Please upload a project ZIP file containing source code.');
        return;
      }
      const projName = uploadFileName ? uploadFileName.replace(/\.zip$/i, '') : 'uploaded-project';
      onSubmit(uploadedFiles, projName, 'UPLOAD', `${uploadFileName} (${Object.keys(uploadedFiles).length} files)`);
      onClose();
    } else {
      if (!pastedCode.trim()) {
        setError('Please paste source code to analyze.');
        return;
      }
      const files: Record<string, string> = {
        [pastedFilename.trim() || 'snippet.ts']: pastedCode
      };
      onSubmit(files, 'code-snippet', 'PASTE', pastedFilename);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
      <div className="bg-white rounded-xl shadow-xl border border-zinc-200 max-w-xl w-full overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-zinc-200 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-zinc-900">Provide Code for Review</h3>
            <p className="text-xs text-zinc-500">Choose your preferred source input method</p>
          </div>
          <button
            onClick={onClose}
            id="btn-modal-close"
            className="text-zinc-400 hover:text-zinc-600 p-1 rounded-md transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selector */}
        <div className="flex border-b border-zinc-200 bg-zinc-50 px-6 pt-3 gap-2">
          <button
            type="button"
            onClick={() => { setMethod('GITHUB'); setError(null); }}
            id="tab-github"
            className={`flex items-center gap-2 px-3 py-2 text-xs font-medium border-b-2 transition-all ${
              method === 'GITHUB'
                ? 'border-zinc-900 text-zinc-900 bg-white rounded-t-md shadow-xs'
                : 'border-transparent text-zinc-600 hover:text-zinc-900'
            }`}
          >
            <Github className="w-3.5 h-3.5" />
            <span>GitHub Repo</span>
          </button>

          <button
            type="button"
            onClick={() => { setMethod('UPLOAD'); setError(null); }}
            id="tab-upload"
            className={`flex items-center gap-2 px-3 py-2 text-xs font-medium border-b-2 transition-all ${
              method === 'UPLOAD'
                ? 'border-zinc-900 text-zinc-900 bg-white rounded-t-md shadow-xs'
                : 'border-transparent text-zinc-600 hover:text-zinc-900'
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Project ZIP</span>
          </button>

          <button
            type="button"
            onClick={() => { setMethod('PASTE'); setError(null); }}
            id="tab-paste"
            className={`flex items-center gap-2 px-3 py-2 text-xs font-medium border-b-2 transition-all ${
              method === 'PASTE'
                ? 'border-zinc-900 text-zinc-900 bg-white rounded-t-md shadow-xs'
                : 'border-transparent text-zinc-600 hover:text-zinc-900'
            }`}
          >
            <Code2 className="w-3.5 h-3.5" />
            <span>Paste Code</span>
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
          {error && (
            <div className="flex items-start gap-2 p-3 text-xs rounded-md bg-rose-50 text-rose-800 border border-rose-200">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {method === 'GITHUB' && (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1">
                  GitHub Repository URL
                </label>
                <input
                  type="text"
                  placeholder="https://github.com/owner/repository"
                  value={repoUrl}
                  onChange={(e) => setRepoUrl(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-zinc-300 rounded-md focus:outline-hidden focus:ring-2 focus:ring-zinc-900 focus:border-zinc-900"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1">
                  Branch (optional)
                </label>
                <input
                  type="text"
                  placeholder="main"
                  value={branch}
                  onChange={(e) => setBranch(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-zinc-300 rounded-md focus:outline-hidden focus:ring-2 focus:ring-zinc-900 focus:border-zinc-900"
                />
              </div>

              <div className="pt-2">
                <span className="text-xs text-zinc-500 block mb-1.5">Quick popular public examples:</span>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    'nithyakarimilla/codelenssy',
                    'expressjs/express',
                    'lodash/lodash',
                    'facebook/jest'
                  ].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => {
                        setRepoUrl(`https://github.com/${preset}`);
                        setBranch('main');
                      }}
                      className="text-xs px-2 py-1 rounded bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-mono transition-colors"
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {method === 'UPLOAD' && (
            <div className="space-y-4">
              <div className="border-2 border-dashed border-zinc-300 rounded-lg p-6 text-center hover:border-zinc-400 transition-colors">
                <Upload className="w-8 h-8 text-zinc-400 mx-auto mb-2" />
                <p className="text-sm font-medium text-zinc-800">
                  {uploadFileName ? uploadFileName : 'Drop your project .zip archive here'}
                </p>
                <p className="text-xs text-zinc-500 mt-1">
                  {uploadedFiles
                    ? `${Object.keys(uploadedFiles).length} source files indexed and ready`
                    : 'Supports TypeScript, JavaScript, Python, Go, Java archives'}
                </p>
                <label className="mt-4 inline-block px-4 py-2 text-xs font-medium text-zinc-700 bg-zinc-100 hover:bg-zinc-200 rounded-md cursor-pointer transition-colors">
                  <span>Browse files</span>
                  <input
                    type="file"
                    accept=".zip"
                    onChange={handleZipUpload}
                    className="hidden"
                  />
                </label>
              </div>
            </div>
          )}

          {method === 'PASTE' && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <label className="block text-xs font-medium text-zinc-700 mb-1">
                    Virtual File Path
                  </label>
                  <input
                    type="text"
                    value={pastedFilename}
                    onChange={(e) => setPastedFilename(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs font-mono border border-zinc-300 rounded-md focus:outline-hidden focus:ring-1 focus:ring-zinc-900"
                  />
                </div>
                <div className="pt-5 flex gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      setPastedFilename('authController.ts');
                      setPastedCode(`import { Request, Response } from 'express';\n\nexport async function login(req: Request, res: Response) {\n  const { username, password } = req.body;\n  // Hardcoded key\n  const API_KEY = "sk_live_fake_test_key_4981a8f";\n  // SQL injection risk\n  const query = \`SELECT * FROM accounts WHERE user = '\${username}'\`;\n  return res.json({ status: "ok" });\n}`);
                    }}
                    className="text-xs px-2 py-1 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded"
                  >
                    Security Preset
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPastedFilename('orderService.ts');
                      setPastedCode(`export function calculateTotal(items: number[]): number {\n  let sum = 0;\n  // Bug: off-by-one iteration\n  for (let i = 0; i <= items.length; i++) {\n    sum += items[i];\n  }\n  return sum;\n}`);
                    }}
                    className="text-xs px-2 py-1 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded"
                  >
                    Bug Preset
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1">
                  Source Code
                </label>
                <textarea
                  rows={9}
                  value={pastedCode}
                  onChange={(e) => setPastedCode(e.target.value)}
                  className="w-full font-mono text-xs p-3 border border-zinc-300 rounded-md bg-zinc-50 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-zinc-900 focus:border-zinc-900"
                />
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="pt-4 border-t border-zinc-200 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-zinc-700 hover:text-zinc-900 bg-white border border-zinc-200 rounded-md transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              id="btn-start-analysis"
              className="px-5 py-2 text-xs font-semibold text-white bg-zinc-900 hover:bg-zinc-800 disabled:opacity-50 rounded-md shadow-xs transition-colors flex items-center gap-1.5"
            >
              {loading ? (
                <>
                  <span className="w-3 h-3 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                  <span>Processing...</span>
                </>
              ) : (
                <span>Analyze Codebase</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
