<template>
  <q-page class="room-management">
    <div class="q-pa-md">
      <!-- 页面标题 -->
      <div class="row items-center q-mb-lg">
        <div class="col">
          <h1 class="text-h4 q-mb-none">房间管理</h1>
          <p class="text-subtitle1 text-grey-7 q-mb-none">管理酒店房间和房型信息</p>
        </div>
        <div class="col-auto">
          <q-btn
            color="primary"
            icon="refresh"
            label="刷新数据"
            @click="refreshData"
            :loading="loading"
            class="q-mr-sm"
          />
          <q-btn
            color="positive"
            icon="add"
            label="添加房间"
            @click="showAddRoomDialog = true"
          />
        </div>
      </div>

      <!-- 标签页 -->
      <q-tabs v-model="activeTab" dense class="text-grey" active-color="primary" indicator-color="primary" align="justify">
        <q-tab name="rooms" label="房间管理" icon="hotel" />
        <q-tab name="room-types" label="房型管理" icon="category" />
      </q-tabs>

      <q-separator />

      <q-tab-panels v-model="activeTab" animated>
        <!-- 房间管理标签页 -->
        <q-tab-panel name="rooms">
          <!-- 房间筛选器 -->
          <div class="row q-col-gutter-md q-mb-md">
            <div class="col-md-3 col-sm-6 col-xs-12">
              <q-select
                v-model="roomFilters.type"
                :options="roomTypeOptions"
                label="房型筛选"
                outlined
                dense
                emit-value
                map-options
                clearable
                clear-icon="close"
              />
            </div>
            <div class="col-md-3 col-sm-6 col-xs-12">
              <q-select
                v-model="roomFilters.status"
                :options="statusOptions"
                label="状态筛选"
                outlined
                dense
                emit-value
                map-options
                clearable
                clear-icon="close"
              />
            </div>
            <div class="col-md-3 col-sm-6 col-xs-12">
              <q-input
                v-model="roomFilters.search"
                label="搜索房间号"
                outlined
                dense
                clearable
                debounce="500"
              >
                <template v-slot:append>
                  <q-icon name="search" />
                </template>
              </q-input>
            </div>
            <div class="col-md-3 col-sm-6 col-xs-12">
              <q-btn
                color="primary"
                icon="filter_alt"
                label="应用筛选"
                @click="applyRoomFilters"
                class="full-width"
              />
            </div>
          </div>

          <!-- 房间表格 -->
          <q-table
            :rows="filteredRooms"
            :columns="roomColumns"
            row-key="room_id"
            :loading="loading"
            :pagination="roomPagination"
            flat
            bordered
          >
            <template v-slot:body-cell-status="props">
              <q-td :props="props">
                <q-chip
                  :color="getRoomStatusColor(props.row)"
                  text-color="white"
                  dense
                  size="sm"
                >
                  {{ getRoomStatusText(props.row) }}
                </q-chip>
              </q-td>
            </template>

            <template v-slot:body-cell-type_code="props">
              <q-td :props="props">
                <q-chip
                  color="blue"
                  text-color="white"
                  dense
                  size="sm"
                >
                  {{ getRoomTypeName(props.value) }}
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
                  <q-btn
                    flat
                    dense
                    color="primary"
                    icon="edit"
                    @click="editRoom(props.row)"
                  >
                    <q-tooltip>编辑房间</q-tooltip>
                  </q-btn>
                  <q-btn
                    flat
                    dense
                    color="orange"
                    icon="build"
                    @click="setRoomMaintenance(props.row)"
                  >
                    <q-tooltip>设为维修</q-tooltip>
                  </q-btn>
                  <q-btn
                    flat
                    dense
                    color="negative"
                    icon="delete"
                    @click="deleteRoom(props.row)"
                  >
                    <q-tooltip>删除房间</q-tooltip>
                  </q-btn>
                </q-btn-group>
              </q-td>
            </template>
          </q-table>
        </q-tab-panel>

        <!-- 房型管理标签页 -->
        <q-tab-panel name="room-types">
          <div class="row items-center q-mb-md">
            <div class="col">
              <div class="text-h6">房型列表</div>
            </div>
            <div class="col-auto">
              <q-btn
                color="positive"
                icon="add"
                label="添加房型"
                @click="showAddRoomTypeDialog = true"
              />
            </div>
          </div>

          <!-- 房型表格 -->
          <q-table
            :rows="roomTypes"
            :columns="roomTypeColumns"
            row-key="type_code"
            :loading="loading"
            flat
            bordered
          >
            <template v-slot:body-cell-base_price="props">
              <q-td :props="props" class="text-right">
                <span class="text-weight-medium">¥{{ props.value }}</span>
              </q-td>
            </template>

            <template v-slot:body-cell-actions="props">
              <q-td :props="props">
                <q-btn-group flat>
                  <q-btn
                    flat
                    dense
                    color="primary"
                    icon="edit"
                    @click.stop="editRoomType(props.row)"
                  >
                    <q-tooltip>编辑房型</q-tooltip>
                  </q-btn>
                  <q-btn
                    flat
                    dense
                    color="negative"
                    icon="delete"
                    @click.stop="deleteRoomType(props.row)"
                  >
                    <q-tooltip>删除房型</q-tooltip>
                  </q-btn>
                </q-btn-group>
              </q-td>
            </template>
          </q-table>
        </q-tab-panel>
      </q-tab-panels>
    </div>

    <!-- 添加/编辑房间对话框 -->
    <q-dialog v-model="showAddRoomDialog" persistent>
      <q-card style="min-width: 400px">
        <q-card-section class="bg-primary text-white">
          <div class="text-h6">{{ isEditingRoom ? '编辑房间' : '添加房间' }}</div>
        </q-card-section>

        <q-card-section>
          <q-form @submit="saveRoom" class="q-gutter-md">
            <q-input
              v-model="roomForm.room_number"
              label="房间号"
              outlined
              :rules="[val => !!val || '请输入房间号']"
              :readonly="isEditingRoom"
            />

            <q-select
              v-model="roomForm.type_code"
              :options="roomTypeOptions"
              label="房型"
              outlined
              emit-value
              map-options
              :rules="[val => !!val || '请选择房型']"
            />

            <q-select
              v-model="roomForm.status"
              :options="statusOptions"
              label="状态"
              outlined
              emit-value
              map-options
              :rules="[val => !!val || '请选择状态']"
            />

            <q-input
              v-model.number="roomForm.price"
              label="价格"
              outlined
              type="number"
              prefix="¥"
              :rules="[val => val > 0 || '价格必须大于0']"
            />

            <div class="row justify-end q-gutter-sm">
              <q-btn
                flat
                label="取消"
                @click="closeRoomDialog"
              />
              <q-btn
                type="submit"
                color="primary"
                label="保存"
                :loading="saving"
              />
            </div>
          </q-form>
        </q-card-section>
      </q-card>
    </q-dialog>

    <!-- 添加/编辑房型对话框 -->
    <q-dialog v-model="showAddRoomTypeDialog" persistent>
      <q-card style="min-width: 400px">
        <q-card-section class="bg-primary text-white">
          <div class="text-h6">{{ isEditingRoomType ? '编辑房型' : '添加房型' }}</div>
        </q-card-section>

        <q-card-section>
          <q-form @submit="saveRoomType" class="q-gutter-md">
            <q-input
              v-model="roomTypeForm.type_code"
              label="房型代码"
              outlined
              :rules="[val => !!val || '请输入房型代码']"
              :readonly="isEditingRoomType"
              hint="如: standard, deluxe, suite"
            />

            <q-input
              v-model="roomTypeForm.type_name"
              label="房型名称"
              outlined
              :rules="[val => !!val || '请输入房型名称']"
            />

            <q-input
              v-model.number="roomTypeForm.base_price"
              label="基础价格"
              outlined
              type="number"
              prefix="¥"
              :rules="[val => val > 0 || '价格必须大于0']"
            />

            <q-input
              v-model="roomTypeForm.description"
              label="描述"
              outlined
              type="textarea"
              autogrow
            />

            <div class="row justify-end q-gutter-sm">
              <q-btn
                flat
                label="取消"
                @click="closeRoomTypeDialog"
              />
              <q-btn
                type="submit"
                color="primary"
                label="保存"
                :loading="saving"
              />
            </div>
          </q-form>
        </q-card-section>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup>
