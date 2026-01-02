<template>
  <q-dialog
    :model-value="modelValue"
    @update:model-value="val => emit('update:modelValue', val)"
    persistent
  >
    <q-card style="min-width: 600px; max-width: 750px;">
      <!-- 对话框标题 -->
      <q-card-section class="bg-primary text-white q-py-sm">
        <div class="text-subtitle1 text-weight-bold">
          <q-icon name="hotel" class="q-mr-xs" size="20px" />
          确认办理入住
        </div>
      </q-card-section>

      <q-card-section v-if="order" class="q-pa-sm">
        <!-- 订单基本信息 -->
        <div class="q-mb-sm">
          <q-card flat bordered>
            <q-card-section class="q-pa-sm q-col-gutter-y-xs">
              <div class="text-caption text-weight-bold q-mb-xs">
                <q-icon name="info" color="primary" size="16px" />
                订单信息
              </div>
              <div class="row q-col-gutter-xs text-body2">
                <div class="col-4">
                  <span class="text-grey-7">订单:</span>
                  <span class="text-weight-medium q-ml-xs">{{ order.orderNumber }}</span>
                </div>
                <div class="col-4">
                  <span class="text-grey-7">客人:</span>
                  <span class="text-weight-medium q-ml-xs">{{ order.guestName }}</span>
                </div>
                <div class="col-4">
                  <span class="text-grey-7">电话:</span>
                  <span class="q-ml-xs">{{ order.phone || '未提供' }}</span>
                </div>
                <div class="col-4">
                  <span class="text-grey-7">房型:</span>
                  <span class="q-ml-xs">{{ getRoomTypeName(order.roomType) }}</span>
                </div>
                <div class="col-4">
                  <span class="text-grey-7">房间:</span>
                  <span class="text-primary text-weight-bold q-ml-xs">{{ order.roomNumber }}</span>
                </div>
                <div class="col-4">
                  <span class="text-grey-7">类型:</span>
                  <q-badge
                    :color="isRestRoom ? 'orange' : 'blue'"
                    :label="isRestRoom ? '休息房' : '客房'"
                    class="q-ml-xs"
                  />
                </div>
                <div class="col-4">
                  <span class="text-grey-7">入住:</span>
                  <span class="q-ml-xs">{{ formatDate(order.checkInDate) }}</span>
                </div>
                <div class="col-4">
                  <span class="text-grey-7">退房:</span>
                  <span class="q-ml-xs">{{ formatDate(order.checkOutDate) }}</span>
                </div>
                <div class="col-4">
                  <span class="text-grey-7">天数:</span>
                  <span class="text-weight-bold q-ml-xs">{{ stayDays }} 天</span>
                </div>
              </div>
            </q-card-section>
          </q-card>
        </div>

        <!-- 费用明细 -->
        <div class="q-mb-sm">
          <q-card flat bordered class="bg-grey-1 q-col-gutter-y-md">
            <q-card-section class="q-pa-sm ">
              <div class="text-caption text-weight-bold q-mb-xs ">
                <q-icon name="receipt_long" color="primary" size="20px" />
                费用明细
              </div>


              <!-- 费用明细卡片 - 横向排列 -->
              <div class="row q-col-gutter-md q-mb-md">
                <!-- 房费卡片 -->
                <div class="col-sm-6 col-md-3 col-xs-12">
                  <div class="fee-card">
                    <div class="fee-card-label">房费</div>
                    <div class="fee-card-input">
                      <q-input
                        :model-value="'¥' + (totalRoomFee || 0)"
                        readonly
                        dense
                        borderless
                        class="fee-input readonly-input"
                        input-class="fee-card-value-text"
                      />
                    </div>
                  </div>
                </div>

                <!-- 已收房费卡片 -->
                <div class="col-sm-6 col-md-3 col-xs-12">
                  <div class="fee-card">
                    <div class="fee-card-label">已收房费</div>
                    <div class="fee-card-input">
                      <q-input
                        :model-value="'¥' + prepaidRoomFee"
                        readonly
                        dense
                        borderless
                        class="fee-input readonly-input"
                        input-class="fee-card-value-text"
                      />
                    </div>
                  </div>
                </div>

                <!-- 本次需收房费 -->
                <div class="col-sm-6 col-md-3 col-xs-12">
                  <div class="fee-card">
                    <div class="fee-card-label">需收房费</div>
                    <div class="fee-card-input">
                      <q-input
                        :model-value="'¥' + remainingRoomFee"
                        readonly
                        dense
                        borderless
                        class="fee-input readonly-input"
                        input-class="fee-card-value-text"
                      />
                    </div>
                  </div>
                </div>

                <!-- 押金卡片 -->
                <div class="col-sm-6 col-md-3 col-xs-12">
                  <div class="fee-card deposit-card" @click.capture="focusDepositInput">
                    <div class="fee-card-label">
                      押金（可修改）
                      <q-icon name="edit" size="12px" class="q-ml-xs" color="primary" />
                    </div>
                    <div class="fee-card-input clickable-area">
                      <q-input
                        ref="depositInput"
                        v-model.number="depositAmount"
                        type="number"
                        dense
                        borderless
                        prefix="¥"
                        :rules="[val => val >= 0 || '押金不能为负数']"
                        class="fee-input editable-input"
                        input-class="fee-card-value-text"
                      >
                        <template v-slot:append>
                          <q-icon name="edit" size="14px" color="grey-5" class="edit-icon-hint" />
                        </template>
                      </q-input>
                    </div>
                  </div>
                </div>

                <!-- 支付方式卡片 -->
                <div class="col-sm-6 col-md-3 col-xs-12">
                  <div class="fee-card">
                    <div class="fee-card-label">支付方式</div>
                    <div class="fee-card-input">
                      <q-input
                        :model-value="getPaymentMethodName(order.paymentMethod)"
                        readonly
                        dense
                        borderless
                        class="fee-input readonly-input"
                        input-class="fee-card-value-text"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <!-- 费用合计 -->
              <div class="total-amount-card">
                <div class="total-amount-left">
                  <div class="text-body2 text-weight-bold text-grey-8">本次应收</div>
                  <div class="text-caption text-grey-6">未结房费 + 押金</div>
                </div>
                <div class="total-amount-right">
                  ¥{{ totalAmount }}
                </div>
              </div>
            </q-card-section>
          </q-card>
        </div>

        <!-- 备注信息 -->
        <div v-if="order.remarks" class="q-mb-xs">
          <q-card flat bordered>
            <q-card-section class="q-pa-xs">
              <span class="text-caption text-grey-7">备注:</span>
              <span class="text-body2 q-ml-xs">{{ order.remarks }}</span>
            </q-card-section>
          </q-card>
        </div>

        <!-- 提示信息 -->
        <q-banner dense rounded class="bg-blue-1 text-primary q-pa-xs">
          <template v-slot:avatar>
            <q-icon name="info" color="primary" size="18px" />
          </template>
          <div class="text-caption">
            <span class="text-weight-medium">办理入住后将：</span>
            自动创建账单、订单变"已入住"、房间变"已占用"
          </div>
        </q-banner>
      </q-card-section>

      <!-- 操作按钮 -->
      <q-card-actions align="right" class="q-pa-sm">
        <q-btn
          flat
          label="取消"
          color="grey"
          v-close-popup
          :disable="loading"
          size="md"
        />
        <q-btn
          unelevated
          label="确认办理入住"
          color="primary"
          @click="confirmCheckIn"
          :loading="loading"
          icon="hotel"
          size="md"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup>
