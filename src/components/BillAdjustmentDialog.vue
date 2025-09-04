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

const props = defineProps({
  modelValue: Boolean,
  orderId: {
    type: String,
    required: true
  }
});

const emit = defineEmits(['update:modelValue', 'success']);

const $q = useQuasar();
const loading = ref(false);
const viewStore = useViewStore(); // 2. 实例化 store

const adjustment = ref({
  amount: null,
  type: null,
  paymentMethod: null,
  notes: ''
});

const adjustmentTypes = ['客户赔偿', '服务费', '不满意退款', '其他'];

// 3. 从 store 创建计算属性
const paymentOptions = computed(() => viewStore.paymentMethodOptions.map(opt => opt.label));

// Reset form when dialog opens
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
      orderId: props.orderId,
      amount: parseFloat(adjustment.value.amount),
      type: adjustment.value.type,
      paymentMethod: adjustment.value.paymentMethod,
      notes: adjustment.value.notes
    };

    await api.post('/bills/adjustment', payload);

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
