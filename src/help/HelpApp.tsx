import { useEffect, useMemo, useRef, useState } from "react"
import { listen } from "@tauri-apps/api/event"
import { ThemeProvider } from "@/components/theme-provider"
// search removed
import { cn } from "@/lib/utils"
import { HELP_TABS } from "./content"
import type { HelpTabDefinition, HelpTabId } from "./types"
import { HelpSectionContainer, HelpParagraph } from "./components"
import "../App.css"

interface HelpEventPayload {
  tab: HelpTabId
}

const NAV_WIDTH = 240

export function HelpApp() {
  const [activeTab, setActiveTab] = useState<HelpTabId>("messages")
  // search removed
  const scrollContainerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const unlistenPromise = listen<HelpEventPayload>("landscaper-help:set-tab", (event) => {
      setActiveTab(event.payload.tab)
      // search removed
      requestAnimationFrame(() => {
        scrollContainerRef.current?.scrollTo({ top: 0, behavior: "smooth" })
      })
    })

    return () => {
      unlistenPromise.then((unlisten) => unlisten())
    }
  }, [])

  const currentTab = useMemo<HelpTabDefinition>(() => {
    return HELP_TABS.find((tab) => tab.id === activeTab) ?? HELP_TABS[0]
  }, [activeTab])

  const filteredSections = currentTab.sections

  useEffect(() => {
    scrollContainerRef.current?.scrollTo({ top: 0 })
  }, [currentTab])

  return (
    <ThemeProvider defaultTheme="dark" storageKey="landscaper-help-theme">
      <div className="h-screen bg-background text-foreground">
        <div className="flex h-full">
          <aside
            className="hidden lg:flex flex-col border-r border-zinc-800/80 bg-zinc-950/70"
            style={{ width: NAV_WIDTH }}
          >
            <nav className="flex-1 overflow-y-auto">
              <ul className="space-y-0.5 px-2 py-3">
                {HELP_TABS.map((tab) => {
                  const Icon = tab.icon
                  const isActive = tab.id === currentTab.id
                  return (
                    <li key={tab.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setActiveTab(tab.id)
                        }}
                        className={cn(
                          "w-full rounded-md px-3 py-2 text-left transition",
                          "hover:bg-zinc-800/60 focus:outline-none focus:ring-1 focus:ring-primary",
                          isActive ? "bg-zinc-800 text-zinc-100" : "text-zinc-300"
                        )}
                      >
                        <div className="flex items-center gap-2 text-sm font-medium">
                          <Icon className="h-4 w-4" />
                          {tab.label}
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                          {tab.summary}
                        </p>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </nav>

            <div className="border-t border-zinc-800/80 px-2 py-3">
              <p className="text-xs text-zinc-400 leading-relaxed">
                Need more help?{" "}
                <a
                  href="https://discord.gg/YyecaMa7Wf"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-slate-400 hover:text-slate-200 underline"
                >
                  Join our Discord
                </a>
              </p>
            </div>
          </aside>

          <div className="flex-1 flex flex-col min-w-0">
            <header className="lg:hidden px-4 py-3 border-b border-zinc-800/80 bg-zinc-950/60 backdrop-blur">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="text-2xl font-semibold text-zinc-50 mt-1">{currentTab.label} Help</h2>
                  <p className="text-sm text-muted-foreground mt-1 max-w-2xl">{currentTab.summary}</p>
                </div>
                {/* search removed */}
              </div>
            </header>

            <div className="flex-1 overflow-hidden">
              <div ref={scrollContainerRef} className="h-full overflow-y-auto help-content">
                <div className="px-4 pt-3 pb-6 lg:px-4 lg:pt-3 lg:pb-4 space-y-8">
                  {filteredSections.map((section) => {
                      const SectionComponent = section.component
                      return (
                        <HelpSectionContainer
                          key={section.id}
                          id={`${currentTab.id}-${section.id}`}
                          title={section.title}
                          description={section.description}
                        >
                          {section.paragraphs &&
                            section.paragraphs.map((paragraph, index) => (
                              <HelpParagraph key={index}>{paragraph}</HelpParagraph>
                            ))}
                          {section.items && (
                            <div className="grid gap-2">
                              {section.items.map((item) => (
                                <div key={item.label} className="rounded-md bg-zinc-900/30 border border-zinc-800/70 px-3 py-2">
                                  <div className="text-xs uppercase tracking-wide text-muted-foreground">{item.label}</div>
                                  <div className="text-sm text-zinc-100 leading-relaxed">
                                    {item.detail}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                          {SectionComponent && <SectionComponent />}
                        </HelpSectionContainer>
                      )
                    })}

                  {currentTab.footerNotes && currentTab.footerNotes.length > 0 && (
                    <div className="border-t border-zinc-800/80 pt-4 space-y-2">
                      {currentTab.footerNotes.map((note, index) => (
                        <p key={index} className="text-xs text-muted-foreground">
                          {note}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </ThemeProvider>
  )
}

export default HelpApp
