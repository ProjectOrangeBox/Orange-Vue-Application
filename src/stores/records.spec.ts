import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useRecordsStore } from '@/stores/records'

const sampleRecord = {
  id: 1,
  name: 'Don Myers',
  phone: '555-1234',
  in_office: true,
  out_until: null,
}

function stubFetch() {
  const mock = vi.fn(async () => ({
    ok: true,
    json: async () => [sampleRecord],
  }))
  vi.stubGlobal('fetch', mock)
  return mock
}

describe('useRecordsStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('fetches and stores records', async () => {
    stubFetch()

    const store = useRecordsStore()
    await store.fetchRecords()

    expect(store.records).toEqual([sampleRecord])
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/index'),
      expect.objectContaining({ method: 'GET' }),
    )
  })

  it('reads a single record by id without touching the list', async () => {
    const mock = vi.fn(async () => ({
      ok: true,
      json: async () => sampleRecord,
    }))
    vi.stubGlobal('fetch', mock)

    const store = useRecordsStore()
    const record = await store.readRecord(1)

    expect(record).toEqual(sampleRecord)
    expect(store.records).toEqual([])
    expect(mock).toHaveBeenCalledWith(
      expect.stringContaining('/read/1'),
      expect.objectContaining({ method: 'GET' }),
    )
  })

  it('creates a record then refetches the list', async () => {
    const mock = stubFetch()

    const store = useRecordsStore()
    const input = { name: 'New Person', phone: '555-9999', in_office: false, out_until: null }
    await store.createRecord(input)

    expect(mock).toHaveBeenCalledWith(
      expect.stringContaining('/create'),
      expect.objectContaining({ method: 'POST', body: JSON.stringify(input) }),
    )
    expect(mock).toHaveBeenCalledWith(
      expect.stringContaining('/index'),
      expect.objectContaining({ method: 'GET' }),
    )
  })

  it('updates a record by id', async () => {
    const mock = stubFetch()

    const store = useRecordsStore()
    const input = { name: 'Don Myers', phone: '555-1234', in_office: false, out_until: null }
    await store.updateRecord(1, input)

    expect(mock).toHaveBeenCalledWith(
      expect.stringContaining('/update/1'),
      expect.objectContaining({ method: 'PUT', body: JSON.stringify(input) }),
    )
  })

  it('deletes a record by id', async () => {
    const mock = stubFetch()

    const store = useRecordsStore()
    await store.deleteRecord(1)

    expect(mock).toHaveBeenCalledWith(
      expect.stringContaining('/delete/1'),
      expect.objectContaining({ method: 'DELETE' }),
    )
  })

  it('throws when the API responds with an error status', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: false, status: 500 })),
    )

    const store = useRecordsStore()

    await expect(store.fetchRecords()).rejects.toThrow('API request failed: 500')
    expect(store.loading).toBe(false)
  })
})
