import { useState } from "react";
import type { AssessmentResult } from "@workspace/api-client-react";
import type { Journey } from "@/lib/journey";
import { RegistrationBatchCallout } from "@/components/irp/RegistrationBatchCallout";
import { AssessmentCalendarBoard } from "./AssessmentCalendarBoard";

/** The uploaded calendar is the only schedule surface; legacy July cards are retired. */
export function BookSlot(_props: {
  level?: 1 | 2 | 3;
  journey?: Journey;
  assessments?: AssessmentResult[];
  userId?: string;
}) {
  const [registrationOpen, setRegistrationOpen] = useState(false);
  return (
    <div className="space-y-6">
      <AssessmentCalendarBoard />
      <section className="rounded-xl border border-[#eaecf0] bg-white p-4">
        <button
          type="button"
          aria-expanded={registrationOpen}
          aria-controls="calendar-registration-details"
          data-testid="button-calendar-registration-details"
          onClick={() => setRegistrationOpen((open) => !open)}
          className="text-sm font-bold text-[#6941c6] hover:underline"
        >
          {registrationOpen ? "Hide registration details" : "View your registration details"}
        </button>
        <p className="mt-1 text-xs text-[#667085]">Manage an existing batch registration here. Assessment dates and links are listed in the calendar above.</p>
        {registrationOpen ? (
          <div id="calendar-registration-details" className="mt-4 space-y-4">
            <RegistrationBatchCallout />
            <RegistrationBatchCallout track="genai" />
          </div>
        ) : null}
      </section>
    </div>
  );
}
