<template>
  <q-page class="dashboard">
    <div class="q-pa-md">
      <div class="row q-col-gutter-md">

      <!-- 房间状态概览 -->
      <div class="col-md-8 col-xs-12">
        <div class="row q-col-gutter-md">
          <div class="col-12">
            <q-card>
              <q-card-section class="bg-secondary text-white">
                <div class="text-h6">
                  <q-icon name="meeting_room" class="q-mr-xs" />
                  房间状态概览
                </div>
              </q-card-section>
              <q-card-section>
                <div class="row q-col-gutter-sm">
                  <div v-if="roomStore.loading" class="col-12 text-center q-pa-md">
                    <q-spinner color="primary" size="2em" />
                    <div class="q-mt-sm">加载房间数据中...</div>
                  </div>
                  <template v-else>
                    <div class="col-md-3 col-sm-6 col-xs-12">
                      <q-card class="text-center q-pa-sm bg-green-1 cursor-pointer" @click="goToRoomStatus('available')">
                        <div class="text-subtitle2">空闲</div>
                        <div class="text-h5">{{ roomStats.available }}</div>
                      </q-card>
                    </div>
                    <div class="col-md-3 col-sm-6 col-xs-12">
                      <q-card class="text-center q-pa-sm bg-red-1 cursor-pointer" @click="goToRoomStatus('occupied')">
                        <div class="text-subtitle2">已入住</div>
                        <div class="text-h5">{{ roomStats.occupied }}</div>
                      </q-card>
                    </div>
                    <div class="col-md-3 col-sm-6 col-xs-12">
                      <q-card class="text-center q-pa-sm bg-orange-1 cursor-pointer" @click="goToRoomStatus('cleaning')">
                        <div class="text-subtitle2">待清洁</div>
                        <div class="text-h5">{{ roomStats.cleaning }}</div>
                      </q-card>
                    </div>
                    <div class="col-md-3 col-sm-6 col-xs-12">
                      <q-card class="text-center q-pa-sm bg-grey-3 cursor-pointer" @click="goToRoomStatus('repair')">
                        <div class="text-subtitle2">维修中</div>
                        <div class="text-h5">{{ roomStats.maintenance }}</div>
                      </q-card>
                    </div>
                  </template>
                </div>
              </q-card-section>
              <q-card-section>
                <div class="text-subtitle2 q-mb-sm">房型分布</div>
                <q-linear-progress
                  v-for="(t, idx) in roomTypeDistribution"
                  :key="t.type"
                  v-if="!roomStore.loading"
                  size="25px"
                  :value="t.occupancy"
                  :color="colorPalette[idx % colorPalette.length]"
                  class="q-mb-sm"
                >
                  <div class="absolute-full flex flex-center">
                    <q-badge :color="colorPalette[idx % colorPalette.length]" text-color="white">
                      {{ t.label }}: {{ t.occupied }}/{{ t.total }}
                    </q-badge>
                  </div>
                </q-linear-progress>

                <div v-if="roomStore.loading" class="text-center q-pa-md">
                  <q-spinner color="primary" size="2em" />
                  <div class="q-mt-sm">加载房间数据中...</div>
                </div>

                <div v-if="!roomStore.loading && roomStore.rooms.length === 0" class="text-center q-pa-md text-grey">
                  未找到房间数据
                </div>
              </q-card-section>
            </q-card>
          </div>

          <!-- 最近入住客人 -->
          <div class="col-12">
            <q-card>
              <q-card-section class="bg-secondary text-white">
                <div class="text-h6">
                  <q-icon name="people" class="q-mr-xs" />
                  最近入住客人
                </div>
              </q-card-section>
              <q-table
                :rows="recentGuests"
                :columns="guestColumns"
                row-key="id"
                dense
                hide-pagination
                :pagination="{ rowsPerPage: 5 }"
              >
                <template v-slot:body-cell-status="props">
                  <q-td :props="props">
                    <q-chip
                      :color="props.value === '入住中' ? 'positive' : 'grey'"
                      text-color="white"
                      dense
                      size="sm"
                    >
                      {{ props.value }}
                    </q-chip>
                  </q-td>
                </template>

                <!-- 自定义入住日期列显示 -->
                <template v-slot:body-cell-checkIn="props">
                  <q-td :props="props">
                    <q-tooltip>{{ props.row.checkInFull }}</q-tooltip>
                    {{ props.value }}
                  </q-td>
                </template>

                <!-- 自定义预计离店列显示 -->
                <template v-slot:body-cell-checkOut="props">
                  <q-td :props="props">
                    <q-tooltip>{{ props.row.checkOutFull }}</q-tooltip>
                    {{ props.value }}
                  </q-td>
                </template>
              </q-table>
            </q-card>
          </div>
        </div>
      </div>

      <!-- 备忘录 -->
      <div class="col-md-4 col-xs-12">
        <q-card>
          <q-card-section class="bg-yellow text-black">
            <div class="text-h6">
              <q-icon name="edit_note" class="q-mr-xs" />
              备忘录
            </div>
          </q-card-section>

          <q-card-section class="q-pb-none">
            <div class="row items-center q-col-gutter-sm">
              <div class="col">
                <q-input
                  v-model="selectedDate"
                  type="date"
                  dense
                  stack-label
                  label="选择日期"
                />
              </div>
              <div class="col-auto">
                <q-btn dense flat icon="today" label="今天" @click="resetToToday" />
              </div>
            </div>
          </q-card-section>

          <q-list separator class="relative-position">
            <q-inner-loading :showing="memoLoading">
              <q-spinner color="primary" size="32px" />
            </q-inner-loading>

            <template v-if="!memoLoading && memoItems.length">
              <q-item v-for="task in memoItems" :key="task.id" clickable v-ripple>
                <q-item-section avatar>
                  <q-checkbox
                    :model-value="task.completed"
                    color="primary"
                    @update:model-value="val => toggleTaskCompletion(task, val)"
                  />
                </q-item-section>
                <q-item-section>
                  <q-item-label :class="{ 'text-strike': task.completed }">{{ task.title }}</q-item-label>
                  <q-item-label caption>{{ task.time }}</q-item-label>
                </q-item-section>
                <q-item-section side>
                  <q-select
                    :model-value="task.priority"
                    :options="priorityOptions"
                    dense
                    options-dense
                    emit-value
                    map-options
                    style="min-width: 80px"
                    @update:model-value="val => updateTaskPriority(task, val)"
                  >
                    <template v-slot:selected>
                      <q-badge :color="task.priority === 'high' ? 'negative' : (task.priority === 'medium' ? 'warning' : 'positive')">
                        {{ task.priority === 'high' ? '高' : (task.priority === 'medium' ? '中' : '低') }}
                      </q-badge>
                    </template>
                    <template v-slot:option="scope">
                      <q-item v-bind="scope.itemProps">
                        <q-item-section>
                          <q-badge :color="scope.opt.color">
                            {{ scope.opt.label }}
                          </q-badge>
                        </q-item-section>
                      </q-item>
                    </template>
                  </q-select>
                </q-item-section>
                <q-item-section side>
                  <q-btn round dense flat icon="delete" color="grey-7" @click.stop="deleteTask(task)" />
                </q-item-section>
              </q-item>
            </template>

            <q-item v-if="!memoLoading && memoItems.length === 0">
              <q-item-section>
                <q-item-label class="text-center text-grey">
                  当天暂无备忘录
                </q-item-label>
              </q-item-section>
            </q-item>

            <q-separator />

            <q-item>
              <q-item-section>
                <q-input
                  v-model="newTaskForm.title"
                  dense
                  placeholder="添加新备忘录..."
                  @keyup.enter="addTask"
                  :disable="memoLoading"
                >
                  <template v-slot:after>
                    <q-select
                      v-model="newTaskForm.priority"
                      :options="priorityOptions"
                      dense
                      options-dense
                      emit-value
                      map-options
                      style="min-width: 80px"
                      :disable="memoLoading"
                    >
                      <template v-slot:selected>
                        <q-badge :color="newTaskForm.priority === 'high' ? 'negative' : (newTaskForm.priority === 'medium' ? 'warning' : 'positive')">
                          {{ newTaskForm.priority === 'high' ? '高' : (newTaskForm.priority === 'medium' ? '中' : '低') }}
                        </q-badge>
                      </template>
                      <template v-slot:option="scope">
                        <q-item v-bind="scope.itemProps">
                          <q-item-section>
                            <q-badge :color="scope.opt.color">
                              {{ scope.opt.label }}
                            </q-badge>
                          </q-item-section>
                        </q-item>
                      </template>
                    </q-select>
                    <q-btn round dense flat icon="add" @click="addTask" :disable="memoLoading" />
                  </template>
                </q-input>
              </q-item-section>
            </q-item>
          </q-list>
        </q-card>
      </div>
      </div>
    </div>
  </q-page>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { date, useQuasar } from 'quasar'
