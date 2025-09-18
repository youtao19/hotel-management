<template>
  <q-dialog
    :model-value="modelValue"
    @update:model-value="val => emit('update:modelValue', val)"
    persistent
  >
    <q-card style="min-width: 450px">
      <q-card-section class="row items-center q-pb-none">
        <div class="text-h6">续住办理</div>
        <q-space />
        <q-btn icon="close" flat round dense v-close-popup />
      </q-card-section>

      <!-- 续住说明提示 -->
      <q-banner class="bg-blue-1 text-blue-9" dense>
        <template v-slot:avatar>
          <q-icon name="info" color="blue" />
        </template>
        续住功能将基于原订单信息创建新的订单，您可以修改客人信息、房间和入住时间。
      </q-banner>

      <q-card-section>
        <!-- 原订单信息显示 -->
        <div class="q-mb-md">
          <div class="text-subtitle2 q-mb-sm">原订单信息:</div>
          <div class="bg-grey-2 q-pa-sm rounded-borders">
            <div class="row q-gutter-sm">
              <div class="col">订单号: {{ currentOrder?.orderNumber }}</div>
              <div class="col">客人: {{ currentOrder?.guestName }}</div>
            </div>
            <div class="row q-gutter-sm q-mt-xs">
              <div class="col">原房间: {{ currentOrder?.roomNumber }}</div>
              <div class="col">房型: {{ getRoomTypeName(currentOrder?.roomType) }}</div>
            </div>
            <div class="row q-gutter-sm q-mt-xs">
              <div class="col">退房日期: {{ currentOrder?.checkOutDate }}</div>
              <div class="col">原房价: {{ formatOriginalRoomPrice(currentOrder?.roomPrice) }}</div>
            </div>
          </div>
        </div>

        <!-- 续住房间选择 -->
        <div class="q-mb-md">
          <div class="text-subtitle2 q-mb-sm">选择续住房间:</div>

          <!-- 原房间继续住选项 -->
          <div class="q-mb-sm" v-if="originalRoomAvailable">
            <q-card flat bordered class="bg-green-1">
              <q-card-section class="q-pa-sm">
                <div class="row items-center">
                  <div class="col">
                    <div class="text-body2 text-weight-medium">
                      推荐：继续住原房间 {{ currentOrder?.roomNumber }}
                    </div>
                    <div class="text-caption text-grey-7">
                      {{ getRoomTypeName(currentOrder?.roomType) }} - ¥{{ currentOrder?.roomPrice }}/晚
                    </div>
                  </div>
                  <div class="col-auto">
                    <q-btn
                      size="sm"
                      color="positive"
                      label="选择原房间"
                      @click="selectOriginalRoom"
                      :loading="loadingRooms"
                    />
                  </div>
                </div>
              </q-card-section>
            </q-card>
          </div>

          <div class="row items-center">
            <div class="col">
              <q-select
                v-model="selectedRoom"
                :options="availableRoomOptions"
                label="选择房间"
                filled
                emit-value
                map-options
                :loading="loadingRooms"
              >
                <template v-slot:no-option>
                  <q-item>
                    <q-item-section class="text-negative">
                      <q-icon name="warning" color="negative" />
                      没有可用房间
                    </q-item-section>
                  </q-item>
                </template>
              </q-select>
            </div>
            <div class="col-auto q-ml-md">
              <q-chip
                :color="availableRoomOptions.length > 0 ? (availableRoomOptions.length <= 3 ? 'warning' : 'positive') : 'negative'"
                text-color="white"
                icon="hotel"
              >
                可用: {{ availableRoomOptions.length }}间
              </q-chip>
            </div>
          </div>
        </div>

        <!-- 续住时间选择 -->
        <div class="q-mb-md">
          <div class="text-subtitle2 q-mb-sm">续住时间:</div>
          <div class="row q-gutter-md">
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
          <div class="text-subtitle2 q-mb-sm">新订单号:</div>
          <div class="row q-gutter-md items-end">
            <div class="col">
              <q-input
                v-model="newOrderNumber"
                label="订单号"
                filled
                :rules="[
                  val => !!val?.trim() || '请输入订单号',
                  val => val?.length >= 5 || '订单号至少5位字符',
                  val => val?.length <= 20 || '订单号不能超过20位字符',
                  val => !/\s/.test(val) || '订单号不能包含空格'
                ]"
                hint="自动生成，可手动修改"
              >
                <template v-slot:append>
                  <q-icon name="edit" color="primary" />
                </template>
              </q-input>
            </div>
            <div class="col-auto">
              <q-btn
                color="secondary"
                icon="refresh"
                label="重新生成"
                @click="generateNewOrderNumber"
                flat
                dense
              >
                <q-tooltip>重新生成订单号</q-tooltip>
              </q-btn>
            </div>
          </div>
          <div class="text-caption text-grey-6 q-mt-xs">
            <div class="row items-center q-gutter-sm">
              <span>基于原订单号: {{ currentOrder?.orderNumber }}</span>
              <q-chip
                v-if="newOrderNumber"
                size="sm"
                color="blue-1"
                text-color="blue-9"
                icon="preview"
              >
                {{ newOrderNumber }}
              </q-chip>
            </div>
          </div>
        </div>

        <!-- 客人信息 -->
        <div class="q-mb-md">
          <div class="text-subtitle2 q-mb-sm">客人信息:</div>
          <div class="row q-gutter-md">
            <div class="col">
              <q-input
                v-model="guestName"
                label="客人姓名"
                filled
                :rules="[val => !!val?.trim() || '请输入客人姓名']"
              />
            </div>
            <div class="col">
              <q-input
                v-model="guestPhone"
                label="手机号"
                filled
                mask="###-####-####"
                unmasked-value
                :rules="[
                  val => !!val?.trim() || '请输入手机号',
                  val => val?.length === 11 || '手机号必须为11位数字'
                ]"
              />
            </div>
          </div>
        </div>

        <!-- 价格信息 -->
        <div class="q-mb-md" v-if="selectedRoomInfo">
          <div class="text-subtitle2 q-mb-sm">价格信息:</div>
          <div class="bg-blue-1 q-pa-sm rounded-borders">
            <div class="row q-gutter-sm">
              <div class="col">原建议单价: ¥{{ selectedRoomInfo.price }}/晚</div>
              <div class="col">续住天数: {{ stayDays }}天</div>
            </div>
      <div class="row q-gutter-sm q-mt-xs" v-if="stayDays === 1">
              <div class="col-12">
                <q-input
                  v-model.number="customUnitPrice"
                  type="number"
                  label="续住单价(可修改)"
          dense
          filled
          bg-color="blue-1"
                  :rules="singlePriceRules"
                  hint="此价格将写入新订单 total_price（单日）"
                >
                  <template #prepend>
                    <q-icon name="attach_money" color="primary" />
                  </template>
                </q-input>
              </div>
            </div>
            <div v-else class="q-mt-xs">
              <div class="text-caption text-grey-7 q-mb-xs">多日续住：可分别调整每天价格</div>
        <q-markup-table flat bordered dense class="price-table-transparent">
                <tbody>
                  <tr v-for="d in stayDateList" :key="d">
                    <td class="text-caption" style="width:90px">{{ formatDay(d) }}</td>
                    <td>
                      <q-input
                        v-model.number="dailyPrices[d]"
                        type="number"
            dense
            filled
            bg-color="blue-1"
                        :rules="[v=>v!==undefined && v!==null && v!=='' || '必填', v=>parseFloat(v)>0 || '需>0']"
                        style="max-width:110px"
                        @update:model-value="recalcTotal"
                      >
                        <template #prepend>
                          <q-icon name="attach_money" color="primary" size="16px" />
                        </template>
                      </q-input>
                    </td>
                  </tr>
                </tbody>
              </q-markup-table>
            </div>
            <div class="row q-gutter-sm q-mt-xs">
              <div class="col text-h6 text-positive">总价: ¥{{ totalPrice }}</div>
            </div>
          </div>
        </div>

        <!-- 备注 -->
        <div class="q-mb-md">
          <q-input
            v-model="notes"
            label="备注"
            filled
            type="textarea"
            rows="2"
            placeholder="可选：添加续住备注信息"
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