import { ref, computed, onMounted, onActivated } from 'vue'
import { useQuasar } from 'quasar'
import { useRoomStore } from '../stores/roomStore'
import { useViewStore } from '../stores/viewStore'
import { roomApi } from '../api/index.js'

const $q = useQuasar()
const roomStore = useRoomStore()
const viewStore = useViewStore()

// 基础数据
const loading = ref(false)
const saving = ref(false)
const activeTab = ref('rooms')

// 房间数据
const rooms = ref([])
const roomTypes = ref([])

// 对话框状态
const showAddRoomDialog = ref(false)
const showAddRoomTypeDialog = ref(false)
const isEditingRoom = ref(false)
const isEditingRoomType = ref(false)

// 筛选器
const roomFilters = ref({
  type: null,
  status: null,
  search: ''
})

// 表单数据
const roomForm = ref({
  room_number: '',
  type_code: '',
  status: 'available',
  price: 0
})

const roomTypeForm = ref({
  type_code: '',
  type_name: '',
  base_price: 0,
  description: ''
})

// 分页
const roomPagination = ref({
  rowsPerPage: 10
})

// 房间表格列定义
const roomColumns = [
  { name: 'room_number', label: '房间号', field: 'room_number', align: 'center', sortable: true },
  { name: 'type_code', label: '房型', field: 'type_code', align: 'center' },
  { name: 'status', label: '状态', field: 'status', align: 'center' },
  { name: 'price', label: '价格', field: 'price', align: 'right', sortable: true },
  { name: 'guest_name', label: '当前客人', field: 'guest_name', align: 'center' },
  { name: 'actions', label: '操作', field: 'actions', align: 'center' }
]

