<template>
  <q-page class="dashboard">
    <div class="q-pa-md">
      <div class="row q-col-gutter-md">
        <!-- 页面标题 -->
        <div class="col-12">
        <q-card class="bg-primary text-white">
          <q-card-section>
            <div class="text-h4">酒店管理系统仪表盘</div>
            <div class="text-subtitle2">{{ currentDate }}</div>
          </q-card-section>
        </q-card>
      </div>

      <!-- 统计卡片区域 -->
      <div class="col-md-3 col-sm-6 col-xs-12">
        <q-card class="dashboard-card">
          <q-card-section class="bg-positive text-white">
            <div class="text-h6">
              <q-icon name="login" size="sm" class="q-mr-xs" />
              今日入住
            </div>
          </q-card-section>
          <q-card-section class="text-center">
            <div class="text-h3">{{ stats.checkInsToday }}</div>
            <div class="text-caption">较昨日 {{ stats.checkInsChange > 0 ? '+' : '' }}{{ stats.checkInsChange }}%</div>
          </q-card-section>
          <q-card-actions align="right">
            <q-btn flat color="positive" label="查看详情" to="/Check-in" />
          </q-card-actions>
        </q-card>
      </div>

      <div class="col-md-3 col-sm-6 col-xs-12">
        <q-card class="dashboard-card">
          <q-card-section class="bg-negative text-white">
            <div class="text-h6">今日退房</div>
            <q-icon name="logout" size="sm" class="q-mr-xs" />
          </q-card-section>
          <q-card-section class="text-center">
            <div class="text-h3">{{ stats.checkOutsToday }}</div>
            <div class="text-caption">较昨日 {{ stats.checkOutsChange > 0 ? '+' : '' }}{{ stats.checkOutsChange }}%</div>
          </q-card-section>
          <q-card-actions align="right">
            <q-btn flat color="negative" label="查看详情" to="/Check-out" />
          </q-card-actions>
        </q-card>
      </div>

      <div class="col-md-3 col-sm-6 col-xs-12">
        <q-card class="dashboard-card">
          <q-card-section class="bg-info text-white">
            <div class="text-h6">入住率</div>
            <q-icon name="hotel" size="sm" class="q-mr-xs" />
          </q-card-section>
          <q-card-section class="text-center">
            <div class="text-h3">{{ occupancyStats.occupancyRate }}%</div>
            <div class="text-caption">{{ occupancyStats.occupiedRooms }}/{{ occupancyStats.totalRooms }} 房间已入住</div>
          </q-card-section>
          <q-card-actions align="right">
            <q-btn flat color="info" label="查看详情" to="/Room-status" />
          </q-card-actions>
        </q-card>
      </div>

      <div class="col-md-3 col-sm-6 col-xs-12">
        <q-card class="dashboard-card">
          <q-card-section class="bg-warning text-white">
            <div class="text-h6">今日收入</div>
            <q-icon name="payments" size="sm" class="q-mr-xs" />
          </q-card-section>
          <q-card-section class="text-center">
            <div class="text-h3">¥{{ stats.revenueToday.toLocaleString() }}</div>
            <div class="text-caption">较昨日 {{ stats.revenueChange > 0 ? '+' : '' }}{{ stats.revenueChange }}%</div>
          </q-card-section>
          <q-card-actions align="right">
            <q-btn flat color="warning" label="查看详情" />
          </q-card-actions>
        </q-card>
      </div>

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
                  v-if="!roomStore.loading"
                  size="25px"
                  :value="roomStats.standardOccupancy"
                  color="primary"
                  class="q-mb-sm"
                >
                  <div class="absolute-full flex flex-center">
                    <q-badge color="primary" text-color="white">
                      标准间: {{ roomStats.standardOccupied }}/{{ roomStats.standardTotal }}
                    </q-badge>
                  </div>
                </q-linear-progress>
                <q-linear-progress
                  v-if="!roomStore.loading"
                  size="25px"
                  :value="roomStats.deluxeOccupancy"
                  color="secondary"
                  class="q-mb-sm"
                >
                  <div class="absolute-full flex flex-center">
                    <q-badge color="secondary" text-color="white">
                      豪华间: {{ roomStats.deluxeOccupied }}/{{ roomStats.deluxeTotal }}
                    </q-badge>
                  </div>
                </q-linear-progress>
                <q-linear-progress
                  v-if="!roomStore.loading"
                  size="25px"
                  :value="roomStats.suiteOccupancy"
                  color="accent"
                >
                  <div class="absolute-full flex flex-center">
                    <q-badge color="accent" text-color="white">
                      套房: {{ roomStats.suiteOccupied }}/{{ roomStats.suiteTotal }}
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

      <!-- 今日待办事项 -->
      <div class="col-md-4 col-xs-12">
        <q-card>
          <q-card-section class="bg-primary text-white">
            <div class="text-h6">
              <q-icon name="task_alt" class="q-mr-xs" />
              今日待办事项
            </div>
          </q-card-section>
          <q-list separator>
            <q-item v-for="(task, index) in todayTasks" :key="index" clickable v-ripple>
              <q-item-section avatar>
                <q-checkbox v-model="task.completed" color="primary" />
              </q-item-section>
              <q-item-section>
                <q-item-label :class="{ 'text-strike': task.completed }">{{ task.title }}</q-item-label>
                <q-item-label caption>{{ task.time }}</q-item-label>
              </q-item-section>
              <q-item-section side>
                <q-select
                  v-model="task.priority"
                  :options="priorityOptions"
                  dense
                  options-dense
                  emit-value
                  map-options
                  style="min-width: 80px"
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
                <q-btn round dense flat icon="delete" color="grey-7" @click="deleteTask(index)" />
              </q-item-section>
            </q-item>
            <q-separator />
            <q-item>
              <q-item-section>
                <q-input v-model="newTaskForm.title" dense placeholder="添加新任务..." @keyup.enter="addTask">
                  <template v-slot:after>
                    <q-select
                      v-model="newTaskForm.priority"
                      :options="priorityOptions"
                      dense
                      options-dense
                      emit-value
                      map-options
                      style="min-width: 80px"
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
                    <q-btn round dense flat icon="add" @click="addTask" />
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
import { ref, computed, onMounted } from 'vue'
import { date } from 'quasar'
import { useRouter } from 'vue-router'
import { useRoomStore } from '../stores/roomStore'
import { useOrderStore } from '../stores/orderStore'
import { useViewStore } from '../stores/viewStore'

