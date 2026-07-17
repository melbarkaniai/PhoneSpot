import { renderToString } from 'react-dom/server'
import { StaticRouter } from 'react-router-dom'
import { HelmetProvider } from 'react-helmet-async'
import App from './App'
import { PrerenderDataContext, type PrerenderPayload } from './lib/prerenderData'

export { SLUG_TO_MODEL } from './lib/models'

export interface RenderResult {
  html: string
}

// React 19's server renderer hoists <title>/<meta>/<link> rendered anywhere
// in the tree to the front of the output automatically — react-helmet-async's
// context-based extraction API targets older React versions and stays empty
// here, so the caller (scripts/prerender.mjs) splits the hoisted prefix off
// the returned string instead of reading it from a helmet context object.
export function render(url: string, data: PrerenderPayload | null = null): RenderResult {
  const html = renderToString(
    <HelmetProvider>
      <StaticRouter location={url}>
        <PrerenderDataContext.Provider value={data}>
          <App />
        </PrerenderDataContext.Provider>
      </StaticRouter>
    </HelmetProvider>
  )

  return { html }
}
