export type StoreSurfaceState =
  | 'loading'
  | 'ready'
  | 'empty'
  | 'offline'
  | 'misconfigured';

export type StorePlanLike = {
  identifier: string;
  period: string | null;
};

const PERIOD_ORDER: Record<string, number> = {
  P1Y: 0,
  P1M: 1,
  P1W: 2,
};

/** Store sırası değişse bile paywall her açılışta aynı sırada görünür. */
export function sortStorePlans<T extends StorePlanLike>(plans: readonly T[]): T[] {
  return [...plans].sort((a, b) => {
    const period = (PERIOD_ORDER[a.period ?? ''] ?? 99) - (PERIOD_ORDER[b.period ?? ''] ?? 99);
    return period || a.identifier.localeCompare(b.identifier);
  });
}

export function paywallTitleKey(state: StoreSurfaceState):
  | 'ob.paywall.baslik'
  | 'ob.paywall.testBaslik'
  | 'ob.paywall.baglantiBaslik'
  | 'ob.paywall.ucretsizBaslik' {
  if (state === 'misconfigured') return 'ob.paywall.testBaslik';
  if (state === 'offline') return 'ob.paywall.baglantiBaslik';
  if (state === 'empty') return 'ob.paywall.ucretsizBaslik';
  return 'ob.paywall.baslik';
}
