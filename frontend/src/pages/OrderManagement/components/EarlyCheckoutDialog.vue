<template>
  <q-dialog
    :model-value="modelValue"
    @update:model-value="val => emit('update:modelValue', val)"
    persistent
  >
    <q-card style="min-width: 500px">
      <q-card-section class="row items-center">
        <div class="text-h6">提前退房结算</div>
        <q-space />
        <q-btn icon="close" flat round dense v-close-popup />
      </q-card-section>

      <q-card-section v-if="order">
        <div class="q-gutter-md">
          <q-banner class="bg-blue-1 text-primary rounded-borders">
            <template v-slot:avatar>
              <q-icon name="info" color="primary" />
            </template>
            <div>当前离店日期: {{ formatDate(order.checkOutDate) }}</div>
            <div>原定入住时长: {{ getDays(order.checkInDate, order.checkOutDate) }} 晚</div>
          </q-banner>

          <q-form @submit="logic.submit" class="q-gutter-md q-mt-sm">

            <q-input
              filled
              v-model="logic.form.newCheckOutDate"
              label="新离店日期"
              type="date"
              :min="formatDate(order.checkInDate)"
              :max="formatDate(order.checkOutDate)"
              hint="请选择实际离开的日期"
            />

            <div class="row q-col-gutter-md">
               <div class="col-6">
                 <q-input
                   filled
                   :model-value="logic.actualDays.value"
                   label="实际入住天数"
                   readonly
                   bg-color="grey-2"
                   suffix="晚"
                 />
               </div>
               <div class="col-6">
                 <q-input
                   filled
                   v-model.number="logic.form.penaltyAmount"
                   label="违约金/赔偿金"
                   type="number"
                   prefix="¥"
                 />
               </div>
            </div>

            <q-card bordered flat class="bg-grey-1">
              <q-card-section>
                <div class="row items-center justify-between">
                   <div class="text-subtitle2">预计退还房费</div>
                   <div class="text-h5 text-positive text-weight-bold">
                     ¥{{ logic.refundAmount.value }}
                   </div>
                </div>
                <div class="text-caption text-grey q-mt-sm">
                  计算公式: 已付房费 - (实际天数 × 单价) - 违约金
                </div>
              </q-card-section>
            </q-card>

            <q-select
              filled
              v-model="logic.form.refundMethod"
              :options="paymentOptions"
              label="退款方式"
              emit-value
              map-options
            />

            <q-input
              filled
              v-model="logic.form.remarks"
              label="备注"
              type="textarea"
              rows="2"
            />

            <div class="row justify-end q-mt-lg">
              <q-btn flat label="取消" color="primary" v-close-popup />
              <q-btn
                label="确认退房"
                type="submit"
                color="warning"
                :disable="!logic.isValid.value"
              />
            </div>
          </q-form>
        </div>
      </q-card-section>
    </q-card>
  </q-dialog>
</template>

<script setup>
import { date } from 'quasar'
import { useEarlyCheckoutLogic } from '../composables/useEarlyCheckoutLogic'

const props = defineProps({
  modelValue: Boolean,
  order: Object
})

const emit = defineEmits(['update:modelValue', 'success'])

// 使用 Composable
const logic = useEarlyCheckoutLogic(props, emit)

// UI 辅助数据
const paymentOptions = [
  { label: '原路退回 (微信)', value: 'wechat' },
  { label: '原路退回 (支付宝)', value: 'alipay' },
  { label: '现金', value: 'cash' },
  { label: '线下转账', value: 'transfer' }
]

// 简单的日期格式化工具
const formatDate = (val) => {
  if (!val) return ''
  return typeof val === 'string' && val.includes('T') ? val.split('T')[0] : val
}

const getDays = (start, end) => {
  if (!start || !end) return 0
  return date.getDateDiff(new Date(end), new Date(start), 'days')
}
</script>
