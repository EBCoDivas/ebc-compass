import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { assistantPath, MAX_MESSAGE_LENGTH } from '../../services/assistantService'
import { useAssistantDock } from './dockContext'

/**
 * Enlace "preguntar al asistente". En escritorio abre el panel flotante con la pregunta lista;
 * en móvil, o sin panel, navega a la página del asistente como siempre.
 */
export function AskAssistantLink({ question, className, children, onOpenDock }: { question: string; className?: string; children: ReactNode; onOpenDock?: () => void }) {
  const dock = useAssistantDock()
  return (
    <Link
      className={className}
      to={assistantPath(question)}
      onClick={(event) => {
        if (!dock || event.metaKey || event.ctrlKey || event.shiftKey || window.matchMedia('(max-width: 900px)').matches) return
        event.preventDefault()
        onOpenDock?.()
        dock.openWith(question.slice(0, MAX_MESSAGE_LENGTH))
      }}
    >
      {children}
    </Link>
  )
}
