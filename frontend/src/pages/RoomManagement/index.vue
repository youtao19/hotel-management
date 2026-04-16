<template>
  <q-page class="room-management q-pa-lg">
    <q-card flat bordered class="room-content-card">
      <div class="row items-center no-wrap bg-grey-1">
        <q-tabs
          v-model="activeTab"
          dense
          class="col text-grey-7"
          active-color="primary"
          indicator-color="primary"
          align="left"
          narrow-indicator
        >
          <q-tab name="rooms" label="客房列表" icon="hotel" />
          <q-tab name="room-types" label="房型定义" icon="category" />
        </q-tabs>
        
        <q-btn
          flat
          round
          dense
          color="primary"
          icon="refresh"
          class="q-mr-sm"
          @click="refreshAll"
          :loading="roomsLoading || typesLoading"
        >
          <q-tooltip>刷新数据</q-tooltip>
        </q-btn>
      </div>

      <q-separator />

      <q-tab-panels v-model="activeTab" animated class="bg-white">
        <q-tab-panel name="rooms" class="q-pa-none">
          <div class="q-pa-md border-bottom bg-grey-0">
            <div class="row items-center justify-between q-mb-md">
              <div class="text-h6 text-weight-medium">所有客房</div>
              <q-btn
                color="primary"
                icon="add"
                label="新增客房"
                unelevated
                @click="openRoomDialog()"
              />
            </div>
            <RoomFilterBar
              v-model:filters="filters"
              :room-type-options="roomTypeOptions"
              :status-options="statusOptions"
              @apply="() => {}"
            />
          </div>
          <RoomTable
            :rows="filteredRooms"
            :loading="roomsLoading"
            @edit="openRoomDialog"
            @maintenance="handleSetMaintenance"
            @delete="handleDeleteRoom"
            class="no-border-radius"
          />
        </q-tab-panel>

        <q-tab-panel name="room-types" class="q-pa-none">
          <div class="q-pa-md border-bottom bg-grey-0">
            <div class="row items-center justify-between">
              <div class="text-h6 text-weight-medium">房型配置</div>
              <q-btn
                color="secondary"
                icon="add"
                label="新增房型"
                unelevated
                @click="openRoomTypeDialog()"
              />
            </div>
          </div>
          <RoomTypeTable
            :rows="roomTypes"
            :loading="typesLoading"
            @edit="openRoomTypeDialog"
            @delete="handleDeleteRoomType"
            class="no-border-radius"
          />
        </q-tab-panel>
      </q-tab-panels>
    </q-card>

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
  $q.notify({ type: 'positive', message: '数据已刷新', icon: 'check_circle', timeout: 500 })
}

onMounted(refreshAll)
onActivated(refreshAll)
</script>

<style scoped>
.room-management {
  background-color: #f8f9fa;
  min-height: 100vh;
}

.room-content-card {
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05) !important;
}

.border-bottom {
  border-bottom: 1px solid rgba(0, 0, 0, 0.05);
}

.bg-grey-0 {
  background-color: #fafafa;
}

.no-border-radius {
  border-radius: 0 !important;
}

:deep(.q-table__container) {
  box-shadow: none !important;
  border: none !important;
}

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
