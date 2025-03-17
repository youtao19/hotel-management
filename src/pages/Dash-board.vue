<template>
  <div class="dashboard q-pa-md">
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
            <div class="text-h6">今日入住</div>
            <q-icon name="login" size="sm" class="q-mr-xs" />
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
            <div class="text-h3">{{ stats.occupancyRate }}%</div>
            <div class="text-caption">{{ stats.occupiedRooms }}/{{ stats.totalRooms }} 房间已入住</div>
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
        <q-card>
          <q-card-section class="bg-secondary text-white">
            <div class="text-h6">
              <q-icon name="meeting_room" class="q-mr-xs" />
              房间状态概览
            </div>
          </q-card-section>
          <q-card-section>
            <div class="row q-col-gutter-sm">
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
                <q-card class="text-center q-pa-sm bg-grey-3 cursor-pointer" @click="goToRoomStatus('maintenance')">
                  <div class="text-subtitle2">维修中</div>
                  <div class="text-h5">{{ roomStats.maintenance }}</div>
                </q-card>
              </div>
            </div>
          </q-card-section>
          <q-card-section>
            <div class="text-subtitle2 q-mb-sm">房型分布</div>
            <q-linear-progress
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
          </q-card-section>
        </q-card>
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

      <!-- 最近入住客人 -->
      <div class="col-md-6 col-xs-12">
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
          </q-table>
        </q-card>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { date } from 'quasar'
import { useRouter } from 'vue-router'

// 初始化路由
const router = useRouter()

// 当前日期
const currentDate = computed(() => {
  return date.formatDate(new Date(), 'YYYY年MM月DD日 dddd')
})

// 统计数据
const stats = ref({
  checkInsToday: 12,
  checkInsChange: 20,
  checkOutsToday: 8,
  checkOutsChange: -5,
  occupiedRooms: 45,
  totalRooms: 60,
  occupancyRate: 75,
  revenueToday: 15800,
  revenueChange: 12
})

// 房间状态统计
const roomStats = ref({
  available: 15,
  occupied: 45,
  cleaning: 8,
  maintenance: 2,
  standardOccupied: 20,
  standardTotal: 30,
  standardOccupancy: 20/30,
  deluxeOccupied: 18,
  deluxeTotal: 20,
  deluxeOccupancy: 18/20,
  suiteOccupied: 7,
  suiteTotal: 10,
  suiteOccupancy: 7/10
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

// 最近入住客人数据
const recentGuests = ref([
  { id: 1, name: '张三', room: '201', checkIn: '2023-06-01', checkOut: '2023-06-03', status: '入住中' },
  { id: 2, name: '李四', room: '302', checkIn: '2023-06-01', checkOut: '2023-06-05', status: '入住中' },
  { id: 3, name: '王五', room: '105', checkIn: '2023-05-30', checkOut: '2023-06-02', status: '入住中' },
  { id: 4, name: '赵六', room: '208', checkIn: '2023-05-29', checkOut: '2023-06-01', status: '已退房' },
  { id: 5, name: '钱七', room: '401', checkIn: '2023-05-28', checkOut: '2023-06-01', status: '已退房' }
])

// 组件挂载时初始化
onMounted(() => {
  // 这里可以加载实际数据
})

// 跳转到房间状态页面并带上相应的状态筛选参数
function goToRoomStatus(status) {
  console.log('跳转到房间状态页面，状态参数:', status)
  router.replace({
    path: '/room-status',
    query: { status: status }
  })
}
</script>

<style scoped>
.dashboard-card {
  height: 100%;
}
</style> 