<template>
  <!-- 主容器，使用 Quasar 的 q-page 组件 -->

  <q-page class="room-status">
    <div class="q-pa-md">
      <!-- 页面标题 -->
      <!-- <h1 class="text-h4 q-mb-md">房间状态</h1> -->

      <!-- 日期筛选器（始终显示） -->
    <div class="date-filters q-mb-md">
      <q-card flat bordered>
        <q-card-section class="q-pa-md">
          <div class="row q-col-gutter-md items-center">
            <!-- 单个日期选择器 -->
            <div class="col-md-6 col-sm-8 col-xs-12">
              <q-input
                outlined
                dense
                label="查看指定日期房间状态"
                readonly
                :model-value="formattedSelectedDate || '点击选择日期'"
                placeholder="YYYY-MM-DD"
                clearable
                clear-icon="close"
                @clear="clearSelectedDate"
              >
                <template v-slot:append>
                  <q-icon name="event" class="cursor-pointer">
                    <q-popup-proxy cover transition-show="scale" transition-hide="scale">
                      <q-date
                        v-model="selectedDate"
                        default-view="Calendar"
                        today-btn
                        @update:model-value="onDateChange"
                        :locale="langZhCn.date"
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

            <!-- 查询按钮 -->
            <div class="col-md-6 col-sm-4 col-xs-12">
              <q-btn
                color="primary"
                icon="search"
                label="查询房间状态"
                @click="queryRoomStatus"
                :loading="roomStore.loading"
                class="full-width"
              />
            </div>
          </div>
        </q-card-section>
      </q-card>
    </div>



    <!-- 简约筛选工具栏 -->
    <div class="compact-filters q-mb-lg">
      <q-card flat bordered>
        <q-card-section class="q-pa-md">
          <div class="row q-col-gutter-md items-center">
            <!-- 房型选择 -->
            <div class="col-lg-3 col-md-4 col-sm-6 col-xs-12">
              <q-select
                v-model="selectedRoomType"
                :options="roomTypeSelectOptions"
                label="房型筛选"
                outlined
                dense
                emit-value
                map-options
                clearable
                clear-icon="close"
                @update:model-value="onRoomTypeSelect"
              >
                <template v-slot:prepend>
                  <q-icon name="hotel" color="primary" />
                </template>
                <template v-slot:option="scope">
                  <q-item v-bind="scope.itemProps">
                    <q-item-section avatar>
                      <q-icon :name="getRoomTypeIcon(scope.opt.value)" color="primary" />
                    </q-item-section>
                    <q-item-section>
                      <q-item-label>{{ scope.opt.label }}</q-item-label>
                      <q-item-label caption>
                        可用: {{ roomStore.getAvailableRoomCountByType(scope.opt.value) }} /
                        总数: {{ roomStore.getTotalRoomCountByType(scope.opt.value) }}
                      </q-item-label>
                    </q-item-section>
                    <q-item-section side v-if="scope.opt.basePrice">
                      <q-chip size="sm" color="primary" text-color="white">
                        ￥{{ scope.opt.basePrice }}
                      </q-chip>
                    </q-item-section>
                  </q-item>
                </template>
              </q-select>
            </div>

            <!-- 房间状态筛选 -->
            <div class="col-lg-2 col-md-3 col-sm-6 col-xs-12">
              <q-select
                v-model="filterStatus"
                :options="statusOptions"
                label="状态筛选"
                outlined
                dense
                emit-value
                map-options
                clearable
                clear-icon="close"
              >
                <template v-slot:prepend>
                  <q-icon name="assignment" color="secondary" />
                </template>
              </q-select>
            </div>

            <!-- 统计信息概览 -->
            <div class="col-lg-4 col-md-5 col-sm-12 col-xs-12">
              <div class="stats-overview">
                <div class="row q-gutter-sm items-center">
                  <div class="col-auto">
                    <q-chip color="green" text-color="white" size="md" icon="check_circle">
                      总可用: {{ totalAvailableRooms }}间
                    </q-chip>
                  </div>
                  <div class="col-auto" v-if="selectedRoomType">
                    <q-chip color="blue" text-color="white" size="md" :icon="getRoomTypeIcon(selectedRoomType)">
                      {{ getSelectedRoomTypeName() }}: {{ roomStore.getAvailableRoomCountByType(selectedRoomType) }}间
                    </q-chip>
                  </div>
                  <div class="col-auto" v-if="selectedRoomType && getSelectedRoomTypePrice()">
                    <q-chip color="orange" text-color="white" size="md" icon="payments">
                      ￥{{ getSelectedRoomTypePrice() }}/晚
                    </q-chip>
                  </div>
                </div>
              </div>
            </div>

            <!-- 快速切换和操作按钮 -->
            <div class="col-lg-3 col-md-12 col-sm-12 col-xs-12">
              <div class="quick-actions">
                <div class="row q-gutter-xs items-center justify-end">
                  <!-- 快速房型切换 -->
                  <div class="col-auto">
                    <q-btn-toggle
                      v-model="selectedRoomType"
                      :options="topRoomTypeToggleOptions"
                      color="primary"
                      text-color="white"
                      toggle-color="primary"
                      size="sm"
                      flat
                      @update:model-value="onRoomTypeSelect"
                    />
                  </div>
                  <!-- 重置按钮 -->
                  <div class="col-auto">
                    <q-btn
                      outline
                      color="grey"
                      icon="restart_alt"
                      size="sm"
                      round
                      @click="resetAllFilters"
                    >
                      <q-tooltip>重置所有筛选</q-tooltip>
                    </q-btn>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </q-card-section>
      </q-card>
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
            class="cursor-pointer room-card"
            @click="showRoomCalendar(room)"
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
              <div v-if="roomStore.getRoomDisplayStatus(room) === ROOM_STATES.OCCUPIED" class="row q-mb-sm">
                <div class="col-5">
                  <div class="text-subtitle2 text-grey-7">客人:</div>
                </div>
                <div class="col-7">
                  <div class="text-subtitle2 text-weight-bold">{{ room.currentGuest || room.guest_name || '未知客人' }}</div>
                </div>
              </div>

              <!-- 已入住房间显示退房日期 -->
              <div v-if="roomStore.getRoomDisplayStatus(room) === ROOM_STATES.OCCUPIED" class="row q-mb-sm">
                <div class="col-5">
                  <div class="text-subtitle2 text-grey-7">退房日期:</div>
                </div>
                <div class="col-7">
                  <div class="text-subtitle2 text-weight-bold">
                    <q-tooltip>将在此日期退房</q-tooltip>
                    {{ viewStore.formatDate(room.checkOutDate || room.check_out_date) || '未设置' }}
                  </div>
                </div>
              </div>

              <!-- 已入住房间显示订单号 -->
              <div v-if="roomStore.getRoomDisplayStatus(room) === ROOM_STATES.OCCUPIED && (room.order_id)" class="row q-mb-sm">
                <div class="col-5">
                  <div class="text-subtitle2 text-grey-7">订单号:</div>
                </div>
                <div class="col-7">
                  <div class="text-subtitle2">
                    <span class="text-weight-bold">{{ room.order_id }}</span>
                  </div>
                </div>
              </div>

              <!-- 待入住房间显示客人信息 -->
              <div v-if="roomStore.getRoomDisplayStatus(room) === ROOM_STATES.RESERVED" class="row q-mb-sm">
                <div class="col-5">
                  <div class="text-subtitle2 text-grey-7">客人:</div>
                </div>
                <div class="col-7">
                  <div class="text-subtitle2 text-weight-bold">{{ room.currentGuest || room.guest_name || '未知客人' }}</div>
                </div>
              </div>

              <!-- 待入住房间显示联系方式 -->
              <div v-if="roomStore.getRoomDisplayStatus(room) === ROOM_STATES.RESERVED && (room.phone || room.guest_phone)" class="row q-mb-sm">
                <div class="col-5">
                  <div class="text-subtitle2 text-grey-7">联系方式:</div>
                </div>
                <div class="col-7">
                  <div class="text-subtitle2 text-weight-bold">{{ room.phone || room.guest_phone }}</div>
                </div>
              </div>

              <!-- 待入住房间显示预计入住时间 -->
              <div v-if="roomStore.getRoomDisplayStatus(room) === ROOM_STATES.RESERVED" class="row q-mb-sm">
                <div class="col-5">
                  <div class="text-subtitle2 text-grey-7">预计入住:</div>
                </div>
                <div class="col-7">
                  <div class="text-subtitle2 text-weight-bold">
                    <q-tooltip>预计入住时间</q-tooltip>
                    {{ viewStore.formatDate(room.checkInDate || room.check_in_date) || '未设置' }}
                  </div>
                </div>
              </div>

              <!-- 待入住房间显示订单号 -->
              <div v-if="roomStore.getRoomDisplayStatus(room) === ROOM_STATES.RESERVED && (room.order_id || room.orderId)" class="row q-mb-sm">
                <div class="col-5">
                  <div class="text-subtitle2 text-grey-7">订单号:</div>
                </div>
                <div class="col-7">
                  <div class="text-subtitle2">
                    <span class="text-weight-bold">{{ room.order_id || room.orderId }}</span>
                  </div>
                </div>
              </div>
            </q-card-section>

            <!-- 房间操作按钮 -->
            <q-card-actions align="center" class="q-pa-sm q-mt-auto">
              <q-btn-group flat>
                <!-- 预定或入住房间：查看备注 -->
                <q-btn
                  v-if="[ROOM_STATES.RESERVED, ROOM_STATES.OCCUPIED].includes(roomStore.getRoomDisplayStatus(room))"
                  color="secondary"
                  icon="notes"
                  label="查看备注"
                  size="sm"
                  @click.stop="showOrderRemarks(room)"
                />
                <!-- 空闲房间可预订 -->
                <q-btn
                  v-if="roomStore.getRoomDisplayStatus(room) === ROOM_STATES.AVAILABLE"
                  color="primary"
                  icon="book_online"
                  label="预订"
                  size="sm"
                  @click.stop="bookRoom(room.room_id)"
                />
                <!-- 待入住房间可办理入住 -->
                <q-btn
                  v-if="roomStore.getRoomDisplayStatus(room) === ROOM_STATES.RESERVED"
                  color="positive"
                  icon="login"
                  label="办理入住"
                  size="sm"
                  @click.stop="checkInRoom(room)"
                />
                <!-- 已入住房间可退房 -->
                <q-btn
                  v-if="roomStore.getRoomDisplayStatus(room) === ROOM_STATES.OCCUPIED"
                  color="negative"
                  icon="logout"
                  label="退房"
                  size="sm"
                  @click.stop="checkOut(room.room_id)"
                />
                <!-- 所有非清洁中和非维修中的房间都可以设置为清理状态 -->
                <q-btn
                  v-if="roomStore.getRoomDisplayStatus(room) !== ROOM_STATES.CLEANING && roomStore.getRoomDisplayStatus(room) !== ROOM_STATES.REPAIR"
                  color="warning"
                  icon="cleaning_services"
                  label="清理"
                  size="sm"
                  @click.stop="setRoomCleaning(room.room_id)"
                />
                <!-- 非维修中房间可设为维修 -->
                <q-btn
                  v-if="roomStore.getRoomDisplayStatus(room) !== ROOM_STATES.REPAIR"
                  color="grey"
                  icon="build"
                  label="维修"
                  size="sm"
                  @click.stop="setMaintenance(room.room_id)"
                />
                <!-- 维修中房间可完成维修 -->
                <q-btn
                  v-if="roomStore.getRoomDisplayStatus(room) === ROOM_STATES.REPAIR"
                  color="green"
                  icon="check"
                  label="完成维修"
                  size="sm"
                  @click.stop="clearMaintenance(room.room_id)"
                />
                <!-- 清扫中房间可完成清洁 -->
                <q-btn
                  v-if="roomStore.getRoomDisplayStatus(room) === ROOM_STATES.CLEANING"
                  color="green"
                  icon="check"
                  label="完成清洁"
                  size="sm"
                  @click.stop="clearCleaning(room.room_id)"
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

    <!-- 房间月度入住状态日历对话框 -->
    <q-dialog v-model="showCalendarDialog" @hide="clearCalendarData" persistent>
      <q-card class="calendar-dialog-card">
        <!-- 美化的标题区域 -->
        <q-card-section class="calendar-header">
          <div class="calendar-header-content">
            <div class="calendar-title-section">
              <q-icon name="calendar_month" size="2rem" class="calendar-title-icon" />
              <div class="calendar-title-text">
                <div class="text-h5 text-weight-bold">{{ selectedRoom?.room_number }} 房间</div>
                <div class="text-subtitle1 calendar-subtitle">月度入住状态</div>
              </div>
            </div>
            <q-btn
              icon="close"
              flat
              round
              dense
              v-close-popup
              class="calendar-close-btn"
            />
          </div>
        </q-card-section>

        <q-card-section class="calendar-content">
          <!-- 房间信息与月份导航合并 -->
          <div class="room-info-navigation-card q-mb-md">
            <div class="room-info-section">
              <q-icon :name="getRoomTypeIcon(selectedRoom?.type_code)" size="1.5rem" class="room-info-icon" />
              <div class="room-info-text">
                <div class="text-subtitle1 text-weight-medium">{{ selectedRoom?.room_number }}</div>
                <div class="text-body2 text-grey-7">{{ getRoomTypeName(selectedRoom?.type_code) }}</div>
              </div>
            </div>

            <div class="navigation-section">
              <q-btn
                flat
                round
                icon="chevron_left"
                color="primary"
                @click="previousMonth"
                class="nav-btn"
              />
              <div class="current-month-year">
                {{ formatCurrentMonth() }}
              </div>
              <q-btn
                flat
                round
                icon="chevron_right"
                color="primary"
                @click="nextMonth"
                class="nav-btn"
              />
            </div>
          </div>

          <!-- 美化的日历组件 -->
          <div class="calendar-container">
            <q-date
              v-model="calendarDate"
              :events="roomCalendarEvents"
              :event-color="getEventColor"
              today-btn
              class="beautiful-calendar"
              @update:model-value="onDateSelect"
              @navigation="onCalendarNavigation"
              navigation-min-year-month="2020/01"
              navigation-max-year-month="2030/12"
              :options="dateOptions"
              emit-immediately
              :locale="langZhCn.date"
            />
          </div>

          <!-- 美化的选中日期详细信息 -->
          <div v-if="selectedDateInfo" class="selected-date-info">
            <div class="selected-date-header">
              <q-icon name="event" size="1.5rem" class="selected-date-icon" />
              <div class="selected-date-title">
                <div class="text-subtitle1 text-weight-medium">{{ selectedDateInfo.date }}</div>
                <div class="text-body2 text-grey-7">详细信息</div>
              </div>
            </div>
            <div class="selected-date-content">
              <div class="status-info">
                <span class="status-label">状态：</span>
                <q-chip
                  :color="selectedDateInfo.color"
                  text-color="white"
                  class="status-chip-detailed"
                >
                  <q-icon
                    :name="getStatusIcon(selectedDateInfo.status)"
                    size="xs"
                    class="q-mr-xs"
                  />
                  {{ selectedDateInfo.statusText }}
                </q-chip>
              </div>
              <div v-if="selectedDateInfo.guestName" class="guest-info">
                <span class="guest-label">客人：</span>
                <span class="guest-name">{{ selectedDateInfo.guestName }}</span>
              </div>
            </div>
          </div>
        </q-card-section>


      </q-card>
    </q-dialog>

    <!-- 账单对话框 -->
    <Bill
      v-model="showBillDialog"
      :currentOrder="billOrder"
      @bill-created="handleBillCreated"
    />
  </q-page>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useRoomStore } from '../stores/roomStore'
