<template>
  <q-page class="room-status">
    <div class="room-status-shell q-pa-md">
      <RoomFilterBar
        :view-mode="viewMode"
        :date="selectedDate"
        :start-date="calendarStartDate"
        :type="selectedRoomType"
        :status="filterStatus"
        :keyword="keyword"
        :room-type-options="roomTypeSelectOptions"
        :status-options="statusOptions"
        :summary="activeSummary"
        :loading="loading"
        @update:view-mode="switchView"
        @update:date="selectedDate = $event"
        @update:start-date="calendarStartDate = $event"
        @update:type="selectedRoomType = $event"
        @update:status="filterStatus = $event"
        @update:keyword="keyword = $event"
        @search="queryRoomStatus"
        @reset="resetAllFilters"
        @jump-today="jumpToToday"
        @prev-range="goPrevRange"
        @next-range="goNextRange"
      />

      <!-- <div class="view-banner">
        <div>
          <div class="view-title">{{ viewMode === 'day' ? '单日房态' : '14 天日历房' }}</div>
          <div class="view-subtitle">
            {{ viewMode === 'day' ? `${selectedDate} 的现场房态与操作` : `${calendarStartDate} 起的 14 天排房总览` }}
          </div>
        </div>
      </div> -->

      <RoomDayView
        v-if="viewMode === 'day'"
        :rooms="dayRooms"
        @open-detail="openDayRoomDetail"
        @show-remarks="showOrderRemarks"
        @book="handleBookRoomClick"
        @check-in="checkInRoom"
        @check-out="checkOut"
        @set-cleaning="setRoomCleaning"
        @set-maintenance="setMaintenance"
        @finish-maintenance="clearMaintenance"
        @finish-cleaning="clearCleaning"
      />

      <RoomCalendarBoard
        v-else
        :rooms="calendarRooms"
        :daily-summary="calendarDailySummary"
        :today-date="todayDate"
        @open-cell="openCalendarCellDetail"
      />
    </div>

    <RoomStatusDetailDrawer
      v-model="showDetailDrawer"
      :room="detailRoom"
      :cell="detailCell"
      :view-mode="viewMode"
      :today-date="todayDate"
      @go-day-view="handleGoDayView"
      @book="handleBookRoomClick"
      @show-remarks="showOrderRemarks"
      @check-in="checkInRoom"
      @check-out="checkOut"
      @set-cleaning="setRoomCleaning"
      @set-maintenance="setMaintenance"
      @finish-cleaning="clearCleaning"
      @finish-maintenance="clearMaintenance"
    />

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
import { ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useQuasar, date as qDate } from 'quasar'
import { useRoomStore } from 'src/stores/roomStore'
import { useViewStore } from 'src/stores/viewStore'
import { useOrderStore } from 'src/stores/orderStore'
import { useRoomFilters } from './composables/useRoomFilters'
import RoomFilterBar from './components/RoomFilterBar.vue'
import RoomDayView from './components/RoomDayView.vue'
import RoomCalendarBoard from './components/RoomCalendarBoard.vue'
import RoomStatusDetailDrawer from './components/RoomStatusDetailDrawer.vue'
import CheckInConfirmDialog from 'src/components/CheckInConfirmDialog.vue'

const $q = useQuasar()
const router = useRouter()
const roomStore = useRoomStore()
const viewStore = useViewStore()
const orderStore = useOrderStore()
const todayDate = qDate.formatDate(Date.now(), 'YYYY-MM-DD')

const {
  viewMode,
  selectedDate,
  calendarStartDate,
  selectedRoomType,
  filterStatus,
  keyword,
  statusOptions,
  roomTypeSelectOptions,
  dayRooms,
  calendarRooms,
  calendarDailySummary,
  activeSummary,
  loading,
  refreshCurrentView,
  queryRoomStatus,
  resetAllFilters,
  jumpToToday,
  switchView,
  goPrevRange,
  goNextRange,
  openDayViewByDate
} = useRoomFilters()

const showDetailDrawer = ref(false)
const detailRoom = ref(null)
const detailCell = ref(null)
const showCheckInConfirmDialog = ref(false)
const pendingCheckInOrder = ref(null)

watch(showCheckInConfirmDialog, (visible) => {
  // 中文注释：入住确认弹窗关闭后清理缓存订单，避免切换房间时串数据。
  if (!visible) pendingCheckInOrder.value = null
})

watch(showDetailDrawer, (visible) => {
  if (visible) return
  detailRoom.value = null
  detailCell.value = null
})

const formatDateForDialog = (dateString) => viewStore.formatDate(dateString)

function buildDayDetailCell(room) {
  // 中文注释：单日卡片点开详情时，抽屉统一消费与日历格子相同的数据结构。
  return {
    date: selectedDate.value,
    display_status: room.display_status,
    price: room.price,
    order_id: room.order_id,
    order_status: room.order_status,
    guest_name: room.guest_name,
    phone: room.phone,
    remarks: room.remarks,
    check_in_date: room.check_in_date,
    check_out_date: room.check_out_date
  }
}

