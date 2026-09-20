// Sensor Abstraction Layer for SwasthAI
// Handles real device camera, microphone, and motion sensors with graceful fallbacks.

export interface RGBSample {
  r: number;
  g: number;
  b: number;
  timestampMs: number;
}

export type PPGDiagnosticState =
  | 'INITIALIZING'
  | 'NO_FRAMES'
  | 'TOO_DARK'
  | 'TOO_BRIGHT'
  | 'NO_FINGER'
  | 'EXCESSIVE_MOTION'
  | 'FINGER_DETECTED'
  | 'GOOD_SIGNAL';

export interface PPGFrameDiagnostic {
  state: PPGDiagnosticState;
  isCovered: boolean;
  qualityScore: number; // 0 - 100
  message: string;
  avgR: number;
  avgG: number;
  avgB: number;
  fps: number;
  frameCount: number;
  torchActive: boolean;
  hasTorch: boolean;
  cameraLabel: string;
}

export class CameraPPGSensor {
  private stream: MediaStream | null = null;
  private videoEl: HTMLVideoElement | null = null;
  private canvasEl: HTMLCanvasElement | null = null;
  private animFrameId: number | null = null;
  private isCapturing: boolean = false;
  private isStopped: boolean = false;
  private sessionId: number = 0;
  private torchActive: boolean = false;
  private hasTorch: boolean = false;
  private cameraLabel: string = '';
  private lastFrameTime: number = 0;
  private frameCount: number = 0;
  private rollingFps: number = 30;
  private prevR: number = 0;
  private stableFingerFrames: number = 0;

  public onFrame?: (sample: RGBSample, diagnostic: PPGFrameDiagnostic) => void;

