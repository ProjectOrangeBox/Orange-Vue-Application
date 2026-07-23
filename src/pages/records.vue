<template>
    <v-container max-width="1100">
        <v-data-table :headers="headers" :items="recordsStore.records" :loading="recordsStore.loading" no-data-text="No records yet">
            <template #top>
                <v-toolbar color="transparent" density="comfortable">
                    <v-toolbar-title>Records</v-toolbar-title>

                    <v-btn color="primary" prepend-icon="mdi-plus" variant="flat" @click="openCreate">
                        New Record
                    </v-btn>
                </v-toolbar>
            </template>

            <template #[`item.in_office`]="{ item }">
                <v-checkbox-btn :model-value="item.in_office" @update:model-value="toggleInOffice(item, $event)" />
            </template>

            <template #[`item.out_until`]="{ item }">
                {{ formatOutUntil(item.out_until) }}
            </template>

            <template #[`item.actions`]="{ item }">
                <v-btn icon="mdi-eye" :loading="viewLoadingId === item.id" size="small" variant="text" @click="openView(item)" />
                <v-btn icon="mdi-pencil" size="small" variant="text" @click="openEdit(item)" />
                <v-btn icon="mdi-delete" size="small" variant="text" @click="askDelete(item)" />
            </template>
        </v-data-table>

        <!-- Create / edit / read-only view modal -->
        <v-dialog v-model="dialog" max-width="500">
            <v-card :title="dialogTitle">
                <v-card-text>
                    <v-form v-model="formValid">
                        <v-text-field v-model="form.name" :disabled="viewing" :error="!!fieldErrors.name" label="Name" :rules="[v => !!v || 'Name is required']" />

                        <v-text-field v-model="form.phone" :disabled="viewing" :error="!!fieldErrors.phone" label="Phone" />

                        <v-checkbox v-model="form.inOffice" :disabled="viewing" :error="!!fieldErrors.in_office" hide-details label="In Office" />

                        <v-date-input v-model="form.outUntilDate" clearable :disabled="viewing" :error="!!fieldErrors.out_until" label="Out Until (date)" />

                        <v-menu v-model="timeMenu" :close-on-content-click="false">
                            <template #activator="{ props: menuProps }">
                                <v-text-field v-bind="menuProps" v-model="form.outUntilTime" clearable :disabled="viewing" label="Out Until (time)" prepend-icon="mdi-clock-outline" readonly />
                            </template>

                            <v-time-picker v-if="timeMenu" v-model="form.outUntilTime" format="24hr" />
                        </v-menu>
                    </v-form>
                </v-card-text>

                <v-card-actions>
                    <v-spacer />
                    <v-btn @click="dialog = false">{{ viewing ? 'Close' : 'Cancel' }}</v-btn>

                    <v-btn v-if="!viewing" color="primary" :disabled="!formValid" :loading="saving" @click="save">
                        Save
                    </v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>

        <!-- Delete confirmation -->
        <v-dialog v-model="deleteDialog" max-width="400">
            <v-card title="Delete Record">
                <v-card-text>
                    Are you sure you want to delete <strong>{{ deleteTarget?.name }}</strong>?
                </v-card-text>

                <v-card-actions>
                    <v-spacer />
                    <v-btn @click="deleteDialog = false">Cancel</v-btn>
                    <v-btn color="error" :loading="deleting" @click="confirmDelete">Delete</v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>

        <!-- Validation error panel — fixed to the right edge, above the edit
         dialog's scrim, so all errors stay readable while editing; only the
         Close button dismisses it -->
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
import type { RecordInput, RecordItem } from '@/stores/records'
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { ApiError, useRecordsStore } from '@/stores/records'

const recordsStore = useRecordsStore()

const headers = [
    { title: 'Name', key: 'name' },
    { title: 'Phone', key: 'phone', sortable: false },
    { title: 'In Office', key: 'in_office' },
    { title: 'Out Until', key: 'out_until' },
    { title: 'Actions', key: 'actions', sortable: false, align: 'end' as const },
]

onMounted(async () => {
    try {
        await recordsStore.fetchRecords()
    } catch (error) {
        showApiError(error, 'Failed to load records')
    }
})

// --- Create / edit / read-only view modal ---

const dialog = ref(false)
const formValid = ref(false)
const saving = ref(false)
const timeMenu = ref(false)
const editingId = ref<number | null>(null)

// true while the dialog shows a record read-only: fields are disabled and
// Save is hidden, so the shared form can't submit anything
const viewing = ref(false)

const dialogTitle = computed(() => {
    if (viewing.value) return 'View Record'
    return editingId.value === null ? 'New Record' : 'Edit Record'
})

// API validation errors keyed by input field name, bound to the form
// fields' error props to highlight them (see ApiError in the records store);
// the messages themselves are listed in the error panel, not under the fields
const fieldErrors = ref<Record<string, string[]>>({})
const form = reactive({
    name: '',
    phone: '',
    inOffice: false,
    outUntilDate: null as Date | null,
    outUntilTime: null as string | null, // 'HH:mm'
})

// a field with the error prop set counts as invalid, which turns formValid
// false and disables Save — clear a field's highlight as soon as it is
// edited so the form (and the Save button) can recover after a 422; the
// error panel is deliberately left alone so all messages stay readable
const fieldErrorSources: [() => unknown, string][] = [
    [() => form.name, 'name'],
    [() => form.phone, 'phone'],
    [() => form.inOffice, 'in_office'],
    [() => form.outUntilDate, 'out_until'],
    [() => form.outUntilTime, 'out_until'],
]