import { ref, computed, watch } from 'vue'

// Props
const props = defineProps({
  modelValue: {
    type: Boolean,
    required: true
  },
  order: {
    type: Object,
    default: null
  },
  getRoomTypeName: {
    type: Function,
    required: true
  },
  getPaymentMethodName: {
    type: Function,
    required: true
  },
  formatDate: {
    type: Function,
    required: true
  }
})

// Emits
const emit = defineEmits(['update:modelValue', 'confirm'])

// 加载状态
const loading = ref(false)

// 押金金额（可编辑）
const depositAmount = ref(0)

// 押金输入框引用
const depositInput = ref(null)

watch(() => props.order, (newOrder) => {
  depositAmount.value = newOrder ? (parseFloat(newOrder.deposit) || 0) : 0
}, { immediate: true })

// 聚焦押金输入框
function focusDepositInput() {
  if (depositInput.value) {
    depositInput.value.focus()
  }
}



const isRestRoom = computed(() => {
  if (!props.order) return false
  if (props.order.isRestRoom !== undefined) return Boolean(props.order.isRestRoom)
  const stayType = props.order.stayType ?? props.order.stay_type
  if (stayType) return stayType === '休息房'
  const checkIn = typeof props.order.checkInDate === 'string' ? props.order.checkInDate.slice(0, 10) : ''
  const checkOut = typeof props.order.checkOutDate === 'string' ? props.order.checkOutDate.slice(0, 10) : ''
  return Boolean(checkIn && checkOut && checkIn === checkOut)
})

const roomPriceDetails = computed(() => {
  if (!props.order) return {}
  const dailyPrices = props.order.dailyPrices ?? props.order.daily_prices
  if (dailyPrices && typeof dailyPrices === 'object' && !Array.isArray(dailyPrices)) return dailyPrices
  if (props.order.roomPrice && typeof props.order.roomPrice === 'object' && !Array.isArray(props.order.roomPrice)) return props.order.roomPrice
  return {}
})

