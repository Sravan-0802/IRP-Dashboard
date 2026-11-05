import { useEffect } from "react";
import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useGetStudent, getGetStudentQueryKey } from "@workspace/api-client-react";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Dashboard from "./pages/Dashboard";
import { ReferBanner } from "@/components/irp/ReferBanner";
import Analytics from "./pages/Analytics";
import Onboarding from "./pages/Onboarding";
import NotEnrolled from "./pages/NotEnrolled";
import PaymentRequired from "./pages/PaymentRequired";
import NotFound from "@/pages/not-found";
import { redirectToLogin, shouldRequireSsoLogin } from "@/lib/authToken";
import { useJourney, ApiError } from "@/lib/useJourney";
import { useDashboardAccess } from "@/lib/usePaymentStatus";

const queryClient = new QueryClient();

function isNotEnrolled(error: unknown): boolean {
  const e = error as { status?: number; data?: { code?: string } } | null;
  return e?.status === 404 && e?.data?.code === "NOT_ENROLLED";
}

function isUnauthorized(error: unknown): boolean {
  const e = error as { status?: number } | null;
  return e?.status === 401;
}

function Home() {
  const { access, error: accessError, loading: accessLoading } = useDashboardAccess();
  const { data: journey, isLoading, isError: journeyError, error: journeyErr } = useJourney();
  const { error: studentError } = useGetStudent({
    query: { queryKey: getGetStudentQueryKey(), retry: false },
  });

  useEffect(() => {
    if (isUnauthorized(studentError) && shouldRequireSsoLogin()) {
      redirectToLogin();
    }
  }, [studentError]);

  if (isUnauthorized(studentError) && shouldRequireSsoLogin()) {
    return (
      <div className="flex h-[100dvh] items-center justify-center">
        <p className="text-sm font-semibold text-muted2">Redirecting to login…</p>
      </div>
    );
  }

  // Verify the three dashboard access statuses before loading student content.
  if (accessLoading) {
    return (
      <div className="flex h-[100dvh] items-center justify-center">
        <p className="text-sm font-semibold text-muted2">Loading…</p>
      </div>
    );
  }

  if (accessError) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center p-6">
        <div className="max-w-md rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center">
          <p className="font-display text-lg font-extrabold text-ink">Could not verify dashboard access</p>
          <p className="mt-2 text-sm text-muted2">We couldn't fetch your latest access statuses. Refresh to retry. Your access has not been verified.</p>
          <button type="button" onClick={() => window.location.reload()} className="btn-pop mt-5 rounded-xl px-5 py-2.5 text-sm font-bold">
            Refresh dashboard
          </button>
        </div>
      </div>
    );
  }

  if (!access?.allowed) {
    return <PaymentRequired />;
  }

  // SSO user whose id isn't in our academy list — show a dedicated screen.
  if (isNotEnrolled(studentError)) {
    return <NotEnrolled />;
  }

  if (journeyError) {
    const requestId = journeyErr instanceof ApiError ? journeyErr.requestId : null;
    return (
      <div className="flex min-h-[100dvh] items-center justify-center p-6">
        <div className="max-w-md rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
          <p className="font-display text-lg font-extrabold text-ink">Could not load dashboard</p>
          <p className="mt-2 text-sm text-muted2">
            Something went wrong loading your journey. Please refresh. If it keeps happening,
            share the reference below with support.
          </p>
          {requestId ? (
            <p className="mt-4 break-all rounded-lg bg-white/80 px-3 py-2 font-mono text-[11px] text-ink">
              Ref: {requestId}
            </p>
          ) : null}
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex h-[100dvh] items-center justify-center">
        <p className="text-sm font-semibold text-muted2">Loading…</p>
      </div>
    );
  }

  if (journey && !journey.hasCompletedOnboarding) {
    return <Onboarding />;
  }

  return <Dashboard />;
}

function ReferBannerPreview() {
  return (
    <div className="min-h-[100dvh] bg-[#f9fafb]">
      <div className="flex min-h-[100dvh]">
        <aside className="hidden w-[232px] shrink-0 border-r border-[#eaecf0] bg-white p-4 md:block">
          <p className="font-display text-base font-extrabold text-ink">IRP 2.0</p>
          <p className="mt-6 text-sm font-semibold text-[#6941c6]">IRP MERN Track</p>
          <p className="mt-2 text-sm text-[#667085]">GenAI Track</p>
        </aside>
        <div className="min-w-0 flex-1">
          <header className="border-b border-[#eaecf0] px-4 py-3 md:hidden">
            <span className="font-display text-base font-extrabold text-ink">IRP 2.0</span>
          </header>
          <ReferBanner onInvite={() => undefined} onDismiss={() => undefined} />
          <div className="p-4 sm:p-6 lg:p-8">
            <h1 className="font-display text-2xl font-extrabold text-ink">Welcome back</h1>
            <p className="mt-1 text-sm text-[#667085]">Referral bar preview — Invite opens the academy referral link.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Router() {
  return (
    <Switch>
      {import.meta.env.DEV ? (
        <Route path="/refer-preview">
          <ReferBannerPreview />
        </Route>
      ) : null}
      <Route path="/analytics">
        <Analytics />
      </Route>
      <Route path="/genai-program">
        <Home />
      </Route>
      <Route path="/assessments-hub">
        <Home />
      </Route>
      <Route path="/assessment-calendar">
        <Home />
      </Route>
      <Route path="/guideline-docs">
        <Home />
      </Route>
      <Route path="/noc-form">
        <Home />
      </Route>
      <Route path="/about">
        <Home />
      </Route>
      <Route path="/">
        <Home />
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