for (const [source, field] of fieldErrorSources) {
    watch(source, () => {
        if (fieldErrors.value[field]) {
            delete fieldErrors.value[field]
        }
    })
}

function fillForm(record: RecordItem) {
    form.name = record.name
    form.phone = record.phone
    form.inOffice = record.in_office
    if (record.out_until) {
        const [datePart, timePart] = record.out_until.split(' ')
        form.outUntilDate = new Date(`${datePart}T${timePart ?? '00:00:00'}`)
        form.outUntilTime = timePart ? timePart.slice(0, 5) : null
    } else {
        form.outUntilDate = null
        form.outUntilTime = null
    }
}

function openCreate() {
    viewing.value = false
    editingId.value = null
    fieldErrors.value = {}
    form.name = ''
    form.phone = ''
    form.inOffice = false
    form.outUntilDate = null
    form.outUntilTime = null
    dialog.value = true
}

function openEdit(record: RecordItem) {
    viewing.value = false
    editingId.value = record.id
    fieldErrors.value = {}
    fillForm(record)
    dialog.value = true
}

// --- Read-only view ---

// id of the row whose eye button is fetching, to spin only that button
const viewLoadingId = ref<number | null>(null)

// shows the record read-only, fetched fresh from GET /api/read/{id} rather
// than from the already-loaded list
async function openView(record: RecordItem) {
    viewLoadingId.value = record.id
    try {
        const fresh = await recordsStore.readRecord(record.id)
        viewing.value = true
        fieldErrors.value = {}
        fillForm(fresh)
        dialog.value = true
    } catch (error) {
        showApiError(error, 'Failed to load record')
    } finally {
        viewLoadingId.value = null
    }
}

function formInput(): RecordInput {
    const pad = (n: number) => String(n).padStart(2, '0')
    const date = form.outUntilDate
    return {
        name: form.name,
        phone: form.phone,
        in_office: form.inOffice,
        out_until: date
            ? `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
            ` ${form.outUntilTime ?? '00:00'}:00`
            : null,
    }
}

async function save() {
    saving.value = true
    fieldErrors.value = {}
    try {
        await (editingId.value === null
            ? recordsStore.createRecord(formInput())
            : recordsStore.updateRecord(editingId.value, formInput()))
        dialog.value = false
    } catch (error) {
        showApiError(error, 'Failed to save record')
    } finally {
        saving.value = false
    }
}

// --- Inline "In Office" toggle ---

async function toggleInOffice(record: RecordItem, value: unknown) {
    const previous = record.in_office
    record.in_office = value === true
    try {
        await recordsStore.updateRecord(record.id, {
            name: record.name,
            phone: record.phone,
            in_office: record.in_office,
            out_until: record.out_until,
        })
    } catch (error) {
        record.in_office = previous
        showApiError(error, 'Failed to update record')
    }
}

// --- Delete confirmation ---

const deleteDialog = ref(false)
const deleting = ref(false)
const deleteTarget = ref<RecordItem | null>(null)

function askDelete(record: RecordItem) {
    deleteTarget.value = record
    deleteDialog.value = true
}

async function confirmDelete() {
    if (!deleteTarget.value) return
    deleting.value = true
    try {
        await recordsStore.deleteRecord(deleteTarget.value.id)
        deleteDialog.value = false
    } catch (error) {
        showApiError(error, 'Failed to delete record')
    } finally {
        deleting.value = false
    }
}

// --- Helpers ---

const errorPanel = ref(false)
const errorPanelMessages = ref<string[]>([])

function showErrorPanel(messages: string[]) {
    errorPanelMessages.value = messages
    errorPanel.value = true
}

// highlight the failing form fields and list every message in the side
// panel; editing a field clears its highlight but the panel stays open
// until the user closes it
function showValidationErrors(errors: Record<string, string[]>) {
    fieldErrors.value = errors
    showErrorPanel(Object.values(errors).flat())
}

// single entry point for every failed request: 422 field errors highlight
// the form, a server-sent msg is displayed as-is, and anything else (500s,
// network failures, non-JSON bodies) falls back to a generic message with
// the HTTP status when there is one
function showApiError(error: unknown, fallback: string) {
    if (error instanceof ApiError && Object.keys(error.errors).length > 0) {
        showValidationErrors(error.errors)
    } else if (error instanceof ApiError) {
        showErrorPanel([error.msg || `${fallback} (HTTP ${error.status})`])
    } else {
        showErrorPanel([fallback])
    }
}

// closing the create/edit or delete modal (cancel, save, esc, or scrim
// click) also dismisses the error panel — its messages belong to that
// modal's session
watch([dialog, deleteDialog], ([formOpen, deleteOpen], [wasFormOpen, wasDeleteOpen]) => {
    if ((wasFormOpen && !formOpen) || (wasDeleteOpen && !deleteOpen)) {
        errorPanel.value = false
    }
})

function formatOutUntil(value: string | null): string {
    if (!value) return '—'
    return new Date(value.replace(' ', 'T')).toLocaleString(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
    })
}
</script>

<style scoped>
/* fixed to the right edge, above Vuetify's dialog overlay (~2400) so the
   errors stay visible and clickable while the edit modal is open */
.error-panel {
    position: fixed;
    top: 50%;
    right: 16px;
    transform: translateY(-50%);
    width: 320px;
    max-height: 80vh;
    overflow-y: auto;
    z-index: 3000;
}
</style>
