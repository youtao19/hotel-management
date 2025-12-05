<template>
  <q-dialog
    :model-value="modelValue"
    @update:model-value="val => emit('update:modelValue', val)"
    persistent
  >
    <q-card style="min-width: 450px; max-width: 600px;">
      <q-card-section class="row items-center q-pb-none">
        <div class="text-h6">续住办理</div>
        <q-space />
        <q-btn icon="close" flat round dense v-close-popup />
      </q-card-section>

      <q-card-section>
        <!-- 原订单信息显示 -->
        <div class="q-mb-md">
          <div class="text-subtitle2 q-mb-sm">原订单信息</div>
          <div class="q-pa-sm rounded-borders" style="border: 1px solid #e0e0e0;">
            <div class="row q-col-gutter-sm text-body2">
              <div class="col-6">订单号: {{ currentOrder?.orderNumber }}</div>
              <div class="col-6">客人: {{ currentOrder?.guestName }}</div>
              <div class="col-6">房间: {{ currentOrder?.roomNumber }}</div>
              <div class="col-6">房型: {{ getRoomTypeName(currentOrder?.roomType) }}</div>
            </div>
          </div>
        </div>

        <!-- 续住房间选择 -->
        <div class="q-mb-md">
          <div class="row items-center q-mb-sm">
            <div class="col">
              <div class="text-subtitle2">续住房间</div>
            </div>
            <div class="col-auto" v-if="originalRoomAvailable">
              <q-btn
                size="sm"
                outline
                color="primary"
                label="继续住原房间"
                @click="selectOriginalRoom"
                :loading="loadingRooms"
              />
            </div>
          </div>

          <q-select
            v-model="selectedRoom"
            :options="availableRoomOptions"
            label="选择房间"
            filled
            emit-value
            map-options
            :loading="loadingRooms"
            :hint="`可用房间: ${availableRoomOptions.length} 间`"
          >
            <template v-slot:no-option>
              <q-item>
                <q-item-section class="text-grey">
                  没有可用房间
                </q-item-section>
              </q-item>
            </template>
          </q-select>
        </div>

        <!-- 续住时间选择 -->
        <div class="q-mb-md">
          <div class="text-subtitle2 q-mb-sm">续住时间</div>
          <div class="row q-col-gutter-md">
            <div class="col">
              <q-input
                v-model="extendStartDate"
                label="入住日期"
                filled
                type="date"
                :min="today"
              />
            </div>
            <div class="col">
              <q-input
                v-model="extendEndDate"
                label="离店日期"
                filled
                type="date"
                :min="extendStartDate || today"
              />
            </div>
          </div>
        </div>

        <!-- 新订单号设置 -->
        <div class="q-mb-md">
          <div class="text-subtitle2 q-mb-sm">新订单号</div>
          <div class="row q-col-gutter-sm items-end">
            <div class="col">
              <q-input
                v-model="newOrderNumber"
                label="订单号"
                filled
                dense
                :rules="[
                  val => !!val?.trim() || '请输入订单号',
                  val => val?.length >= 5 || '订单号至少5位字符',
                  val => val?.length <= 20 || '订单号不能超过20位字符',
                  val => !/\s/.test(val) || '订单号不能包含空格'
                ]"
              />
            </div>
            <div class="col-auto">
              <q-btn
                color="primary"
                icon="refresh"
                @click="generateNewOrderNumber"
                flat
                dense
              >
                <q-tooltip>重新生成</q-tooltip>
              </q-btn>
            </div>
          </div>
        </div>

        <!-- 客人信息 -->
        <div class="q-mb-md">
          <div class="text-subtitle2 q-mb-sm">客人信息</div>
          <div class="row q-col-gutter-md">
            <div class="col">
              <q-input
                v-model="guestName"
                label="客人姓名"
                filled
                dense
                :rules="[val => !!val?.trim() || '请输入客人姓名']"
              />
            </div>
            <div class="col">
              <q-input
                v-model="guestPhone"
                label="手机号(可选)"
                filled
                dense
                mask="###-####-####"
                unmasked-value
                :rules="[
                  val => !val || val.length === 11 || '手机号必须为11位数字'
                ]"
              />
            </div>
          </div>
        </div>

        <!-- 支付方式 -->
        <div class="q-mb-md">
          <div class="text-subtitle2 q-mb-sm">支付方式</div>
          <q-select
            v-model="paymentMethod"
            :options="paymentMethodOptions"
            label="选择支付方式"
            filled
            dense
            emit-value
            map-options
            :rules="[val => !!val || '请选择支付方式']"
          />
        </div>

        <!-- 价格信息 -->
        <div class="q-mb-md" v-if="selectedRoomInfo">
          <div class="text-subtitle2 q-mb-sm">价格信息 (续住天数: {{ stayDays }}天)</div>

          <!-- 单日续住 -->
          <div v-if="stayDays === 1">
            <q-input
              v-model.number="customUnitPrice"
              type="number"
              label="续住单价"
              dense
              filled
              :rules="singlePriceRules"
              prefix="¥"
              @update:model-value="userModifiedPrice = true"
            />
          </div>

          <!-- 多日续住 -->
          <div v-else>
            <q-markup-table flat bordered dense>
              <tbody>
                <tr v-for="d in stayDateList" :key="d">
                  <td class="text-caption" style="width:100px">{{ formatDay(d) }}</td>
                  <td>
                    <q-input
                      v-model.number="dailyPrices[d]"
                      type="number"
                      dense
                      filled
                      :rules="[v=>v!==undefined && v!==null && v!=='' || '必填', v=>parseFloat(v)>0 || '需>0']"
                      prefix="¥"
                      @update:model-value="recalcTotal"
                    />
                  </td>
                </tr>
              </tbody>
            </q-markup-table>
          </div>

          <!-- 总价 -->
          <div class="q-mt-sm q-pa-sm rounded-borders" style="border: 1px solid #e0e0e0;">
            <div class="row items-center">
              <div class="col text-body2">总价</div>
              <div class="col-auto text-h6 text-primary">¥{{ totalPrice }}</div>
            </div>
          </div>
        </div>

        <!-- 备注 -->
        <div class="q-mb-md">
          <q-input
            v-model="notes"
            label="备注(可选)"
            filled
            dense
            type="textarea"
            rows="2"
          />
        </div>
      </q-card-section>

      <q-card-actions align="right">
        <q-btn flat label="取消" color="grey" v-close-popup />
        <q-btn
          label="确认续住"
          color="primary"
          @click="confirmExtendStay"
          :disable="!canConfirm"
          :loading="submitting"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup>