function openDayRoomDetail(room) {
  detailRoom.value = room
  detailCell.value = buildDayDetailCell(room)
  showDetailDrawer.value = true
}

function openCalendarCellDetail(room, cell) {
  detailRoom.value = {
    ...room,
    display_status: cell.display_status,
    guest_name: cell.guest_name,
    phone: cell.phone,
    remarks: cell.remarks,
    check_in_date: cell.check_in_date,
    check_out_date: cell.check_out_date,
    order_id: cell.order_id,
    order_status: cell.order_status
  }
  detailCell.value = cell
  showDetailDrawer.value = true
}

function handleBookRoomClick(room, cell = null) {
  const targetCell = cell?.date ? cell : detailCell.value
  router.push({
    path: '/CreateOrder',
    query: {
      roomNumber: room.room_number,
      roomType: room.type_code,
      checkInDate: targetCell?.date || selectedDate.value
    }
  })
}

async function checkInRoom(room) {
  const orderId = room.order_id || room.orderId || detailCell.value?.order_id
  if (!orderId) {
    $q.notify({ type: 'warning', message: '当前房间没有可办理入住的订单' })
    return
  }

  const order = await orderStore.getOrderByNumber(orderId)
  if (!order) {
    $q.notify({ type: 'negative', message: '未找到订单详情' })
    return
  }

  pendingCheckInOrder.value = { ...order, orderNumber: order.orderNumber || order.order_id }
  showCheckInConfirmDialog.value = true
}

async function handleCheckInConfirm(order) {
  try {
    await orderStore.checkIn(order.orderNumber, {
      deposit: order.deposit,
      depositPaymentMethod: order.depositPaymentMethod,
      roomFeePaymentSplits: order.roomFeePaymentSplits,
      depositPaymentSplits: order.depositPaymentSplits
    })
    showCheckInConfirmDialog.value = false
    showDetailDrawer.value = false
    await refreshCurrentView()
    $q.notify({ type: 'positive', message: '入住成功' })
  } catch (error) {
    $q.notify({ type: 'negative', message: error.message || '入住失败' })
  }
}

async function checkOut(room) {
  const orderId = room.order_id || room.orderId || detailCell.value?.order_id
  if (!orderId) {
    $q.notify({ type: 'warning', message: '当前房间没有可退房订单' })
    return
  }

  $q.dialog({
    title: '确认退房',
    message: `确定为房间 ${room.room_number} 办理退房吗？`,
    cancel: true,
    persistent: true
  }).onOk(async () => {
    try {
      await orderStore.updateOrderStatusViaApi(orderId, 'checked-out')
      await roomStore.checkOutRoom(room.room_number)
      await orderStore.fetchAllOrders()
      showDetailDrawer.value = false
      await refreshCurrentView()
      $q.notify({ type: 'positive', message: '退房成功' })
    } catch (error) {
      console.error(error)
      $q.notify({ type: 'negative', message: '退房失败' })
    }
  })
}

function createStatusHandler(actionName, apiFunc, successMessage) {
  return async (room) => {
    try {
      const success = await apiFunc(room.room_number)
      if (!success) throw new Error(`${actionName}失败`)
      showDetailDrawer.value = false
      await refreshCurrentView()
      $q.notify({ type: 'positive', message: successMessage })
    } catch (error) {
      $q.notify({ type: 'negative', message: `${actionName}失败` })
    }
  }
}

const setRoomCleaning = createStatusHandler('设置清洁', (roomNumber) => roomStore.updateRoomStatus(roomNumber, 'cleaning'), '已设为清扫状态')
const setMaintenance = createStatusHandler('设置维修', roomStore.setMaintenance, '已设为维修状态')
const clearMaintenance = createStatusHandler('完成维修', roomStore.clearMaintenance, '维修已完成')
const clearCleaning = createStatusHandler('完成清洁', roomStore.clearCleaning, '清洁已完成')

async function showOrderRemarks(room) {
  const orderId = room.order_id || room.orderId || detailCell.value?.order_id
  let order = orderId ? await orderStore.getOrderByNumber(orderId) : null

  if (!order) {
    const candidates = (orderStore.orders || []).filter(item => item.roomNumber === room.room_number)
    order = candidates.find(item => ['checked-in', 'pending', 'reserved'].includes(item.status)) || candidates[0]
  }

  const guest = order?.guestName || detailCell.value?.guest_name || room.guest_name || '未知客人'
  const remarks = order?.remarks?.trim() || detailCell.value?.remarks?.trim() || room.remarks?.trim() || '无备注'
  $q.dialog({ title: '客人备注', message: `${guest}\n\n${remarks}`, ok: '关闭' })
}

async function handleGoDayView(dateString) {
  showDetailDrawer.value = false
  await openDayViewByDate(dateString)
}
</script>

<style scoped>
.room-status {
  max-width: 100%;
  margin: 0 auto;
}

.room-status-shell {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.view-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 4px 0;
}

.view-title {
  font-size: 22px;
  font-weight: 700;
  color: #0f172a;
}

.view-subtitle {
  margin-top: 4px;
  font-size: 13px;
  color: #64748b;
}
</style>
