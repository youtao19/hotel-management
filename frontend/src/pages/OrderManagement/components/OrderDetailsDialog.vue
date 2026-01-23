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
                    <!-- 传入订单对象，确保外层能打开更换房间弹窗 -->
                    <q-btn
                      v-if="currentOrder.status === 'pending'"
                      flat dense color="primary" icon="swap_horiz"
                      @click="emit('change-room', currentOrder)"
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
                  <q-item-label class="text-negative text-weight-medium">¥{{ financials.remainingDeposit.value }}</q-item-label>
                </q-item-section>
              </q-item>
            </q-list>
          </div>

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
                  <q-item-label class="text-primary text-weight-medium">¥{{ financials.totalRoomFee.value }}</q-item-label>
                </q-item-section>
              </q-item>
              <q-item>
                <q-item-section>
                  <q-item-label caption>原押金</q-item-label>
                  <q-item-label class="text-primary text-weight-medium">¥{{ financials.depositAmount.value }}</q-item-label>
                </q-item-section>
              </q-item>
              <q-item>
                <q-item-section>
                  <q-item-label caption>已退押金</q-item-label>
                  <q-item-label>
                    <q-badge v-if="financials.refundedAmount.value > 0" color="purple" text-color="white" :label="`¥${financials.refundedAmount.value}`" />
                    <span v-else class="text-grey">未退款</span>
                  </q-item-label>
                </q-item-section>
              </q-item>
            </q-list>
          </div>

          <div class="col-md-12 col-xs-12" v-if="financials.refundRecords.value.length">
            <q-list bordered>
              <q-item>
                <q-item-section>
                  <q-item-label caption>退款明细</q-item-label>
                  <div class="q-mt-xs">
                    <div v-for="(r, idx) in financials.refundRecords.value" :key="idx" class="row items-center q-py-xs">
                      <div class="col-4">金额：<span class="text-primary">¥{{ r.amount }}</span></div>
                      <div class="col-4">方式：{{ getPaymentMethodName(r.method) || r.method }}</div>
                      <div class="col-4">时间：{{ formatDateTime(r.time) }}</div>
                    </div>
                  </div>
                </q-item-section>
              </q-item>
            </q-list>
          </div>

          <div class="col-md-12 col-xs-12" v-if="currentOrder.dailyOrders?.length > 0">
            <div class="text-subtitle1 q-mb-sm">每日房间安排</div>
            <q-list bordered separator>
              <q-item v-for="(day, index) in currentOrder.dailyOrders" :key="index">
                <q-item-section>
                  <q-item-label>{{ day.stayDate }}</q-item-label>
                </q-item-section>
                <q-item-section>
                  <q-item-label>{{ day.roomNumber }}</q-item-label>
                  <q-item-label caption>{{ getRoomTypeName(day.roomType) }}</q-item-label>
                </q-item-section>
                <q-item-section side>
                   <q-btn
                    v-if="!['cancelled', 'checked-out'].includes(currentOrder.status)"
                    flat round dense color="primary" icon="edit"
                    @click="openDailyRoomDialog(day)"
                   >
                     <q-tooltip>更换房间</q-tooltip>
                   </q-btn>
                </q-item-section>
              </q-item>
            </q-list>
          </div>

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
          flat label="金额调整" color="accent" icon="add_card"
          @click="showAdjustmentDialog = true"
        />
        <q-btn
          v-if="currentOrder && ['pending', 'checked-in', 'checked-out'].includes(currentOrder.status)"
          flat label="修改订单" color="secondary"
          @click="emit('change-order')"
        />
        <q-btn
          v-if="currentOrder?.status === 'pending'"
          flat label="办理入住" color="info"
          @click="emit('check-in')"
        />
        <!-- 传入订单对象，确保外层能打开更换房间弹窗 -->
        <q-btn
          v-if="currentOrder?.status === 'checked-in'"
          flat label="更改房间" color="warning"
          @click="emit('change-room', currentOrder)"
        >
          <q-tooltip>更换房间</q-tooltip>
        </q-btn>
        <q-btn
          v-if="currentOrder?.status === 'checked-in'"
          flat label="办理退房" color="positive"
          @click="emit('checkout')"
        />
        <q-btn
          v-if="currentOrder?.status === 'checked-in'"
          flat label="提前退房" color="warning" icon="logout"
          @click="emit('early-checkout')"
        />
        <q-btn
          v-if="financials.canRefundDeposit.value"
          flat label="退押金" color="purple" icon="account_balance_wallet"
          @click="emit('refund-deposit')"
        />
        <q-btn flat label="关闭" color="primary" v-close-popup />
      </q-card-actions>
    </q-card>

    <BillAdjustmentDialog
      v-if="currentOrder"
      v-model="showAdjustmentDialog"
      :order="currentOrder"
      @success="handleAdjustmentSuccess"
    />

    <EditDailyRoomDialog
      v-model="showDailyRoomDialog"
      :orderNumber="currentOrder?.orderNumber"
      :stayDate="selectedDay?.stayDate"
      :currentRoomNumber="selectedDay?.roomNumber"
      :currentRoomType="selectedDay?.roomType"
      @success="emit('refresh')"
    />
  </q-dialog>
</template>

<script setup>
import { ref, toRef } from 'vue';
import { useOrderFinancials } from '../composables/useOrderFinancials'; // 导入新逻辑
import BillAdjustmentDialog from './BillAdjustmentDialog.vue';
import EditDailyRoomDialog from './EditDailyRoomDialog.vue';

const props = defineProps({
  modelValue: Boolean,
  currentOrder: Object, // 这是一个普通对象，不是 ref，需要处理
  getStatusColor: Function,
  getOrderStatusText: Function,
  getRoomTypeName: Function,
  getPaymentMethodName: Function,
  formatDate: Function,
  formatDateTime: Function
});

const emit = defineEmits([
  'update:modelValue', 'check-in', 'change-room',
  'checkout', 'refund-deposit', 'change-order',
  'early-checkout', 'refresh'
]);

// --- 1. 使用新的 Composable 处理财务逻辑 ---
// 注意：props.currentOrder 是响应式的 prop，我们需要将其转换为 Ref 传递给 composable
// 这样当 prop 变化时，composable 内部的 computed 也会更新
const financials = useOrderFinancials(toRef(props, 'currentOrder'));

// --- 2. 简单的 UI 状态管理 (Sub-dialogs) ---
const showAdjustmentDialog = ref(false);
const showDailyRoomDialog = ref(false);
const selectedDay = ref(null);

function handleAdjustmentSuccess() {
  showAdjustmentDialog.value = false;
  emit('refresh');
}

function openDailyRoomDialog(day) {
  selectedDay.value = day;
  showDailyRoomDialog.value = true;
}
</script>
