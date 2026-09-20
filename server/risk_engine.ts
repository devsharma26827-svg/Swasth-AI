import { HealthStatus, ConfidenceLevel, RiskSummary, UserProfile } from '../src/types';

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
   * Evaluates collective multi-modal signals against baseline and user profile.
   * Strictly evaluates ONLY completed modules in the current checkup session.
   * Untested modules contribute NOTHING to risk score, confidence, or primary signals.
   */
  static evaluateRisk(
    readings: SignalReading[],
    userProfile?: UserProfile | null,
    userHistory?: { ppgCount?: number; heartSoundCount?: number; coughCount?: number; totalSessions?: number } | null
  ): RiskSummary {
    // Filter out untested, un-started, or invalid signals: ONLY completed modules in current session are evaluated
    const validReadings = (readings || []).filter(
      r => r && r.status && r.status !== 'not_tested' && r.status !== 'no_valid_results'
    );

    if (validReadings.length === 0) {
      return {
        overallStatus: 'no_valid_results',
        riskScore: 0,
        confidence: 'low',
        primarySignals: [],
        trendInsight: 'No valid screening measurements were completed in this checkup session.',
        recommendedAction: 'Perform at least one screening module (e.g. Camera PPG or Cough screening) to evaluate physiological signals.',
        followUpRequired: false,
        timestamp: new Date().toISOString()
      };
    }

    // Demographic Personalization Layer
    let personalizedMaxHR = 190;
    let targetRestingHRLow = 60;
    let targetRestingHRHigh = 100;

    if (userProfile && userProfile.age) {
      personalizedMaxHR = Math.max(140, 220 - userProfile.age);
      if (userProfile.activityLevel === 'very_active' || userProfile.activityLevel === 'moderately_active') {
        targetRestingHRLow = 50;
        targetRestingHRHigh = 85;
      }
      if (userProfile.smokingStatus === 'regular' || userProfile.smokingStatus === 'occasional') {
        targetRestingHRHigh = Math.min(105, targetRestingHRHigh + 5);
      }
    }

    let followUpCount = 0;
    let monitorCount = 0;
    let totalScore = 0;
    let totalQuality = 0;

    const primarySignals = validReadings.map(r => {
      totalQuality += r.quality || 80;
      
      // Module risk scoring
      let moduleScore = 15;
      if (r.status === 'follow_up') {
        moduleScore = 75;
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

      // Demographic adjustment for PPG heart rate reading
      if (r.module.includes('PPG') || r.module.includes('Heart Rate')) {
        const hrVal = typeof r.value === 'number' ? r.value : parseFloat(String(r.value));
        if (!isNaN(hrVal)) {
          if (hrVal > personalizedMaxHR * 0.85 || hrVal > targetRestingHRHigh) {
            moduleScore = Math.max(moduleScore, 60);
          }
        }
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

    // Determine baseline trend insight
    const hasHistory = userHistory && (userHistory.totalSessions || 0) >= 3;
    let trendInsight = hasHistory
      ? `Your measurements align comfortably with your historical personal monitoring baseline across ${userHistory.totalSessions} sessions.`
      : `Personal baseline not established yet. Assessment based on ${validReadings.length} completed screening module(s) in this session.`;

    let recommendedAction = 'Maintain regular daily hydration, light activity, and routine check-ins.';

    if (followUpCount >= 2 || (followUpCount >= 1 && (validReadings.length === 1 || avgScore >= 50 || monitorCount >= 1))) {
      overallStatus = 'follow_up';
      followUpRequired = true;
      trendInsight = 'An unusual physiological signal pattern was detected during screening. Clinical review with a physician is recommended.';
      recommendedAction = 'Consider scheduling a consultation with a healthcare professional to review this pattern.';
    } else if (followUpCount === 1 || monitorCount >= 1) {
      overallStatus = 'monitor';
      followUpRequired = false;
      trendInsight = 'Your screening reading differs slightly from expected targets. Continue monitoring this trend.';
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
