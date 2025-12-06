<template>
  <q-page class="room-management">
    <div class="q-pa-md">
      <div class="row items-center q-mb-lg">
        <div class="col">
          <h1 class="text-h4 q-mb-none">房间管理</h1>
          <p class="text-subtitle1 text-grey-7 q-mb-none">管理酒店房间和房型信息</p>
        </div>
        <div class="col-auto">
          <q-btn
            color="primary"
            icon="refresh"
            label="刷新"
            @click="refreshAll"
            :loading="roomsLoading || typesLoading"
            class="q-mr-sm"
          />
          <q-btn
            color="positive"
            icon="add"
            label="添加房间"
            @click="openRoomDialog()"
          />
        </div>
      </div>

      <q-tabs v-model="activeTab" dense class="text-grey" active-color="primary" indicator-color="primary" align="justify">
        <q-tab name="rooms" label="房间管理" icon="hotel" />
        <q-tab name="room-types" label="房型管理" icon="category" />
      </q-tabs>
      <q-separator />

      <q-tab-panels v-model="activeTab" animated>
        <q-tab-panel name="rooms">
          <RoomFilterBar
            v-model:filters="filters"
            :room-type-options="roomTypeOptions"
            :status-options="statusOptions"
            @apply="() => {}"
          />
          <RoomTable
            :rows="filteredRooms"
            :loading="roomsLoading"
            @edit="openRoomDialog"
            @maintenance="handleSetMaintenance"
            @delete="handleDeleteRoom"
          />
        </q-tab-panel>

        <q-tab-panel name="room-types">
          <div class="row items-center q-mb-md">
            <div class="col text-h6">房型列表</div>
            <div class="col-auto">
              <q-btn color="positive" icon="add" label="添加房型" @click="openRoomTypeDialog()" />
            </div>
          </div>
          <RoomTypeTable
            :rows="roomTypes"
            :loading="typesLoading"
            @edit="openRoomTypeDialog"
            @delete="handleDeleteRoomType"
          />
        </q-tab-panel>
      </q-tab-panels>
    </div>

    <RoomDialog
      v-model="showRoomDialog"
      :room-data="currentRoom"
      :type-options="roomTypeOptions"
      :loading="roomsLoading"
      @save="handleSaveRoom"
    />

    <RoomTypeDialog
      v-model="showRoomTypeDialog"
      :type-data="currentRoomType"
      :loading="typesLoading"
      @save="handleSaveRoomType"
    />
  </q-page>
</template>

<script setup>
import { ref, onMounted, computed, onActivated } from 'vue'
import { useQuasar } from 'quasar'

// Components
import RoomFilterBar from './components/RoomFilterBar.vue'
import RoomTable from './components/RoomTable.vue'
import RoomTypeTable from './components/RoomTypeTable.vue'
import RoomDialog from './components/RoomDialog.vue'
import RoomTypeDialog from './components/RoomTypeDialog.vue'

// Composables
import { useRoomData } from './composables/useRoomData'
import { useRoomTypeData } from './composables/useRoomTypeData'
import { useRoomFilters } from './composables/useRoomFilters'

const activeTab = ref('rooms')
const $q = useQuasar()

// 1. 房间数据逻辑
const {
  rooms,
  loading: roomsLoading,
  showRoomDialog,
  currentRoom,
  fetchRooms,
  openRoomDialog,
  handleSaveRoom,
  handleSetMaintenance,
  handleDeleteRoom
} = useRoomData()

// 2. 房型数据逻辑
const {
  roomTypes,
  loading: typesLoading,
  showRoomTypeDialog,
  currentRoomType,
  fetchRoomTypes,
  openRoomTypeDialog,
  handleSaveRoomType,
  handleDeleteRoomType
} = useRoomTypeData()

// 3. 筛选逻辑
const {
  filters,
  statusOptions,
  filteredRooms
} = useRoomFilters(rooms)

// 衍生数据：房型选项供下拉框使用
const roomTypeOptions = computed(() => {
  return roomTypes.value.map(t => ({ label: t.type_name, value: t.type_code }))
})

// 刷新所有数据
const refreshAll = async () => {
  await Promise.all([fetchRooms(), fetchRoomTypes()])
  $q.notify({ type: 'positive', message: '数据已刷新', timeout: 500 })
}

onMounted(refreshAll)
onActivated(refreshAll)
</script>

<style scoped>
.room-management { background-color: #f5f5f5; min-height: 100vh; }

/* 复用原文件中的删除弹窗样式，保留一致性 */
:deep(.custom-delete-dialog) { border-radius: 16px !important; }
:deep(.custom-delete-dialog .q-dialog__inner) { padding: 0; }
:deep(.custom-delete-dialog .q-card) {
  border-radius: 16px !important; overflow: hidden;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.25) !important;
  min-width: 400px;
}
:deep(.custom-delete-dialog .q-card__section--vert) { background: linear-gradient(135deg, #fff 0%, #f8f9fa 100%); }
:deep(.custom-delete-dialog .q-dialog__title) { color: #e53e3e; font-weight: 600; font-size: 1.3rem; display: flex; align-items: center; gap: 8px; padding: 24px; }
:deep(.custom-delete-dialog .q-dialog__title:before) { content: '⚠️'; font-size: 1.4rem; }
:deep(.custom-delete-dialog .q-dialog__message) {
  color: #2d3748; font-size: 1rem; line-height: 1.6; margin: 0 24px 16px 24px; padding: 16px;
  background: rgba(254, 243, 243, 0.8); border-radius: 8px; border-left: 4px solid #e53e3e;
}
:deep(.custom-delete-dialog .q-dialog__message:before) {
  content: '⚠️ 警告：此操作不可撤销\A请确认您的操作。\A\A';
  white-space: pre-line; font-weight: 600; color: #e53e3e; display: block; margin-bottom: 8px;
}
:deep(.custom-delete-dialog .q-card__actions) {
  background: rgba(248, 249, 250, 0.8); backdrop-filter: blur(5px); padding: 20px 24px; gap: 12px; border-top: 1px solid rgba(0, 0, 0, 0.05);
}
</style>
