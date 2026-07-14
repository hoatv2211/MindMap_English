import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./styles/tokens.css";
import "./styles/global.css";
import "./styles/auth.css";
import "./styles/layout.css";
import "./styles/mindmap.css";
import "./styles/learning.css";
import "./styles/agent.css";
import "./styles/dictionary.css";
import "./styles/practice.css";
import "./styles/practice-complete.css";
import "./styles/reader.css";
import "./styles/reader-controls.css";
import "./styles/extraction.css";

createRoot(document.getElementById("root")!).render(<StrictMode><App/></StrictMode>);


