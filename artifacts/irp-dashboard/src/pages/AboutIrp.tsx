import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  Award,
  Blocks,
  BookOpenCheck,
  Building2,
  CalendarCheck,
  CheckCircle2,
  Code2,
  Crown,
  Layers,
  Rocket,
  Sparkles,
  Target,
  TrendingUp,
  UserRound,
  Zap,
} from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { IrpCard } from "@/components/irp/ui";

type Level = {
  id: string;
  step: string;
  title: string;
  tagline: string;
  icon: LucideIcon;
  accent: string;
  accentSoft: string;
  accentText: string;
  summary: string;
  assessment: string[];
  post: string[];
  outcome: string;
};

const LEVELS: Level[] = [
  {
    id: "L1",
    step: "Level 1",
    title: "The Hustler",
    tagline: "Live now",
    icon: Code2,
    accent: "#6941c6",
    accentSoft: "#f9f5ff",
    accentText: "#6941c6",
    summary: "Your entry point — foundational frontend and programming.",
    assessment: [
      "Problem Solving (Python / C++) · 90 min · 4 questions",
      "Frontend MCQ — HTML, CSS, JS, React · 30 min",
    ],
    post: [
      "FE project · 12 hours",
      "AI mock interview (NxtMock) · 1 hour",
      "Human mock interview · 1 hour",
    ],
    outcome: "Clear L1 to unlock Level 2",
  },
  {
    id: "L2",
    step: "Level 2",
    title: "The Main Character",
    tagline: "Full stack",
    icon: Layers,
    accent: "#dc6803",
    accentSoft: "#fffaeb",
    accentText: "#b54708",
    summary: "Backend, databases and GenAI — the full-stack layer.",
    assessment: [
      "Backend — NodeJS + Express · 20 min",
      "Database — SQL, NoSQL, MongoDB · 80 min",
      "Generative AI · 20 min",
    ],
    post: [
      "Full stack + AI project · 24 hours",
      "AI mock interview · 1 hour",
      "Human mock interview · 1 hour",
    ],
    outcome: "Internships ₹5K–₹15K + access to L3",
  },
  {
    id: "L3",
    step: "Level 3",
    title: "Infinite Aura",
    tagline: "Top 1%",
    icon: Crown,
    accent: "#d92d20",
    accentSoft: "#fef3f2",
    accentText: "#b42318",
    summary: "The elite track — top stipends and curated mentorship.",
    assessment: [
      "DSA Levels 2, 3 & 4",
      "Full stack Gen AI assessment",
      "CodeChef rating above 1600",
    ],
    post: ["Human mock interview", "Project + resume depth review"],
    outcome: "₹25K+ stipends + mentorship",
  },
];

const STATS: { icon: LucideIcon; value: string; label: string }[] = [
  { icon: Layers, value: "3", label: "Levels on one path" },
  { icon: TrendingUp, value: "₹5K–₹25K+", label: "Monthly stipend range" },
  { icon: Building2, value: "Real teams", label: "Not a simulation" },
];

const WILDCARD_GATES = [
  "DSA Levels 2, 3 & 4",
  "Full stack Gen AI",
  "CodeChef rating > 1600",
  "Human mock interview",
];

const CHECKLIST: { icon: LucideIcon; title: string; detail: string }[] = [
  {
    icon: BookOpenCheck,
    title: "Study & revise the core",
    detail: "DSA basics, HTML, CSS, JS and OOP — lock in your fundamentals.",
  },
  {
    icon: CalendarCheck,
    title: "Practice daily, no skips",
    detail: "Solve on the NxtWave platform every day. Consistency beats cramming.",
  },
  {
    icon: Blocks,
    title: "Finish pending courses",
    detail: "Complete the courses for your level before the assessment date.",
  },
  {
    icon: UserRound,
    title: "Build the profile",
    detail: "Keep LinkedIn, GitHub, LeetCode and CodeChef updated and active.",
  },
];

