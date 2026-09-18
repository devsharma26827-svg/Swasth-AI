import { GaitResult, CameraGaitResult, DemoScenario, HealthStatus } from '../src/types';
import { GaitMotionProcessor } from './signal_processing';
import { CameraGaitProcessor, FrameLandmarks } from './camera_gait';

export class MotionGaitAdapter {
  public static process(readings: { x: number; y: number; z: number; timestampMs: number }[] = [], scenario: DemoScenario = 'normal'): GaitResult {
    return GaitMotionProcessor.computeGaitMetrics(readings, scenario);
  }
}

export class CameraGaitAdapter {
  public static process(params: {
    frames?: FrameLandmarks[];
    durationSeconds?: number;
    fps?: number;
    mode?: 'real' | 'demo' | 'synthetic';
    simulatedScenario?: DemoScenario;
  }): CameraGaitResult {
    return CameraGaitProcessor.processVideoGait(params);
  }
}

export class GaitService {
  public static evaluateMotionGait(readings: { x: number; y: number; z: number; timestampMs: number }[] = [], scenario: DemoScenario = 'normal'): GaitResult {
    return MotionGaitAdapter.process(readings, scenario);
  }

  public static evaluateCameraGait(params: {
    frames?: FrameLandmarks[];
    durationSeconds?: number;
    fps?: number;
    mode?: 'real' | 'demo' | 'synthetic';
    simulatedScenario?: DemoScenario;
  }): CameraGaitResult {
    return CameraGaitAdapter.process(params);
  }

  /**
   * Evaluates collective gait state when both or either gait signal is present.
   * Preserves both distinct signals. Missing signals are NOT treated as normal.
   */
  public static summarizeGaitStatus(
    motionResult?: GaitResult | null,
    cameraResult?: CameraGaitResult | null
  ): {
    hasMotion: boolean;
    hasCamera: boolean;
    combinedStatus: HealthStatus;
    summaryText: string;
  } {
    const hasMotion = !!motionResult && motionResult.status !== 'not_tested' && motionResult.status !== 'no_valid_results';
    const hasCamera = !!cameraResult && cameraResult.status !== 'not_tested' && cameraResult.status !== 'no_valid_results';

    if (!hasMotion && !hasCamera) {
      return {
        hasMotion: false,
        hasCamera: false,
        combinedStatus: 'not_tested',
        summaryText: 'Neither motion sensor nor camera gait screening was performed.'
      };
    }

    if (hasMotion && !hasCamera) {
      return {
        hasMotion: true,
        hasCamera: false,
        combinedStatus: motionResult!.status,
        summaryText: `Motion sensor gait recorded: ${motionResult!.cadence} spm cadence, ${motionResult!.strideRegularity}% regularity.`
      };
    }

    if (!hasMotion && hasCamera) {
      return {
        hasMotion: false,
        hasCamera: true,
        combinedStatus: cameraResult!.status,
        summaryText: `Camera gait recorded: ${cameraResult!.cadenceStepsPerMin} spm cadence, ${cameraResult!.stepSymmetryIndex}% symmetry.`
      };
    }

    // Both available: check if either indicates follow-up or monitor
    const statuses = [motionResult!.status, cameraResult!.status];
    let combinedStatus: HealthStatus = 'normal';
    if (statuses.includes('follow_up')) {
      combinedStatus = 'follow_up';
    } else if (statuses.includes('monitor')) {
      combinedStatus = 'monitor';
    }

    return {
      hasMotion: true,
      hasCamera: true,
      combinedStatus,
      summaryText: `Multi-modal gait: Motion cadence ${motionResult!.cadence} spm, Camera symmetry ${cameraResult!.stepSymmetryIndex}%.`
    };
  }
}
