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
        <!-- 顶部操作按钮区 -->
        <div class="row q-mb-md justify-end">
          <q-btn
            color="primary"
            icon="history"
            label="查看修改历史"
            outline
            @click="viewOrderHistory"
          />
        </div>

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

  <!-- 订单修改历史对话框 -->
  <q-dialog v-model="showOrderHistoryDialog">
    <q-card style="width: 700px; max-width: 95vw;">
      <q-card-section class="row items-center q-pb-none">
        <div class="text-h6">订单修改历史</div>
        <q-space />
        <q-btn icon="close" flat round dense v-close-popup />
      </q-card-section>

      <q-card-section v-if="orderChanges.length > 0">
        <q-timeline color="primary">
          <q-timeline-entry
            v-for="(change, index) in orderChanges"
            :key="index"
            :title="change.change_type"
            :subtitle="formatDateTime(change.change_time)"
            icon="edit"
          >
            <div>
              <div><strong>操作人：</strong> {{ change.operator || '系统' }}</div>
              <div class="q-mt-sm">
                <div><strong>变更内容：</strong></div>
                <div class="q-ml-md" v-for="(value, key) in change.changes" :key="key">
                  <strong>{{ formatChangeField(key) }}：</strong>
                  {{ formatChangeValue(key, value.old) }} → {{ formatChangeValue(key, value.new) }}
                </div>
              </div>
            </div>
          </q-timeline-entry>
        </q-timeline>
      </q-card-section>

      <q-card-section v-else class="text-center text-grey-6">
        <div v-if="loadingHistory">正在加载历史记录...</div>
        <div v-else>该订单暂无修改记录</div>
      </q-card-section>
    </q-card>
  </q-dialog>
</template>

<script setup>
import { computed, ref } from 'vue';
import { useQuasar } from 'quasar';
import { useBillStore } from 'src/stores/billStore';
import { useOrderStore } from 'src/stores/orderStore';

const $q = useQuasar();
const orderStore = useOrderStore();
const billStore = useBillStore();

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
  'change-order',
  'view-history'
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

// 订单修改历史相关
// 重用上面导入的orderStore
const showOrderHistoryDialog = ref(false)
const orderChanges = ref([])
const loadingHistory = ref(false)

// 查看订单修改历史
async function viewOrderHistory() {
  if (!props.currentOrder?.orderNumber) return

  try {
    // 我们将使用ViewOrders.vue中的变更历史组件来展示历史，而不是在这里加载
    // 将事件传递给父组件
    emit('view-history', props.currentOrder);
  } catch (error) {
    console.error('查看订单修改历史失败:', error)
    $q.notify({
      type: 'negative',
      message: '查看订单修改历史失败',
      position: 'top'
    })
  }
}

// 格式化字段名
function formatChangeField(field) {
  const fieldMap = {
    guest_name: '客人姓名',
    phone: '手机号',
    room_number: '房间号',
    remarks: '备注',
    status: '状态',
    room_type: '房型',
    check_in_date: '入住日期',
    check_out_date: '退房日期',
  }
  return fieldMap[field] || field
}

// 格式化字段值
function formatChangeValue(field, value) {
  if (value === null || value === undefined) return '-'

  if (field === 'status') {
    const statusMap = {
      'pending': '待入住',
      'checked-in': '已入住',
      'checked-out': '已退房',
      'cancelled': '已取消'
    }
    return statusMap[value] || value
  }

  return value
}


</script>
