import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Dashboard from "./pages/Dashboard";
import Onboarding from "./pages/Onboarding";
import NotFound from "@/pages/not-found";
import { useJourney } from "@/lib/useJourney";

const queryClient = new QueryClient();

function Home() {
  const { data: journey, isLoading } = useJourney();

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
      <Route path="/" component={Home} />
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
