import { defineStore } from 'pinia'
import { ref } from 'vue'
import { apiBaseUrl } from '@/config/env'
import { ApiError } from '@/stores/records'

export interface CalendarEvent {
  id: number
  title: string
  description: string
  date: string
}

export type CalendarEventInput = Omit<CalendarEvent, 'id'>

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
    // non-JSON error body
  }
  return { errors: {}, msg: '' }
}

async function send(method: string, path: string, body?: CalendarEventInput) {
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

export const useCalendarStore = defineStore('calendar', () => {
  const events = ref<CalendarEvent[]>([])
  const loading = ref(false)
  const currentMonth = ref('')

  async function fetchMonth(month: string) {
    loading.value = true
    currentMonth.value = month
    try {
      const response = await send('GET', `/calendar/${month}`)
      events.value = await response.json()
    } finally {
      loading.value = false
    }
  }

  async function createEvent(input: CalendarEventInput) {
    await send('POST', '/calendar/create', input)
    await fetchMonth(currentMonth.value)
  }

  async function updateEvent(id: number, input: CalendarEventInput) {
    await send('PUT', `/calendar/update/${id}`, input)
    await fetchMonth(currentMonth.value)
  }

  async function deleteEvent(id: number) {
    await send('DELETE', `/calendar/delete/${id}`)
    await fetchMonth(currentMonth.value)
  }

  return { events, loading, currentMonth, fetchMonth, createEvent, updateEvent, deleteEvent }
})
