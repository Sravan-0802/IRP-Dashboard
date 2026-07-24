/**
 * Test users who should always be able to register for July 26 booking,
 * even outside the normal registration window.
 */
export const JULY26_BOOKING_TEST_USER_IDS: ReadonlySet<string> = new Set([
  "69d3bd59-7b23-4ae5-8fb5-439b505334df",
]);

export function isJuly26BookingTestUser(userId: string | null | undefined): boolean {
  if (!userId) return false;
  return JULY26_BOOKING_TEST_USER_IDS.has(userId.trim());
}
