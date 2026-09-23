import React, { useState } from 'react';
import {
  User,
  Shield,
  Download,
  RotateCcw,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  Camera,
  Mic,
  Smartphone,
  Save,
  Bell,
  Trash2
} from 'lucide-react';
import { UserProfile, DemoScenario } from '../types';
import { profileApi, consentApi, dataApi, scenarioApi } from '../services/api';

interface Props {
  profile: UserProfile;
  currentScenario: DemoScenario;
  onUpdateProfile: (p: UserProfile) => void;
  onScenarioChange: (s: DemoScenario) => void;
  onResetDemoData: () => void;
  onOpenAuth?: () => void;
  onLogout?: () => void;
}

export const ProfileScreen: React.FC<Props> = ({
  profile,
  currentScenario,
  onUpdateProfile,
  onScenarioChange,
  onResetDemoData,
  onOpenAuth,
  onLogout
}) => {
  const [name, setName] = useState(profile.name);
  const [age, setAge] = useState(profile.age);
  const [height, setHeight] = useState<number>(profile.height || 170);
  const [weight, setWeight] = useState(profile.weight);
  const [conditions, setConditions] = useState(profile.existingConditions.join(', '));
  const [medications, setMedications] = useState(profile.medications || '');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const [showResetConfirm, setShowResetConfirm] = useState(false);

  // Consent states
  const [hasConsented, setHasConsented] = useState(true);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showRevokeConfirm, setShowRevokeConfirm] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setStatusMessage(null);

    const parsedHeight = Number(height);
    if (isNaN(parsedHeight) || parsedHeight < 50 || parsedHeight > 250) {
      setStatusMessage({ type: 'error', text: 'Please enter height in cm between 50 and 250.' });
      setIsSaving(false);
      return;
    }

    try {
      const res = await profileApi.update({
        name,
        age: Number(age),
        height: parsedHeight,
        weight: Number(weight),
        existingConditions: conditions ? conditions.split(',').map(s => s.trim()) : [],
        medications
      });
      onUpdateProfile(res.profile);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      console.error(err);
      setStatusMessage({ type: 'error', text: err.message || 'Failed to update profile.' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleExport = async (format: 'json' | 'csv') => {
    setStatusMessage(null);
    try {
      const data = await dataApi.exportData(format);
      const blob = new Blob(
        [format === 'json' ? JSON.stringify(data, null, 2) : data],
        { type: format === 'json' ? 'application/json' : 'text/csv' }
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `SwasthAI_Health_Export_${new Date().toISOString().slice(0, 10)}.${format}`;
      a.click();
      setStatusMessage({ type: 'success', text: `Health data successfully exported as .${format}` });
    } catch (e: any) {
      setStatusMessage({ type: 'error', text: e.message || 'Data export failed.' });
    }
  };

  const handleRevokeConsent = async () => {
    await consentApi.revoke('safety_and_clinical_disclaimer');
    setHasConsented(false);
    setShowRevokeConfirm(false);
    setStatusMessage({ type: 'success', text: 'Consent revoked. Sensor screenings paused.' });
  };

  const scenarios: { id: DemoScenario; name: string; desc: string }[] = [
    {
      id: 'normal',
      name: 'Baseline Normal',
      desc: 'Normal heart rate (72 bpm), healthy RMSSD (48 ms), steady walking cadence, clear cough.'
    },
    {
      id: 'mild_arrhythmia',
      name: 'Elevated HR & Varied Intervals',
      desc: 'Resting pulse ~98 bpm, elevated RMSSD variance, triggers "Monitor / Follow-up" trend.'
    },
    {
      id: 'respiratory_pattern',
      name: 'Respiratory Flow Resistance',
      desc: 'Simulates cough burst with minor harmonic turbulence; triggers respiratory follow-up.'
    },
    {
      id: 'gait_irregularity',
      name: 'Gait Cadence Asymmetry',
      desc: 'Simulates stride asymmetry index (76%) & cadence variability (88 ms).'
    }
  ];

  return (
    <div className="mx-auto max-w-lg space-y-4 p-4 pb-24 animate-fade-in">
      {statusMessage && (
        <div
          className={`rounded-2xl p-3 text-xs font-bold border transition-all ${
            statusMessage.type === 'success'
              ? 'bg-green-50 text-green-800 border-green-200'
              : 'bg-red-50 text-red-800 border-red-200'
          }`}
        >
          {statusMessage.text}
        </div>
      )}

      <div className="rounded-3xl border border-[#EAE7DE] bg-white p-5 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#E8F5E9] text-[#15803D] font-black text-lg">
            {profile.name
              .split(' ')
              .map(n => n[0])
              .join('')}
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-900">{profile.name}</h1>
            <p className="text-xs text-gray-500">{profile.email}</p>
          </div>
        </div>

        {/* Profile form */}
        <form onSubmit={handleSave} className="mt-5 space-y-3 text-xs">
          <span className="font-bold text-gray-700 block uppercase tracking-wider text-[10px]">
            Physiological Parameters
          </span>

          <div>
            <label className="font-semibold text-gray-700">Display Name</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              className="mt-1 w-full rounded-xl border border-gray-200 p-2.5 font-medium text-gray-900 focus:border-[#15803D] focus:outline-hidden"
            />
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="font-semibold text-gray-700">Age</label>
              <input
                type="number"
                value={age}
                onChange={e => setAge(Number(e.target.value))}
                className="mt-1 w-full rounded-xl border border-gray-200 p-2.5 font-medium text-gray-900 focus:border-[#15803D] focus:outline-hidden"
              />
            </div>
            <div>
              <label className="font-semibold text-gray-700">Height (cm)</label>
              <input
                type="number"
                value={height}
                onChange={e => setHeight(Number(e.target.value))}
                className="mt-1 w-full rounded-xl border border-gray-200 p-2.5 font-medium text-gray-900 focus:border-[#15803D] focus:outline-hidden"
              />
            </div>
            <div>
              <label className="font-semibold text-gray-700">Weight (kg)</label>
              <input
                type="number"
                step="0.5"
                value={weight}
                onChange={e => setWeight(Number(e.target.value))}
                className="mt-1 w-full rounded-xl border border-gray-200 p-2.5 font-medium text-gray-900 focus:border-[#15803D] focus:outline-hidden"
              />
            </div>
          </div>

          <div>
            <label className="font-semibold text-gray-700">Pre-existing Conditions</label>
            <input
              type="text"
              value={conditions}
              onChange={e => setConditions(e.target.value)}
              className="mt-1 w-full rounded-xl border border-gray-200 p-2.5 font-medium text-gray-900 focus:border-[#15803D] focus:outline-hidden"
            />
          </div>

          <div>
            <label className="font-semibold text-gray-700">Regular Medications</label>
            <input
              type="text"
              value={medications}
              onChange={e => setMedications(e.target.value)}
              className="mt-1 w-full rounded-xl border border-gray-200 p-2.5 font-medium text-gray-900 focus:border-[#15803D] focus:outline-hidden"
            />
          </div>

          <div className="pt-2 flex items-center justify-between">
            <button
              type="submit"
              disabled={isSaving}
              className="flex items-center gap-2 rounded-xl bg-[#15803D] px-5 py-2.5 text-xs font-bold text-white shadow hover:bg-[#166534] transition-all disabled:opacity-50"
            >
              <Save className="h-3.5 w-3.5" />
              <span>{isSaving ? 'Updating...' : 'Save Profile'}</span>
            </button>
            {saveSuccess && (
              <span className="flex items-center gap-1 text-xs font-semibold text-green-700">
                <CheckCircle2 className="h-4 w-4" />
                <span>Profile updated</span>
              </span>
            )}
          </div>
        </form>
      </div>

      {/* 2. DEMO & SIMULATION CONTROL PANEL */}
      <div className="rounded-3xl border border-[#EAE7DE] bg-white p-5 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sliders className="h-4 w-4 text-[#15803D]" />
            <h2 className="text-sm font-bold text-gray-900">Demo Scenario Controller</h2>
          </div>
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
            Developer / Jury Mode
          </span>
        </div>

        <p className="text-xs text-gray-500">
          Switch test scenarios to evaluate how SwasthSense's heuristic risk engine and clinician recommendations react to various physiological states.
        </p>

        <div className="space-y-2">
          {scenarios.map(sc => (
            <button
              key={sc.id}
              type="button"
              onClick={() => onScenarioChange(sc.id)}
              className={`w-full p-3 rounded-2xl border text-left text-xs transition-all ${
                currentScenario === sc.id
                  ? 'border-[#15803D] bg-[#E8F5E9] text-gray-900 shadow-2xs font-bold'
                  : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              <div className="flex items-center justify-between">
                <span>{sc.name}</span>
                {currentScenario === sc.id && (
                  <CheckCircle2 className="h-4 w-4 text-[#15803D]" />
                )}
              </div>
              <p className="text-[11px] text-gray-500 font-normal mt-0.5">{sc.desc}</p>
            </button>
          ))}
        </div>

        {/* Sensor Hardware Status */}
        <div className="rounded-2xl bg-[#FAF9F6] p-3 border border-gray-200 space-y-1.5 text-xs text-gray-600">
          <span className="font-bold text-gray-800 block mb-1">Hardware Sensor Availability:</span>
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Camera className="h-3.5 w-3.5 text-blue-600" />
              <span>Camera Video & Torch API</span>
            </span>
            <span className="text-green-700 font-bold">Ready</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Mic className="h-3.5 w-3.5 text-purple-600" />
              <span>Web Audio Microphone Analyzer</span>
            </span>
            <span className="text-green-700 font-bold">Ready</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Smartphone className="h-3.5 w-3.5 text-amber-600" />
              <span>DeviceMotion / Synthetic Telemetry</span>
            </span>
            <span className="text-green-700 font-bold">Ready</span>
          </div>
        </div>
      </div>

      {/* 3. CONSENT & PRIVACY MANAGEMENT */}
      <div className="rounded-3xl border border-[#EAE7DE] bg-white p-5 shadow-xs space-y-3">
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-[#15803D]" />
          <h2 className="text-sm font-bold text-gray-900">Consent & Data Governance</h2>
        </div>

        <div className="rounded-2xl bg-gray-50 p-3 text-xs text-gray-700 border border-gray-200">
          <div className="flex items-center justify-between">
            <span>Safety & Clinical Disclaimer (v2.1)</span>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                hasConsented ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
              }`}
            >
              {hasConsented ? 'Accepted' : 'Revoked'}
            </span>
          </div>
          <p className="text-[11px] text-gray-500 mt-1">
            Explicit consent is required for collecting optical and acoustic smartphone measurements.
          </p>
        </div>

        {hasConsented && (
          <div>
            {!showRevokeConfirm ? (
              <button
                type="button"
                onClick={() => setShowRevokeConfirm(true)}
                className="text-xs font-semibold text-red-600 hover:text-red-700 hover:underline"
              >
                Revoke Consent & Pause Screening
              </button>
            ) : (
              <div className="rounded-xl bg-red-50 p-2.5 border border-red-200 text-xs space-y-2">
                <span className="text-red-900 font-semibold block">Revoke clinical consent? Future sensor checkups will be paused.</span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleRevokeConsent}
                    className="rounded-lg bg-red-600 px-3 py-1 font-bold text-white text-[11px]"
                  >
                    Confirm Revoke
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowRevokeConfirm(false)}
                    className="rounded-lg bg-white border border-gray-300 px-3 py-1 font-bold text-gray-700 text-[11px]"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 4. ACCOUNT & PATIENT SESSION */}
      <div className="rounded-3xl border border-[#EAE7DE] bg-white p-5 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-gray-900">Patient Account &amp; Session</h2>
            <p className="text-xs text-gray-500">Authenticated user identity &amp; data privacy</p>
          </div>
          <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-[10px] font-extrabold text-green-800 border border-green-200">
            Active Patient
          </span>
        </div>

        <div className="rounded-2xl bg-[#F8F7F2] p-3 text-xs space-y-1.5 border border-gray-200">
          <div className="flex justify-between">
            <span className="text-gray-500">Patient Name:</span>
            <span className="font-semibold text-gray-800">{profile.name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Immutable User ID:</span>
            <span className="font-mono text-[11px] text-gray-800 font-bold">{profile.id}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Registered Email:</span>
            <span className="font-semibold text-gray-800">{profile.email}</span>
          </div>
        </div>

        <div className="flex gap-2 pt-1">
          {onOpenAuth && (
            <button
              type="button"
              onClick={onOpenAuth}
              className="flex-1 items-center justify-center rounded-xl border border-gray-300 bg-white py-2.5 text-xs font-bold text-gray-700 hover:bg-gray-50 shadow-2xs transition-all"
            >
              Switch / Sign In
            </button>
          )}
          {onLogout && (
            <button
              type="button"
              onClick={onLogout}
              className="flex-1 items-center justify-center rounded-xl border border-red-200 bg-red-50 py-2.5 text-xs font-bold text-red-700 hover:bg-red-100 shadow-2xs transition-all"
            >
              Sign Out
            </button>
          )}
        </div>
      </div>

      {/* 5. DATA EXPORT & RESET */}
      <div className="rounded-3xl border border-[#EAE7DE] bg-white p-5 shadow-xs space-y-3">
        <h2 className="text-sm font-bold text-gray-900">Data Portability & State</h2>

        <div className="grid grid-cols-2 gap-2 text-xs">
          <button
            onClick={() => handleExport('json')}
            className="flex items-center justify-center gap-1.5 rounded-xl border border-gray-300 bg-white p-2.5 font-bold text-gray-700 hover:bg-gray-50 shadow-2xs"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Export (JSON)</span>
          </button>
          <button
            onClick={() => handleExport('csv')}
            className="flex items-center justify-center gap-1.5 rounded-xl border border-gray-300 bg-white p-2.5 font-bold text-gray-700 hover:bg-gray-50 shadow-2xs"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Export (CSV)</span>
          </button>
        </div>

        {!showResetConfirm ? (
          <button
            onClick={() => setShowResetConfirm(true)}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gray-100 py-3 text-xs font-bold text-gray-700 hover:bg-gray-200 transition-all"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>Restore Initial Demo Baseline</span>
          </button>
        ) : (
          <div className="rounded-xl bg-amber-50 p-2.5 border border-amber-200 text-xs space-y-2">
            <span className="text-amber-900 font-semibold block">Reset demo state to initial seed parameters?</span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  onResetDemoData();
                  setShowResetConfirm(false);
                  setStatusMessage({ type: 'success', text: 'Demo baseline restored.' });
                }}
                className="rounded-lg bg-amber-600 px-3 py-1 font-bold text-white text-[11px]"
              >
                Yes, Reset Data
              </button>
              <button
                type="button"
                onClick={() => setShowResetConfirm(false)}
                className="rounded-lg bg-white border border-gray-300 px-3 py-1 font-bold text-gray-700 text-[11px]"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
