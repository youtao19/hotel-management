<template>
  <q-dialog
    :model-value="modelValue"
    @update:model-value="val => emit('update:modelValue', val)"
    persistent
  >
    <q-card style="min-width: 500px; max-width: 600px;">
      <!-- 对话框标题 -->
      <q-card-section class="bg-purple text-white">
        <div class="text-h6">
          <q-icon name="account_balance_wallet" class="q-mr-sm" />
          退押金
        </div>
      </q-card-section>

      <q-card-section v-if="order">
        <!-- 订单押金信息展示 -->
        <div class="q-mb-lg">
          <q-card flat bordered>
            <q-card-section>
              <div class="text-subtitle2 q-mb-sm">订单押金信息</div>
              <div class="row q-col-gutter-md">
                <div class="col-6">
                  <div class="text-caption text-grey-7">订单号</div>
                  <div class="text-body2">{{ order.orderNumber }}</div>
                </div>
                <div class="col-6">
                  <div class="text-caption text-grey-7">客户姓名</div>
                  <div class="text-body2">{{ order.guestName }}</div>
                </div>
                <div class="col-6">
                  <div class="text-caption text-grey-7">房间号</div>
                  <div class="text-body2">{{ order.roomNumber }}</div>
                </div>
                <div class="col-6">
                  <div class="text-caption text-grey-7">订单状态</div>
                  <q-badge
                    :color="getStatusColor(order.status)"
                    :label="getOrderStatusText(order.status)"
                  />
                </div>
                <div class="col-6">
                  <div class="text-caption text-grey-7">原押金金额</div>
                  <div class="text-h6 text-purple text-weight-bold">¥{{ order.deposit || 0 }}</div>
                </div>
                <div class="col-6">
                  <div class="text-caption text-grey-7">已退押金</div>
                  <div class="text-body1 text-weight-medium">¥{{ order.refundedDeposit || 0 }}</div>
                </div>
                <div class="col-12">
                  <div class="text-caption text-grey-7">可退押金金额</div>
                  <div class="text-h6 text-positive text-weight-bold">¥{{ availableRefundAmount }}</div>
                </div>
                <div v-if="order.refundRecords && order.refundRecords.length" class="col-12 q-mt-sm">
                  <div class="text-caption text-grey-7">历史退款记录</div>
                  <q-timeline color="purple" layout="dense" class="q-mt-xs refund-history">
                    <q-timeline-entry
                      v-for="(r,i) in order.refundRecords"
                      :key="i"
                      :title="formatRefundTitle(r)"
                      :subtitle="formatRefundSubtitle(r)"
                      color="purple"
                      icon="history"
                    />
                  </q-timeline>
                </div>
              </div>
            </q-card-section>
          </q-card>
        </div>

        <!-- 退押金表单 -->
        <q-form @submit="handleRefundDeposit" class="q-gutter-md">
          <!-- 退押金金额 -->
          <q-input
            v-model.number="refundForm.amount"
            type="number"
            label="退押金金额"
            prefix="¥"
            outlined
            :rules="[
              val => !!val || '请输入退押金金额',
              val => val > 0 || '退押金金额必须大于0',
              val => val <= availableRefundAmount || `退押金金额不能超过¥${availableRefundAmount}`
            ]"
            hint="可退押金金额上限：¥{{ availableRefundAmount }}"
          >
            <template v-slot:append>
              <q-btn
                flat
                dense
                color="purple"
                label="全退"
                @click="refundForm.amount = availableRefundAmount"
                size="sm"
                :disable="availableRefundAmount <= 0"
              />
            </template>
          </q-input>

          <!-- 退押金方式 -->
          <q-select
            v-model="refundForm.method"
            :options="paymentMethodOptions"
            label="退押金方式"
            outlined
            emit-value
            map-options
            :rules="[val => !!val || '请选择退押金方式']"
          />

          <!-- 扣除费用（可选） -->
          <q-input
            v-model.number="refundForm.deductAmount"
            type="number"
            label="扣除费用（可选）"
            prefix="¥"
            outlined
            hint="如有物品损坏、清洁费等需要扣除的费用"
            :rules="[
              val => val >= 0 || '扣除费用不能为负数',
              val => val < refundForm.amount || '扣除费用不能大于退押金金额'
            ]"
          />

          <!-- 实际退款金额（自动计算） -->
          <q-input
            :model-value="actualRefundAmount"
            label="实际退款金额"
            prefix="¥"
            outlined
            readonly
            class="bg-grey-1"
            :hint="`剩余押金：¥${remainingDepositAfter}`"
          />

          <!-- 退押金说明 -->
          <q-input
            v-model="refundForm.notes"
            type="textarea"
            label="退押金说明（可选）"
            outlined
            autogrow
            hint="可输入退押金相关说明或备注"
          />

          <!-- 操作员确认 -->
          <q-input
            v-model="refundForm.operator"
            label="操作员"
            outlined
            readonly
            hint="当前登录用户"
          />
        </q-form>
      </q-card-section>

      <!-- 对话框操作按钮 -->
      <q-card-actions align="right" class="q-pa-md">
        <q-btn
          flat
          label="取消"
          color="grey-7"
          @click="closeDialog"
        />
        <q-btn
          color="purple"
          label="确认退押金"
          icon="account_balance_wallet"
          @click="handleRefundDeposit"
          :loading="loading"
          :disable="!isFormValid || availableRefundAmount <= 0 || actualRefundAmount<=0"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { useQuasar } from 'quasar'
