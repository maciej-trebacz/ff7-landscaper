import { Modal } from "@/components/Modal";

interface AboutModalProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
}

export function AboutModal({ isOpen, setIsOpen }: AboutModalProps) {
  return (
    <Modal
      open={isOpen}
      setIsOpen={setIsOpen}
      title="FF7 Landscaper"
      size="sm"
      callback={() => {}}
    >
      <div className="space-y-2">
        <p>The Final Fantasy VII worldmap editor.</p>
        <p>&copy; 2024-2025 Maciej Trebacz (mav)</p>
        <p><a target="_blank" className="text-slate-400 hover:text-slate-200" href="https://github.com/maciej-trebacz/ff7-terraform">Source code on GitHub</a></p>
        <p><a target="_blank" className="text-slate-400 hover:text-slate-200" href="https://twitch.tv/m4v3k">Watch me code this app live on Twitch</a></p>
        <p><a target="_blank" className="text-slate-400 hover:text-slate-200" href="https://discord.gg/YyecaMa7Wf">Join our Discord community</a></p>
        <br />
        <p><b>Acknowledgments:</b></p>
        <p>codemann8 - worldmap data research</p>
        <p>ergonomy_joe - code reverse engineering</p>
        <p>picklejar - world script research</p>
        <p>... and the whole Qhimm and FF7 community.</p>
      </div>
    </Modal>
  );
}
