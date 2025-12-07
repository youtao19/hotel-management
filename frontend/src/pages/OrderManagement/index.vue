<template>
  <q-page class="view-orders">
    <div class="q-pa-md">
      <OrderFilterBar
        v-model:searchQuery="searchQuery"
        v-model:filterStatus="filterStatus"
        v-model:filterDate="filterDate"
        :statusOptions="statusOptions"
        @search="searchOrders"
        @clear="clearFilters"
      />

      <div v-if="fetchError" class="q-pa-md bg-red-1 text-red q-mb-md">
        <div class="row items-center">
          <div class="col">
            <div class="text-bold">加载订单数据失败</div>
            <div>{{ fetchError }}</div>
          </div>
          <q-btn color="primary" label="重试" @click="retryFetchOrders" :loading="loadingOrders" />
        </div>
      </div>

      <OrderTable
        :rows="filteredOrders"
        :totalOrders="orderStore.orders.length"
        :loading="loadingOrders"
        :canRefundDeposit="canRefundDeposit"
        @view="viewOrderDetails"
        @check-in="checkInOrder"
        @cancel="handleCancelOrder"
        @checkout="handleCheckoutOrder"
        @early-checkout="openEarlyCheckoutDialog"
        @extend-stay="openExtendStayDialog"
        @refund="openRefundDepositDialog"
      />

      <OrderDetailsDialog
        v-model="dialogs.details"
        :currentOrder="currentOrder"
        :getStatusColor="viewStore.getStatusColor"
        :getOrderStatusText="viewStore.getOrderStatusText"
        :getRoomTypeName="viewStore.getRoomTypeName"
        :getPaymentMethodName="viewStore.getPaymentMethodName"
        :formatDate="formatDate"
        :formatDateTime="formatDateTime"
        @check-in="checkInOrderFromDetails"
        @change-room="openChangeRoomDialog"
        @checkout="checkoutOrderFromDetails"
        @refund-deposit="openRefundDepositFromDetails"
        @change-order="openChangeOrderDialog"
        @early-checkout="openEarlyCheckoutFromDetails"
        @refresh="handleOrderRefresh"
      />

      <ChangeRoomDialog
        v-model="showChangeRoomDialog"
        :currentOrder="currentOrder"
        :availableRoomOptions="availableRoomOptions"
        :getRoomTypeName="viewStore.getRoomTypeName"
        @change-room="changeRoom"
      />

      <ExtendStayDialog
        v-model="showExtendStayDialog"
        :currentOrder="extendStayOrder"
        :availableRoomOptions="extendStayRoomOptions"
        :getRoomTypeName="viewStore.getRoomTypeName"
        :loadingRooms="loadingExtendStayRooms"
        @extend-stay="handleExtendStay"
        @refresh-rooms="handleRefreshExtendStayRooms"
      />

      <RefundDepositDialog
        v-model="showRefundDepositDialog"
        :order="refundDepositOrder"
        :getStatusColor="viewStore.getStatusColor"
        :getOrderStatusText="viewStore.getOrderStatusText"
        @refund-deposit="handleRefundDeposit"
      />

      <ChangeOrderDialog
        v-model="dialogs.changeOrder"
        :order="currentOrder"
        :availableRooms="changeOrderRooms"
        :getRoomTypeName="viewStore.getRoomTypeName"
        @order-updated="handleOrderUpdated"
      />

      <EarlyCheckoutDialog
        v-model="dialogs.earlyCheckout"
        :order="earlyCheckoutOrder"
        @success="handleEarlyCheckoutSuccess"
      />

      <CheckInConfirmDialog
        v-model="dialogs.checkInConfirm"
        :order="checkInOrder_ref"
        :getRoomTypeName="viewStore.getRoomTypeName"
        :getPaymentMethodName="viewStore.getPaymentMethodName"
        :formatDate="formatDate"
        @confirm="handleCheckInConfirm"
      />
    </div>
  </q-page>
</template>

<script setup>
import { ref, onMounted, onActivated, toRef, watch } from 'vue'
import { useQuasar } from 'quasar'