import { useRouter } from 'vue-router'
import { useRoomStore } from '../stores/roomStore'
import { useOrderStore } from '../stores/orderStore'
import { useViewStore } from '../stores/viewStore'
import { memoApi } from '../api/index.js'

// 初始化路由和 stores
const router = useRouter()
const roomStore = useRoomStore()
const orderStore = useOrderStore()
const viewStore = useViewStore()
const $q = useQuasar()

const selectedDate = ref(date.formatDate(new Date(), 'YYYY-MM-DD'))
const memoLoading = ref(false)
const memoItems = ref([])


/**
 * 格式化日期时间辅助函数
 * @param {string} dateString - 日期时间字符串
 * @param {boolean} includeTime - 是否包含时间
 * @returns {string} 格式化后的日期时间
 */
function formatDateDisplay(dateString, includeTime = false) {
  return viewStore.formatDate(dateString, includeTime)
}

// 统计数据
const stats = ref({
  checkInsToday: 12,
  checkInsChange: 20,
  checkOutsToday: 8,
  checkOutsChange: -5,
  revenueToday: 15800,
  revenueChange: 12
})

// 使用 roomStore 获取房间占用数据
const occupancyStats = computed(() => {
  const occupied = roomStore.countByStatus.occupied
  const total = roomStore.totalRooms
  const rate = total > 0 ? Math.round((occupied / total) * 100) : 0

  return {
    occupiedRooms: occupied,
    totalRooms: total,
    occupancyRate: rate
  }
})

