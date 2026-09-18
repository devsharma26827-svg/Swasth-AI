import React, { useState } from 'react';
import { AlertTriangle, PhoneCall, X, ShieldAlert, HeartPulse } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const EmergencyModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const [selectedSymptom, setSelectedSymptom] = useState<string | null>(null);

  if (!isOpen) return null;

  const redFlags = [
    'Severe chest pain, pressure, or tightness spreading to jaw/arm',
    'Severe sudden breathing difficulty or gasping for breath',
    'Sudden loss of consciousness, fainting, or unresponsiveness',
    'Bluish or pale tint around lips, face, or nailbeds',
    'Sudden severe weakness or numbness on one side of face/body'
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
      <div className="w-full max-w-lg rounded-2xl bg-[#FDFCF9] p-6 shadow-2xl border border-red-200">
        <div className="flex items-start justify-between border-b border-red-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-red-100 text-red-700">
              <ShieldAlert className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900">Emergency Health Triage</h3>
              <p className="text-xs text-gray-600">Immediate safety evaluation</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-gray-600 hover:bg-gray-100 hover:text-gray-700"
            aria-label="Close modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-4">
          <div className="rounded-xl bg-red-50 p-4 border border-red-200">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-sm font-bold text-red-900">Do not wait for AI analysis</h4>
                <p className="mt-1 text-xs text-red-800 leading-relaxed">
                  SwasthAI is strictly for routine monitoring and screening. If you or someone nearby is experiencing acute symptoms, seek immediate professional emergency medical care.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-4">
            <label className="text-xs font-semibold uppercase tracking-wider text-gray-700">
              Are you experiencing any of the following?
            </label>
            <div className="mt-2 space-y-2">
              {redFlags.map((flag, idx) => (
                <button
                  key={idx}
                  onClick={() => setSelectedSymptom(flag)}
                  className={`w-full text-left p-3 rounded-xl text-xs font-medium transition-all border ${
                    selectedSymptom === flag
                      ? 'bg-red-100 border-red-400 text-red-950 font-semibold'
                      : 'bg-white border-gray-200 text-gray-800 hover:border-red-200 hover:bg-red-50/50'
                  }`}
                >
                  • {flag}
                </button>
              ))}
            </div>
          </div>

          {selectedSymptom && (
            <div className="mt-4 rounded-xl bg-red-600 p-4 text-white animate-fade-in">
              <div className="flex items-center gap-2 font-bold text-sm">
                <HeartPulse className="h-5 w-5 animate-pulse text-white" />
                <span>Immediate Medical Action Required</span>
              </div>
              <p className="mt-1 text-xs text-red-100 leading-relaxed">
                Please contact local emergency services immediately or proceed to the nearest emergency department.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <a
                  href="tel:112"
                  className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-xs font-bold text-red-700 shadow hover:bg-red-50"
                >
                  <PhoneCall className="h-4 w-4" />
                  Call Emergency (112)
                </a>
                <a
                  href="tel:102"
                  className="inline-flex items-center gap-2 rounded-lg bg-red-700 border border-red-400 px-4 py-2 text-xs font-bold text-white hover:bg-red-800"
                >
                  <PhoneCall className="h-4 w-4" />
                  Call Ambulance (102)
                </a>
              </div>
            </div>
          )}
        </div>

        <div className="mt-6 flex justify-end gap-3 border-t border-gray-100 pt-4">
          <button
            onClick={onClose}
            className="rounded-xl px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100"
          >
            I do not have emergency symptoms
          </button>
        </div>
      </div>
    </div>
  );
};
