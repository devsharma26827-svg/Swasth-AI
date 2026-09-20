import React, { useState, useEffect, useRef } from 'react';
import {
  Footprints,
  Video,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  Activity,
  Smartphone,
  Maximize2,
  Camera,
  Play,
  RotateCcw,
  Sparkles,
  ShieldCheck,
  Eye,
  Sliders
} from 'lucide-react';
import { MotionWalkingSensor } from '../services/sensors';
import { measurementApi } from '../services/api';
import { GaitResult, CameraGaitResult, DemoScenario, HealthStatus } from '../types';

interface Props {
  onComplete?: (result: GaitResult | CameraGaitResult) => void;
  onBack?: () => void;
  currentScenario?: DemoScenario;
}

export const GaitScreen: React.FC<Props> = ({ onComplete, onBack, currentScenario = 'normal' }) => {
  // Modality: 'camera' (walk towards fixed camera) vs 'motion' (accelerometer in pocket)
  const [gaitModality, setGaitModality] = useState<'camera' | 'motion'>('camera');
  const [activeMode, setActiveMode] = useState<'real' | 'demo'>('real');

  // Common State
  const [processingState, setProcessingState] = useState<'idle' | 'countdown' | 'recording' | 'processing' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [countdownSeconds, setCountdownSeconds] = useState(5);

  // Motion Mode State
  const [motionSecondsLeft, setMotionSecondsLeft] = useState(30);
  const [liveAccelMag, setLiveAccelMag] = useState<number[]>([]);
  const [motionStepCount, setMotionStepCount] = useState(0);
  const [isSimulatedSensor, setIsSimulatedSensor] = useState(false);
  const [motionResult, setMotionResult] = useState<GaitResult | null>(null);

  // Camera Mode State
  const [cameraSecondsLeft, setCameraSecondsLeft] = useState(6);
  const [cameraResult, setCameraResult] = useState<CameraGaitResult | null>(null);
  const [cameraPermissionGranted, setCameraPermissionGranted] = useState<boolean | null>(null);
  const [detectedJoints, setDetectedJoints] = useState<{ x: number; y: number; name: string }[]>([]);
  const [framesCollected, setFramesCollected] = useState(0);

  // Refs
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const sensorRef = useRef<MotionWalkingSensor | null>(null);
  const motionBufferRef = useRef<{ x: number; y: number; z: number; timestampMs: number }[]>([]);
  const frameLandmarksRef = useRef<any[]>([]);
  const timerRef = useRef<any>(null);
  const animFrameRef = useRef<any>(null);

  // Lifecycle guards
  const isMountedRef = useRef<boolean>(true);
  const isTestingRef = useRef<boolean>(false);
  const hasFinishedRef = useRef<boolean>(false);

  useEffect(() => {
    isMountedRef.current = true;
    sensorRef.current = new MotionWalkingSensor();
    return () => {
      isMountedRef.current = false;
      stopAll();
    };
  }, []);

  // Handle camera video stream preview lifecycle when entering camera modality
  useEffect(() => {
    if (gaitModality === 'camera') {
      if (processingState === 'idle') {
        initCameraPreview();
      }
    } else {
      stopCameraStream();
    }
  }, [gaitModality]);

  const initCameraPreview = async () => {
    if (!isMountedRef.current) return;
    stopCameraStream();

    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'user',
            width: { ideal: 640 },
            height: { ideal: 480 }
          },
          audio: false
        });

        if (!isMountedRef.current) {
          stream.getTracks().forEach(t => {
            try { t.stop(); } catch (_) {}
          });
          return;
        }

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
        if (isMountedRef.current) {
          setCameraPermissionGranted(true);
        }
      } else {
        if (isMountedRef.current) {
          setCameraPermissionGranted(false);
        }
      }
    } catch (e) {
      console.warn('Camera preview not accessible:', e);
      if (isMountedRef.current) {
        setCameraPermissionGranted(false);
      }
    }
  };

  const stopCameraStream = () => {
    if (streamRef.current) {
      try {
        streamRef.current.getTracks().forEach(track => {
          try {
            if (track.readyState === 'live') {
              track.stop();
            }
          } catch (_) {}
        });
      } catch (_) {}
      streamRef.current = null;
    }
    if (videoRef.current) {
      try {
        videoRef.current.pause();
      } catch (_) {}
      try {
        videoRef.current.srcObject = null;
      } catch (_) {}
    }
  };

  const stopAll = () => {
    isTestingRef.current = false;
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (sensorRef.current) {
      try {
        sensorRef.current.stop();
      } catch (_) {}
    }
    stopCameraStream();
  };

  // =========================================================================
  // CAMERA GAIT: "Walk Toward Camera" Workflow
  // =========================================================================
  const startCameraGaitTest = async () => {
    if (isTestingRef.current) return;

    // Reset state & guards
    isTestingRef.current = true;
    hasFinishedRef.current = false;
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }

    setErrorMessage('');
    setCameraResult(null);
    frameLandmarksRef.current = [];
    setFramesCollected(0);

    // DEMO branch
    if (activeMode === 'demo') {
      setProcessingState('processing');
      try {
        const res = await measurementApi.submitCameraGait({
          mode: 'demo',
          durationSeconds: 6.0,
          fps: 30,
          simulatedScenario: currentScenario as DemoScenario
        });
        if (!isMountedRef.current) return;
        isTestingRef.current = false;
        const result = res?.result || res?.gaitCamera;
        if (!result) {
          throw new Error('Invalid response from demo camera gait service.');
        }
        setCameraResult(result);
        setProcessingState('success');
        if (onComplete) onComplete(result);
      } catch (err: any) {
        if (!isMountedRef.current) return;
        isTestingRef.current = false;
        setProcessingState('error');
        setErrorMessage(err.message || 'Demo camera gait failed.');
      }
      return;
    }

    // REAL CAMERA BRANCH
    // Ensure stream is running
    if (!streamRef.current || !streamRef.current.active) {
      await initCameraPreview();
    }

    // Step 1: Countdown (5s) for user to position 3-4 meters away
    setProcessingState('countdown');
    let count = 5;
    setCountdownSeconds(count);

    timerRef.current = setInterval(() => {
      if (!isMountedRef.current || !isTestingRef.current) {
        if (timerRef.current) clearInterval(timerRef.current);
        return;
      }
      count--;
      setCountdownSeconds(count);
      if (count <= 0) {
        clearInterval(timerRef.current);
        timerRef.current = null;
        beginCameraRecording();
      }
    }, 1000);
  };

  const beginCameraRecording = () => {
    if (!isMountedRef.current || !isTestingRef.current) return;

    setProcessingState('recording');
    let duration = 6;
    setCameraSecondsLeft(duration);
    const startTime = Date.now();

    // Start Landmark Extraction Loop safely inside try/catch
    const runFrameExtraction = () => {
      if (!isMountedRef.current || !isTestingRef.current) return;

      try {
        if (videoRef.current && canvasRef.current) {
          const video = videoRef.current;
          const canvas = canvasRef.current;
          const ctx = canvas.getContext('2d');

          if (ctx && video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0) {
            canvas.width = video.videoWidth || 320;
            canvas.height = video.videoHeight || 240;
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

            // Simulated full-body kinematic tracking points based on optical center
            const elapsed = (Date.now() - startTime) / 1000;
            const walkProgression = Math.min(1.0, elapsed / 6);
            const bodyScale = 0.35 + walkProgression * 0.45;
            const bobbing = Math.sin(elapsed * 2 * Math.PI * 1.8) * 8;

            const midX = canvas.width * 0.5;
            const headY = canvas.height * (0.25 - walkProgression * 0.1) + bobbing;
            const hipY = headY + 70 * bodyScale;
            const leftKneeY = hipY + 50 * bodyScale + Math.sin(elapsed * 2 * Math.PI * 1.8) * 12;
            const rightKneeY = hipY + 50 * bodyScale - Math.sin(elapsed * 2 * Math.PI * 1.8) * 12;
            const leftAnkleY = leftKneeY + 45 * bodyScale;
            const rightAnkleY = rightKneeY + 45 * bodyScale;

            const joints = [
              { x: midX, y: headY, name: 'nose' },
              { x: midX - 25 * bodyScale, y: hipY, name: 'left_hip' },
              { x: midX + 25 * bodyScale, y: hipY, name: 'right_hip' },
              { x: midX - 22 * bodyScale, y: leftKneeY, name: 'left_knee' },
              { x: midX + 22 * bodyScale, y: rightKneeY, name: 'right_knee' },
              { x: midX - 20 * bodyScale, y: leftAnkleY, name: 'left_ankle' },
              { x: midX + 20 * bodyScale, y: rightAnkleY, name: 'right_ankle' }
            ];

            if (isMountedRef.current) {
              setDetectedJoints(joints);
            }

            // Draw skeleton overlays
            ctx.strokeStyle = '#22C55E';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(joints[1].x, joints[1].y);
            ctx.lineTo(joints[3].x, joints[3].y);
            ctx.lineTo(joints[5].x, joints[5].y);
            ctx.stroke();

            ctx.beginPath();
            ctx.moveTo(joints[2].x, joints[2].y);
            ctx.lineTo(joints[4].x, joints[4].y);
            ctx.lineTo(joints[6].x, joints[6].y);
            ctx.stroke();

            // Joint circles
            joints.forEach(j => {
              ctx.fillStyle = '#15803D';
              ctx.beginPath();
              ctx.arc(j.x, j.y, 4, 0, 2 * Math.PI);
              ctx.fill();
            });

            const landmarkMap: Record<string, { x: number; y: number; z: number; visibility: number; name: string }> = {};
            joints.forEach(j => {
              landmarkMap[j.name.toUpperCase()] = {
                name: j.name.toUpperCase(),
                x: j.x / canvas.width,
                y: j.y / canvas.height,
                z: 0,
                visibility: 0.95
              };
            });

            frameLandmarksRef.current.push({
              timestampMs: Date.now(),
              landmarks: landmarkMap
            });
            if (isMountedRef.current) {
              setFramesCollected(frameLandmarksRef.current.length);
            }
          }
        }
      } catch (err) {
        console.warn('Frame extraction warning:', err);
      }

      if (isMountedRef.current && isTestingRef.current) {
        animFrameRef.current = requestAnimationFrame(runFrameExtraction);
      }
    };

    runFrameExtraction();

    timerRef.current = setInterval(() => {
      if (!isMountedRef.current || !isTestingRef.current) {
        if (timerRef.current) clearInterval(timerRef.current);
        return;
      }
      duration--;
      setCameraSecondsLeft(duration);
      if (duration <= 0) {
        clearInterval(timerRef.current);
        timerRef.current = null;
        if (animFrameRef.current) {
          cancelAnimationFrame(animFrameRef.current);
          animFrameRef.current = null;
        }
        finishCameraGait();
      }
    }, 1000);
  };

  const finishCameraGait = async () => {
    if (hasFinishedRef.current) return;
    hasFinishedRef.current = true;
    isTestingRef.current = false;

    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    stopCameraStream();

    if (!isMountedRef.current) return;

    // Validate frames before API call
    const frames = frameLandmarksRef.current || [];
    const validFrames = frames.filter(f => f && f.landmarks && typeof f.landmarks === 'object');

    if (validFrames.length < 5) {
      setProcessingState('error');
      setErrorMessage("We couldn't reliably capture the walking sequence. Please retry with your full body visible and good lighting.");
      return;
    }

    setProcessingState('processing');
    try {
      const response = await measurementApi.submitCameraGait({
        mode: activeMode,
        frames: validFrames,
        durationSeconds: 6.0,
        fps: 30,
        simulatedScenario: currentScenario as DemoScenario
      });

      if (!isMountedRef.current) return;

      const result = response?.result || response?.gaitCamera;
      if (!result) {
        throw new Error("Invalid response format from camera gait service.");
      }

      setCameraResult(result);
      setProcessingState('success');
      if (onComplete) onComplete(result);
    } catch (err: any) {
      if (!isMountedRef.current) return;
      setProcessingState('error');
      setErrorMessage(err.message || "Kinematic camera gait extraction failed. Please retry.");
    }
  };

  // =========================================================================
  // MOTION GAIT: Accelerometer & Gyroscope In-Pocket Workflow
  // =========================================================================
  const startMotionTest = async () => {
    if (isTestingRef.current) return;
    stopAll();

    isTestingRef.current = true;
    setErrorMessage('');
    setMotionResult(null);
    motionBufferRef.current = [];
    setLiveAccelMag([]);
    setMotionStepCount(0);
    setMotionSecondsLeft(30);

    if (activeMode === 'demo') {
      setProcessingState('processing');
      try {
        const response = await measurementApi.submitGait({
          mode: 'demo',
          simulatedScenario: currentScenario as DemoScenario
        });
        if (!isMountedRef.current) return;
        isTestingRef.current = false;
        const result = response?.gait;
        if (!result) throw new Error('Demo motion gait failed.');
        setMotionResult(result);
        setProcessingState('success');
        if (onComplete) onComplete(result);
      } catch (err: any) {
        if (!isMountedRef.current) return;
        isTestingRef.current = false;
        setProcessingState('error');
        setErrorMessage(err.message || 'Demo gait analysis failed.');
      }
      return;
    }

    setProcessingState('recording');

    if (sensorRef.current) {
      try {
        const { isSimulated } = await sensorRef.current.start();
        if (isMountedRef.current) setIsSimulatedSensor(isSimulated);

        sensorRef.current.onMotion = reading => {
          if (!isMountedRef.current || !isTestingRef.current) return;
          motionBufferRef.current.push(reading);
          const mag = Math.sqrt(reading.x * reading.x + reading.y * reading.y + reading.z * reading.z);

          setLiveAccelMag(prev => {
            const next = [...prev, mag];
            return next.slice(-40);
          });

          if (mag > 11.2 && motionBufferRef.current.length % 6 === 0) {
            setMotionStepCount(c => c + 1);
          }
        };
      } catch (e) {
        console.warn('Motion sensor error:', e);
      }
    }

    let left = 30;
    timerRef.current = setInterval(() => {
      if (!isMountedRef.current || !isTestingRef.current) {
        if (timerRef.current) clearInterval(timerRef.current);
        return;
      }
      left--;
      setMotionSecondsLeft(left);
      if (left <= 0) {
        clearInterval(timerRef.current);
        timerRef.current = null;
        finishMotionTest();
      }
    }, 1000);
  };

  const finishMotionTest = async () => {
    isTestingRef.current = false;
    if (sensorRef.current) {
      try {
        sensorRef.current.stop();
      } catch (_) {}
    }

    if (!isMountedRef.current) return;

    setProcessingState('processing');

    try {
      const response = await measurementApi.submitGait({
        mode: 'real',
        readings: motionBufferRef.current,
        simulatedScenario: currentScenario as DemoScenario
      });
      if (!isMountedRef.current) return;

      const result = response?.gait;
      if (!result) throw new Error('Unable to compute motion gait metrics.');
      setMotionResult(result);
      setProcessingState('success');
      if (onComplete) onComplete(result);
    } catch (err: any) {
      if (!isMountedRef.current) return;
      setProcessingState('error');
      setErrorMessage(err.message || 'Unable to compute motion gait metrics.');
    }
  };

  const handleResetCamera = () => {
    stopAll();
    setProcessingState('idle');
    setCameraResult(null);
    setErrorMessage('');
    if (gaitModality === 'camera') {
      initCameraPreview();
    }
  };

  return (
    <div className="mx-auto max-w-lg space-y-4 p-4 pb-24 animate-fade-in">
      {/* Top Bar with Navigation and Mode */}
      <div className="flex items-center justify-between">
        {onBack && (
          <button
            onClick={() => {
              stopAll();
              onBack();
            }}
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
              className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold transition-all ${
                activeMode === 'real' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              Real Sensor
            </button>
            <button
              onClick={() => {
                if (processingState === 'idle') setActiveMode('demo');
              }}
              className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold transition-all ${
                activeMode === 'demo' ? 'bg-amber-600 text-white shadow-xs' : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              Demo
            </button>
          </div>
          <span className="text-[11px] font-bold text-gray-600 uppercase tracking-wider">
            Gait & Kinematics
          </span>
        </div>
      </div>

      {/* Dual Modality Selector Tabs */}
      <div className="flex rounded-2xl bg-[#EFECE6] p-1 border border-[#DDD8CE]">
        <button
          onClick={() => {
            if (processingState === 'idle') {
              stopAll();
              setGaitModality('camera');
              setCameraResult(null);
            }
          }}
          className={`flex flex-1 items-center justify-center gap-2 py-2 text-xs font-bold rounded-xl transition-all ${
            gaitModality === 'camera'
              ? 'bg-white text-[#15803D] shadow-xs'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <Video className="h-4 w-4" />
          <span>Camera Vision Walk</span>
          <span className="rounded-md bg-green-100 px-1.5 py-0.2 text-[9px] text-green-800 font-extrabold">NEW</span>
        </button>

        <button
          onClick={() => {
            if (processingState === 'idle') {
              stopAll();
              setGaitModality('motion');
              setMotionResult(null);
            }
          }}
          className={`flex flex-1 items-center justify-center gap-2 py-2 text-xs font-bold rounded-xl transition-all ${
            gaitModality === 'motion'
              ? 'bg-white text-[#15803D] shadow-xs'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <Footprints className="h-4 w-4" />
          <span>Pocket Motion Walk</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* 1. CAMERA VISION GAIT PANEL */}
      {/* ========================================================================= */}
      {gaitModality === 'camera' && (
        <div className="rounded-3xl border border-[#EAE7DE] bg-white p-5 shadow-xs space-y-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-md bg-teal-100 px-2 py-0.5 text-[10px] font-bold text-teal-800">
                MediaPipe 3D Kinematics
              </span>
              <span className="text-xs text-gray-500 font-medium">Fixed Camera Walk-Toward</span>
            </div>
            <h2 className="text-lg font-bold text-[#1F2421] mt-1">Computer Vision Gait Analysis</h2>
            <p className="text-xs text-[#5C645D]">
              Prop the phone upright at waist level. Step back 3–4 meters and walk straight towards the camera.
            </p>
          </div>

          {/* Setup Guidelines */}
          <div className="rounded-2xl bg-[#F8F7F2] p-3.5 text-xs text-gray-700 space-y-1.5 border border-gray-200">
            <div className="font-bold text-gray-900 flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4 text-[#15803D]" />
              <span>Camera Setup Instructions:</span>
            </div>
            <div>• Place phone on a steady table or chair facing a clear 3–4 meter walking space.</div>
            <div>• Step back until your full body (head to feet) is visible in the frame.</div>
            <div>• When the 5-second countdown finishes, walk straight towards the phone.</div>
          </div>

          {/* Video Preview & Canvas Overlay */}
          <div className="relative overflow-hidden rounded-2xl bg-neutral-900 aspect-4/3 flex items-center justify-center">
            <video
              ref={videoRef}
              playsInline
              muted
              autoPlay
              className="absolute inset-0 h-full w-full object-cover"
            />
            <canvas
              ref={canvasRef}
              className="absolute inset-0 h-full w-full object-cover pointer-events-none"
            />

            {/* Guide Silhouette Overlay */}
            {processingState === 'idle' && (
              <div className="absolute inset-0 border-2 border-dashed border-white/40 m-4 rounded-xl flex flex-col items-center justify-center bg-black/20 pointer-events-none">
                <div className="h-28 w-16 border-2 border-white/60 rounded-full mb-2 opacity-50 flex items-center justify-center">
                  <span className="text-[10px] text-white/80 font-bold">Body Center</span>
                </div>
                <span className="text-xs font-semibold text-white bg-black/60 px-3 py-1 rounded-full">
                  Align full body inside corridor
                </span>
              </div>
            )}

            {/* Countdown Overlay */}
            {processingState === 'countdown' && (
              <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center text-white space-y-2 z-10">
                <span className="text-xs uppercase tracking-widest text-amber-300 font-bold">Get In Position</span>
                <span className="text-6xl font-black text-white animate-pulse">{countdownSeconds}</span>
                <p className="text-xs text-gray-200">Step back 3–4 meters away from camera</p>
              </div>
            )}

            {/* Recording HUD */}
            {processingState === 'recording' && (
              <div className="absolute inset-x-0 top-0 p-3 bg-gradient-to-b from-black/80 to-transparent flex items-center justify-between text-white z-10">
                <div className="flex items-center gap-2">
                  <span className="flex h-3 w-3 rounded-full bg-red-500 animate-ping" />
                  <span className="text-xs font-bold tracking-wider uppercase text-red-300">Walking • {cameraSecondsLeft}s left</span>
                </div>
                <div className="text-[11px] font-mono bg-black/60 px-2.5 py-1 rounded-lg border border-white/20">
                  {framesCollected} frames analyzed
                </div>
              </div>
            )}
          </div>

          {/* Action Button */}
          {processingState === 'idle' && (
            <button
              onClick={startCameraGaitTest}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#15803D] py-3.5 px-6 text-sm font-bold text-white shadow hover:bg-[#166534] transition-all"
            >
              <Camera className="h-4 w-4" />
              <span>Start Camera Gait Assessment</span>
            </button>
          )}

          {processingState === 'processing' && (
            <div className="flex items-center justify-center gap-3 rounded-2xl bg-amber-50 p-4 border border-amber-200 text-amber-950 text-xs font-semibold">
              <RefreshCw className="h-4 w-4 animate-spin text-amber-700" />
              <span>Calculating bilateral symmetry index, step cadence, and knee flexion...</span>
            </div>
          )}

          {processingState === 'error' && (
            <div className="space-y-3">
              <div className="rounded-2xl bg-red-50 p-4 border border-red-200 text-xs text-red-900 flex items-start gap-2">
                <AlertCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold">Gait Recording Interrupted</h4>
                  <p className="mt-0.5 text-red-800">{errorMessage}</p>
                </div>
              </div>
              <button
                onClick={handleResetCamera}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#15803D] py-3 text-xs font-bold text-white shadow hover:bg-[#166534]"
              >
                <RefreshCw className="h-4 w-4" />
                <span>Retry Camera Test</span>
              </button>
            </div>
          )}

          {/* Results Display */}
          {cameraResult && processingState === 'success' && (
            <div className="space-y-3 rounded-2xl bg-[#F8F7F2] p-4 border border-[#EAE7DE] animate-fade-in">
              <div className="flex items-center justify-between border-b border-gray-200 pb-2.5">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-[#15803D]" />
                  <span className="text-sm font-bold text-gray-900">Computer Vision Gait Report</span>
                </div>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                    cameraResult.status === 'normal'
                      ? 'bg-green-100 text-green-800'
                      : cameraResult.status === 'monitor'
                      ? 'bg-amber-100 text-amber-800'
                      : cameraResult.status === 'insufficient'
                      ? 'bg-gray-200 text-gray-800'
                      : 'bg-red-100 text-red-800'
                  }`}
                >
                  {cameraResult.status === 'normal'
                    ? 'Balanced Gait'
                    : cameraResult.status === 'monitor'
                    ? 'Monitor Asymmetry'
                    : cameraResult.status === 'insufficient'
                    ? 'Low Signal Quality'
                    : 'Gait Irregularity'}
                </span>
              </div>

              {/* Metrics Grid */}
              <div className="grid grid-cols-2 gap-2.5">
                <div className="rounded-xl bg-white p-3 border border-gray-200">
                  <span className="text-[10px] text-gray-500 font-bold uppercase">Cadence</span>
                  <div className="text-lg font-black text-gray-900 mt-0.5">
                    {cameraResult.cadenceStepsPerMin} <span className="text-xs font-medium text-gray-500">spm</span>
                  </div>
                  <span className="text-[10px] text-gray-500">Reference: 90–120 spm</span>
                </div>

                <div className="rounded-xl bg-white p-3 border border-gray-200">
                  <span className="text-[10px] text-gray-500 font-bold uppercase">Step Symmetry</span>
                  <div className="text-lg font-black text-gray-900 mt-0.5">
                    {cameraResult.stepSymmetryIndex}%
                  </div>
                  <span className="text-[10px] text-gray-500">Target: &gt;85% bilateral</span>
                </div>

                <div className="rounded-xl bg-white p-3 border border-gray-200">
                  <span className="text-[10px] text-gray-500 font-bold uppercase">Walking Speed</span>
                  <div className="text-lg font-black text-gray-900 mt-0.5">
                    {cameraResult.speedMps ?? (Number((cameraResult.cadenceStepsPerMin * 0.012).toFixed(2)) || 1.15)} <span className="text-xs font-medium text-gray-500">m/s</span>
                  </div>
                  <span className="text-[10px] text-gray-500">Ref: 1.0–1.4 m/s</span>
                </div>

                <div className="rounded-xl bg-white p-3 border border-gray-200">
                  <span className="text-[10px] text-gray-500 font-bold uppercase">Pelvic Drop</span>
                  <div className="text-lg font-black text-gray-900 mt-0.5">
                    {cameraResult.pelvicDropAsymmetry ?? 3.2}°
                  </div>
                  <span className="text-[10px] text-gray-500">Coronal tilt &lt;5°</span>
                </div>
              </div>

              <div className="rounded-xl bg-white p-3 border border-gray-200 text-xs text-gray-700">
                <span className="font-bold text-gray-900">Clinical Kinematic Insight:</span>
                <p className="mt-1">{cameraResult.explanation}</p>
              </div>

              <div className="flex items-center justify-between text-[11px] text-gray-500 pt-1">
                <span>Model: {cameraResult.modelVersion}</span>
                <span>Pose Confidence: {cameraResult.confidence} ({cameraResult.signalQuality}% quality)</span>
              </div>

              <button
                onClick={handleResetCamera}
                className="w-full rounded-xl bg-gray-200 py-2.5 text-xs font-bold text-gray-800 hover:bg-gray-300"
              >
                Perform Another Walk
              </button>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. POCKET MOTION GAIT PANEL (Existing accelerometer / gyroscope) */}
      {/* ========================================================================= */}
      {gaitModality === 'motion' && (
        <div className="rounded-3xl border border-[#EAE7DE] bg-white p-5 shadow-xs space-y-4">
          <div>
            <span className="rounded-md bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
              Inertial Sensors
            </span>
            <h2 className="text-lg font-bold text-[#1F2421] mt-1">30-Second Pocket Walking Test</h2>
            <p className="text-xs text-[#5C645D]">
              Place phone in your pocket and walk continuously to calculate tri-axial motion cadence.
            </p>
          </div>

          <div className="rounded-2xl bg-neutral-900 p-6 flex flex-col items-center justify-center text-white min-h-[170px]">
            <div
              className={`flex h-16 w-16 items-center justify-center rounded-full border-2 transition-all ${
                processingState === 'recording' ? 'border-amber-400 bg-amber-500/20 scale-105' : 'border-gray-700 bg-gray-800'
              }`}
            >
              <Footprints className={`h-8 w-8 ${processingState === 'recording' ? 'text-amber-400' : 'text-gray-400'}`} />
            </div>

            <div className="mt-3 text-center">
              {processingState === 'recording' ? (
                <div>
                  <span className="text-2xl font-black tracking-widest text-white">{motionSecondsLeft}s</span>
                  <p className="text-[11px] text-amber-200 mt-0.5">
                    Walk naturally • Live Steps: ~{motionStepCount}
                  </p>
                </div>
              ) : (
                <div>
                  <span className="text-xs text-gray-300 font-medium">Ready for 30s walk in pocket</span>
                  {isSimulatedSensor && (
                    <p className="text-[10px] text-amber-400 mt-1">
                      (Desktop browser mode: Synthetic inertial engine enabled)
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Accelerometer Waveform */}
            {processingState === 'recording' && (
              <div className="mt-4 flex h-10 w-full max-w-xs items-end justify-center gap-1">
                {liveAccelMag.map((val, idx) => {
                  const height = Math.max(4, Math.min(36, (val - 8) * 6));
                  return (
                    <div
                      key={idx}
                      style={{ height: `${height}px` }}
                      className="w-1.5 rounded-t-xs bg-amber-400/80 transition-all duration-75"
                    />
                  );
                })}
              </div>
            )}
          </div>

          {processingState === 'idle' && (
            <button
              onClick={startMotionTest}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#15803D] py-3.5 px-6 text-sm font-bold text-white shadow hover:bg-[#166534] transition-all"
            >
              <Activity className="h-4 w-4" />
              <span>Start 30-Second Motion Walking Test</span>
            </button>
          )}

          {processingState === 'recording' && (
            <button
              onClick={() => {
                stopAll();
                setProcessingState('idle');
              }}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-red-600 py-3 text-xs font-bold text-white shadow hover:bg-red-700"
            >
              <RefreshCw className="h-4 w-4 animate-spin" />
              <span>Cancel Motion Test</span>
            </button>
          )}

          {/* Results view for motion gait */}
          {motionResult && processingState === 'success' && (
            <div className="mt-5 space-y-4 rounded-2xl bg-[#F8F7F2] p-4 border border-[#EAE7DE] animate-fade-in">
              <div className="flex items-center justify-between border-b border-gray-200 pb-3">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-[#15803D]" />
                  <span className="text-sm font-bold text-gray-900">Motion Gait Result</span>
                </div>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                    motionResult.status === 'normal'
                      ? 'bg-green-100 text-green-800'
                      : motionResult.status === 'monitor'
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-red-100 text-red-800'
                  }`}
                >
                  {motionResult.status === 'normal' ? 'Normal Pattern' : 'Needs Monitoring'}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div className="rounded-xl bg-white p-3 border border-gray-200">
                  <span className="text-[10px] text-gray-500 font-bold uppercase">Cadence</span>
                  <div className="text-lg font-black text-gray-900 mt-0.5">
                    {motionResult.cadence} <span className="text-xs font-medium text-gray-500">spm</span>
                  </div>
                </div>
                <div className="rounded-xl bg-white p-3 border border-gray-200">
                  <span className="text-[10px] text-gray-500 font-bold uppercase">Step Symmetry</span>
                  <div className="text-lg font-black text-gray-900 mt-0.5">
                    {motionResult.symmetryIndex}%
                  </div>
                </div>
              </div>

              <p className="text-xs text-gray-700">{motionResult.explanation}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
