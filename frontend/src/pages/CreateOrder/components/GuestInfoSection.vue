<template>
  <div class="form-section q-mb-md">
    <div class="text-subtitle1 q-mb-sm">客人信息</div>
    <div class="row q-col-gutter-md">
      <div class="col-md-4 col-xs-12">
        <q-input v-model="modelValue.guestName" label="姓名" filled :rules="[val => !!val || '请输入姓名']" />
      </div>
      <div class="col-md-4 col-xs-12">
        <q-input v-model="modelValue.phone" label="手机号（可选）" filled mask="###########" hint="选填，用于联系客人" />
      </div>
    </div>
  </div>
</template>

<script setup>
defineProps({
  modelValue: { type: Object, required: true }
})
</script>
