import { useState } from "react";
import { ArrowUpRight, MessageCircleQuestion } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { FAQ_TOPICS, type FaqBlock } from "@/lib/faqs";

function AnswerBlock({ block }: { block: FaqBlock }) {
  if (block.type === "ul") {
    return (
      <ul className="list-disc space-y-1 pl-5">
        {block.items.map((item) => <li key={item}>{item}</li>)}
      </ul>
    );
  }
  if (block.type === "ol") {
    return (
      <ol className="list-decimal space-y-1 pl-5">
        {block.items.map((item) => <li key={item}>{item}</li>)}
      </ol>
    );
  }
  if (block.type === "link") {
    return (
      <p>
        {block.label}:{" "}
        <a
          href={block.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-0.5 font-semibold text-[#6941c6] underline-offset-2 hover:underline"
        >
          {block.url}
          <ArrowUpRight className="h-3.5 w-3.5" />
        </a>
      </p>
    );
  }
  return <p>{block.text}</p>;
}

export function Faqs() {
  const [topicId, setTopicId] = useState(FAQ_TOPICS[0]?.id ?? "");
  const topic = FAQ_TOPICS.find((t) => t.id === topicId) ?? FAQ_TOPICS[0];

  return (
    <div className="space-y-6">
      <div>
        <p className="flex items-center gap-2 text-[11px] font-bold tracking-[0.08em] text-[#6941c6]">
          <span className="h-1.5 w-1.5 rounded-full bg-[#6941c6]" aria-hidden />
          NXTWAVE · PLACEMENT SUPPORT
        </p>
        <h1 className="mt-2 font-display text-2xl font-extrabold tracking-tight text-[#101828] sm:text-[28px]">
          Placement Eligibility FAQs
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-[#667085]">
          Pick a topic, then open the question you want answered.
        </p>
      </div>

      <div className="flex flex-wrap gap-2" role="tablist" aria-label="FAQ topics">
        {FAQ_TOPICS.map((t) => {
          const active = t.id === topic?.id;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setTopicId(t.id)}
              className={
                active
                  ? "rounded-full bg-[#101828] px-3.5 py-1.5 text-sm font-semibold text-white"
                  : "rounded-full border border-[#eaecf0] bg-white px-3.5 py-1.5 text-sm font-semibold text-[#344054] hover:bg-[#f9fafb]"
              }
              data-testid={`faq-topic-${t.id}`}
            >
              {t.label}
              <span className={`ml-1.5 text-xs ${active ? "text-white/70" : "text-[#98a2b3]"}`}>{t.items.length}</span>
            </button>
          );
        })}
      </div>

      {topic ? (
        <section className="rounded-2xl border border-[#eaecf0] bg-white px-5 py-2" data-testid="faq-list">
          {/* key resets open questions when the topic changes */}
          <Accordion key={topic.id} type="single" collapsible>
            {topic.items.map((item, i) => (
              <AccordionItem
                key={item.q}
                value={`faq-${i}`}
                className={i === topic.items.length - 1 ? "border-b-0" : "border-[#eaecf0]"}
              >
                <AccordionTrigger className="gap-4 text-left text-sm font-semibold text-[#101828] hover:no-underline">
                  {item.q}
                </AccordionTrigger>
                <AccordionContent className="space-y-2.5 pr-8 text-[13px] leading-relaxed text-[#475467]">
                  {item.a.map((block, j) => <AnswerBlock key={j} block={block} />)}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </section>
      ) : null}

      <div className="flex items-start gap-3 rounded-2xl border border-[#e9d7fe] bg-[#f9f5ff] px-5 py-4">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-[#6941c6]">
          <MessageCircleQuestion className="h-4 w-4" />
        </span>
        <div>
          <p className="text-sm font-bold text-[#101828]">Still have doubts?</p>
          <p className="mt-0.5 text-sm text-[#475467]">Reach out to the NxtWave placement team for more information.</p>
        </div>
      </div>
    </div>
  );
}