const FAQ = [
  {
    q: "Who is IRP 2.0 for?",
    a: "IRP 2.0 is built for YOG 2028 and 2029 students who want a structured path from assessments to a paid internship.",
  },
  {
    q: "What is the standard route?",
    a: "Clear Level 1 (The Hustler), then Level 2 (The Main Character). After L2 you can either take an internship offer or push for Level 3 — Infinite Aura.",
  },
  {
    q: "What is the Wildcard route?",
    a: "If you believe you are in the top 1%, you can skip L1 and L2 and attempt direct entry to Infinite Aura — provided you clear all four eligibility gates.",
  },
  {
    q: "How do the stipends work?",
    a: "Internships after Level 2 pay ₹5K–₹15K per month. The Level 3 Infinite Aura cohort unlocks ₹25K+ per month. The exact amount depends on the company and your performance.",
  },
  {
    q: "What happens after each assessment?",
    a: "Each level has post-assessment rounds: a timed project, an AI mock interview, and a human mock interview. You must clear these to progress.",
  },
  {
    q: "How should I prepare?",
    a: "Revise your fundamentals, practice on the NxtWave platform daily, finish the pending courses for your level, and keep your coding profiles active.",
  },
] as const;

function SectionHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description?: string;
}) {
  return (
    <div className="mb-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#6941c6]">
        {eyebrow}
      </p>
      <h2 className="mt-1 font-display text-lg font-bold tracking-tight text-[#101828] sm:text-xl">
        {title}
      </h2>
      {description ? (
        <p className="mt-1 text-sm leading-relaxed text-[#667085]">{description}</p>
      ) : null}
    </div>
  );
}

