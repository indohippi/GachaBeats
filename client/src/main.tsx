import * as React from "react";
import { createRoot } from "react-dom/client";
import { Switch, Route } from "wouter";
import "./index.css";
import { ErrorBoundary } from './components/ErrorBoundary';
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import DAWApp from "./pages/DAWApp";
import GachaApp from "./pages/GachaApp";
import CoinsPage from "./pages/CoinsPage";
import AppNavigation from "./components/AppNavigation";

// App Layout with Navigation
const AppLayout = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="app-container h-screen flex flex-col bg-[--gba-darker]">
      <AppNavigation />
      <main className="flex-1 overflow-hidden">
        {children}
      </main>
    </div>
  );
};

const App = () => {
  return (
    <React.StrictMode>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <AppLayout>
            <Switch>
              <Route path="/">
                <DAWApp />
              </Route>
              <Route path="/gacha">
                <GachaApp />
              </Route>
              <Route path="/coins">
                <CoinsPage />
              </Route>
              <Route path="/collection">
                <div className="h-full flex items-center justify-center text-white">
                  <h2 className="text-2xl">Sound Collection Coming Soon</h2>
                </div>
              </Route>
              <Route path="/help">
                <div className="h-full flex items-center justify-center text-white">
                  <h2 className="text-2xl">Help & Tutorial Coming Soon</h2>
                </div>
              </Route>
              <Route>
                <div className="h-full flex items-center justify-center text-white">
                  <h2 className="text-2xl">404 - Game Over!</h2>
                </div>
              </Route>
            </Switch>
          </AppLayout>
          <Toaster />
        </QueryClientProvider>
      </ErrorBoundary>
    </React.StrictMode>
  );
};

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("Failed to find the root element");

const root = createRoot(rootElement);
root.render(<App />);
