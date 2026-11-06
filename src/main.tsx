import React from "react";
import { createRoot } from "react-dom/client";
import { AudioSpikePage } from "./pages/AudioSpikePage";
import { App } from "./App";
import "./style.css";
import "./styles/redesign.css";
import "./styles/motion.css";
import "./styles/v14.css";
import "./styles/v15.css";
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {location.pathname === "/spike" || location.search.includes("spike") ? (
      <AudioSpikePage />
    ) : (
      <App />
    )}
  </React.StrictMode>,
);
