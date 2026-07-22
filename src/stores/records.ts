// Records CRUD store backed by the REST endpoints in the PHP webapp's
// api/controllers/RestController.php. JSON contract (see README.md
// "REST API contract"):
//
//   GET    /api/index        -> RecordItem[]
//   GET    /api/read/{id}    -> RecordItem
//   POST   /api/create       body: RecordInput
//   PUT    /api/update/{id}  body: RecordInput
//   DELETE /api/delete/{id}
//
// `out_until` uses the MySQL-style datetime string 'YYYY-MM-DD HH:mm:ss',
// or null when no return time is set.

import { defineStore } from 'pinia'
import { ref } from 'vue'
import { apiBaseUrl } from '@/config/env'

export interface RecordItem {
  id: number
  name: string
  phone: string
  in_office: boolean
  out_until: string | null
}

export type RecordInput = Omit<RecordItem, 'id'>

// Thrown by the store when the API responds with a failure status. On a
// 422 validation failure `errors` carries the field-keyed messages from the
// response body ({"errors": {"in_office": [...]}}); other failures may
// carry a display message instead ({"msg": "Record not found"})
export class ApiError extends Error {
  constructor(
    public status: number,
    public errors: Record<string, string[]> = {},
    public msg = '',
  ) {
    super(`API request failed: ${status}`)
  }
}

// Extracts the field-keyed validation errors and/or display message from a
// failed response body; both come back empty when the body is missing,
// non-JSON, or not in the expected shape.
async function readFailure(
  response: Response,
): Promise<{ errors: Record<string, string[]>; msg: string }> {
  try {
    const body = await response.json()
    if (body && typeof body === 'object') {
      return {
        errors: body.errors && typeof body.errors === 'object' ? body.errors : {},
        msg: typeof body.msg === 'string' ? body.msg : '',
      }
    }
  } catch {
    // non-JSON error body — fall through
  }
  return { errors: {}, msg: '' }
}

async function send(method: string, path: string, body?: RecordInput) {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    method,
    ...(body && {
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  })
  if (!response.ok) {
    const { errors, msg } = await readFailure(response)
    throw new ApiError(response.status, errors, msg)
  }
  return response
}

export const useRecordsStore = defineStore('records', () => {
  const records = ref<RecordItem[]>([])
  const loading = ref(false)

  async function fetchRecords() {
    loading.value = true
    try {
      const response = await send('GET', '/index')
      records.value = await response.json()
    } finally {
      loading.value = false
    }
  }

  // Fetches a single record fresh from the server; does not touch the list
  async function readRecord(id: number): Promise<RecordItem> {
    const response = await send('GET', `/read/${id}`)
    return response.json()
  }

  async function createRecord(input: RecordInput) {
    await send('POST', '/create', input)
    await fetchRecords()
  }

  async function updateRecord(id: number, input: RecordInput) {
    await send('PUT', `/update/${id}`, input)
    await fetchRecords()
  }

  async function deleteRecord(id: number) {
    await send('DELETE', `/delete/${id}`)
    await fetchRecords()
  }

  return { records, loading, fetchRecords, readRecord, createRecord, updateRecord, deleteRecord }
})
