<template>
  <div class="row q-col-gutter-md q-mb-md">
    <div class="col-md-3 col-sm-6 col-xs-12">
      <q-select
        :model-value="filters.type"
        @update:model-value="(val) => $emit('update:filters', { ...filters, type: val })"
        :options="roomTypeOptions"
        label="房型筛选"
        outlined dense emit-value map-options clearable
      />
    </div>
    <div class="col-md-3 col-sm-6 col-xs-12">
      <q-select
        :model-value="filters.status"
        @update:model-value="(val) => $emit('update:filters', { ...filters, status: val })"
        :options="statusOptions"
        label="状态筛选"
        outlined dense emit-value map-options clearable
      />
    </div>
    <div class="col-md-3 col-sm-6 col-xs-12">
      <q-input
        :model-value="filters.search"
        @update:model-value="(val) => $emit('update:filters', { ...filters, search: val })"
        label="搜索房间号"
        outlined dense clearable debounce="500"
      >
        <template v-slot:append><q-icon name="search" /></template>
      </q-input>
    </div>
    <div class="col-md-3 col-sm-6 col-xs-12">
      <q-btn
        color="primary"
        icon="filter_alt"
        label="应用筛选"
        class="full-width"
        @click="$emit('apply')"
      />
    </div>
  </div>
</template>

<script setup>
defineProps(['filters', 'roomTypeOptions', 'statusOptions'])
defineEmits(['update:filters', 'apply'])
</script>