// 房型表格列定义
const roomTypeColumns = [
  { name: 'type_code', label: '房型代码', field: 'type_code', align: 'left', sortable: true },
  { name: 'type_name', label: '房型名称', field: 'type_name', align: 'left', sortable: true },
  { name: 'base_price', label: '基础价格', field: 'base_price', align: 'right', sortable: true },
  { name: 'description', label: '描述', field: 'description', align: 'left' },
  { name: 'actions', label: '操作', field: 'actions', align: 'center' }
]

// 选项数据
const roomTypeOptions = computed(() => {
  return roomTypes.value.map(type => ({
    label: type.type_name,
    value: type.type_code
  }))
})

const statusOptions = [
  { label: '可用', value: 'available' },
  { label: '已入住', value: 'occupied' },
  { label: '清洁中', value: 'cleaning' },
  { label: '维修中', value: 'repair' }
]

// 筛选后的房间
const filteredRooms = computed(() => {
  let filtered = rooms.value

  if (roomFilters.value.type) {
    filtered = filtered.filter(room => room.type_code === roomFilters.value.type)
  }

  if (roomFilters.value.status) {
    filtered = filtered.filter(room => room.status === roomFilters.value.status)
  }

  if (roomFilters.value.search) {
    filtered = filtered.filter(room =>
      room.room_number.toLowerCase().includes(roomFilters.value.search.toLowerCase())
    )
  }

  return filtered
})

// 工具函数
function getRoomStatusColor(room) {
  return roomStore.getRoomStatusColor(room)
}

function getRoomStatusText(room) {
  return roomStore.getRoomStatusText(room)
}

function getRoomTypeName(typeCode) {
  return viewStore.getRoomTypeName(typeCode)
}

// 数据加载
async function loadRooms() {
  try {
    loading.value = true
    const response = await roomApi.getAllRooms()
    rooms.value = response.data || []
  } catch (error) {
    console.error('获取房间列表失败:', error)
    $q.notify({
      type: 'negative',
      message: '获取房间列表失败'
    })
  } finally {
    loading.value = false
  }
}

async function loadRoomTypes() {
  try {
    const response = await roomApi.getRoomTypes()
    roomTypes.value = response.data || []
  } catch (error) {
    console.error('获取房型列表失败:', error)
    $q.notify({
      type: 'negative',
      message: '获取房型列表失败'
    })
  }
}

// 房间操作
function editRoom(room) {
  roomForm.value = { ...room }
  isEditingRoom.value = true
  showAddRoomDialog.value = true
}

async function saveRoom() {
  try {
    saving.value = true

    if (isEditingRoom.value) {
      // 更新房间
      await roomApi.updateRoom(roomForm.value.room_id, roomForm.value)
      $q.notify({
        type: 'positive',
        message: '房间更新成功'
      })
    } else {
      // 添加房间
      await roomApi.addRoom(roomForm.value)
      $q.notify({
        type: 'positive',
        message: '房间添加成功'
      })
    }

    closeRoomDialog()
    await loadRooms()
    await roomStore.refreshData()
  } catch (error) {
    console.error('保存房间失败:', error)
    $q.notify({
      type: 'negative',
      message: error.response?.data?.message || '保存房间失败'
    })
  } finally {
    saving.value = false
  }
}

