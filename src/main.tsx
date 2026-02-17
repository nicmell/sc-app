import React from "react";
import ReactDOM from "react-dom/client";
import "@/App.scss";
import App from "@/App";
import scElements from "@/sc-elements";

for (const [name, component] of Object.entries(scElements)) {
  customElements.define(name, component);
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
