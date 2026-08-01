/**
 * router/index.ts
 *
 * Manual routes for ./src/pages/*.vue
 */

// Composables
import { createRouter, createWebHistory } from 'vue-router'
import Calendar from '@/pages/calendar.vue'
import Index from '@/pages/index.vue'
import Orders from '@/pages/orders.vue'
import Records from '@/pages/records.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      component: Index,
    },
    {
      path: '/records',
      component: Records,
    },
    {
      path: '/calendar',
      component: Calendar,
    },
    {
      path: '/orders',
      component: Orders,
    },
  ],
})

export default router
