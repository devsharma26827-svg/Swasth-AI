import React, { useState, useEffect, useRef } from 'react';
import { Wind, Volume2, RefreshCw, CheckCircle2, AlertCircle, Info, ArrowLeft, Mic } from 'lucide-react';
import { MicrophoneAudioSensor } from '../services/sensors';
import { measurementApi } from '../services/api';
import { CoughResult, DemoScenario } from '../types';

interface Props {
  onComplete?: (result: CoughResult) => void;
  onBack?: () => void;
  currentScenario?: DemoScenario;
}

export const CoughScreen: React.FC<Props> = ({ onComplete, onBack, currentScenario = 'normal' }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(15);
  const [processingState, setProcessingState] = useState<'idle' | 'recording' | 'processing' | 'success' | 'error'>('idle');
  const [result, setResult] = useState<CoughResult | null>(null);
  const [volumeLevel, setVolumeLevel] = useState(0);
  const [errorMessage, setErrorMessage] = useState('');

  const [activeMode, setActiveMode] = useState<'real' | 'demo'>('real');

  const sensorRef = useRef<MicrophoneAudioSensor | null>(null);
  const audioSamplesRef = useRef<number[]>([]);
  const timerRef = useRef<any>(null);
  const [shimmerActive, setShimmerActive] = useState(true);

  useEffect(() => {
    sensorRef.current = new MicrophoneAudioSensor();
    const shimmerTimer = setTimeout(() => setShimmerActive(false), 6000);
    return () => {
      clearTimeout(shimmerTimer);
      stopRecording();
    };
  }, []);

  const startRecording = async () => {
    setShimmerActive(false);
    setErrorMessage('');
    setResult(null);
    audioSamplesRef.current = [];
    setSecondsLeft(15);

    if (activeMode === 'demo') {
      setProcessingState('processing');
      try {
        const response = await measurementApi.submitCough({
          mode: 'demo',
          simulatedScenario: currentScenario as DemoScenario
        });
        setResult(response.screening);
        setProcessingState('success');
        if (onComplete) onComplete(response.screening);
      } catch (err: any) {
        setProcessingState('error');
        setErrorMessage(err.message || 'Demo cough analysis failed.');
      }
      return;
    }

    if (sensorRef.current) {
      sensorRef.current.onVolumeLevel = (rms) => {
        setVolumeLevel(rms);
        audioSamplesRef.current.push(rms);
      };
      const started = await sensorRef.current.start();
      if (!started) {
        setProcessingState('error');
        setErrorMessage('Microphone access denied or unavailable. Please enable microphone permissions in your browser or switch to Demo Simulation.');
        return;
      }
    }

    setProcessingState('recording');
    setIsRecording(true);

    let left = 15;
    timerRef.current = setInterval(() => {
      left--;
      setSecondsLeft(left);
      if (left <= 0) {
        clearInterval(timerRef.current);
        finishAndAnalyze();
      }
    }, 1000);
  };

  const stopRecording = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (sensorRef.current) sensorRef.current.stop();
    setIsRecording(false);
  };

  const finishAndAnalyze = async () => {
    stopRecording();
    setProcessingState('processing');

    try {
      const response = await measurementApi.submitCough({
        mode: 'real',
        audioSamples: audioSamplesRef.current,
        simulatedScenario: currentScenario as DemoScenario
      });
      setResult(response.screening);
      setProcessingState('success');
      if (onComplete) onComplete(response.screening);
    } catch (err: any) {
      setProcessingState('error');
      setErrorMessage(err.message || 'Could not isolate cough burst. Please cough clearly toward the microphone.');
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
        <div className="flex items-center gap-2 ml-auto">
          <div className="flex items-center rounded-full bg-gray-100 p-0.5 border border-gray-200">
            <button
              onClick={() => {
                if (processingState === 'idle') setActiveMode('real');
              }}
              className={`rounded-full px-2 py-0.5 text-[10px] font-bold transition-all ${
                activeMode === 'real'
                  ? 'bg-white text-gray-900 shadow-xs'
                  : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              Real Mic
            </button>
            <button
              onClick={() => {
                if (processingState === 'idle') setActiveMode('demo');
              }}
              className={`rounded-full px-2 py-0.5 text-[10px] font-bold transition-all ${
                activeMode === 'demo'
                  ? 'bg-teal-600 text-white shadow-xs'
                  : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              Demo
            </button>
          </div>
          <span className="text-[11px] font-bold text-gray-600 uppercase tracking-wider">
            Respiratory Audio
          </span>
        </div>
      </div>

      <div className="rounded-3xl border border-[#EAE7DE] bg-white p-5 shadow-xs">
        <div>
          <h2 className="text-lg font-bold text-[#1F2421]">Cough & Respiratory Check</h2>
          <p className="mt-1 text-xs text-[#5C645D]">
            Analyzes acoustic burst dynamics, airflow resistance, and harmonic decay for first-pass respiratory screening.
          </p>
        </div>

        {/* Instructions */}
        <div className={`mt-4 rounded-2xl bg-[#F8F7F2] p-4 text-xs text-gray-700 space-y-1.5 border border-gray-200 ${
          shimmerActive ? 'swasth-shimmer' : ''
        }`}>
          <div className="font-bold text-gray-900">Protocol Instructions:</div>
          <div>• Hold the smartphone approximately 15-20 cm (6-8 inches) away from your mouth.</div>
          <div>• Cough 2 to 3 times distinctly after pressing start.</div>
          <div>• Breathe normally for the remainder of the 15-second window.</div>
        </div>

        {/* Visualizer & Mic status */}
        <div className="mt-4 rounded-2xl bg-neutral-900 p-6 flex flex-col items-center justify-center text-white min-h-[160px]">
          <div
            className={`flex h-16 w-16 items-center justify-center rounded-full border-2 transition-all ${
              isRecording ? 'border-teal-400 bg-teal-500/30 scale-105' : 'border-gray-700 bg-gray-800'
            }`}
          >
            <Wind className={`h-8 w-8 ${isRecording ? 'text-teal-300' : 'text-gray-400'}`} />
          </div>

          <div className="mt-3 text-center">
            {isRecording ? (
              <div>
                <span className="text-2xl font-black tracking-widest text-white">{secondsLeft}s</span>
                <p className="text-[11px] text-teal-200 mt-1">Listening for cough explosive impulse...</p>
              </div>
            ) : (
              <span className="text-xs text-gray-400 font-medium">Ready to record cough sample</span>
            )}
          </div>

          {isRecording && (
            <div className="mt-3 w-full max-w-xs">
              <div className="flex justify-between text-[10px] text-gray-400 mb-1">
                <span>Microphone Level</span>
                <span>{Math.round(volumeLevel * 100)}%</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-gray-800">
                <div
                  style={{ width: `${Math.min(100, Math.max(5, volumeLevel * 150))}%` }}
                  className="h-full bg-teal-400 transition-all duration-75"
                />
              </div>
            </div>
          )}
        </div>

        {/* Action Controls */}
        <div className="mt-5">
          {processingState === 'idle' && (
            <button
              onClick={startRecording}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#15803D] py-3.5 px-6 text-sm font-bold text-white shadow hover:bg-[#166534] transition-all"
            >
              <Mic className="h-4 w-4" />
              <span>Start 15-Second Cough Recording</span>
            </button>
          )}

          {processingState === 'recording' && (
            <button
              onClick={stopRecording}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-red-600 py-3 text-xs font-bold text-white shadow hover:bg-red-700"
            >
              <RefreshCw className="h-4 w-4 animate-spin" />
              <span>Cancel Recording</span>
            </button>
          )}

          {processingState === 'processing' && (
            <div className="flex items-center justify-center gap-3 rounded-2xl bg-teal-50 p-4 border border-teal-200 text-teal-950 text-xs font-semibold">
              <RefreshCw className="h-4 w-4 animate-spin text-teal-700" />
              <span>Computing Mel spectrogram & extracting airflow burst features...</span>
            </div>
          )}

          {processingState === 'error' && (
            <div className="space-y-3">
              <div className="rounded-2xl bg-red-50 p-4 border border-red-200 text-xs text-red-900 flex items-start gap-2">
                <AlertCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold">Audio Analysis Notice</h4>
                  <p className="mt-0.5 text-red-800">{errorMessage}</p>
                </div>
              </div>
              <button
                onClick={startRecording}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#15803D] py-3 text-xs font-bold text-white shadow hover:bg-[#166534]"
              >
                <RefreshCw className="h-4 w-4" />
                <span>Retry Cough Test</span>
              </button>
            </div>
          )}
        </div>

        {/* Results view */}
        {result && processingState === 'success' && (
          <div className="mt-5 space-y-4 rounded-2xl bg-[#F8F7F2] p-4 border border-[#EAE7DE] animate-fade-in">
            <div className="flex items-center justify-between border-b border-gray-200 pb-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-[#15803D]" />
                <span className="text-sm font-bold text-gray-900">Acoustic Screening Result</span>
              </div>
              <span
                className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                  result.status === 'normal'
                    ? 'bg-green-100 text-green-800'
                    : result.status === 'monitor'
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-red-100 text-red-800'
                }`}
              >
                {result.status === 'normal'
                  ? 'No Concerning Pattern'
                  : result.status === 'monitor'
                  ? 'Monitor Respiratory Pattern'
                  : 'Follow-up Recommended'}
              </span>
            </div>

            <div className="rounded-xl bg-white p-3 border border-gray-200 space-y-1">
              <div className="text-xs font-bold text-gray-900">
                Acoustic Signature: <span className="capitalize">{result.patternType.replace(/_/g, ' ')}</span>
              </div>
              <div className="text-[11px] text-gray-500">
                Quality: {result.signalQuality}% • Confidence: {result.confidence} ({Math.round(result.confidenceScore * 100)}%)
              </div>
            </div>

            <p className="text-xs text-gray-700 leading-relaxed bg-white rounded-xl p-3 border border-gray-200">
              {result.explanation}
            </p>

            <div className="flex items-start gap-2 rounded-xl bg-teal-50/60 p-2.5 text-[11px] text-teal-900 border border-teal-200">
              <Info className="h-4 w-4 text-teal-700 shrink-0 mt-0.5" />
              <span>
                <strong>Screening Boundary:</strong> {result.disclaimer} Does NOT diagnose tuberculosis, COVID-19, pneumonia, asthma, or COPD.
              </span>
            </div>

            <button
              onClick={startRecording}
              className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-gray-300 bg-white py-2.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>Re-record</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
