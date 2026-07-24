/**
 * Test users who should always see July 26 Online Assessment booking,
 * even if they already have a cleared L1 row in synced data.
 */
export const JULY26_BOOKING_TEST_USER_IDS: ReadonlySet<string> = new Set([
  "69d3bd59-7b23-4ae5-8fb5-439b505334df",
]);

export function isJuly26BookingTestUser(userId: string | null | undefined): boolean {
  if (!userId) return false;
  return JULY26_BOOKING_TEST_USER_IDS.has(userId.trim());
}
