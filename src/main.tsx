import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ErrorBoundary } from "@/components/ErrorBoundary";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <TooltipProvider delayDuration={250}>
        <App />
      </TooltipProvider>
    </ErrorBoundary>
  </React.StrictMode>
);
