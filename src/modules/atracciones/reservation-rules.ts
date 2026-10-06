export function occupiedSeats(adults: number, children: number): number {
  if (!Number.isInteger(adults) || adults < 0 || !Number.isInteger(children) || children < 0) {
    throw new RangeError('Participant counts must be non-negative integers.');
  }
  return adults + children;
}

export function participantCountAllowed(count: number, minimum: number, maximum: number | null): boolean {
  return Number.isInteger(count) && count >= minimum && (maximum === null || count <= maximum);
}
