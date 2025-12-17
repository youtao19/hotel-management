<template>
  <q-dialog v-model="isOpen" @hide="handleHide" persistent>
    <q-card class="calendar-dialog-card">
      <!-- 简洁的头部 -->
      <q-card-section class="calendar-header">
        <div class="header-content">
          <div class="header-left">
            <q-icon name="hotel" size="1.8rem" />
            <div class="header-info">
              <div class="room-number">{{ currentRoom?.room_number }} 房间</div>
              <div class="room-type">{{ currentRoom?.room_type || currentRoom?.type_code }}</div>
            </div>
          </div>
          <q-btn icon="close" flat round dense v-close-popup color="white" />
        </div>
      </q-card-section>

      <!-- 日历区域 -->
      <q-card-section class="calendar-content">
        <q-date
          v-model="calendarDate"
          mask="YYYY-MM-DD"
          :events="roomCalendarEvents"
          :event-color="getEventColor"
          today-btn
          flat
          class="full-width-calendar"
          @update:model-value="handleDateSelect"
          @navigation="onCalendarNavigation"
          :locale="locale"
        />

        <!-- 图例 -->
        <div class="legend-bar">
          <div class="legend-item">
            <span class="legend-dot" style="background: #4caf50"></span>
            <span>可入住</span>
          </div>
          <div class="legend-item">
            <span class="legend-dot" style="background: #2196f3"></span>
            <span>已预订</span>
          </div>
          <div class="legend-item">
            <span class="legend-dot" style="background: #f44336"></span>
            <span>已入住</span>
          </div>
        </div>

        <!-- 选中日期详情 -->
        <div v-if="selectedDateInfo" class="selected-date-info">
          <div class="info-row">
            <span class="info-label">日期</span>
            <span class="info-value">{{ selectedDateInfo.date }}</span>
          </div>
          <div class="info-row">
            <span class="info-label">状态</span>
            <q-badge :color="selectedDateInfo.color" :label="selectedDateInfo.statusText" />
          </div>
          <div v-if="selectedDateInfo.guestName" class="info-row">
            <span class="info-label">客人</span>
            <span class="info-value">{{ selectedDateInfo.guestName }}</span>
          </div>
        </div>
      </q-card-section>
    </q-card>
  </q-dialog>
</template>

<script setup>
import { ref } from 'vue'
import { date as qDateUtil } from 'quasar'
import { useRoomCalendar } from '../composables/useRoomCalendar'
import langZhCn from 'quasar/lang/zh-CN' // 导入中文语言包

const locale = langZhCn.date
const isOpen = ref(false)

// 解构 Hook 中的数据和方法
const {
  currentRoom,
  calendarDate,
  selectedDateInfo,
  currentCalendarView,
  fetchMonthData,
  getEventColor,
  handleDateSelect,
  roomCalendarEvents,
  roomBookingData // 解构这个以便清理
} = useRoomCalendar()

// --- 修复点：定义 handleHide 函数 ---
const handleHide = () => {
  // 清理选中的日期详情
  selectedDateInfo.value = null
  // 可选：清理日历数据，防止下次打开时闪烁旧数据
  roomBookingData.value = []
}

// 打开方法
const open = async (room) => {
  isOpen.value = true
  const now = Date.now()

  // 重置视图到当前月份
  calendarDate.value = qDateUtil.formatDate(now, 'YYYY-MM-DD')
  const year = Number(qDateUtil.formatDate(now, 'YYYY'))
  const month = Number(qDateUtil.formatDate(now, 'M'))
  currentCalendarView.value = { year, month }

  // 加载数据
  await fetchMonthData(room, year, month)
}

// 监听 q-date 内置导航的月份变化
const onCalendarNavigation = async (view) => {
  const { year, month } = view
  console.log('[Calendar] navigation to:', year, month)

  // 更新视图状态
  currentCalendarView.value = { year, month }

  // 加载该月份的数据
  await fetchMonthData(currentRoom.value, year, month)
}

defineExpose({ open })
</script>

<style scoped>
.calendar-dialog-card {
  width: 400px;
  max-width: 95vw;
  border-radius: 12px;
  overflow: hidden;
}

.calendar-header {
  background: #1976d2;
  color: white;
  padding: 12px 16px;
}

.header-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.header-info {
  display: flex;
  flex-direction: column;
}

.room-number {
  font-size: 1.1rem;
  font-weight: 600;
}

.room-type {
  font-size: 0.85rem;
  opacity: 0.85;
}

.calendar-content {
  padding: 16px;
}

.full-width-calendar {
  width: 100%;
  box-shadow: none;
}

.full-width-calendar :deep(.q-date__header) {
  display: none;
}

.legend-bar {
  display: flex;
  justify-content: center;
  gap: 20px;
  padding: 12px 0;
  border-top: 1px solid #eee;
  margin-top: 8px;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.85rem;
  color: #666;
}

.legend-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
}

.selected-date-info {
  background: #f5f5f5;
  border-radius: 8px;
  padding: 12px;
  margin-top: 12px;
}

.info-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 0;
}

.info-row:not(:last-child) {
  border-bottom: 1px solid #e0e0e0;
}

.info-label {
  color: #666;
  font-size: 0.9rem;
}

.info-value {
  font-weight: 500;
}
</style>
