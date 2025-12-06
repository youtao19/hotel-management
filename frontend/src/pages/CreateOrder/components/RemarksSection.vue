<template>
  <div class="form-section q-mb-md">
    <div class="text-subtitle1 q-mb-sm">备注信息</div>
    <div class="row q-col-gutter-md">
      <div class="col-md-12 col-xs-12">
        <q-input v-model="modelValue.remarks" label="备注" filled type="textarea" autogrow />
      </div>
    </div>
  </div>
</template>

<script setup>
defineProps({
  modelValue: { type: Object, required: true }
})
</script>
