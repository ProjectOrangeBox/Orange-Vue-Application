import { describe, expect, it } from 'vitest'
import router from '@/router'

/**
 * Routes are registered by hand in index.ts, not derived from src/pages/.
 *
 * That is easy to forget, and the way it fails is quiet: an unmatched path
 * still returns 200 because the dev server and nginx both serve index.html for
 * anything, so the browser gets the app shell, the router matches nothing, and
 * the page renders blank. Nothing errors and nothing is logged - which is
 * exactly what happened when the orders page was added.
 */
describe('router', () => {
  it.each([['/'], ['/records'], ['/calendar'], ['/orders']])('resolves %s to a component', path => {
    const { matched } = router.resolve(path)

    expect(matched.length).toBeGreaterThan(0)
    expect(matched[0]?.components?.default).toBeTruthy()
  })

  it('has a route for every page component', () => {
    // import.meta.glob is resolved at build time, so this is the actual
    // contents of src/pages - a new page with no route fails here rather than
    // rendering an empty screen in the browser.
    const pages = Object.keys(import.meta.glob('@/pages/*.vue'))
      .map(file => file.split('/').pop()!.replace('.vue', ''))
      .filter(name => name !== 'index')

    const routed = router
      .getRoutes()
      .map(route => route.path.replace(/^\//, ''))
      .filter(Boolean)

    // Sets rather than sorted arrays: order is not part of what is being
    // asserted, and sorting here means either sort() (which eslint rejects) or
    // toSorted() (which this tsconfig's lib target does not have).
    expect(new Set(routed)).toEqual(new Set(pages))
  })
})
