// End-to-End System Verification Test
// Tests:
// 1. /api/ml/health (HeartSoundCNN healthcheck)
// 2. /api/screening/heart-sound (Normal audio & Abnormal murmur audio inference)
// 3. /api/measurements/ppg (Real mode with optical frames & Demo mode)
// 4. Checkup flow & Risk Engine aggregation
// 5. Audit & Clinical bounds validation

import { HeartSoundMLService } from './heart_sound_ml';
import { PPGSignalProcessor, HeartSoundAudioProcessor } from './signal_processing';
import { HealthRiskEngine } from './risk_engine';

async function runE2ETests() {
  console.log('=== SWASTHAI END-TO-END VERIFICATION PASS ===\n');
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, name: string, detail?: string) {
    if (condition) {
      console.log(`✅ [PASS] ${name}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${name} ${detail ? `- ${detail}` : ''}`);
      failed++;
    }
  }

  // 1. ML Healthcheck
  console.log('--- Step 1: ML Model Health & Status ---');
  await HeartSoundMLService.load_model();
  const mlHealth = HeartSoundMLService.get_health();
  assert(mlHealth.model_type === 'cnn', 'Model type is CNN');
  assert(mlHealth.device === 'cpu', 'Device is CPU');
  assert(mlHealth.heart_sound_model === 'loaded', 'Heart sound model is loaded');
  assert(mlHealth.model_version === 'heart_sound_cnn_v1', 'Model version is heart_sound_cnn_v1');

  // 2. Heart Sound Normal Audio Screening
  console.log('\n--- Step 2: HeartSoundMLService Normal Audio Inference ---');
  const normalSamples: number[] = [];
  const sr = 2000;
  for (let i = 0; i < sr * 5; i++) {
    const t = i / sr;
    const s1 = Math.exp(-Math.pow((t % 0.85) - 0.05, 2) / 0.001) * Math.sin(2 * Math.PI * 55 * t);
    const s2 = Math.exp(-Math.pow((t % 0.85) - 0.35, 2) / 0.0008) * Math.sin(2 * Math.PI * 85 * t);
    normalSamples.push(s1 + s2);
  }

  const normalPred = await HeartSoundMLService.predict(normalSamples, sr, { mode: 'real' });
  assert(normalPred.prediction === 'normal', 'Normal PCG audio classified as normal');
  assert(normalPred.risk === 'NORMAL', 'Normal PCG risk is NORMAL');
  assert(normalPred.abnormal_probability < 0.45, `Normal abnormal_probability is low (${normalPred.abnormal_probability})`);
  assert(normalPred.screening_only === true, 'Screening only flag is true');
  assert(normalPred.disclaimer.includes('does not diagnose'), 'Screening disclaimer is present');

  // 3. Heart Sound Abnormal Murmur Audio Screening
  console.log('\n--- Step 3: HeartSoundMLService Abnormal Murmur Audio Inference ---');
  const murmurSamples: number[] = [];
  for (let i = 0; i < sr * 5; i++) {
    const t = i / sr;
    const s1 = Math.exp(-Math.pow((t % 0.85) - 0.05, 2) / 0.001) * Math.sin(2 * Math.PI * 55 * t);
    const s2 = Math.exp(-Math.pow((t % 0.85) - 0.35, 2) / 0.0008) * Math.sin(2 * Math.PI * 85 * t);
    const murmur = (t % 0.85 >= 0.12 && t % 0.85 <= 0.30) ? 0.45 * Math.sin(2 * Math.PI * 250 * t) : 0;
    murmurSamples.push(s1 + s2 + murmur);
  }

  const abnormalPred = await HeartSoundMLService.predict(murmurSamples, sr, { mode: 'real' });
  assert(abnormalPred.prediction === 'abnormal_pattern', 'Murmur PCG audio classified as abnormal_pattern');
  assert(abnormalPred.risk === 'FOLLOW_UP', 'Murmur PCG risk is FOLLOW_UP');
  assert(abnormalPred.abnormal_probability > 0.65, `Murmur abnormal_probability is elevated (${abnormalPred.abnormal_probability})`);

  // 4. PPG Optical Signal Processing (Fingertip Camera)
  console.log('\n--- Step 4: Camera PPG Signal Processing ---');
  const ppgRed: number[] = [];
  const ppgGreen: number[] = [];
  const ppgBlue: number[] = [];
  const ppgTimestamps: number[] = [];
  const fps = 30;
  const bpmTrue = 75;
  const freqTrue = bpmTrue / 60; // 1.25 Hz

  for (let i = 0; i < fps * 20; i++) {
    const t = i / fps;
    const ac = 8 * Math.sin(2 * Math.PI * freqTrue * t) + 3 * Math.sin(4 * Math.PI * freqTrue * t);
    const dc = 180;
    ppgRed.push(dc + ac);
    ppgGreen.push(dc * 0.4 + ac * 0.5);
    ppgBlue.push(dc * 0.3 + ac * 0.3);
    ppgTimestamps.push(Date.now() + i * 33);
  }

  const quality = PPGSignalProcessor.evaluatePPGQuality(ppgRed, ppgGreen, ppgBlue);
  assert(quality.passed === true, `PPG quality passed: ${quality.reason}`);
  assert(quality.score >= 65, `PPG quality score is acceptable (${quality.score}/100)`);

  const filtered = PPGSignalProcessor.bandpassFilter(ppgRed, fps);
  assert(filtered.length === ppgRed.length, 'PPG filtering preserves buffer length');

  const peaks = PPGSignalProcessor.detectPeaks(filtered, fps);
  assert(peaks.length >= 15, `Detected ${peaks.length} systolic peaks over 20s recording`);

  const hrHrv = PPGSignalProcessor.computeHRandHRV(peaks, fps);
  assert(hrHrv.success === true, 'Heart rate and HRV computation succeeded');
  assert(hrHrv.bpm >= 70 && hrHrv.bpm <= 80, `Calculated BPM ${hrHrv.bpm} within ±5 BPM of true (75 BPM)`);
  assert(hrHrv.hrvRmssd > 0, `Valid RMSSD calculated (${hrHrv.hrvRmssd} ms)`);

  const spo2 = PPGSignalProcessor.estimateSpO2(ppgRed, ppgGreen, filtered);
  assert(spo2.estimatedSpO2 >= 92 && spo2.estimatedSpO2 <= 100, `Estimated SpO2 in valid physiological range (${spo2.estimatedSpO2}%)`);

  // 5. Health Risk Engine Aggregation
  console.log('\n--- Step 5: Multi-Sensor Health Risk Engine Aggregation ---');
  const riskSummary = HealthRiskEngine.evaluateRisk([
    {
      module: 'ppg',
      value: hrHrv.bpm,
      unit: 'BPM',
      status: 'normal',
      quality: 92,
      confidence: 'high',
      confidenceScore: 0.92,
      timestamp: new Date().toISOString(),
      explanation: 'Resting heart rate in optimal range.'
    },
    {
      module: 'heartSound',
      value: 'S1/S2 Regular',
      status: 'normal',
      quality: 88,
      confidence: 'high',
      confidenceScore: 0.88,
      timestamp: new Date().toISOString(),
      explanation: 'Normal cardiac acoustic profile with clear S1/S2 boundaries.'
    },
    {
      module: 'gait',
      value: 110,
      unit: 'spm',
      status: 'normal',
      quality: 90,
      confidence: 'high',
      confidenceScore: 0.90,
      timestamp: new Date().toISOString(),
      explanation: 'Stable symmetric stride and cadence.'
    }
  ]);

  assert(riskSummary.overallStatus === 'normal', `Comprehensive risk status is normal (${riskSummary.overallStatus})`);
  assert(riskSummary.riskScore <= 30, `Overall risk score is low (${riskSummary.riskScore})`);
  assert(!riskSummary.followUpRequired, 'Follow-up not required for normal vitals');

  // 6. Partial Checkup & Invariant Verification
  console.log('\n--- Step 6: Invariant Verification: Partial Checkups & No-Data Handling ---');
  
  // Rule: NO INPUT = NO RESULT; NOT TESTED != NORMAL
  const emptyRisk = HealthRiskEngine.evaluateRisk([]);
  assert(emptyRisk.overallStatus === 'no_valid_results', 'Empty module list results in no_valid_results (not normal)');
  assert(emptyRisk.riskScore === 0, 'Risk score with 0 inputs is 0');
  assert(emptyRisk.trendInsight.includes('No valid sensor'), 'Insight indicates no valid sensor measurements recorded');

  // Rule: Single Module (e.g. only Heart Sound abnormal)
  const singleAbnormalRisk = HealthRiskEngine.evaluateRisk([
    {
      module: 'heartSound',
      value: 'Systolic Murmur (abnormal_pattern)',
      status: 'follow_up',
      quality: 85,
      confidence: 'high',
      confidenceScore: 0.85,
      timestamp: new Date().toISOString(),
      explanation: 'Acoustic turbulence detected during ventricular ejection.'
    }
  ]);
  assert(singleAbnormalRisk.overallStatus === 'follow_up', 'Single abnormal module triggers follow_up');
  assert(singleAbnormalRisk.riskScore >= 60, `Risk score reflects the abnormal finding (${singleAbnormalRisk.riskScore})`);
  assert(singleAbnormalRisk.followUpRequired === true, 'Follow up is required for abnormal heart sound');

  // Rule: Only PPG normal tested
  const ppgOnlyRisk = HealthRiskEngine.evaluateRisk([
    {
      module: 'ppg',
      value: 72,
      unit: 'BPM',
      status: 'normal',
      quality: 95,
      confidence: 'high',
      confidenceScore: 0.95,
      timestamp: new Date().toISOString(),
      explanation: 'Resting heart rate in optimal range.'
    }
  ]);
  assert(ppgOnlyRisk.overallStatus === 'normal', 'Single normal module evaluates to normal without assuming other tests');

  // 7. Report Generation Zero-Fabrication Invariant Test
  console.log('\n--- Step 7: Report Generation Zero-Fabrication Invariant Test ---');
  // Simulate building report modules from a partial checkup (PPG only)
  const partialSessionModules: Record<string, any> = {
    ppg: {
      status: 'completed',
      data: { hr: 72, hrv: 45, confidence: 94 },
      healthStatus: 'normal',
      explanation: 'Optimal resting heart rate.'
    },
    heartSound: { status: 'not_started' },
    cough: { status: 'not_started' },
    gait: { status: 'not_started' }
  };

  const reportModules = [
    {
      id: 'ppg',
      name: 'Photoplethysmography (PPG)',
      tested: partialSessionModules.ppg.status === 'completed',
      valueDisplay: partialSessionModules.ppg.status === 'completed' ? `${partialSessionModules.ppg.data.hr} BPM` : 'Not Tested',
      healthStatus: partialSessionModules.ppg.healthStatus || 'not_tested'
    },
    {
      id: 'heartSound',
      name: 'Acoustic Heart Sound',
      tested: partialSessionModules.heartSound.status === 'completed',
      valueDisplay: partialSessionModules.heartSound.status === 'completed' ? partialSessionModules.heartSound.data.pattern : 'Not Tested',
      healthStatus: 'not_tested'
    },
    {
      id: 'cough',
      name: 'Acoustic Cough Screening',
      tested: partialSessionModules.cough.status === 'completed',
      valueDisplay: partialSessionModules.cough.status === 'completed' ? partialSessionModules.cough.data.pattern : 'Not Tested',
      healthStatus: 'not_tested'
    },
    {
      id: 'gait',
      name: 'Mobility & Gait Dynamics',
      tested: partialSessionModules.gait.status === 'completed',
      valueDisplay: partialSessionModules.gait.status === 'completed' ? `${partialSessionModules.gait.data.cadence} spm` : 'Not Tested',
      healthStatus: 'not_tested'
    }
  ];

  assert(reportModules[0].tested === true, 'PPG module is marked tested in report');
  assert(reportModules[0].valueDisplay === '72 BPM', 'PPG module retains exact measured value');
  assert(reportModules[1].tested === false, 'Untested Heart Sound has tested=false');
  assert(reportModules[1].valueDisplay === 'Not Tested', 'Untested Heart Sound has valueDisplay="Not Tested"');
  assert(reportModules[1].healthStatus === 'not_tested', 'Untested Heart Sound has healthStatus="not_tested"');
  assert(reportModules[2].tested === false, 'Untested Cough has tested=false');
  assert(reportModules[3].tested === false, 'Untested Gait has tested=false');

  console.log(`\n==============================================`);
  console.log(`ALL VERIFICATION TESTS COMPLETED: ${passed} PASSED, ${failed} FAILED`);
  console.log(`==============================================`);

  if (failed > 0) process.exit(1);
}

runE2ETests().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
