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
        v-model="showOrderDetails"
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
        v-model="showChangeOrderDialog"
        :order="currentOrder"
        :availableRooms="changeOrderRooms"
        :getRoomTypeName="viewStore.getRoomTypeName"
        @order-updated="handleOrderUpdated"
      />

      <EarlyCheckoutDialog
        v-model="showEarlyCheckoutDialog"
        :order="earlyCheckoutOrder"
        @success="handleEarlyCheckoutSuccess"
      />

      <CheckInConfirmDialog
        v-model="showCheckInConfirmDialog"
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
import { ref, watch, onMounted, onActivated, toRef } from 'vue'
import { useQuasar } from 'quasar'

// Stores
import { useOrderStore } from 'src/stores/orderStore'
import { useRoomStore } from 'src/stores/roomStore'
import { useViewStore } from 'src/stores/viewStore'
import { useBillStore } from 'src/stores/billStore'

// APIs
import { orderApi } from 'src/api'

// Components
import OrderFilterBar from './components/OrderFilterBar.vue'
import OrderTable from './components/OrderTable.vue'
import OrderDetailsDialog from 'src/components/OrderDetailsDialog.vue'
import ChangeOrderDialog from 'src/components/ChangeOrderDialog.vue'
import ChangeRoomDialog from 'src/components/ChangeRoomDialog.vue'
import ExtendStayDialog from 'src/components/ExtendStayDialog.vue'
import RefundDepositDialog from 'src/components/RefundDepositDialog.vue'
import EarlyCheckoutDialog from 'src/components/EarlyCheckoutDialog.vue'
import CheckInConfirmDialog from 'src/components/CheckInConfirmDialog.vue'

// Composables
import { useOrderFilters } from './composables/useOrderFilters'
import { useOrderActions } from './composables/useOrderActions'
import { useRefundLogic } from './composables/useRefundLogic'
import { useExtendStay } from './composables/useExtendStay'
import { useChangeRoom } from './composables/useChangeRoom'

const $q = useQuasar()
const orderStore = useOrderStore()
const roomStore = useRoomStore()
const viewStore = useViewStore()
const billStore = useBillStore()

const loadingOrders = ref(false)
const fetchError = ref(null)

// --- 核心数据获取 ---
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

// --- 1. 筛选逻辑 Hook ---
const {
  searchQuery, filterStatus, filterDate, statusOptions, filteredOrders, clearFilters, formatDate
} = useOrderFilters(toRef(orderStore, 'orders'))

// 模拟搜索延迟
function searchOrders() {
  loadingOrders.value = true
  setTimeout(() => { loadingOrders.value = false }, 100)
}

// --- 2. 基础操作 Hook (取消、退房) ---
const { handleCancelOrder, handleCheckoutOrder } = useOrderActions(orderStore, roomStore, fetchAllOrders)

// --- 3. 退押金 Hook ---
const {
  showRefundDepositDialog, refundDepositOrder, canRefundDeposit, refreshRefundableStatus,
  openRefundDepositDialog, handleRefundDeposit
} = useRefundLogic(fetchAllOrders)

// --- 4. 续住 Hook ---
const {
  showExtendStayDialog, extendStayOrder, extendStayRoomOptions, loadingExtendStayRooms,
  openExtendStayDialog, handleExtendStay, handleRefreshExtendStayRooms
} = useExtendStay(fetchAllOrders)

// --- 5. 换房 Hook ---
// 注意：传入 currentOrder 供详情页使用，或直接传给 dialog 调用
const {
  showChangeRoomDialog, availableRoomOptions,
  openChangeRoomDialog, changeRoom
} = useChangeRoom(fetchAllOrders, formatDate)


// --- 6. 剩余的简单逻辑 (详情、入住、修改订单、提前退房) ---
// 这些逻辑相对简单或耦合度极高，可以暂时保留在主文件，或者继续拆分

// 详情
const showOrderDetails = ref(false)
const currentOrder = ref(null)
async function viewOrderDetails(order) {
  currentOrder.value = order
  showOrderDetails.value = true
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

// 详情页联动操作
function checkInOrderFromDetails() {
  if (currentOrder.value) { checkInOrder(currentOrder.value); showOrderDetails.value = false; }
}
function checkoutOrderFromDetails() {
  if (currentOrder.value) { handleCheckoutOrder(currentOrder.value); showOrderDetails.value = false; }
}
function openRefundDepositFromDetails() {
  if (currentOrder.value) openRefundDepositDialog(currentOrder.value)
}
function openEarlyCheckoutFromDetails() {
  if (currentOrder.value) openEarlyCheckoutDialog(currentOrder.value)
}

// 入住确认
const showCheckInConfirmDialog = ref(false)
const checkInOrder_ref = ref(null)
function checkInOrder(order) {
  if (!order) return
  checkInOrder_ref.value = order
  showCheckInConfirmDialog.value = true
}
async function handleCheckInConfirm(order) {
  showCheckInConfirmDialog.value = false
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

// 修改订单 (ChangeOrder)
const showChangeOrderDialog = ref(false)
const changeOrderRooms = ref([])
async function openChangeOrderDialog() {
  if (!currentOrder.value) return
  try {
    const s = formatDate(currentOrder.value.checkInDate)
    const e = formatDate(currentOrder.value.checkOutDate)
    if (!s || !e) return
    const rooms = await roomStore.getAvailableRoomsByDate(s, e)
    // 补当前房间
    const cur = roomStore.getRoomByNumber(currentOrder.value.roomNumber)
    const merged = [...rooms]
    if (cur && !merged.find(r => r.room_number === cur.room_number)) merged.unshift(cur)
    changeOrderRooms.value = merged
    showChangeOrderDialog.value = true
  } catch(e) { console.warn(e); changeOrderRooms.value = [] }
}
async function handleOrderUpdated(data) {
  showChangeOrderDialog.value = false
  loadingOrders.value = true
  try {
    await orderStore.updateOrder(data.orderNumber, data)
    $q.notify({ type: 'positive', message: '更新成功' })
    if (currentOrder.value?.orderNumber === data.orderNumber) {
      const updated = orderStore.orders.find(o => o.orderNumber === data.orderNumber)
      if (updated) currentOrder.value = updated
    }
  } catch(e) {
    $q.notify({ type: 'negative', message: '更新失败' })
  } finally { loadingOrders.value = false }
}

// 提前退房
const showEarlyCheckoutDialog = ref(false)
const earlyCheckoutOrder = ref(null)
function openEarlyCheckoutDialog(order) {
  if (!order) return
  earlyCheckoutOrder.value = order
  showEarlyCheckoutDialog.value = true
}
async function handleEarlyCheckoutSuccess() {
  await fetchAllOrders()
  await roomStore.fetchAllRooms()
  showEarlyCheckoutDialog.value = false
}

// 辅助格式化 (详情页用)
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

// 监听数据变化刷新退押状态
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
