<template>
  <q-dialog
    :model-value="modelValue"
    @update:model-value="val => emit('update:modelValue', val)"
    persistent
    @before-show="handleOpen"
  >
    <q-card style="min-width: 400px">
      <q-card-section class="row items-center">
        <div class="text-h6">办理续住</div>
        <q-space />
        <q-btn icon="close" flat round dense v-close-popup />
      </q-card-section>

      <q-card-section v-if="currentOrder">
        <div class="q-mb-md p-3 bg-grey-1 rounded-borders">
          <div class="text-subtitle2">当前订单信息</div>
          <div class="row q-col-gutter-sm text-caption q-mt-xs">
             <div class="col-6">房间: {{ currentOrder.roomNumber }}</div>
             <div class="col-6">当前离店: {{ formatDate(currentOrder.checkOutDate) }}</div>
             <div class="col-12">房型: {{ getRoomTypeName(currentOrder.roomType) }}</div>
          </div>
        </div>

        <q-form @submit="onSubmit" class="q-gutter-md">
          <q-input
            filled
            v-model.number="form.extendDays.value"
            type="number"
            label="续住天数"
            :rules="[val => val > 0 || '天数必须大于0']"
            min="1"
          />

          <q-input
            filled
            :model-value="form.newCheckOutDate.value"
            label="新离店日期"
            readonly
            hint="根据续住天数自动计算"
            bg-color="blue-1"
          />

          <q-input
            filled
            v-model.number="form.additionalAmount.value"
            type="number"
            label="补交房费 (元)"
            prefix="¥"
            :rules="[val => val >= 0 || '金额不能为负数']"
          />

          <q-select
            filled
            v-model="form.paymentMethod.value"
            :options="paymentOptions"
            label="支付方式"
            emit-value
            map-options
          />

          <q-input
            filled
            v-model="form.remarks.value"
            type="textarea"
            label="续住备注"
            rows="2"
          />

          <div class="row justify-end q-mt-lg">
            <q-btn flat label="取消" color="primary" v-close-popup />
            <q-btn
              label="确认续住"
              type="submit"
              color="primary"
              :loading="loadingRooms"
              :disable="!form.isValid.value"
            />
          </div>
        </q-form>
      </q-card-section>
    </q-card>
  </q-dialog>
</template>

<script setup>
import { toRef } from 'vue'
import { useExtendStayLogic } from '../composables/useExtendStayLogic'

const props = defineProps({
  modelValue: Boolean,
  currentOrder: Object,
  getRoomTypeName: { type: Function, default: (v) => v },
  loadingRooms: Boolean
})

const emit = defineEmits(['update:modelValue', 'extend-stay'])

// --- 1. 使用 Composable ---
// 将 props.currentOrder 转为 ref 传递给逻辑层，以便响应变化
const form = useExtendStayLogic(toRef(props, 'currentOrder'))

// --- 2. 辅助数据 ---
const paymentOptions = [
  { label: '微信支付', value: 'wechat' },
  { label: '支付宝', value: 'alipay' },
  { label: '现金', value: 'cash' },
  { label: '其他', value: 'other' }
]

const formatDate = (val) => {
  if (!val) return ''
  return val.split('T')[0]
}

// --- 3. 事件处理 ---
function handleOpen() {
  form.resetForm()
}

function onSubmit() {
  if (!form.isValid.value) return

  // 构造提交给父组件的数据对象
  const submitData = {
    orderNumber: props.currentOrder.orderNumber,
    extendDays: form.extendDays.value,
    newCheckOutDate: form.newCheckOutDate.value,
    additionalAmount: form.additionalAmount.value,
    paymentMethod: form.paymentMethod.value,
    remarks: form.remarks.value
  }

  emit('extend-stay', submitData)
}
</script>
