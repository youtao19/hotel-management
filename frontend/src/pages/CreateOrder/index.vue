<template>
  <q-page class="check-in q-pa-md" style="max-width: 90%; margin: 0 auto;">
    <!-- <h1 class="text-h4 q-mb-md">创建订单</h1> -->
    <q-card>
      <q-card-section>
        <q-form @submit="submitOrder" class="q-gutter-md">

          <OrderInfoSection
            v-model="orderData"
            :status-options="statusOptions"
            :source-options="sourceOptions"
          />

          <GuestInfoSection v-model="orderData" />

          <StayDateSection
            v-model="orderData"
            :min-date="minDate"
            :lang-zh-cn="langZhCn"
            :date-rule="dateRule"
            :checkout-rule="checkoutAfterCheckinRule"
            :is-valid-full-date="isValidFullDate"
            :is-rest-room="isRestRoom"
            @normalize="normalizeInputDate"
          />

          <RoomSelectionSection
            v-model="orderData"
            :type-options="roomTypeOptionsWithCount"
            :room-options="availableRoomOptions"
            :available-count="availableRoomCount"
            @update-type="onRoomTypeChange"
          />

          <PricingPaymentSection
            :order-data="orderData"
            :daily-prices="dailyPrices"
            :date-list="dateList"
            :is-multi-day="isMultiDay"
            :is-rest-room="isRestRoom"
            v-model:total-price-input="totalPriceInput"
            :total-price="totalPrice"
            :average-price="averageDailyPrice"
            :payment-options="viewStore.paymentMethodOptions"
            :prepay-options="prepayOptions"
            @distribute="distributeTotalPrice"
            @update-total="updateTotalFromDaily"
            @apply-first="applyFirstDayPriceToAll"
          />

          <RemarksSection v-model="orderData" />

          <div class="row justify-end q-mt-md">
            <q-btn label="取消" flat class="q-mr-sm" to="/" />
            <q-btn label="确认创建" type="submit" color="primary" />
          </div>

        </q-form>
      </q-card-section>
    </q-card>

    <CheckInConfirmDialog
      v-model="showCheckInDialog"
      :order="pendingCheckInOrder"
      :get-room-type-name="viewStore.getRoomTypeName"
      :get-payment-method-name="viewStore.getPaymentMethodName"
      :payment-options="viewStore.paymentMethodOptions"
      :format-date="(d) => d"
      @confirm="handleCheckInConfirm"
    />
  </q-page>
</template>

