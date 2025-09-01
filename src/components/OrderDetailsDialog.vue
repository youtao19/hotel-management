<template>
  <q-dialog
    :model-value="modelValue"
    @update:model-value="val => emit('update:modelValue', val)"
    persistent
  >
    <q-card style="min-width: 350px; max-width: 80vw;">
      <q-card-section class="row items-center q-pb-none">
        <div class="text-h6">订单详情</div>
        <q-space />
        <q-btn icon="close" flat round dense v-close-popup />
      </q-card-section>

      <q-card-section v-if="currentOrder">
        <div class="row q-col-gutter-md">
          <!-- 订单基本信息 -->
          <div class="col-md-6 col-xs-12">
            <q-list bordered separator>
              <q-item>
                <q-item-section>
                  <q-item-label caption>订单号</q-item-label>
                  <q-item-label>{{ currentOrder.orderNumber }}</q-item-label>
                </q-item-section>
              </q-item>
              <q-item>
                <q-item-section>
                  <q-item-label caption>状态</q-item-label>
                  <q-item-label>
                    <q-badge
                      :color="getStatusColor(currentOrder.status)"
                      :label="getOrderStatusText(currentOrder.status)"
                    />
                  </q-item-label>
                </q-item-section>
              </q-item>
              <q-item>
                <q-item-section>
                  <q-item-label caption>订单创建时间</q-item-label>
                  <q-item-label>{{ formatDateTime(currentOrder.createTime) }}</q-item-label>
                </q-item-section>
              </q-item>
              <q-item>
                <q-item-section>
                  <q-item-label caption>入住时间</q-item-label>
                  <q-item-label>{{ currentOrder.checkInDate || '未入住' }}</q-item-label>
                </q-item-section>
              </q-item>
            </q-list>
          </div>
          <!-- 客人信息 -->
          <div class="col-md-6 col-xs-12">
            <q-list bordered separator>
              <q-item>
                <q-item-section>
                  <q-item-label caption>客人姓名</q-item-label>
                  <q-item-label>{{ currentOrder.guestName }}</q-item-label>
                </q-item-section>
              </q-item>
              <q-item>
                <q-item-section>
                  <q-item-label caption>手机号</q-item-label>
                  <q-item-label>{{ currentOrder.phone }}</q-item-label>
                </q-item-section>
              </q-item>
              <q-item>
                <q-item-section>
                  <q-item-label caption>身份证号</q-item-label>
                  <q-item-label>{{ currentOrder.idNumber }}</q-item-label>
                </q-item-section>
              </q-item>
              <q-item>
                <q-item-section>
                  <q-item-label caption>退房时间</q-item-label>
                  <q-item-label>{{ currentOrder.checkOutDate || '未退房' }}</q-item-label>
                </q-item-section>
              </q-item>
            </q-list>
          </div>
          <!-- 房间信息 -->
          <div class="col-md-6 col-xs-12">
            <q-list bordered separator>
              <q-item>
                <q-item-section>
                  <q-item-label caption>房间类型</q-item-label>
                  <q-item-label>{{ getRoomTypeName(currentOrder.roomType) }}</q-item-label>
                </q-item-section>
              </q-item>
              <q-item>
                <q-item-section>
                  <q-item-label caption>房间号</q-item-label>
                  <div class="row items-center">
                    <q-item-label class="q-mr-sm">{{ currentOrder.roomNumber }}</q-item-label>
                    <q-btn
                      v-if="currentOrder && currentOrder.status === 'pending'"
                      flat
                      dense
                      color="primary"
                      icon="swap_horiz"
                      @click="emitChangeRoom"
                    >
                      <q-tooltip>更换房间</q-tooltip>
                    </q-btn>
                  </div>
                </q-item-section>
              </q-item>
              <q-item>
                <q-item-section>
                  <q-item-label caption>预定入住日期</q-item-label>
                  <q-item-label>{{ formatDate(currentOrder.checkInDate) }} 至 {{ formatDate(currentOrder.checkOutDate) }}</q-item-label>
                </q-item-section>
              </q-item>
              <q-item>
                <q-item-section>
                  <q-item-label caption>未退押金</q-item-label>
                  <q-item-label class="text-negative text-weight-medium">¥{{ remainingDeposit }}</q-item-label>
                </q-item-section>
              </q-item>
            </q-list>
          </div>


          <!-- 支付信息 -->
          <div class="col-md-6 col-xs-12">
            <q-list bordered separator>
              <q-item>
                <q-item-section>
                  <q-item-label caption>支付方式</q-item-label>
                  <q-item-label>{{ getPaymentMethodName(currentOrder.paymentMethod) }}</q-item-label>
                </q-item-section>
              </q-item>
              <q-item>
                <q-item-section>
                  <q-item-label caption>当日房价</q-item-label>
                  <q-item-label class="text-primary text-weight-medium">
                    <span v-if="displayTodayPrice !== null">¥{{ displayTodayPrice }}</span>
                    <span v-else class="text-grey">—</span>
                  </q-item-label>
                </q-item-section>
              </q-item>
              <q-item>
                <q-item-section>
                  <q-item-label caption>房间金额</q-item-label>
                  <q-item-label class="text-primary text-weight-medium">¥{{ totalRoomPrice }}</q-item-label>
                </q-item-section>
              </q-item>
              <q-item>
                <q-item-section>
                  <q-item-label caption>押金</q-item-label>
                  <q-item-label class="text-primary text-weight-medium">¥{{ currentOrder.deposit }}</q-item-label>
                </q-item-section>
              </q-item>

              <q-item>
                <q-item-section>
                  <q-item-label caption>已退押金</q-item-label>
                  <q-item-label>
                    <q-badge v-if="refundedAmount > 0" color="purple" text-color="white" :label="`¥${refundedAmount}`" />
                    <span v-else class="text-grey">未退款</span>
                  </q-item-label>
                </q-item-section>
              </q-item>
            </q-list>
          </div>
          <!-- 退款明细 -->
          <div class="col-md-12 col-xs-12" v-if="refundRecords.length">
            <q-list bordered>
              <q-item>
                <q-item-section>
                  <q-item-label caption>退款明细</q-item-label>
                  <div class="q-mt-xs">
                    <div v-for="(r, idx) in refundRecords" :key="idx" class="row items-center q-py-xs">
                      <div class="col-4">金额：<span class="text-primary">¥{{ r.amount }}</span></div>
                      <div class="col-4">方式：{{ getPaymentMethodName(r.method) || r.method }}</div>
                      <div class="col-4">时间：{{ formatDateTime(r.time) }}</div>
                    </div>
                  </div>
                </q-item-section>
              </q-item>
            </q-list>
          </div>
          <!-- 备注信息 -->
          <div class="col-md-12 col-xs-12" v-if="currentOrder.remarks">
            <q-list bordered>
              <q-item>
                <q-item-section>
                  <q-item-label caption>备注</q-item-label>
                  <q-item-label>{{ currentOrder.remarks }}</q-item-label>
                </q-item-section>
              </q-item>
            </q-list>
          </div>
        </div>
      </q-card-section>

      <q-card-actions align="right">
        <q-btn
          flat
          label="修改订单"
          color="secondary"
          @click="emitChangeOrder"
        />
        <q-btn
          flat
          label="关闭"
          color="primary"
          v-close-popup
        />
        <q-btn
          v-if="currentOrder && currentOrder.status === 'pending'"
          flat
          label="办理入住"
          color="info"
          @click="emitCheckIn"
        />
        <q-btn
          v-if="currentOrder && currentOrder.status === 'checked-in'"
          flat
          label="更改房间"
          color="warning"
          @click="emitChangeRoom"
        >
          <q-tooltip>更换房间</q-tooltip>
        </q-btn>
        <q-btn
          v-if="currentOrder && currentOrder.status === 'checked-in'"
          flat
          label="办理退房"
          color="positive"
          @click="emitCheckout"
        />
        <q-btn
          v-if="currentOrder && canRefundDeposit(currentOrder)"
          flat
          label="退押金"
          color="purple"
          icon="account_balance_wallet"
          @click="emitRefundDeposit"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  modelValue: Boolean,
  currentOrder: Object,
  getStatusColor: Function,
  getOrderStatusText: Function,
  getRoomTypeName: Function,
  getPaymentMethodName: Function,
  formatDate: Function,
  formatDateTime: Function
});

