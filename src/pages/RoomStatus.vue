<template>
  <!-- 主容器，使用 Quasar 的 padding 类 -->
  <div class="room-status q-pa-md">
    <!-- 页面标题 -->
    <!-- <h1 class="text-h4 q-mb-md">房间状态</h1> -->

    <!-- 房型统计卡片部分 -->
    <div class="room-type-summary q-mb-md">
      <div class="row q-col-gutter-sm">
        <!-- 标准间统计卡片 -->
        <div class="col-md col-sm-4 col-xs-12">
          <q-card class="bg-blue-1 text-center cursor-pointer" @click="setTypeFilter('standard')">
            <q-card-section>
              <div class="text-subtitle1 text-weight-bold">标准间</div>
              <div class="text-h6 text-weight-bold">剩余：{{ roomStore.getAvailableRoomCountByType('standard') }}</div>
            </q-card-section>
          </q-card>
        </div>

        <!-- 豪华间统计卡片 -->
        <div class="col-md col-sm-4 col-xs-12">
          <q-card class="bg-purple-1 text-center cursor-pointer" @click="setTypeFilter('deluxe')">
            <q-card-section>
              <div class="text-subtitle1 text-weight-bold">豪华间</div>
              <div class="text-h6 text-weight-bold">剩余：{{ roomStore.getAvailableRoomCountByType('deluxe') }}</div>
            </q-card-section>
          </q-card>
        </div>

        <!-- 套房统计卡片 -->
        <div class="col-md col-sm-4 col-xs-12">
          <q-card class="bg-teal-1 text-center cursor-pointer" @click="setTypeFilter('suite')">
            <q-card-section>
              <div class="text-subtitle1 text-weight-bold">套房</div>
              <div class="text-h6 text-weight-bold">剩余：{{ roomStore.getAvailableRoomCountByType('suite') }}</div>
            </q-card-section>
          </q-card>
        </div>

        <!-- 总统套房统计卡片 -->
        <div class="col-md col-sm-4 col-xs-12">
          <q-card class="bg-amber-1 text-center cursor-pointer" @click="setTypeFilter('presidential')">
            <q-card-section>
              <div class="text-subtitle1 text-weight-bold">总统套房</div>
              <div class="text-h6 text-weight-bold">剩余：{{ roomStore.getAvailableRoomCountByType('presidential') }}</div>
            </q-card-section>
          </q-card>
        </div>

        <!-- 家庭房统计卡片 -->
        <div class="col-md col-sm-4 col-xs-12">
          <q-card class="bg-green-1 text-center cursor-pointer" @click="setTypeFilter('family')">
            <q-card-section>
              <div class="text-subtitle1 text-weight-bold">家庭房</div>
              <div class="text-h6 text-weight-bold">剩余：{{ roomStore.getAvailableRoomCountByType('family') }}</div>
            </q-card-section>
          </q-card>
        </div>
      </div>
    </div>

    <!-- 筛选器部分 -->
    <div class="filters q-mb-md">
      <div class="row q-col-gutter-md">
        <!-- 房间类型筛选下拉框 -->
        <div class="col-md-3 col-sm-6 col-xs-12">
          <q-select
            v-model="filterType"
            :options="roomTypeOptions"
            label="房间类型"
            outlined
            emit-value
            map-options
            clearable
            clear-icon="close"
          />
        </div>

        <!-- 房间状态筛选下拉框 -->
        <div class="col-md-3 col-sm-6 col-xs-12">
          <q-select
            v-model="filterStatus"
            :options="statusOptions"
            label="房间状态"
            outlined
            emit-value
            map-options
            clearable
            clear-icon="close"
          />
        </div>

        <!-- 日期范围选择器 -->
        <div class="col-md-4 col-sm-6 col-xs-12">
          <q-input
            outlined
            label="可用日期范围"
            readonly
            :model-value="formattedDateRange || '请选择日期范围'"
            placeholder="YYYY-MM-DD 至 YYYY-MM-DD"
            class="date-range-input"
            clearable
            clear-icon="close"
            @clear="clearDateRange"
          >
            <template v-slot:append>
              <q-icon name="event" class="cursor-pointer">
                <q-popup-proxy cover transition-show="scale" transition-hide="scale">
                  <q-date
                    v-model="dateRange"
                    range
                    default-view="Calendar"
                    today-btn
                  >
                    <div class="row items-center justify-end q-pa-sm">
                      <q-btn v-close-popup label="确定" color="primary" flat/>
                    </div>
                  </q-date>
                </q-popup-proxy>
              </q-icon>
            </template>
          </q-input>
        </div>

        <!-- 筛选操作按钮 -->
        <div class="col-md-2 col-sm-6 col-xs-12 flex items-center">
          <q-btn
            color="primary"
            icon="filter_alt"
            label="应用筛选"
            @click="applyFilters"
            class="q-mr-sm"
          />
          <q-btn
            outline
            color="grey"
            icon="restart_alt"
            label="重置"
            @click="resetFilters"
          />
        </div>
      </div>
    </div>

    <!-- 房间网格视图部分 -->
    <div class="room-grid">
      <div class="row q-col-gutter-md">
        <!-- 遍历过滤后的房间列表 -->
        <div
          v-for="room in filteredRooms"
          :key="room.room_id"
          class="col-lg-3 col-md-4 col-sm-6 col-xs-12"
        >
          <!-- 房间卡片，根据状态设置不同背景色 -->
          <q-card
            :class="roomStore.getRoomStatusClass(room)"
          >
            <q-card-section class="room-header">
              <!-- 房间号 -->
              <div class="text-h5 text-center">{{ room.room_number }}</div>
              <q-chip
                :color="roomStore.getRoomStatusColor(room)"
                text-color="white"
                class="status-chip"
              >
                {{ roomStore.getRoomStatusText(room) }}
              </q-chip>
            </q-card-section>

            <q-separator />

            <q-card-section class="room-info">
              <!-- 房间类型信息 -->
              <div class="row q-mb-sm">
                <div class="col-5">
                  <div class="text-subtitle2 text-grey-7">类型:</div>
                </div>
                <div class="col-7">
                  <div class="text-subtitle2 text-weight-bold">{{ getRoomTypeName(room.type_code) }}</div>
                </div>
              </div>

              <!-- 房间价格信息 -->
              <div class="row q-mb-sm">
                <div class="col-5">
                  <div class="text-subtitle2 text-grey-7">价格:</div>
                </div>
                <div class="col-7">
                  <div class="text-subtitle2 text-weight-bold text-primary">¥{{ room.price }}/晚</div>
                </div>
              </div>

              <!-- 已入住房间显示客人信息 -->
              <div v-if="roomStore.getRoomDisplayStatus(room) === 'occupied'" class="row q-mb-sm">
                <div class="col-5">
                  <div class="text-subtitle2 text-grey-7">客人:</div>
                </div>
                <div class="col-7">
                  <div class="text-subtitle2 text-weight-bold">{{ room.currentGuest }}</div>
                </div>
              </div>

              <!-- 已入住房间显示退房日期 -->
              <div v-if="roomStore.getRoomDisplayStatus(room) === 'occupied'" class="row q-mb-sm">
                <div class="col-5">
                  <div class="text-subtitle2 text-grey-7">退房日期:</div>
                </div>
                <div class="col-7">
                  <div class="text-subtitle2 text-weight-bold">{{ viewStore.formatDate(room.checkOutDate) }}</div>
                </div>
              </div>
            </q-card-section>

            <q-space />

            <!-- 房间操作按钮 -->
            <q-card-actions align="center" class="q-pa-sm">
              <q-btn-group flat>
                <!-- 空闲房间可预订 -->
                <q-btn
                  v-if="roomStore.getRoomDisplayStatus(room) === 'available'"
                  color="primary"
                  icon="book_online"
                  label="预订"
                  size="sm"
                  @click="bookRoom(room.room_id)"
                />
                <!-- 空闲房间可入住 -->
                <q-btn
                  v-if="roomStore.getRoomDisplayStatus(room) === 'available'"
                  color="positive"
                  icon="login"
                  label="入住"
                  size="sm"
                  @click="checkIn(room.room_id)"
                />
                <!-- 已预订房间可办理入住 -->
                <q-btn
                  v-if="roomStore.getRoomDisplayStatus(room) === 'reserved'"
                  color="positive"
                  icon="login"
                  label="办理入住"
                  size="sm"
                  @click="checkInReservation(room.room_id)"
                />
                <!-- 已入住房间可退房 -->
                <q-btn
                  v-if="roomStore.getRoomDisplayStatus(room) === 'occupied'"
                  color="negative"
                  icon="logout"
                  label="退房"
                  size="sm"
                  @click="checkOut(room.room_id)"
                />
                <!-- 非维修中房间可设为维修 -->
                <q-btn
                  v-if="roomStore.getRoomDisplayStatus(room) !== roomStore.ROOM_STATES.REPAIR"
                  color="grey"
                  icon="build"
                  label="维修"
                  size="sm"
                  @click="setMaintenance(room.room_id)"
                />
                <!-- 维修中房间可完成维修 -->
                <q-btn
                  v-if="roomStore.getRoomDisplayStatus(room) === roomStore.ROOM_STATES.REPAIR"
                  color="green"
                  icon="check"
                  label="完成维修"
                  size="sm"
                  @click="clearMaintenance(room.room_id)"
                />
                <!-- 清扫中房间可完成清洁 -->
                <q-btn
                  v-if="roomStore.getRoomDisplayStatus(room) === 'cleaning'"
                  color="green"
                  icon="check"
                  label="完成清洁"
                  size="sm"
                  @click="clearCleaning(room.room_id)"
                />
              </q-btn-group>
            </q-card-actions>
          </q-card>
        </div>
      </div>
    </div>

    <!-- 无结果提示 - 当筛选后没有房间时显示 -->
    <div v-if="filteredRooms.length === 0" class="text-center q-pa-lg">
      <q-icon name="search_off" size="5rem" color="grey-5" />
      <div class="text-h6 text-grey-7 q-mt-md">没有找到符合条件的房间</div>
      <q-btn color="primary" label="重置筛选" @click="resetFilters" class="q-mt-md" />
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useRoomStore } from '../stores/roomStore'
import { useViewStore } from '../stores/viewStore'
import { date } from 'quasar'

