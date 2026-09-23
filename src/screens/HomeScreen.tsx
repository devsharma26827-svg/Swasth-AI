import React, { useEffect } from 'react';
import {
  Activity,
  Heart,
  TrendingUp,
  FileText,
  Calendar,
  ShieldCheck,
  ChevronRight,
  Wind,
  Footprints,
  Scale,
  Mic,
  AlertTriangle,
  Stethoscope,
  FlaskConical
} from 'lucide-react';
import { UserProfile, RiskSummary, HealthStatus } from '../types';

interface Props {
  profile: UserProfile;
  riskSummary: RiskSummary | null;
  onStartCheckup: () => void;
  onNavigateTab: (tab: 'trends' | 'reports') => void;
  onOpenDoctorConsult: () => void;
  onOpenLabBooking: () => void;
  onOpenFollowUp: () => void;
}

export const HomeScreen: React.FC<Props> = ({
  profile,
  riskSummary,
  onStartCheckup,
  onNavigateTab,
  onOpenDoctorConsult,
  onOpenLabBooking,
  onOpenFollowUp
}) => {
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, []);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const getStatusBadge = (status: HealthStatus) => {
    switch (status) {
      case 'normal':
        return (
          <span className="rounded-full bg-[#E8F5E9] px-2 py-0.5 text-[10px] font-bold text-[#166534] border border-[#C8E6C9]">
            Normal
          </span>
        );
      case 'monitor':
        return (
          <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-800 border border-amber-200">
            Monitor
          </span>
        );
      case 'follow_up':
        return (
          <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-800 border border-red-200">
            Follow-up
          </span>
        );
      case 'no_valid_results':
      case 'not_tested':
        return (
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-bold text-gray-700 border border-gray-200">
            No Tests Run
          </span>
        );
      default:
        return (
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-bold text-gray-700">
            Needs data
          </span>
        );
    }
  };

  const overallStatus = riskSummary?.overallStatus || 'normal';

  return (
    <div className="mx-auto max-w-lg space-y-4 p-4 pb-24 animate-fade-in">
      {/* 1. Greeting & Hero Snapshot */}
      <div className="rounded-3xl border border-[#EAE7DE] bg-white p-5 shadow-xs">
        <div className="flex items-start justify-between">
          <div>
            <span className="text-xs font-semibold text-gray-500">
              {getGreeting()}, {profile.name.split(' ')[0]}
            </span>
            <h1 className="text-xl font-black text-[#1F2421] mt-0.5">Your Health Snapshot</h1>
          </div>
          <div className="text-right">
            <span className="text-[10px] font-bold uppercase text-gray-500 block">Overall State</span>
            <div className="mt-1">{getStatusBadge(overallStatus)}</div>
          </div>
        </div>

        {/* Dynamic Risk Insight Banner */}
        <div
          className={`mt-4 rounded-2xl p-4 border transition-all ${
            overallStatus === 'normal'
              ? 'bg-[#F4F9F4] border-[#C8E6C9] text-[#1B4D24]'
              : overallStatus === 'monitor'
              ? 'bg-[#FFFBEB] border-amber-200 text-amber-950'
              : overallStatus === 'no_valid_results' || overallStatus === 'not_tested'
              ? 'bg-[#F9FAFB] border-gray-200 text-gray-800'
              : 'bg-[#FEF2F2] border-red-200 text-red-950'
          }`}
        >
          <div className="flex items-start gap-2.5">
            {overallStatus === 'normal' ? (
              <ShieldCheck className="h-5 w-5 text-[#15803D] shrink-0 mt-0.5" />
            ) : overallStatus === 'no_valid_results' || overallStatus === 'not_tested' ? (
              <Activity className="h-5 w-5 text-gray-500 shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            )}
            <div>
              <h2 className="text-xs font-bold leading-tight">
                {overallStatus === 'normal'
                  ? 'Personal monitoring range stable'
                  : overallStatus === 'monitor'
                  ? 'Slight variance from usual trend'
                  : overallStatus === 'no_valid_results' || overallStatus === 'not_tested'
                  ? 'No screening tests run yet'
                  : 'Pattern requires clinical follow-up'}
              </h2>
              <p className="mt-1 text-[11px] leading-relaxed opacity-90">
                {riskSummary?.trendInsight ||
                  (overallStatus === 'no_valid_results'
                    ? 'Start a checkup to record your resting pulse, heart sound, or cough screening.'
                    : 'Your recent measurements indicate consistent cardiovascular and respiratory equilibrium.')}
              </p>

              {overallStatus === 'follow_up' && (
                <button
                  onClick={onOpenFollowUp}
                  className="mt-2.5 inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-bold text-white shadow-2xs hover:bg-red-700"
                >
                  <span>Review Clinical Recommendations</span>
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Today's Check-in Card */}
        <div className="mt-4 rounded-2xl bg-[#FAF9F6] p-4 border border-[#E8E4D9] swasth-soft-glow">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500">
                Today's Check-in
              </span>
              <h2 className="text-sm font-bold text-gray-900 mt-0.5">Routine Daily Protocol</h2>
            </div>
            <span className="rounded-full bg-white px-2.5 py-1 text-xs font-black text-[#15803D] border border-gray-200 shadow-2xs">
              4/4 Done
            </span>
          </div>

          <div className="mt-3 flex items-center gap-2">
            <button
              onClick={onStartCheckup}
              className="flex-1 rounded-xl bg-[#15803D] py-3 text-xs font-bold text-white shadow hover:bg-[#166534] transition-all flex items-center justify-center gap-1.5 swasth-shimmer"
            >
              <Activity className="h-4 w-4" />
              <span>Start New Checkup</span>
            </button>
            <button
              onClick={() => onNavigateTab('trends')}
              className="rounded-xl border border-gray-300 bg-white px-3.5 py-3 text-xs font-bold text-gray-700 hover:bg-gray-50 shadow-2xs"
            >
              Trends
            </button>
          </div>
        </div>
      </div>

      {/* 2. Quick Measurement Cards Grid */}
      <div>
        <div className="flex items-center justify-between px-1 mb-2">
          <span className="text-xs font-bold uppercase tracking-wider text-gray-500">
            Latest Monitoring Signals
          </span>
          <button
            onClick={() => onNavigateTab('trends')}
            className="text-xs font-bold text-[#15803D] hover:underline"
          >
            View all trends
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          {/* Heart Rate */}
          <div className="rounded-2xl border border-[#EAE7DE] bg-white p-3.5 shadow-2xs">
            <div className="flex items-center justify-between">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-red-50 text-red-600">
                <Heart className="h-4 w-4" />
              </div>
              {getStatusBadge('normal')}
            </div>
            <div className="mt-2.5 text-xl font-black text-gray-900">
              72 <span className="text-xs font-normal text-gray-500">BPM</span>
            </div>
            <div className="text-[11px] font-medium text-gray-700 mt-0.5">Resting Heart Rate</div>
            <div className="text-[10px] text-gray-500 mt-1">Trend: Stable (+1%) • Camera PPG</div>
          </div>

          {/* HRV */}
          <div className="rounded-2xl border border-[#EAE7DE] bg-white p-3.5 shadow-2xs">
            <div className="flex items-center justify-between">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-purple-50 text-purple-600">
                <Activity className="h-4 w-4" />
              </div>
              {getStatusBadge('normal')}
            </div>
            <div className="mt-2.5 text-xl font-black text-gray-900">
              48 <span className="text-xs font-normal text-gray-500">ms</span>
            </div>
            <div className="text-[11px] font-medium text-gray-700 mt-0.5">Heart Rate Variability</div>
            <div className="text-[10px] text-gray-500 mt-1">RMSSD index • Vagal tone</div>
          </div>

          {/* SpO2 */}
          <div className="rounded-2xl border border-[#EAE7DE] bg-white p-3.5 shadow-2xs">
            <div className="flex items-center justify-between">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                <Activity className="h-4 w-4" />
              </div>
              {getStatusBadge('normal')}
            </div>
            <div className="mt-2.5 text-xl font-black text-gray-900">
              ~98 <span className="text-xs font-normal text-gray-500">%</span>
            </div>
            <div className="text-[11px] font-medium text-gray-700 mt-0.5">Estimated SpO₂ (Proxy)</div>
            <div className="text-[10px] text-amber-700 font-medium mt-1">Prototype estimate</div>
          </div>

          {/* Weight / BMI */}
          <div className="rounded-2xl border border-[#EAE7DE] bg-white p-3.5 shadow-2xs">
            <div className="flex items-center justify-between">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                <Scale className="h-4 w-4" />
              </div>
              {getStatusBadge('normal')}
            </div>
            <div className="mt-2.5 text-xl font-black text-gray-900">
              23.1 <span className="text-xs font-normal text-gray-500">kg/m²</span>
            </div>
            <div className="text-[11px] font-medium text-gray-700 mt-0.5">BMI / 71.5 kg</div>
            <div className="text-[10px] text-gray-500 mt-1">-0.2 kg in past 7 days</div>
          </div>

          {/* Walking Cadence */}
          <div className="rounded-2xl border border-[#EAE7DE] bg-white p-3.5 shadow-2xs">
            <div className="flex items-center justify-between">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
                <Footprints className="h-4 w-4" />
              </div>
              {getStatusBadge('normal')}
            </div>
            <div className="mt-2.5 text-xl font-black text-gray-900">
              105 <span className="text-xs font-normal text-gray-500">spm</span>
            </div>
            <div className="text-[11px] font-medium text-gray-700 mt-0.5">Walking Cadence</div>
            <div className="text-[10px] text-gray-500 mt-1">Symmetry 92% • Balanced</div>
          </div>

          {/* Respiratory / Cough */}
          <div className="rounded-2xl border border-[#EAE7DE] bg-white p-3.5 shadow-2xs">
            <div className="flex items-center justify-between">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-teal-50 text-teal-600">
                <Wind className="h-4 w-4" />
              </div>
              {getStatusBadge('normal')}
            </div>
            <div className="mt-2.5 text-base font-bold text-gray-900 capitalize">Clear Airflow</div>
            <div className="text-[11px] font-medium text-gray-700 mt-0.5">Respiratory Screen</div>
            <div className="text-[10px] text-gray-500 mt-1">No wheeze detected</div>
          </div>
        </div>
      </div>

      {/* 3. Fast Action Shortcuts: Doctor Consult & Lab Booking */}
      <div className="rounded-3xl border border-[#EAE7DE] bg-white p-4 shadow-xs space-y-3">
        <span className="text-xs font-bold uppercase tracking-wider text-gray-500 block">
          Healthcare Handoffs & Action
        </span>

        <div className="grid grid-cols-2 gap-2.5">
          <button
            onClick={onOpenDoctorConsult}
            className="flex items-start gap-2.5 rounded-2xl border border-gray-200 bg-[#FAF9F6] p-3 text-left hover:border-gray-300 hover:bg-white transition-all shadow-2xs"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-50 text-blue-700 shrink-0">
              <Stethoscope className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-xs font-bold text-gray-900 leading-tight">Doctor Consult</h2>
              <p className="text-[10px] text-gray-500 mt-0.5">Verified Indian physicians</p>
            </div>
          </button>

          <button
            onClick={onOpenLabBooking}
            className="flex items-start gap-2.5 rounded-2xl border border-gray-200 bg-[#FAF9F6] p-3 text-left hover:border-gray-300 hover:bg-white transition-all shadow-2xs"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-teal-50 text-teal-700 shrink-0">
              <FlaskConical className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-xs font-bold text-gray-900 leading-tight">Book Lab Test</h2>
              <p className="text-[10px] text-gray-500 mt-0.5">Home sample collection</p>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};
