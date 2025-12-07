<template>
  <q-dialog
    :model-value="modelValue"
    @update:model-value="val => emit('update:modelValue', val)"
    persistent
    @before-show="logic.initForm"
  >
    <q-card style="min-width: 500px; max-width: 600px; border-radius: 12px;">
      <q-card-section class="bg-purple text-white q-py-sm">
        <div class="text-h6 row items-center">
          <q-icon name="account_balance_wallet" class="q-mr-sm" />
          退押金
        </div>
      </q-card-section>

      <q-card-section v-if="order">
        <div class="q-mb-lg">
          <q-card flat bordered>
            <q-card-section>
              <div class="text-subtitle2 q-mb-sm text-purple">订单押金概览</div>
              <div class="row q-col-gutter-sm">
                <div class="col-4 text-caption text-grey">订单号</div>
                <div class="col-8 text-body2">{{ order.orderNumber }}</div>

                <div class="col-4 text-caption text-grey">客户</div>
                <div class="col-8 text-body2">{{ order.guestName }} ({{ order.roomNumber }})</div>

                <div class="col-12 q-my-xs"><q-separator /></div>

                <div class="col-6">
                   <div class="text-caption text-grey">原押金</div>
                   <div class="text-subtitle1 text-weight-bold">¥{{ order.deposit || 0 }}</div>
                </div>
                <div class="col-6">
                   <div class="text-caption text-grey">已退</div>
                   <div class="text-subtitle1">¥{{ order.refundedDeposit || 0 }}</div>
                </div>

                <div class="col-12 bg-purple-1 q-pa-sm rounded-borders q-mt-sm text-center">
                  <div class="text-caption text-purple-8">当前可退押金上限</div>
                  <div class="text-h5 text-purple text-weight-bold">¥{{ logic.availableRefundAmount.value }}</div>
                </div>

                <div v-if="order.refundRecords?.length" class="col-12 q-mt-md">
                  <q-expansion-item dense label="历史退款记录" header-class="text-grey-7" icon="history">
                    <q-timeline color="purple" layout="dense" class="q-ml-md q-mt-sm refund-history">
                      <q-timeline-entry
                        v-for="(r,i) in order.refundRecords"
                        :key="i"
                        :title="logic.formatRefundTitle(r)"
                        :subtitle="logic.formatRefundSubtitle(r)"
                        icon="done"
                      />
                    </q-timeline>
                  </q-expansion-item>
                </div>
              </div>
            </q-card-section>
          </q-card>
        </div>

        <q-form class="q-gutter-md">
          <q-input
            v-model.number="logic.refundForm.amount"
            type="number"
            label="本次退押金金额"
            prefix="¥"
            outlined
            :rules="[
              val => val > 0 || '金额必须大于0',
              val => val <= logic.availableRefundAmount.value || '不能超过可退上限'
            ]"
          >
            <template v-slot:append>
              <q-btn
                flat dense color="purple" label="全部"
                @click="logic.refundForm.amount = logic.availableRefundAmount.value"
                :disable="logic.availableRefundAmount.value <= 0"
              />
            </template>
          </q-input>

          <q-select
            v-model="logic.refundForm.method"
            :options="logic.paymentMethodOptions.value"
            label="退款方式"
            outlined
            emit-value
            map-options
          />

          <q-input
            v-model.number="logic.refundForm.deductAmount"
            type="number"
            label="扣除费用 (可选)"
            prefix="¥"
            outlined
            hint="例如：物品损坏赔偿、清洁费等"
          />

          <div class="row items-center q-pa-sm bg-grey-2 rounded-borders">
             <div class="col-6">实际退给客户:</div>
             <div class="col-6 text-right text-h6 text-positive">¥{{ logic.actualRefundAmount.value }}</div>
             <div class="col-12 text-caption text-grey text-right">
               (预计剩余押金: ¥{{ logic.remainingDepositAfter.value }})
             </div>
          </div>

          <q-input
            v-model="logic.refundForm.notes"
            type="textarea"
            label="备注"
            outlined
            autogrow
            rows="2"
          />
          <q-input
            v-model="logic.refundForm.operator"
            label="操作员"
            outlined
            readonly
            dense
            bg-color="grey-1"
          />
        </q-form>
      </q-card-section>

      <q-card-actions align="right" class="q-pa-md bg-grey-1">
        <q-btn flat label="取消" color="grey-7" v-close-popup />
        <q-btn
          color="purple"
          label="确认退押金"
          icon="account_balance_wallet"
          @click="onConfirm"
          :loading="logic.loading.value"
          :disable="!logic.isFormValid.value"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup>
import { useQuasar } from 'quasar'
import { useRefundDepositLogic } from '../composables/useRefundDepositLogic'

const props = defineProps({
  modelValue: Boolean,
  order: Object,
  getStatusColor: Function, // 可选：如果组件内不再直接使用，可移除
  getOrderStatusText: Function
})

const emit = defineEmits(['update:modelValue', 'refund-deposit'])
const $q = useQuasar()

// 使用 Composable
const logic = useRefundDepositLogic(props)

// UI 层的确认交互
async function onConfirm() {
  if (!logic.isFormValid.value) return

  // 1. 弹出确认框
  $q.dialog({
    title: '确认退押金',
    message: `
      <div class="text-body1">即将为订单 <b>${props.order.orderNumber}</b> 退款</div>
      <div class="text-h6 text-positive q-my-md">¥${logic.actualRefundAmount.value}</div>
      ${logic.refundForm.deductAmount > 0 ? `<div class="text-caption text-negative">含扣除费用: ¥${logic.refundForm.deductAmount}</div>` : ''}
      <div class="text-caption">退款方式: ${logic.viewStore.getPaymentMethodName(logic.refundForm.method)}</div>
    `,
    html: true,
    cancel: true,
    persistent: true,
    ok: { label: '确认退款', color: 'purple' }
  }).onOk(() => {
    // 2. 确认后提交
    handleSubmit()
  })
}

function handleSubmit() {
  try {
    const data = logic.getSubmitData()
    emit('refund-deposit', data)
    emit('update:modelValue', false)
  } catch (e) {
    $q.notify({ type: 'negative', message: '提交失败' })
  }
}
</script>

<style scoped>
.refund-history {
  font-size: 12px;
}
</style>
