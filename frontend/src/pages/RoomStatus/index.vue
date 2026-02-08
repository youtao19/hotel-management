<template>
  <q-page class="room-status">
    <div class="q-pa-md">

      <RoomFilterBar
        v-model:date="selectedDate"
        v-model:type="selectedRoomType"
        v-model:status="filterStatus"
        :room-type-options="roomTypeSelectOptions"
        :status-options="statusOptions"
        :loading="roomStore.loading"
        :total-available="totalAvailableRooms"
        @search="queryRoomStatus"
        @reset="resetAllFilters"
        @update:date="onDateChange"
      />

      <div class="room-grid">
        <div class="row q-col-gutter-md">
          <div
            v-for="room in filteredRooms"
            :key="room.room_number"
            class="col-lg-3 col-md-4 col-sm-6 col-xs-12"
          >
            <RoomCard
              :room="room"
              @click-card="showRoomCalendar"
              @show-remarks="showOrderRemarks"
              @book="handleBookRoomClick"
              @check-in="checkInRoom"
              @check-out="checkOut"
              @set-cleaning="room => setRoomCleaning(room.room_number)"
              @set-maintenance="room => setMaintenance(room.room_number)"
              @finish-maintenance="room => clearMaintenance(room.room_number)"
              @finish-cleaning="room => clearCleaning(room.room_number)"
            />
          </div>
        </div>
      </div>

      <div v-if="filteredRooms.length === 0" class="text-center q-pa-lg">
        <q-icon name="search_off" size="5rem" color="grey-5" />
        <div class="text-h6 text-grey-7 q-mt-md">没有找到符合条件的房间</div>
        <q-btn color="primary" label="重置筛选" @click="resetAllFilters" class="q-mt-md" />
      </div>
    </div>

    <RoomCalendarDialog ref="calendarDialogRef" />

    <CheckInConfirmDialog
      v-model="showCheckInConfirmDialog"
      :order="pendingCheckInOrder"
      :get-room-type-name="viewStore.getRoomTypeName"
      :get-payment-method-name="viewStore.getPaymentMethodName"
      :payment-options="viewStore.paymentMethodOptions"
      :format-date="formatDateForDialog"
      @confirm="handleCheckInConfirm"
    />
  </q-page>
</template>

<script setup>
import { ref, watch, onMounted } from 'vue' // 移除 computed, useRoute, useRouter 因为逻辑移走了
import { useQuasar } from 'quasar'

// Stores
import { useRoomStore } from '../../stores/roomStore'
import { useViewStore } from '../../stores/viewStore'
import { useOrderStore } from '../../stores/orderStore'

// Hooks (Composables)
import { useRoomFilters } from './composables/useRoomFilters'

// Components
import RoomCard from './components/RoomCard.vue'
import RoomFilterBar from './components/RoomFilterBar.vue'
import RoomCalendarDialog from './components/RoomCalendarDialog.vue'
import CheckInConfirmDialog from '../../components/CheckInConfirmDialog.vue'

// --- 初始化 ---
const $q = useQuasar()
const roomStore = useRoomStore()
const viewStore = useViewStore()
const orderStore = useOrderStore()

// --- 引入核心逻辑 Hook ---
// 这里解构出来的变量，直接在 template 中使用，不需要再定义一遍
const {
  selectedDate,
  selectedRoomType,
  filterStatus,
  statusOptions,
  filteredRooms,
  roomTypeSelectOptions,
  totalAvailableRooms,
  queryRoomStatus,
  resetAllFilters,
  onDateChange,
  loadRoomDataForDate // 从 Hook 中获取数据加载函数
} = useRoomFilters()

// --- 本地 UI 状态 ---
const calendarDialogRef = ref(null)
const showCheckInConfirmDialog = ref(false)
const pendingCheckInOrder = ref(null)

// --- 剩余的业务逻辑 (弹窗、跳转、特定操作) ---

// 监听弹窗关闭清理数据
watch(showCheckInConfirmDialog, (isOpen) => {
  if (!isOpen) pendingCheckInOrder.value = null
})

// 辅助函数
const formatDateForDialog = (dateString) => viewStore.formatDate(dateString)

// 打开日历弹窗
function showRoomCalendar(room) {
  calendarDialogRef.value?.open(room)
}

