import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAppStore } from '@/stores/app'

describe('useAppStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('fetches and stores the welcome message', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ msg: 'Hello there' }),
      })),
    )

    const store = useAppStore()
    await store.fetchWelcomeMessage()

    expect(store.welcomeMessage).toBe('Hello there')
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/welcome'))
  })

  it('throws when the API responds with an error status', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: false, status: 500 })),
    )

    const store = useAppStore()

    await expect(store.fetchFromApi('/welcome')).rejects.toThrow('API request failed: 500')
  })
})
