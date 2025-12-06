<template>
  <q-table
    :rows="rows"
    :columns="columns"
    row-key="type_code"
    :loading="loading"
    flat bordered
  >
    <template v-slot:body-cell-base_price="props">
      <q-td :props="props" class="text-right">
        <span class="text-weight-medium">¥{{ props.value }}</span>
      </q-td>
    </template>

    <template v-slot:body-cell-actions="props">
      <q-td :props="props">
        <q-btn-group flat>
          <q-btn flat dense color="primary" icon="edit" @click="$emit('edit', props.row)">
            <q-tooltip>编辑</q-tooltip>
          </q-btn>
          <q-btn flat dense color="negative" icon="delete" @click="$emit('delete', props.row)">
            <q-tooltip>删除</q-tooltip>
          </q-btn>
        </q-btn-group>
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
