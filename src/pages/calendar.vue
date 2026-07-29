<template>
    <v-container max-width="1180">
        <v-toolbar class="mb-4" color="transparent" density="comfortable">
            <v-toolbar-title>{{ monthTitle }}</v-toolbar-title>

            <v-spacer />

            <v-btn icon="mdi-chevron-left" variant="text" @click="moveMonth(-1)" />
            <v-btn class="mx-2" variant="text" @click="goToday">Today</v-btn>
            <v-btn icon="mdi-chevron-right" variant="text" @click="moveMonth(1)" />

            <v-btn class="ml-4" color="primary" prepend-icon="mdi-plus" variant="flat" @click="openCreate">
                New Event
            </v-btn>
        </v-toolbar>

        <v-progress-linear v-if="calendarStore.loading" class="mb-3" color="primary" indeterminate />

        <div class="calendar-grid calendar-heading">
            <div v-for="day in weekDays" :key="day" class="weekday">{{ day }}</div>
        </div>

        <div class="calendar-grid calendar-body">
            <div
                v-for="day in calendarDays"
                :key="day.key"
                class="calendar-day"
                :class="{ muted: !day.inMonth, today: day.isToday }"
                role="button"
                tabindex="0"
                @click="closeDialog"
                @keydown.enter="closeDialog"
                @keydown.space.prevent="closeDialog"
            >
                <span class="date-number">{{ day.date.getDate() }}</span>

                <span class="event-list">
                    <button
                        v-for="event in eventsByDate[formatDate(day.date)] ?? []"
                        :key="event.id"
                        class="event-chip"
                        type="button"
                        @click.stop="openEdit(event)"
                    >
                        {{ event.title }}
                    </button>
                </span>
            </div>
        </div>

        <v-dialog v-model="dialog" max-width="560">
            <v-card :title="editingId === null ? 'New Event' : 'Edit Event'">
                <v-card-text>
                    <v-form v-model="formValid">
                        <v-text-field
                            v-model="form.title"
                            :error="!!fieldErrors.title"
                            label="Title"
                            :rules="[v => !!v || 'Title is required']"
                        />

                        <v-textarea v-model="form.description" :error="!!fieldErrors.description" label="Description" rows="4" />

                        <v-date-input
                            v-model="form.date"
                            :error="!!fieldErrors.date"
                            label="Date"
                            :rules="[v => !!v || 'Date is required']"
                        />
                    </v-form>
                </v-card-text>

                <v-card-actions>
                    <v-btn v-if="editingId !== null" color="error" :loading="deleting" variant="text" @click="deleteSelected">
                        Delete
                    </v-btn>

                    <v-spacer />

                    <v-btn @click="dialog = false">Cancel</v-btn>

                    <v-btn color="primary" :disabled="!formValid" :loading="saving" @click="save">
                        Save
                    </v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>

        <Teleport to="body">
            <v-slide-x-reverse-transition>
                <v-card v-if="errorPanel" class="error-panel" elevation="8" prepend-icon="mdi-alert-circle-outline" title="Errors">
                    <v-card-text>
                        <ul class="pl-4">
                            <li v-for="(message, i) in errorPanelMessages" :key="i">{{ message }}</li>
                        </ul>
                    </v-card-text>

                    <v-card-actions>
                        <v-spacer />
                        <v-btn color="primary" @click="errorPanel = false">Close</v-btn>
                    </v-card-actions>
                </v-card>
            </v-slide-x-reverse-transition>
        </Teleport>
    </v-container>
</template>

<script setup lang="ts">
import type { CalendarEvent, CalendarEventInput } from '@/stores/calendar'
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useCalendarStore } from '@/stores/calendar'
import { ApiError } from '@/stores/records'

const calendarStore = useCalendarStore()
const selectedMonth = ref(startOfMonth(new Date()))
const dialog = ref(false)
const formValid = ref(false)
const saving = ref(false)
const deleting = ref(false)
const editingId = ref<number | null>(null)
const fieldErrors = ref<Record<string, string[]>>({})
const errorPanel = ref(false)
const errorPanelMessages = ref<string[]>([])

const form = reactive({
    title: '',
    description: '',
    date: new Date(),
})

const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const monthTitle = computed(() =>
    selectedMonth.value.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }),
)

const calendarDays = computed(() => {
    const month = selectedMonth.value
    const first = startOfMonth(month)
    const start = new Date(first)
    start.setDate(first.getDate() - first.getDay())
    const days = []
    const todayKey = formatDate(new Date())

    for (let i = 0; i < 42; i++) {
        const date = new Date(start)
        date.setDate(start.getDate() + i)
        days.push({
            key: formatDate(date),
            date,
            inMonth: date.getMonth() === month.getMonth(),
            isToday: formatDate(date) === todayKey,
        })
    }

    return days
})

const eventsByDate = computed(() =>
    calendarStore.events.reduce<Record<string, CalendarEvent[]>>((groups, event) => {
        groups[event.date] ??= []
        groups[event.date].push(event)
        return groups
    }, {}),
)

onMounted(fetchSelectedMonth)

watch(selectedMonth, fetchSelectedMonth)

