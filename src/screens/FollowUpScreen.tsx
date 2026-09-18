import React from 'react';
import {
  AlertTriangle,
  Stethoscope,
  FlaskConical,
  FileText,
  CheckCircle2,
  ArrowLeft,
  Info,
  ShieldCheck
} from 'lucide-react';
import { RiskSummary } from '../types';

interface Props {
  riskSummary: RiskSummary | null;
  onOpenDoctorConsult: () => void;
  onOpenLabBooking: () => void;
  onOpenReports: () => void;
  onBack: () => void;
}

export const FollowUpScreen: React.FC<Props> = ({
  riskSummary,
  onOpenDoctorConsult,
  onOpenLabBooking,
  onOpenReports,
  onBack
}) => {
  return (
    <div className="mx-auto max-w-lg space-y-4 p-4 pb-24 animate-fade-in">
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-xs font-semibold text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back</span>
        </button>
        <span className="rounded-full bg-red-100 px-3 py-0.5 text-xs font-bold text-red-800 border border-red-200">
          Status: Follow-up Recommended
        </span>
      </div>

      <div className="rounded-3xl border border-red-200 bg-white p-5 shadow-xs space-y-4">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-red-100 text-red-700 shrink-0">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Follow-up Recommended</h1>
            <p className="text-xs text-gray-500 mt-0.5">
              Screening analysis detected an unusual multi-check pattern.
            </p>
          </div>
        </div>

        {/* 1. What was detected */}
        <div className="rounded-2xl bg-[#FAF9F6] p-4 border border-gray-200 space-y-2">
          <h2 className="text-xs font-bold uppercase tracking-wider text-gray-700">
            Observations from Recent Checks:
          </h2>
          {riskSummary?.primarySignals && riskSummary.primarySignals.length > 0 ? (
            <div className="space-y-2">
              {riskSummary.primarySignals.map((sig, idx) => (
                <div key={idx} className="flex items-start justify-between text-xs border-b border-gray-100 pb-1.5 last:border-0">
                  <div>
                    <span className="font-bold text-gray-900">{sig.module}</span>
                    <p className="text-[11px] text-gray-600">{sig.note}</p>
                  </div>
                  <span className="font-bold text-gray-800 shrink-0 ml-2">{sig.value}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-gray-600">
              Resting heart rate elevation (+15% above baseline) and irregular acoustic interval signals.
            </p>
          )}
        </div>

        {/* 2. What this DOES NOT mean (Crucial safety distinction) */}
        <div className="rounded-2xl bg-amber-50/70 p-4 border border-amber-200 space-y-1.5 text-xs text-amber-950">
          <div className="font-bold text-amber-900 flex items-center gap-1.5">
            <ShieldCheck className="h-4 w-4 text-amber-700" />
            <span>What this result does NOT mean:</span>
          </div>
          <ul className="list-disc pl-4 space-y-1 text-amber-900/90 leading-relaxed">
            <li>It does <strong>NOT</strong> mean you have heart disease, arrhythmia, or infection.</li>
            <li>It is <strong>NOT</strong> a clinical diagnosis.</li>
            <li>Variances can arise from caffeine, anxiety, poor sleep, or minor sensor movement.</li>
            <li>Only a certified healthcare professional can assess your medical state.</li>
          </ul>
        </div>

        {/* 3. Suggested Next Steps & CTAs */}
        <div className="space-y-2.5 pt-1">
          <span className="text-xs font-bold uppercase tracking-wider text-gray-500 block">
            Recommended Action Pathway:
          </span>

          <button
            onClick={onOpenDoctorConsult}
            className="flex w-full items-center justify-between rounded-2xl bg-[#15803D] p-3.5 text-white shadow hover:bg-[#166534] transition-all"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/20">
                <Stethoscope className="h-5 w-5" />
              </div>
              <div className="text-left">
                <div className="text-sm font-bold">Talk to a Verified Doctor</div>
                <div className="text-[11px] text-green-100">Consult general physicians & cardiologists</div>
              </div>
            </div>
            <span className="rounded-lg bg-white px-2.5 py-1 text-xs font-bold text-[#15803D]">
              Book
            </span>
          </button>

          <button
            onClick={onOpenLabBooking}
            className="flex w-full items-center justify-between rounded-2xl border border-gray-300 bg-white p-3.5 text-gray-900 hover:bg-gray-50 transition-all shadow-2xs"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-50 text-teal-700">
                <FlaskConical className="h-5 w-5" />
              </div>
              <div className="text-left">
                <div className="text-sm font-bold">Book Diagnostic Laboratory Test</div>
                <div className="text-[11px] text-gray-500">Home sample collection by Thyrocare / Lal PathLabs</div>
              </div>
            </div>
            <span className="text-xs font-bold text-gray-600">Explore</span>
          </button>

          <button
            onClick={onOpenReports}
            className="flex w-full items-center justify-between rounded-2xl border border-gray-300 bg-white p-3.5 text-gray-900 hover:bg-gray-50 transition-all shadow-2xs"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-50 text-purple-700">
                <FileText className="h-5 w-5" />
              </div>
              <div className="text-left">
                <div className="text-sm font-bold">Export Health Summary (PDF)</div>
                <div className="text-[11px] text-gray-500">Structured report to share with your physician</div>
              </div>
            </div>
            <span className="text-xs font-bold text-gray-600">Export</span>
          </button>
        </div>
      </div>
    </div>
  );
};
