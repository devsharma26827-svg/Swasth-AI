import React, { useState, useEffect, useRef } from 'react';
import {
  Camera,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Heart,
  Activity,
  Info,
  ArrowLeft,
  Flashlight,
  SlidersHorizontal,
  Sparkles,
  ShieldAlert,
  Zap,
  HelpCircle
} from 'lucide-react';
import { CameraPPGSensor, RGBSample, PPGFrameDiagnostic, PPGDiagnosticState } from '../services/sensors';
import { measurementApi } from '../services/api';
import { PPGMeasurementResult, DemoScenario } from '../types';

interface Props {
  onComplete?: (result: PPGMeasurementResult) => void;
  onBack?: () => void;
  currentScenario?: DemoScenario;
}

export const PPGScreen: React.FC<Props> = ({
  onComplete,
  onBack,
  currentScenario = 'normal'
}) => {
  // Capture Mode
  const [activeMode, setActiveMode] = useState<'real' | 'demo'>('real');
  const [selectedDemoScenario, setSelectedDemoScenario] = useState<DemoScenario>(currentScenario);

  // Sensor lifecycle states
  // 'idle' | 'aligning' | 'recording' | 'processing' | 'success' | 'error'
  const [sensorPhase, setSensorPhase] = useState<'idle' | 'aligning' | 'recording' | 'processing' | 'success' | 'error'>('idle');
  const phaseRef = useRef<'idle' | 'aligning' | 'recording' | 'processing' | 'success' | 'error'>('idle');

  const setPhase = (p: 'idle' | 'aligning' | 'recording' | 'processing' | 'success' | 'error') => {
    phaseRef.current = p;
    setSensorPhase(p);
  };

  // Technical Development Diagnostics (Part 6 & 7)
  const [showDevDiagnostics, setShowDevDiagnostics] = useState(false);
  const [devDiagnostics, setDevDiagnostics] = useState({
    cameraReady: false,
    cameraPermission: 'prompt',
    cameraPosition: 'rear / environment',
    torchAvailable: false,
    torchEnabled: true,
    framesReceived: 0,
    fps: 0,
    measurementDuration: 20,
    signalSamples: 0,
    fingerDetected: false,
    signalQuality: 0,
    processingStarted: false,
    processingCompleted: false,
    apiSuccess: false
  });

  // Diagnostic feedback
  const [diagnostic, setDiagnostic] = useState<PPGFrameDiagnostic>({
    state: 'INITIALIZING',
    isCovered: false,
    qualityScore: 0,
    message: 'Camera ready. Tap to start.',
    avgR: 0,
    avgG: 0,
    avgB: 0,
    fps: 0,
    frameCount: 0,
    torchActive: false,
    hasTorch: false,
    cameraLabel: ''
  });

  // Real-time live metrics
  const [secondsLeft, setSecondsLeft] = useState(20);
  const [liveWaveform, setLiveWaveform] = useState<number[]>([]);
  const [stableCount, setStableCount] = useState(0);
  const stableCountRef = useRef(0);
  const isRecordingTriggeredRef = useRef(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [result, setResult] = useState<PPGMeasurementResult | null>(null);
  const [torchEnabled, setTorchEnabled] = useState(true);

  // References
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const sensorRef = useRef<CameraPPGSensor | null>(null);
  const rgbBufferRef = useRef<{ r: number[]; g: number[]; b: number[]; timestamps: number[] }>({
    r: [],
    g: [],
    b: [],
    timestamps: []
  });
  const timerRef = useRef<any>(null);
  const lastWaveSampleRef = useRef<number>(0);

  useEffect(() => {
    sensorRef.current = new CameraPPGSensor();
    return () => {
      cleanupSensor();
    };
  }, []);

  const cleanupSensor = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (sensorRef.current) sensorRef.current.stop();
  };

  // Start Alignment phase
  const startCameraAlignment = async () => {
    setErrorMessage('');
    setErrorCode(null);
    setResult(null);
    setLiveWaveform([]);
    rgbBufferRef.current = { r: [], g: [], b: [], timestamps: [] };
    stableCountRef.current = 0;
    isRecordingTriggeredRef.current = false;
    setStableCount(0);
    setSecondsLeft(20);

    if (activeMode === 'demo') {
      // Direct demo execution without camera
      executeDemoMeasurement();
      return;
    }

    setPhase('aligning');

    if (sensorRef.current) {
      sensorRef.current.stop();
    }
    sensorRef.current = new CameraPPGSensor();

    sensorRef.current.onFrame = (sample: RGBSample, diag: PPGFrameDiagnostic) => {
      setDiagnostic(diag);

      // Update dev diagnostics in real-time
      setDevDiagnostics(prev => ({
        ...prev,
        cameraReady: true,
        framesReceived: diag.frameCount,
        fps: diag.fps,
        signalQuality: diag.qualityScore,
        fingerDetected: diag.isCovered,
        torchAvailable: diag.hasTorch,
        torchEnabled: diag.torchActive,
        signalSamples: rgbBufferRef.current.r.length
      }));

      const currentPhase = phaseRef.current;

      // In aligning phase: track stable frames to auto-trigger recording
      if (currentPhase === 'aligning') {
        if (diag.isCovered && (diag.state === 'GOOD_SIGNAL' || diag.state === 'FINGER_DETECTED')) {
          stableCountRef.current++;
          setStableCount(stableCountRef.current);
          if (stableCountRef.current >= 15 && !isRecordingTriggeredRef.current) {
            isRecordingTriggeredRef.current = true;
            startActiveRecording();
          }
        } else {
          stableCountRef.current = 0;
          setStableCount(0);
        }
      }

      // In recording phase: accumulate high-resolution buffer (no stale closure!)
      if (currentPhase === 'recording') {
        rgbBufferRef.current.r.push(sample.r);
        rgbBufferRef.current.g.push(sample.g);
        rgbBufferRef.current.b.push(sample.b);
        rgbBufferRef.current.timestamps.push(sample.timestampMs);

        // Approximate AC pulsatile component for live waveform visualization
        const diff = sample.r - lastWaveSampleRef.current;
        lastWaveSampleRef.current = lastWaveSampleRef.current * 0.95 + sample.r * 0.05;

        setLiveWaveform(prev => {
          const next = [...prev, diff];
          return next.slice(-60); // Keep last 60 samples
        });
      }
    };

    const initResult = await sensorRef.current.start(videoRef.current || undefined, {
      requestTorch: torchEnabled,
      preferRear: true
    });

    if (!initResult.success) {
      setPhase('error');
      setErrorCode('CAMERA_ACCESS_DENIED');
      setErrorMessage(initResult.error || 'Camera could not be started. Check browser permissions.');
      setDevDiagnostics(prev => ({ ...prev, cameraPermission: 'denied', cameraReady: false }));
    } else {
      setDevDiagnostics(prev => ({
        ...prev,
        cameraPermission: 'granted',
        cameraReady: true,
        torchAvailable: initResult.hasTorch
      }));
    }
  };

  // Transition from alignment to active 20s recording
  const startActiveRecording = () => {
    setPhase('recording');
    setSecondsLeft(20);
    rgbBufferRef.current = { r: [], g: [], b: [], timestamps: [] };

    let left = 20;
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      left--;
      setSecondsLeft(left);
      if (left <= 0) {
        clearInterval(timerRef.current);
        finishAndAnalyze();
      }
    }, 1000);
  };

  // Toggle Torch on/off
  const toggleTorch = async () => {
    if (!sensorRef.current) return;
    const newState = !torchEnabled;
    const ok = await sensorRef.current.toggleTorch(newState);
    if (ok) {
      setTorchEnabled(newState);
    }
  };

  // Stop / Cancel active measurement
  const cancelCapture = () => {
    cleanupSensor();
    setPhase('idle');
    setStableCount(0);
    stableCountRef.current = 0;
    isRecordingTriggeredRef.current = false;
  };

  // Submit real frames to backend for digital signal processing
  const finishAndAnalyze = async () => {
    cleanupSensor();
    setPhase('processing');
    setDevDiagnostics(prev => ({ ...prev, processingStarted: true }));

    try {
      const response = await measurementApi.submitPPG({
        mode: 'real',
        redValues: rgbBufferRef.current.r,
        greenValues: rgbBufferRef.current.g,
        blueValues: rgbBufferRef.current.b,
        frameTimestampsMs: rgbBufferRef.current.timestamps,
        fps: diagnostic.fps > 10 ? diagnostic.fps : 30
      });

      setResult(response.measurement);
      setPhase('success');
      setDevDiagnostics(prev => ({
        ...prev,
        processingCompleted: true,
        apiSuccess: true
      }));
      if (onComplete) onComplete(response.measurement);
    } catch (err: any) {
      setPhase('error');
      setErrorCode(err.code || 'SIGNAL_PROCESSING_FAILED');
      setErrorMessage(
        err.message || 'Optical signal was too noisy to accurately compute pulse rate. Please hold steadily and retry.'
      );
      setDevDiagnostics(prev => ({
        ...prev,
        processingCompleted: true,
        apiSuccess: false
      }));
    }
  };

  // Demo mode trigger
  const executeDemoMeasurement = async () => {
    setPhase('processing');
    try {
      const response = await measurementApi.submitPPG({
        mode: 'demo',
        simulatedScenario: selectedDemoScenario
      });
      setResult(response.measurement);
      setPhase('success');
      if (onComplete) onComplete(response.measurement);
    } catch (err: any) {
      setPhase('error');
      setErrorCode('DEMO_ERROR');
      setErrorMessage(err.message || 'Demo scenario evaluation failed.');
    }
  };

  // Helper for status colors
  const getStatusColor = (state: PPGDiagnosticState) => {
    switch (state) {
      case 'GOOD_SIGNAL':
        return 'border-green-500 text-green-700 bg-green-50';
      case 'FINGER_DETECTED':
        return 'border-blue-400 text-blue-700 bg-blue-50';
      case 'EXCESSIVE_MOTION':
      case 'TOO_BRIGHT':
      case 'TOO_DARK':
        return 'border-amber-400 text-amber-800 bg-amber-50';
      case 'NO_FINGER':
      default:
        return 'border-red-400 text-red-700 bg-red-50';
    }
  };

  return (
    <div className="mx-auto max-w-lg space-y-4 p-4 pb-24 animate-fade-in">
      {/* Top Header */}
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

        <div className="flex items-center gap-2">
          {/* Mode Switcher Pill */}
          <div className="flex items-center rounded-full bg-gray-100 p-0.5 border border-gray-200">
            <button
              onClick={() => {
                if (sensorPhase === 'idle') setActiveMode('real');
              }}
              className={`rounded-full px-2.5 py-1 text-[11px] font-bold transition-all ${
                activeMode === 'real'
                  ? 'bg-white text-gray-900 shadow-xs'
                  : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              Real Camera Sensor
            </button>
            <button
              onClick={() => {
                if (sensorPhase === 'idle') setActiveMode('demo');
              }}
              className={`rounded-full px-2.5 py-1 text-[11px] font-bold transition-all ${
                activeMode === 'demo'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              Demo Simulation
            </button>
          </div>
        </div>
      </div>

      {/* Demo Scenario Selector (if Demo Mode active) */}
      {activeMode === 'demo' && (
        <div className="rounded-2xl border border-indigo-200 bg-indigo-50/70 p-3.5 space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-indigo-950">
            <span className="flex items-center gap-1.5">
              <Sparkles className="h-4 w-4 text-indigo-600" />
              Demo Simulation Scenario
            </span>
            <span className="text-[10px] font-normal text-indigo-700">Deterministic Evaluation Mode</span>
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {[
              { id: 'normal', label: 'Normal (72 BPM)' },
              { id: 'monitor', label: 'Borderline (88 BPM)' },
              { id: 'follow_up', label: 'Elevated (104 BPM)' },
              { id: 'low_quality', label: 'Low Quality Test' }
            ].map(sc => (
              <button
                key={sc.id}
                onClick={() => setSelectedDemoScenario(sc.id as DemoScenario)}
                className={`rounded-xl px-2 py-1.5 text-[11px] font-semibold border transition-all ${
                  selectedDemoScenario === sc.id
                    ? 'border-indigo-600 bg-indigo-600 text-white shadow-xs'
                    : 'border-indigo-200 bg-white text-indigo-900 hover:bg-indigo-50'
                }`}
              >
                {sc.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Main PPG Interactive Card */}
      <div className="rounded-3xl border border-[#EAE7DE] bg-white p-5 shadow-xs space-y-4">
        <div>
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#15803D]">
              Optical Photoplethysmography
            </span>
            {sensorPhase === 'recording' && (
              <span className="flex items-center gap-1 text-xs font-extrabold text-red-600 animate-pulse">
                <span className="h-2 w-2 rounded-full bg-red-600" />
                RECORDING
              </span>
            )}
          </div>
          <h1 className="text-xl font-black text-[#1F2421] mt-0.5">
            Heart Rate, HRV & Blood Volume
          </h1>
          <p className="text-xs text-[#5C645D] mt-1">
            Detects micro-pulsatile capillary blood expansion via rear camera optical absorption.
          </p>
        </div>

        {/* Live Camera Viewport & Placement Guidance */}
        {activeMode === 'real' && (
          <div className="relative overflow-hidden rounded-2xl bg-neutral-950 aspect-[4/3] flex flex-col items-center justify-center text-white border border-neutral-800">
            {/* Live Video Feed */}
            <video
              ref={videoRef}
              className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-300 ${
                sensorPhase === 'aligning' || sensorPhase === 'recording'
                  ? 'opacity-85'
                  : 'opacity-15'
              }`}
              autoPlay
              playsInline
              muted
            />

            {/* Viewport Overlay Controls (Torch, FPS, Device) */}
            {(sensorPhase === 'aligning' || sensorPhase === 'recording') && (
              <div className="absolute top-2.5 inset-x-3 flex items-center justify-between z-20 text-[11px]">
                <span className="rounded-full bg-black/60 px-2.5 py-1 text-white/90 backdrop-blur-xs font-mono">
                  {diagnostic.cameraLabel ? diagnostic.cameraLabel.slice(0, 18) : 'Rear Camera'} • {diagnostic.fps} FPS
                </span>

                {diagnostic.hasTorch && (
                  <button
                    onClick={toggleTorch}
                    className={`flex items-center gap-1 rounded-full px-2.5 py-1 backdrop-blur-xs font-bold transition-all ${
                      diagnostic.torchActive
                        ? 'bg-amber-400 text-neutral-950 shadow-md shadow-amber-500/20'
                        : 'bg-black/60 text-white/80 hover:text-white'
                    }`}
                  >
                    <Flashlight className="h-3 w-3" />
                    <span>{diagnostic.torchActive ? 'Flash ON' : 'Flash OFF'}</span>
                  </button>
                )}
              </div>
            )}

            {/* Reticle / Finger Placement Guide */}
            <div className="relative z-10 flex flex-col items-center p-4 text-center">
              {sensorPhase === 'idle' ? (
                <div className="space-y-2">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-neutral-800 text-neutral-400 border border-neutral-700">
                    <Camera className="h-8 w-8" />
                  </div>
                  <p className="text-xs text-neutral-300 max-w-xs">
                    Ready to scan. Please sit comfortably and ensure index finger is clean.
                  </p>
                </div>
              ) : sensorPhase === 'processing' ? (
                <div className="space-y-3 animate-pulse">
                  <RefreshCw className="h-10 w-10 animate-spin text-[#15803D] mx-auto" />
                  <div className="text-xs font-bold text-white">
                    Processing Optical PPG Signal...
                  </div>
                  <p className="text-[11px] text-neutral-400">
                    Filtering baseline wander & extracting systolic peaks
                  </p>
                </div>
              ) : (
                <>
                  {/* Dynamic Target Reticle */}
                  <div
                    className={`relative flex h-24 w-24 items-center justify-center rounded-full border-4 transition-all duration-200 ${
                      diagnostic.isCovered
                        ? 'border-green-500 bg-green-500/25 shadow-lg shadow-green-500/30'
                        : 'border-red-500 bg-red-500/20 animate-pulse'
                    }`}
                  >
                    <Heart
                      className={`h-12 w-12 transition-all duration-150 ${
                        diagnostic.isCovered
                          ? 'text-red-500 scale-110'
                          : 'text-neutral-400 scale-95'
                      }`}
                    />

                    {/* Circular stabilization progress indicator */}
                    {sensorPhase === 'aligning' && stableCount > 0 && (
                      <div className="absolute -inset-2 rounded-full border-2 border-green-400 border-dashed animate-spin" />
                    )}
                  </div>

                  {/* Real-time Status Chip */}
                  <div className="mt-3.5">
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-bold backdrop-blur-md border ${
                        diagnostic.isCovered
                          ? 'bg-green-600/90 border-green-400 text-white'
                          : 'bg-red-600/90 border-red-400 text-white'
                      }`}
                    >
                      {diagnostic.message}
                    </span>
                  </div>

                  {/* Countdown Timer */}
                  {sensorPhase === 'recording' && (
                    <div className="mt-2 text-3xl font-black tracking-widest text-white font-mono">
                      {secondsLeft}s
                    </div>
                  )}

                  {/* Alignment Stabilization Hint */}
                  {sensorPhase === 'aligning' && (
                    <p className="mt-2 text-[11px] text-neutral-300">
                      {stableCount > 0
                        ? `Signal locking (${Math.round((stableCount / 25) * 100)}%). Hold steady...`
                        : 'Cover rear camera completely. Flash will illuminate your finger.'}
                    </p>
                  )}
                </>
              )}
            </div>

            {/* Bottom diagnostic channel bar */}
            {(sensorPhase === 'aligning' || sensorPhase === 'recording') && (
              <div className="absolute bottom-2 inset-x-3 flex items-center justify-between text-[10px] text-neutral-400 z-20 font-mono">
                <span>R: {diagnostic.avgR} | G: {diagnostic.avgG} | B: {diagnostic.avgB}</span>
                <span>Quality: {diagnostic.qualityScore}%</span>
              </div>
            )}
          </div>
        )}

        {/* Live Optical Waveform Visualizer */}
        {sensorPhase === 'recording' && liveWaveform.length > 2 && (
          <div className="rounded-2xl bg-[#F8F7F2] p-3.5 border border-[#EAE7DE] space-y-1.5">
            <div className="flex items-center justify-between text-[11px] font-bold text-gray-700">
              <span className="flex items-center gap-1">
                <Activity className="h-3.5 w-3.5 text-[#15803D]" />
                Live Optical Plethysmogram Waveform
              </span>
              <span className="text-xs text-[#15803D] font-mono">
                SQI: {diagnostic.qualityScore}%
              </span>
            </div>

            {/* SVG Waveform Rendering */}
            <div className="h-16 w-full rounded-xl bg-white p-1 border border-gray-200 overflow-hidden flex items-center">
              <svg className="h-full w-full" preserveAspectRatio="none" viewBox="0 0 300 60">
                <path
                  d={liveWaveform.reduce((acc, val, idx) => {
                    const x = (idx / (liveWaveform.length - 1)) * 300;
                    // Normalize waveform amplitude centered around y=30
                    const y = Math.max(5, Math.min(55, 30 - val * 2.5));
                    return `${acc} ${idx === 0 ? 'M' : 'L'} ${x},${y}`;
                  }, '')}
                  fill="none"
                  stroke="#15803D"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <p className="text-[10px] text-gray-500">
              Real-time pulsatile AC variation extracted from continuous camera frame buffer.
            </p>
          </div>
        )}

        {/* SUCCESS RESULT CARD */}
        {sensorPhase === 'success' && result && (
          <div className="rounded-2xl border border-green-200 bg-green-50/50 p-4 space-y-4 animate-fade-in">
            <div className="flex items-center justify-between border-b border-green-200 pb-3">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-600 text-white">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
                <div>
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-green-800">
                    Acquisition Complete
                  </span>
                  <h3 className="text-base font-black text-gray-900">Physiological Metrics</h3>
                </div>
              </div>

              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                  result.status === 'normal'
                    ? 'bg-green-100 text-green-800 border border-green-300'
                    : result.status === 'monitor'
                    ? 'bg-amber-100 text-amber-800 border border-amber-300'
                    : 'bg-red-100 text-red-800 border border-red-300'
                }`}
              >
                {result.status.toUpperCase()}
              </span>
            </div>

            {/* Vitals Grid */}
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl bg-white p-3 border border-gray-200 shadow-2xs">
                <span className="text-[10px] font-bold text-gray-500">PULSE RATE</span>
                <div className="text-xl font-black text-gray-900 font-mono mt-0.5">
                  {result.heartRate}
                </div>
                <span className="text-[10px] text-gray-500">BPM</span>
              </div>

              <div className="rounded-xl bg-white p-3 border border-gray-200 shadow-2xs">
                <span className="text-[10px] font-bold text-gray-500">HRV (RMSSD)</span>
                <div className="text-xl font-black text-gray-900 font-mono mt-0.5">
                  {result.hrvRmssd}
                </div>
                <span className="text-[10px] text-gray-500">ms</span>
              </div>

              <div className="rounded-xl bg-white p-3 border border-gray-200 shadow-2xs">
                <span className="text-[10px] font-bold text-gray-500">EST. SpO₂</span>
                <div className="text-xl font-black text-gray-900 font-mono mt-0.5">
                  ~{result.estimatedSpO2}%
                </div>
                <span className="text-[10px] text-amber-700">Proxy</span>
              </div>
            </div>

            {/* Clinical interpretation */}
            <div className="rounded-xl bg-white p-3 border border-gray-200 text-xs text-gray-700 space-y-1">
              <div className="font-bold text-gray-900">Analysis Summary:</div>
              <p>{result.explanation}</p>
            </div>

            <div className="text-[10px] text-gray-500 border-t border-green-200/60 pt-2">
              {result.disclaimer}
            </div>
          </div>
        )}

        {/* ERROR / DIAGNOSTIC RECOVERY CARD */}
        {sensorPhase === 'error' && (
          <div className="rounded-2xl border border-red-200 bg-red-50/70 p-4 space-y-3 animate-fade-in">
            <div className="flex items-start gap-2.5">
              <AlertCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs font-bold text-red-900">
                  {errorCode ? `Scan Failed: ${errorCode}` : 'Optical Capture Incomplete'}
                </h4>
                <p className="text-xs text-red-800 mt-0.5">{errorMessage}</p>
              </div>
            </div>

            {/* Concrete actionable tips */}
            <div className="rounded-xl bg-white p-3 border border-red-100 text-xs text-gray-700 space-y-1.5">
              <div className="font-bold text-gray-900">How to fix for a successful scan:</div>
              <ul className="list-disc list-inside space-y-0.5 text-[11px] text-gray-600">
                <li>Cover the rear camera lens completely with your index fingertip.</li>
                <li>Apply gentle, steady pressure — do not press hard, which blanches capillaries.</li>
                <li>Rest your phone and hand on a flat surface to eliminate tremors.</li>
                <li>Ensure the phone flashlight is illuminated to penetrate finger tissue.</li>
              </ul>
            </div>

            <div className="flex gap-2">
              <button
                onClick={startCameraAlignment}
                className="flex-1 rounded-xl bg-red-700 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-red-800 transition-all text-center"
              >
                Try Real Scan Again
              </button>
              <button
                onClick={() => {
                  setActiveMode('demo');
                  setPhase('idle');
                }}
                className="rounded-xl border border-red-300 bg-white px-3 py-2.5 text-xs font-bold text-red-800 hover:bg-red-50 transition-all"
              >
                Use Demo Mode
              </button>
            </div>
          </div>
        )}

        {/* Torch unavailable notice */}
        {activeMode === 'real' && !diagnostic.hasTorch && sensorPhase !== 'idle' && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">Notice:</span> Flash / Torch is not detected on this camera. Your device may not provide enough light for this measurement. Position your fingertip under a bright lamp or ambient light source.
            </div>
          </div>
        )}

        {/* ACTION BUTTONS */}
        <div className="pt-2">
          {sensorPhase === 'idle' && (
            <button
              onClick={startCameraAlignment}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#15803D] py-3.5 px-6 text-sm font-bold text-white shadow hover:bg-[#166534] transition-all"
            >
              <Camera className="h-4 w-4" />
              <span>
                {activeMode === 'real' ? 'Start Real Camera PPG Scan' : 'Run Demo Simulation Scan'}
              </span>
            </button>
          )}

          {(sensorPhase === 'aligning' || sensorPhase === 'recording') && (
            <div className="flex gap-2">
              {sensorPhase === 'aligning' && (
                <button
                  onClick={startActiveRecording}
                  disabled={!diagnostic.isCovered}
                  className={`flex-1 rounded-2xl py-3 text-xs font-bold shadow transition-all ${
                    diagnostic.isCovered
                      ? 'bg-[#15803D] text-white hover:bg-[#166534]'
                      : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  Start 20s Scan Now
                </button>
              )}

              <button
                onClick={cancelCapture}
                className="flex items-center justify-center gap-1.5 rounded-2xl bg-gray-200 px-5 py-3 text-xs font-bold text-gray-700 hover:bg-gray-300 transition-all"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                <span>Cancel</span>
              </button>
            </div>
          )}

          {sensorPhase === 'success' && (
            <div className="flex gap-2">
              <button
                onClick={startCameraAlignment}
                className="flex-1 rounded-2xl border border-gray-300 bg-white py-3 text-xs font-bold text-gray-700 hover:bg-gray-50 transition-all"
              >
                Scan Again
              </button>
              {onComplete && result && (
                <button
                  onClick={() => onComplete(result)}
                  className="flex-1 rounded-2xl bg-[#15803D] py-3 text-xs font-bold text-white shadow hover:bg-[#166534] transition-all"
                >
                  Continue Checkup
                </button>
              )}
            </div>
          )}
        </div>

        {/* Development Diagnostics Panel (Part 6 & 7) */}
        <div className="pt-2 border-t border-[#EAE7DE]">
          <button
            onClick={() => setShowDevDiagnostics(prev => !prev)}
            className="flex w-full items-center justify-between text-xs font-semibold text-gray-500 hover:text-gray-800"
          >
            <span className="flex items-center gap-1.5">
              <SlidersHorizontal className="h-3.5 w-3.5" />
              Technical Diagnostics (Fingertip PPG Camera)
            </span>
            <span className="text-[10px] font-mono">{showDevDiagnostics ? '▲ Hide' : '▼ Show'}</span>
          </button>

          {showDevDiagnostics && (
            <div className="mt-2.5 rounded-xl bg-gray-900 text-gray-200 p-3 text-[11px] font-mono space-y-1.5 border border-gray-800">
              <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                <div>cameraReady: <span className={devDiagnostics.cameraReady ? 'text-green-400' : 'text-red-400'}>{String(devDiagnostics.cameraReady)}</span></div>
                <div>permission: <span className="text-yellow-400">{devDiagnostics.cameraPermission}</span></div>
                <div>position: <span className="text-blue-300">{devDiagnostics.cameraPosition}</span></div>
                <div>torchAvailable: <span className={devDiagnostics.torchAvailable ? 'text-green-400' : 'text-amber-400'}>{String(devDiagnostics.torchAvailable)}</span></div>
                <div>torchEnabled: <span className={devDiagnostics.torchEnabled ? 'text-green-400' : 'text-gray-400'}>{String(devDiagnostics.torchEnabled)}</span></div>
                <div>framesReceived: <span className="text-purple-300">{devDiagnostics.framesReceived}</span></div>
                <div>fps: <span className="text-green-300">{devDiagnostics.fps}</span></div>
                <div>duration: <span>{devDiagnostics.measurementDuration}s</span></div>
                <div>signalSamples: <span className="text-cyan-300">{rgbBufferRef.current.r.length}</span></div>
                <div>fingerDetected: <span className={diagnostic.isCovered ? 'text-green-400' : 'text-red-400'}>{String(diagnostic.isCovered)}</span></div>
                <div>signalQuality: <span className="text-yellow-300">{diagnostic.qualityScore}%</span></div>
                <div>phase: <span className="text-amber-300">{sensorPhase}</span></div>
                <div>processingStarted: <span className="text-gray-300">{String(devDiagnostics.processingStarted)}</span></div>
                <div>processingCompleted: <span className="text-gray-300">{String(devDiagnostics.processingCompleted)}</span></div>
                <div>apiSuccess: <span className={devDiagnostics.apiSuccess ? 'text-green-400' : 'text-gray-300'}>{String(devDiagnostics.apiSuccess)}</span></div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
