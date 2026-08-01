<template>
    <v-container max-width="1200">
        <v-data-table :headers="headers" :items="ordersStore.orders" :loading="ordersStore.loading" no-data-text="No orders yet">
            <template #top>
                <v-toolbar color="transparent" density="comfortable">
                    <v-toolbar-title>Orders</v-toolbar-title>

                    <v-chip v-if="auth.loggedIn" class="mr-2" prepend-icon="mdi-account-check" size="small">
                        {{ auth.username }}
                    </v-chip>

                    <v-btn v-if="auth.loggedIn" class="mr-2" size="small" variant="text" @click="auth.logout()">
                        Log out
                    </v-btn>

                    <v-btn v-else class="mr-2" size="small" variant="text" @click="loginDialog = true">
                        Log in
                    </v-btn>

                    <v-btn class="mr-2" prepend-icon="mdi-download" size="small" variant="text" @click="downloadCsv">
                        CSV
                    </v-btn>

                    <!-- Hidden rather than disabled when not permitted: the server
                         refuses it either way, this only avoids offering it. -->
                    <v-btn v-if="auth.can('orders.create')" color="primary" prepend-icon="mdi-plus" variant="flat" @click="openCreate">
                        New Order
                    </v-btn>
                </v-toolbar>
            </template>

            <template #[`item.lines`]="{ item }">
                {{ item.lines.length }}
            </template>

            <template #[`item.total`]="{ item }">
                {{ currency(orderTotal(item)) }}
            </template>

            <template #[`item.actions`]="{ item }">
                <v-btn icon="mdi-pencil" size="small" variant="text" @click="openEdit(item)" />
                <v-btn v-if="auth.can('orders.delete')" icon="mdi-delete" size="small" variant="text" @click="askDelete(item)" />
            </template>
        </v-data-table>

        <!-- Create / edit -->
        <v-dialog v-model="dialog" max-width="900" persistent>
            <v-card :title="editingId ? `Edit order #${editingId}` : 'New order'">
                <v-card-text>
                    <v-alert v-if="serverMsg" class="mb-4" density="compact" :text="serverMsg" type="error" />

                    <v-row>
                        <v-col cols="12" sm="4">
                            <v-select
                                v-model="form.customer_id"
                                :error-messages="fieldError('customer_id')"
                                item-title="name"
                                item-value="id"
                                :items="customers"
                                label="Customer"
                            />
                        </v-col>

                        <v-col cols="12" sm="4">
                            <v-text-field v-model="form.ordered_on" :error-messages="fieldError('ordered_on')" label="Ordered on" placeholder="YYYY-MM-DD" />
                        </v-col>

                        <v-col cols="12" sm="4">
                            <v-text-field v-model="form.notes" :error-messages="fieldError('notes')" label="Notes" />
                        </v-col>
                    </v-row>

                    <div class="d-flex align-center mt-2 mb-1">
                        <span class="text-subtitle-1">Line items</span>
                        <v-spacer />
                        <span class="text-body-2 mr-4">Total {{ currency(formTotal) }}</span>

                        <v-btn prepend-icon="mdi-plus" size="small" variant="tonal" @click="form.lines.push(blankLine())">
                            Add line
                        </v-btn>
                    </div>

                    <!-- The whole point of this page: a 422 comes back keyed by
                         row index, so each row shows its own messages instead of
                         one "something is wrong" for the entire table. -->
                    <v-alert v-if="linesMessage" class="mb-3" density="compact" :text="linesMessage" type="error" />

                    <v-card v-for="(line, index) in form.lines" :key="index" class="mb-2" :color="lineErrors[index] ? 'red-lighten-5' : undefined" variant="outlined">
                        <v-card-text class="pb-1">
                            <v-row dense>
                                <v-col cols="12" sm="2">
                                    <v-text-field v-model="line.sku" density="compact" :error-messages="lineError(index, 'sku')" label="SKU" />
                                </v-col>

                                <v-col cols="12" sm="4">
                                    <v-text-field v-model="line.description" density="compact" :error-messages="lineError(index, 'description')" label="Description" />
                                </v-col>

                                <v-col cols="6" sm="1">
                                    <v-text-field v-model.number="line.qty" density="compact" :error-messages="lineError(index, 'qty')" label="Qty" type="number" />
                                </v-col>

                                <v-col cols="6" sm="2">
                                    <v-text-field v-model.number="line.unit_price" density="compact" :error-messages="lineError(index, 'unit_price')" label="Unit price" step="0.01" type="number" />
                                </v-col>

                                <v-col cols="6" sm="2">
                                    <v-text-field density="compact" :error-messages="lineError(index, 'line_total')" label="Line total" :model-value="lineTotal(line).toFixed(2)" readonly />
                                </v-col>

                                <v-col class="d-flex align-center" cols="6" sm="1">
                                    <v-btn icon="mdi-close" size="small" variant="text" @click="form.lines.splice(index, 1)" />
                                </v-col>
                            </v-row>
                        </v-card-text>
                    </v-card>
                </v-card-text>

                <v-card-actions>
                    <v-spacer />
                    <v-btn @click="dialog = false">Cancel</v-btn>
                    <v-btn color="primary" :loading="saving" @click="save">Save</v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>

        <!-- Log in -->
        <v-dialog v-model="loginDialog" max-width="420">
            <v-card title="Log in">
                <v-card-text>
                    <v-alert v-if="loginError" class="mb-3" density="compact" :text="loginError" type="error" />
                    <v-text-field v-model="loginForm.email" label="Email" />
                    <v-text-field v-model="loginForm.password" label="Password" type="password" @keyup.enter="doLogin" />
                    <div class="text-caption text-medium-emphasis">Example credentials: admin@example.com / orange123</div>
                </v-card-text>

                <v-card-actions>
                    <v-spacer />
                    <v-btn @click="loginDialog = false">Cancel</v-btn>
                    <v-btn color="primary" :loading="loggingIn" @click="doLogin">Log in</v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>

        <v-dialog v-model="confirmDelete" max-width="420">
            <v-card text="Delete this order and all of its lines?" title="Are you sure?">
                <v-card-actions>
                    <v-spacer />
                    <v-btn @click="confirmDelete = false">Cancel</v-btn>
                    <v-btn color="error" @click="doDelete">Delete</v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>

        <v-snackbar v-model="snackbar" :timeout="4000">{{ snackbarText }}</v-snackbar>
    </v-container>
