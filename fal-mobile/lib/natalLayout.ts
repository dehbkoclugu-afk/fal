export type NatalLayoutInput = { key: string; lon: number };
export type NatalLayoutBody = NatalLayoutInput & { lane: number; radius: number };

const RADII = [104, 116, 92, 124] as const;

export function angularDistance(a: number, b: number): number {
  const distance = Math.abs((((a - b) % 360) + 360) % 360);
  return Math.min(distance, 360 - distance);
}

/**
 * Assign nearby bodies to stable radial lanes. Sorting first makes the result
 * independent from API object insertion order; circular distance also handles
 * collisions around the 0°/360° boundary.
 */
export function layoutNatalBodies(
  bodies: readonly NatalLayoutInput[],
  minimumSeparation = 9,
): NatalLayoutBody[] {
  const placed: NatalLayoutBody[] = [];
  const ordered = [...bodies].sort((a, b) => a.lon - b.lon || a.key.localeCompare(b.key));

  for (const body of ordered) {
    const occupied = new Set(
      placed
        .filter((other) => angularDistance(body.lon, other.lon) < minimumSeparation)
        .map((other) => other.lane),
    );
    const lane = RADII.findIndex((_, candidate) => !occupied.has(candidate));
    const safeLane = lane === -1 ? RADII.length - 1 : lane;
    placed.push({ ...body, lane: safeLane, radius: RADII[safeLane] });
  }

  return placed;
}

export function natalAspectLimit(renderSize: number, compact: boolean): number {
  if (renderSize < 280) return 8;
  return compact ? 10 : 14;
}
