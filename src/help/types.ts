import type { ComponentType } from "react"
import type { LucideIcon } from "lucide-react"

export type HelpTabId = "messages" | "map" | "textures" | "locations" | "encounters" | "scripts"

export interface HelpSection {
  id: string
  title: string
  description?: string
  paragraphs?: string[]
  items?: Array<{ label: string; detail: string }>
  component?: ComponentType
  keywords?: string[]
}

export interface HelpTabDefinition {
  id: HelpTabId
  label: string
  icon: LucideIcon
  summary: string
  sections: HelpSection[]
  footerNotes?: string[]
  keywords?: string[]
}

export interface HelpSearchIndexEntry {
  tabId: HelpTabId
  sectionId: string
  text: string
}