import { useViewStore } from '../stores/viewStore'
import { useOrderStore } from '../stores/orderStore'
import { useQuasar } from 'quasar'
import langZhCn from 'quasar/lang/zh-CN' // 导入中文语言包
import Bill from '../components/CheckIn.vue' // 导入账单组件

// 获取房间store和视图store
const roomStore = useRoomStore()
const viewStore = useViewStore()
const orderStore = useOrderStore()
const $q = useQuasar()

// 获取当前路由和路由器
const route = useRoute()
const router = useRouter()

// 导入房间状态常量
const ROOM_STATES = roomStore.ROOM_STATES

// 筛选条件状态变量
const filterType = ref(null)    // 房间类型筛选，初始为null表示不筛选
const filterStatus = ref(null)  // 房间状态筛选，初始为null表示不筛选

// 日期选择相关的响应式数据
const selectedDate = ref(new Date().toISOString().substring(0, 10)) // 当前选择的查询日期，默认为今天

// 添加简约界面相关的响应式数据
const selectedRoomType = ref(null)  // 当前选中的房型

// 房间日历相关的响应式数据
const showCalendarDialog = ref(false)
const selectedRoom = ref(null)
const calendarDate = ref(new Date().toISOString().substr(0, 10)) // YYYY-MM-DD 格式
const roomBookingData = ref([]) // 存储房间的预订数据
const selectedDateInfo = ref(null) // 存储选中日期的详细信息
const currentCalendarView = ref({ // 跟踪日历当前显示的月份
  year: new Date().getFullYear(),
  month: new Date().getMonth() + 1
})

// 账单相关变量
const showBillDialog = ref(false)
const billOrder = ref(null)

// 日期选项函数 - 允许所有日期可选
const dateOptions = (date) => {
  return true // 允许所有日期
}

// 格式化当前月份年份显示
const formatCurrentMonth = () => {
  const date = new Date(calendarDate.value)
  const year = date.getFullYear()
  const month = date.getMonth() + 1
  return `${year}年${month}月`
}

// 上一个月
const previousMonth = async () => {
  const currentDate = new Date(calendarDate.value)
  currentDate.setMonth(currentDate.getMonth() - 1)
  calendarDate.value = currentDate.toISOString().substr(0, 10)

  // 更新当前视图
  currentCalendarView.value = {
    year: currentDate.getFullYear(),
    month: currentDate.getMonth() + 1
  }

  // 重新获取数据
  if (selectedRoom.value) {
    const startDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).toISOString().substr(0, 10)
    const endDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).toISOString().substr(0, 10)
    await fetchRoomBookingData(selectedRoom.value.room_id, startDate, endDate)
  }
}