// 获取房间store和视图store
const roomStore = useRoomStore()
const viewStore = useViewStore()

// 获取当前路由和路由器
const route = useRoute()
const router = useRouter()

// 筛选条件状态变量
const filterType = ref(null)    // 房间类型筛选，初始为null表示不筛选
const filterStatus = ref(null)  // 房间状态筛选，初始为null表示不筛选
const dateRange = ref(null)     // 日期范围筛选，初始为null表示不筛选

/**
 * 格式化日期范围显示
 */
const formattedDateRange = computed(() => {
  if (!dateRange.value) return ''

  // 如果dateRange是对象形式
  if (typeof dateRange.value === 'object') {
    const { from, to } = dateRange.value
    if (from && to) {
      return `${from} 至 ${to}`
    }
  }

  // 如果dateRange是字符串形式 "YYYY-MM-DD to YYYY-MM-DD"
  if (typeof dateRange.value === 'string' && dateRange.value.includes(' to ')) {
    const [startDate, endDate] = dateRange.value.split(' to ')
    if (startDate && endDate) {
      return `${startDate} 至 ${endDate}`
    }
  }

  // 其他情况返回原值
  return dateRange.value ? String(dateRange.value) : ''
})

/**
 * 监听路由查询参数变化，用于同步URL参数和组件状态
 * 当URL中的status参数变化时，更新filterStatus状态
 * 支持从外部页面（例如仪表盘）跳转到此页面并应用筛选
 */