const emit = defineEmits([
  'update:modelValue',
  'check-in',
  'change-room',
  'checkout',
  'refund-deposit',
  'change-order'
]);

function emitCheckIn() {
  emit('check-in');
}
function emitChangeRoom() {
  emit('change-room');
}
function emitCheckout() {
  emit('checkout');
}

function emitRefundDeposit() {
  emit('refund-deposit');
}

function emitChangeOrder() {
  emit('change-order');
}

import { useBillStore } from 'src/stores/billStore'
const billStore = useBillStore()

// 判断是否可以退押金
function canRefundDeposit(order) {
  if (!order) return false
  const allowedStatuses = ['checked-out']
  if (!allowedStatuses.includes(order.status)) return false
  // 优先使用订单字段
  let deposit = Number(order.deposit) || 0
  const billsForOrder = billStore.bills.filter(b => b.order_id === order.orderNumber)
  if (deposit === 0) {
    const bWithDep = billsForOrder.find(b => Number(b.deposit) > 0)
    if (bWithDep) deposit = Number(bWithDep.deposit) || 0
  }
  if (deposit <= 0) return false
  // 计算已退金额
  let refunded = 0
  billsForOrder.forEach(b => {
    refunded += Math.abs(Number(b.refund_deposit) || 0)
    if (b.change_type === '退押') refunded += Math.abs(Number(b.change_price) || 0)
  })
  return refunded === 0
}