// 下一个月
const nextMonth = async () => {
  const currentDate = new Date(calendarDate.value)
  currentDate.setMonth(currentDate.getMonth() + 1)
  calendarDate.value = currentDate.toISOString().substr(0, 10)

  // 更新当前视图
  currentCalendarView.value = {
    year: currentDate.getFullYear(),
    month: currentDate.getMonth() + 1
  }

  // 重新获取数据
  if (selectedRoom.value) {
    const startDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).toISOString().substr(0, 10)
    const endDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).toISOString().substr(0, 10)
    await fetchRoomBookingData(selectedRoom.value.room_id, startDate, endDate)
  }
}

// 格式化选中日期显示（仅用于界面显示）
const formattedSelectedDate = computed(() => {
  if (!selectedDate.value) return ''

  // 确保selectedDate.value是YYYY-MM-DD格式
  let dateStr = selectedDate.value
  if (dateStr.includes('/')) {
    dateStr = dateStr.replace(/\//g, '-')
  }

  const date = new Date(dateStr)
  if (isNaN(date.getTime())) {
    return selectedDate.value // 如果日期无效，返回原始值
  }

  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long'
  })
})


// 组件初始化
onMounted(async () => {
  console.log('RoomStatus组件已挂载，当前选择日期:', selectedDate.value)

  try {
    // 先获取房型数据
    await roomStore.fetchRoomTypes()

    // 初始化订单数据
    console.log('开始获取订单数据...')
    await orderStore.fetchAllOrders()
    console.log('订单数据获取完成，订单数量:', orderStore.orders.length)

        // 检查URL中是否有查询日期参数
    const urlQueryDate = route.query.queryDate
    if (urlQueryDate) {
      // 验证日期格式
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/
      if (dateRegex.test(urlQueryDate)) {
        selectedDate.value = urlQueryDate
        console.log('从URL恢复查询日期:', urlQueryDate)
        await loadRoomDataForDate(urlQueryDate)
      } else {
        console.warn('URL中的日期格式无效:', urlQueryDate)
        // 如果日期格式无效，按当前日期加载
        await loadRoomDataForDate(selectedDate.value)
      }
    } else {
      // 按当前日期加载房间数据
      console.log('开始加载当前日期的房间数据:', selectedDate.value)
      await loadRoomDataForDate(selectedDate.value)
    }

    console.log('房间状态页面初始化完成')
  } catch (error) {
    console.error('房间状态页面初始化失败:', error)
  }
})

// 删除不再使用的日期范围格式化函数

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
      const validStatus = ['available', 'occupied', 'pending', 'cleaning', 'repair'].includes(statusValue)

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

  // 处理查询日期参数
  if (newQuery.queryDate && newQuery.queryDate !== selectedDate.value) {
    selectedDate.value = newQuery.queryDate
    loadRoomDataForDate(newQuery.queryDate)
  }
}, { immediate: true, deep: true })  // immediate确保组件初始化时立即执行一次，deep确保深度监听对象变化

/**
 * 查询房间状态（单日期查询）
 */
async function queryRoomStatus() {
  try {
    if (!selectedDate.value) {
      $q.notify({
        type: 'warning',
        message: '请先选择查询日期',
        position: 'top'
      })
      return
    }

    console.log('查询日期房间状态:', selectedDate.value)

    // 显示加载状态
    roomStore.loading = true

    // 加载指定日期的房间数据
    await loadRoomDataForDate(selectedDate.value)

    $q.notify({
      type: 'positive',
      message: `已显示 ${selectedDate.value} 当天所有房间的状态 (${roomStore.rooms.length} 间)`,
      position: 'top'
    })

  } catch (error) {
    console.error('查询房间状态失败:', error)

    let errorMessage = '查询房间状态失败'
    if (error.response) {
      console.error('错误响应:', error.response)
      if (error.response.status === 400) {
        errorMessage = error.response.data?.message || '请求参数错误'
      } else if (error.response.status === 500) {
        errorMessage = '服务器内部错误'
      }
    } else if (error.message) {
      errorMessage = error.message
    }

    $q.notify({
      type: 'negative',
      message: errorMessage,
      position: 'top'
    })
  } finally {
    roomStore.loading = false
  }
}

// 监听选中日期变化
watch(selectedDate, (newValue) => {
  console.log('选中日期变化:', newValue)
})

/**
 * 计算属性：根据筛选条件过滤房间列表
 * 优先使用URL参数，支持房型和状态筛选
 * 日期筛选通过重新加载数据实现，不在这里处理
 * @returns {Array} 过滤后的房间数组
 */
const filteredRooms = computed(() => {
  // 安全检查：确保 roomStore.rooms 存在且为数组
  if (!roomStore.rooms || !Array.isArray(roomStore.rooms)) {
    console.log('roomStore.rooms 未初始化，返回空数组')
    return []
  }

  // 获取URL中的状态参数，优先于组件状态
  const urlStatus = route.query.status;
  const urlType = route.query.type;

  // 构建筛选条件
  const filters = {};

  // 设置房型筛选 - URL参数优先
  if (urlType) {
    filters.type = urlType;
  } else if (selectedRoomType.value) {
    filters.type = selectedRoomType.value;
  } else if (filterType.value) {
    filters.type = filterType.value;
  }

  // 设置状态筛选 - URL参数优先
  if (urlStatus) {
    filters.status = urlStatus;
  } else if (filterStatus.value) {
    filters.status = filterStatus.value;
  }

  // 如果没有任何筛选条件，直接返回所有房间
  if (!filters.type && !filters.status) {
    console.log('没有筛选条件，返回所有房间:', roomStore.rooms.length);
    return roomStore.rooms;
  }

  // 应用筛选条件
  const result = roomStore.filterRooms(filters);
  console.log('应用筛选后的房间数量:', result?.length || 0, '筛选条件:', filters);

  return result || [];
})

/**
 * 状态筛选选项
 */
const statusOptions = computed(() => [
  { label: '全部状态', value: null },
  { label: '可入住', value: 'available' },
  { label: '已入住', value: 'occupied' },
  { label: '清理中', value: 'cleaning' },
  { label: '维修中', value: 'repair' },
  { label: '待确认', value: 'pending' }
])

/**
 * 房型选择器的选项数据
 */
const roomTypeSelectOptions = computed(() => {
  const allOption = { label: '全部房型', value: null }

  // 安全检查：确保 availableRoomTypeOptions 存在且为数组
  if (!availableRoomTypeOptions.value || !Array.isArray(availableRoomTypeOptions.value)) {
    console.log('availableRoomTypeOptions 未初始化，返回基础选项')
    return [allOption]
  }

  const typeOptions = availableRoomTypeOptions.value.map(option => ({
    ...option,
    label: option.label + ` (${roomStore.getAvailableRoomCountByType(option.value)}/${roomStore.getTotalRoomCountByType(option.value)})`
  }))
  return [allOption, ...typeOptions]
})

/**
 * 快速切换按钮组的选项
 */
const topRoomTypeToggleOptions = computed(() => {
  // 安全检查：确保 availableRoomTypeOptions 存在且为数组
  if (!availableRoomTypeOptions.value || !Array.isArray(availableRoomTypeOptions.value)) {
    console.log('availableRoomTypeOptions 未初始化，返回基础选项')
    return [{ label: '全部', value: null }]
  }

  const topTypes = availableRoomTypeOptions.value.slice(0, 3)
  return [
    { label: '全部', value: null },
    ...topTypes.map(type => ({
      label: type.label.length > 4 ? type.label.substring(0, 4) : type.label,
      value: type.value
    }))
  ]
})

/**
 * 当前选中的房型数据
 */
const getSelectedRoomTypeName = () => {
  if (!selectedRoomType.value) return ''

  // 安全检查：确保 availableRoomTypeOptions 存在
  if (!availableRoomTypeOptions.value || !Array.isArray(availableRoomTypeOptions.value)) {
    console.log('availableRoomTypeOptions 未初始化，无法获取房型名称')
    return ''
  }

  const roomType = availableRoomTypeOptions.value.find(type => type.value === selectedRoomType.value)
  return roomType ? roomType.label : ''
}

const getSelectedRoomTypePrice = () => {
  if (!selectedRoomType.value) return null

  // 安全检查：确保 availableRoomTypeOptions 存在
  if (!availableRoomTypeOptions.value || !Array.isArray(availableRoomTypeOptions.value)) {
    console.log('availableRoomTypeOptions 未初始化，无法获取房型价格')
    return null
  }

  const roomType = availableRoomTypeOptions.value.find(type => type.value === selectedRoomType.value)
  return roomType ? roomType.basePrice : null
}

/**
 * 房间日历事件数据 - 为每个日期生成事件数组
 * 这个计算属性返回所有需要在日历上标记颜色的日期
 * 格式必须是 YYYY/MM/DD 以匹配 Quasar 日历组件的要求
 */
const roomCalendarEvents = computed(() => {
  // 如果没有选中房间，返回空数组
  if (!selectedRoom.value) {
    return [];
  }

  const events = [];

  // 使用当前日历视图的年月
  const year = currentCalendarView.value.year;
  const month = currentCalendarView.value.month - 1; // JavaScript月份从0开始

  // 生成当月的所有日期，格式为 YYYY/MM/DD
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  for (let i = 1; i <= daysInMonth; i++) {
    // 格式化为 YYYY/MM/DD 格式，确保月份和日期都是两位数
    const dateStr = `${year}/${String(month + 1).padStart(2, '0')}/${String(i).padStart(2, '0')}`;
    events.push(dateStr);
  }

  console.log('生成的日历事件:', events.slice(0, 5), '...'); // 调试信息

  return events;
})

