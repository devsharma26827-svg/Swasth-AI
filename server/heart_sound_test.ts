import path from 'path';
import { HeartSoundMLService, HeartSoundPreprocessor } from './heart_sound_ml.js';

async function runHeartSoundTests() {
  console.log('=== Starting SwasthAI HeartSoundCNN ML Inference Test Suite ===');
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

  // Set test environment
  const checkpointPath = path.resolve('./heart_model/heart_sound_model.pt');
  process.env.HEART_SOUND_MODEL_PATH = checkpointPath;
  process.env.HEART_SOUND_MODEL_TYPE = 'cnn';
  process.env.ML_MODE = 'real';

  // 1. Test Model Loading & Health Check
  {
    const loadRes = await HeartSoundMLService.load_model();
    assert(loadRes.success, 'HeartSoundCNN checkpoint loads successfully', loadRes.details);

    const health = HeartSoundMLService.get_health();
    assert(health.heart_sound_model === 'loaded', `Model status is 'loaded' (Actual: ${health.heart_sound_model})`);
    assert(health.model_type === 'cnn', `Model type is 'cnn' (Actual: ${health.model_type})`);
    assert(health.model_version.includes('heart_sound_cnn'), `Model version is valid (Actual: ${health.model_version})`);
    assert(health.device === 'cpu' || health.device === 'cuda', 'Device is cpu or cuda');
    assert(health.thresholds.normal_threshold === 0.4, 'Normal threshold is 0.4');
    assert(health.thresholds.follow_up_threshold === 0.65, 'Follow-up threshold is 0.65');
  }

  // 2. Synthetic Normal Heart Sound PCG Generation
  // S1 (55Hz), S2 (85Hz), quiet intervals
  const sr = 2000;
  const durationSec = 6.0;
  const totalSamples = Math.floor(sr * durationSec);
  const normalAudio: number[] = new Array(totalSamples).fill(0);

  for (let cycle = 0; cycle < durationSec; cycle += 0.85) {
    const tS1 = cycle + 0.05;
    const tS2 = cycle + 0.35;
    for (let i = 0; i < totalSamples; i++) {
      const t = i / sr;
      if (Math.abs(t - tS1) < 0.08) {
        normalAudio[i] += Math.exp(-Math.pow(t - tS1, 2) / 0.001) * Math.sin(2 * Math.PI * 55 * (t - tS1));
      }
      if (Math.abs(t - tS2) < 0.07) {
        normalAudio[i] += 0.8 * Math.exp(-Math.pow(t - tS2, 2) / 0.0008) * Math.sin(2 * Math.PI * 85 * (t - tS2));
      }
    }
  }

  // 3. Synthetic Abnormal Heart Sound PCG Generation (Systolic Murmur in 200-350Hz)
  const abnormalAudio = [...normalAudio];
  for (let cycle = 0; cycle < durationSec; cycle += 0.85) {
    const tMurmurStart = cycle + 0.12;
    const tMurmurEnd = cycle + 0.30;
    for (let i = 0; i < totalSamples; i++) {
      const t = i / sr;
      if (t >= tMurmurStart && t <= tMurmurEnd) {
        const envelope = Math.sin((Math.PI * (t - tMurmurStart)) / (tMurmurEnd - tMurmurStart));
        abnormalAudio[i] += 0.45 * envelope * Math.sin(2 * Math.PI * 280 * t);
      }
    }
  }

  // 4. Test Audio Validation
  {
    const valNormal = HeartSoundMLService.validate_audio(normalAudio, sr);
    assert(valNormal.valid, 'Normal synthetic PCG passes audio validation');
    assert(valNormal.durationSec === 6.0, `Audio duration calculated correctly (Actual: ${valNormal.durationSec}s)`);

    // Too short audio
    const valShort = HeartSoundMLService.validate_audio(normalAudio.slice(0, 1000), sr);
    assert(!valShort.valid, 'Short audio (< 3s) rejected');
    assert(valShort.errorCode === 'AUDIO_TOO_SHORT', `Error code matches AUDIO_TOO_SHORT (Actual: ${valShort.errorCode})`);

    // Silent audio
    const valSilent = HeartSoundMLService.validate_audio(new Array(6000).fill(0), sr);
    assert(!valSilent.valid, 'Silent audio rejected');
    assert(valSilent.errorCode === 'AUDIO_SILENT', `Error code matches AUDIO_SILENT (Actual: ${valSilent.errorCode})`);
  }

  // 5. Test Preprocessing Pipeline (Resampling, Filtering, Mel-spectrogram)
  {
    const preprocessed = HeartSoundMLService.preprocess_audio(normalAudio, sr);
    assert(preprocessed.length === normalAudio.length, 'Resampling and filtering maintains sample sequence');

    const melSpec = HeartSoundMLService.generate_melspectrogram(preprocessed);
    assert(melSpec.length === 64, `Mel-spectrogram has 64 Mel frequency bands (Actual: ${melSpec.length})`);
    assert(melSpec[0].length === 128, `Mel-spectrogram has 128 fixed time frames (Actual: ${melSpec[0].length})`);
  }

  // 6. Test HeartSoundCNN Inference Pipeline
  {
    // Normal PCG inference
    const normalResult = await HeartSoundMLService.predict(normalAudio, sr, { mode: 'real' });
    assert(normalResult.module === 'heart_sound', 'Result schema module is heart_sound');
    assert(normalResult.screening_only === true, 'Screening only disclaimer flag present');
    assert(normalResult.abnormal_probability < 0.40, `Normal PCG abnormal probability is low (< 0.40, Actual: ${normalResult.abnormal_probability})`);
    assert(normalResult.prediction === 'normal', `Prediction is 'normal' (Actual: ${normalResult.prediction})`);
    assert(normalResult.risk === 'NORMAL', `Risk is 'NORMAL' (Actual: ${normalResult.risk})`);
    assert(normalResult.disclaimer.includes('screening'), 'Clinical non-diagnostic disclaimer present');

    // Abnormal Murmur PCG inference
    const abnormalResult = await HeartSoundMLService.predict(abnormalAudio, sr, { mode: 'real' });
    assert(abnormalResult.abnormal_probability >= 0.40, `Abnormal murmur PCG elevates abnormal probability (>= 0.40, Actual: ${abnormalResult.abnormal_probability})`);
    assert(abnormalResult.prediction === 'abnormal_pattern', `Prediction is 'abnormal_pattern' (Actual: ${abnormalResult.prediction})`);
    assert(abnormalResult.risk === 'MONITOR' || abnormalResult.risk === 'FOLLOW_UP', `Risk flag is elevated (Actual: ${abnormalResult.risk})`);
  }

  // 7. Test Explicit Demo Mode
  {
    const demoNormal = await HeartSoundMLService.predict(normalAudio, sr, { mode: 'demo', simulatedScenario: 'normal' });
    assert(demoNormal.prediction === 'normal', 'Demo mode normal scenario produces normal prediction');
    assert(demoNormal.risk === 'NORMAL', 'Demo mode normal scenario produces NORMAL risk');

    const demoElevated = await HeartSoundMLService.predict(normalAudio, sr, { mode: 'demo', simulatedScenario: 'follow_up' });
    assert(demoElevated.prediction === 'abnormal_pattern', 'Demo mode follow-up scenario produces abnormal prediction');
    assert(demoElevated.risk === 'FOLLOW_UP', 'Demo mode follow-up scenario produces FOLLOW_UP risk');
  }

  console.log(`\n=== HeartSoundCNN Test Results: ${passed} Passed, ${failed} Failed ===`);
  if (failed > 0) {
    process.exit(1);
  }
}

runHeartSoundTests().catch(err => {
  console.error('Test runner failed:', err);
  process.exit(1);
});
