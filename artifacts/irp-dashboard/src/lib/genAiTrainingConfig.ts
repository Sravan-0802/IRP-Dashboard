/** Bump to re-show the pop-up after copy or campaign updates. */
export const GENAI_TRAINING_POPUP_VERSION = "2026-09";

export const GENAI_TRAINING_POPUP_TITLE = "🚀 GenAI Training for Internships × IRP";

export const GENAI_TRAINING_POPUP_BODY =
  "Join our live GenAI sessions designed to help you build industry-ready AI skills for internships.";

export const GENAI_TRAINING_POPUP_SCHEDULE = "📅 Monday • Wednesday • Friday";

export const GENAI_TRAINING_POPUP_TIME = "🕖 7:00 PM – 9:00 PM";

export const GENAI_TRAINING_POPUP_FOOTER = "Don't miss out!";

export const GENAI_TRAINING_POPUP_CTA_LABEL = "Join Now / Watch Live";

/** Live session URL — set `VITE_GENAI_TRAINING_LIVE_URL` in env for production. */
export const GENAI_TRAINING_LIVE_URL =
  import.meta.env.VITE_GENAI_TRAINING_LIVE_URL?.trim() ||
  "https://meetings.ccbp.in/mid/irp-genai-training";
