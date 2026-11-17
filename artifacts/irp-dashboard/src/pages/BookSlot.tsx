import { AssessmentCalendarBoard } from "./AssessmentCalendarBoard";

/** The uploaded calendar is the only schedule surface; legacy July cards are retired. */
export function BookSlot() {
  return (
    <div className="space-y-6">
      <AssessmentCalendarBoard />
    </div>
  );
}
