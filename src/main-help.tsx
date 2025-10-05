import React from "react"
import ReactDOM from "react-dom/client"
import { HelpApp } from "./help/HelpApp"

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <HelpApp />
  </React.StrictMode>
)
