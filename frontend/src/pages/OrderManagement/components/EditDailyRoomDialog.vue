<template>
  <q-dialog :model-value="modelValue" @update:model-value="val => emit('update:modelValue', val)">
    <q-card style="min-width: 350px">
      <q-card-section>
        <div class="text-h6">更换房间 - {{ formatDate(stayDate) }}</div>
      </q-card-section>

      <q-card-section class="q-pt-none">
        <div class="text-subtitle2 q-mb-sm">当前房间: {{ currentRoomNumber }}</div>

        <q-select
          v-model="selectedRoom"
          :options="roomOptions"
          label="选择新房间"
          filled
          emit-value
          map-options
          :loading="loadingRooms"
        >
          <template v-slot:option="scope">
            <q-item v-bind="scope.itemProps">
              <q-item-section>
                <q-item-label>{{ scope.opt.label }}</q-item-label>
                <q-item-label caption>{{ scope.opt.type }} - ¥{{ scope.opt.price }}</q-item-label>
              </q-item-section>
            </q-item>
          </template>
        </q-select>
      </q-card-section>

      <q-card-actions align="right" class="text-primary">
        <q-btn flat label="取消" v-close-popup />
        <q-btn flat label="确定" @click="confirmChange" :loading="saving" :disable="!selectedRoom" />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup>
import { ref, watch, onMounted } from 'vue'
import { useQuasar, date } from 'quasar'
import { roomApi } from 'src/api'
import { useOrderStore } from 'src/stores/orderStore'
import { useViewStore } from 'src/stores/viewStore'

const props = defineProps({
  modelValue: Boolean,
  orderNumber: String,
  stayDate: String,
  currentRoomNumber: String,
  currentRoomType: String
})

const emit = defineEmits(['update:modelValue', 'success'])

const $q = useQuasar()
const orderStore = useOrderStore()
const viewStore = useViewStore()

const selectedRoom = ref(null)
const roomOptions = ref([])
const loadingRooms = ref(false)
const saving = ref(false)

function formatDate(dateStr) {
  return date.formatDate(dateStr, 'YYYY-MM-DD')
}

/**
 * Fetch available rooms for the given stay date
 */
async function fetchAvailableRooms() {
  if (!props.stayDate) return

  loadingRooms.value = true
  try {
    // Fetch all rooms
    const response = await roomApi.getAllRooms()
    const allRooms = response.data || response

    // Filter rooms that are available on this date
    // Note: Ideally backend should provide an API for available rooms on a specific date
    // For now, we might need to rely on what we have.
    // roomApi.getAvailableRooms takes params.

    const availResponse = await roomApi.getAvailableRooms(`startDate=${props.stayDate}&endDate=${props.stayDate}`)
    const availableRooms = availResponse.data || availResponse

    // Map to options
    roomOptions.value = availableRooms.map(room => ({
      label: `${room.room_number} (${viewStore.getRoomTypeName(room.type_code)})`,
      value: room.room_number,
      type: viewStore.getRoomTypeName(room.type_code),
      price: room.price
    }))

  } catch (error) {
    console.error('Failed to fetch available rooms:', error)
    $q.notify({
      type: 'negative',
      message: '获取可用房间失败'
    })
  } finally {
    loadingRooms.value = false
  }
}

watch(() => props.modelValue, (val) => {
  if (val) {
    selectedRoom.value = null
    fetchAvailableRooms()
  }
})

async function confirmChange() {
  if (!selectedRoom.value) return

  saving.value = true
  try {
    await orderStore.updateOrderDayRoom(props.orderNumber, props.stayDate, selectedRoom.value)

    $q.notify({
      type: 'positive',
      message: '房间更换成功'
    })

    emit('success')
    emit('update:modelValue', false)
  } catch (error) {
    // Error is handled in store, but we can show extra info if needed
    console.error('Failed to change room:', error)
    $q.notify({
      type: 'negative',
      message: '房间更换失败'
    })
  } finally {
    saving.value = false
  }
}
</script>