watch(() => route.query, (newQuery) => {
  console.log('路由参数变化:', newQuery)
  // 仅当新的查询参数中的status与当前filterStatus不同时才更新，避免无限循环
  if (newQuery.status !== filterStatus.value) {
    if (newQuery.status) {
      // 确保状态值是有效的
      const statusValue = newQuery.status
      console.log('尝试应用状态筛选:', statusValue)

      // 验证状态值是否有效，防止非法值导致的筛选问题
      const validStatus = ['available', 'occupied', 'reserved', 'cleaning', 'maintenance'].includes(statusValue)

      if (validStatus) {
        console.log('状态值有效，设置筛选:', statusValue)
        filterStatus.value = statusValue  // 更新内部状态
      } else {
        console.log('无效的状态值:', statusValue)
        filterStatus.value = null  // 无效值时重置筛选
      }
    } else {
      // 如果URL中没有状态参数，重置筛选
      console.log('URL中无状态参数，重置筛选')
      filterStatus.value = null
    }
  }

  // 同样处理type参数
  if (newQuery.type !== filterType.value) {
    filterType.value = newQuery.type || null
  }

  // 处理日期参数
  if (newQuery.dateRange && newQuery.dateRange !== dateRange.value) {
    dateRange.value = newQuery.dateRange
  }
}, { immediate: true, deep: true })  // immediate确保组件初始化时立即执行一次，deep确保深度监听对象变化

