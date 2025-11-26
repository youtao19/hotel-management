<template>
  <q-dialog :model-value="modelValue" @update:model-value="val => emit('update:modelValue', val)" persistent>
    <q-card style="min-width: 400px;">
      <q-card-section class="row items-center q-pb-none">
        <div class="text-h6">添加金额调整</div>
        <q-space />
        <q-btn icon="close" flat round dense v-close-popup />
      </q-card-section>

      <q-card-section>
        <q-form @submit.prevent="handleSubmit" class="q-gutter-md">
          <q-input
            filled
            v-model="adjustment.amount"
            label="调整金额 *"
            type="number"
            step="0.01"
            :rules="[val => !!val || '金额不能为空']"
            hint="正数表示向客户收款 (如赔偿)，负数表示向客户退款"
          />

          <q-select
            filled
            v-model="adjustment.type"
            :options="adjustmentTypes"
            label="调整类型 *"
            :rules="[val => !!val || '请选择调整类型']"
          />

          <q-select
            filled
            v-model="adjustment.paymentMethod"
            :options="paymentOptions"
            label="支付方式 *"
            :rules="[val => !!val || '请选择支付方式']"
          />

          <q-input
            filled
            v-model="adjustment.notes"
            label="备注"
            type="textarea"
            autogrow
          />

          <q-card-actions align="right">
            <q-btn flat label="取消" color="primary" v-close-popup />
            <q-btn type="submit" label="保存" color="positive" :loading="loading" />
          </q-card-actions>
        </q-form>
      </q-card-section>
    </q-card>
  </q-dialog>
</template>

<script setup>
import { ref, watch, computed } from 'vue';
import { useQuasar } from 'quasar';
import api from 'src/api';
import { useViewStore } from 'src/stores/viewStore'; // 1. 导入 viewStore
import Decimal from 'decimal.js';

const props = defineProps({
  modelValue: Boolean,
  order: Object
});

const emit = defineEmits(['update:modelValue', 'success']);

const $q = useQuasar();
const loading = ref(false);
const viewStore = useViewStore(); // 2. 实例化 store
const toDecimal = (v) => {
  try { return new Decimal(v || 0) } catch { return new Decimal(0) }
};
const toAmountNumber = (v) => Number(toDecimal(v).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toString());

const adjustment = ref({
  amount: null,
  type: null,
  paymentMethod: null,
  notes: ''
});

const adjustmentTypes = ['补收', '退款'];

// 3. 从 store 创建计算属性
const paymentOptions = computed(() => viewStore.paymentMethodOptions.map(opt => opt.label));

// 重置表单
watch(() => props.modelValue, (newValue) => {
  if (newValue) {
    adjustment.value = {
      amount: null,
      type: null,
      paymentMethod: null,
      notes: ''
    };
  }
});

async function handleSubmit() {
  loading.value = true;
  try {
    const payload = {
      order_id: props.order.orderNumber,
      change_price: toAmountNumber(adjustment.value.amount),
      change_type: adjustment.value.type,
      method: adjustment.value.paymentMethod,
      notes: adjustment.value.notes
    };

    const billRes = await api.post('/bills/add', payload);
    console.log('💰金额调整',billRes);
    if(!billRes){
      $q.notify({
        color: 'negative',
        message: '金额调整失败'
      })
      throw new Error('金额调整失败');
    }

    $q.notify({
      color: 'positive',
      message: '金额调整成功！'
    });

    emit('success');
    emit('update:modelValue', false);

  } catch (error) {
    console.error('金额调整失败:', error);
    const errorMessage = error.response?.data?.message || '操作失败，请稍后重试';
    $q.notify({
      color: 'negative',
      message: errorMessage
    });
  } finally {
    loading.value = false;
  }
}
</script>
