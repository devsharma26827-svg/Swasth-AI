import React, { useState } from 'react';
import { Scale, ArrowLeft, CheckCircle2, Info, RefreshCw, CameraOff } from 'lucide-react';
import { measurementApi } from '../services/api';
import { BMIResult, UserProfile } from '../types';

interface Props {
  profile?: UserProfile;
  onComplete?: (result: BMIResult) => void;
  onBack?: () => void;
}

export const BMIScreen: React.FC<Props> = ({ profile, onComplete, onBack }) => {
  const safeProfile = profile || { height: 170, weight: 70 };
  const [heightInches, setHeightInches] = useState<number>(
    safeProfile.height ? Math.round((safeProfile.height / 2.54) * 10) / 10 : 67
  );
  const [weightKg, setWeightKg] = useState(safeProfile.weight || 70);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<BMIResult | null>(null);

  const calculateAndSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsSubmitting(true);
    const heightCm = Math.round(Number(heightInches) * 2.54 * 10) / 10;

    try {
      const res = await measurementApi.submitBMI({
        heightCm,
        weightKg: Number(weightKg)
      });
      setResult(res.bmi);
      if (onComplete) onComplete(res.bmi);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-lg space-y-4 p-4 pb-20 animate-fade-in">
      <div className="flex items-center justify-between">
        {onBack && (
          <button
            onClick={onBack}
            className="flex items-center gap-1 text-xs font-semibold text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back</span>
          </button>
        )}
        <div className="flex items-center gap-1.5 ml-auto">
          <span className="h-2 w-2 rounded-full bg-emerald-600" />
          <span className="text-[11px] font-bold text-gray-600 uppercase tracking-wider">
            Anthropometry & Weight
          </span>
        </div>
      </div>

      <div className="rounded-3xl border border-[#EAE7DE] bg-white p-5 shadow-xs">
        <div>
          <h2 className="text-lg font-bold text-[#1F2421]">BMI & Weight Trend</h2>
          <p className="mt-1 text-xs text-[#5C645D]">
            Calculate your Body Mass Index and monitor 7-day and 30-day body weight fluctuations.
          </p>
        </div>

        <form onSubmit={calculateAndSave} className="mt-4 space-y-3 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-semibold text-gray-700">Height (inches)</label>
              <input
                type="number"
                step="0.1"
                value={heightInches}
                onChange={e => setHeightInches(Number(e.target.value))}
                className="mt-1 w-full rounded-xl border border-gray-200 p-2.5 font-medium text-gray-900 focus:border-[#15803D] focus:outline-hidden"
                required
              />
            </div>
            <div>
              <label className="font-semibold text-gray-700">Current Weight (kg)</label>
              <input
                type="number"
                step="0.1"
                value={weightKg}
                onChange={e => setWeightKg(Number(e.target.value))}
                className="mt-1 w-full rounded-xl border border-gray-200 p-2.5 font-medium text-gray-900 focus:border-[#15803D] focus:outline-hidden"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#15803D] py-3.5 px-6 text-sm font-bold text-white shadow hover:bg-[#166534] transition-all disabled:opacity-50 swasth-shimmer"
          >
            <Scale className="h-4 w-4" />
            <span>{isSubmitting ? 'Updating...' : 'Calculate & Record Weight'}</span>
          </button>
        </form>

        {/* Experimental camera weight estimation note */}
        <div className="mt-4 flex items-center justify-between rounded-xl bg-gray-50 p-3 border border-gray-200 text-xs text-gray-500">
          <div className="flex items-center gap-2">
            <CameraOff className="h-4 w-4 text-gray-400" />
            <span>Camera-assisted optical weight estimation</span>
          </div>
          <span className="rounded-full bg-gray-200 px-2 py-0.5 text-[10px] font-bold text-gray-600">
            Disabled Prototype
          </span>
        </div>

        {/* Result view */}
        {result && (
          <div className="mt-5 space-y-3 rounded-2xl bg-[#F8F7F2] p-4 border border-[#EAE7DE] animate-fade-in">
            <div className="flex items-center justify-between border-b border-gray-200 pb-2.5">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-[#15803D]" />
                <span className="text-sm font-bold text-gray-900">BMI Calculation</span>
              </div>
              <span className="rounded-full bg-green-100 text-green-800 px-2.5 py-0.5 text-[11px] font-bold">
                {result.category}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl bg-white p-2.5 border border-gray-200">
                <span className="text-[10px] font-bold uppercase text-gray-500">BMI</span>
                <div className="text-2xl font-black text-gray-900 mt-0.5">{result.bmi}</div>
                <span className="text-[10px] text-gray-500">kg/m²</span>
              </div>

              <div className="rounded-xl bg-white p-2.5 border border-gray-200">
                <span className="text-[10px] font-bold uppercase text-gray-500">7-Day Delta</span>
                <div className="text-xl font-bold text-gray-900 mt-1">
                  {result.change7d > 0 ? `+${result.change7d}` : result.change7d} kg
                </div>
                <span className="text-[10px] text-gray-500">Short-term</span>
              </div>

              <div className="rounded-xl bg-white p-2.5 border border-gray-200">
                <span className="text-[10px] font-bold uppercase text-gray-500">30-Day Delta</span>
                <div className="text-xl font-bold text-gray-900 mt-1">
                  {result.change30d > 0 ? `+${result.change30d}` : result.change30d} kg
                </div>
                <span className="text-[10px] text-gray-500">Monthly</span>
              </div>
            </div>

            <p className="text-xs text-gray-700 leading-relaxed bg-white rounded-xl p-3 border border-gray-200">
              {result.explanation}
            </p>

            <div className="flex items-start gap-2 rounded-xl bg-blue-50/60 p-2.5 text-[11px] text-blue-900 border border-blue-200">
              <Info className="h-4 w-4 text-blue-700 shrink-0 mt-0.5" />
              <span>
                <strong>Educational Note:</strong> BMI does not distinguish between adipose fat mass and lean skeletal muscle. Do not make clinical conclusions solely based on BMI.
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
