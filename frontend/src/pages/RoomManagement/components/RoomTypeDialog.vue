<template>
  <q-dialog :model-value="modelValue" @update:model-value="$emit('update:modelValue', $event)" persistent>
    <q-card style="min-width: 400px">
      <q-card-section class="bg-primary text-white">
        <div class="text-h6">{{ isEdit ? '编辑房型' : '添加房型' }}</div>
      </q-card-section>

      <q-card-section>
        <q-form @submit="onSubmit" class="q-gutter-md">
          <q-input
            v-model="form.type_code"
            label="房型代码"
            outlined
            :rules="[val => !!val || '请输入代码']"
            :readonly="isEdit"
            hint="如: standard"
          />
          <q-input
            v-model="form.type_name"
            label="房型名称"
            outlined
            :rules="[val => !!val || '请输入名称']"
          />
          <q-input
            v-model.number="form.base_price"
            label="基础价格"
            outlined
            type="number"
            prefix="¥"
            :rules="[val => val > 0 || '价格必须大于0']"
          />
          <q-input
            v-model="form.description"
            label="描述"
            outlined
            type="textarea"
            autogrow
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

const props = defineProps(['modelValue', 'typeData', 'loading'])
const emit = defineEmits(['update:modelValue', 'save'])

const isEdit = computed(() => !!props.typeData)
const form = ref({ type_code: '', type_name: '', base_price: 0, description: '' })

watch(() => props.modelValue, (val) => {
  if (val && props.typeData) {
    form.value = { ...props.typeData, base_price: Number(props.typeData.base_price) }
  } else if (val) {
    form.value = { type_code: '', type_name: '', base_price: 0, description: '' }
  }
})

const onSubmit = () => {
  emit('save', { ...form.value })
}
</script>
