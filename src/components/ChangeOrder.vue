<template>
  <q-dialog v-model="localDialog">
    <q-card style="min-width: 400px">
      <q-card-section>
        <div class="text-h6">修改订单</div>
      </q-card-section>

      <q-card-section>
        <q-input v-model="localOrder.guestName" label="客人姓名" />
        <q-input v-model="localOrder.phone" label="手机号" />
        <q-input v-model="localOrder.roomNumber" label="房间号" />
        <q-input v-model="localOrder.remarks" label="备注" type="textarea" />
      </q-card-section>

      <q-card-actions align="right">
        <q-btn flat label="取消" color="primary" v-close-popup />
        <q-btn flat label="保存" color="secondary" @click="saveOrder" />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup>
import { ref,reactive,watch } from 'vue'

const props = defineProps({
  modelValue: Boolean, // 父组件传来的状态
  order: Object
})

const emit = defineEmits(['update:modelValue', 'change-order'])

const localDialog = ref(props.modelValue)
const localOrder = reactive({ ...props.order })

watch(
  () => props.modelValue,
  (newValue) => {
    localDialog.value = newValue
  }
)

watch(
  () => props.order,
  (newValue) => {
    localOrder.value = { ...newValue }
  }
)

function closeDialog() {
  localDialog.value = false
  emit('update:modelValue', false)
}

function saveOrder() {
  emit('change-order', { ...localOrder })
  closeDialog()
}
</script>
