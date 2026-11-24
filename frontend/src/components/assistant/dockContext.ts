import { createContext, useContext } from 'react'
import type { ProactiveNotice } from '../../../../shared/contracts/proactive'

export interface AssistantDockApi {
  /** Abre el panel flotante con una pregunta precargada (sin enviarla). */
  openWith: (question: string) => void
  setProactiveNotice: (notice: ProactiveNotice | null, conversationId?: string) => void
}

/** null cuando el panel no está disponible (sin sesión o en la página del asistente). */
export const AssistantDockContext = createContext<AssistantDockApi | null>(null)
export const useAssistantDock = () => useContext(AssistantDockContext)
