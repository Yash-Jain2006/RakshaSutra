export type FreshnessLevel = 'live' | 'recent' | 'delayed' | 'stale';

export interface FreshnessState {
  level: FreshnessLevel;
  label: string;
  badgeText: string;
  color: string;
  bg: string;
  dotColor: string;
  ageSeconds: number;
}

/**
 * Standardized location freshness calculator.
 * - 0–15s:  LIVE (Emerald Green)
 * - 15–60s: RECENT (Cyan / Blue)
 * - 1–5m:   DELAYED (Amber / Orange)
 * - >5m:    STALE (Slate / Grey)
 */
export function getLocationFreshness(lastLocationAt: string | number | Date | null | undefined): FreshnessState {
  if (!lastLocationAt) {
    return {
      level: 'stale',
      label: 'No location received',
      badgeText: 'Awaiting fix',
      color: '#64748b',
      bg: '#f1f5f9',
      dotColor: '#94a3b8',
      ageSeconds: Infinity,
    };
  }

  const timestamp = typeof lastLocationAt === 'string' || typeof lastLocationAt === 'number'
    ? new Date(lastLocationAt).getTime()
    : lastLocationAt.getTime();

  const now = Date.now();
  const ageSeconds = Math.max(0, Math.floor((now - timestamp) / 1000));

  if (ageSeconds <= 60) {
    return {
      level: 'live',
      label: ageSeconds <= 5 ? 'Updated just now' : `Updated ${ageSeconds}s ago`,
      badgeText: 'Current',
      color: '#15803d',
      bg: '#dcfce7',
      dotColor: '#22c55e',
      ageSeconds,
    };
  }

  if (ageSeconds <= 300) {
    const mins = Math.floor(ageSeconds / 60);
    return {
      level: 'delayed',
      label: `Delayed · Last updated ${mins}m ago`,
      badgeText: 'Delayed',
      color: '#b45309',
      bg: '#fef3c7',
      dotColor: '#f59e0b',
      ageSeconds,
    };
  }

  const mins = Math.floor(ageSeconds / 60);
  return {
    level: 'stale',
    label: mins < 60 ? `Stale · ${mins}m ago` : `Stale · >1h ago`,
    badgeText: 'Stale',
    color: '#64748b',
    bg: '#f1f5f9',
    dotColor: '#94a3b8',
    ageSeconds,
  };
}