  async checkCompatibility(): Promise<{
    available: boolean;
    rearCameraFound: boolean;
    torchSupported: boolean;
    error?: string;
  }> {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      return {
        available: false,
        rearCameraFound: false,
        torchSupported: false,
        error: 'Camera API (getUserMedia) not supported in this browser'
      };
    }

    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(d => d.kind === 'videoinput');
      const rearFound = videoDevices.some(d =>
        /back|rear|environment/i.test(d.label) || videoDevices.length > 1
      );
      return {
        available: videoDevices.length > 0,
        rearCameraFound: rearFound,
        torchSupported: false // Capabilities can only be inspected after stream acquisition
      };
    } catch (e: any) {
      return {
        available: true,
        rearCameraFound: false,
        torchSupported: false
      };
    }
  }

  async start(
    videoElement?: HTMLVideoElement,
    options?: { requestTorch?: boolean; preferRear?: boolean }
  ): Promise<{ success: boolean; error?: string; hasTorch: boolean }> {
    const currentSession = ++this.sessionId;
    this.isStopped = false;
    this.torchActive = false;
    this.hasTorch = false;

    // Safely stop any prior active stream first
    if (this.stream) {
      try {
        this.stream.getTracks().forEach(t => {
          try {
            if (t.readyState === 'live') t.stop();
          } catch {}
        });
      } catch {}
      this.stream = null;
    }

    try {
      // 1. Request camera with environment (rear) preference
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: options?.preferRear === false ? 'user' : { ideal: 'environment' },
          width: { ideal: 640 },
          height: { ideal: 480 }
        },
        audio: false
      };

      let newStream: MediaStream;
      try {
        newStream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch (err: any) {
        // Fallback to generic video constraint if facingMode constraint fails
        newStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      }

      // If user stopped or started another measurement while getUserMedia was resolving, tear down immediately
      if (this.isStopped || this.sessionId !== currentSession) {
        newStream.getTracks().forEach(track => {
          try {
            if (track.readyState === 'live') track.stop();
          } catch {}
        });
        return { success: false, error: 'Camera initialization was cancelled.', hasTorch: false };
      }

      this.stream = newStream;
      const videoTrack = this.stream.getVideoTracks()[0];
      if (!videoTrack || videoTrack.readyState !== 'live') {
        return { success: false, error: 'No active video track available from camera device.', hasTorch: false };
      }

      this.cameraLabel = videoTrack.label || 'Default Camera';

      // 2. Connect to HTML Video element first so the track enters active frame rendering
      if (videoElement) {
        this.videoEl = videoElement;
      } else {
        this.videoEl = document.createElement('video');
      }
      this.videoEl.muted = true;
      this.videoEl.playsInline = true;
      this.videoEl.srcObject = this.stream;
      try {
        await this.videoEl.play();
      } catch (playErr) {
        console.warn('Video element play() was deferred or blocked:', playErr);
      }

      if (this.isStopped || this.sessionId !== currentSession) {
        this.stop();
        return { success: false, error: 'Camera initialization was cancelled.', hasTorch: false };
      }

      // 3. Inspect capabilities safely
      let capabilities: any = {};
      try {
        if (typeof videoTrack.getCapabilities === 'function' && videoTrack.readyState === 'live') {
          capabilities = videoTrack.getCapabilities() || {};
        }
      } catch (capErr) {
        console.warn('Unable to query camera capabilities:', capErr);
      }

      this.hasTorch = Boolean(
        capabilities.torch ||
        (capabilities.fillLightMode && capabilities.fillLightMode.includes('torch'))
      );

      // 4. Activate Torch (Flash) only if track is live and capability exists
      if (
        this.hasTorch &&
        options?.requestTorch !== false &&
        videoTrack.readyState === 'live' &&
        !this.isStopped &&
        typeof videoTrack.applyConstraints === 'function'
      ) {
        try {
          await videoTrack.applyConstraints({
            advanced: [{ torch: true } as any]
          });
          if (!this.isStopped && this.sessionId === currentSession) {
            this.torchActive = true;
          }
        } catch (torchErr) {
          console.warn('Torch constraint could not be applied:', torchErr);
          this.torchActive = false;
        }
      }

      // 5. Setup hidden canvas for high-performance ROI pixel reading
      this.canvasEl = document.createElement('canvas');
      this.canvasEl.width = 160;
      this.canvasEl.height = 120;
      const ctx = this.canvasEl.getContext('2d', { willReadFrequently: true });

      this.isCapturing = true;
      this.frameCount = 0;
      this.lastFrameTime = performance.now();
      this.prevR = 0;
      this.stableFingerFrames = 0;

      // 5. High-fidelity frame extraction loop
      const captureFrame = () => {
        if (!this.isCapturing || !this.videoEl || !ctx) return;

        const now = performance.now();
        const deltaMs = now - this.lastFrameTime;
        if (deltaMs > 0) {
          const instantFps = 1000 / deltaMs;
          this.rollingFps = this.rollingFps * 0.9 + instantFps * 0.1;
        }
        this.lastFrameTime = now;
        this.frameCount++;

        // Only sample if video has received frame dimensions
        if (this.videoEl.videoWidth > 0 && this.videoEl.readyState >= 2) {
          ctx.drawImage(this.videoEl, 0, 0, 160, 120);

          // Central 50% ROI (60x60 square in middle of 160x120 canvas)
          const roiX = 50;
          const roiY = 30;
          const roiW = 60;
          const roiH = 60;
          const imgData = ctx.getImageData(roiX, roiY, roiW, roiH);
          const data = imgData.data;

          let sumR = 0, sumG = 0, sumB = 0;
          const totalPixels = data.length / 4;

          for (let i = 0; i < data.length; i += 4) {
            sumR += data[i];
            sumG += data[i + 1];
            sumB += data[i + 2];
          }

          const avgR = sumR / totalPixels;
          const avgG = sumG / totalPixels;
          const avgB = sumB / totalPixels;

          // Spatial variance calculation for R channel
          let sumSqDiffR = 0;
          for (let i = 0; i < data.length; i += 4) {
            const diff = data[i] - avgR;
            sumSqDiffR += diff * diff;
          }
          const stdR = Math.sqrt(sumSqDiffR / totalPixels);

          // Temporal difference (motion detection)
          const deltaR = Math.abs(avgR - this.prevR);
          this.prevR = avgR;

          // State classification
          let state: PPGDiagnosticState = 'INITIALIZING';
          let message = 'Aligning camera...';
          let qualityScore = 0;
          let isCovered = false;

          if (avgR < 18 && avgG < 15 && avgB < 15) {
            state = 'TOO_DARK';
            message = 'Too dark. Enable phone flash or point towards an ambient light source.';
            qualityScore = 15;
            this.stableFingerFrames = 0;
          } else if (avgR > 250 && avgG > 240 && avgB > 235) {
            state = 'TOO_BRIGHT';
            message = 'Direct light leak. Adjust finger position to cover lens completely.';
            qualityScore = 20;
            this.stableFingerFrames = 0;
          } else if (avgR < avgG * 1.15 || avgR < avgB * 1.2 || stdR > 42) {
            state = 'NO_FINGER';
            message = 'Place your index fingertip gently over the rear camera and flash.';
            qualityScore = 25;
            this.stableFingerFrames = 0;
          } else if (deltaR > 25) {
            state = 'EXCESSIVE_MOTION';
            message = 'Motion detected. Keep finger steady with gentle, even pressure.';
            qualityScore = 40;
            isCovered = true;
            this.stableFingerFrames = Math.max(0, this.stableFingerFrames - 2);
          } else {
            isCovered = true;
            this.stableFingerFrames++;
            if (this.stableFingerFrames > 20) {
              state = 'GOOD_SIGNAL';
              message = 'Good optical signal locked. Hold steady.';
              qualityScore = Math.min(98, 75 + Math.round(this.stableFingerFrames * 0.5));
            } else {
              state = 'FINGER_DETECTED';
              message = 'Finger detected. Stabilizing baseline...';
              qualityScore = 60 + this.stableFingerFrames;
            }
          }

          if (this.onFrame) {
            this.onFrame(
              { r: avgR, g: avgG, b: avgB, timestampMs: Date.now() },
              {
                state,
                isCovered,
                qualityScore,
                message,
                avgR: Math.round(avgR),
                avgG: Math.round(avgG),
                avgB: Math.round(avgB),
                fps: Math.round(this.rollingFps),
                frameCount: this.frameCount,
                torchActive: this.torchActive,
                hasTorch: this.hasTorch,
                cameraLabel: this.cameraLabel
              }
            );
          }
        } else {
          // Video element hasn't produced frames yet
          if (this.onFrame) {
            this.onFrame(
              { r: 0, g: 0, b: 0, timestampMs: Date.now() },
              {
                state: 'INITIALIZING',
                isCovered: false,
                qualityScore: 0,
                message: 'Connecting to rear camera stream...',
                avgR: 0,
                avgG: 0,
                avgB: 0,
                fps: 0,
                frameCount: this.frameCount,
                torchActive: this.torchActive,
                hasTorch: this.hasTorch,
                cameraLabel: this.cameraLabel
              }
            );
          }
        }

        this.animFrameId = requestAnimationFrame(captureFrame);
      };

      this.animFrameId = requestAnimationFrame(captureFrame);
      return { success: true, hasTorch: this.hasTorch };
    } catch (err: any) {
      console.warn('Real camera not accessible or denied:', err);
      const isDenied = err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError';
      return {
        success: false,
        error: isDenied
          ? 'Camera permission denied. Please allow camera access in your browser settings.'
          : err.message || 'Unable to open camera device.',
        hasTorch: false
      };
    }
  }

  async toggleTorch(forceState?: boolean): Promise<boolean> {
    if (!this.stream || !this.hasTorch || this.isStopped) return false;
    const videoTrack = this.stream.getVideoTracks()[0];
    if (!videoTrack || videoTrack.readyState !== 'live' || typeof videoTrack.applyConstraints !== 'function') {
      return false;
    }

    const target = forceState !== undefined ? forceState : !this.torchActive;
    try {
      await videoTrack.applyConstraints({
        advanced: [{ torch: target } as any]
      });
      if (!this.isStopped) {
        this.torchActive = target;
      }
      return true;
    } catch (e) {
      console.warn('Failed to toggle torch:', e);
      return false;
    }
  }

  stop() {
    this.isStopped = true;
    this.sessionId++;
    this.isCapturing = false;

    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }

    if (this.stream) {
      const tracks = this.stream.getTracks();
      tracks.forEach(track => {
        try {
          if (track.readyState === 'live') {
            track.stop();
          }
        } catch (e) {
          console.warn('Error stopping camera track:', e);
        }
      });
      this.stream = null;
    }

    if (this.videoEl) {
      try {
        this.videoEl.pause();
      } catch {}
      try {
        this.videoEl.srcObject = null;
      } catch {}
      this.videoEl = null;
    }
    this.torchActive = false;
    this.hasTorch = false;
  }
}

