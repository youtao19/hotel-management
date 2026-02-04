<template>
  <q-dialog :model-value="modelValue" @update:model-value="$emit('update:modelValue', $event)" persistent>
    <q-card style="min-width: 400px">
      <q-card-section class="bg-primary text-white">
        <div class="text-h6">{{ isEdit ? '编辑房间' : '添加房间' }}</div>
      </q-card-section>

      <q-card-section>
        <q-form @submit="onSubmit" class="q-gutter-md">
          <q-input
            v-model="form.room_number"
            label="房间号"
            outlined
            :rules="[val => !!val || '请输入房间号']"
            :readonly="isEdit"
          />
          <q-select
            v-model="form.type_code"
            :options="typeOptions"
            label="房型"
            outlined
            emit-value
            map-options
            :rules="[val => !!val || '请选择房型']"
          />
          <q-select
            v-model="form.status"
            :options="statusOptions"
            label="状态"
            outlined
            emit-value
            map-options
            :rules="[val => !!val || '请选择状态']"
          />
          <q-input
            v-model.number="form.price"
            label="价格"
            outlined
            type="number"
            prefix="¥"
            :rules="[val => val > 0 || '价格必须大于0']"
          />

          <div class="row justify-end q-gutter-sm">
            <q-btn flat label="取消" v-close-popup />
            <q-btn type="submit" color="primary" label="保存" :loading="loading" />
          </div>
        </q-form>
      </q-card-section>
    </q-card>
  </q-dialog>
</template>

<script setup>
import { ref, watch, computed } from 'vue'

const props = defineProps(['modelValue', 'roomData', 'typeOptions', 'loading'])
const emit = defineEmits(['update:modelValue', 'save'])

const isEdit = computed(() => !!props.roomData)
const form = ref({ room_number: '', type_code: '', status: 'available', price: 0 })

const statusOptions = [
  { label: '可用', value: 'available' },
  { label: '已入住', value: 'occupied' },
  { label: '清洁中', value: 'cleaning' },
  { label: '维修中', value: 'repair' }
]

watch(() => props.modelValue, (val) => {
  if (val && props.roomData) {
    // 仅保留后端允许的字段，避免更新房间接口校验失败
    form.value = {
      room_number: props.roomData.room_number,
      type_code: props.roomData.type_code,
      status: props.roomData.status,
      price: Number(props.roomData.price)
    }
  } else if (val) {
    // 重置表单
    form.value = { room_number: '', type_code: '', status: 'available', price: 0 }
  }
})

const onSubmit = () => {
  emit('save', { ...form.value })
}
</script>