<script setup>
import { onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { date as qDate } from 'quasar'

// 引入子组件
import OrderInfoSection from './components/OrderInfoSection.vue'
import GuestInfoSection from './components/GuestInfoSection.vue'
import StayDateSection from './components/StayDateSection.vue'
import RoomSelectionSection from './components/RoomSelectionSection.vue'
import PricingPaymentSection from './components/PricingPaymentSection.vue'
import RemarksSection from './components/RemarksSection.vue'
import CheckInConfirmDialog from '../../components/CheckInConfirmDialog.vue' // 假设公共组件路径

// 引入业务逻辑
import { useOrderState } from './composables/useOrderState'
import { useDateLogic } from './composables/useDateLogic'
import { useRoomLogic } from './composables/useRoomLogic'
import { usePricingLogic } from './composables/usePricingLogic'
import { useOrderSubmit } from './composables/useOrderSubmit'

// 1. 初始化基础状态
const {
  orderData, statusOptions, sourceOptions, prepayOptions
} = useOrderState()

// 2. 初始化日期逻辑
const dateLogic = useDateLogic(orderData)
const {
  minDate, langZhCn, dateRule, checkoutAfterCheckinRule,
  isValidFullDate, normalizeInputDate, isRestRoom, isMultiDay, dateList
} = dateLogic

// 3. 初始化房间逻辑 (依赖日期)
const roomLogic = useRoomLogic(orderData, dateLogic)
const {
  viewStore, roomTypeOptionsWithCount, availableRoomOptions, availableRoomCount,
  scheduleUpdateRooms, updateAvailableRooms, autoSelectRandomRoom, onRoomTypeChange, findAvailableRoomByNumber
} = roomLogic

// 4. 初始化价格逻辑 (依赖日期和基础数据)
const pricingLogic = usePricingLogic(orderData, dateLogic)
const {
  dailyPrices, totalPriceInput, totalPrice, averageDailyPrice,
  initializeDailyPrices,
  updateTotalFromDaily, distributeTotalPrice, applyFirstDayPriceToAll
} = pricingLogic

// 5. 初始化提交逻辑
const {
  submitOrder, showCheckInDialog, pendingCheckInOrder, handleCheckInConfirm
} = useOrderSubmit(orderData, dailyPrices, dateList, totalPrice)

const route = useRoute()
const normalizeRouteParam = (param) => {
  if (Array.isArray(param)) param = param[0]
  if (param === undefined || param === null) return null
  const str = String(param).trim()
  return str === '' ? null : str
}
const normalizeRouteDateParam = (param) => {
  const normalized = normalizeRouteParam(param)
  if (normalized && /^\d{4}-\d{2}-\d{2}$/.test(normalized)) return normalized
  return null
}
const pendingRouteSelection = ref({
  roomNumber: normalizeRouteParam(route.query.roomNumber),
  roomType: normalizeRouteParam(route.query.roomType),
  checkInDate: normalizeRouteDateParam(route.query.checkInDate)
})

// --- 胶水逻辑：处理跨模块副作用 ---

// 当日期变化时，更新房间列表
watch(
  [() => orderData.value.checkInDate, () => orderData.value.checkOutDate],
  async ([newCheckIn, newCheckOut]) => {
    if (isValidFullDate(newCheckIn) && isValidFullDate(newCheckOut)) {
      scheduleUpdateRooms() // Room Logic

      // 如果房间已选，重新计算基础价格
      if (orderData.value.roomNumber) {
        const room = findAvailableRoomByNumber(orderData.value.roomNumber)
        if (room) {
          await initializeDailyPrices(room.price) // Pricing Logic（后端拆分）
        }
      }
    }
  }
)

// 监听路由参数变化，支持从房态页跳转预选房间
watch(
  () => [route.query.roomNumber, route.query.roomType, route.query.checkInDate],
  () => {
    pendingRouteSelection.value = {
      roomNumber: normalizeRouteParam(route.query.roomNumber),
      roomType: normalizeRouteParam(route.query.roomType),
      checkInDate: normalizeRouteDateParam(route.query.checkInDate)
    }
    applyRouteSelection()
  }
)

// 当房间号改变时（选房），更新价格
watch(() => orderData.value.roomNumber, async (newVal) => {
  if (newVal) {
    const room = findAvailableRoomByNumber(newVal)
    if (room) {
      dailyPrices.value = {} // 重置旧价格
      await initializeDailyPrices(room.price)
    }
  }
})

async function applyRouteSelection() {
  const { roomNumber, roomType, checkInDate } = pendingRouteSelection.value
  if (!roomNumber && !roomType && !checkInDate) return

  if (checkInDate) {
    // 中文注释：从房态页带入入住日期时，默认同步一晚离店日期，减少手工输入。
    orderData.value.checkInDate = checkInDate
    orderData.value.checkOutDate = qDate.formatDate(
      qDate.addToDate(qDate.extractDate(checkInDate, 'YYYY-MM-DD'), { days: 1 }),
      'YYYY-MM-DD'
    )
  }

  if (roomType) {
    orderData.value.roomType = roomType
  }

  await updateAvailableRooms(true, false)

  let matchedRoom = roomNumber ? findAvailableRoomByNumber(roomNumber) : null

  if (!matchedRoom && roomNumber && !roomType) {
    const option = availableRoomOptions.value.find(opt => String(opt.value) === String(roomNumber))
    if (option) {
      orderData.value.roomType = option.type
      await updateAvailableRooms(true, false)
      matchedRoom = findAvailableRoomByNumber(roomNumber)
    }
  }

  if (matchedRoom) {
    orderData.value.roomType = matchedRoom.type_code
    orderData.value.roomNumber = matchedRoom.room_number
  } else if (orderData.value.roomType) {
    autoSelectRandomRoom()
  }

  pendingRouteSelection.value = { roomNumber: null, roomType: null, checkInDate: null }
}

// 初始化
onMounted(async () => {
  await roomLogic.init()
  await applyRouteSelection()
})
</script>