// 监听日期范围变化
watch(dateRange, (newValue) => {
  console.log('日期范围变化:', newValue)
}, { deep: true })

/**
 * 添加对筛选条件变化的监听，用于调试
 */
watch(filterStatus, (newValue) => {
  console.log('筛选状态变化为:', newValue)
}, { immediate: true })

/**
 * 计算属性：根据筛选条件过滤房间列表
 * 同时考虑URL参数和本地筛选状态
 * URL参数优先级高于本地状态，确保从其他页面跳转时筛选正常工作
 * 增加了日期范围筛选功能
 * @returns {Array} 过滤后的房间数组
 */
const filteredRooms = computed(() => {
  // 获取URL中的状态参数，优先于filterStatus变量
  const urlStatus = route.query.status
  const urlType = route.query.type
  const urlDateRange = route.query.dateRange

  console.log('重新计算筛选房间列表，条件:', {
    房型: filterType.value || urlType,
    状态变量: filterStatus.value || urlStatus,
    日期范围: dateRange.value || urlDateRange
  })

  // 使用roomStore的filterRooms方法替代本地过滤逻辑
  const filters = {}

  // 设置房型筛选
  if (urlType) {
    filters.type = urlType
  } else if (filterType.value) {
    filters.type = filterType.value
  }

  // 设置状态筛选，优先使用URL中的状态
  if (urlStatus) {
    filters.status = urlStatus
  } else if (filterStatus.value) {
    filters.status = filterStatus.value
  }

  // 设置日期范围筛选
  if (urlDateRange) {
    filters.dateRange = urlDateRange
  } else if (dateRange.value) {
    // 如果是对象格式，转换为字符串
    if (typeof dateRange.value === 'object') {
      const { from, to } = dateRange.value
      if (from && to) {
        filters.dateRange = `${from} to ${to}`
      }
    } else if (typeof dateRange.value === 'string') {
      filters.dateRange = dateRange.value
    }
  }

  return roomStore.filterRooms(filters)
})

/**
 * 应用筛选按钮点击处理函数
 * 将筛选条件更新到URL参数
 */
function applyFilters() {
  console.log('应用筛选:', { 房型: filterType.value, 状态: filterStatus.value, 日期范围: dateRange.value })

  // 构建查询参数对象
  const query = {}

  if (filterType.value) {
    query.type = filterType.value
  }

  if (filterStatus.value) {
    query.status = filterStatus.value
  }

  // 处理日期范围
  if (dateRange.value) {
    // 如果是对象格式，转换为字符串
    if (typeof dateRange.value === 'object') {
      const { from, to } = dateRange.value
      if (from && to) {
        query.dateRange = `${from} to ${to}`
      }
    } else if (typeof dateRange.value === 'string' && dateRange.value.trim() !== '') {
      query.dateRange = dateRange.value
    }
  }

  // 更新URL
  router.replace({
    path: route.path,
    query
  })
}

/**
 * 重置筛选条件
 * 同时清除组件状态和URL参数，保持两者同步
 */
function resetFilters() {
  // 重置组件状态变量
  filterType.value = null
  filterStatus.value = null
  dateRange.value = null

  // 更新URL，移除所有筛选参数
  router.replace({
    path: route.path,
    query: {}
  })
}

/**
 * 预订房间
 * @param {number} roomId - 房间ID
 */
