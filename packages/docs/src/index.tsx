import { createRoot } from "react-dom/client";
import { App } from "./App";

import "./index.css";
import "highlight.js/styles/atom-one-dark.css";
import "github-markdown-css/github-markdown.css";

const root = document.getElementById("root");
if (root) createRoot(root).render(<App />);
