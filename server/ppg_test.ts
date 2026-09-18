// Automated unit tests for SwasthAI PPG Signal Processor algorithms
import { PPGSignalProcessor } from './signal_processing.js';

function runTests() {
  console.log('=== Starting SwasthAI PPG Signal Processing Test Suite ===');
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${testName}${detail ? ` - ${detail}` : ''}`);
      failed++;
    }
  }

  const fps = 30;
  const durationSec = 15;
  const totalFrames = fps * durationSec; // 450 frames

  // Helper: generates synthetic pulsatile PPG optical signals with harmonics and DC baseline
  function generateSyntheticPPG(targetBpm: number, options?: { noiseAmp?: number; dcR?: number; dcG?: number; dcB?: number }): {
    red: number[];
    green: number[];
    blue: number[];
  } {
    const freqHz = targetBpm / 60;
    const red: number[] = [];
    const green: number[] = [];
    const blue: number[] = [];
    const dcR = options?.dcR ?? 175;
    const dcG = options?.dcG ?? 70;
    const dcB = options?.dcB ?? 45;
    const noiseAmp = options?.noiseAmp ?? 0.2;

    for (let i = 0; i < totalFrames; i++) {
      const t = i / fps;
      // Cardiac cycle model: primary systolic wave + dicrotic wave harmonic
      const wave = Math.sin(2 * Math.PI * freqHz * t) * 4.5 + Math.sin(4 * Math.PI * freqHz * t + 0.5) * 1.5;
      const noise = (Math.random() - 0.5) * noiseAmp;

      red.push(dcR + wave + noise);
      // Green channel has inverted absorption and slightly different AC amplitude
      green.push(dcG - wave * 1.2 + noise * 0.8);
      blue.push(dcB - wave * 0.4 + noise * 0.5);
    }
    return { red, green, blue };
  }

  // 1. Synthetic 60 BPM Test
  {
    const { red, green, blue } = generateSyntheticPPG(60);
    const quality = PPGSignalProcessor.evaluatePPGQuality(red, green, blue);
    assert(quality.passed, '60 BPM signal passes optical quality SQI', quality.reason);

    const filtered = PPGSignalProcessor.bandpassFilter(red, fps);
    const peaks = PPGSignalProcessor.detectPeaks(filtered, fps);
    const hrHrv = PPGSignalProcessor.computeHRandHRV(peaks, fps);

    assert(hrHrv.success, '60 BPM calculation succeeds', hrHrv.errorMessage);
    assert(Math.abs(hrHrv.bpm - 60) <= 2, `60 BPM accuracy within ±2 BPM (Actual: ${hrHrv.bpm})`);
  }

  // 2. Synthetic 70 BPM Test
  {
    const { red, green, blue } = generateSyntheticPPG(70);
    const quality = PPGSignalProcessor.evaluatePPGQuality(red, green, blue);
    assert(quality.passed, '70 BPM signal passes optical quality SQI');

    const filtered = PPGSignalProcessor.bandpassFilter(red, fps);
    const peaks = PPGSignalProcessor.detectPeaks(filtered, fps);
    const hrHrv = PPGSignalProcessor.computeHRandHRV(peaks, fps);

    assert(hrHrv.success, '70 BPM calculation succeeds');
    assert(Math.abs(hrHrv.bpm - 70) <= 2, `70 BPM accuracy within ±2 BPM (Actual: ${hrHrv.bpm})`);
  }

  // 3. Synthetic 75 BPM Test
  {
    const { red, green, blue } = generateSyntheticPPG(75);
    const quality = PPGSignalProcessor.evaluatePPGQuality(red, green, blue);
    assert(quality.passed, '75 BPM signal passes optical quality SQI');

    const filtered = PPGSignalProcessor.bandpassFilter(red, fps);
    const peaks = PPGSignalProcessor.detectPeaks(filtered, fps);
    const hrHrv = PPGSignalProcessor.computeHRandHRV(peaks, fps);

    assert(hrHrv.success, '75 BPM calculation succeeds');
    assert(Math.abs(hrHrv.bpm - 75) <= 2, `75 BPM accuracy within ±2 BPM (Actual: ${hrHrv.bpm})`);
  }

  // 4. Synthetic 90 BPM Test
  {
    const { red, green, blue } = generateSyntheticPPG(90);
    const quality = PPGSignalProcessor.evaluatePPGQuality(red, green, blue);
    assert(quality.passed, '90 BPM signal passes optical quality SQI');

    const filtered = PPGSignalProcessor.bandpassFilter(red, fps);
    const peaks = PPGSignalProcessor.detectPeaks(filtered, fps);
    const hrHrv = PPGSignalProcessor.computeHRandHRV(peaks, fps);

    assert(hrHrv.success, '90 BPM calculation succeeds');
    assert(Math.abs(hrHrv.bpm - 90) <= 2, `90 BPM accuracy within ±2 BPM (Actual: ${hrHrv.bpm})`);
  }

  // 5. Flatline Test (no AC variation)
  {
    const red = new Array(300).fill(160);
    const green = new Array(300).fill(60);
    const blue = new Array(300).fill(40);
    const quality = PPGSignalProcessor.evaluatePPGQuality(red, green, blue);
    assert(!quality.passed, 'Flatline signal rejected by quality check');
    assert(quality.errorCode === 'LOW_SIGNAL', `Flatline error code matches LOW_SIGNAL (Actual: ${quality.errorCode})`);
  }

  // 6. Too Dark Test (no torch or lighting)
  {
    const red = new Array(300).fill(12);
    const green = new Array(300).fill(10);
    const blue = new Array(300).fill(8);
    const quality = PPGSignalProcessor.evaluatePPGQuality(red, green, blue);
    assert(!quality.passed, 'Pitch black / too dark signal rejected');
    assert(quality.errorCode === 'TOO_DARK', `Too dark error code matches TOO_DARK (Actual: ${quality.errorCode})`);
  }

  // 7. Too Bright / Light Leak Test
  {
    const red = new Array(300).fill(255);
    const green = new Array(300).fill(252);
    const blue = new Array(300).fill(250);
    const quality = PPGSignalProcessor.evaluatePPGQuality(red, green, blue);
    assert(!quality.passed, 'Light leak / overexposed signal rejected');
    assert(quality.errorCode === 'TOO_BRIGHT', `Too bright error code matches TOO_BRIGHT (Actual: ${quality.errorCode})`);
  }

  // 8. No Finger / Room Light Test (Green/Blue high or exceeding Red)
  {
    const red = new Array(300).fill(120);
    const green = new Array(300).fill(140);
    const blue = new Array(300).fill(160);
    const quality = PPGSignalProcessor.evaluatePPGQuality(red, green, blue);
    assert(!quality.passed, 'Room ambient light without finger rejected');
    assert(quality.errorCode === 'FINGER_NOT_DETECTED', `Error code matches FINGER_NOT_DETECTED (Actual: ${quality.errorCode})`);
  }

  // 9. Motion Artifact Test (violent shifts across frames)
  {
    const { red, green, blue } = generateSyntheticPPG(72);
    // Inject massive sudden jumps in red channel
    for (let i = 20; i < 180; i += 4) {
      red[i] = (red[i] + 70) % 255;
    }
    const quality = PPGSignalProcessor.evaluatePPGQuality(red, green, blue);
    assert(!quality.passed, 'Motion artifact signal rejected');
    assert(quality.errorCode === 'EXCESSIVE_MOTION', `Error code matches EXCESSIVE_MOTION (Actual: ${quality.errorCode})`);
  }

  // 10. Insufficient Frames (< 60 frames)
  {
    const red = new Array(35).fill(180);
    const green = new Array(35).fill(80);
    const blue = new Array(35).fill(50);
    const quality = PPGSignalProcessor.evaluatePPGQuality(red, green, blue);
    assert(!quality.passed, 'Short capture rejected');
    assert(quality.errorCode === 'INSUFFICIENT_DATA', `Error code matches INSUFFICIENT_DATA (Actual: ${quality.errorCode})`);
  }

  console.log(`\n=== Test Results: ${passed} Passed, ${failed} Failed ===`);
  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
