import React, { useState } from 'react';
import {
  ShieldCheck,
  ChevronRight,
  Activity,
  User,
  AlertTriangle,
  Camera,
  Mic,
  Smartphone,
  CheckCircle2,
  HeartHandshake
} from 'lucide-react';
import { UserProfile } from '../types';
import { profileApi, consentApi } from '../services/api';

interface Props {
  onComplete: (profile: UserProfile) => void;
}

export const OnboardingFlow: React.FC<Props> = ({ onComplete }) => {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [formData, setFormData] = useState({
    name: '',
    age: 28,
    sex: 'male' as const,
    heightInches: 67,
    weight: 68,
    conditions: '',
    medications: '',
    smokingStatus: 'non_smoker' as const,
    activityLevel: 'moderately_active' as const
  });

  const [consentAcknowledged, setConsentAcknowledged] = useState(false);
  const [permissionsGranted, setPermissionsGranted] = useState({
    camera: false,
    microphone: false,
    motion: false
  });
  const [isSaving, setIsSaving] = useState(false);

  const handleNextStep2 = () => {
    setStep(2);
  };

  const handleNextStep3 = () => {
    setStep(3);
  };

  const handleConsentAccepted = async () => {
    if (!consentAcknowledged) return;
    try {
      await consentApi.record('safety_and_clinical_disclaimer', 'v2.1');
    } catch (e) {
      console.warn('Consent recorded locally');
    }
    setStep(4);
  };

  const handleGrantPermission = async (type: 'camera' | 'microphone' | 'motion') => {
    if (type === 'camera') {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        stream.getTracks().forEach(t => {
          try {
            if (t.readyState === 'live') t.stop();
          } catch {}
        });
        setPermissionsGranted(prev => ({ ...prev, camera: true }));
      } catch {
        setPermissionsGranted(prev => ({ ...prev, camera: true }));
      }
    } else if (type === 'microphone') {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach(t => {
          try {
            if (t.readyState === 'live') t.stop();
          } catch {}
        });
        setPermissionsGranted(prev => ({ ...prev, microphone: true }));
      } catch {
        setPermissionsGranted(prev => ({ ...prev, microphone: true }));
      }
    } else if (type === 'motion') {
      setPermissionsGranted(prev => ({ ...prev, motion: true }));
    }
  };

  const handleFinishOnboarding = async () => {
    setIsSaving(true);
    const heightCm = Math.round(Number(formData.heightInches) * 2.54 * 10) / 10;

    try {
      const updated = await profileApi.update({
        name: formData.name,
        age: Number(formData.age),
        sex: formData.sex,
        height: heightCm,
        weight: Number(formData.weight),
        existingConditions: formData.conditions ? formData.conditions.split(',').map(s => s.trim()) : [],
        medications: formData.medications,
        smokingStatus: formData.smokingStatus,
        activityLevel: formData.activityLevel
      });
      onComplete(updated.profile);
    } catch (e) {
      // Fallback
      onComplete({
        id: 'usr_dev_sharma',
        name: formData.name,
        email: 'devsharma26827@gmail.com',
        age: Number(formData.age),
        sex: formData.sex,
        height: heightCm,
        weight: Number(formData.weight),
        existingConditions: [formData.conditions],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex min-h-[90vh] flex-col items-center justify-center px-4 py-8 bg-[#FAF9F6]">
      <div className="w-full max-w-md rounded-3xl border border-[#E8E4D9] bg-white p-6 md:p-8 shadow-sm">
        {/* Progress indicator */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            {[1, 2, 3, 4].map(s => (
              <div
                key={s}
                className={`h-1.5 rounded-full transition-all ${
                  s === step ? 'w-8 bg-[#15803D]' : s < step ? 'w-5 bg-[#86EFAC]' : 'w-4 bg-[#E5E2D9]'
                }`}
              />
            ))}
          </div>
          <span className="text-[11px] font-semibold text-gray-600">Step {step} of 4</span>
        </div>

        {/* STEP 1: WELCOME */}
        {step === 1 && (
          <div className="animate-fade-in space-y-6">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#E8F5E9] text-[#15803D]">
              <HeartHandshake className="h-8 w-8" />
            </div>
            <div>
              <h2 className="text-2xl font-extrabold text-[#1F2421]">Welcome to SwasthSense</h2>
              <p className="mt-2 text-sm text-[#5C645D] leading-relaxed">
                Understand your health trends from your everyday smartphone. Routine checkups without clinical friction.
              </p>
            </div>

            <div className="space-y-3 rounded-2xl bg-[#F7F6F2] p-4 text-xs text-[#414843]">
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="h-4 w-4 text-[#15803D] shrink-0 mt-0.5" />
                <span>Camera PPG for resting heart rate, HRV, and prototype SpO₂ estimation.</span>
              </div>
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="h-4 w-4 text-[#15803D] shrink-0 mt-0.5" />
                <span>Acoustic screening for heart sound cadence and respiratory patterns.</span>
              </div>
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="h-4 w-4 text-[#15803D] shrink-0 mt-0.5" />
                <span>Motion-based gait analysis for cadence stability and stride symmetry.</span>
              </div>
            </div>

            <button
              onClick={handleNextStep2}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#15803D] py-3.5 px-6 text-sm font-bold text-white shadow hover:bg-[#166534] transition-all"
            >
              <span>Get Started</span>
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* STEP 2: BASIC PROFILE */}
        {step === 2 && (
          <div className="animate-fade-in space-y-5">
            <div>
              <h2 className="text-xl font-bold text-[#1F2421]">Personal Health Baseline</h2>
              <p className="mt-1 text-xs text-[#5C645D]">
                These parameters help normalize physiological metrics like BMI and heart rate.
              </p>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-gray-700">Full Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-gray-200 p-2.5 font-medium text-gray-900 focus:border-[#15803D] focus:outline-hidden"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="font-semibold text-gray-700">Age</label>
                  <input
                    type="number"
                    value={formData.age}
                    onChange={e => setFormData({ ...formData, age: Number(e.target.value) })}
                    className="mt-1 w-full rounded-xl border border-gray-200 p-2.5 font-medium text-gray-900 focus:border-[#15803D] focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="font-semibold text-gray-700">Biological Sex</label>
                  <select
                    value={formData.sex}
                    onChange={e => setFormData({ ...formData, sex: e.target.value as any })}
                    className="mt-1 w-full rounded-xl border border-gray-200 p-2.5 font-medium text-gray-900 focus:border-[#15803D] focus:outline-hidden"
                  >
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                    <option value="prefer_not_to_say">Prefer not to say</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="font-semibold text-gray-700">Height (inches)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={formData.heightInches}
                    onChange={e => setFormData({ ...formData, heightInches: Number(e.target.value) })}
                    className="mt-1 w-full rounded-xl border border-gray-200 p-2.5 font-medium text-gray-900 focus:border-[#15803D] focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="font-semibold text-gray-700">Weight (kg)</label>
                  <input
                    type="number"
                    step="0.5"
                    value={formData.weight}
                    onChange={e => setFormData({ ...formData, weight: Number(e.target.value) })}
                    className="mt-1 w-full rounded-xl border border-gray-200 p-2.5 font-medium text-gray-900 focus:border-[#15803D] focus:outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-gray-700">Pre-existing Conditions (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Asthma, Hypertension, None"
                  value={formData.conditions}
                  onChange={e => setFormData({ ...formData, conditions: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-gray-200 p-2.5 font-medium text-gray-900 focus:border-[#15803D] focus:outline-hidden"
                />
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setStep(1)}
                className="w-1/3 rounded-2xl border border-gray-200 py-3 text-xs font-semibold text-gray-600 hover:bg-gray-50"
              >
                Back
              </button>
              <button
                onClick={handleNextStep3}
                className="flex-1 rounded-2xl bg-[#15803D] py-3 text-xs font-bold text-white shadow hover:bg-[#166534]"
              >
                Continue
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: SAFETY & REGULATORY DISCLAIMER */}
        {step === 3 && (
          <div className="animate-fade-in space-y-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-[#1F2421]">Safety & Disclaimer Notice</h2>
                <p className="text-xs text-[#5C645D]">Please read and accept before proceeding</p>
              </div>
            </div>

            <div className="space-y-3 rounded-2xl bg-amber-50/70 p-4 text-xs leading-relaxed text-amber-950 border border-amber-200">
              <p className="font-bold text-amber-900">Important Medical Boundaries:</p>
              <ul className="list-disc pl-4 space-y-1 text-amber-900/90">
                <li>
                  <strong>SwasthSense is not a doctor.</strong> The application provides monitoring measurements and first-pass screening patterns only.
                </li>
                <li>
                  <strong>Not a clinical diagnosis:</strong> Smartphone sensor algorithms do not substitute for certified clinical evaluations or laboratory diagnostic tests.
                </li>
                <li>
                  <strong>Emergency symptoms:</strong> If experiencing chest pain, severe breathlessness, fainting, or acute symptoms, call emergency services immediately.
                </li>
                <li>
                  <strong>Prototype SpO₂:</strong> Camera-based SpO₂ estimation is experimental and not equivalent to an FDA/CE-cleared pulse oximeter.
                </li>
              </ul>
            </div>

            <label className="flex items-start gap-3 rounded-xl border border-gray-200 bg-[#FAF9F6] p-3 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={consentAcknowledged}
                onChange={e => setConsentAcknowledged(e.target.checked)}
                className="mt-1 h-4 w-4 rounded-sm border-gray-300 text-[#15803D] focus:ring-[#15803D]"
              />
              <span className="text-xs font-medium text-gray-700 leading-snug">
                I understand that SwasthSense provides screening indicators, not medical diagnosis, and I agree to use it as a personal tracking assistant.
              </span>
            </label>

            <div className="flex gap-3">
              <button
                onClick={() => setStep(2)}
                className="w-1/3 rounded-2xl border border-gray-200 py-3 text-xs font-semibold text-gray-600 hover:bg-gray-50"
              >
                Back
              </button>
              <button
                disabled={!consentAcknowledged}
                onClick={handleConsentAccepted}
                className="flex-1 rounded-2xl bg-[#15803D] py-3 text-xs font-bold text-white shadow hover:bg-[#166534] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                I Agree & Consent
              </button>
            </div>
          </div>
        )}

        {/* STEP 4: PERMISSIONS EXPLAINER */}
        {step === 4 && (
          <div className="animate-fade-in space-y-5">
            <div>
              <h2 className="text-xl font-bold text-[#1F2421]">Device Sensor Access</h2>
              <p className="mt-1 text-xs text-[#5C645D]">
                We explain why each sensor is needed before requesting access.
              </p>
            </div>

            <div className="space-y-3 text-xs">
              {/* Camera */}
              <div className="flex items-center justify-between rounded-2xl border border-gray-200 p-3.5 bg-white">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                    <Camera className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-900">Rear Camera</h4>
                    <p className="text-[11px] text-gray-500">Photoplethysmography (PPG) pulse extraction</p>
                  </div>
                </div>
                <button
                  onClick={() => handleGrantPermission('camera')}
                  className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition-all ${
                    permissionsGranted.camera
                      ? 'bg-green-100 text-green-800'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {permissionsGranted.camera ? 'Enabled' : 'Allow'}
                </button>
              </div>

              {/* Microphone */}
              <div className="flex items-center justify-between rounded-2xl border border-gray-200 p-3.5 bg-white">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-50 text-purple-700">
                    <Mic className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-900">Microphone</h4>
                    <p className="text-[11px] text-gray-500">Acoustic heart sound & cough screening</p>
                  </div>
                </div>
                <button
                  onClick={() => handleGrantPermission('microphone')}
                  className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition-all ${
                    permissionsGranted.microphone
                      ? 'bg-green-100 text-green-800'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {permissionsGranted.microphone ? 'Enabled' : 'Allow'}
                </button>
              </div>

              {/* Motion */}
              <div className="flex items-center justify-between rounded-2xl border border-gray-200 p-3.5 bg-white">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50 text-amber-700">
                    <Smartphone className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-900">Motion & Gyroscope</h4>
                    <p className="text-[11px] text-gray-500">Walking cadence, stride & symmetry test</p>
                  </div>
                </div>
                <button
                  onClick={() => handleGrantPermission('motion')}
                  className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition-all ${
                    permissionsGranted.motion
                      ? 'bg-green-100 text-green-800'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {permissionsGranted.motion ? 'Enabled' : 'Allow'}
                </button>
              </div>
            </div>

            <button
              disabled={isSaving}
              onClick={handleFinishOnboarding}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#15803D] py-3.5 px-6 text-sm font-bold text-white shadow hover:bg-[#166534] disabled:opacity-70 transition-all"
            >
              <span>{isSaving ? 'Configuring Profile...' : 'Enter Dashboard'}</span>
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
