import React, { useState } from 'react';
import {
  User,
  ShieldCheck,
  Scale,
  Ruler,
  Activity,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  AlertCircle,
  Heart,
  Pill,
  Cigarette,
  Lock
} from 'lucide-react';
import { UserProfile } from '../types';
import { profileApi, consentApi } from '../services/api';

interface Props {
  initialProfile?: UserProfile | null;
  isOpen: boolean;
  onComplete: (updatedProfile: UserProfile) => void;
}

export const ProfileSetupModal: React.FC<Props> = ({
  initialProfile,
  isOpen,
  onComplete
}) => {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // Form State
  const [name, setName] = useState(initialProfile?.name && initialProfile.name !== 'Patient User' ? initialProfile.name : '');
  const [age, setAge] = useState<string>(initialProfile?.age ? String(initialProfile.age) : '');
  const [sex, setSex] = useState<'male' | 'female' | 'other' | 'prefer_not_to_say'>(
    initialProfile?.sex || 'prefer_not_to_say'
  );
  const [height, setHeight] = useState<string>(initialProfile?.height ? String(initialProfile.height) : '');
  const [weight, setWeight] = useState<string>(initialProfile?.weight ? String(initialProfile.weight) : '');

  // Optional info
  const [conditions, setConditions] = useState(initialProfile?.existingConditions?.join(', ') || '');
  const [medications, setMedications] = useState(initialProfile?.medications || '');
  const [activityLevel, setActivityLevel] = useState<'sedentary' | 'lightly_active' | 'moderately_active' | 'very_active'>(
    initialProfile?.activityLevel || 'moderately_active'
  );
  const [smokingStatus, setSmokingStatus] = useState<'non_smoker' | 'former_smoker' | 'occasional' | 'regular'>(
    initialProfile?.smokingStatus || 'non_smoker'
  );

  // Consent & Submission
  const [consentAcknowledged, setConsentAcknowledged] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  if (!isOpen) return null;

  // Validation
  const validateStep1 = (): boolean => {
    const errs: Record<string, string> = {};
    if (!name.trim()) {
      errs.name = 'Please enter your full name or preferred name.';
    }
    const parsedAge = Number(age);
    if (!age || isNaN(parsedAge) || parsedAge < 1 || parsedAge > 120) {
      errs.age = 'Please enter a realistic age between 1 and 120.';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const validateStep2 = (): boolean => {
    const errs: Record<string, string> = {};
    const parsedHeight = Number(height);
    if (!height || isNaN(parsedHeight) || parsedHeight < 50 || parsedHeight > 250) {
      errs.height = 'Please enter height in cm between 50 and 250.';
    }
    const parsedWeight = Number(weight);
    if (!weight || isNaN(parsedWeight) || parsedWeight < 20 || parsedWeight > 300) {
      errs.weight = 'Please enter weight in kg between 20 and 300.';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleNextFromStep1 = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateStep1()) {
      setStep(2);
    }
  };

  const handleNextFromStep2 = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateStep2()) {
      setStep(3);
    }
  };

  const handleSkipOptional = () => {
    setStep(4);
  };

  const handleNextFromStep3 = (e: React.FormEvent) => {
    e.preventDefault();
    setStep(4);
  };

  const handleSaveProfile = async () => {
    if (!consentAcknowledged) {
      setServerError('Please acknowledge the screening disclaimer to proceed.');
      return;
    }
    setIsSubmitting(true);
    setServerError(null);

    try {
      // Record consent on backend
      try {
        await consentApi.record('safety_and_clinical_disclaimer', 'v2.1');
      } catch (cErr) {
        console.warn('Consent sync note:', cErr);
      }

      // Update profile on backend
      const res = await profileApi.update({
        name: name.trim(),
        age: Number(age),
        sex,
        height: Number(height),
        weight: Number(weight),
        existingConditions: conditions
          ? conditions.split(',').map(s => s.trim()).filter(Boolean)
          : [],
        medications: medications.trim(),
        activityLevel,
        smokingStatus,
        profileCompleted: true
      });

      onComplete(res.profile);
    } catch (err: any) {
      console.error('Failed to save profile:', err);
      setServerError(err.message || 'Failed to persist profile. Please retry.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      id="profile-setup-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-fade-in"
    >
      <div
        id="profile-setup-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="profile-setup-title"
        className="w-[calc(100vw-2rem)] max-w-md max-h-[calc(100dvh-2rem)] flex flex-col rounded-3xl bg-white p-5 shadow-2xl border border-gray-200 text-[#1F2421] overflow-hidden"
      >
        {/* Fixed Header */}
        <div className="shrink-0 border-b border-gray-100 pb-3">
          <div className="flex items-center gap-2.5">
            <img
              src="/swasthsense-logo.png"
              alt="SwasthSense Logo"
              className="w-10 h-10 object-contain shrink-0"
            />
            <div>
              <h2 id="profile-setup-title" className="text-base font-bold text-gray-900 leading-tight">
                Let's set up your health profile
              </h2>
              <p className="text-xs text-gray-500">
                This helps SwasthSense personalize your health tracking.
              </p>
            </div>
          </div>

          {/* Progress Indicator */}
          <div className="mt-3 flex items-center justify-between gap-1.5">
            {[1, 2, 3, 4].map(s => (
              <div key={s} className="flex-1">
                <div
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    s <= step ? 'bg-[#15803D]' : 'bg-gray-200'
                  }`}
                />
              </div>
            ))}
          </div>
          <div className="mt-1.5 flex justify-between text-[10px] font-bold text-gray-400 uppercase tracking-wider">
            <span className={step === 1 ? 'text-[#15803D]' : ''}>1. Basic</span>
            <span className={step === 2 ? 'text-[#15803D]' : ''}>2. Body</span>
            <span className={step === 3 ? 'text-[#15803D]' : ''}>3. Lifestyle</span>
            <span className={step === 4 ? 'text-[#15803D]' : ''}>4. Consent</span>
          </div>
        </div>

        {serverError && (
          <div className="mt-3 shrink-0 flex items-center gap-2 rounded-xl bg-red-50 p-2.5 text-xs text-red-700 border border-red-200">
            <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
            <span>{serverError}</span>
          </div>
        )}

        {/* STEP 1: BASIC INFORMATION */}
        {step === 1 && (
          <form onSubmit={handleNextFromStep1} className="flex flex-col flex-1 min-h-0">
            <div className="flex-1 overflow-y-auto py-3 pr-1 space-y-3.5">
              <div>
                <label htmlFor="setup-name" className="block text-xs font-bold text-gray-700">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <div className="relative mt-1">
                  <User className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                  <input
                    id="setup-name"
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="e.g. Priya Sharma"
                    className={`w-full rounded-xl border py-2 pl-9 pr-3 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-hidden focus:ring-2 ${
                      errors.name
                        ? 'border-red-400 focus:ring-red-200'
                        : 'border-gray-300 focus:border-[#15803D] focus:ring-green-100'
                    }`}
                    autoFocus
                  />
                </div>
                {errors.name && (
                  <p className="mt-1 text-[11px] font-semibold text-red-600">{errors.name}</p>
                )}
              </div>

              <div>
                <label htmlFor="setup-age" className="block text-xs font-bold text-gray-700">
                  Age (years) <span className="text-red-500">*</span>
                </label>
                <input
                  id="setup-age"
                  type="number"
                  min="1"
                  max="120"
                  value={age}
                  onChange={e => setAge(e.target.value)}
                  placeholder="e.g. 28"
                  className={`mt-1 w-full rounded-xl border py-2 px-3 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-hidden focus:ring-2 ${
                    errors.age
                      ? 'border-red-400 focus:ring-red-200'
                      : 'border-gray-300 focus:border-[#15803D] focus:ring-green-100'
                  }`}
                />
                {errors.age && (
                  <p className="mt-1 text-[11px] font-semibold text-red-600">{errors.age}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700">
                  Biological Sex <span className="text-red-500">*</span>
                </label>
                <div className="mt-1 grid grid-cols-2 gap-2">
                  {[
                    { value: 'male', label: 'Male' },
                    { value: 'female', label: 'Female' },
                    { value: 'other', label: 'Other' },
                    { value: 'prefer_not_to_say', label: 'Prefer not to say' }
                  ].map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setSex(opt.value as any)}
                      className={`rounded-xl border py-2 px-3 text-xs font-bold transition-all text-center ${
                        sex === opt.value
                          ? 'border-[#15803D] bg-[#E8F5E9] text-[#166534] shadow-2xs'
                          : 'border-gray-200 bg-gray-50 text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="shrink-0 pt-3 border-t border-gray-100 flex justify-end">
              <button
                type="submit"
                id="btn-step1-continue"
                className="flex items-center gap-1.5 rounded-xl bg-[#15803D] py-2.5 px-5 text-xs font-bold text-white shadow-xs hover:bg-[#166534] transition-all"
              >
                <span>Continue</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </form>
        )}

        {/* STEP 2: BODY INFORMATION */}
        {step === 2 && (
          <form onSubmit={handleNextFromStep2} className="flex flex-col flex-1 min-h-0">
            <div className="flex-1 overflow-y-auto py-3 pr-1 space-y-3.5">
              <div>
                <label htmlFor="setup-height" className="block text-xs font-bold text-gray-700">
                  Height (cm) <span className="text-red-500">*</span>
                </label>
                <div className="relative mt-1">
                  <Ruler className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                  <input
                    id="setup-height"
                    type="number"
                    min="50"
                    max="250"
                    value={height}
                    onChange={e => setHeight(e.target.value)}
                    placeholder="e.g. 172"
                    className={`w-full rounded-xl border py-2 pl-9 pr-3 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-hidden focus:ring-2 ${
                      errors.height
                        ? 'border-red-400 focus:ring-red-200'
                        : 'border-gray-300 focus:border-[#15803D] focus:ring-green-100'
                    }`}
                    autoFocus
                  />
                </div>
                {errors.height && (
                  <p className="mt-1 text-[11px] font-semibold text-red-600">{errors.height}</p>
                )}
              </div>

              <div>
                <label htmlFor="setup-weight" className="block text-xs font-bold text-gray-700">
                  Weight (kg) <span className="text-red-500">*</span>
                </label>
                <div className="relative mt-1">
                  <Scale className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                  <input
                    id="setup-weight"
                    type="number"
                    min="20"
                    max="300"
                    value={weight}
                    onChange={e => setWeight(e.target.value)}
                    placeholder="e.g. 68"
                    className={`w-full rounded-xl border py-2 pl-9 pr-3 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-hidden focus:ring-2 ${
                      errors.weight
                        ? 'border-red-400 focus:ring-red-200'
                        : 'border-gray-300 focus:border-[#15803D] focus:ring-green-100'
                    }`}
                  />
                </div>
                {errors.weight && (
                  <p className="mt-1 text-[11px] font-semibold text-red-600">{errors.weight}</p>
                )}
              </div>

              {/* BMI Preview Callout */}
              {Number(height) > 0 && Number(weight) > 0 && (
                <div className="rounded-xl bg-[#F8F7F2] p-3 text-xs border border-gray-200 flex items-center justify-between">
                  <span className="text-gray-600">Calculated Baseline BMI:</span>
                  <span className="font-bold text-gray-900">
                    {(Number(weight) / Math.pow(Number(height) / 100, 2)).toFixed(1)} kg/m²
                  </span>
                </div>
              )}
            </div>

            <div className="shrink-0 pt-3 border-t border-gray-100 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="flex items-center gap-1.5 rounded-xl border border-gray-300 bg-white py-2.5 px-4 text-xs font-bold text-gray-700 hover:bg-gray-50"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span>Back</span>
              </button>
              <button
                type="submit"
                id="btn-step2-continue"
                className="flex items-center gap-1.5 rounded-xl bg-[#15803D] py-2.5 px-5 text-xs font-bold text-white shadow-xs hover:bg-[#166534] transition-all"
              >
                <span>Continue</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </form>
        )}

        {/* STEP 3: OPTIONAL HEALTH INFORMATION */}
        {step === 3 && (
          <form onSubmit={handleNextFromStep3} className="flex flex-col flex-1 min-h-0">
            <div className="flex-1 overflow-y-auto py-3 pr-1 space-y-3.5">
              <div>
                <div className="flex items-center justify-between">
                  <label htmlFor="setup-conditions" className="text-xs font-bold text-gray-700">
                    Existing Health Conditions (Optional)
                  </label>
                  <span className="text-[10px] text-gray-400">Comma-separated</span>
                </div>
                <input
                  id="setup-conditions"
                  type="text"
                  value={conditions}
                  onChange={e => setConditions(e.target.value)}
                  placeholder="e.g. Mild Asthma, Hypertension (or leave blank)"
                  className="mt-1 w-full rounded-xl border border-gray-300 py-2 px-3 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-hidden focus:border-[#15803D] focus:ring-2 focus:ring-green-100"
                />
              </div>

              <div>
                <label htmlFor="setup-medications" className="block text-xs font-bold text-gray-700">
                  Current Medications (Optional)
                </label>
                <div className="relative mt-1">
                  <Pill className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                  <input
                    id="setup-medications"
                    type="text"
                    value={medications}
                    onChange={e => setMedications(e.target.value)}
                    placeholder="e.g. Inhaler as needed, Multivitamins"
                    className="w-full rounded-xl border border-gray-300 py-2 pl-9 pr-3 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-hidden focus:border-[#15803D] focus:ring-2 focus:ring-green-100"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700">
                  Activity Level (Optional)
                </label>
                <div className="mt-1 grid grid-cols-2 gap-2">
                  {[
                    { value: 'sedentary', label: 'Sedentary (Desk job)' },
                    { value: 'lightly_active', label: 'Lightly Active' },
                    { value: 'moderately_active', label: 'Moderately Active' },
                    { value: 'very_active', label: 'Very Active (Daily fitness)' }
                  ].map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setActivityLevel(opt.value as any)}
                      className={`rounded-xl border py-2 px-2.5 text-xs font-semibold text-left transition-all ${
                        activityLevel === opt.value
                          ? 'border-[#15803D] bg-[#E8F5E9] text-[#166534] font-bold shadow-2xs'
                          : 'border-gray-200 bg-gray-50 text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700">
                  Smoking Status (Optional)
                </label>
                <div className="mt-1 grid grid-cols-2 gap-2">
                  {[
                    { value: 'non_smoker', label: 'Non-smoker' },
                    { value: 'former_smoker', label: 'Former smoker' },
                    { value: 'occasional', label: 'Occasional' },
                    { value: 'regular', label: 'Regular' }
                  ].map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setSmokingStatus(opt.value as any)}
                      className={`rounded-xl border py-2 px-2.5 text-xs font-semibold text-center transition-all ${
                        smokingStatus === opt.value
                          ? 'border-[#15803D] bg-[#E8F5E9] text-[#166534] font-bold shadow-2xs'
                          : 'border-gray-200 bg-gray-50 text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="shrink-0 pt-3 border-t border-gray-100 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="flex items-center gap-1.5 rounded-xl border border-gray-300 bg-white py-2.5 px-4 text-xs font-bold text-gray-700 hover:bg-gray-50"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span>Back</span>
              </button>
              <div className="flex gap-2">
                <button
                  type="button"
                  id="btn-step3-skip"
                  onClick={handleSkipOptional}
                  className="rounded-xl border border-gray-200 bg-white py-2.5 px-3 text-xs font-bold text-gray-500 hover:bg-gray-100"
                >
                  Skip optional info
                </button>
                <button
                  type="submit"
                  id="btn-step3-continue"
                  className="flex items-center gap-1.5 rounded-xl bg-[#15803D] py-2.5 px-4 text-xs font-bold text-white shadow-xs hover:bg-[#166534] transition-all"
                >
                  <span>Continue</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </form>
        )}

        {/* STEP 4: CONSENT & DATA TRANSPARENCY */}
        {step === 4 && (
          <div className="flex flex-col flex-1 min-h-0">
            <div className="flex-1 overflow-y-auto py-3 pr-1 space-y-3.5">
              <div className="rounded-2xl bg-[#F8F7F2] p-4 text-xs text-gray-700 border border-[#EAE7DE] space-y-3">
                <div className="flex items-center gap-2 font-bold text-gray-900 text-sm">
                  <ShieldCheck className="h-5 w-5 text-[#15803D]" />
                  <span>Clinical Screening & Privacy Notice</span>
                </div>
                <ul className="space-y-2 list-disc pl-4 text-gray-600 text-[11px] leading-relaxed">
                  <li>
                    <strong className="text-gray-800">Non-Diagnostic Screening:</strong> SwasthSense provides wellness trend tracking and objective physiological estimations. It does not replace clinical evaluation or diagnostic hospital telemetry.
                  </li>
                  <li>
                    <strong className="text-gray-800">Privacy & On-Device Processing:</strong> Optical fingertip and acoustic cough/heart audio analysis run directly within local algorithms. Raw audiovisual data is processed into numeric biomarkers.
                  </li>
                  <li>
                    <strong className="text-gray-800">Secure User Isolation:</strong> Your metrics, reports, and gait kinematics are tied strictly to your authenticated patient account.
                  </li>
                </ul>
              </div>

              <label className="flex items-start gap-2.5 rounded-xl border border-gray-200 bg-white p-3 cursor-pointer hover:bg-gray-50">
                <input
                  type="checkbox"
                  checked={consentAcknowledged}
                  onChange={e => setConsentAcknowledged(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded-sm border-gray-300 text-[#15803D] focus:ring-[#15803D]"
                />
                <span className="text-xs text-gray-700">
                  I understand this is a non-diagnostic physiological screening applet and agree to local sensor-based health screening.
                </span>
              </label>
            </div>

            <div className="shrink-0 pt-3 border-t border-gray-100 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setStep(3)}
                className="flex items-center gap-1.5 rounded-xl border border-gray-300 bg-white py-2.5 px-4 text-xs font-bold text-gray-700 hover:bg-gray-50"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span>Back</span>
              </button>
              <button
                type="button"
                id="btn-save-profile"
                disabled={isSubmitting || !consentAcknowledged}
                onClick={handleSaveProfile}
                className="flex items-center gap-2 rounded-xl bg-[#15803D] py-2.5 px-6 text-xs font-bold text-white shadow-xs hover:bg-[#166534] transition-all disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    <span>Saving Profile...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4" />
                    <span>Save Profile</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