/**
 * 房间日历事件颜色函数 - 为每个日期返回对应的颜色
 * 这个函数会被Quasar日历组件调用，为每个标记的日期设置颜色
 */
const getEventColor = (timestamp) => {
  if (!timestamp) {
    console.log('getEventColor: 无效的时间戳');
    return 'grey';
  }

  // timestamp 格式：YYYY/MM/DD，转换为 YYYY-MM-DD 格式
  const dateStr = timestamp.replace ? timestamp.replace(/\//g, '-') : timestamp;
  const status = getRoomDateStatus(dateStr);

  let color;
  switch (status) {
    case 'occupied':
      color = 'red'; // 已入住显示红色
      break;
    case 'reserved':
      color = 'orange'; // 已预订显示橙色
      break;
    case 'available':
      color = 'green'; // 可入住显示绿色
      break;
    default:
      color = 'grey'; // 默认灰色
  }

  // 添加调试信息（仅显示前几个日期的信息）
  if (timestamp.endsWith('/01') || timestamp.endsWith('/02')) {
    console.log(`getEventColor: ${timestamp} -> ${dateStr} -> ${status} -> ${color}`);
  }

  return color;
}

/**
 * 清理日历数据
 */
function clearCalendarData() {
  console.log('清理日历数据')
  selectedDateInfo.value = null
  roomBookingData.value = []
}

/**
 * 处理日历导航（月份变化）
 */
async function onCalendarNavigation(view) {
  console.log('日历导航变化:', view)
  if (view.year && view.month) {
    // 更新当前日历视图
    currentCalendarView.value = {
      year: view.year,
      month: view.month
    }

    // 如果有选中的房间，重新获取新月份的预订数据
    if (selectedRoom.value) {
      const startDate = new Date(view.year, view.month - 1, 1).toISOString().substr(0, 10)
      const endDate = new Date(view.year, view.month, 0).toISOString().substr(0, 10)
      await fetchRoomBookingData(selectedRoom.value.room_id, startDate, endDate)
    }
  }
}

/**
 * 处理日期选择
 */
function onDateSelect(date) {
  if (!date || !selectedRoom.value) return

  // Quasar 日历传递的日期格式通常是 YYYY/MM/DD，需要转换为 YYYY-MM-DD
  let dateStr
  if (typeof date === 'string') {
    dateStr = date.replace(/\//g, '-') // 将 YYYY/MM/DD 转换为 YYYY-MM-DD
  } else {
    dateStr = date.toISOString().substr(0, 10)
  }

  // 获取日期状态
  const status = getRoomDateStatus(dateStr)

  // 查找该日期对应的预订信息
  let booking = null;
  if (roomBookingData.value && roomBookingData.value.length > 0) {
    booking = roomBookingData.value.find(booking => {
      if (!booking.check_in_date || !booking.check_out_date) return false;
      const checkIn = new Date(booking.check_in_date).toISOString().substr(0, 10);
      const checkOut = new Date(booking.check_out_date).toISOString().substr(0, 10);
      return dateStr >= checkIn && dateStr <= checkOut;
    });
  }

  // 更新选中日期信息
  selectedDateInfo.value = {
    date: new Date(dateStr).toLocaleDateString('zh-CN'),
    status: status,
    statusText: getStatusText(status),
    color: getEventColor(date), // 使用getEventColor函数获取颜色
    guestName: booking?.guest_name || null
  };

  console.log('选中日期信息:', selectedDateInfo.value); // 添加调试信息
}

/**
 * 获取状态文本
 */
function getStatusText(status) {
  switch (status) {
    case 'occupied':
      return '已入住'
    case 'reserved':
      return '已预订'
    case 'available':
      return '可入住'
    default:
      return '未知状态'
  }
}

/**
 * 获取状态图标
 */
function getStatusIcon(status) {
  switch (status) {
    case 'occupied':
      return 'hotel'
    case 'reserved':
      return 'schedule'
    case 'available':
      return 'check_circle'
    default:
      return 'help'
  }
}

/**
 * 重置筛选条件
 */
function resetFilters() {
  // 重置所有筛选条件
  filterType.value = null;
  filterStatus.value = null;
  selectedDate.value = new Date().toISOString().substring(0, 10); // 重置为今天

  // 更新URL，清除所有筛选参数
  router.replace({
    path: route.path,
    query: {}
  });

  // 重新加载今天的数据
  loadRoomDataForDate(selectedDate.value);
}

/**
 * 清除选中日期
 */
async function clearSelectedDate() {
  const today = new Date().toISOString().substring(0, 10); // 重置为今天
  selectedDate.value = today;
  await loadRoomDataForDate(today); // 重新加载今天的数据
}

/**
 * 房型选择事件处理
 */
const onRoomTypeSelect = (value) => {
  console.log('房型选择事件:', value)
  selectedRoomType.value = value
  filterType.value = value

  // 更新URL参数
  router.replace({
    path: route.path,
    query: { ...route.query, type: value || undefined }
  })
}

/**
 * 重置所有筛选
 */
const resetAllFilters = async () => {
  selectedRoomType.value = null
  filterType.value = null
  filterStatus.value = null
  selectedDate.value = new Date().toISOString().substring(0, 10) // 重置为今天

  // 更新URL，清除所有筛选参数
  router.replace({
    path: route.path,
    query: {}
  })

  // 重新加载当前日期的房间数据
  await loadRoomDataForDate(selectedDate.value)

  $q.notify({
    type: 'positive',
    message: '已重置所有筛选条件',
    position: 'top'
  })
}

/**
 * 显示房间月度日历
 */
async function showRoomCalendar(room) {
  try {
    console.log('点击房间卡片:', room)
    selectedRoom.value = room

    // 初始化日历视图为当前月份
    const currentDate = new Date()
    currentCalendarView.value = {
      year: currentDate.getFullYear(),
      month: currentDate.getMonth() + 1
    }

    showCalendarDialog.value = true

    // 获取当前月份的开始和结束日期
    const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)
    const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0)

    const startDate = startOfMonth.toISOString().substr(0, 10)
    const endDate = endOfMonth.toISOString().substr(0, 10)

    console.log('日期范围:', startDate, '到', endDate)

    // 获取该房间在当月的预订数据
    await fetchRoomBookingData(room.room_id, startDate, endDate)

    console.log('日历已显示，所有日期都应该有颜色标识')

  } catch (error) {
    console.error('显示房间日历失败:', error)
    $q.notify({
      type: 'negative',
      message: '获取房间日历数据失败',
      position: 'top'
    })
  }
}

/**
 * 获取房间预订数据
 */
async function fetchRoomBookingData(roomId, startDate, endDate) {
  try {
    console.log(`获取房间 ${roomId} 在 ${startDate} 到 ${endDate} 的预订数据`);
    roomBookingData.value = []; // 清空之前的数据

    // 首先尝试从订单store中获取数据
    const room = selectedRoom.value;
    if (room && room.room_number) {
      const orders = orderStore.orders || [];
      console.log('所有订单数据:', orders.length, '个订单');
      console.log('查找房间号:', room.room_number);

      const roomOrders = orders.filter(order => {
        // orderStore中的字段是roomNumber，不是room_number
        const matches = order.roomNumber === room.room_number;
        if (matches) {
          console.log('找到匹配订单:', order.orderNumber, order.roomNumber, order.status);
        }
        return matches;
      });

      console.log(`找到房间 ${room.room_number} 的订单:`, roomOrders.length);

      // 筛选在指定日期范围内的订单
      const filteredOrders = roomOrders.filter(order => {
        // orderStore中的字段是checkInDate和checkOutDate
        if (!order.checkInDate || !order.checkOutDate) {
          console.log('订单缺少日期信息:', order.orderNumber);
          return false;
        }

        const checkIn = new Date(order.checkInDate);
        const checkOut = new Date(order.checkOutDate);
        const start = new Date(startDate);
        const end = new Date(endDate);

        // 检查订单日期是否与查询范围有重叠
        const hasOverlap = (checkIn >= start && checkIn <= end) ||
                          (checkOut >= start && checkOut <= end) ||
                          (checkIn <= start && checkOut >= end);

        if (hasOverlap) {
          console.log(`订单 ${order.orderNumber} 在日期范围内:`, order.checkInDate, '到', order.checkOutDate);
        }

        return hasOverlap;
      });

      if (filteredOrders.length > 0) {
        roomBookingData.value = filteredOrders.map(order => ({
          check_in_date: order.checkInDate,
          check_out_date: order.checkOutDate,
          status: order.status,
          guest_name: order.guestName
        }));

        console.log('处理后的预订数据:', roomBookingData.value);
        return; // 找到真实数据，不需要生成示例数据
      } else {
        console.log('没有找到在指定日期范围内的订单');
      }
    }

    // 如果没有找到真实的预订数据，保持空数组
    if (roomBookingData.value.length === 0) {
      console.log('没有找到该房间的预订数据，房间状态将显示为可用');
    }

  } catch (error) {
    console.error('获取房间预订数据失败:', error)
    roomBookingData.value = []
  }
}


/**
 * 获取房型的中文名称
 */
const getRoomTypeName = viewStore.getRoomTypeName

/**
 * 获取房型对应的图标
 * @param {string} typeCode - 房型代码
 * @returns {string} 图标名称
 */
