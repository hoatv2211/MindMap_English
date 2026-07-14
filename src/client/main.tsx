import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./styles/tokens.css";
import "./styles/global.css";
import "./styles/layout.css";
import "./styles/mindmap.css";
import "./styles/learning.css";
import "./styles/agent.css";

createRoot(document.getElementById("root")!).render(<StrictMode><App/></StrictMode>);

