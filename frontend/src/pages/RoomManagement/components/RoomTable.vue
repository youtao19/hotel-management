<template>
  <q-table
    :rows="rows"
    :columns="columns"
    row-key="room_number"
    :loading="loading"
    :pagination="{ rowsPerPage: 10 }"
    flat bordered
  >
    <template v-slot:body-cell-status="props">
      <q-td :props="props">
        <q-chip :color="roomStore.getRoomStatusColor(props.row)" text-color="white" dense size="sm">
          {{ roomStore.getRoomStatusText(props.row) }}
        </q-chip>
      </q-td>
    </template>

    <template v-slot:body-cell-type_code="props">
      <q-td :props="props">
        <q-chip color="blue" text-color="white" dense size="sm">
          {{ viewStore.getRoomTypeName(props.value) }}
        </q-chip>
      </q-td>
    </template>

    <template v-slot:body-cell-price="props">
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
          <q-btn flat dense color="orange" icon="build" @click="$emit('maintenance', props.row)">
            <q-tooltip>设为维修</q-tooltip>
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
import { useRoomStore } from 'src/stores/roomStore'
import { useViewStore } from 'src/stores/viewStore'

defineProps(['rows', 'loading'])
defineEmits(['edit', 'maintenance', 'delete'])

const roomStore = useRoomStore()
const viewStore = useViewStore()

const columns = [
  { name: 'room_number', label: '房间号', field: 'room_number', align: 'center', sortable: true },
  { name: 'type_code', label: '房型', field: 'type_code', align: 'center' },
  { name: 'status', label: '状态', field: 'status', align: 'center' },
  { name: 'price', label: '价格', field: 'price', align: 'right', sortable: true },
  { name: 'guest_name', label: '当前客人', field: 'guest_name', align: 'center' },
  { name: 'actions', label: '操作', field: 'actions', align: 'center' }
]
</script>