for (const [source, field] of [
    [() => form.title, 'title'],
    [() => form.description, 'description'],
    [() => form.date, 'date'],
] as [() => unknown, string][]) {
    watch(source, () => {
        if (fieldErrors.value[field]) {
            delete fieldErrors.value[field]
        }
    })
}

function startOfMonth(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), 1)
}

function monthKey(date: Date): string {
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`
}

function formatDate(date: Date): string {
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function pad(value: number): string {
    return String(value).padStart(2, '0')
}

function parseDate(value: string): Date {
    return new Date(`${value}T00:00:00`)
}

async function fetchSelectedMonth() {
    closeDialog()
    try {
        await calendarStore.fetchMonth(monthKey(selectedMonth.value))
    } catch (error) {
        showApiError(error, 'Failed to load events')
    }
}

function moveMonth(offset: number) {
    selectedMonth.value = new Date(selectedMonth.value.getFullYear(), selectedMonth.value.getMonth() + offset, 1)
}

function goToday() {
    selectedMonth.value = startOfMonth(new Date())
}

function closeDialog() {
    dialog.value = false
}

function openCreate() {
    editingId.value = null
    fieldErrors.value = {}
    form.title = ''
    form.description = ''
    form.date = new Date()
    dialog.value = true
}

function openEdit(event: CalendarEvent) {
    editingId.value = event.id
    fieldErrors.value = {}
    form.title = event.title
    form.description = event.description
    form.date = parseDate(event.date)
    dialog.value = true
}

function formInput(): CalendarEventInput {
    return {
        title: form.title,
        description: form.description,
        date: formatDate(form.date),
    }
}

async function save() {
    saving.value = true
    fieldErrors.value = {}
    try {
        await (editingId.value === null
            ? calendarStore.createEvent(formInput())
            : calendarStore.updateEvent(editingId.value, formInput()))
        dialog.value = false
    } catch (error) {
        showApiError(error, 'Failed to save event')
    } finally {
        saving.value = false
    }
}

async function deleteSelected() {
    if (editingId.value === null) return
    deleting.value = true
    try {
        await calendarStore.deleteEvent(editingId.value)
        dialog.value = false
    } catch (error) {
        showApiError(error, 'Failed to delete event')
    } finally {
        deleting.value = false
    }
}

function showErrorPanel(messages: string[]) {
    errorPanelMessages.value = messages
    errorPanel.value = true
}

function showApiError(error: unknown, fallback: string) {
    if (error instanceof ApiError && Object.keys(error.errors).length > 0) {
        fieldErrors.value = error.errors
        showErrorPanel(Object.values(error.errors).flat())
    } else if (error instanceof ApiError) {
        showErrorPanel([error.msg || `${fallback} (HTTP ${error.status})`])
    } else {
        showErrorPanel([fallback])
    }
}

watch(dialog, (open, wasOpen) => {
    if (wasOpen && !open) {
        errorPanel.value = false
    }
})
</script>

<style scoped>
.calendar-grid {
    display: grid;
    grid-template-columns: repeat(7, minmax(0, 1fr));
}

.calendar-heading {
    border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
    border-bottom: 0;
}

.weekday {
    min-height: 36px;
    padding: 8px;
    font-size: 0.8rem;
    font-weight: 700;
    color: rgb(var(--v-theme-on-surface-variant));
    text-align: center;
    text-transform: uppercase;
}

.calendar-body {
    border-top: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
    border-left: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}

.calendar-day {
    display: flex;
    flex-direction: column;
    min-height: 132px;
    padding: 8px;
    overflow: hidden;
    text-align: left;
    cursor: pointer;
    background: rgb(var(--v-theme-surface));
    border: 0;
    border-right: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
    border-bottom: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}

.calendar-day:hover {
    background: rgba(var(--v-theme-primary), 0.05);
}

.calendar-day.muted {
    background: rgba(var(--v-theme-surface-variant), 0.25);
    color: rgb(var(--v-theme-on-surface-variant));
}

.calendar-day.today .date-number {
    width: 28px;
    height: 28px;
    color: rgb(var(--v-theme-on-primary));
    text-align: center;
    background: rgb(var(--v-theme-primary));
    border-radius: 50%;
}

.date-number {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 6px;
    font-weight: 700;
}

.event-list {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
}

.event-chip {
    width: 100%;
    min-height: 28px;
    padding: 4px 8px;
    overflow: hidden;
    color: rgb(var(--v-theme-on-primary));
    text-align: left;
    text-overflow: ellipsis;
    white-space: nowrap;
    cursor: pointer;
    background: rgb(var(--v-theme-primary));
    border: 0;
    border-radius: 6px;
}

.event-chip:hover {
    filter: brightness(0.97);
}

.error-panel {
    position: fixed;
    top: 50%;
    right: 16px;
    width: 320px;
    max-height: 80vh;
    overflow-y: auto;
    transform: translateY(-50%);
    z-index: 3000;
}

@media (max-width: 700px) {
    .calendar-day {
        min-height: 92px;
        padding: 5px;
    }

    .weekday {
        padding: 6px 2px;
        font-size: 0.7rem;
    }

    .event-chip {
        min-height: 24px;
        padding: 3px 5px;
        font-size: 0.75rem;
    }
}
</style>
