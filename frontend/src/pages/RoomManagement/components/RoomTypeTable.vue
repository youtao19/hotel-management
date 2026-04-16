<template>
  <q-table
    :rows="rows"
    :columns="columns"
    row-key="type_code"
    :loading="loading"
    :pagination="{ rowsPerPage: 10 }"
    flat
    class="room-type-table"
  >
    <template v-slot:body-cell-type_code="props">
      <q-td :props="props">
        <q-badge color="grey-8" class="q-px-sm q-py-xs">
          {{ props.value }}
        </q-badge>
      </q-td>
    </template>

    <template v-slot:body-cell-type_name="props">
      <q-td :props="props">
        <div class="text-weight-bold text-blue-9">
          {{ props.value }}
        </div>
      </q-td>
    </template>

    <template v-slot:body-cell-base_price="props">
      <q-td :props="props" class="text-right">
        <span class="text-weight-bold text-orange-9">¥{{ props.value }}</span>
      </q-td>
    </template>

    <template v-slot:body-cell-actions="props">
      <q-td :props="props">
        <div class="row q-gutter-xs justify-center">
          <q-btn flat round dense color="primary" icon="edit" @click="$emit('edit', props.row)">
            <q-tooltip>编辑房型信息</q-tooltip>
          </q-btn>
          <q-btn flat round dense color="negative" icon="delete_outline" @click="$emit('delete', props.row)">
            <q-tooltip>删除该房型</q-tooltip>
          </q-btn>
        </div>
      </q-td>
    </template>
  </q-table>
</template>

<script setup>
defineProps(['rows', 'loading'])
defineEmits(['edit', 'delete'])

const columns = [
  { name: 'type_code', label: '房型代码', field: 'type_code', align: 'left', sortable: true },
  { name: 'type_name', label: '房型名称', field: 'type_name', align: 'left', sortable: true },
  { name: 'base_price', label: '基础价格', field: 'base_price', align: 'right', sortable: true },
  { name: 'description', label: '描述', field: 'description', align: 'left' },
  { name: 'actions', label: '操作', field: 'actions', align: 'center' }
]
</script>

<style scoped>
.room-type-table :deep(.q-table__th) {
  font-weight: 600;
  text-transform: uppercase;
  font-size: 0.75rem;
  letter-spacing: 0.05em;
  color: #616161;
  background-color: #fafafa;
}

.room-type-table :deep(.q-tr:hover) {
  background-color: #f5f5f5 !important;
}
</style>