import { ref, computed, watch, nextTick } from 'vue'
import { date } from 'quasar'
import { useViewStore } from '../stores/viewStore'
import Decimal from 'decimal.js'

const viewStore = useViewStore()

// Props
const props = defineProps({
  modelValue: Boolean,
  currentOrder: Object,
  availableRoomOptions: Array,
  getRoomTypeName: Function,
  loadingRooms: Boolean
})

// Emits
const emit = defineEmits(['update:modelValue', 'extend-stay', 'refresh-rooms'])

const toDecimal = (val) => {
  try { return new Decimal(val || 0) } catch { return new Decimal(0) }
}
const toAmountNumber = (val) => Number(toDecimal(val).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toString())

// 响应式数据
const selectedRoom = ref(null)
const extendStartDate = ref('')
const extendEndDate = ref('')
const guestName = ref('')
const guestPhone = ref('')
const notes = ref('')
const submitting = ref(false)
const newOrderNumber = ref('')
const paymentMethod = ref('')
// 可编辑续住单价
const customUnitPrice = ref(0)
// 用户是否手动修改了价格
const userModifiedPrice = ref(false)
// 多日价格对象 (key=YYYY-MM-DD)
const dailyPrices = ref({})
const singlePriceRules = [
  val => val !== null && val !== undefined && val !== '' || '请输入房价',
  val => toDecimal(val).gt(0) || '房价必须大于0'
]

// 支付方式选项
const paymentMethodOptions = computed(() => viewStore.paymentMethodOptions)

// 监听日期变化，重新获取可用房间
watch([extendStartDate, extendEndDate], ([newStartDate, newEndDate]) => {
  if (newStartDate && newEndDate && newStartDate < newEndDate) {
    emit('refresh-rooms', { startDate: newStartDate, endDate: newEndDate })
    // 如果当前选择的是原房间，但在新日期范围内不可用，则清空选择
    if (selectedRoom.value === props.currentOrder?.roomNumber) {
      // 延迟检查，等待可用房间列表更新
      setTimeout(() => {
        if (!originalRoomAvailable.value) {
          selectedRoom.value = null
        }
      }, 500)
    } else {
      selectedRoom.value = null // 重置房间选择
    }
  }
})

// 计算属性
const today = computed(() => {
  return date.formatDate(new Date(), 'YYYY-MM-DD')
})