// Stores
import { useOrderStore } from 'src/stores/orderStore'
import { useRoomStore } from 'src/stores/roomStore'
import { useViewStore } from 'src/stores/viewStore'
import { useBillStore } from 'src/stores/billStore'

// Components
import OrderFilterBar from './components/OrderFilterBar.vue'
import OrderTable from './components/OrderTable.vue'
import OrderDetailsDialog from './components/OrderDetailsDialog.vue' // 路径修正
import ChangeOrderDialog from './components/ChangeOrderDialog.vue'   // 路径修正
import ChangeRoomDialog from './components/ChangeRoomDialog.vue'     // 路径修正
import ExtendStayDialog from './components/ExtendStayDialog.vue'     // 路径修正
import RefundDepositDialog from './components/RefundDepositDialog.vue' // 路径修正
import EarlyCheckoutDialog from './components/EarlyCheckoutDialog.vue' // 路径修正
import CheckInConfirmDialog from 'src/components/CheckInConfirmDialog.vue' // 保持原路径或修正

// Composables
import { useOrderFilters } from './composables/useOrderFilters'
import { useOrderActions } from './composables/useOrderActions'
import { useRefundLogic } from './composables/useRefundLogic'
import { useExtendStay } from './composables/useExtendStay'
import { useChangeRoom } from './composables/useChangeRoom'
import { useDialogState } from './composables/useDialogState' // 新增

const $q = useQuasar()
const orderStore = useOrderStore()
const roomStore = useRoomStore()
const viewStore = useViewStore()
const billStore = useBillStore()

const loadingOrders = ref(false)
const fetchError = ref(null)

// --- 1. 状态管理 (新) ---
const { dialogs } = useDialogState()

// --- 2. 核心数据获取 ---
async function fetchAllOrders() {
  try {
    fetchError.value = null
    loadingOrders.value = true
    await orderStore.fetchAllOrders()
    await refreshRefundableStatus(orderStore.orders)
  } catch (error) {
    console.error('获取订单数据失败:', error)
    fetchError.value = error.message || '请刷新页面重试'
  } finally {
    loadingOrders.value = false
  }
}
async function retryFetchOrders() { await fetchAllOrders() }

// --- 3. 筛选逻辑 Hook ---
const {
  searchQuery, filterStatus, filterDate, statusOptions, filteredOrders, clearFilters, formatDate
} = useOrderFilters(toRef(orderStore, 'orders'))

function searchOrders() {
  loadingOrders.value = true
  setTimeout(() => { loadingOrders.value = false }, 100)
}

// --- 4. 基础操作 Hook (取消、退房) ---
const { handleCancelOrder, handleCheckoutOrder } = useOrderActions(orderStore, roomStore, fetchAllOrders)

// --- 5. 功能模块 Hook (保留原有结构，因为它们包含业务逻辑) ---
// 退押金
const {
  showRefundDepositDialog, refundDepositOrder, canRefundDeposit, refreshRefundableStatus,
  openRefundDepositDialog, handleRefundDeposit
} = useRefundLogic(fetchAllOrders)

// 续住
const {
  showExtendStayDialog, extendStayOrder, extendStayRoomOptions, loadingExtendStayRooms,
  openExtendStayDialog, handleExtendStay, handleRefreshExtendStayRooms
} = useExtendStay(fetchAllOrders)

// 换房
const {
  showChangeRoomDialog, availableRoomOptions,
  openChangeRoomDialog, changeRoom
} = useChangeRoom(fetchAllOrders, formatDate)

// --- 6. 页面级交互逻辑 (重构后使用 dialogs.*) ---

// 6.1 详情逻辑
const currentOrder = ref(null)

async function viewOrderDetails(order) {
  currentOrder.value = order
  dialogs.details = true // 使用新状态
  if (order?.orderNumber) {
    try {
      const full = await orderStore.getOrderByNumber(order.orderNumber, true)
      if (full) currentOrder.value = full
    } catch(e) { console.error(e) }
  }
}

async function handleOrderRefresh() {
  await fetchAllOrders()
  if (currentOrder.value?.orderNumber) {
    const latest = await orderStore.getOrderByNumber(currentOrder.value.orderNumber, true)
    if (latest) currentOrder.value = latest
  }
}

