import { Navbar } from "./components/layout/Navbar";
import { StatusBar } from "./components/layout/StatusBar";
import { TabContent } from "./components/tabs/TabContent";
import { Tabs } from "@/components/ui/tabs";
import { StatusBarProvider } from "./hooks/useStatusBar";
import { useAppState } from "./hooks/useAppState";
import "./App.css";
import { ThemeProvider } from "./components/theme-provider";

function App() {
  const { currentTab, setCurrentTab } = useAppState();

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
