import { useEffect } from "react";
import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useGetStudent, getGetStudentQueryKey } from "@workspace/api-client-react";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Dashboard from "./pages/Dashboard";
import Analytics from "./pages/Analytics";
import Onboarding from "./pages/Onboarding";
import NotEnrolled from "./pages/NotEnrolled";
import PaymentRequired from "./pages/PaymentRequired";
import NotFound from "@/pages/not-found";
import { redirectToLogin, shouldRequireSsoLogin } from "@/lib/authToken";
import { useJourney, ApiError } from "@/lib/useJourney";
import { usePaymentStatus } from "@/lib/usePaymentStatus";

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
  const { paid, loading: paymentLoading } = usePaymentStatus();
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

  // Payment gate takes priority over everything else: unpaid users see a
  // "complete your payment" prompt instead of the dashboard.
  if (paymentLoading) {
    return (
      <div className="flex h-[100dvh] items-center justify-center">
        <p className="text-sm font-semibold text-muted2">Loading…</p>
      </div>
    );
  }

  if (!paid) {
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

function Router() {
  return (
    <Switch>
      <Route path="/analytics">
        <Analytics />
      </Route>
      <Route path="/assessments-hub">
        <Home />
      </Route>
      <Route path="/assessment-calendar">
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
