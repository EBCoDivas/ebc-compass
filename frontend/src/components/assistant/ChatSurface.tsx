import { ConversationHistory } from './ConversationHistory'
import { QueryInput } from './QueryInput'
import { SuggestedQuestions } from './SuggestedQuestions'
import { loadProfile } from '../../services/profileService'
import type { AssistantChat } from './useAssistantChat'

/** Mensajes, bienvenida y campo de texto. Se coloca dentro de la tarjeta de la página o del panel flotante. */
export function ChatSurface({ chat }: { chat: AssistantChat }) {
  const { entries, suggestions, draft, setDraft, loading, pending, notice, announcement, inputRef, submit, stop, retry } = chat
  const name = loadProfile()?.name
  return (
    <>
      <p className="visually-hidden" role="status">{announcement}</p>
      {loading ? (
        <p className="chat-empty" role="status">Cargando conversación…</p>
      ) : entries.length === 0 ? (
        <div className="chat-empty">
          <img src="/ebc-compass-mark.svg" alt="" width="56" height="56" />
          <h2>¡Hola{name ? `, ${name}` : ''}! Soy Compass</h2>
          <p>Tu asistente con IA. Pregúntame sobre becas, cursos, trámites, eventos y fechas, en español o en inglés.</p>
          <SuggestedQuestions suggestions={suggestions} onPick={submit} disabled={pending} />
        </div>
      ) : (
        <ConversationHistory entries={entries} pending={pending} onRetry={retry} onPickSuggestion={submit} />
      )}

      {pending && entries.length === 0 && <p role="status" className="chat-empty">Escribiendo…</p>}
      {notice && <p className="form-error chat-notice" role="alert">{notice}</p>}

      <QueryInput modelSelector={
        <details className="chat-model-picker">
          <summary aria-label={`Elegir modelo, actual: ${chat.model === 'lunna' ? 'Lunna' : 'Terra'}`}>{chat.model === 'lunna' ? 'Lunna' : 'Terra'} <svg aria-hidden="true" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="m4 6 4 4 4-4" /></svg></summary>
          <div className="chat-model-menu">
            <p>Elige cómo conversar</p>
            {(['lunna', 'terra'] as const).map(model => <button key={model} type="button" disabled={pending} aria-pressed={chat.model === model} onClick={event => {
              chat.setModel(model)
              event.currentTarget.closest('details')?.removeAttribute('open')
            }}><strong>{model === 'lunna' ? 'Lunna' : 'Terra'}</strong>{chat.modelNames[model] && <span className="chat-model-name">{chat.modelNames[model]!.replace(/^gpt-/i, 'GPT-')}</span>}<span>{model === 'lunna' ? 'Para consultas rápidas' : 'Para explorar con más detalle'}</span></button>)}
          </div>
        </details>
      } ref={inputRef} value={draft} onChange={setDraft} onSubmit={submit} disabled={loading} pending={pending} onStop={stop} />
    </>
  )
}
