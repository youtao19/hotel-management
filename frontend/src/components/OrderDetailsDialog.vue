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
                  <q-item-label caption>总房费</q-item-label>
                  <q-item-label class="text-primary text-weight-medium">¥{{ totalRoomFee }}</q-item-label>
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
          v-if="currentOrder"
          flat
          label="金额调整"
          color="accent"
          icon="add_card"
          @click="showAdjustmentDialog = true"
        />
        <q-btn
          v-if="currentOrder && (currentOrder.status === 'pending' || currentOrder.status === 'checked-in' || currentOrder.status === 'checked-out')"
          flat
          label="修改订单"
          color="secondary"
          @click="emitChangeOrder"
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
          v-if="currentOrder && currentOrder.status === 'checked-in'"
          flat
          label="提前退房"
          color="warning"
          icon="logout"
          @click="emitEarlyCheckout"
        />
        <q-btn
          v-if="currentOrder && canRefundDeposit(currentOrder)"
          flat
          label="退押金"
          color="purple"
          icon="account_balance_wallet"
          @click="emitRefundDeposit"
        />
        <q-btn flat label="关闭" color="primary" v-close-popup />
      </q-card-actions>
    </q-card>

    <!-- 金额调整对话框 -->
    <BillAdjustmentDialog
      v-if="currentOrder"
      v-model="showAdjustmentDialog"
      :order="currentOrder"
      @success="handleAdjustmentSuccess"
    />
  </q-dialog>
</template>

<script setup>
import { ref, toRefs, computed } from 'vue';
import BillAdjustmentDialog from './BillAdjustmentDialog.vue'; // 1. 导入新组件
import Decimal from 'decimal.js';

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

const emit = defineEmits(['update:modelValue', 'check-in', 'change-room', 'checkout', 'refund-deposit', 'change-order', 'early-checkout', 'refresh']);

const toDecimal = (val) => {
  try { return new Decimal(val || 0) } catch { return new Decimal(0) }
};
const toAmountNumber = (val) => Number(toDecimal(val).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toString());

// 2. 添加控制对话框显示的状态
const showAdjustmentDialog = ref(false);

function handleAdjustmentSuccess() {
  showAdjustmentDialog.value = false;
  emit('refresh'); // 通知父组件刷新数据
}

function emitChangeOrder() {
  emit('change-order');
}

function emitCheckIn() {
  emit('check-in');
}
function emitChangeRoom() {
  emit('change-room');
}
function emitCheckout() {
  emit('checkout');
}

function emitEarlyCheckout() {
  emit('early-checkout');
}

function emitRefundDeposit() {
  emit('refund-deposit');
}

import { useBillStore } from 'src/stores/billStore'
const billStore = useBillStore()

// 判断是否可以退押金
function canRefundDeposit(order) {
  if (!order) return false
  const allowedStatuses = ['checked-out']
  if (!allowedStatuses.includes(order.status)) return false
  // 优先使用订单字段
  let deposit = toDecimal(order.deposit)
  const billsForOrder = billStore.bills.filter(b => b.order_id === order.orderNumber)
  if (deposit.eq(0)) {
    const bWithDep = billsForOrder.find(b => toDecimal(b.deposit).gt(0))
    if (bWithDep) deposit = toDecimal(bWithDep.deposit)
  }
  if (deposit.lte(0)) return false
  // 计算已退金额
  let refunded = new Decimal(0)
  billsForOrder.forEach(b => {
    refunded = refunded.plus(toDecimal(b.refund_deposit).abs())
    if (b.change_type === '退押') refunded = refunded.plus(toDecimal(b.change_price).abs())
  })
  return refunded.eq(0)
}

// ====== 详情页显示用的押金/退款信息 ======
const billsForThisOrder = computed(() => {
  if (!props.currentOrder) return []
  return billStore.bills.filter(b => b.order_id === props.currentOrder.orderNumber)
})

const depositAmount = computed(() => {
  const dep = toDecimal(props.currentOrder?.deposit)
  if (dep.gt(0)) return toAmountNumber(dep)
  const b = billsForThisOrder.value.find(x => toDecimal(x.deposit).gt(0))
  return b ? toAmountNumber(b.deposit) : 0
})

const refundRecords = computed(() => {
  const recs = []
  billsForThisOrder.value.forEach(b => {
    if (b && b.change_type === '退押') {
      const amount = toDecimal(b.change_price).abs()
      if (amount.gt(0)) {
        recs.push({ amount: toAmountNumber(amount), method: b.pay_way, time: b.create_time })
      }
    } else if (b?.refund_deposit !== undefined && toDecimal(b.refund_deposit).lt(0)) {
      // 兼容旧结构（refund_deposit 为负表示退押）
      const amount = toDecimal(b.refund_deposit).abs()
      if (amount.gt(0)) recs.push({ amount: toAmountNumber(amount), method: b.pay_way, time: b.refund_time || b.create_time })
    }
  })
  return recs.sort((a, c) => new Date(a.time) - new Date(c.time))
})

const refundedAmount = computed(() => {
  const sum = refundRecords.value.reduce((s, r) => s.plus(toDecimal(r.amount)), new Decimal(0))
  return toAmountNumber(sum)
})

// 订单总收房费（以账单为准，兼容旧字段 room_fee）
const totalRoomFee = computed(() => {
  const orderId = props.currentOrder?.orderNumber
  if (!orderId) return 0

  const relatedBills = billStore.bills.filter(b => b.order_id === orderId)
  if (!relatedBills.length) {
    // 回退到订单字段：如果是对象则求和，否则直接取数值
    const rp = props.currentOrder?.roomPrice
    if (rp && typeof rp === 'object') {
      const sum = Object.values(rp).reduce((acc, v) => acc.plus(toDecimal(v)), new Decimal(0))
      return toAmountNumber(sum)
    }
    return toAmountNumber(rp)
  }

  const sum = relatedBills.reduce((acc, bill) => {
    const isRoomFee = bill.change_type === '房费'
    const roomFeeField = bill.room_fee
    const amount = isRoomFee
      ? toDecimal(bill.change_price)
      : toDecimal(roomFeeField)
    return acc.plus(amount)
  }, new Decimal(0))

  return toAmountNumber(sum)
})

const remainingDeposit = computed(() => {
  const left = toDecimal(depositAmount.value).minus(toDecimal(refundedAmount.value))
  return left.gt(0) ? toAmountNumber(left) : 0
})
</script>
