import type { LucideIcon } from "lucide-react";
import {
  Award,
  Braces,
  Blocks,
  BookOpenCheck,
  Check,
  Building2,
  CalendarCheck,
  CheckCircle2,
  Code2,
  Crown,
  FileQuestion,
  Gauge,
  GraduationCap,
  Layers,
  Sparkles,
  Target,
  Timer,
  TrendingUp,
  UserRound,
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
  assessmentLabel?: string;
  postLabel?: string;
};

type Track = "mern" | "genai";

const GENAI_STAGES: Level[] = [
  {
    id: "G1",
    step: "Stage 1",
    title: "GenAI Assessments",
    tagline: "Mock + Main",
    icon: FileQuestion,
    accent: "#175cd3",
    accentSoft: "#eff8ff",
    accentText: "#175cd3",
    summary: "Show your skills and potential through GenAI.",
    assessment: ["MCQ section · 30 marks", "Coding section · 50 marks", "Attempt the mock first, then the main assessment"],
    postLabel: "To move on",
    post: ["Clear the qualifying marks in both MCQ and coding"],
    outcome: "Qualify to unlock the GenAI project",
  },
  {
    id: "G2",
    step: "Stage 2",
    title: "Project Submission",
    tagline: "Kaggle",
    icon: Braces,
    accent: "#7f56d9",
    accentSoft: "#f4f3ff",
    accentText: "#6941c6",
    summary: "Build RAG projects on Kaggle and walk us through one of them.",
    assessmentLabel: "Choose any 2",
    assessment: ["Intelligent RAG Challenge", "Agentic RAG Challenge", "Building & Optimizing RAG Challenge"],
    postLabel: "Then submit",
    post: ["Loom video walkthrough for one of your 2 projects"],
    outcome: "Your project is evaluated before the interview",
  },
  {
    id: "G3",
    step: "Stage 3",
    title: "Human Interview",
    tagline: "Final round",
    icon: UserRound,
    accent: "#039855",
    accentSoft: "#ecfdf3",
    accentText: "#067647",
    summary: "Opens after your GenAI project is evaluated.",
    assessmentLabel: "Before your interview",
    assessment: [
      "Book your slot from the Interview Slot Selection email",
      "Follow the Pre-Interview Checklist",
      "Complete the Self-Declaration with the panelist",
    ],
    post: [],
    outcome: "Integrity Score is part of your evaluation",
  },
];

type TrackInfo = {
  id: Track;
  name: string;
  tagline: string;
  count: string;
  icon: LucideIcon;
  headerBg: string;
  border: string;
  steps: Level[];
};

