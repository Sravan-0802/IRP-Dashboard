import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useGetStudent, getGetStudentQueryKey } from "@workspace/api-client-react";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Dashboard from "./pages/Dashboard";
import Onboarding from "./pages/Onboarding";
import NotEnrolled from "./pages/NotEnrolled";
import NotFound from "@/pages/not-found";
import { useJourney } from "@/lib/useJourney";
import { hasAuthToken, redirectToLogin } from "@/lib/authToken";

const queryClient = new QueryClient();

function isNotEnrolled(error: unknown): boolean {
  const e = error as { status?: number; data?: { code?: string } } | null;
  return e?.status === 404 && e?.data?.code === "NOT_ENROLLED";
}

function isUnauthorized(error: unknown): boolean {
  return (error as { status?: number } | null)?.status === 401;
}

function RedirectingToLogin() {
  return (
    <div className="flex h-[100dvh] items-center justify-center">
      <p className="text-sm font-semibold text-muted2">Redirecting to login…</p>
    </div>
  );
}

function AuthGate({ children }: { children: React.ReactNode }) {
  if (import.meta.env.PROD && !hasAuthToken()) {
    redirectToLogin();
    return <RedirectingToLogin />;
  }
  return <>{children}</>;
}

function Home() {
  const { data: journey, isLoading, error: journeyError } = useJourney();
  const { error: studentError } = useGetStudent({
    query: { queryKey: getGetStudentQueryKey(), retry: false },
  });

  // Expired or missing token on the server → back to login.
  if (import.meta.env.PROD && (isUnauthorized(studentError) || isUnauthorized(journeyError))) {
    redirectToLogin();
    return <RedirectingToLogin />;
  }

  // SSO user whose id isn't in our academy list — show a dedicated screen.
  if (isNotEnrolled(studentError)) {
    const userId = (studentError as { data?: { userId?: string } } | null)?.data?.userId;
    return <NotEnrolled userId={userId} />;
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
      <Route path="/">
        <AuthGate>
          <Home />
        </AuthGate>
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