export class MicrophoneAudioSensor {
  private stream: MediaStream | null = null;
  private audioCtx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private scriptProcessor: ScriptProcessorNode | null = null;
  private animFrameId: number | null = null;
  private recordedChunks: Float32Array[] = [];
  private isRecording: boolean = false;
  private isStopped: boolean = false;
  private sessionId: number = 0;
  public onVolumeLevel?: (rmsLevel: number, frequencyData: Uint8Array) => void;

  async start(): Promise<boolean> {
    const currentSession = ++this.sessionId;
    this.isStopped = false;
    try {
      this.recordedChunks = [];
      this.isRecording = true;

      // Safely close any prior stream
      if (this.stream) {
        this.stream.getTracks().forEach(t => {
          try {
            if (t.readyState === 'live') t.stop();
          } catch {}
        });
        this.stream = null;
      }

      const mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false
        }
      });

      if (this.isStopped || this.sessionId !== currentSession) {
        mediaStream.getTracks().forEach(t => {
          try {
            if (t.readyState === 'live') t.stop();
          } catch {}
        });
        return false;
      }

      this.stream = mediaStream;
      const audioTrack = this.stream.getAudioTracks()[0];
      if (!audioTrack || audioTrack.readyState !== 'live') {
        console.warn('Audio track is not live');
        return false;
      }

      this.audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      if (this.audioCtx.state === 'suspended') {
        await this.audioCtx.resume().catch(() => {});
      }

      if (this.isStopped || this.sessionId !== currentSession) {
        this.stop();
        return false;
      }

      const source = this.audioCtx.createMediaStreamSource(this.stream);

      // Analyser for real-time visualizer
      this.analyser = this.audioCtx.createAnalyser();
      this.analyser.fftSize = 256;
      source.connect(this.analyser);

      // ScriptProcessor for PCM audio recording
      this.scriptProcessor = this.audioCtx.createScriptProcessor(4096, 1, 1);
      this.scriptProcessor.onaudioprocess = (e) => {
        if (!this.isRecording || this.isStopped) return;
        const channel = e.inputBuffer.getChannelData(0);
        // Copy chunk
        this.recordedChunks.push(new Float32Array(channel));
      };

      source.connect(this.scriptProcessor);
      // Connect to a muted gain node to avoid acoustic feedback to speaker
      const muteGain = this.audioCtx.createGain();
      muteGain.gain.value = 0;
      this.scriptProcessor.connect(muteGain);
      muteGain.connect(this.audioCtx.destination);

      const bufferLength = this.analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      const timeData = new Uint8Array(bufferLength);

      const loop = () => {
        if (!this.analyser || !this.isRecording || this.isStopped) return;
        this.analyser.getByteFrequencyData(dataArray);
        this.analyser.getByteTimeDomainData(timeData);

        let sumSquares = 0;
        for (let i = 0; i < timeData.length; i++) {
          const norm = (timeData[i] - 128) / 128;
          sumSquares += norm * norm;
        }
        const rms = Math.sqrt(sumSquares / timeData.length);

        if (this.onVolumeLevel) {
          this.onVolumeLevel(rms, dataArray);
        }

        if (this.isRecording && !this.isStopped) {
          this.animFrameId = requestAnimationFrame(loop);
        }
      };

      this.animFrameId = requestAnimationFrame(loop);
      return true;
    } catch (err) {
      console.warn('Microphone permission not granted or unavailable:', err);
      return false;
    }
  }

  public getSampleRate(): number {
    return this.audioCtx?.sampleRate || 44100;
  }

  public getRecordedSamples(): number[] {
    let totalLength = 0;
    for (const chunk of this.recordedChunks) {
      totalLength += chunk.length;
    }
    const combined = new Float32Array(totalLength);
    let offset = 0;
    for (const chunk of this.recordedChunks) {
      combined.set(chunk, offset);
      offset += chunk.length;
    }
    return Array.from(combined);
  }

  public getResampledSamples(targetSr: number = 2000): { samples: number[]; sampleRate: number } {
    const orig = this.getRecordedSamples();
    const origSr = this.getSampleRate();
    if (origSr === targetSr || orig.length === 0) {
      return { samples: orig, sampleRate: origSr };
    }
    const ratio = origSr / targetSr;
    const newLen = Math.floor(orig.length / ratio);
    const result = new Float32Array(newLen);
    const srcLenMinus1 = orig.length - 1;
    for (let i = 0; i < newLen; i++) {
      const srcIdx = i * ratio;
      const i0 = Math.floor(srcIdx);
      const i1 = i0 < srcLenMinus1 ? i0 + 1 : srcLenMinus1;
      const frac = srcIdx - i0;
      result[i] = orig[i0] * (1 - frac) + orig[i1] * frac;
    }
    return { samples: Array.from(result), sampleRate: targetSr };
  }

  public exportWavBlob(): Blob {
    const samples = this.getRecordedSamples();
    const sampleRate = this.getSampleRate();
    const numChannels = 1;
    const bytesPerSample = 2; // 16-bit PCM
    const blockAlign = numChannels * bytesPerSample;
    const byteRate = sampleRate * blockAlign;
    const dataSize = samples.length * bytesPerSample;

    const buffer = new ArrayBuffer(44 + dataSize);
    const view = new DataView(buffer);

    // RIFF chunk descriptor
    const writeString = (offset: number, str: string) => {
      for (let i = 0; i < str.length; i++) {
        view.setUint8(offset + i, str.charCodeAt(i));
      }
    };

    writeString(0, 'RIFF');
    view.setUint32(4, 36 + dataSize, true);
    writeString(8, 'WAVE');

    // "fmt " sub-chunk
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true); // Subchunk1Size (16 for PCM)
    view.setUint16(20, 1, true);  // AudioFormat (1 for PCM)
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, 16, true); // BitsPerSample (16 bits)

    // "data" sub-chunk
    writeString(36, 'data');
    view.setUint32(40, dataSize, true);

    // Write 16-bit PCM audio samples
    let offset = 44;
    for (let i = 0; i < samples.length; i++) {
      // Clamp between -1.0 and 1.0
      const s = Math.max(-1, Math.min(1, samples[i]));
      const val = s < 0 ? s * 0x8000 : s * 0x7FFF;
      view.setInt16(offset, val, true);
      offset += 2;
    }

    return new Blob([buffer], { type: 'audio/wav' });
  }

  stop() {
    this.isStopped = true;
    this.sessionId++;
    this.isRecording = false;

    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    if (this.scriptProcessor) {
      try {
        this.scriptProcessor.disconnect();
      } catch {}
      this.scriptProcessor = null;
    }
    if (this.stream) {
      this.stream.getTracks().forEach(t => {
        try {
          if (t.readyState === 'live') {
            t.stop();
          }
        } catch {}
      });
      this.stream = null;
    }
    if (this.audioCtx && this.audioCtx.state !== 'closed') {
      try {
        this.audioCtx.close().catch(() => {});
      } catch {}
      this.audioCtx = null;
    }
  }
}