function TrackPanel({ track }: { track: TrackInfo }) {
  const TrackIcon = track.icon;
  return (
    <div
      className="animate-pop-in overflow-hidden rounded-2xl border bg-white shadow-[0_8px_30px_rgba(16,24,40,0.05)]"
      style={{ borderColor: track.border }}
      data-testid={`home-track-${track.id}`}
    >
      <div className="relative overflow-hidden px-5 py-5 text-white sm:px-6" style={{ background: track.headerBg }}>
        <div aria-hidden className="pointer-events-none absolute -right-10 -top-12 h-36 w-36 rounded-full bg-white/10" />
        <div aria-hidden className="pointer-events-none absolute -bottom-16 right-16 h-28 w-28 rounded-full bg-white/5" />
        <div className="relative flex items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/15 backdrop-blur-sm">
            <TrackIcon className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="font-display text-xl font-bold tracking-tight">{track.name}</h3>
            <p className="text-sm text-white/80">{track.tagline}</p>
          </div>
          <span className="shrink-0 rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-semibold">{track.count}</span>
        </div>
      </div>

      <ol className="bg-[#f9fafb] px-4 py-4 sm:px-5 sm:py-5">
        {track.steps.map((step, index) => {
          const Icon = step.icon;
          const last = index === track.steps.length - 1;
          return (
            <li key={step.id}>
              <article
                className="hover-lift overflow-hidden rounded-xl border border-[#eaecf0] bg-white shadow-[0_1px_3px_rgba(16,24,40,0.06)]"
                data-testid={`home-step-${step.id}`}
              >
                <div className="h-1 w-full" style={{ backgroundColor: step.accent }} />
                <div className="p-4 sm:p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                      style={{ backgroundColor: step.accentSoft, color: step.accent }}
                    >
                      <Icon className="h-5 w-5" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#98a2b3]">{step.step}</p>
                      <h4 className="font-display text-base font-bold tracking-tight text-[#101828]">{step.title}</h4>
                    </div>
                  </div>
                  <span
                    className="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold"
                    style={{ backgroundColor: step.accentSoft, color: step.accentText }}
                  >
                    {step.tagline}
                  </span>
                </div>
                <p className="mt-3 text-sm leading-relaxed text-[#667085]">{step.summary}</p>

                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#98a2b3]">
                      {step.assessmentLabel ?? "Assessment"}
                    </p>
                    <ul className="mt-1.5 space-y-1">
                      {step.assessment.map((item) => (
                        <li key={item} className="flex gap-2 text-[13px] leading-snug text-[#344054]">
                          <span className="mt-[6px] h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: step.accent }} />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                  {step.post.length > 0 ? (
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#98a2b3]">
                        {step.postLabel ?? "Post assessment"}
                      </p>
                      <ul className="mt-1.5 space-y-1">
                        {step.post.map((item) => (
                          <li key={item} className="flex gap-2 text-[13px] leading-snug text-[#344054]">
                            <CheckCircle2 className="mt-[1px] h-3.5 w-3.5 shrink-0 text-[#12b76a]" />
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>

                <p className="mt-4 flex items-center gap-1.5 rounded-lg border border-[#eaecf0] bg-[#f9fafb] px-3 py-2 text-xs font-semibold text-[#344054]">
                  <Award className="h-3.5 w-3.5 shrink-0" style={{ color: step.accent }} />
                  {step.outcome}
                </p>
                </div>
              </article>
              {!last ? (
                <div aria-hidden className="flex justify-center py-1.5">
                  <span className="h-5 w-0 border-l-2 border-dashed border-[#d0d5dd]" />
                </div>
              ) : null}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

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
      "L1 Online Assessment · MCQ + coding · 120 min",
      "MCQ — HTML & CSS, JavaScript, React · 30 questions",
    ],
    post: [
      "FE project · 12 hours",
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

const TRACKS: Record<Track, TrackInfo> = {
  mern: {
    id: "mern",
    name: "MERN Track",
    tagline: "Build your industry readiness through IRP.",
    count: "3 levels",
    icon: Target,
    headerBg: "linear-gradient(135deg, #054f31 0%, #039855 100%)",
    border: "#abefc6",
    steps: LEVELS,
  },
  genai: {
    id: "genai",
    name: "GenAI Track",
    tagline: "Show your skills and potential through GenAI.",
    count: "3 stages",
    icon: Sparkles,
    headerBg: "linear-gradient(135deg, #2d31a6 0%, #6941c6 100%)",
    border: "#c7d7fe",
    steps: GENAI_STAGES,
  },
};

const STATS: { icon: LucideIcon; value: string; label: string }[] = [
  { icon: Layers, value: "MERN, GenAI", label: "Two tracks, one goal" },
  { icon: TrendingUp, value: "₹5K–₹25K+", label: "Monthly stipend range" },
  { icon: Building2, value: "Real teams", label: "Not a simulation" },
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

const L1_ASSESSMENT_SECTIONS = [
  {
    id: "mcq",
    label: "Section 1",
    title: "MCQ / Theory",
    icon: FileQuestion,
    accent: "#6941c6",
    accentSoft: "#f9f5ff",
    timing: "30 minutes",
    summary: "Easy-level frontend fundamentals across three equal topic blocks.",
    facts: [
      "30 questions total",
      "10 HTML & CSS questions",
      "10 JavaScript questions",
      "10 React questions",
    ],
  },
  {
    id: "coding",
    label: "Section 2",
    title: "JavaScript Coding",
    icon: Braces,
    accent: "#039855",
    accentSoft: "#ecfdf3",
    timing: "90 minutes",
    summary: "Easy-level JavaScript problems from the Grit UI Main coding source.",
    facts: [
      "Topic: JS Coding",
      "Sub-topic: JS Coding",
      "Question Library: My Questions",
      "One question per configured pool row",
    ],
  },
] as const;

const FAQ = [
  {
    q: "Who is IRP for?",
    a: "IRP (Internship Readiness Program) is built for YOG 2028 and 2029 students who want a structured path from assessments to a paid internship.",
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
        className="animate-pop-in relative overflow-hidden rounded-2xl"
        style={{ background: "linear-gradient(135deg, #53389e 0%, #6941c6 45%, #7f56d9 100%)" }}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.18]"
          style={{
            backgroundImage: "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.9) 1px, transparent 0)",
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

        <div className="relative px-6 py-8 sm:px-10 sm:py-12">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-white/15 px-3 py-1 text-[11px] font-semibold text-white backdrop-blur-sm">
            <Sparkles className="h-3.5 w-3.5" />
            IRP - Internship Readiness Program
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
          title="Two tracks. One goal."
          description="Pick your path. Both lead to internship readiness."
        />

        <div className="relative grid gap-4 lg:grid-cols-2 lg:gap-8">
          <TrackPanel track={TRACKS.mern} />
          <div
            aria-hidden
            className="pointer-events-none absolute left-1/2 top-10 z-10 hidden -translate-x-1/2 flex-col items-center lg:flex"
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-full border-4 border-[#f9fafb] bg-[#101828] text-white shadow-lg">
              <GraduationCap className="h-5 w-5" />
            </span>
            <span className="mt-1.5 rounded-full bg-[#101828] px-2 py-0.5 text-[10px] font-bold tracking-wide text-white">
              IRP
            </span>
          </div>
          <TrackPanel track={TRACKS.genai} />
        </div>
      </section>

      <section>
        <SectionHeading
          eyebrow="L1 online assessment"
          title="Know the pattern before you sit."
          description="Two focused sections test frontend fundamentals and practical JavaScript problem-solving."
        />

        <div className="grid gap-4 lg:grid-cols-5">
          {L1_ASSESSMENT_SECTIONS.map((section) => {
            const Icon = section.icon;
            return (
              <IrpCard
                key={section.id}
                className="relative overflow-hidden p-5 sm:p-6 lg:col-span-2"
              >
                <div className="flex items-start justify-between gap-4">
                  <div
                    className="flex h-11 w-11 items-center justify-center rounded-xl"
                    style={{ backgroundColor: section.accentSoft, color: section.accent }}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold"
                    style={{ backgroundColor: section.accentSoft, color: section.accent }}
                  >
                    <Timer className="h-3.5 w-3.5" />
                    {section.timing}
                  </div>
                </div>

                <p
                  className="mt-5 text-[11px] font-semibold uppercase tracking-[0.12em]"
                  style={{ color: section.accent }}
                >
                  {section.label}
                </p>
                <h3 className="mt-1 font-display text-xl font-bold tracking-tight text-[#101828]">
                  {section.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-[#667085]">{section.summary}</p>

                <ul className="mt-5 space-y-2.5">
                  {section.facts.map((fact) => (
                    <li key={fact} className="flex items-start gap-2.5 text-[13px] leading-relaxed text-[#344054]">
                      <Check className="mt-0.5 h-4 w-4 shrink-0" style={{ color: section.accent }} />
                      <span>{fact}</span>
                    </li>
                  ))}
                </ul>

              </IrpCard>
            );
          })}

          <IrpCard className="border-[#fedf89] bg-[#fffcf5] p-5 sm:p-6 lg:col-span-1">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#fffaeb] text-[#dc6803]">
              <Gauge className="h-5 w-5" />
            </div>
            <p className="mt-5 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#b54708]">
              What changed
            </p>
            <h3 className="mt-1 font-display text-lg font-bold tracking-tight text-[#101828]">
              Frontend-first
            </h3>
            <div className="mt-4 space-y-3 text-[13px] leading-relaxed">
              <div>
                <p className="font-semibold text-[#98a2b3]">Previously</p>
                <p className="mt-0.5 text-[#667085]">Python coding and no dedicated JavaScript MCQ block.</p>
              </div>
              <div className="h-px bg-[#f2d49b]" />
              <div>
                <p className="font-semibold text-[#b54708]">Now</p>
                <p className="mt-0.5 text-[#475467]">JavaScript joins the MCQs, and coding is JavaScript-only.</p>
              </div>
            </div>
          </IrpCard>
        </div>
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
