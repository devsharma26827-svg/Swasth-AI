export function formatReportConfidence(score: number | undefined | null): number {
  if (score === undefined || score === null || isNaN(score)) return 85;
  let val = score;
  if (val <= 1) {
    val = val * 100;
  }
  return Math.min(90, Math.max(75, Math.round(val)));
}
