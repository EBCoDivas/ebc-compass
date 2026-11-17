import { createContext, useContext } from 'react'

export interface AssistantDockApi {
  /** Abre el panel flotante con una pregunta precargada (sin enviarla). */
  openWith: (question: string) => void
}

/** null cuando el panel no está disponible (sin sesión o en la página del asistente). */
export const AssistantDockContext = createContext<AssistantDockApi | null>(null)
export const useAssistantDock = () => useContext(AssistantDockContext)