export function AboutIrp() {
  return (
    <div className="space-y-8 pb-10">
      <section
        className="animate-pop-in relative overflow-hidden rounded-2xl px-6 py-8 sm:px-10 sm:py-12"
        style={{
          background: "linear-gradient(135deg, #53389e 0%, #6941c6 45%, #7f56d9 100%)",
        }}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.18]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.9) 1px, transparent 0)",
            backgroundSize: "22px 22px",
          }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-white/10 blur-2xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-24 left-1/3 h-56 w-56 rounded-full bg-[#f79009]/20 blur-3xl"
        />

        <div className="relative">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-white/15 px-3 py-1 text-[11px] font-semibold text-white backdrop-blur-sm">
            <Sparkles className="h-3.5 w-3.5" />
            Internship Readiness Path 2.0
          </span>

          <h1 className="mt-4 max-w-2xl font-display text-3xl font-bold leading-[1.15] tracking-tight text-white sm:text-4xl lg:text-[2.75rem]">
            Lock in. Level up. Get paid.
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-white/80 sm:text-base">
            Real assessments, real projects and real monthly stipends. One engineered path that
            takes you from fundamentals to your first paycheck.
          </p>

          <div className="mt-7 grid gap-3 sm:grid-cols-3 sm:gap-4">
            {STATS.map(({ icon: Icon, value, label }) => (
              <div
                key={label}
                className="rounded-xl border border-white/15 bg-white/10 px-4 py-3 backdrop-blur-sm"
              >
                <div className="flex items-center gap-2 text-white/70">
                  <Icon className="h-3.5 w-3.5" />
                  <span className="text-[11px] font-semibold uppercase tracking-wide">{label}</span>
                </div>
                <p className="mt-1.5 font-display text-xl font-bold tracking-tight text-white">
                  {value}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section>
        <SectionHeading
          eyebrow="The journey"
          title="Three levels. One path."
          description="Each level has an assessment, then post-assessment rounds you must clear to move forward."
        />

        <div className="grid gap-4 lg:grid-cols-3">
          {LEVELS.map((level, i) => {
            const Icon = level.icon;
            return (
              <IrpCard
                key={level.id}
                className="hover-lift animate-pop-in relative flex h-full flex-col overflow-hidden"
                style={{ animationDelay: `${i * 70}ms` }}
              >
                <div className="h-1 w-full" style={{ backgroundColor: level.accent }} />

                <div className="flex flex-1 flex-col p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
                      style={{ backgroundColor: level.accentSoft, color: level.accent }}
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                    <span
                      className="rounded-full px-2.5 py-1 text-[11px] font-semibold"
                      style={{ backgroundColor: level.accentSoft, color: level.accentText }}
                    >
                      {level.tagline}
                    </span>
                  </div>

                  <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#98a2b3]">
                    {level.step}
                  </p>
                  <h3 className="mt-0.5 font-display text-lg font-bold tracking-tight text-[#101828]">
                    {level.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-[#667085]">{level.summary}</p>

                  <div className="mt-5 space-y-4">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#98a2b3]">
                        Assessment
                      </p>
                      <ul className="mt-2 space-y-1.5">
                        {level.assessment.map((item) => (
                          <li key={item} className="flex gap-2 text-[13px] leading-relaxed text-[#344054]">
                            <span
                              className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full"
                              style={{ backgroundColor: level.accent }}
                            />
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#98a2b3]">
                        Post assessment
                      </p>
                      <ul className="mt-2 space-y-1.5">
                        {level.post.map((item) => (
                          <li key={item} className="flex gap-2 text-[13px] leading-relaxed text-[#344054]">
                            <CheckCircle2 className="mt-[2px] h-3.5 w-3.5 shrink-0 text-[#12b76a]" />
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  <div className="mt-auto pt-5">
                    <div className="flex items-center gap-2 rounded-lg border border-[#eaecf0] bg-[#f9fafb] px-3 py-2.5">
                      <Award className="h-4 w-4 shrink-0" style={{ color: level.accent }} />
                      <p className="text-[13px] font-semibold text-[#344054]">{level.outcome}</p>
                    </div>
                  </div>
                </div>
              </IrpCard>
            );
          })}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-5">
        <IrpCard className="relative overflow-hidden border-[#e9d7fe] p-6 lg:col-span-3">
          <div
            aria-hidden
            className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-[#f4ebff] blur-2xl"
          />
          <div className="relative">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#6941c6] text-white">
                <Zap className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#6941c6]">
                  Route 2
                </p>
                <h3 className="font-display text-lg font-bold tracking-tight text-[#101828]">
                  The Wildcard
                </h3>
              </div>
            </div>

            <p className="mt-4 text-sm leading-relaxed text-[#667085]">
              Think you are top 1%? Skip Level 1 and Level 2 and go straight for Infinite Aura — if
              you can clear all four eligibility gates.
            </p>

            <div className="mt-4 flex flex-wrap gap-2">
              {WILDCARD_GATES.map((gate) => (
                <span
                  key={gate}
                  className="inline-flex items-center gap-1.5 rounded-full border border-[#e9d7fe] bg-[#f9f5ff] px-3 py-1.5 text-xs font-semibold text-[#6941c6]"
                >
                  <Target className="h-3.5 w-3.5" />
                  {gate}
                </span>
              ))}
            </div>
          </div>
        </IrpCard>

        <IrpCard className="flex flex-col justify-center gap-4 p-6 lg:col-span-2">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#ecfdf3] text-[#039855]">
            <Rocket className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-display text-base font-bold tracking-tight text-[#101828]">
              After Level 2, you choose
            </h3>
            <p className="mt-1 text-sm leading-relaxed text-[#667085]">
              Take an internship offer worth ₹5K–₹15K a month, or keep pushing for Infinite Aura and
              ₹25K+ with mentorship from senior engineers.
            </p>
          </div>
          <div className="space-y-2">
            {["Take the internship", "Push for the top"].map((option) => (
              <div
                key={option}
                className="flex items-center justify-between rounded-lg border border-[#eaecf0] bg-[#f9fafb] px-3 py-2.5"
              >
                <span className="text-[13px] font-semibold text-[#344054]">{option}</span>
                <ArrowRight className="h-3.5 w-3.5 text-[#98a2b3]" />
              </div>
            ))}
          </div>
        </IrpCard>
      </section>

      <section>
        <SectionHeading
          eyebrow="Before you sit"
          title="Four moves, then you're ready."
          description="Work through these before your assessment date."
        />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {CHECKLIST.map(({ icon: Icon, title, detail }, i) => (
            <IrpCard key={title} className="hover-lift flex h-full flex-col p-5">
              <div className="flex items-center justify-between">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#f9f5ff] text-[#6941c6]">
                  <Icon className="h-4 w-4" />
                </div>
                <span className="font-display text-2xl font-bold tracking-tight text-[#eaecf0]">
                  0{i + 1}
                </span>
              </div>
              <h3 className="mt-4 text-sm font-semibold text-[#101828]">{title}</h3>
              <p className="mt-1.5 text-[13px] leading-relaxed text-[#667085]">{detail}</p>
            </IrpCard>
          ))}
        </div>
      </section>

      <section>
        <SectionHeading
          eyebrow="Questions"
          title="Everything you might be wondering."
        />
        <IrpCard className="px-5 py-2">
          <Accordion type="single" collapsible>
            {FAQ.map((item, i) => (
              <AccordionItem
                key={item.q}
                value={`faq-${i}`}
                className={i === FAQ.length - 1 ? "border-b-0" : "border-[#eaecf0]"}
              >
                <AccordionTrigger className="gap-4 text-left text-sm font-semibold text-[#101828] hover:no-underline">
                  {item.q}
                </AccordionTrigger>
                <AccordionContent className="pr-8 text-[13px] leading-relaxed text-[#667085]">
                  {item.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </IrpCard>
      </section>
    </div>
  );
}