// 使用 roomStore 获取房间状态统计
const roomStats = computed(() => {
  // 获取房间状态计数
  const available = roomStore.countByStatus.available
  const occupied = roomStore.countByStatus.occupied
  const cleaning = roomStore.countByStatus.cleaning
  const maintenance = roomStore.countByStatus.repair || 0

  return {
    available,
    occupied,
    cleaning,
    maintenance
  }
})

// 动态房型分布（取总数最多的前三个）
const colorPalette = ['primary','secondary','accent','positive','info','warning','deep-orange','teal','indigo','purple','brown','cyan','grey']

const roomTypeDistribution = computed(() => {
  // 1) 先收集房型清单：以 roomTypes 顺序为主，再补充 rooms 中出现但未在 roomTypes 里的类型
  const typeList = []
  const seen = new Set()
  if (Array.isArray(roomStore.roomTypes)) {
    roomStore.roomTypes.forEach(rt => {
      if (rt?.type_code && !seen.has(rt.type_code)) {
        seen.add(rt.type_code)
        typeList.push(rt.type_code)
      }
    })
  }
  roomStore.rooms.forEach(room => {
    const type = room.type_code
    if (type && !seen.has(type)) {
      seen.add(type)
      typeList.push(type)
    }
  })

  // 2) 统计每个房型
  const statsMap = new Map(typeList.map(t => [t, { type: t, total: 0, occupied: 0 }]))
  roomStore.rooms.forEach(room => {
    const type = room.type_code
    if (!type || !statsMap.has(type)) return
    const item = statsMap.get(type)
    item.total += 1
    if (roomStore.getRoomDisplayStatus(room) === 'occupied') item.occupied += 1
  })

  // 3) 生成数组，保留原顺序，不再截断
  return typeList.map(type => {
    const item = statsMap.get(type)
    return {
      ...item,
      occupancy: item.total > 0 ? item.occupied / item.total : 0,
      label: viewStore.getRoomTypeName(type)
    }
  })
})