import { useUserStore } from '../stores/userStore'
import { orderApi } from '../api'
import { useViewStore } from '../stores/viewStore'

const $q = useQuasar()
const userStore = useUserStore()
const viewStore = useViewStore()

// Props
const props = defineProps({
  modelValue: Boolean,
  order: Object,
  getStatusColor: Function,
  getOrderStatusText: Function
})

// Emits
const emit = defineEmits(['update:modelValue', 'refund-deposit'])

// 响应式数据
const loading = ref(false)

// 退押金表单
const refundForm = ref({
  amount: 0,
  method: '',
  deductAmount: 0,
  notes: '',
  operator: userStore.currentUser?.username || '系统操作员'
})

// 从 viewStore 获取支付方式选项，用作退押金方式
const paymentMethodOptions = computed(() => viewStore.paymentMethodOptions)

// 计算属性
// 通过接口获取的押金状态（优先于传入的冗余字段）
const remoteDepositInfo = ref(null)

// 计算可退押金金额
const availableRefundAmount = computed(() => {
  if (remoteDepositInfo.value) return Math.max(0, remoteDepositInfo.value.remaining)
  if (!props.order) return 0
  const originalDeposit = props.order.deposit || 0
  const refundedDeposit = props.order.refundedDeposit || 0
  return Math.max(0, originalDeposit - refundedDeposit)
})

// 实际退款金额（自动计算）
const actualRefundAmount = computed(() => {
  const refundAmount = refundForm.value.amount || 0
  const deductAmount = refundForm.value.deductAmount || 0
  return Math.max(0, refundAmount - deductAmount)
})

// 剩余可退押金（自动计算）
const remainingDepositAfter = computed(() => {
  const baseDeposit = remoteDepositInfo.value ? remoteDepositInfo.value.deposit : (props.order?.deposit || 0)
  const refunded = remoteDepositInfo.value ? remoteDepositInfo.value.refunded : (props.order?.refundedDeposit || 0)
  return Math.max(0, baseDeposit - refunded - actualRefundAmount.value)
})

// 表单有效性校验
const isFormValid = computed(() => {
  return refundForm.value.amount > 0 &&
         refundForm.value.method &&
         refundForm.value.operator &&
         refundForm.value.amount <= availableRefundAmount.value &&
         (refundForm.value.deductAmount || 0) >= 0 &&
         (refundForm.value.deductAmount || 0) < refundForm.value.amount
})