function bookRoom(roomId) {
  console.log('预订房间:', roomId)
  // 获取要预订的房间信息
  const room = roomStore.getRoomById(roomId)
  if (!room) {
    alert('找不到房间信息')
    return
  }

  // 导航到创建订单页面，并传递房间信息
  router.push({
    path: '/CreateOrder',
    query: {
      roomId: roomId,
      roomType: room.type,
      roomNumber: room.number,
      status: 'pending' // 默认设置为"待入住"状态
    }
  })
}

/**
 * 办理入住 (无预订)
 * @param {number} roomId - 房间ID
 */
function checkIn(roomId) {
  console.log('办理入住 (无预订):', roomId)
  // 导航到创建订单页面，并传递房间ID
  router.push({
    path: '/CreateOrder', // 修改为正确的创建订单页面的路由路径
    query: {
      roomId: roomId // 将房间ID作为查询参数传递
    }
  })
}

/**
 * 办理预订入住
 * @param {number} roomId - 房间ID
 */
function checkInReservation(roomId) {
  console.log('办理预订入住:', roomId)
  // 导航到入住页面，并选择预订入住选项卡
  router.push({
    path: '/Check-in',
    query: {
      type: 'reservation',
      roomId: roomId
    }
  })
}

/**
 * 办理退房
 * @param {number} roomId - 房间ID
 */
function checkOut(roomId) {
  console.log('办理退房:', roomId)

  // 显示确认对话框
  if (confirm('确认办理退房？退房后房间将自动设置为"清扫中"状态。')) {
    // 使用roomStore的方法更新房间状态
    roomStore.checkOutRoom(roomId)
    console.log('房间已更新为清扫中状态:', roomId)
  }
}

/**
 * 设置房间为维修状态
 * @param {number} roomId - 房间ID
 */
function setMaintenance(roomId) {
  console.log('设为维修:', roomId)
  // 使用roomStore的方法设置房间维修状态
  roomStore.setMaintenance(roomId)
}

/**
 * 完成房间维修，将状态改为可用
 * @param {number} roomId - 房间ID
 */
function clearMaintenance(roomId) {
  console.log('完成维修:', roomId)
  // 使用roomStore的方法完成房间维修
  roomStore.clearMaintenance(roomId)
}

/**
 * 完成房间清洁，将状态改为可用
 * @param {number} roomId - 房间ID
 */
function clearCleaning(roomId) {
  console.log('完成清洁:', roomId)
  // 使用roomStore的方法完成房间清洁
  roomStore.clearCleaning(roomId)
}

/**
 * 清除日期范围
 */
function clearDateRange() {
  dateRange.value = null
}

/**
 * 组件挂载时的生命周期钩子
 */
onMounted(() => {
  // 这里可以加载实际房间数据，例如从API获取
  // fetchRooms()
})

// 使用计算属性获取各种状态的房间数量
const statusCounts = computed(() => roomStore.countByStatus)

// 使用计算属性获取各种类型的可用房间数量
const availableRoomsByType = computed(() => roomStore.availableByType)

/**
 * 获取特定状态的房间数量
 * @param {string} status - 房间状态
 * @returns {number} 该状态的房间数量
 */
function getStatusCount(status) {
  return roomStore.filterRooms({ status }).length
}

/**
 * 获取特定房型的空余房间数量
 * @param {string} type - 房间类型
 * @returns {number} 该类型的空余房间数量
 */
function getAvailableRoomCountByType(type) {
  return roomStore.getAvailableRoomCountByType(type);
}

/**
 * 获取房型的中文名称
 */
const getRoomTypeName = viewStore.getRoomTypeName

/**
 * 获取状态的中文文本
 */
const getStatusText = viewStore.getStatusText

/**
 * 获取状态的颜色
 */
const getStatusColor = viewStore.getStatusColor

// 房间类型和状态选项
const roomTypeOptions = viewStore.roomTypeOptions
const statusOptions = viewStore.statusOptions

/**
 * 设置房型筛选
 * 实现筛选切换功能：如果当前已经是选中房型，则清除筛选；否则应用新筛选
 * 同时更新URL参数，保持URL状态与组件状态同步
 * @param {string} type - 房间类型代码
 */