// 预订跳转
function bookRoom(room) {
  if (!room?.room_number) return
  // 这里需要引入 router，如果 useRoomFilters 里没暴露 router，可以重新 use 一次
  // 或者直接使用 options api 风格，但还是建议 import
}
// 为了 bookRoom 跳转，这里需要补一个 router
import { useRouter } from 'vue-router'
const router = useRouter() // 重新获取 router 实例用于跳转

function handleBookRoomClick(room) { // 重命名一下避免潜在冲突，虽然不必要
  if (!room?.room_number) return
  router.push({
    path: '/CreateOrder',
    query: { roomNumber: room.room_number, roomType: room.type_code }
  })
}

// 办理入住逻辑
async function checkInRoom(room) {
  const orderId = room.order_id || room.orderId
  if (!orderId) return $q.notify({ type: 'warning', message: '无订单信息' })

  const order = await orderStore.getOrderByNumber(orderId)
  if (!order) return $q.notify({ type: 'negative', message: '未找到订单' })

  pendingCheckInOrder.value = { ...order, orderNumber: order.orderNumber || order.order_id }
  showCheckInConfirmDialog.value = true
}

// 确认入住回调
async function handleCheckInConfirm(order) {
  try {
    await orderStore.checkIn(order.orderNumber, {
      deposit: order.deposit,
      depositPaymentMethod: order.depositPaymentMethod,
      roomFeePaymentSplits: order.roomFeePaymentSplits,
      depositPaymentSplits: order.depositPaymentSplits
    })
    $q.notify({ type: 'positive', message: '入住成功' })
    showCheckInConfirmDialog.value = false
    // 操作成功后，调用 Hook 里的刷新方法
    await loadRoomDataForDate(selectedDate.value)
  } catch (e) {
    $q.notify({ type: 'negative', message: e.message || '入住失败' })
  }
}

// 退房逻辑
async function checkOut(room) {
  const orderId = room.order_id || room.orderId
  $q.dialog({
    title: '确认退房',
    message: `确定要为房间 ${room.room_number} 办理退房吗？`,
    cancel: true,
    persistent: true
  }).onOk(async () => {
    try {
      if (orderId) await orderStore.updateOrderStatusViaApi(orderId, 'checked-out')
      await roomStore.checkOutRoom(room.room_number)
      await orderStore.fetchAllOrders()
      // 刷新列表
      await loadRoomDataForDate(selectedDate.value)
      $q.notify({ type: 'positive', message: '退房成功' })
    } catch (e) {
      console.error(e)
      $q.notify({ type: 'negative', message: '退房失败' })
    }
  })
}

// 简单的状态变更操作封装
const createStatusHandler = (actionName, apiFunc, successMsg) => async (roomNumber) => {
  try {
    const success = await apiFunc(roomNumber)
    if (success) {
      $q.notify({ type: 'positive', message: successMsg })
      await loadRoomDataForDate(selectedDate.value)
    } else {
      throw new Error('操作未成功')
    }
  } catch (e) {
    $q.notify({ type: 'negative', message: `${actionName}失败` })
  }
}

const setRoomCleaning = createStatusHandler('设置清洁', (id) => roomStore.updateRoomStatus(id, 'cleaning'), '已设置为清洁状态')
const setMaintenance = createStatusHandler('设置维修', roomStore.setMaintenance, '已设置为维修状态')
const clearMaintenance = createStatusHandler('完成维修', roomStore.clearMaintenance, '维修已完成')
const clearCleaning = createStatusHandler('完成清洁', roomStore.clearCleaning, '清洁已完成')

// 查看备注
async function showOrderRemarks(room) {
  const orderId = room.order_id || room.orderId
  let order = orderId ? await orderStore.getOrderByNumber(orderId) : null

  if (!order) {
    const candidates = (orderStore.orders || []).filter(o => o.roomNumber === room.room_number)
    order = candidates.find(o => ['checked-in', 'pending'].includes(o.status)) || candidates[0]
  }

  const guest = order?.guestName || room.currentGuest || '未知客人'
  const remarks = order?.remarks?.trim() || '无备注'

  $q.dialog({ title: '客人备注', message: `${guest}\n\n${remarks}`, ok: '关闭' })
}
</script>

<style scoped>
/* 仅保留页面布局相关的 CSS */
.room-status {
  max-width: 100%;
  margin: 0 auto;
}

/* 确保网格布局间距正常 */
.room-grid {
  margin-top: 16px;
}
</style>