// 新备忘录输入
const newTaskForm = ref({
  title: '',
  priority: 'medium'
})

// 优先级选项
const priorityOptions = ref([
  { label: '高', value: 'high', color: 'negative' },
  { label: '中', value: 'medium', color: 'warning' },
  { label: '低', value: 'low', color: 'positive' }
])

function getErrorMessage(error, fallbackMessage) {
  return error?.response?.data?.message || fallbackMessage || '操作失败'
}

function transformMemo(memo) {
  if (!memo) return null
  const createdAt = memo.created_at || memo.createdAt || memo.updated_at || memo.updatedAt
  return {
    id: memo.memo_id ?? memo.id,
    title: memo.title,
    priority: memo.priority || 'medium',
    completed: memo.completed === true,
    memoDate: memo.memo_date || memo.memoDate,
    createdAt,
    updatedAt: memo.updated_at || memo.updatedAt,
    time: createdAt ? date.formatDate(createdAt, 'HH:mm') : ''
  }
}

async function fetchMemos(targetDate = selectedDate.value) {
  if (!targetDate) {
    memoItems.value = []
    return
  }
  memoLoading.value = true
  try {
    const response = await memoApi.getMemos(targetDate)
    const items = Array.isArray(response.data) ? response.data : []
    memoItems.value = items.map(transformMemo).filter(item => item !== null)
  } catch (error) {
    console.error('获取备忘录失败:', error)
    memoItems.value = []
    $q.notify({
      type: 'negative',
      message: getErrorMessage(error, '获取备忘录失败')
    })
  } finally {
    memoLoading.value = false
  }
}

function resetToToday() {
  const today = date.formatDate(new Date(), 'YYYY-MM-DD')
  if (selectedDate.value !== today) {
    selectedDate.value = today
  } else {
    fetchMemos(today)
  }
}

async function addTask() {
  const title = newTaskForm.value.title.trim()
  if (!title) {
    return
  }
  if (!selectedDate.value) {
    $q.notify({
      type: 'warning',
      message: '请选择日期后再添加备忘录'
    })
    return
  }

  try {
    const response = await memoApi.addMemo({
      memo_date: selectedDate.value,
      title,
      priority: newTaskForm.value.priority,
      completed: false
    })
    const newMemo = transformMemo(response.data)
    if (newMemo) {
      memoItems.value.push(newMemo)
    }
    newTaskForm.value.title = ''
    newTaskForm.value.priority = 'medium'
  } catch (error) {
    console.error('添加备忘录失败:', error)
    $q.notify({
      type: 'negative',
      message: getErrorMessage(error, '添加备忘录失败')
    })
  }
}

async function deleteTask(task) {
  if (!task || !task.id) return
  const originalItems = [...memoItems.value]
  memoItems.value = memoItems.value.filter(item => item.id !== task.id)
  try {
    await memoApi.deleteMemo(task.id)
  } catch (error) {
    console.error('删除备忘录失败:', error)
    memoItems.value = originalItems
    $q.notify({
      type: 'negative',
      message: getErrorMessage(error, '删除备忘录失败')
    })
  }
}

async function toggleTaskCompletion(task, completed) {
  if (!task || !task.id) return
  const originalCompleted = task.completed
  task.completed = completed
  try {
    const response = await memoApi.updateMemo(task.id, { completed })
    const updatedMemo = transformMemo(response.data)
    if (updatedMemo) {
      Object.assign(task, updatedMemo)
    }
  } catch (error) {
    console.error('更新备忘录状态失败:', error)
    task.completed = originalCompleted
    $q.notify({
      type: 'negative',
      message: getErrorMessage(error, '更新备忘录状态失败')
    })
  }
}

