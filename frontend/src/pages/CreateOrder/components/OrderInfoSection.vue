<template>
  <div class="form-section q-mb-md">
    <div class="text-subtitle1 q-mb-sm">订单信息</div>
    <div class="row q-col-gutter-md">
      <div class="col-md-4 col-xs-12">
        <q-input v-model="modelValue.orderId" label="订单号" filled
          :rules="[val => !!val || '请输入订单号']" hint="自动生成，可手动修改" />
      </div>
      <div class="col-md-4 col-xs-12">
        <q-select v-model="modelValue.status" :options="statusOptions" label="订单状态" filled
          emit-value map-options :rules="[val => !!val || '请选择订单状态']" />
      </div>
      <div class="col-md-4 col-xs-12">
        <q-select v-model="modelValue.orderSource" :options="sourceOptions" label="订单来源" filled
          emit-value map-options />
      </div>
      <div class="col-md-4 col-xs-12">
        <q-input v-model="modelValue.sourceNumber" label="来源编号" filled hint="OTA订单号/旅行社单号等" />
      </div>
    </div>
  </div>
</template>

<script setup>
defineProps({
  modelValue: { type: Object, required: true },
  statusOptions: { type: Array, required: true },
  sourceOptions: { type: Array, required: true }
})
</script>
