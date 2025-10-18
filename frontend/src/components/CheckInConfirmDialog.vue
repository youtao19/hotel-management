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
                <div class="col-4">
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

                <!-- 押金卡片 -->
                <div class="col-4">
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
                <div class="col-4">
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
                  <div class="text-body2 text-weight-bold text-grey-8">应收合计</div>
                  <div class="text-caption text-grey-6">房费 + 押金</div>
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

// 聚焦押金输入框
function focusDepositInput() {
  if (depositInput.value) {
    depositInput.value.focus()
  }
}



// 判断是否为休息房
const isRestRoom = computed(() => {
  if (!props.order?.checkInDate || !props.order?.checkOutDate) return false
  const checkIn = new Date(props.order.checkInDate).toISOString().split('T')[0]
  const checkOut = new Date(props.order.checkOutDate).toISOString().split('T')[0]
  return checkIn === checkOut
})

// 计算住宿天数
const stayDays = computed(() => {
  if (!props.order?.checkInDate || !props.order?.checkOutDate) return 0

  if (isRestRoom.value) return 1 // 休息房按1天计算

  const checkIn = new Date(props.order.checkInDate)
  const checkOut = new Date(props.order.checkOutDate)
  const diffTime = Math.abs(checkOut - checkIn)
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  return diffDays || 1
})

// 房费明细
const roomPriceDetails = computed(() => {
  if (!props.order?.roomPrice) return {}

  // 如果是对象格式（每日价格）
  if (typeof props.order.roomPrice === 'object' && !Array.isArray(props.order.roomPrice)) {
    return props.order.roomPrice
  }

  // 如果是数字（总价），按天平均分配
  if (typeof props.order.roomPrice === 'number') {
    const dailyPrice = props.order.roomPrice / stayDays.value
    const details = {}
    const startDate = new Date(props.order.checkInDate)

    for (let i = 0; i < stayDays.value; i++) {
      const currentDate = new Date(startDate)
      currentDate.setDate(startDate.getDate() + i)
      const dateStr = currentDate.toISOString().split('T')[0]
      details[dateStr] = dailyPrice.toFixed(2)
    }
    return details
  }

  return {}
})

// 房费总计
const totalRoomFee = computed(() => {
  console.log('🔍 计算房费总计 - roomPrice类型:', typeof props.order?.roomPrice, '值:', props.order?.roomPrice)

  // 处理数字类型
  if (typeof props.order?.roomPrice === 'number') {
    console.log('✅ roomPrice是数字:', props.order.roomPrice)
    return props.order.roomPrice
  }

  // 处理字符串类型（需要转换为数字）
  if (typeof props.order?.roomPrice === 'string') {
    const total = parseFloat(props.order.roomPrice) || 0
    console.log('✅ roomPrice是字符串，转换为数字:', total)
    return total
  }

  // 处理对象类型（每日价格）
  if (typeof props.order?.roomPrice === 'object' && props.order?.roomPrice !== null) {
    const total = Object.values(props.order.roomPrice)
      .reduce((sum, price) => sum + parseFloat(price || 0), 0)
    console.log('✅ roomPrice是对象，计算总额:', total)
    return total
  }

  console.log('⚠️ roomPrice无效，返回0')
  return 0
})

// 费用合计
const totalAmount = computed(() => {
  const deposit = parseFloat(depositAmount.value) || 0
  const roomFee = parseFloat(totalRoomFee.value) || 0
  console.log('计算应收合计 - 房费:', roomFee, '押金:', deposit)
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

