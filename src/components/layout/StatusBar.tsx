import { useStatusBar } from "@/hooks/useStatusBar";
import { useAppState } from "@/hooks/useAppState";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";
import { version } from "../../../src-tauri/tauri.conf.json";
import { AboutModal } from "../modals/AboutModal";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { invoke } from "@tauri-apps/api/core";
import { DownloadCloud } from "lucide-react";

type UpdateInfo = {
  version: string;
  date: string | null;
  body: string | null;
};

export function StatusBar() {
  const { message, isError } = useStatusBar();
  const { connected } = useAppState();
  const [isAboutModalOpen, setIsAboutModalOpen] = useState(false);
  const [updateAvailable, setUpdateAvailable] = useState<UpdateInfo | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [showUpdateHintPopover, setShowUpdateHintPopover] = useState(false);

  useEffect(() => {
    const check = async () => {
      try {
        const updateInfo = await invoke<UpdateInfo | null>("check_for_updates");
        if (updateInfo) {
          setUpdateAvailable(updateInfo);
          setShowUpdateHintPopover(true);
        }
      } catch (e) {
        // silent
      }
    };
    check();
  }, []);

  const handleUpdateConfirm = async () => {
    if (!updateAvailable) return;
    setIsUpdating(true);
    try {
      await invoke("execute_update");
    } catch (e) {
      setIsUpdating(false);
    }
  };

  return (
    <>
      <div
        className={cn(
          "h-6 bg-zinc-800 items-center flex px-2 text-xs gap-2 flex-shrink-0"
        )}
      >
        <div className="flex items-center">
          <div
            className={cn(
              connected ? "bg-green-500" : "bg-zinc-500",
              "h-[7px] w-[7px] rounded-full mr-1.5 "
            )}
          ></div>
          Game {connected ? "connected" : "disconnected"}
        </div>
        <div className="h-4 w-px bg-zinc-600"></div>
        <div className={cn(isError ? "text-red-400" : "text-zinc-400")}>
          {message}
        </div>

        <div className="ml-auto flex items-center gap-2">
          {/* <div 
            className="text-zinc-400 hover:text-zinc-200 cursor-pointer" 
            onClick={() => setIsHelpModalOpen(true)}
          >
            Help
          </div>
          <div className="h-4 w-px bg-zinc-600"></div> */}
          <div className="flex items-center gap-1">
            <div
              className="text-zinc-400 hover:text-zinc-200 cursor-pointer"
              onClick={() => setIsAboutModalOpen(true)}
            >
              v{version}
            </div>
            {updateAvailable && (
              <Popover open={showUpdateHintPopover} onOpenChange={setShowUpdateHintPopover}>
                <PopoverTrigger asChild>
                  <div
                    className="text-yellow-400 hover:text-yellow-300 cursor-pointer"
                    title={`Update available: v${updateAvailable.version}`}
                  >
                    <DownloadCloud size={12} className="animate-pulse" />
                  </div>
                </PopoverTrigger>
                <PopoverContent className="w-96 text-sm" side="bottom" align="end" sideOffset={5}>
                  <div className="space-y-3">
                    <p className="font-medium">New version available: v{updateAvailable.version}</p>
                    {updateAvailable.date && (
                      <p className="text-[10px] text-muted-foreground !mt-0 mb-2">Released on: {updateAvailable.date.split(" ")[0]}</p>
                    )}
                    <div className="max-h-48 overflow-y-auto pr-2">
                      <p className="text-muted-foreground whitespace-pre-wrap text-xs">
                        {updateAvailable.body || "No description provided."}
                      </p>
                    </div>
                    <div className="flex justify-end items-center pt-2 gap-2">
                      <Button variant="outline" size="sm" onClick={() => setShowUpdateHintPopover(false)} disabled={isUpdating}>
                        Dismiss
                      </Button>
                      <Button size="sm" onClick={handleUpdateConfirm} disabled={isUpdating}>
                        {isUpdating ? "Updating..." : "Download & Install"}
                      </Button>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            )}
          </div>
        </div>
      </div>
      <AboutModal isOpen={isAboutModalOpen} setIsOpen={setIsAboutModalOpen} />
    </>
  );
}