async function updateTaskPriority(task, priority) {
  if (!task || !task.id) return
  const originalPriority = task.priority
  task.priority = priority
  try {
    const response = await memoApi.updateMemo(task.id, { priority })
    const updatedMemo = transformMemo(response.data)
    if (updatedMemo) {
      Object.assign(task, updatedMemo)
    }
  } catch (error) {
    console.error('更新备忘录优先级失败:', error)
    task.priority = originalPriority
    $q.notify({
      type: 'negative',
      message: getErrorMessage(error, '更新备忘录优先级失败')
    })
  }
}

watch(selectedDate, (newDate, oldDate) => {
  if (newDate && newDate !== oldDate) {
    fetchMemos(newDate)
  }
})

// 最近入住客人表格列定义
const guestColumns = [
  { name: 'name', label: '客人姓名', field: 'name', align: 'left' },
  { name: 'room', label: '房间号', field: 'room', align: 'center' },
  { name: 'checkIn', label: '入住日期', field: 'checkIn', align: 'center' },
  { name: 'checkOut', label: '预计离店', field: 'checkOut', align: 'center' },
  { name: 'status', label: '状态', field: 'status', align: 'center' }
]

// 获取最近入住客人数据
const recentGuests = computed(() => {
  // 统一以英文状态筛选，展示时再转中文
  const STATUS = { IN: 'checked-in', OUT: 'checked-out' }
  return orderStore.orders
    .filter(order => order && order.status && [STATUS.IN, STATUS.OUT, '已入住', '已退房'].includes(order.status))
    .map(o => ({
      ...o,
      // 兼容中文状态
      status: o.status === '已入住' ? STATUS.IN : (o.status === '已退房' ? STATUS.OUT : o.status)
    }))
    .sort((a, b) => {
      // 按创建时间倒序（兼容 create_time/createTime）
      const dateA = new Date(a.createTime || a.create_time || 0);
      const dateB = new Date(b.createTime || b.create_time || 0);
      if (isNaN(dateA.getTime())) return 1;
      if (isNaN(dateB.getTime())) return -1;
      return dateB - dateA;
    })
    .slice(0, 5)
    .map(order => ({
      id: order.orderNumber,
      name: order.guestName,
      room: order.roomNumber,
      checkIn: viewStore.formatDate(order.checkInDate),
      checkOut: viewStore.formatDate(order.checkOutDate),
      status: viewStore.getOrderStatusText(order.status) === '已入住' ? '入住中' : '已退房',
      checkInFull: viewStore.formatDate(order.actualCheckInTime || order.checkInDate, true),
      checkOutFull: viewStore.formatDate(order.actualCheckOutTime || order.checkOutDate, true)
    }))
})

// 组件挂载时初始化
onMounted(async () => {
  // 这里可以加载实际数据或执行其他初始化操作
  console.log('仪表盘初始化，房间数据:', {
    总房间数: roomStore.rooms.length,
    房型分布: roomStore.rooms.reduce((acc, room) => {
      acc[room.type_code] = (acc[room.type_code] || 0) + 1;
      return acc;
    }, {}),
    房间状态: roomStore.countByStatus
  });

  // 获取“当前实时状态”而非“指定日期状态”（传日期会把已退房映射成清洁中，造成统计偏高）
  roomStore.fetchAllRooms();
  fetchMemos(selectedDate.value);
  // 同步加载房型映射，确保房型分布显示中文名称
  roomStore.fetchRoomTypes();
  try {
    await orderStore.fetchAllOrders();
  } catch (err) {
    console.error('仪表盘加载订单数据失败:', err);
    $q.notify({
      type: 'negative',
      message: getErrorMessage(err, '加载最近入住数据失败')
    });
  }
})

// 跳转到房间状态页面并带上相应的状态筛选参数
function goToRoomStatus(status) {
  console.log('跳转到房间状态页面，状态参数:', status)
  // 确保状态参数是有效的
  const validStatus = ['available', 'occupied', 'reserved', 'cleaning', 'repair'].includes(status)

  router.replace({
    path: '/room-status',
    query: validStatus ? { status: status } : {}
  })
}
</script>

<style scoped>
.dashboard-card {
  height: 100%;
}

.guest-card {
  margin-top: 0;
}
</style>
