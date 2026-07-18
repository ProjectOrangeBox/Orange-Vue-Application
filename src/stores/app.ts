// Utilities
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { apiBaseUrl } from '@/config/env'

export const useAppStore = defineStore('app', () => {
  const welcomeMessage = ref('')

  // Example of calling the REST interface configured via VITE_API_BASE_URL
  // (see src/config/env.ts and README.md "Configuration").
  async function fetchFromApi (path: string) {
    const response = await fetch(`${apiBaseUrl}${path}`)
    if (!response.ok) {
      throw new Error(`API request failed: ${response.status}`)
    }
    return response.json()
  }

  async function fetchWelcomeMessage () {
    const { msg } = await fetchFromApi('/welcome')
    welcomeMessage.value = msg
  }

  return { welcomeMessage, fetchFromApi, fetchWelcomeMessage }
})