const selectedRoomInfo = computed(() => {
  if (!selectedRoom.value || !props.availableRoomOptions) return null
  const option = props.availableRoomOptions.find(opt => opt.value === selectedRoom.value)
  return option ? { price: option.price, type: option.type } : null
})

const stayDays = computed(() => {
  if (!extendStartDate.value || !extendEndDate.value) return 0
  const start = new Date(extendStartDate.value)
  const end = new Date(extendEndDate.value)
  const diffTime = end - start
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  return diffDays > 0 ? diffDays : 0
})

const totalPrice = computed(() => {
  if (!selectedRoomInfo.value || !stayDays.value) return 0
  if (stayDays.value === 1) {
    const unit = toDecimal(customUnitPrice.value)
    return toAmountNumber(unit)
  }
  const sum = Object.values(dailyPrices.value).reduce((acc, v) => acc.plus(toDecimal(v)), new Decimal(0))
  return toAmountNumber(sum)
})

const canConfirm = computed(() => {
  // 手机号变为可选，但如果填了必须是11位
  const phoneValid = !guestPhone.value || guestPhone.value.trim().length === 11
  if (!(selectedRoom.value && extendStartDate.value && extendEndDate.value && guestName.value.trim() && phoneValid && newOrderNumber.value.trim() && paymentMethod.value && stayDays.value > 0)) return false
  if (stayDays.value === 1) return toDecimal(customUnitPrice.value).gt(0)
  // 多日：所有 dailyPrices 完整且>0
  const dates = stayDateList.value
  if (!dates.length) return false
  return dates.every(d => toDecimal(dailyPrices.value[d]).gt(0))
})

// 检查原房间是否在可用房间列表中
const originalRoomAvailable = computed(() => {
  if (!props.currentOrder?.roomNumber || !props.availableRoomOptions) return false
  return props.availableRoomOptions.some(option => option.value === props.currentOrder.roomNumber)
})

// 生成新的订单号
function generateNewOrderNumber() {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  const hour = String(now.getHours()).padStart(2, '0')
  const minute = String(now.getMinutes()).padStart(2, '0')
  const second = String(now.getSeconds()).padStart(2, '0')
  const millisecond = String(now.getMilliseconds()).padStart(3, '0')

  // 使用毫秒时间戳的后4位作为随机数，确保唯一性
  const timestamp = now.getTime()
  const uniqueId = String(timestamp).slice(-4)

  // 格式：原订单号前4位-EXT月日时分秒+唯一ID (严格控制在20位以内)
  const originalNumber = props.currentOrder?.orderNumber || 'ORDER'
  const shortOriginal = originalNumber.substring(0, 4) // 只取前4位给更多空间
  newOrderNumber.value = `${shortOriginal}EXT${month}${day}${hour}${minute}${uniqueId}`
}

// 选择原房间
function selectOriginalRoom() {
  if (props.currentOrder?.roomNumber) {
    selectedRoom.value = props.currentOrder.roomNumber
  }
}

// 当选择房间改变时，初始化可编辑单价
watch(selectedRoomInfo, (info) => {
  if (info) {
    // 只在用户未手动修改价格且价格为0或未设置时才自动填充
    if (!userModifiedPrice.value && (!customUnitPrice.value || customUnitPrice.value <= 0)) {
      customUnitPrice.value = info.price
    }
    // 同时更新多日续住的每日价格（如果当前价格为0或未设置）
    if (stayDateList.value.length > 0) {
      const updated = { ...dailyPrices.value }
      stayDateList.value.forEach(d => {
        if (!updated[d] || parseFloat(updated[d]) <= 0) {
          updated[d] = userModifiedPrice.value ? customUnitPrice.value : info.price
        }
      })
      dailyPrices.value = updated
    }
  } else {
    // 只在用户未手动修改且没有输入时才重置为0
    if (!userModifiedPrice.value && (!customUnitPrice.value || customUnitPrice.value <= 0)) {
      customUnitPrice.value = 0
    }
  }
})

// 生成续住每日日期列表 (入住日至离店日前一日)
const stayDateList = computed(() => {
  if (!extendStartDate.value || !extendEndDate.value) return []
  const res = []
  const start = new Date(extendStartDate.value)
  const end = new Date(extendEndDate.value) // checkout
  for (let d = new Date(start); d < end; d.setDate(d.getDate()+1)) {
    res.push(d.toISOString().split('T')[0])
  }
  return res
})

