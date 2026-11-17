import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

/** Respuestas del asistente: Markdown seguro (sin HTML crudo), enlaces externos en pestaña nueva y encabezados acotados. */
export function Markdown({ children }: { children: string }) {
  return (
    <div className="md">
      <ReactMarkdown
        skipHtml
        remarkPlugins={[remarkGfm]}
        disallowedElements={['img']}
        unwrapDisallowed
        components={{
          a: ({ href, children: label }) => {
            const external = /^https?:/i.test(href ?? '')
            return (
              <a href={href} {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
                {label}
              </a>
            )
          },
          h1: ({ children: c }) => <h4>{c}</h4>,
          h2: ({ children: c }) => <h4>{c}</h4>,
          h3: ({ children: c }) => <h5>{c}</h5>,
          h6: ({ children: c }) => <h5>{c}</h5>,
          table: ({ children: c }) => (
            <div className="md-table">
              <table>{c}</table>
            </div>
          ),
        }}
      >
        {children.replace(/^([ \t]*)• /gm, '$1- ')}
      </ReactMarkdown>
    </div>
  )
}