// 初始化路由和 stores
const router = useRouter()
const roomStore = useRoomStore()
const orderStore = useOrderStore()
const viewStore = useViewStore()

// 当前日期
const currentDate = computed(() => {
  return date.formatDate(new Date(), 'YYYY年MM月DD日 dddd')
})

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

  // 获取标准间数据 - 修正字段名称为 type_code
  const standardRooms = roomStore.rooms.filter(room => room.type_code === 'standard')
  const standardTotal = standardRooms.length
  const standardOccupied = standardRooms.filter(room => roomStore.getRoomDisplayStatus(room) === 'occupied').length
  const standardOccupancy = standardTotal > 0 ? standardOccupied / standardTotal : 0

  // 获取豪华间数据 - 修正字段名称为 type_code
  const deluxeRooms = roomStore.rooms.filter(room => room.type_code === 'deluxe')
  const deluxeTotal = deluxeRooms.length
  const deluxeOccupied = deluxeRooms.filter(room => roomStore.getRoomDisplayStatus(room) === 'occupied').length
  const deluxeOccupancy = deluxeTotal > 0 ? deluxeOccupied / deluxeTotal : 0

  // 获取套房数据 - 修正字段名称为 type_code
  const suiteRooms = roomStore.rooms.filter(room => room.type_code === 'suite')
  const suiteTotal = suiteRooms.length
  const suiteOccupied = suiteRooms.filter(room => roomStore.getRoomDisplayStatus(room) === 'occupied').length
  const suiteOccupancy = suiteTotal > 0 ? suiteOccupied / suiteTotal : 0

  return {
    available,
    occupied,
    cleaning,
    maintenance,
    standardOccupied,
    standardTotal,
    standardOccupancy,
    deluxeOccupied,
    deluxeTotal,
    deluxeOccupancy,
    suiteOccupied,
    suiteTotal,
    suiteOccupancy
  }
})

// 今日待办事项
const todayTasks = ref([
  { title: '检查101房间空调', time: '10:00', priority: 'high', completed: false },
  { title: '接待VIP客人', time: '12:30', priority: 'high', completed: false },
  { title: '安排会议室布置', time: '14:00', priority: 'medium', completed: true },
  { title: '处理客户投诉', time: '15:30', priority: 'high', completed: false },
  { title: '检查库存', time: '16:00', priority: 'low', completed: false }
])

// 新任务输入
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

// 添加新任务
function addTask() {
  if (newTaskForm.value.title.trim()) {
    todayTasks.value.push({
      title: newTaskForm.value.title,
      time: date.formatDate(new Date(), 'HH:mm'),
      priority: newTaskForm.value.priority,
      completed: false
    })
    newTaskForm.value.title = ''
    newTaskForm.value.priority = 'medium'
  }
}

// 删除任务
function deleteTask(index) {
  todayTasks.value.splice(index, 1)
}

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
  // 获取入住中和已退房的订单
  return orderStore.orders
    .filter(order => order.status === '已入住' || order.status === '已退房')
    .sort((a, b) => {
      // 按创建时间倒序排列
      const dateA = a.createTime
      const dateB = b.createTime
      return new Date(dateB) - new Date(dateA)
    })
    .slice(0, 5) // 只取前5条
    .map(order => ({
      id: order.orderNumber,
      name: order.guestName,
      room: order.roomNumber,
      checkIn: viewStore.formatDate(order.checkInDate),
      checkOut: viewStore.formatDate(order.checkOutDate),
      status: order.status === '已入住' ? '入住中' : '已退房',
      checkInFull: viewStore.formatDate(order.actualCheckInTime || order.checkInDate, true),
      checkOutFull: viewStore.formatDate(order.actualCheckOutTime || order.checkOutDate, true)
    }))
})

// 组件挂载时初始化
onMounted(() => {
  // 这里可以加载实际数据或执行其他初始化操作
  console.log('仪表盘初始化，房间数据:', {
    总房间数: roomStore.rooms.length,
    房型分布: roomStore.rooms.reduce((acc, room) => {
      acc[room.type_code] = (acc[room.type_code] || 0) + 1;
      return acc;
    }, {}),
    房间状态: roomStore.countByStatus
  });

  // 确保房间数据已加载
  if (roomStore.rooms.length === 0) {
    roomStore.fetchAllRooms();
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
