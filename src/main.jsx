import { consumeEmailLinkResult } from './utils/emailConfirmation.js';
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles.css";
import "./preview-design.css";
import "./accessibility.css";

const emailNotice = consumeEmailLinkResult(window);
createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App emailNotice={emailNotice} />
  </StrictMode>,
);

import "./dashboard.css";
import "./nepholio-refresh.css";
