import React from 'react';
import { ShieldAlert, Smartphone, Monitor, ChevronDown, CheckCircle2, Shield } from 'lucide-react';
import { DemoScenario } from '../types';

interface Props {
  currentScenario?: DemoScenario;
  scenario?: DemoScenario; // backwards compatibility
  onScenarioChange?: (scenario: DemoScenario) => void;
  isMobileFrame?: boolean;
  onToggleFrame?: () => void;
  onOpenEmergency: () => void;
  onOpenAuth?: () => void;
  userName?: string;
}

export const Header: React.FC<Props> = ({
  currentScenario = 'normal',
  scenario,
  onScenarioChange,
  isMobileFrame = false,
  onToggleFrame,
  onOpenEmergency,
  onOpenAuth,
  userName
}) => {
  const activeScenario = scenario || currentScenario;
  return (
    <header className="sticky top-0 z-40 border-b border-[#EAE7DE] bg-[#FDFCF9]/95 backdrop-blur-md px-4 py-2.5 transition-all">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-2">
        {/* Brand & Identity */}
        <div className="flex items-center gap-2.5">
          <img
            src="/swasthsense-logo.png"
            alt="SwasthSense Logo"
            className="h-10 w-10 sm:h-11 sm:w-11 object-contain shrink-0"
          />
          <div>
            <div className="flex items-center gap-2">
              <span className="text-base font-extrabold tracking-tight text-[#1F2421]">SwasthSense</span>
              <span className="rounded-full bg-[#E8F5E9] px-2 py-0.5 text-[10px] font-semibold text-[#166534] border border-[#C8E6C9]">
                Patient Portal
              </span>
            </div>
            <p className="text-[11px] text-[#5C645D]">
              Your Smart Health Screening Assistant
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {/* Demo Scenario Selector */}
          {onScenarioChange && (
            <div className="relative flex items-center">
              <label htmlFor="scenario-select" className="sr-only">Select Demo Scenario</label>
              <div className="hidden text-[11px] font-medium text-gray-500 md:block mr-1.5">
                Scenario:
              </div>
              <div className="relative">
                <select
                  id="scenario-select"
                  value={activeScenario}
                  onChange={e => onScenarioChange(e.target.value as DemoScenario)}
                  className="appearance-none rounded-lg border border-[#DDD8CE] bg-white py-1.5 pl-2.5 pr-7 text-xs font-semibold text-[#2C332E] shadow-2xs hover:border-[#15803D] focus:outline-hidden focus:ring-1 focus:ring-[#15803D]"
                >
                  <option value="normal">🟢 Stable Health (Normal)</option>
                  <option value="monitor">🟡 Needs Monitoring</option>
                  <option value="follow_up">🔴 Follow-up Recommended</option>
                  <option value="low_quality">⚪ Low Signal Quality</option>
                </select>
                <ChevronDown className="pointer-events-none absolute right-2 top-2.5 h-3.5 w-3.5 text-gray-400" />
              </div>
            </div>
          )}

          {/* Account status or switch */}
          {onOpenAuth && (
            <button
              onClick={onOpenAuth}
              title="Switch or manage patient account"
              className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-bold text-gray-700 hover:bg-gray-50 shadow-2xs"
            >
              <span className="hidden sm:inline">{userName ? userName.split(' ')[0] : 'Account'}</span>
              <span className="text-[10px] text-[#15803D] font-extrabold">•</span>
            </button>
          )}

          {/* Device Frame Toggle */}
          {onToggleFrame && (
            <button
              onClick={onToggleFrame}
              title={isMobileFrame ? 'Expand to Responsive Web Layout' : 'Switch to Mobile Frame'}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#DDD8CE] bg-white text-gray-700 hover:bg-gray-50 hover:text-black shadow-2xs"
            >
              {isMobileFrame ? <Monitor className="h-4 w-4" /> : <Smartphone className="h-4 w-4" />}
            </button>
          )}

          {/* Emergency Safety Action */}
          <button
            onClick={onOpenEmergency}
            className="flex items-center gap-1.5 rounded-lg bg-red-50 border border-red-200 px-2.5 py-1.5 text-xs font-bold text-red-700 hover:bg-red-100 shadow-2xs transition-colors"
          >
            <ShieldAlert className="h-3.5 w-3.5 text-red-600" />
            <span className="hidden sm:inline">Emergency Help</span>
            <span className="sm:hidden">Help</span>
          </button>
        </div>
      </div>
    </header>
  );
};