// 详情页联动
function checkInOrderFromDetails() {
  if (currentOrder.value) { checkInOrder(currentOrder.value); dialogs.details = false; }
}
function checkoutOrderFromDetails() {
  if (currentOrder.value) { handleCheckoutOrder(currentOrder.value); dialogs.details = false; }
}
function openRefundDepositFromDetails() {
  if (currentOrder.value) openRefundDepositDialog(currentOrder.value)
}
function openEarlyCheckoutFromDetails() {
  if (currentOrder.value) openEarlyCheckoutDialog(currentOrder.value)
}

// 6.2 入住确认
const checkInOrder_ref = ref(null)
function checkInOrder(order) {
  if (!order) return
  checkInOrder_ref.value = order
  dialogs.checkInConfirm = true // 使用新状态
}
async function handleCheckInConfirm(order) {
  dialogs.checkInConfirm = false
  loadingOrders.value = true
  try {
    await orderStore.checkIn(order.orderNumber, order.deposit)
    $q.notify({ type: 'positive', message: '入住成功' })
    await fetchAllOrders()
    await roomStore.fetchAllRooms()
  } catch (e) {
    $q.notify({ type: 'negative', message: '入住失败: ' + e.message })
  } finally {
    loadingOrders.value = false
  }
}

// 6.3 修改订单 (ChangeOrder)
const changeOrderRooms = ref([])
async function openChangeOrderDialog() {
  if (!currentOrder.value) return
  try {
    const s = formatDate(currentOrder.value.checkInDate)
    const e = formatDate(currentOrder.value.checkOutDate)
    if (!s || !e) return

    // 这里可以进一步优化，移入 useChangeOrderLogic，但暂时保留数据获取逻辑
    const rooms = await roomStore.getAvailableRoomsByDate(s, e)
    const cur = roomStore.getRoomByNumber(currentOrder.value.roomNumber)
    const merged = [...rooms]
    if (cur && !merged.find(r => r.room_number === cur.room_number)) merged.unshift(cur)
    changeOrderRooms.value = merged

    dialogs.changeOrder = true // 使用新状态
  } catch(e) { console.warn(e); changeOrderRooms.value = [] }
}

async function handleOrderUpdated() {
  dialogs.changeOrder = false
  loadingOrders.value = true
  try {
    await handleOrderRefresh()
    await roomStore.fetchAllRooms()
  } catch (e) {
    $q.notify({ type: 'negative', message: '刷新订单失败' })
  } finally { loadingOrders.value = false }
}

// 6.4 提前退房
const earlyCheckoutOrder = ref(null)
function openEarlyCheckoutDialog(order) {
  if (!order) return
  earlyCheckoutOrder.value = order
  dialogs.earlyCheckout = true // 使用新状态
}

async function handleEarlyCheckoutSuccess(data) {
  try {
    loadingOrders.value = true
    dialogs.earlyCheckout = false
    earlyCheckoutOrder.value = null
    await fetchAllOrders()
    await roomStore.fetchAllRooms()
    $q.notify({ type: 'positive', message: '提前退房成功' })
  } catch (e) {
    const msg = e?.message || '提前退房失败'
    $q.notify({ type: 'negative', message: '提前退房失败: ' + msg })
  } finally {
    loadingOrders.value = false
  }
}

// 辅助格式化
function formatDateTime(str) {
  if (!str) return ''
  try {
    const d = str.includes('T') ? new Date(str) : new Date(str)
    return isNaN(d.getTime()) ? str : d.toLocaleString('zh-CN', {
      year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
    }).replace(/\//g, '-')
  } catch { return str }
}

// --- 生命周期 ---
async function loadInitialData() {
  await fetchAllOrders()
  try {
    if (!billStore.bills?.length) await billStore.fetchAllBills()
  } catch (e) {}
}

onMounted(loadInitialData)
onActivated(loadInitialData)

watch(() => orderStore.orders, (newOrders) => {
  refreshRefundableStatus(newOrders).catch(() => {})
}, { deep: true })

</script>

<style scoped>
.view-orders {
  max-width: 1200px;
  margin: 0 auto;
}
</style>