</template>

<script lang="ts" setup>
    import type { LineItemInput, Order, OrderInput } from '@projectorangebox/api-types'
    import { computed, onMounted, reactive, ref } from 'vue'
    import { apiBaseUrl } from '@/config/env'
    import { useAuthStore } from '@/stores/auth'
    import { blankLine, type FieldErrors, OrderApiError, useOrdersStore } from '@/stores/orders'

    const ordersStore = useOrdersStore()
    const auth = useAuthStore()

    const headers = [
        { title: 'Order', key: 'id', width: 90 },
        { title: 'Customer', key: 'customer_id', width: 120 },
        { title: 'Ordered on', key: 'ordered_on' },
        { title: 'Lines', key: 'lines', sortable: false, width: 90 },
        { title: 'Total', key: 'total', sortable: false, width: 120 },
        { title: 'Notes', key: 'notes' },
        { title: '', key: 'actions', align: 'end' as const, sortable: false, width: 110 },
    ]

    // Seeded by 20-acl-seed.sql / 50-orders.sql in the mysql sandbox. There is no
    // customers endpoint yet, so the list is fixed rather than fetched.
    const customers = [
        { id: 1, name: 'Johnny Appleseed' },
        { id: 2, name: 'Jenny Appleseed' },
    ]

    const dialog = ref(false)
    const loginDialog = ref(false)
    const confirmDelete = ref(false)
    const saving = ref(false)
    const loggingIn = ref(false)
    const editingId = ref<number | null>(null)
    const deletingId = ref<number | null>(null)
    const snackbar = ref(false)
    const snackbarText = ref('')
    const loginError = ref('')
    const serverMsg = ref('')
    const linesMessage = ref('')

    const fieldErrors = ref<FieldErrors>({})
    const lineErrors = ref<Record<number, FieldErrors>>({})

    const form = reactive<OrderInput>({
        customer_id: 1,
        ordered_on: new Date().toISOString().slice(0, 10),
        notes: '',
        lines: [blankLine()],
    })

    const loginForm = reactive({ email: 'admin@example.com', password: '' })

    function lineTotal (line: LineItemInput): number {
        return Math.round(Number(line.qty || 0) * Number(line.unit_price || 0) * 100) / 100
    }

    function orderTotal (order: Order): number {
        return order.lines.reduce((sum, line) => sum + Number(line.line_total), 0)
    }

    const formTotal = computed(() => form.lines.reduce((sum, line) => sum + lineTotal(line), 0))

    function currency (value: number): string {
        return value.toLocaleString(undefined, { style: 'currency', currency: 'USD' })
    }

    function fieldError (name: string): string[] {
        return fieldErrors.value[name] ?? []
    }

    function lineError (index: number, name: string): string[] {
        return lineErrors.value[index]?.[name] ?? []
    }

    function clearErrors () {
        fieldErrors.value = {}
        lineErrors.value = {}
        serverMsg.value = ''
        linesMessage.value = ''
    }

    function openCreate () {
        clearErrors()
        editingId.value = null
        Object.assign(form, {
            customer_id: 1,
            ordered_on: new Date().toISOString().slice(0, 10),
            notes: '',
            lines: [blankLine()],
        })
        dialog.value = true
    }

    function openEdit (order: Order) {
        clearErrors()
        editingId.value = order.id
        Object.assign(form, {
            customer_id: order.customer_id,
            ordered_on: order.ordered_on,
            notes: order.notes,
            // stripped of their ids - an update replaces the lines wholesale, and
            // OrderInput's lines are LineItemInput, which has no id
            lines: order.lines.map(({ sku, description, qty, unit_price, line_total }) => ({
                sku, description, qty, unit_price, line_total,
            })),
        })
        dialog.value = true
    }

    async function save () {
        clearErrors()
        saving.value = true

        // The server checks qty x unit_price rather than recomputing it, so send
        // what the row actually shows.
        const payload: OrderInput = {
            ...form,
            lines: form.lines.map(line => ({ ...line, line_total: lineTotal(line) })),
        }

        try {
            await (editingId.value === null ? ordersStore.createOrder(payload) : ordersStore.updateOrder(editingId.value, payload));
            dialog.value = false
            notify(editingId.value === null ? 'Order created' : 'Order saved')
        } catch (error) {
            handle(error)
        } finally {
            saving.value = false
        }
    }

    function handle (error: unknown) {
        if (!(error instanceof OrderApiError)) {
            throw error
        }

        fieldErrors.value = error.fields
        lineErrors.value = error.lines

        // 401 and 403 are different answers: one is fixable by logging in.
        switch (error.status) {
        case 401: {
            serverMsg.value = error.msg || 'You must log in to do that'
            loginDialog.value = true
        
        break;
        }
        case 403: {
            serverMsg.value = error.msg || 'You do not have permission to do that'
        
        break;
        }
        case 422: {
            const rows = Object.keys(error.lines).length
            linesMessage.value = rows > 0
                ? `${rows} line ${rows === 1 ? 'item has' : 'items have'} a problem - see below`
                : (error.fields.lines?.[0] ?? '')
            serverMsg.value = rows > 0 || Object.keys(error.fields).length > 0 ? '' : (error.msg || 'That order could not be saved')
        
        break;
        }
        default: {
            serverMsg.value = error.msg || `Request failed (${error.status})`
        }
        }
    }

    function askDelete (order: Order) {
        deletingId.value = order.id
        confirmDelete.value = true
    }

    async function doDelete () {
        confirmDelete.value = false
        if (deletingId.value === null) return

        try {
            await ordersStore.deleteOrder(deletingId.value)
            notify('Order deleted')
        } catch (error) {
            notify(error instanceof OrderApiError ? (error.msg || `Delete failed (${error.status})`) : 'Delete failed')
        }
    }

    async function doLogin () {
        loginError.value = ''
        loggingIn.value = true
        try {
            await auth.login(loginForm.email, loginForm.password)
            loginDialog.value = false
            loginForm.password = ''
            notify(`Logged in as ${auth.username}`)
        } catch {
            loginError.value = 'Those credentials were not accepted'
        } finally {
            loggingIn.value = false
        }
    }

    // The same URL the table is built from, asked for differently - one
    // resource, two representations, which is the point of the negotiation.
    //
    // Fetched rather than linked: the server decides on the Accept header, and a
    // plain <a> or window.open cannot set one, so a link would quietly return
    // the JSON instead. The response is turned into a download here.
    async function downloadCsv () {
        try {
            const response = await fetch(`${apiBaseUrl}/orders`, {
                headers: { Accept: 'text/csv' },
                credentials: 'include',
            })

            if (!response.ok) {
                notify(`Export failed (${response.status})`)
                return
            }

            const url = URL.createObjectURL(await response.blob())
            const link = document.createElement('a')
            link.href = url
            link.download = 'orders.csv'
            link.click()
            URL.revokeObjectURL(url)
        } catch {
            notify('Export failed')
        }
    }

    function notify (text: string) {
        snackbarText.value = text
        snackbar.value = true
    }

    onMounted(async () => {
        await Promise.all([ordersStore.fetchOrders(), auth.refresh()])
    })
</script>
