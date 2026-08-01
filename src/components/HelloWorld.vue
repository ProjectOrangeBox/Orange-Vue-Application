<template>
    <v-container class="fill-height d-flex flex-column justify-center" max-width="1100">
        <div>
            <v-img class="mb-4 font-weight-bold" height="150" src="@/assets/logo.png" />

            <div class="mb-8 text-center">
                <div class="text-body-medium font-weight-light mb-n1">Welcome to</div>
                <div class="text-display-medium font-weight-bold">Vuetify</div>
            </div>

            <div v-if="appStore.welcomeMessage" class="text-body-medium text-center">
                {{ appStore.welcomeMessage }}
            </div>

            <div class="mt-8 text-center">
                <v-btn color="primary" prepend-icon="mdi-table" size="large" to="/records">
                    Manage Records
                </v-btn>

                <v-btn class="ml-3" color="secondary" prepend-icon="mdi-calendar-month" size="large" to="/calendar" variant="flat">
                    Calendar
                </v-btn>

                <v-btn class="ml-3" color="secondary" prepend-icon="mdi-receipt-text" size="large" to="/orders" variant="flat">
                    Orders
                </v-btn>
            </div>
        </div>
    </v-container>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { useAppStore } from '@/stores/app'

const appStore = useAppStore()

onMounted(() => {
    appStore.fetchWelcomeMessage()
})
</script>
