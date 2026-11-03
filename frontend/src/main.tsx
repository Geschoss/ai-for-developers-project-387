import "@mantine/core/styles.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { App } from "./app/App";

const root = document.querySelector("#root");
// oxlint-disable-next-line unicorn/no-null -- querySelector returns null when the element is missing
if (root === null) {
  throw new Error("Root element #root is missing");
}

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
