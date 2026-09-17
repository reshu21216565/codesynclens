"use client";
import React from "react";
import {
  Shield,
  Terminal,
  FileCode,
  Github,
  CheckCircle2,
  Lock,
  ExternalLink,
  Cpu,
  Mail,
  HelpCircle,
  BookOpen,
} from "lucide-react";
import { TextHoverEffect, FooterBackgroundGradient } from "@/components/ui/hover-footer";

interface CodeLensFooterProps {
  onNewAnalysis?: () => void;
  onOpenIntegrations?: () => void;
  onLoadDemo?: () => void;
  onSelectView?: (view: 'code' | 'security') => void;
}

export const CodeLensFooter: React.FC<CodeLensFooterProps> = ({
  onNewAnalysis,
  onOpenIntegrations,
  onLoadDemo,
  onSelectView,
}) => {
  return (
    <footer className="relative bg-zinc-950 text-zinc-300 rounded-3xl overflow-hidden mt-16 mx-3 sm:mx-6 lg:mx-8 mb-8 border border-zinc-800 shadow-2xl">
      <div className="max-w-7xl mx-auto px-6 sm:px-10 lg:px-14 pt-12 pb-10 z-40 relative">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10 lg:gap-14 pb-10 border-b border-zinc-800/80">
          {/* Brand section */}
          <div className="flex flex-col space-y-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-zinc-900 border border-zinc-700/80 flex items-center justify-center font-bold text-white text-base shadow-sm">
                CL
              </div>
              <div className="flex flex-col">
                <span className="text-white text-xl font-bold tracking-tight">CodeLens</span>
                <span className="text-[11px] text-zinc-400 font-mono">Static & Dynamic AppSec</span>
              </div>
            </div>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Automated dual-engine code review and black-box dynamic security verification powered by deep AST analysis and SentinelAI.
            </p>
            <div className="flex items-center gap-2 pt-1">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                Deep Eye DAST Engine v1.4.0
              </span>
            </div>
          </div>

          {/* Analysis & Engine section */}
          <div>
            <h4 className="text-white text-sm font-semibold mb-4 tracking-wide uppercase text-zinc-200">
              Audit Capabilities
            </h4>
            <ul className="space-y-2.5 text-xs">
              <li>
                <button
                  type="button"
                  onClick={onNewAnalysis}
                  className="hover:text-[#3ca2fa] transition-colors flex items-center gap-2 text-zinc-400 hover:text-zinc-200"
                >
                  <FileCode className="w-3.5 h-3.5 text-[#3ca2fa]" />
                  <span>Full AST Code Inspection</span>
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onSelectView?.('security')}
                  className="hover:text-[#3ca2fa] transition-colors flex items-center gap-2 text-zinc-400 hover:text-zinc-200"
                >
                  <Shield className="w-3.5 h-3.5 text-emerald-400" />
                  <span>DAST Security Validation</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-300 font-mono">LIVE</span>
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={onLoadDemo}
                  className="hover:text-[#3ca2fa] transition-colors flex items-center gap-2 text-zinc-400 hover:text-zinc-200"
                >
                  <Terminal className="w-3.5 h-3.5 text-amber-400" />
                  <span>Interactive Demo Sandbox</span>
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={onOpenIntegrations}
                  className="hover:text-[#3ca2fa] transition-colors flex items-center gap-2 text-zinc-400 hover:text-zinc-200"
                >
                  <Cpu className="w-3.5 h-3.5 text-purple-400" />
                  <span>LLM Provider Hub</span>
                </button>
              </li>
            </ul>
          </div>

          {/* Compliance & Standards */}
          <div>
            <h4 className="text-white text-sm font-semibold mb-4 tracking-wide uppercase text-zinc-200">
              Security Standards
            </h4>
            <ul className="space-y-2.5 text-xs text-zinc-400">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#3ca2fa]" />
                <span>OWASP Top 10 Web 2025</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#3ca2fa]" />
                <span>CWE Top 25 Most Dangerous</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#3ca2fa]" />
                <span>Deterministic CVSS / DREAD Scoring</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#3ca2fa]" />
                <span>Executive PDF Audit Generation</span>
              </li>
            </ul>
          </div>

          {/* Assistant & Contact */}
          <div>
            <h4 className="text-white text-sm font-semibold mb-4 tracking-wide uppercase text-zinc-200">
              SentinelAI Ecosystem
            </h4>
            <p className="text-xs text-zinc-400 mb-3">
              Context-aware security assistant synchronized with dynamic scan evidence and automated remediation recipes.
            </p>
            <div className="p-3 rounded-xl bg-zinc-900/80 border border-zinc-800 text-[11px] space-y-1.5">
              <div className="flex items-center justify-between text-zinc-300 font-semibold">
                <span className="flex items-center gap-1.5">
                  <Lock className="w-3 h-3 text-emerald-400" /> Zero Data Retention
                </span>
                <span className="text-[10px] text-zinc-500 font-mono">SANDBOXED</span>
              </div>
              <p className="text-[10px] text-zinc-400">
                Code and dynamic payloads are evaluated within isolated container bounds.
              </p>
            </div>
          </div>
        </div>

        {/* Footer bottom */}
        <div className="pt-8 flex flex-col md:flex-row justify-between items-center text-xs text-zinc-500 space-y-4 md:space-y-0">
          <div className="flex items-center space-x-4">
            <span className="text-zinc-400 font-medium">CodeLens Security Suite</span>
            <span>•</span>
            <span>Enterprise-Grade Static & Dynamic Analysis</span>
          </div>

          <p className="text-center md:text-right text-[11px]">
            &copy; {new Date().getFullYear()} CodeLens. Built for resilient engineering and continuous application security.
          </p>
        </div>
      </div>

      {/* Interactive Text hover effect */}
      <div className="flex h-48 sm:h-72 md:h-96 lg:h-[26rem] -mt-16 sm:-mt-28 lg:-mt-44 -mb-12 sm:-mb-20 lg:-mb-32 items-center justify-center overflow-hidden">
        <TextHoverEffect text="CODELENS" className="z-50 w-full" />
      </div>

      {/* Subtle radial ambient gradient backdrop */}
      <FooterBackgroundGradient />
    </footer>
  );
};
