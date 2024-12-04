import * as React from "react";
import { createRoot } from "react-dom/client";
import { Switch, Route } from "wouter";
import "./index.css";
import { ErrorBoundary } from './components/ErrorBoundary';
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import DAWApp from "./pages/DAWApp";

const App = () => {
  return (
    <React.StrictMode>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <Switch>
            <Route path="/">
              <DAWApp />
            </Route>
            <Route>404 - Game Over!</Route>
          </Switch>
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