function getRoomTypeIcon(typeCode) {
  const iconMap = {
    // 数据库中实际房型代码映射（按照数据库中的type_code）
    'asu_wan_zhu': 'hotel',           // 阿苏晚筑
    'asu_xiao_zhu': 'bed',            // 阿苏晓筑
    'xing_yun_ge': 'yard',            // 行云阁有个院子 - 带院子的房型
    'sheng_sheng_man': 'tv',          // 声声慢投影大床 - 投影房
    'yi_jiang_nan': 'king_bed',       // 忆江南大床房 - 大床房
    'yun_ju_ying_yin': 'surround_sound', // 云居云端影音房 - 影音设备
    'bo_ye_shuang': 'single_bed',     // 泊野双床 - 双床房
    'nuan_ju_jiating': 'family_restroom', // 暖居家庭房 - 家庭房
    'zui_shan_tang': 'landscape',     // 醉山塘 - 古典风格
    'rest': 'hotel_class',            // 休息房
    // 保留原有的英文映射作为备用
    'SINGLE': 'bed',
    'DOUBLE': 'hotel',
    'TWIN': 'king_bed',
    'SUITE': 'apartment',
    'DELUXE': 'star',
    'FAMILY': 'family_restroom',
    'VIP': 'workspace_premium',
    'PRESIDENT': 'diamond',
    'STANDARD': 'bedroom_parent',
    'ECONOMY': 'savings'
  }
  return iconMap[typeCode] || 'bed'
}

// 预设的房型选项（备用，当数据库数据未加载时使用）
const roomTypeOptions = [
  { label: '全部房型', value: null },
  { label: '阿苏晓筑', value: 'asu_xiao_zhu' },
  { label: '行云阁', value: 'xing_yun_ge' },
  { label: '声声慢', value: 'sheng_sheng_man' },
  { label: '忆江南', value: 'yi_jiang_nan' },
  { label: '云居影音', value: 'yun_ju_ying_yin' },
  { label: '泊野双床', value: 'bo_ye_shuang' },
  { label: '暖居家庭房', value: 'nuan_ju_jiating' },
  { label: '醉山塘', value: 'zui_shan_tang' },
  { label: '休息房', value: 'rest' }
];

// 获取数据库中的房型选项（基于实际的房型数据）
const availableRoomTypeOptions = computed(() => {
  // 从roomStore.roomTypes获取数据库中的房型数据
  const dbRoomTypes = roomStore.roomTypes || []
  console.log('数据库房型数据:', dbRoomTypes)

  if (dbRoomTypes.length > 0) {
    // 如果数据库房型数据已加载，使用数据库数据
    console.log('使用数据库房型数据创建房型卡片')

    // 安全检查：确保 roomStore.rooms 存在且为数组
    if (!roomStore.rooms || !Array.isArray(roomStore.rooms)) {
      console.log('roomStore.rooms 未初始化，返回基础房型选项')
      return dbRoomTypes.map(roomType => ({
        label: roomType.type_name || viewStore.getRoomTypeName(roomType.type_code),
        value: roomType.type_code,
        description: roomType.description || '',
        basePrice: roomType.base_price || 0
      }))
    }

    const result = dbRoomTypes
      .filter(roomType => {
        // 检查该房型是否有房间存在
        const totalRoomCount = roomStore.rooms.filter(room => room.type_code === roomType.type_code).length
        console.log(`房型 ${roomType.type_code} (${roomType.type_name}) 有 ${totalRoomCount} 个房间`)
        return totalRoomCount > 0 // 只显示有房间的房型（不论是否可用）
      })
      .map(roomType => ({
        label: roomType.type_name || viewStore.getRoomTypeName(roomType.type_code),
        value: roomType.type_code,
        description: roomType.description || '',
        basePrice: roomType.base_price || 0  // 添加基础价格信息
      }))
      .sort((a, b) => a.label.localeCompare(b.label)) // 按名称排序
    console.log('最终房型卡片数据:', result)
    return result
  } else {
    // 如果数据库房型数据未加载，使用备用房型选项
    // 但只显示有房间的房型
    console.log('数据库房型数据未加载，使用备用房型选项')

    // 安全检查：确保 roomStore.rooms 存在且为数组
    if (!roomStore.rooms || !Array.isArray(roomStore.rooms)) {
      console.log('roomStore.rooms 也未初始化，返回基础备用选项')
      return []
    }

    return roomTypeOptions.filter(option => {
      if (option.value === null) return false // 排除"所有房型"选项
      const totalRoomCount = roomStore.rooms.filter(room => room.type_code === option.value).length
      return totalRoomCount > 0
    })
  }
})

//   console.log('设置房型筛选:', type)

//   // 如果当前已经是这个房型筛选，则清除筛选（切换行为）
//   if (filterType.value === type) {
//     // 清除组件状态
//     filterType.value = null
//     // 更新URL，移除type参数
//     router.replace({
//       path: route.path,
//       query: { ...route.query, type: undefined }  // 保留其他查询参数
//     })
//   } else {
//     // 否则设置为新的房型筛选
//     filterType.value = type
//     // 更新URL，添加type参数
//     router.replace({
//       path: route.path,
//       query: { ...route.query, type: type }  // 保留其他查询参数，添加或更新type
//     })
//   }
// }

// 总可用房间数
const totalAvailableRooms = computed(() => {
  // 安全检查：确保 roomStore.rooms 存在且为数组
  if (!roomStore.rooms || !Array.isArray(roomStore.rooms)) {
    console.log('roomStore.rooms 未初始化，返回0个可用房间')
    return 0
  }

  return roomStore.rooms.filter(room =>
    roomStore.getRoomDisplayStatus(room) === 'available'
  ).length
})

/**
 * 获取日期状态 - 根据预订数据判断某一天房间的状态
 * @param {string|number} dateInput - 日期字符串或时间戳
 * @returns {string} 返回状态: 'occupied'(已入住), 'reserved'(已预订), 'available'(可入住)
 */