function closeRoomDialog() {
  showAddRoomDialog.value = false
  isEditingRoom.value = false
  roomForm.value = {
    room_number: '',
    type_code: '',
    status: 'available',
    price: 0
  }
}

async function setRoomMaintenance(room) {
  try {
    await roomStore.updateRoomStatus(room.room_id, 'repair')
    $q.notify({
      type: 'positive',
      message: `房间${room.room_number}已设为维修状态`
    })
    await loadRooms()
  } catch (error) {
    console.error('设置维修状态失败:', error)
    $q.notify({
      type: 'negative',
      message: '设置维修状态失败'
    })
  }
}

function deleteRoom(room) {
  $q.dialog({
    title: '删除房间确认',
    message: `您即将删除房间 "${room.room_number}"`,
    html: true,
    cancel: {
      label: '取消',
      color: 'grey-7',
      flat: true
    },
    ok: {
      label: '确认删除',
      color: 'negative',
      icon: 'delete'
    },
    persistent: true,
    class: 'custom-delete-dialog',
    style: 'border-radius: 12px;',
    cardStyle: 'border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,0.2);'
  }).onOk(async () => {
    try {
      await roomApi.deleteRoom(room.room_id)
      $q.notify({
        type: 'positive',
        message: '房间删除成功'
      })
      await loadRooms()
      await roomStore.refreshData()
    } catch (error) {
      console.error('删除房间失败:', error)
      $q.notify({
        type: 'negative',
        message: error.response?.data?.message || '删除房间失败'
      })
    }
  })
}

// 房型操作
function editRoomType(roomType) {
  console.log('点击编辑房型按钮:', roomType)
  roomTypeForm.value = { ...roomType }
  isEditingRoomType.value = true
  showAddRoomTypeDialog.value = true
}

async function saveRoomType() {
  try {
    saving.value = true

    if (isEditingRoomType.value) {
      // 更新房型
      await roomApi.updateRoomType(roomTypeForm.value.type_code, roomTypeForm.value)
      $q.notify({
        type: 'positive',
        message: '房型更新成功'
      })
    } else {
      // 添加房型
      await roomApi.addRoomType(roomTypeForm.value)
      $q.notify({
        type: 'positive',
        message: '房型添加成功'
      })
    }

    closeRoomTypeDialog()
    await loadRoomTypes()
    // 刷新roomStore中的房型数据，确保其他页面能获取到最新的房型
    await roomStore.fetchRoomTypes()
  } catch (error) {
    console.error('保存房型失败:', error)
    $q.notify({
      type: 'negative',
      message: error.response?.data?.message || '保存房型失败'
    })
  } finally {
    saving.value = false
  }
}

function closeRoomTypeDialog() {
  showAddRoomTypeDialog.value = false
  isEditingRoomType.value = false
  roomTypeForm.value = {
    type_code: '',
    type_name: '',
    base_price: 0,
    description: ''
  }
}

function deleteRoomType(roomType) {
  console.log('点击删除房型按钮:', roomType)

  if (!roomType || !roomType.type_code) {
    console.error('房型数据无效:', roomType)
    $q.notify({
      type: 'negative',
      message: '房型数据无效，无法删除'
    })
    return
  }

  $q.dialog({
    title: '删除房型确认',
    message: `您即将删除房型 "${roomType.type_name || roomType.type_code}"`,
    html: true,
    cancel: {
      label: '取消',
      color: 'grey-7',
      flat: true
    },
    ok: {
      label: '确认删除',
      color: 'negative',
      icon: 'delete'
    },
    persistent: true,
    class: 'custom-delete-dialog',
    style: 'border-radius: 12px;',
    cardStyle: 'border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,0.2);'
  }).onOk(async () => {
    console.log('用户确认删除房型:', roomType.type_code)
    try {
      loading.value = true
      console.log('开始调用API删除房型:', roomType.type_code)

      await roomApi.deleteRoomType(roomType.type_code)

      console.log('房型删除API调用成功')
      $q.notify({
        type: 'positive',
        message: '房型删除成功'
      })

      console.log('开始刷新房型列表')
      await loadRoomTypes()
      // 刷新roomStore中的房型数据
      await roomStore.fetchRoomTypes()
      console.log('房型列表刷新完成')

    } catch (error) {
      console.error('删除房型失败:', error)
      $q.notify({
        type: 'negative',
        message: error.response?.data?.message || '删除房型失败'
      })
    } finally {
      loading.value = false
    }
  }).onCancel(() => {
    console.log('用户取消删除操作')
  })
}