// ====== 详情页显示用的押金/退款信息 ======
const billsForThisOrder = computed(() => {
  if (!props.currentOrder) return []
  return billStore.bills.filter(b => b.order_id === props.currentOrder.orderNumber)
})

const depositAmount = computed(() => {
  const dep = Number(props.currentOrder?.deposit) || 0
  if (dep > 0) return dep
  const b = billsForThisOrder.value.find(x => Number(x.deposit) > 0)
  return b ? Number(b.deposit) || 0 : 0
})

const refundRecords = computed(() => {
  const recs = []
  billsForThisOrder.value.forEach(b => {
    if (b && b.change_type === '退押') {
      const amount = Math.abs(Number(b.change_price) || 0)
      if (amount > 0) {
        recs.push({ amount, method: b.pay_way, time: b.create_time })
      }
    } else if (typeof b?.refund_deposit === 'number' && Number(b.refund_deposit) < 0) {
      // 兼容旧结构（refund_deposit 为负表示退押）
      const amount = Math.abs(Number(b.refund_deposit) || 0)
      if (amount > 0) recs.push({ amount, method: b.pay_way, time: b.refund_time || b.create_time })
    }
  })
  return recs.sort((a, c) => new Date(a.time) - new Date(c.time))
})

const refundedAmount = computed(() => {
  return refundRecords.value.reduce((s, r) => s + (Number(r.amount) || 0), 0)
})

const remainingDeposit = computed(() => {
  const left = (Number(depositAmount.value) || 0) - (Number(refundedAmount.value) || 0)
  return left > 0 ? Number(left.toFixed(2)) : 0
})

// ====== 房价显示（支持单价或按日价格对象）======
const isObjectPrice = computed(() => {
  const rp = props.currentOrder?.roomPrice
  return rp && typeof rp === 'object' && rp !== null
})

const totalRoomPrice = computed(() => {
  if (!props.currentOrder) return 0
  const rp = props.currentOrder.roomPrice
  if (!isObjectPrice.value) return Number(rp || 0)
  // 合计多日价格
  return Object.values(rp).reduce((sum, v) => sum + (Number(v) || 0), 0)
})

function toYmd(d) {
  const dt = typeof d === 'string' ? new Date(d) : d
  const y = dt.getFullYear()
  const m = String(dt.getMonth() + 1).padStart(2, '0')
  const day = String(dt.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

const displayTodayPrice = computed(() => {
  if (!props.currentOrder) return null
  const rp = props.currentOrder.roomPrice
  if (!rp) return null
  // 单价：直接返回
  if (!isObjectPrice.value) return Number(rp)
  // 多日价格：优先“已入住”当天价格；否则显示入住当日价格
  const today = toYmd(new Date())
  const checkIn = props.currentOrder.checkInDate
  const checkOut = props.currentOrder.checkOutDate
  const status = props.currentOrder.status
  // 判断 today 是否在入住区间 [checkIn, checkOut) 内
  const inStayRange = () => {
    if (!checkIn || !checkOut) return false
    return today >= checkIn && today < checkOut
  }
  if (status === 'checked-in' && inStayRange() && rp[today] != null) {
    return Number(rp[today]) || 0
  }
  // 退一步：显示入住当日价格
  if (checkIn && rp[checkIn] != null) return Number(rp[checkIn]) || 0
  // 再退一步：按最早一天展示
  const keys = Object.keys(rp).sort()
  if (keys.length) return Number(rp[keys[0]]) || 0
  return null
})


</script>
