<template>
  <q-table
    :rows="rows"
    :columns="columns"
    row-key="room_number"
    :loading="loading"
    :pagination="{ rowsPerPage: 10 }"
    flat
    class="room-table"
  >
    <template v-slot:body-cell-room_number="props">
      <q-td :props="props">
        <div class="text-weight-bold text-blue-9 text-body1">
          {{ props.value }}
        </div>
      </q-td>
    </template>

    <template v-slot:body-cell-status="props">
      <q-td :props="props">
        <q-chip
          :color="roomStore.getRoomStatusColor(props.row)"
          text-color="white"
          dense
          square
          class="text-weight-medium"
          style="min-width: 70px; justify-content: center"
        >
          {{ roomStore.getRoomStatusText(props.row) }}
        </q-chip>
      </q-td>
    </template>

    <template v-slot:body-cell-type_code="props">
      <q-td :props="props">
        <q-badge outline color="blue-7" class="q-px-sm q-py-xs">
          {{ viewStore.getRoomTypeName(props.value) }}
        </q-badge>
      </q-td>
    </template>

    <template v-slot:body-cell-price="props">
      <q-td :props="props" class="text-right">
        <span class="text-weight-bold text-orange-9">¥{{ props.value }}</span>
      </q-td>
    </template>

    <template v-slot:body-cell-actions="props">
      <q-td :props="props">
        <div class="row q-gutter-xs justify-center">
          <q-btn flat round dense color="primary" icon="edit" @click="$emit('edit', props.row)">
            <q-tooltip>编辑基本信息</q-tooltip>
          </q-btn>
          <q-btn flat round dense color="orange-8" icon="construction" @click="$emit('maintenance', props.row)">
            <q-tooltip>标记为维修状态</q-tooltip>
          </q-btn>
          <q-btn flat round dense color="negative" icon="delete_outline" @click="$emit('delete', props.row)">
            <q-tooltip>删除该房间</q-tooltip>
          </q-btn>
        </div>
      </q-td>
    </template>
  </q-table>
</template>

<script setup>
import { useRoomStore } from 'src/stores/roomStore'
import { useViewStore } from 'src/stores/viewStore'

defineProps(['rows', 'loading'])
defineEmits(['edit', 'maintenance', 'delete'])

const roomStore = useRoomStore()
const viewStore = useViewStore()

const columns = [
  { name: 'room_number', label: '房间号', field: 'room_number', align: 'left', sortable: true },
  { name: 'type_code', label: '房型', field: 'type_code', align: 'center' },
  { name: 'status', label: '状态', field: 'status', align: 'center' },
  { name: 'price', label: '基础单价', field: 'price', align: 'right', sortable: true },
  { name: 'guest_name', label: '当前客人', field: 'guest_name', align: 'center' },
  { name: 'actions', label: '操作', field: 'actions', align: 'center' }
]
</script>

<style scoped>
.room-table :deep(.q-table__th) {
  font-weight: 600;
  text-transform: uppercase;
  font-size: 0.75rem;
  letter-spacing: 0.05em;
  color: #616161;
  background-color: #fafafa;
}

.room-table :deep(.q-tr:hover) {
  background-color: #f0f7ff !important;
}
</style>
