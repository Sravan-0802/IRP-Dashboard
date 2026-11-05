import { useState } from "react";
import { ArrowUpRight, X } from "lucide-react";

const SESSION_KEY = "irp-refer-banner-hidden";

/** NxtWave Invite & Earn — academy referral nudge. */
export const IRP_REFER_INVITE_URL =
  "https://nxtrewards.ccbp.in/invite-and-earn?source_program=academy&utm_source=learning-portal-academy&utm_title=onboarding&utm_campaign=referral-nudge";

export function isReferBannerHiddenThisSession(): boolean {
  try {
    return sessionStorage.getItem(SESSION_KEY) === "1";
  } catch {
    return false;
  }
}

export function hideReferBannerForSession(): void {
  try {
    sessionStorage.setItem(SESSION_KEY, "1");
  } catch {
    /* private mode */
  }
}

/**
 * One hide flag for IRP MERN and GenAI in this browser session.
 * Next session (new tab session) the bar shows again, even after Invite or dismiss.
 */
export function useReferBanner() {
  const [hidden, setHidden] = useState(isReferBannerHiddenThisSession);

  function hideForSession() {
    hideReferBannerForSession();
    setHidden(true);
  }

  return { hidden, hideForSession };
}

export function ReferBanner({
  onInvite,
  onDismiss,
}: {
  onInvite: () => void;
  onDismiss: () => void;
}) {
  return (
    <div
      className="relative flex h-12 items-center justify-center bg-[#1E40AF] px-10 text-white"
      role="region"
      aria-label="Referral offer"
    >
      <div className="flex items-center justify-center gap-2">
        <img
          src={`${import.meta.env.BASE_URL}refer-gift.png`}
          alt=""
          width={20}
          height={20}
          className="h-5 w-5 shrink-0 object-contain"
        />
        <p className="font-[Inter] text-[14px] font-medium leading-5 text-white">
          Help a friend get here too. Earn up to ₹8,000 when they join
        </p>
        <a
          href={IRP_REFER_INVITE_URL}
          target="_blank"
          rel="noopener noreferrer"
          onClick={onInvite}
          className="ml-1.5 inline-flex items-center gap-0.5 font-[Inter] text-[14px] font-medium leading-5 text-white underline decoration-white underline-offset-2"
        >
          Invite
          <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
        </a>
      </div>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss referral"
        className="absolute right-5 top-1/2 -translate-y-1/2 rounded p-0.5 text-white hover:bg-white/10"
      >
        <X className="h-4 w-4" strokeWidth={1.75} />
      </button>
    </div>
  );
}
