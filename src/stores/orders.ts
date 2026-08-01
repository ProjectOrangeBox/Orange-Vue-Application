// Orders CRUD, backed by application/orders/controllers/OrderController.php.
//
//   GET    /api/orders        -> Order[]   (or CSV, by Accept header)
//   GET    /api/orders/{id}   -> Order
//   POST   /api/orders        -> {id}      | 401 | 403 | 422
//   PUT    /api/orders/{id}   -> {success} | 401 | 403 | 404 | 422
//   DELETE /api/orders/{id}   -> 204       | 401 | 403 | 404
//
// The types are generated from the PHP Dto classes - see
// @projectorangebox/api-types - so the shape here cannot drift from the shape
// the server validates.

import type { LineItemInput, Order, OrderInput } from '@projectorangebox/api-types'
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { apiBaseUrl } from '@/config/env'

/** Messages against a field name, as the API keys them. */
export type FieldErrors = Record<string, string[]>

/**
 * A validation failure, already split into the two shapes a form needs.
 *
 * The server sends one object; an order's is nested because the payload is:
 *
 *   {"errors": {"customer_id": ["..."],
 *               "lines": {"1": {"qty": ["Quantity must be greater than 0"]}}}}
 *
 * `lines` is the awkward one - it is either a per-row map like that, or a plain
 * list of messages about the list itself ("Lines is required", when there are
 * no rows to blame). unpack() below sorts one from the other so the page never
 * has to.
 */
export class OrderApiError extends Error {
  constructor(
    public status: number,
    public fields: FieldErrors = {},
    public lines: Record<number, FieldErrors> = {},
    public msg = '',
  ) {
    super(`API request failed: ${status}`)
  }
}

function isMessageList(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(entry => typeof entry === 'string')
}

async function unpack(response: Response): Promise<OrderApiError> {
  // declared without an initialiser: the catch returns, so anything past the
  // try has been assigned
  let body: unknown
  try {
    body = await response.json()
  } catch {
    return new OrderApiError(response.status)
  }

  const payload = (body ?? {}) as { errors?: Record<string, unknown>; msg?: unknown }
  const errors = payload.errors ?? {}
  const fields: FieldErrors = {}
  const lines: Record<number, FieldErrors> = {}

  for (const [key, value] of Object.entries(errors)) {
    if (key === 'lines' && !isMessageList(value) && value && typeof value === 'object') {
      // per-row: the keys are the indexes this client sent, so they line up
      // with the rows on screen
      for (const [index, rowErrors] of Object.entries(value as Record<string, unknown>)) {
        if (rowErrors && typeof rowErrors === 'object') {
          lines[Number(index)] = rowErrors as FieldErrors
        }
      }
    } else if (isMessageList(value)) {
      fields[key] = value
    }
  }

  return new OrderApiError(
    response.status,
    fields,
    lines,
    typeof payload.msg === 'string' ? payload.msg : '',
  )
}

async function send(method: string, path: string, body?: OrderInput) {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    method,
    // the write endpoints are behind a login, so the session cookie has to go
    credentials: 'include',
    ...(body && {
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  })

  if (!response.ok) {
    throw await unpack(response)
  }

  return response
}

/** An empty line, for the "add row" button. */
export function blankLine(): LineItemInput {
  return { sku: '', description: '', qty: 1, unit_price: 0, line_total: 0 }
}

export const useOrdersStore = defineStore('orders', () => {
  const orders = ref<Order[]>([])
  const loading = ref(false)

  async function fetchOrders() {
    loading.value = true
    try {
      orders.value = await (await send('GET', '/orders')).json()
    } finally {
      loading.value = false
    }
  }

  async function readOrder(id: number): Promise<Order> {
    return (await send('GET', `/orders/${id}`)).json()
  }

  async function createOrder(input: OrderInput) {
    await send('POST', '/orders', input)
    await fetchOrders()
  }

  async function updateOrder(id: number, input: OrderInput) {
    await send('PUT', `/orders/${id}`, input)
    await fetchOrders()
  }

  async function deleteOrder(id: number) {
    await send('DELETE', `/orders/${id}`)
    await fetchOrders()
  }

  return { orders, loading, fetchOrders, readOrder, createOrder, updateOrder, deleteOrder }
})
