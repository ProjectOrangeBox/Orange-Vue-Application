import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createVuetify } from 'vuetify'
import HelloWorld from '@/components/HelloWorld.vue'

describe('HelloWorld', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('renders the welcome message fetched from the store', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ msg: 'Hello from the API' }),
      })),
    )

    const wrapper = mount(HelloWorld, {
      global: { plugins: [createVuetify()] },
    })

    await flushPromises()

    expect(wrapper.text()).toContain('Hello from the API')
  })
})