export class MotionWalkingSensor {
  private listener: ((event: DeviceMotionEvent) => void) | null = null;
  private intervalId: any = null;
  public onMotion?: (reading: { x: number; y: number; z: number; timestampMs: number }) => void;

  async start(): Promise<{ active: boolean; isSimulated: boolean }> {
    let hasNative = false;

    // iOS 13+ permission request if needed
    if (typeof (DeviceMotionEvent as any)?.requestPermission === 'function') {
      try {
        const response = await (DeviceMotionEvent as any).requestPermission();
        if (response === 'granted') {
          hasNative = true;
        }
      } catch (e) {
        hasNative = false;
      }
    } else if ('ondevicemotion' in window) {
      hasNative = true;
    }

    if (hasNative) {
      this.listener = (event: DeviceMotionEvent) => {
        const acc = event.accelerationIncludingGravity || event.acceleration;
        if (acc && this.onMotion) {
          this.onMotion({
            x: acc.x || 0,
            y: acc.y || 9.8,
            z: acc.z || 0,
            timestampMs: Date.now()
          });
        }
      };
      window.addEventListener('devicemotion', this.listener);
      return { active: true, isSimulated: false };
    }

    // Fallback interactive synthetic gait simulator for desktop browser testing
    let stepCycle = 0;
    this.intervalId = setInterval(() => {
      stepCycle++;
      const t = stepCycle * 0.05;
      // Synthesize 105 steps/min (~1.75 Hz)
      const stepImpulse = Math.sin(2 * Math.PI * 1.75 * t) * 2.2;
      if (this.onMotion) {
        this.onMotion({
          x: Math.sin(t * 1.2) * 0.4 + (Math.random() * 0.1 - 0.05),
          y: 9.8 + stepImpulse + (Math.random() * 0.2 - 0.1),
          z: Math.cos(t * 1.5) * 0.5 + (Math.random() * 0.1 - 0.05),
          timestampMs: Date.now()
        });
      }
    }, 50);

    return { active: true, isSimulated: true };
  }

  stop() {
    if (this.listener) {
      window.removeEventListener('devicemotion', this.listener);
      this.listener = null;
    }
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }
}
