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
                  <q-item-label caption>房间金额</q-item-label>
                  <q-item-label class="text-primary text-weight-medium">¥{{ currentOrder.roomPrice }}</q-item-label>
                </q-item-section>
              </q-item>
              <q-item>
                <q-item-section>
                  <q-item-label caption>押金</q-item-label>
                  <q-item-label class="text-primary text-weight-medium">¥{{ currentOrder.deposit }}</q-item-label>
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
        <q-btn flat label="关闭" color="primary" v-close-popup />
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
import { toRefs, computed } from 'vue';

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

const emit = defineEmits(['update:modelValue', 'check-in', 'change-room', 'checkout', 'refund-deposit']);

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

import { useBillStore } from 'src/stores/billStore'
const billStore = useBillStore()

// 判断是否可以退押金
function canRefundDeposit(order) {
  if (!order) return false
  const allowedStatuses = ['checked-out', 'cancelled']
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
</script>
