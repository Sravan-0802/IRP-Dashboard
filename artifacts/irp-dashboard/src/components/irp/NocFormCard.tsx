import { AlertTriangle, ArrowUpRight } from "lucide-react";
import { NOC_FORM_URL } from "@/lib/nocForm";

export function NocFormCard() {
  return (
    <section aria-labelledby="noc-form-title" data-testid="card-noc-form">
      <div className="mb-3">
        <h2 id="noc-form-title" className="font-display text-xl font-extrabold tracking-tight text-ink">
          NOC Form
        </h2>
        <p className="mt-1 text-sm font-medium text-muted2">
          Required for every IRP student, whichever track you are on.
        </p>
      </div>

      <div className="rounded-[22px] border-2 border-[#7f3fe0] bg-white p-5 shadow-[0_12px_32px_rgba(105,65,198,0.08)] sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="rounded-full bg-[#b4232c] px-3 py-1 text-[11px] font-extrabold tracking-wide text-white">
            MANDATORY FOR ALL STUDENTS
          </span>
          <span className="rounded-full border border-[#f4dfc8] bg-[#fff8ef] px-3 py-1 text-xs font-semibold text-[#934b32]">
            Status: Check on form
          </span>
        </div>

        <h3 className="mt-5 font-display text-xl font-extrabold tracking-tight text-[#171717] sm:text-[26px]">
          No Objection Certificate (NOC) for Internships
        </h3>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-[#4b4b53] sm:text-base">
          The NOC confirms your college has no objection to you taking up an internship. It verifies your enrollment and serves as official approval from your department.
        </p>

        <div className="mt-5 flex items-start gap-3 rounded-2xl border border-[#f3b9bd] bg-[#fff4f4] px-4 py-3.5 text-[#8d3036]">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-[#b4232c]" aria-hidden="true" />
          <div>
            <p className="text-sm font-bold">Filling this form is mandatory</p>
            <p className="mt-0.5 text-sm leading-5">
              Every student must submit the NOC form. Without it, your profile cannot be taken forward for internship opportunities.
            </p>
          </div>
        </div>

        <a
          href={NOC_FORM_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-5 inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-xl bg-[#7026d9] px-5 py-3 text-center text-base font-extrabold text-white shadow-sm transition-colors hover:bg-[#5e1cbd] focus:outline-none focus-visible:ring-4 focus-visible:ring-[#7026d9]/25"
          data-testid="link-fill-noc-form"
        >
          Fill the NOC Form
          <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
        </a>
      </div>
    </section>
  );
}