function getRoomDateStatus(dateInput) {
  // 标准化日期格式为 YYYY-MM-DD
  let dateStr;
  if (typeof dateInput === 'string') {
    // 处理 YYYY/MM/DD 格式
    dateStr = dateInput.replace(/\//g, '-');
  } else if (typeof dateInput === 'number') {
    // 处理时间戳
    dateStr = new Date(dateInput).toISOString().substr(0, 10);
  } else {
    // 默认返回可用
    return 'available';
  }

  // 检查是否有预订数据
  if (!roomBookingData.value || roomBookingData.value.length === 0) {
    // 添加调试信息（仅显示前几个日期的信息）
    if (dateStr.endsWith('-01') || dateStr.endsWith('-02')) {
      console.log(`getRoomDateStatus: ${dateStr} -> 无预订数据 -> available`);
    }
    return 'available';
  }

  // 添加调试信息
  if (dateStr.endsWith('-01')) {
    console.log(`getRoomDateStatus: ${dateStr} -> 预订数据数量: ${roomBookingData.value.length}`);
  }

  // 检查日期是否在任何预订范围内
  for (const booking of roomBookingData.value) {
    // 确保有效的日期值
    if (!booking.check_in_date || !booking.check_out_date) continue;

    // 转换日期格式以便比较
    const checkIn = new Date(booking.check_in_date).toISOString().substr(0, 10);
    const checkOut = new Date(booking.check_out_date).toISOString().substr(0, 10);

    // 检查日期是否在入住期间（不包含退房日期）
    if (dateStr >= checkIn && dateStr < checkOut) {
      // 如果是已取消的订单，整个期间都显示为可用
      if (booking.status === 'cancelled') {
        if (dateStr.endsWith('-01') || dateStr.endsWith('-02')) {
          console.log(`getRoomDateStatus: ${dateStr} -> 订单已取消 -> available`);
        }
        return 'available'; // 已取消，房间可用
      }

      // 正常的入住期间状态判断
      if (booking.status === 'checked-in') {
        if (dateStr.endsWith('-01') || dateStr.endsWith('-02')) {
          console.log(`getRoomDateStatus: ${dateStr} -> 入住期间 (${checkIn} 到 ${checkOut}前) -> 状态: ${booking.status} -> occupied`);
        }
        return 'occupied'; // 已入住
      } else if (booking.status === 'pending') {
        if (dateStr.endsWith('-01') || dateStr.endsWith('-02')) {
          console.log(`getRoomDateStatus: ${dateStr} -> 预订期间 (${checkIn} 到 ${checkOut}前) -> 状态: ${booking.status} -> reserved`);
        }
        return 'reserved'; // 待入住（已预订）
      } else if (booking.status === 'checked-out') {
        // 入住期间但已退房，这些日期曾经被占用
        if (dateStr.endsWith('-01') || dateStr.endsWith('-02')) {
          console.log(`getRoomDateStatus: ${dateStr} -> 入住期间但已退房 (${checkIn} 到 ${checkOut}前) -> occupied`);
        }
        return 'occupied'; // 入住期间（虽然已退房，但这些日期曾经被占用）
      } else {
        if (dateStr.endsWith('-01') || dateStr.endsWith('-02')) {
          console.log(`getRoomDateStatus: ${dateStr} -> 未知状态 (${checkIn} 到 ${checkOut}前) -> 状态: ${booking.status} -> reserved`);
        }
        return 'reserved'; // 未知状态默认为预订
      }
    }
  }

  // 如果不在任何预订范围内，则房间在这一天是可用的
  if (dateStr.endsWith('-01') || dateStr.endsWith('-02')) {
    console.log(`getRoomDateStatus: ${dateStr} -> 不在任何预订范围内 -> available`);
  }
  return 'available';
}

/**
 * 日期选择相关方法
 */
// 加载指定日期的房间数据
async function loadRoomDataForDate(date) {
  try {
    console.log('加载日期房间数据:', date)

    // 更新URL参数，设置查询日期
    router.replace({
      path: route.path,
      query: {
        ...route.query,
        queryDate: date
      }
    })

    await roomStore.fetchAllRooms(date)

    console.log(`已加载 ${date} 的房间数据，共 ${roomStore.rooms.length} 个房间`)

  } catch (error) {
    console.error('加载房间数据失败:', error)
    $q.notify({
      type: 'negative',
      message: '加载房间数据失败',
      position: 'top'
    })
  }
}

// 日期变化处理
async function onDateChange(newDate) {
  console.log('日期变化:', newDate)

  // 确保日期格式为 YYYY-MM-DD
  let formattedDate = newDate
  if (newDate) {
    // 如果是Date对象，转换为YYYY-MM-DD格式
    if (newDate instanceof Date) {
      formattedDate = newDate.toISOString().substring(0, 10)
    } else if (typeof newDate === 'string') {
      // 如果是字符串，确保格式正确
      if (newDate.includes('/')) {
        // 将 YYYY/MM/DD 转换为 YYYY-MM-DD
        formattedDate = newDate.replace(/\//g, '-')
      }
      // 验证日期格式
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/
      if (!dateRegex.test(formattedDate)) {
        console.warn('日期格式不正确:', newDate, '转换后:', formattedDate)
        return
      }
    }
  }

  console.log('格式化后的日期:', formattedDate)
  selectedDate.value = formattedDate
  await loadRoomDataForDate(formattedDate)
}

// 设置为今天
async function setToday() {
  const today = new Date().toISOString().substring(0, 10)
  selectedDate.value = today
  await loadRoomDataForDate(today)
}

/**
 * 房间操作方法
 */
// 预订房间
async function bookRoom(roomId) {
  try {
    console.log('预订房间:', roomId)
    // 跳转到创建订单页面，并传递房间ID
    router.push({
      path: '/CreateOrder',
      query: { roomId }
    })
  } catch (error) {
    console.error('预订房间失败:', error)
    $q.notify({
      type: 'negative',
      message: '预订房间失败',
      position: 'top'
    })
  }
}

// 办理入住
async function checkInRoom(room) {
  try {
    console.log('办理入住:', room)

    // 获取房间对应的订单信息
    const orderNumber = room.order_id || room.orderId
    if (!orderNumber) {
      $q.notify({
        type: 'warning',
        message: '未找到订单信息，无法办理入住',
        position: 'top'
      })
      return
    }

    // 获取完整的订单信息
    const order = orderStore.getOrderByNumber(orderNumber)
    if (!order) {
      $q.notify({
        type: 'negative',
        message: '未找到订单详情，无法办理入住',
        position: 'top'
      })
      return
    }

    // 使用 Quasar Dialog 显示确认对话框
    $q.dialog({
      title: '确认办理入住',
      message: `确定要为订单 ${order.orderNumber} (客人: ${order.guestName}, 房间: ${order.roomNumber}) 办理入住吗？\n\n办理入住后将自动创建账单。`,
      cancel: true,
      persistent: true
    }).onOk(async () => {
      // 用户点击确定，执行入住操作
      await performCheckIn(order)
    }).onCancel(() => {
      // 用户点击取消，什么也不做
      console.log('用户取消了入住操作')
    })
  } catch (error) {
    console.error('办理入住失败:', error)
    $q.notify({
      type: 'negative',
      message: '办理入住失败',
      position: 'top'
    })
  }
}

// 执行入住操作
async function performCheckIn(order) {
  try {
    console.log('办理入住:', order.orderNumber, '房间:', order.roomNumber)

    // 调用订单store更新订单状态
    const updatedOrderFromApi = await orderStore.updateOrderStatusViaApi(order.orderNumber, 'checked-in')

    if (!updatedOrderFromApi) {
      $q.notify({
        type: 'negative',
        message: '办理入住失败，API未返回更新后的订单',
        position: 'top'
      })
      return
    }

    // 获取房间信息 (主要为了拿到 room_id)
    const room = roomStore.getRoomByNumber(order.roomNumber)
    if (!room) {
      console.error('预订房间未找到:', order.roomNumber)
      $q.notify({
        type: 'warning',
        message: '订单已更新为入住，但预订的房间信息未找到，请检查房间状态！',
        position: 'top',
        multiLine: true
      })
      await loadRoomDataForDate(selectedDate.value)
      return
    }

    // 入住成功后刷新房间列表，确保房间状态页面能显示最新的客人信息
    await roomStore.fetchAllRooms()

    // 办理入住成功后，显示账单创建对话框
    showBillDialog.value = true
    billOrder.value = { ...orderStore.getOrderByNumber(order.orderNumber) }

    $q.notify({
      type: 'positive',
      message: '入住成功，请完成账单创建',
      position: 'top'
    })

    // 刷新房间数据
    await loadRoomDataForDate(selectedDate.value)

  } catch (error) {
    console.error('办理入住操作失败:', error)
    const errorMessage = error.response?.data?.message || error.message || '未知错误'
    $q.notify({
      type: 'negative',
      message: `办理入住失败: ${errorMessage}`,
      position: 'top',
      multiLine: true
    })
  }
}

// 处理账单创建成功
async function handleBillCreated() {
  try {
    if (!billOrder.value || !billOrder.value.orderNumber) {
      console.error('订单信息无效')
      return
    }

    console.log('账单创建成功，订单:', billOrder.value.orderNumber)

    // 刷新房间数据
    await loadRoomDataForDate(selectedDate.value)

    $q.notify({
      type: 'positive',
      message: '账单创建成功，入住手续已完成',
      position: 'top'
    })

  } catch (error) {
    console.error('处理账单创建成功事件失败:', error)
    $q.notify({
      type: 'negative',
      message: '账单创建成功，但更新界面失败，请刷新页面',
      position: 'top'
    })
  }
}

// 退房
async function checkOut(roomId) {
  try {
    console.log('退房操作:', roomId)

    // 根据roomId找到对应的房间信息
    const room = roomStore.rooms.find(r => r.room_id === roomId)
    if (!room) {
      $q.notify({
        type: 'negative',
        message: '未找到房间信息',
        position: 'top'
      })
      return
    }

    // 获取房间对应的订单信息
    const orderNumber = room.order_id || room.orderId
    let orderInfo = null
    if (orderNumber) {
      orderInfo = orderStore.getOrderByNumber(orderNumber)
    }

    // 构建确认信息
    let confirmMessage = `确定要为房间 ${room.room_number} 办理退房吗？`
    if (orderInfo) {
      confirmMessage = `确定要为订单 ${orderInfo.orderNumber} (客人: ${orderInfo.guestName}, 房间: ${room.room_number}) 办理退房吗？`
    }
    confirmMessage += '\n\n办理退房后房间将设置为清扫中状态。'

    // 使用 Quasar Dialog 显示确认对话框
    $q.dialog({
      title: '确认办理退房',
      message: confirmMessage,
      cancel: true,
      persistent: true
    }).onOk(async () => {
      // 用户点击确定，执行退房操作
      await performRoomCheckOut(roomId, orderInfo);
    }).onCancel(() => {
      // 用户点击取消，什么也不做
      console.log('用户取消了退房操作');
    });
  } catch (error) {
    console.error('退房失败:', error)
    $q.notify({
      type: 'negative',
      message: '退房失败',
      position: 'top'
    })
  }
}

// 执行退房操作
async function performRoomCheckOut(roomId, orderInfo) {
  try {
    console.log('执行退房操作:', roomId, orderInfo)

    // 如果有订单信息，先更新订单状态
    if (orderInfo) {
      const updatedOrder = await orderStore.updateOrderStatusViaApi(orderInfo.orderNumber, 'checked-out')
      if (!updatedOrder) {
        $q.notify({
          type: 'negative',
          message: '更新订单状态失败，退房操作取消',
          position: 'top'
        })
        return
      }
    }

    // 更新房间状态为清扫中
    const success = await roomStore.checkOutRoom(roomId)
    if (success) {
      $q.notify({
        type: 'positive',
        message: '退房成功',
        position: 'top'
      })
      // 刷新房间数据
      await loadRoomDataForDate(selectedDate.value)
    } else {
      $q.notify({
        type: 'negative',
        message: '退房失败',
        position: 'top'
      })
    }
  } catch (error) {
    console.error('执行退房操作失败:', error)
    const errorMessage = error.response?.data?.message || error.message || '未知错误'
    $q.notify({
      type: 'negative',
      message: `退房失败: ${errorMessage}`,
      position: 'top',
      multiLine: true
    })
  }
}

// 设置房间为清洁状态
async function setRoomCleaning(roomId) {
  try {
    console.log('设置房间清洁:', roomId)
    const success = await roomStore.updateRoomStatus(roomId, 'cleaning')
    if (success) {
      $q.notify({
        type: 'positive',
        message: '房间已设置为清洁状态',
        position: 'top'
      })
      // 刷新房间数据
      await loadRoomDataForDate(selectedDate.value)
    } else {
      $q.notify({
        type: 'negative',
        message: '设置清洁状态失败',
        position: 'top'
      })
    }
  } catch (error) {
    console.error('设置清洁状态失败:', error)
    $q.notify({
      type: 'negative',
      message: '设置清洁状态失败',
      position: 'top'
    })
  }
}

// 设置房间为维修状态
async function setMaintenance(roomId) {
  try {
    console.log('设置房间维修:', roomId)
    const success = await roomStore.setMaintenance(roomId)
    if (success) {
      $q.notify({
        type: 'positive',
        message: '房间已设置为维修状态',
        position: 'top'
      })
      // 刷新房间数据
      await loadRoomDataForDate(selectedDate.value)
    } else {
      $q.notify({
        type: 'negative',
        message: '设置维修状态失败',
        position: 'top'
      })
    }
  } catch (error) {
    console.error('设置维修状态失败:', error)
    $q.notify({
      type: 'negative',
      message: '设置维修状态失败',
      position: 'top'
    })
  }
}

// 完成维修
async function clearMaintenance(roomId) {
  try {
    console.log('完成维修:', roomId)
    const success = await roomStore.clearMaintenance(roomId)
    if (success) {
      $q.notify({
        type: 'positive',
        message: '维修已完成',
        position: 'top'
      })
      // 刷新房间数据
      await loadRoomDataForDate(selectedDate.value)
    } else {
      $q.notify({
        type: 'negative',
        message: '完成维修失败',
        position: 'top'
      })
    }
  } catch (error) {
    console.error('完成维修失败:', error)
    $q.notify({
      type: 'negative',
      message: '完成维修失败',
      position: 'top'
    })
  }
}

// 完成清洁
async function clearCleaning(roomId) {
  try {
    console.log('完成清洁:', roomId)
    const success = await roomStore.clearCleaning(roomId)
    if (success) {
      $q.notify({
        type: 'positive',
        message: '清洁已完成',
        position: 'top'
      })
      // 刷新房间数据
      await loadRoomDataForDate(selectedDate.value)
    } else {
      $q.notify({
        type: 'negative',
        message: '完成清洁失败',
        position: 'top'
      })
    }
  } catch (error) {
    console.error('完成清洁失败:', error)
    $q.notify({
      type: 'negative',
      message: '完成清洁失败',
      position: 'top'
    })
  }
}

/**
 * 查看房间对应订单备注（仅预定/入住）
 */
function showOrderRemarks(room) {
  try {
    // 优先通过订单号匹配
    const orderNumber = room.order_id || room.orderId
    let targetOrder = null

    if (orderNumber) {
      targetOrder = orderStore.getOrderByNumber(orderNumber)
    }

    // 备用：通过房间号 + 日期范围/状态匹配
    if (!targetOrder) {
      const candidates = (orderStore.orders || []).filter(o => o.roomNumber === room.room_number)

      // 若房间包含订单状态，按状态优先筛选
      const statusHint = room.order_status || room.orderStatus
      let filtered = candidates
      if (statusHint) {
        const byStatus = candidates.filter(o => o.status === statusHint)
        if (byStatus.length === 1) {
          targetOrder = byStatus[0]
        } else if (byStatus.length > 1) {
          filtered = byStatus
        }
      }

      // 根据选中查询日期匹配在住/预定区间
      if (!targetOrder && selectedDate.value) {
        const d = selectedDate.value
        targetOrder = filtered.find(o => o.checkInDate && o.checkOutDate && d >= o.checkInDate && d < o.checkOutDate)
      }

      // 兜底：优先已入住，再待入住
      if (!targetOrder) {
        targetOrder = filtered.find(o => o.status === 'checked-in') || filtered.find(o => o.status === 'pending') || filtered[0]
      }
    }

    const guest = targetOrder?.guestName || room.currentGuest || room.guest_name || '未知客人'
    const remarks = targetOrder?.remarks?.trim()

    $q.dialog({
      title: '客人备注',
      message: remarks && remarks.length > 0 ? `${guest}\n\n${remarks}` : `${guest}\n\n无备注`,
      ok: { label: '关闭', color: 'primary' }
    })
  } catch (e) {
    console.error('查看备注失败:', e)
    $q.notify({ type: 'negative', message: '无法获取备注', position: 'top' })
  }
}
</script>

<style scoped>
/* 设置页面最大宽度并居中 */
.room-status {
  /* max-width: 1400px; */
  max-width: 100;
  margin: 0 auto;
}

/* 房间卡片样式 */
.room-card {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 250px;
}

.room-card .room-info {
  flex: 1;
}

/* 房间卡片点击效果 */
.cursor-pointer {
  cursor: pointer;
  transition: transform 0.2s ease;
}

.cursor-pointer:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

/* 日历样式优化 */
.q-date {
  border-radius: 8px;
}

/* 日期范围选择器样式 */
.date-range-input {
  font-weight: 500;
}

.date-range-input :deep(.q-field__native) {
  color: #1976d2;
}

/* 房型统计卡片样式 */
.room-type-card {
  transition: transform 0.3s, box-shadow 0.3s;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  height: 220px;
  border: none;
  overflow: hidden;
  position: relative;
}

/* 不同颜色主题的卡片背景 */
.room-type-color-0 { background: linear-gradient(135deg, #2196f3 0%, #1976d2 100%); } /* 蓝色 */
.room-type-color-1 { background: linear-gradient(135deg, #4caf50 0%, #388e3c 100%); } /* 绿色 */
.room-type-color-2 { background: linear-gradient(135deg, #ff9800 0%, #f57c00 100%); } /* 橙色 */
.room-type-color-3 { background: linear-gradient(135deg, #e91e63 0%, #c2185b 100%); } /* 粉色 */
.room-type-color-4 { background: linear-gradient(135deg, #9c27b0 0%, #7b1fa2 100%); } /* 紫色 */
.room-type-color-5 { background: linear-gradient(135deg, #00bcd4 0%, #0097a7 100%); } /* 青色 */
.room-type-color-6 { background: linear-gradient(135deg, #ffc107 0%, #ffa000 100%); } /* 黄色 */
.room-type-color-7 { background: linear-gradient(135deg, #607d8b 0%, #455a64 100%); } /* 蓝灰色 */

/* 房型统计卡片悬停效果 */
.room-type-card:hover {
  transform: translateY(-6px) scale(1.03);
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.2);
}

/* 房型统计卡片选中状态 */
.room-type-selected {
  transform: translateY(-4px) scale(1.05);
  box-shadow: 0 12px 30px rgba(0, 0, 0, 0.3) !important;
}

/* 房型统计卡片选中状态悬停效果 */
.room-type-selected:hover {
  transform: translateY(-8px) scale(1.07) !important;
  box-shadow: 0 16px 40px rgba(0, 0, 0, 0.4) !important;
}

/* 房型统计卡片内容样式 */
.room-type-content {
  padding: 20px 16px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: space-between;
  height: 100%;
  color: white;
}

/* 房型图标样式 */
.room-type-icon {
  display: flex;
  justify-content: center;
  align-items: center;
}

/* 房型名称样式 */
.room-type-name {
  font-size: 1.1rem;
  text-align: center;
  line-height: 1.3;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
}

/* 可用房间数量样式 */
.available-count {
  font-size: 2.5rem;
  line-height: 1;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

/* 数量标签样式 */
.count-label {
  font-weight: 500;
  opacity: 0.9;
}

/* 总数信息样式 */
.total-info {
  opacity: 0.8;
}

/* 价格芯片样式 */
.price-chip {
  font-weight: 600;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

/* 选中状态指示器 */
.selected-indicator {
  position: absolute;
  top: 12px;
  right: 12px;
  z-index: 10;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 50%;
  padding: 4px;
  backdrop-filter: blur(10px);
}

/* 简约筛选工具栏样式 */
.compact-filters .q-card {
  border-radius: 8px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.stats-overview .q-chip {
  margin: 2px;
}

/* 快速操作区域样式 */
.quick-actions .q-btn-toggle {
  border-radius: 6px;
}

.quick-actions .q-btn {
  min-width: 40px;
}

/* 日期筛选区域样式 */
.date-filters .q-card {
  border-radius: 8px;
  border: 1px dashed #e0e0e0;
}

/* 日期选择器样式 */
.date-selector .q-card {
  border-radius: 8px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  border: 1px solid #e0e0e0;
}

.date-selector .q-input {
  font-weight: 500;
}

.date-selector .q-field__native {
  color: #1976d2;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .compact-filters .stats-overview {
    order: 3;
    margin-top: 12px;
  }

  .compact-filters .quick-actions {
    order: 4;
    margin-top: 12px;
  }
}

/* 自定义列宽，实现一行5个的布局 */
@media (min-width: 1920px) {
  .col-xl-2-4 {
    width: 20%;
    max-width: 20%;
    flex: 0 0 20%;
  }
}

@media (min-width: 1200px) and (max-width: 1919px) {
  .col-xl-2-4 {
    width: 25%;
    max-width: 25%;
    flex: 0 0 25%;
  }
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

/* ==================== 月度入住状态日历对话框样式 ==================== */

/* 日历对话框卡片 */
.calendar-dialog-card {
  min-width: 600px;
  max-width: 700px;
  max-height: 90vh;
  border-radius: 16px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.15);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

/* 日历标题区域 */
.calendar-header {
  background: linear-gradient(135deg, #1976d2 0%, #1565c0 100%);
  color: white;
  padding: 16px 24px;
  position: relative;
}

.calendar-header-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.calendar-title-section {
  display: flex;
  align-items: center;
  gap: 16px;
}

.calendar-title-icon {
  color: rgba(255, 255, 255, 0.9);
  background: rgba(255, 255, 255, 0.1);
  border-radius: 50%;
  padding: 8px;
}

.calendar-title-text .text-h5 {
  margin: 0;
  line-height: 1.2;
}

.calendar-subtitle {
  opacity: 0.9;
  margin: 0;
}

.calendar-close-btn {
  color: rgba(255, 255, 255, 0.9);
  background: rgba(255, 255, 255, 0.1);
  transition: all 0.3s ease;
}

.calendar-close-btn:hover {
  background: rgba(255, 255, 255, 0.2);
  transform: scale(1.1);
}

/* 日历内容区域 */
.calendar-content {
  padding: 20px;
  flex: 1;
  overflow-y: auto;
  min-height: 0;
}

/* 房间信息与导航合并卡片 */
.room-info-navigation-card {
  background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
  border-radius: 12px;
  padding: 16px;
  border: 1px solid #dee2e6;
  margin-bottom: 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.room-info-section {
  display: flex;
  align-items: center;
  gap: 12px;
}

.navigation-section {
  display: flex;
  align-items: center;
  gap: 8px;
}

.room-info-content {
  display: flex;
  align-items: center;
  gap: 12px;
}

.room-info-icon {
  color: #1976d2;
  background: rgba(25, 118, 210, 0.1);
  border-radius: 50%;
  padding: 8px;
}

.room-info-text .text-subtitle1 {
  margin: 0;
  color: #1976d2;
}

.room-info-text .text-body2 {
  margin: 0;
}



/* 导航按钮样式 */
.current-month-year {
  font-size: 1rem;
  font-weight: 600;
  color: #1976d2;
  text-align: center;
  min-width: 80px;
}

.nav-btn {
  color: #1976d2;
  background: rgba(25, 118, 210, 0.1);
  border-radius: 50%;
  width: 32px;
  height: 32px;
  transition: all 0.3s ease;
}

.nav-btn:hover {
  background: rgba(25, 118, 210, 0.2);
  transform: scale(1.1);
}

.nav-btn .q-icon {
  color: #1976d2;
  font-size: 16px;
}

/* 日历容器 */
.calendar-container {
  background: white;
  border-radius: 12px;
  padding: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
  border: 1px solid #e9ecef;
  margin-bottom: 12px;
}

/* 美化的日历样式 */
.beautiful-calendar {
  width: 100%;
  border-radius: 8px;
}

.beautiful-calendar :deep(.q-date__header) {
  display: none !important;
}

.beautiful-calendar :deep(.q-date__navigation) {
  color: white;
  display: flex !important;
  align-items: center !important;
  justify-content: space-between !important;
  padding: 8px 16px !important;
  min-height: 48px !important;
}

.beautiful-calendar :deep(.q-date__navigation .q-btn) {
  color: white;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  transition: all 0.3s ease;
}

.beautiful-calendar :deep(.q-date__navigation .q-btn:hover) {
  background: rgba(255, 255, 255, 0.2);
  transform: scale(1.05);
}

/* 确保左右箭头按钮可见 */
.beautiful-calendar :deep(.q-date__arrow) {
  color: white !important;
  background: rgba(255, 255, 255, 0.1) !important;
  border-radius: 50% !important;
  width: 36px !important;
  height: 36px !important;
  min-width: 36px !important;
  transition: all 0.3s ease !important;
}

.beautiful-calendar :deep(.q-date__arrow:hover) {
  background: rgba(255, 255, 255, 0.2) !important;
  transform: scale(1.1) !important;
}

.beautiful-calendar :deep(.q-date__arrow .q-icon) {
  color: white !important;
  font-size: 18px !important;
}

/* 通用的导航按钮样式 */
.beautiful-calendar :deep(.q-btn[aria-label*="Previous"]),
.beautiful-calendar :deep(.q-btn[aria-label*="Next"]) {
  color: white !important;
  background: rgba(255, 255, 255, 0.1) !important;
  border-radius: 50% !important;
  width: 36px !important;
  height: 36px !important;
  min-width: 36px !important;
  transition: all 0.3s ease !important;
}

.beautiful-calendar :deep(.q-btn[aria-label*="Previous"]:hover),
.beautiful-calendar :deep(.q-btn[aria-label*="Next"]:hover) {
  background: rgba(255, 255, 255, 0.2) !important;
  transform: scale(1.1) !important;
}

/* 确保所有导航相关的按钮都可见 */
.beautiful-calendar :deep(.q-date__header .q-btn) {
  color: white !important;
  background: rgba(255, 255, 255, 0.1) !important;
  border-radius: 6px !important;
  transition: all 0.3s ease !important;
  opacity: 1 !important;
  visibility: visible !important;
}

.beautiful-calendar :deep(.q-date__header .q-btn:hover) {
  background: rgba(255, 255, 255, 0.2) !important;
  transform: scale(1.05) !important;
}

/* 强制显示所有可能的导航按钮 */
.beautiful-calendar :deep(.q-btn) {
  display: inline-flex !important;
  opacity: 1 !important;
  visibility: visible !important;
}

/* 特别针对箭头图标 */
.beautiful-calendar :deep(.q-icon) {
  color: inherit !important;
  opacity: 1 !important;
  visibility: visible !important;
}

/* 确保导航区域有足够的空间 */
.beautiful-calendar :deep(.q-date__header-subtitle) {
  flex: 1 !important;
  text-align: center !important;
}

/* 强制显示前后导航按钮 */
.beautiful-calendar :deep([role="button"]) {
  display: inline-flex !important;
  opacity: 1 !important;
  visibility: visible !important;
}

.beautiful-calendar :deep(.q-date__header-link) {
  color: white;
  text-decoration: none;
  padding: 4px 8px;
  border-radius: 6px;
  transition: all 0.3s ease;
}

.beautiful-calendar :deep(.q-date__header-link:hover) {
  background: rgba(255, 255, 255, 0.1);
}

/* 确保月份年份选择器可见 */
.beautiful-calendar :deep(.q-date__header-subtitle) {
  color: white;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 6px;
  transition: all 0.3s ease;
}

.beautiful-calendar :deep(.q-date__header-subtitle:hover) {
  background: rgba(255, 255, 255, 0.1);
}

/* 月份年份选择视图样式 */
.beautiful-calendar :deep(.q-date__months) {
  background: white;
}

.beautiful-calendar :deep(.q-date__years) {
  background: white;
}

/* 月份年份选择项样式 */
.beautiful-calendar :deep(.q-date__months .q-btn) {
  color: #1976d2;
  border-radius: 6px;
  margin: 2px;
  transition: all 0.3s ease;
}

.beautiful-calendar :deep(.q-date__months .q-btn:hover) {
  background: rgba(25, 118, 210, 0.1);
  transform: scale(1.05);
}

.beautiful-calendar :deep(.q-date__years .q-btn) {
  color: #1976d2;
  border-radius: 6px;
  margin: 2px;
  transition: all 0.3s ease;
}

.beautiful-calendar :deep(.q-date__years .q-btn:hover) {
  background: rgba(25, 118, 210, 0.1);
  transform: scale(1.05);
}

.beautiful-calendar :deep(.q-date__view) {
  padding: 16px;
}

.beautiful-calendar :deep(.q-btn--flat) {
  border-radius: 6px;
}

.beautiful-calendar :deep(.q-date__calendar-item--in) {
  border-radius: 6px;
  transition: all 0.3s ease;
}

.beautiful-calendar :deep(.q-date__calendar-item--in:hover) {
  transform: scale(1.1);
}

/* 选中日期详情 */
.selected-date-info {
  background: linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%);
  border-radius: 12px;
  padding: 16px;
  border: 1px solid #90caf9;
  animation: fadeInUp 0.3s ease;
  margin-top: 12px;
  margin-bottom: 12px;
}

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.selected-date-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}

.selected-date-icon {
  color: #1976d2;
  background: rgba(25, 118, 210, 0.1);
  border-radius: 50%;
  padding: 8px;
}

.selected-date-title .text-subtitle1 {
  margin: 0;
  color: #1976d2;
}

.selected-date-title .text-body2 {
  margin: 0;
}

.selected-date-content {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.status-info,
.guest-info {
  display: flex;
  align-items: center;
  gap: 8px;
}

.status-label,
.guest-label {
  font-weight: 500;
  color: #495057;
  min-width: 50px;
}

.status-chip-detailed {
  font-weight: 500;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.guest-name {
  font-weight: 500;
  color: #1976d2;
  background: rgba(25, 118, 210, 0.1);
  padding: 4px 8px;
  border-radius: 6px;
}



/* 响应式设计 */
@media (max-width: 768px) {
  .calendar-dialog-card {
    min-width: 90vw;
    max-width: 95vw;
    max-height: 95vh;
    margin: 10px;
  }

  .calendar-content {
    padding: 12px;
  }

  .selected-date-content {
    gap: 8px;
  }

  .status-info,
  .guest-info {
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
  }

  .selected-date-info {
    padding: 12px;
    margin-top: 8px;
    margin-bottom: 8px;
  }

  .room-info-navigation-card {
    flex-direction: column;
    gap: 12px;
    align-items: stretch;
  }

  .navigation-section {
    justify-content: center;
  }
}
</style>
