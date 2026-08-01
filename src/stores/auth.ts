// Who the current session is, and what it may do.
//
// Backed by the PHP app's api/controllers/AuthController.php:
//
//   POST /api/login   {email, password} -> {id, username, permissions} | 401
//   POST /api/logout                    -> 204
//   GET  /api/me                        -> {id, username, permissions}
//
// The permissions here decide what the UI offers, never what it is allowed to
// do. Every guarded endpoint re-checks on the server, because anything the
// browser knows about its own privileges it can also lie about.

import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { apiBaseUrl } from '@/config/env'
import { ApiError } from '@/stores/records'

export interface CurrentUser {
  id: number
  username: string
  permissions: Record<string, boolean>
}

// The guest is a real row in the database rather than the absence of one, so
// "logged out" is a user with no permissions, not a null.
const GUEST_ID = 2

async function send(method: string, path: string, body?: unknown) {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    method,
    // Without this the session cookie is never sent and every request is the
    // guest, no matter how the login went.
    credentials: 'include',
    ...(body
      ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
      : {}),
  })

  if (!response.ok) {
    let msg = ''
    try {
      const parsed = await response.json()
      msg = typeof parsed?.msg === 'string' ? parsed.msg : ''
    } catch {
      // non-JSON error body
    }
    throw new ApiError(response.status, {}, msg)
  }

  return response
}

export const useAuthStore = defineStore('auth', () => {
  const user = ref<CurrentUser | null>(null)
  const loading = ref(false)

  const loggedIn = computed(() => !!user.value && user.value.id !== GUEST_ID)
  const username = computed(() => user.value?.username ?? '')

  function can(permission: string): boolean {
    return user.value?.permissions?.[permission] === true
  }

  // Safe to call on mount: "nobody" is a 200 with the guest, not an error.
  async function refresh() {
    loading.value = true
    try {
      user.value = await (await send('GET', '/me')).json()
    } finally {
      loading.value = false
    }
  }

  async function login(email: string, password: string) {
    user.value = await (await send('POST', '/login', { email, password })).json()
  }

  async function logout() {
    await send('POST', '/logout')
    await refresh()
  }

  return { user, loading, loggedIn, username, can, refresh, login, logout }
})
