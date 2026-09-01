import {
  GENAI_TRAINING_LIVE_URL,
  GENAI_TRAINING_POPUP_BODY,
  GENAI_TRAINING_POPUP_CTA_LABEL,
  GENAI_TRAINING_POPUP_FOOTER,
  GENAI_TRAINING_POPUP_SCHEDULE,
  GENAI_TRAINING_POPUP_TIME,
  GENAI_TRAINING_POPUP_TITLE,
  GENAI_TRAINING_POPUP_VERSION,
} from "@/lib/genAiTrainingConfig";
import { getAuthToken } from "@/lib/authToken";
import { useQuery } from "@tanstack/react-query";

export type GenAiTrainingPopupConfig = {
  enabled: boolean;
  version: string;
  title: string;
  body: string;
  schedule: string;
  time: string;
  footer: string;
  ctaLabel: string;
  liveUrl: string;
  updatedAt: string | null;
};

export const GENAI_TRAINING_POPUP_FALLBACK: GenAiTrainingPopupConfig = {
  enabled: false,
  version: GENAI_TRAINING_POPUP_VERSION,
  title: GENAI_TRAINING_POPUP_TITLE,
  body: GENAI_TRAINING_POPUP_BODY,
  schedule: GENAI_TRAINING_POPUP_SCHEDULE,
  time: GENAI_TRAINING_POPUP_TIME,
  footer: GENAI_TRAINING_POPUP_FOOTER,
  ctaLabel: GENAI_TRAINING_POPUP_CTA_LABEL,
  liveUrl: GENAI_TRAINING_LIVE_URL,
  updatedAt: null,
};

const QUERY_KEY = ["student", "genai-training-popup"] as const;

async function fetchGenAiTrainingPopup(): Promise<GenAiTrainingPopupConfig> {
  const token = getAuthToken();
  const res = await fetch("/api/student/genai-training-popup", {
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
  });
  if (!res.ok) {
    throw new Error("Could not load GenAI training pop-up");
  }
  const data = (await res.json()) as Partial<GenAiTrainingPopupConfig>;
  return {
    enabled: data.enabled ?? false,
    version: data.version ?? GENAI_TRAINING_POPUP_FALLBACK.version,
    title: data.title ?? GENAI_TRAINING_POPUP_FALLBACK.title,
    body: data.body ?? GENAI_TRAINING_POPUP_FALLBACK.body,
    schedule: data.schedule ?? GENAI_TRAINING_POPUP_FALLBACK.schedule,
    time: data.time ?? GENAI_TRAINING_POPUP_FALLBACK.time,
    footer: data.footer ?? GENAI_TRAINING_POPUP_FALLBACK.footer,
    ctaLabel: data.ctaLabel ?? GENAI_TRAINING_POPUP_FALLBACK.ctaLabel,
    liveUrl: data.liveUrl ?? GENAI_TRAINING_POPUP_FALLBACK.liveUrl,
    updatedAt: data.updatedAt ?? null,
  };
}

export function useGenAiTrainingConfig() {
  const query = useQuery({
    queryKey: QUERY_KEY,
    queryFn: fetchGenAiTrainingPopup,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
    retry: 1,
  });

  return {
    config: query.data ?? GENAI_TRAINING_POPUP_FALLBACK,
    loading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}
