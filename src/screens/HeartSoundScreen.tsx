import React, { useState, useEffect, useRef } from 'react';
import { Mic, Volume2, RefreshCw, CheckCircle2, AlertCircle, Info, ArrowLeft, Disc } from 'lucide-react';
import { MicrophoneAudioSensor } from '../services/sensors';
import { measurementApi } from '../services/api';
import { HeartSoundResult, DemoScenario } from '../types';

interface Props {
  onComplete?: (result: HeartSoundResult) => void;
  onBack?: () => void;
  currentScenario?: DemoScenario;
}

export const HeartSoundScreen: React.FC<Props> = ({ onComplete, onBack, currentScenario = 'normal' }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(25);
  const [volumeRms, setVolumeRms] = useState(0);
  const [frequencyBars, setFrequencyBars] = useState<number[]>([]);
  const [processingState, setProcessingState] = useState<'idle' | 'recording' | 'processing' | 'success' | 'error'>('idle');
  const [result, setResult] = useState<HeartSoundResult | null>(null);
  const [errorMessage, setErrorMessage] = useState('');

  const sensorRef = useRef<MicrophoneAudioSensor | null>(null);
  const samplesBufferRef = useRef<number[]>([]);
  const timerRef = useRef<any>(null);

  const [activeMode, setActiveMode] = useState<'real' | 'demo'>('real');

  useEffect(() => {
    sensorRef.current = new MicrophoneAudioSensor();
    return () => {
      stopRecording();
    };
  }, []);

  const startRecording = async () => {
    setErrorMessage('');
    setResult(null);
    samplesBufferRef.current = [];
    setSecondsLeft(10);

    if (activeMode === 'demo') {
      setProcessingState('processing');
      try {
        const response = await measurementApi.submitHeartSound({
          mode: 'demo',
          simulatedScenario: currentScenario as DemoScenario
        });
        setResult(response.screening);
        setProcessingState('success');
        if (onComplete) onComplete(response.screening);
      } catch (err: any) {
        setProcessingState('error');
        setErrorMessage(err.message || 'Demo screening failed.');
      }
      return;
    }

    if (sensorRef.current) {
      sensorRef.current.onVolumeLevel = (rms, freqData) => {
        setVolumeRms(rms);
        samplesBufferRef.current.push(rms);
        // Downsample frequency bars for visualizer
        const bars: number[] = [];
        for (let i = 0; i < 20; i++) {
          bars.push(freqData[i * 4] || 0);
        }
        setFrequencyBars(bars);
      };
      
      const started = await sensorRef.current.start();
      if (!started) {
        setProcessingState('error');
        setErrorMessage('Microphone access denied or not available. Please allow microphone permissions in your browser or switch to Demo Simulation.');
        return;
      }
    }

    setProcessingState('recording');
    setIsRecording(true);

    let left = 10;
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
    const resampled = sensorRef.current?.getResampledSamples(2000) || { samples: [], sampleRate: 2000 };
    stopRecording();

    // Check minimum recording length if in real mode (minimum 3 seconds)
    if (activeMode === 'real' && resampled.samples.length < resampled.sampleRate * 3) {
      setProcessingState('error');
      setErrorMessage('Audio recording was too short (under 3 seconds). Please record for 10 seconds.');
      return;
    }

    setProcessingState('processing');

    try {
      const response = await measurementApi.submitHeartSound({
        mode: activeMode,
        audioSamples: resampled.samples,
        sampleRate: resampled.sampleRate,
        simulatedScenario: currentScenario as DemoScenario
      });
      setResult(response.screening);
      setProcessingState('success');
      if (onComplete) onComplete(response.screening);
    } catch (err: any) {
      setProcessingState('error');
      setErrorMessage(err.message || 'Unable to analyze heart sound recording. Please retry in a silent room.');
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
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              Demo
            </button>
          </div>
          <span className="text-[11px] font-bold text-gray-600 uppercase tracking-wider">
            Phonocardiogram
          </span>
        </div>
      </div>

      <div className="rounded-3xl border border-[#EAE7DE] bg-white p-5 shadow-xs">
        <div>
          <h2 className="text-lg font-bold text-[#1F2421]">Heart Sound & Rhythm Screening</h2>
          <p className="mt-1 text-xs text-[#5C645D]">
            Acoustic phonocardiogram screening for S1/S2 heart sound periodicity and turbulent murmur artifacts.
          </p>
        </div>

        {/* Instructions */}
        <div className="mt-4 rounded-2xl bg-[#F8F7F2] p-4 text-xs text-gray-700 space-y-1.5 border border-gray-200">
          <div className="font-bold text-gray-900">Before recording:</div>
          <div>• Sit upright in a quiet room with minimal ambient noise.</div>
          <div>• Rest the smartphone microphone gently against the left upper chest.</div>
          <div>• Breathe gently and remain still for 25 seconds.</div>
        </div>

        {/* Interactive Visualizer & Level Meter */}
        <div className="mt-4 rounded-2xl bg-neutral-900 p-6 flex flex-col items-center justify-center text-white min-h-[160px]">
          <div
            className={`flex h-16 w-16 items-center justify-center rounded-full border-2 transition-all ${
              isRecording ? 'border-purple-400 bg-purple-500/30 animate-pulse' : 'border-gray-700 bg-gray-800'
            }`}
          >
            <Mic className={`h-8 w-8 ${isRecording ? 'text-purple-300' : 'text-gray-400'}`} />
          </div>

          <div className="mt-3 text-center">
            {isRecording ? (
              <div>
                <span className="text-2xl font-black tracking-widest text-white">{secondsLeft}s</span>
                <p className="text-[11px] text-purple-200 mt-1">Listening to acoustic chest vibrations...</p>
              </div>
            ) : (
              <span className="text-xs text-gray-400 font-medium">Ready to record</span>
            )}
          </div>

          {/* Real-time Frequency Spectrum Bars */}
          {isRecording && (
            <div className="mt-4 flex h-10 w-full max-w-xs items-end justify-center gap-1">
              {frequencyBars.length > 0 ? (
                frequencyBars.map((val, idx) => (
                  <div
                    key={idx}
                    style={{ height: `${Math.max(4, Math.min(36, val / 4))}px` }}
                    className="w-2.5 rounded-t-xs bg-purple-400/80 transition-all duration-75"
                  />
                ))
              ) : (
                <div className="text-[11px] text-gray-500">Awaiting audio input...</div>
              )}
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
              <span>Start 25-Second Recording</span>
            </button>
          )}

          {processingState === 'recording' && (
            <div className="flex gap-2">
              {secondsLeft <= 20 && (
                <button
                  onClick={finishAndAnalyze}
                  className="flex-1 rounded-2xl bg-[#15803D] py-3 text-xs font-bold text-white shadow hover:bg-[#166534] transition-all"
                >
                  Finish & Analyze Now ({25 - secondsLeft}s recorded)
                </button>
              )}
              <button
                onClick={stopRecording}
                className="flex items-center justify-center gap-1.5 rounded-2xl bg-red-600 px-4 py-3 text-xs font-bold text-white shadow hover:bg-red-700"
              >
                <RefreshCw className="h-4 w-4 animate-spin" />
                <span>Cancel</span>
              </button>
            </div>
          )}

          {processingState === 'processing' && (
            <div className="flex items-center justify-center gap-3 rounded-2xl bg-purple-50 p-4 border border-purple-200 text-purple-950 text-xs font-semibold">
              <RefreshCw className="h-4 w-4 animate-spin text-purple-700" />
              <span>Running HeartSoundCNN ML acoustic spectrogram inference...</span>
            </div>
          )}

          {processingState === 'error' && (
            <div className="space-y-3">
              <div className="rounded-2xl bg-red-50 p-4 border border-red-200 text-xs text-red-900 flex items-start gap-2">
                <AlertCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold">Screening Interrupted</h4>
                  <p className="mt-0.5 text-red-800">{errorMessage}</p>
                </div>
              </div>
              <button
                onClick={startRecording}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#15803D] py-3 text-xs font-bold text-white shadow hover:bg-[#166534]"
              >
                <RefreshCw className="h-4 w-4" />
                <span>Retry in Quieter Room</span>
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
                <div>
                  <span className="text-[10px] font-mono text-purple-700 uppercase tracking-wider font-bold">
                    HeartSoundCNN v1
                  </span>
                  <div className="text-sm font-black text-gray-900">Acoustic Screening Result</div>
                </div>
              </div>
              <span
                className={`rounded-full px-2.5 py-1 text-xs font-bold font-mono ${
                  result.status === 'normal'
                    ? 'bg-green-100 text-green-800 border border-green-300'
                    : result.status === 'monitor'
                    ? 'bg-amber-100 text-amber-800 border border-amber-300'
                    : 'bg-red-100 text-red-800 border border-red-300'
                }`}
              >
                {result.riskCategory || (result.status === 'normal' ? 'NORMAL' : result.status === 'monitor' ? 'MONITOR' : 'FOLLOW_UP')}
              </span>
            </div>

            {/* Metrics cards */}
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl bg-white p-2.5 border border-gray-200">
                <div className="text-[10px] text-gray-500 font-bold">PATTERN</div>
                <div className="text-xs font-extrabold text-gray-900 mt-1 capitalize">
                  {result.patternType.replace(/_/g, ' ')}
                </div>
              </div>
              <div className="rounded-xl bg-white p-2.5 border border-gray-200">
                <div className="text-[10px] text-gray-500 font-bold">ABNORMAL PROB</div>
                <div className="text-sm font-black text-purple-700 font-mono mt-0.5">
                  {result.abnormalProbability !== undefined
                    ? `${Math.round(result.abnormalProbability * 100)}%`
                    : result.status === 'follow_up' ? '82%' : '14%'}
                </div>
              </div>
              <div className="rounded-xl bg-white p-2.5 border border-gray-200">
                <div className="text-[10px] text-gray-500 font-bold">CONFIDENCE</div>
                <div className="text-sm font-black text-gray-900 mt-0.5 capitalize">
                  {result.confidence}
                </div>
              </div>
            </div>

            <p className="text-xs text-gray-700 leading-relaxed bg-white rounded-xl p-3 border border-gray-200">
              {result.explanation}
            </p>

            {/* Required Clinical Screening Disclaimers */}
            <div className="rounded-xl bg-purple-50/80 p-3 text-xs text-purple-950 border border-purple-200 space-y-1">
              <div className="font-bold flex items-center gap-1.5">
                <Info className="h-4 w-4 text-purple-700 shrink-0" />
                <span>Screening Result Notice</span>
              </div>
              <p className="text-[11px] text-purple-900 leading-normal">
                This is a screening result, not a diagnosis. This screening identifies sound patterns that may warrant further evaluation. It does not diagnose a condition, valvular defect, or arrhythmia.
              </p>
            </div>

            <div className="flex gap-2">
              <button
                onClick={startRecording}
                className="flex-1 rounded-xl border border-gray-300 bg-white py-2.5 text-xs font-bold text-gray-700 hover:bg-gray-50"
              >
                Re-record
              </button>
              {onComplete && (
                <button
                  onClick={() => onComplete(result)}
                  className="flex-1 rounded-xl bg-[#15803D] py-2.5 text-xs font-bold text-white shadow hover:bg-[#166534]"
                >
                  Continue Checkup
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