// 响应式数据
const selectedRoom = ref(null)
const extendStartDate = ref('')
const extendEndDate = ref('')
const guestName = ref('')
const guestPhone = ref('')
const notes = ref('')
const submitting = ref(false)
const newOrderNumber = ref('')
// 可编辑续住单价
const customUnitPrice = ref(0)
// 多日价格对象 (key=YYYY-MM-DD)
const dailyPrices = ref({})
const singlePriceRules = [
  val => val !== null && val !== undefined && val !== '' || '请输入房价',
  val => parseFloat(val) > 0 || '房价必须大于0'
]

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
    const unit = parseFloat(customUnitPrice.value) || 0
    return unit
  }
  return Object.values(dailyPrices.value).reduce((s,v)=> s + (parseFloat(v)||0),0)
})

const canConfirm = computed(() => {
  if (!(selectedRoom.value && extendStartDate.value && extendEndDate.value && guestName.value.trim() && guestPhone.value.trim() && newOrderNumber.value.trim() && stayDays.value > 0)) return false
  if (stayDays.value === 1) return parseFloat(customUnitPrice.value) > 0
  // 多日：所有 dailyPrices 完整且>0
  const dates = stayDateList.value
  if (!dates.length) return false
  return dates.every(d => parseFloat(dailyPrices.value[d]) > 0)
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
    if (!customUnitPrice.value || customUnitPrice.value <= 0) {
      customUnitPrice.value = info.price
    }
  } else {
    customUnitPrice.value = 0
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
  // 新增的设默认价
  list.forEach(d => { if (current[d] === undefined) current[d] = parseFloat(customUnitPrice.value) || selectedRoomInfo.value?.price || 0 })
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
        if (keys.length) customUnitPrice.value = parseFloat(rp[keys[keys.length-1]]) || parseFloat(rp[keys[0]]) || 0
      } else if (typeof rp === 'number') {
        customUnitPrice.value = rp
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
  customUnitPrice.value = 0
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
  roomPrice: stayDays.value === 1 ? (parseFloat(customUnitPrice.value) || selectedRoomInfo.value.price) : { ...dailyPrices.value },
      checkInDate: extendStartDate.value,
      checkOutDate: extendEndDate.value,
      guestName: guestName.value.trim(),
      phone: guestPhone.value.trim(),
      idNumber: props.currentOrder.idNumber, // 从原订单继承身份证号
      totalPrice: totalPrice.value,
      stayDays: stayDays.value,
      notes: notes.value.trim(),
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

// 格式化原订单房价（可能为JSON）
function formatOriginalRoomPrice(val) {
  if (val == null) return '—'
  if (typeof val === 'number') return `¥${val}/晚`
  if (typeof val === 'object') {
    const keys = Object.keys(val).sort()
    if (!keys.length) return '—'
    if (keys.length === 1) return `¥${val[keys[0]]}/晚`
    // 多日：显示范围与总计
    const prices = keys.map(k => parseFloat(val[k])||0)
    const min = Math.min(...prices)
    const max = Math.max(...prices)
    const sum = prices.reduce((a,b)=>a+b,0)
    return `¥${min===max?min:`${min}-${max}`} 共${prices.length}天 合计¥${sum}`
  }
  return String(val)
}
</script>

<style scoped>
.q-card {
  max-width: 600px;
}

.price-table-transparent {
  background: transparent;
  width: 100%;
  border: 1px solid #d9e6f2;
  border-radius: 6px;
  overflow: hidden;
}
.price-table-transparent td {
  background: #e6f1fb; /* 接近 blue-1 更柔和 */
  border-bottom: 1px solid #d9e6f2;
  border-right: none;
}
.price-table-transparent tr:last-child td { border-bottom: none; }
.price-table-transparent td:first-child { width: 90px; }
</style>
