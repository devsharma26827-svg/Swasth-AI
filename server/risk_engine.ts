import { HealthStatus, ConfidenceLevel, RiskSummary } from '../src/types';

export interface SignalReading {
  module: string;
  value: number | string;
  unit?: string;
  status: HealthStatus;
  quality: number; // 0 - 100
  confidence: ConfidenceLevel;
  confidenceScore: number; // 0 - 1
  baseline?: number;
  historicalRecentCount?: number;
  historicalAbnormalCount?: number;
  timestamp: string;
  explanation: string;
}

export class HealthRiskEngine {
  /**
   * Evaluates collective multi-modal signals against baseline and history.
   * Strictly avoids diagnostic labels and assigns risk state: NORMAL, MONITOR, or FOLLOW_UP.
   */
  static evaluateRisk(readings: SignalReading[]): RiskSummary {
    // Filter out untested or null signals: ONLY tested modules are evaluated
    const validReadings = (readings || []).filter(
      r => r && r.status && r.status !== 'not_tested' && r.status !== 'no_valid_results'
    );

    if (validReadings.length === 0) {
      return {
        overallStatus: 'no_valid_results',
        riskScore: 0,
        confidence: 'low',
        primarySignals: [],
        trendInsight: 'No screening tests were completed in this checkup session. No valid sensor data recorded.',
        recommendedAction: 'Perform at least one screening module (e.g. Camera PPG or Cough screening) to evaluate physiological signals.',
        followUpRequired: false,
        timestamp: new Date().toISOString()
      };
    }

    let followUpCount = 0;
    let monitorCount = 0;
    let totalScore = 0;
    let totalQuality = 0;

    const primarySignals = validReadings.map(r => {
      totalQuality += r.quality;
      
      // Weight module scores
      let moduleScore = 15;
      if (r.status === 'follow_up') {
        moduleScore = 75;
        // Check if this is an isolated occurrence vs repeated
        if ((r.historicalAbnormalCount || 0) >= 2) {
          moduleScore = 90;
          followUpCount += 2;
        } else {
          followUpCount += 1;
        }
      } else if (r.status === 'monitor') {
        moduleScore = 45;
        monitorCount += 1;
      } else if (r.status === 'insufficient') {
        moduleScore = 20;
      }
      totalScore += moduleScore;

      return {
        module: r.module,
        value: `${r.value}${r.unit ? ' ' + r.unit : ''}`,
        status: r.status,
        note: r.explanation
      };
    });

    const avgScore = Math.round(totalScore / validReadings.length);
    const avgQuality = totalQuality / validReadings.length;

    let overallStatus: HealthStatus = 'normal';
    let followUpRequired = false;
    let trendInsight = 'Your recent measurements align comfortably with your personal monitoring range.';
    let recommendedAction = 'Maintain regular daily hydration, light activity, and weekly check-ins.';

    // Any validated follow_up finding in a partial or full checkup requires clinical follow-up
    if (followUpCount >= 2 || (followUpCount >= 1 && (validReadings.length === 1 || avgScore >= 50 || monitorCount >= 1))) {
      overallStatus = 'follow_up';
      followUpRequired = true;
      trendInsight = 'An unusual pattern was detected during screening. Clinical review with a physician is recommended.';
      recommendedAction = 'Consider scheduling a consultation with a healthcare professional to review this pattern.';
    } else if (followUpCount === 1 || monitorCount >= 1) {
      overallStatus = 'monitor';
      followUpRequired = false;
      trendInsight = 'Your recent reading differs slightly from your usual range. Continue monitoring this trend.';
      recommendedAction = 'Re-check again tomorrow at the same time to establish whether this is a transient variance.';
    }

    const confidence: ConfidenceLevel = avgQuality > 80 ? 'high' : avgQuality > 50 ? 'moderate' : 'low';

    return {
      overallStatus,
      riskScore: avgScore,
      confidence,
      primarySignals,
      trendInsight,
      recommendedAction,
      followUpRequired,
      timestamp: new Date().toISOString()
    };
  }
}
