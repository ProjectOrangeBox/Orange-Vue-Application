// Utilities
import { defineStore } from 'pinia'
import { apiBaseUrl } from '@/config/env'

export const useAppStore = defineStore('app', {
  state: () => ({
    //
  }),
  actions: {
    // Example of calling the REST interface configured via VITE_API_BASE_URL
    // (see src/config/env.ts and README.md "Configuration").
    async fetchFromApi(path: string) {
      const response = await fetch(`${apiBaseUrl}${path}`)
      if (!response.ok) {
        throw new Error(`API request failed: ${response.status}`)
      }
      return response.json()
    },
  },
})