// 监听日期范围变化构建 dailyPrices
watch(stayDateList, (list) => {
  const current = { ...dailyPrices.value }
  // 删除不存在的
  Object.keys(current).forEach(k => { if (!list.includes(k)) delete current[k] })
  // 新增的设默认价：优先使用 selectedRoomInfo 的价格，其次 customUnitPrice
  const defaultPrice = selectedRoomInfo.value?.price || toAmountNumber(customUnitPrice.value) || 0
  list.forEach(d => {
    if (current[d] === undefined) {
      current[d] = defaultPrice
    }
  })
  dailyPrices.value = current
}, { immediate: true })

function recalcTotal(){ /* 占位: totalPrice computed 自动更新 */ }

function formatDay(str){
  if(!str) return ''
  try { const d = new Date(str); return `${d.getMonth()+1}-${d.getDate()}` } catch { return str }
}

// 监听对话框打开，初始化数据
watch(() => props.modelValue, (newVal) => {
  if (newVal && props.currentOrder) {
    // 初始化客人信息
    guestName.value = props.currentOrder.guestName || ''
    guestPhone.value = props.currentOrder.phone || ''

    // 设置默认入住日期为今天
    extendStartDate.value = today.value

    // 设置默认离店日期为明天
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    extendEndDate.value = date.formatDate(tomorrow, 'YYYY-MM-DD')

    // 重置其他字段
    selectedRoom.value = null
    notes.value = ''
    submitting.value = false

    // 初始化支付方式（默认第一个或原订单的支付方式）
    paymentMethod.value = props.currentOrder.paymentMethod || viewStore.paymentMethodOptions[0]?.value || ''

    // 生成新的订单号
    generateNewOrderNumber()

    // 自动触发房间刷新
    setTimeout(() => {
      emit('refresh-rooms', {
        startDate: extendStartDate.value,
        endDate: extendEndDate.value
      })
    }, 100)
    // 初始化单价（如果原订单是JSON对象，取其最后一晚或第一晚单价）
    try {
      const rp = props.currentOrder.roomPrice
      if (rp && typeof rp === 'object') {
        const keys = Object.keys(rp).sort()
        if (keys.length) customUnitPrice.value = toAmountNumber(rp[keys[keys.length-1]]) || toAmountNumber(rp[keys[0]]) || 0
      } else if (typeof rp === 'number') {
        customUnitPrice.value = toAmountNumber(rp)
      }
    } catch(e){ customUnitPrice.value = selectedRoomInfo.value?.price || 0 }
  } else if (!newVal) {
    // 对话框关闭时重置所有字段
    selectedRoom.value = null
    extendStartDate.value = ''
    extendEndDate.value = ''
    guestName.value = ''
    guestPhone.value = ''
    notes.value = ''
    submitting.value = false
    newOrderNumber.value = ''
    paymentMethod.value = ''
    customUnitPrice.value = 0
    userModifiedPrice.value = false
    dailyPrices.value = {}
  }
})

// 确认续住
async function confirmExtendStay() {
  if (!canConfirm.value) return

  submitting.value = true
  try {
    const extendStayData = {
      orderNumber: newOrderNumber.value.trim(), // 使用用户设置的新订单号
      originalOrderNumber: props.currentOrder.orderNumber,
      roomNumber: selectedRoom.value,
      roomType: selectedRoomInfo.value.type,
      roomPrice: stayDays.value === 1
        ? (toAmountNumber(customUnitPrice.value) || selectedRoomInfo.value.price)
        : Object.fromEntries(Object.entries(dailyPrices.value).map(([k, v]) => [k, toAmountNumber(v)])),
      checkInDate: extendStartDate.value,
      checkOutDate: extendEndDate.value,
      guestName: guestName.value.trim(),
      phone: guestPhone.value.trim(),
      idNumber: props.currentOrder.idNumber, // 从原订单继承身份证号
      paymentMethod: paymentMethod.value, // 支付方式
      totalPrice: totalPrice.value,
      stayDays: stayDays.value,
      notes: notes.value.trim(),
      orderSource: props.currentOrder?.orderSource || '续住',
      stayType: props.currentOrder?.stayType || '客房',
      // 从原订单继承的信息
      originalGuestName: props.currentOrder.guestName,
      originalRoomNumber: props.currentOrder.roomNumber,
      originalCheckOutDate: props.currentOrder.checkOutDate
    }

    emit('extend-stay', extendStayData)
  } finally {
    submitting.value = false
  }
}
</script>

<style scoped>
.rounded-borders {
  border-radius: 4px;
}

.q-markup-table {
  background: transparent;
}

.q-markup-table td {
  padding: 8px;
}
</style>
