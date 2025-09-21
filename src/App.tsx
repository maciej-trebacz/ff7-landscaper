import { Navbar } from "./components/layout/Navbar";
import { StatusBar } from "./components/layout/StatusBar";
import { TabContent } from "./components/tabs/TabContent";
import { Tabs } from "@/components/ui/tabs";
import { StatusBarProvider } from "./hooks/useStatusBar";
import { useAppState } from "./hooks/useAppState";
import "./App.css";
import { ThemeProvider } from "./components/theme-provider";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { confirm } from "@tauri-apps/plugin-dialog";
import { useEffect } from "react";

function App() {
  const { currentTab, setCurrentTab, unsavedChanges } = useAppState();

  useEffect(() => {
    let isClosing = false;

    const handleClose = async (event: { preventDefault: () => void }) => {
      // Prevent multiple confirmation dialogs
      if (isClosing) return;

      if (unsavedChanges) {
        event.preventDefault();
        isClosing = true;

        const confirmed = await confirm(
          "You will lose unsaved changes. Do you want to close the application?",
          {
            title: "Unsaved Changes",
          }
        );

        if (confirmed) {
          // Force close the window
          await getCurrentWindow().destroy();
        } else {
          // Reset the flag if user cancels
          isClosing = false;
        }
      }
      // If no unsaved changes, allow the window to close normally
    };

    const unlistenPromise = getCurrentWindow().onCloseRequested(handleClose);

    return () => {
      unlistenPromise.then((fn) => fn());
    };
  }, [unsavedChanges]);

  return (
    <StatusBarProvider>
      <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
        <div className="h-full flex flex-col">
          <Tabs value={currentTab} onValueChange={setCurrentTab} className="flex-1 flex flex-col h-full">
            <Navbar />
            <TabContent />
            <StatusBar />
          </Tabs>
        </div>
      </ThemeProvider>
    </StatusBarProvider>
  );
}

export default App;