const stayDays = computed(() => {
  if (!props.order) return 0
  const fromApi = props.order.stayDays ?? props.order.stay_days
  if (Number(fromApi) > 0) return Number(fromApi)
  const days = Object.keys(roomPriceDetails.value || {}).length
  if (days > 0) return days
  return isRestRoom.value ? 1 : 0
})

const totalRoomFee = computed(() => {
  if (!props.order) return 0
  const details = roomPriceDetails.value
  const keys = Object.keys(details || {})
  if (keys.length) {
    return keys.reduce((sum, k) => sum + (Number(details[k]) || 0), 0)
  }
  const raw = props.order.roomPrice ?? props.order.total_price ?? 0
  return Number(raw) || 0
})

const prepaidRoomFee = computed(() => {
  if (!props.order) return 0
  const raw = props.order.prepaidAmount ?? props.order.prepaid_amount ?? 0
  const amount = Number(raw) || 0
  return amount > 0 ? Number(amount.toFixed(2)) : 0
})

const remainingRoomFee = computed(() => {
  if (!props.order) return 0
  const fromApi = props.order.remainingRoomFee ?? props.order.remaining_room_fee
  if (fromApi !== undefined && fromApi !== null && fromApi !== '') {
    const n = Number(fromApi) || 0
    return n > 0 ? Number(n.toFixed(2)) : 0
  }
  const roomFee = Number(totalRoomFee.value) || 0
  const prepaid = Number(prepaidRoomFee.value) || 0
  const diff = Number((roomFee - prepaid).toFixed(2))
  return diff > 0 ? diff : 0
})

// 费用合计
const totalAmount = computed(() => {
  const deposit = parseFloat(depositAmount.value) || 0
  const roomFee = remainingRoomFee.value
  return (roomFee + deposit).toFixed(2)
})

// 确认办理入住
async function confirmCheckIn() {
  loading.value = true
  try {
    // 将修改后的押金金额传递给父组件
    const orderWithDeposit = {
      ...props.order,
      deposit: depositAmount.value
    }
    emit('confirm', orderWithDeposit)
  } finally {
    // 等待父组件处理完成后再关闭loading
    setTimeout(() => {
      loading.value = false
    }, 500)
  }
}
</script>

<style scoped>
.compact-item {
  min-height: 32px;
  padding: 4px 8px;
}

.q-card {
  box-shadow: 0 1px 5px rgba(0,0,0,0.1);
}

.rounded-borders {
  border-radius: 4px;
}

ul {
  list-style-position: inside;
}

/* 紧凑间距 */
.text-body2 {
  font-size: 13px;
  line-height: 1.3;
}

.text-caption {
  font-size: 11px;
  line-height: 1.2;
}

/* ===== 费用明细卡片样式 ===== */
.fee-card {
  background: white;
  border: 1px solid #e8eaf0;
  border-radius: 10px;
  padding: 14px 16px;
  height: 76px; /* 固定高度确保一致性 */
  display: flex;
  flex-direction: column;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
  transition: all 0.3s ease;
  cursor: default; /* 默认光标 */
}

.fee-card:hover {
  border-color: #1976d2;
  box-shadow: 0 4px 12px rgba(25, 118, 210, 0.12);
  transform: translateY(-2px);
}