function setTypeFilter(type) {
  console.log('设置房型筛选:', type)

  // 如果当前已经是这个房型筛选，则清除筛选（切换行为）
  if (filterType.value === type) {
    // 清除组件状态
    filterType.value = null
    // 更新URL，移除type参数
    router.replace({
      path: route.path,
      query: { ...route.query, type: undefined }  // 保留其他查询参数
    })
  } else {
    // 否则设置为新的房型筛选
    filterType.value = type
    // 更新URL，添加type参数
    router.replace({
      path: route.path,
      query: { ...route.query, type: type }  // 保留其他查询参数，添加或更新type
    })
  }
}
</script>

<style scoped>
/* 设置页面最大宽度并居中 */
.room-status {
  max-width: 1400px;
  margin: 0 auto;
}

/* 日期范围选择器样式 */
.date-range-input {
  font-weight: 500;
}

.date-range-input :deep(.q-field__native) {
  color: #1976d2;
}

/* 房型统计卡片样式 */
.room-type-summary .q-card {
  transition: transform 0.3s, box-shadow 0.3s;
  border-radius: 8px;
  box-shadow: 0 1px 5px rgba(0, 0, 0, 0.1);
  height: 120px;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

/* 房型统计卡片悬停效果 */
.room-type-summary .q-card:hover {
  transform: translateY(-3px);
  box-shadow: 0 5px 15px rgba(0, 0, 0, 0.1);
  background-color: rgba(0, 0, 0, 0.02);
}

/* 房型统计卡片内容样式 */
.room-type-summary .q-card-section {
  padding: 16px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

/* 房型名称样式 */
.room-type-summary .text-subtitle1 {
  font-size: 1.3rem;
  margin-bottom: 8px;
}

/* 房型空余数字样式 */
.room-type-summary .text-h6 {
  font-size: 1.2rem;
  margin: 0;
  color: #1976d2;
}

/* 状态统计卡片的悬停效果 */
.status-summary .q-card {
  transition: transform 0.3s, box-shadow 0.3s;  /* 添加过渡效果 */
  height: 100px;  /* 固定高度 */
  display: flex;
  flex-direction: column;
  justify-content: center;
  border-radius: 8px;
  box-shadow: 0 1px 5px rgba(0, 0, 0, 0.1);
}

/* 鼠标悬停时卡片上移效果 */
.status-summary .q-card:hover {
  transform: translateY(-5px);
  box-shadow: 0 5px 15px rgba(0, 0, 0, 0.1);
}

/* 房间卡片样式 */
.room-grid .q-card {
  height: 250px;  /* 固定高度 */
  transition: transform 0.3s, box-shadow 0.3s;
  border-radius: 8px;
  box-shadow: 0 1px 5px rgba(0, 0, 0, 0.1);
  display: flex;
  flex-direction: column;
  margin-bottom: 16px;
  overflow: hidden;
}

/* 房间卡片悬停效果 */
.room-grid .q-card:hover {
  transform: translateY(-5px);
  box-shadow: 0 8px 15px rgba(0, 0, 0, 0.1);
}

/* 房间卡片头部样式 */
.room-header {
  position: relative;
  padding-bottom: 8px;
  padding-top: 8px;
}

/* 状态标签样式 */
.status-chip {
  position: absolute;
  top: 8px;
  right: 8px;
  font-size: 0.8rem;
}

/* 房间卡片内容区域 */
.room-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding-top: 12px;
  padding-bottom: 0;
}

/* 房间号样式 */
.room-grid .text-h5 {
  font-size: 1.5rem;
  font-weight: bold;
  margin-bottom: 0;
}

/* 分隔线样式 */
.room-grid .q-separator {
  margin: 0;
}

/* 按钮组样式 */
.room-grid .q-btn-group {
  width: 100%;
  justify-content: center;
}

/* 按钮样式 */
.room-grid .q-btn {
  font-size: 0.8rem;
}

/* 筛选器样式 */
.filters {
  background-color: #f5f5f5;
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 24px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}

/* 状态统计卡片内容居中 */
.status-summary .q-card-section {
  padding: 8px;
  text-align: center;
}

/* 状态统计数字样式 */
.status-summary .text-h5 {
  font-weight: bold;
  margin-top: 4px;
  font-size: 1.8rem;
}
</style>
