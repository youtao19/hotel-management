<template>
  <div class="row q-col-gutter-sm items-center">
    <div class="col-grow">
      <q-input
        :model-value="filters.search"
        @update:model-value="(val) => $emit('update:filters', { ...filters, search: val })"
        placeholder="搜索房间号..."
        outlined
        dense
        bg-color="white"
        clearable
        debounce="300"
      >
        <template v-slot:prepend>
          <q-icon name="search" color="grey-6" />
        </template>
      </q-input>
    </div>
    <div class="col-auto">
      <q-select
        :model-value="filters.type"
        @update:model-value="(val) => $emit('update:filters', { ...filters, type: val })"
        :options="roomTypeOptions"
        label="房型"
        outlined
        dense
        bg-color="white"
        emit-value
        map-options
        clearable
        style="min-width: 150px"
      >
        <template v-slot:prepend>
          <q-icon name="category" size="xs" color="grey-6" />
        </template>
      </q-select>
    </div>
    <div class="col-auto">
      <q-select
        :model-value="filters.status"
        @update:model-value="(val) => $emit('update:filters', { ...filters, status: val })"
        :options="statusOptions"
        label="状态"
        outlined
        dense
        bg-color="white"
        emit-value
        map-options
        clearable
        style="min-width: 150px"
      >
        <template v-slot:prepend>
          <q-icon name="fiber_manual_record" size="xs" color="grey-6" />
        </template>
      </q-select>
    </div>
  </div>
</template>

<script setup>
defineProps(['filters', 'roomTypeOptions', 'statusOptions'])
defineEmits(['update:filters', 'apply'])
</script>