.fee-card-label {
  font-size: 11px;
  color: #6b7280;
  font-weight: 500;
  letter-spacing: 0.2px;
  line-height: 14px; /* 固定行高 */
  height: 14px; /* 固定高度确保标题对齐 */
  margin-bottom: 10px; /* 标题到内容的固定间距 */
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.fee-card-input {
  height: 24px; /* 与 fee-card-value 相同高度 */
  display: flex;
  align-items: center; /* 垂直居中对齐 */
}

/* 可点击区域样式 */
.fee-card-input.clickable-area {
  cursor: text; /* 显示文本光标 */
  padding: 2px 0; /* 扩大可点击区域 */
  margin: -2px 0; /* 补偿padding */
}

/* 押金卡片可点击 */
.fee-card.deposit-card {
  cursor: text; /* 整个卡片显示文本光标 */
}

.fee-card.deposit-card:hover {
  background-color: rgba(25, 118, 210, 0.01); /* 悬停时轻微背景色 */
}

/* 押金卡片所有子元素都允许点击穿透 */
.fee-card.deposit-card * {
  pointer-events: none; /* 所有子元素不拦截点击 */
}

/* 但输入框本身需要接收事件 */
.fee-card.deposit-card .fee-input :deep(input) {
  pointer-events: auto; /* 输入框可以接收事件 */
}

/* 统一输入框样式 */
.fee-input {
  width: 100%;
  height: 24px; /* 与其他内容相同高度 */
}

.fee-input :deep(.q-field__control) {
  min-height: 24px;
  height: 24px;
  padding: 0 0 2px 0; /* 底部留空间给下划线 */
  border-bottom: 2px solid transparent; /* 默认透明边框 */
  transition: all 0.3s ease;
}

/* 只读输入框样式 */
.fee-input.readonly-input :deep(.q-field__control) {
  border-bottom-color: #e8eaf0; /* 淡灰色边框 */
  cursor: default;
}

.fee-input.readonly-input :deep(.q-field__native) {
  cursor: default;
}

/* 可编辑输入框样式 */
.fee-input.editable-input :deep(.q-field__control) {
  border-bottom-color: #e0e0e0; /* 可编辑输入框的底部边框 */
}

.fee-input.editable-input:hover :deep(.q-field__control) {
  border-bottom-color: #1976d2; /* 悬停时边框变蓝 */
  background-color: rgba(25, 118, 210, 0.02); /* 轻微背景色提示 */
}

.fee-input.editable-input :deep(.q-field--focused .q-field__control) {
  border-bottom-color: #1976d2; /* 聚焦时边框变蓝 */
  background-color: rgba(25, 118, 210, 0.05); /* 聚焦时背景色 */
  box-shadow: 0 2px 8px rgba(25, 118, 210, 0.15); /* 聚焦时添加阴影 */
}

.fee-input :deep(.q-field__control-container) {
  height: 24px;
  padding-top: 0;
  padding-bottom: 0;
}

.fee-input :deep(.q-field__native) {
  padding: 0;
  font-size: 18px;
  font-weight: 700;
  color: #ff6b00;
  letter-spacing: -0.5px;
  line-height: 24px; /* 与其他文字同行高 */
  height: 24px;
  transition: color 0.3s ease;
}

/* 可编辑输入框的光标 */
.fee-input.editable-input :deep(.q-field__native) {
  cursor: text;
}

/* 聚焦时数字颜色略微加深 */
.fee-input.editable-input :deep(.q-field--focused .q-field__native) {
  color: #ff5500;
}

.fee-input :deep(.q-field__prefix) {
  font-size: 18px;
  font-weight: 700;
  color: #ff6b00;
  margin-right: 2px;
  letter-spacing: -0.5px;
  line-height: 24px;
  height: 24px;
  display: flex;
  align-items: center;
}

.fee-input :deep(.q-field__append) {
  padding-left: 4px;
  height: 24px;
  display: flex;
  align-items: center;
}

.edit-icon-hint {
  opacity: 0.5;
  transition: opacity 0.3s ease;
}

.fee-input.editable-input:hover .edit-icon-hint,
.fee-input.editable-input :deep(.q-field--focused) .edit-icon-hint {
  opacity: 1;
}

.fee-card-value-text {
  font-size: 18px !important;
  font-weight: 700 !important;
  color: #ff6b00 !important;
  letter-spacing: -0.5px !important;
  line-height: 24px !important;
  height: 24px !important;
}

/* ===== 总计卡片样式 ===== */
.total-amount-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: linear-gradient(135deg, #e3f2fd 0%, #f5f9ff 100%);
  border: 1px solid #bbdefb;
  border-radius: 10px;
  padding: 14px 18px;
  box-shadow: 0 2px 8px rgba(25, 118, 210, 0.08);
  transition: all 0.3s ease;
}

.total-amount-card:hover {
  box-shadow: 0 4px 12px rgba(25, 118, 210, 0.15);
}

.total-amount-left {
  flex: 1;
}

.total-amount-right {
  font-size: 26px;
  font-weight: 700;
  color: #1976d2;
  letter-spacing: -0.5px;
  line-height: 1;
}

/* 响应式调整 */
@media (max-width: 768px) {
  .fee-card {
    height: 70px;
    padding: 12px 14px;
  }

  .fee-card-label {
    height: 13px;
    line-height: 13px;
    margin-bottom: 8px;
  }

  .fee-card-input {
    height: 22px;
    line-height: 22px;
  }

  .fee-input :deep(.q-field__native),
  .fee-input :deep(.q-field__prefix) {
    font-size: 16px;
    line-height: 22px;
    height: 22px;
  }

  .fee-input {
    height: 22px;
  }

  .fee-input :deep(.q-field__control) {
    min-height: 22px;
    height: 22px;
  }

  .fee-input :deep(.q-field__control-container) {
    height: 22px;
  }

  .fee-input :deep(.q-field__append) {
    height: 22px;
  }

  .total-amount-right {
    font-size: 22px;
  }
}
</style>
