<template>
  <q-dialog
    :model-value="modelValue"
    @update:model-value="val => emit('update:modelValue', val)"
    persistent
  >
    <q-card style="min-width: 600px; max-width: 750px;" class="q-col">
      <!-- 对话框标题 -->
      <q-card-section class="bg-primary text-white q-py-sm">
        <div class="text-subtitle1 text-weight-bold">
          <q-icon name="hotel" class="q-mr-xs" size="20px" />
          确认办理入住
        </div>
      </q-card-section>

      <q-card-section v-if="order" class="q-pa-sm row q-col-gutter-y-md" >
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


              <!-- 押金和支付方式 - 横向排列 -->
              <div class="row q-col-gutter-xs q-mb-xs">

                <div class="col-4">
                  <div class="bg-white q-pa-xs rounded-borders" style="border: 1px solid #e0e0e0;">
                    <div class="text-caption text-grey-7">房费</div>
                    <div class="text-subtitle2 text-weight-bold text-orange">¥{{ order.roomPrice || 0 }}</div>
                  </div>
                </div>

                <div class="col-4">
                  <div class="bg-white q-pa-xs rounded-borders" style="border: 1px solid #e0e0e0;">
                    <div class="text-caption text-grey-7">押金</div>
                    <div class="text-subtitle2 text-weight-bold text-orange">¥{{ order.deposit || 0 }}</div>
                  </div>
                </div>
                <div class="col-4">
                  <div class="bg-white q-pa-xs rounded-borders" style="border: 1px solid #e0e0e0;">
                    <div class="text-caption text-grey-7">支付方式</div>
                    <div class="text-body2 text-weight-bold text-orange">{{ getPaymentMethodName(order.paymentMethod) }}</div>
                  </div>
                </div>
              </div>

              <!-- 费用合计 -->
              <div class="row items-center q-pa-xs bg-blue-1 rounded-borders">
                <div class="col">
                  <div class="text-body2 text-weight-bold">应收合计</div>
                  <div class="text-caption text-grey-7">房费 + 押金</div>
                </div>
                <div class="text-h5 text-primary text-weight-bold">
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
import { ref, computed } from 'vue'

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
  const deposit = parseFloat(props.order?.deposit) || 0
  const roomFee = parseFloat(totalRoomFee.value) || 0
  console.log('计算应收合计 - 房费:', roomFee, '押金:', deposit)
  return (roomFee + deposit).toFixed(2)
})

// 确认办理入住
async function confirmCheckIn() {
  loading.value = true
  try {
    emit('confirm', props.order)
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
</style>