// 监听对话框打开，重置表单
watch(() => props.modelValue, async (newVal) => {
  if (newVal && props.order) {
    remoteDepositInfo.value = null
    try {
      const res = await orderApi.getDepositInfo(props.order.orderNumber)
      if (res?.data) remoteDepositInfo.value = res.data
    } catch (e) {
      console.warn('获取押金状态失败(使用本地数据):', e.message)
    }
    refundForm.value = {
      amount: availableRefundAmount.value,
      // 退押方式默认：优先用订单的支付方式，其次使用中文“现金”
      method: viewStore.normalizePaymentMethodForDB(
        props.order.paymentMethod || props.order.payment_method || '现金'
      ),
      deductAmount: 0,
      notes: '',
      operator: userStore.currentUser?.username || '系统操作员'
    }
  }
})

// 方法
function closeDialog() {
  emit('update:modelValue', false)
}

// 退款标题
function formatRefundTitle(r) {
  return `退款 ¥${r.actualRefundAmount || r.refundAmount || 0}`
}

// 退款副标题
function formatRefundSubtitle(r) {
  const t = r.refundTime ? new Date(r.refundTime).toLocaleString() : ''
  const m = viewStore.getPaymentMethodName(r.method || '')
  const op = r.operator || ''
  return `${t} · ${m}${op ? (' · ' + op) : ''}`
}

// 处理退款
async function handleRefundDeposit() {
  // 表单验证
  if (!isFormValid.value) {
    $q.notify({
      type: 'negative',
      message: '请完整填写退押金信息',
      position: 'top'
    })
    return
  }

  if (availableRefundAmount.value <= 0) {
    $q.notify({
      type: 'negative',
      message: '没有可退的押金金额',
      position: 'top'
    })
    return
  }

  // 确认退押金
  const confirmed = await new Promise(resolve => {
    $q.dialog({
      title: '确认退押金',
      message: `确定要为订单 ${props.order.orderNumber} 退押金 ¥${actualRefundAmount.value} 吗？${
        refundForm.value.deductAmount > 0 ? `\n\n扣除费用：¥${refundForm.value.deductAmount}` : ''
      }\n\n退款方式：${viewStore.getPaymentMethodName(refundForm.value.method)}`,
      cancel: true,
      persistent: true,
      html: true
    }).onOk(() => resolve(true))
     .onCancel(() => resolve(false))
  })

  if (!confirmed) return

  loading.value = true

  try {
    // 构造退押金数据
    const refundData = {
      orderNumber: props.order.orderNumber,
      originalDeposit: props.order.deposit || 0,
      refundAmount: refundForm.value.amount,
      deductAmount: refundForm.value.deductAmount || 0,
      actualRefundAmount: actualRefundAmount.value,
      method: refundForm.value.method,
      notes: refundForm.value.notes,
      operator: refundForm.value.operator,
      refundTime: new Date().toISOString()
    }

    // 发出退押金事件
    emit('refund-deposit', refundData)

    // 显示成功消息
    $q.notify({
      type: 'positive',
      message: `退押金申请已提交，实际退款金额：¥${actualRefundAmount.value}`,
      position: 'top'
    })

    // 关闭对话框
    closeDialog()

  } catch (error) {
    console.error('退押金处理失败:', error)
    $q.notify({
      type: 'negative',
      message: '退押金处理失败: ' + (error.message || '未知错误'),
      position: 'top'
    })
  } finally {
    loading.value = false
  }
}

</script>

<style scoped>
.q-card {
  border-radius: 12px;
}

.q-card-section {
  padding: 16px;
}

.text-caption {
  font-size: 0.75rem;
  margin-bottom: 4px;
}

.text-body2 {
  font-size: 0.875rem;
  font-weight: 500;
}

.bg-grey-1 {
  background-color: #fafafa;
}
</style>