// 筛选操作
function applyRoomFilters() {
  // 筛选逻辑在计算属性中处理
  $q.notify({
    type: 'positive',
    message: '筛选条件已应用',
    timeout: 1000
  })
}

function resetRoomFilters() {
  roomFilters.value = {
    type: null,
    status: null,
    search: ''
  }
}

// 刷新数据
async function refreshData() {
  await Promise.all([
    loadRooms(),
    loadRoomTypes()
  ])
}

// 组件挂载时初始化
onMounted(refreshData)

// 组件被缓存后再次激活时也刷新数据
onActivated(refreshData)
</script>

<style scoped>
.room-management {
  max-width: 100%;
  background-color: #f5f5f5;
  min-height: 100vh;
}

.q-card {
  border-radius: 8px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
}

.text-h4 {
  color: #1976d2;
  font-weight: 600;
}

.stats-overview {
  display: flex;
  align-items: center;
  gap: 8px;
}

@media (max-width: 768px) {
  .stats-overview {
    flex-direction: column;
    align-items: flex-start;
  }
}

/* 自定义删除确认弹窗样式 */
:deep(.custom-delete-dialog) {
  border-radius: 16px !important;
}

:deep(.custom-delete-dialog .q-dialog__inner) {
  padding: 0;
}

:deep(.custom-delete-dialog .q-card) {
  border-radius: 16px !important;
  overflow: hidden;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.25) !important;
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  min-width: 400px;
}

:deep(.custom-delete-dialog .q-card__section--vert) {
  background: linear-gradient(135deg, #fff 0%, #f8f9fa 100%);
}

:deep(.custom-delete-dialog .q-dialog__title) {
  color: #e53e3e;
  font-weight: 600;
  font-size: 1.3rem;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 24px 24px 16px 24px;
}

:deep(.custom-delete-dialog .q-dialog__title:before) {
  content: '⚠️';
  font-size: 1.4rem;
}

:deep(.custom-delete-dialog .q-dialog__message) {
  color: #2d3748;
  font-size: 1rem;
  line-height: 1.6;
  margin: 0;
  padding: 0 24px 16px 24px;
  background: rgba(254, 243, 243, 0.8);
  border-radius: 8px;
  border-left: 4px solid #e53e3e;
  margin-left: 24px;
  margin-right: 24px;
}

:deep(.custom-delete-dialog .q-dialog__message:before) {
  content: '⚠️ 警告：此操作不可撤销\A删除后将无法恢复房型数据，请确认您的操作。\A\A';
  white-space: pre-line;
  font-weight: 600;
  color: #e53e3e;
  display: block;
  margin-bottom: 8px;
  font-size: 0.9rem;
}

:deep(.custom-delete-dialog .q-card__actions) {
  background: rgba(248, 249, 250, 0.8);
  backdrop-filter: blur(5px);
  padding: 20px 24px;
  gap: 12px;
  border-top: 1px solid rgba(0, 0, 0, 0.05);
}

:deep(.custom-delete-dialog .q-btn) {
  padding: 12px 24px;
  border-radius: 8px;
  font-weight: 600;
  transition: all 0.3s ease;
  min-width: 100px;
}

:deep(.custom-delete-dialog .q-btn--flat) {
  background: rgba(113, 128, 150, 0.1);
  color: #4a5568;
}

:deep(.custom-delete-dialog .q-btn--flat:hover) {
  background: rgba(113, 128, 150, 0.2);
  transform: translateY(-1px);
}

:deep(.custom-delete-dialog .q-btn--standard) {
  box-shadow: 0 4px 12px rgba(229, 62, 62, 0.3);
  background: #e53e3e;
}

:deep(.custom-delete-dialog .q-btn--standard:hover) {
  transform: translateY(-2px);
  box-shadow: 0 8px 20px rgba(229, 62, 62, 0.4);
  background: #c53030;
}

/* 弹窗动画效果 */
:deep(.custom-delete-dialog .q-dialog) {
  animation: dialogFadeIn 0.3s ease-out;
}

@keyframes dialogFadeIn {
  from {
    opacity: 0;
    transform: scale(0.9) translateY(-20px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}
</style>
