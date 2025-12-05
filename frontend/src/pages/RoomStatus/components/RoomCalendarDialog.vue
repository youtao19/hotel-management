<template>
  <q-dialog v-model="isOpen" @hide="handleHide" persistent>
    <q-card class="calendar-dialog-card">
      <q-card-section class="calendar-header">
        <div class="calendar-header-content">
          <div class="calendar-title-section">
            <q-icon name="calendar_month" size="2rem" class="calendar-title-icon" />
            <div class="calendar-title-text">
              <div class="text-h5 text-weight-bold">{{ currentRoom?.room_number }} 房间</div>
              <div class="text-subtitle1 calendar-subtitle">月度入住状态</div>
            </div>
          </div>
          <q-btn icon="close" flat round dense v-close-popup class="calendar-close-btn" />
        </div>
      </q-card-section>

      <q-card-section class="calendar-content">
        <div class="room-info-navigation-card q-mb-md">
          <div class="room-info-section">
            <q-icon name="hotel" size="1.5rem" class="room-info-icon" />
            <div class="room-info-text">
              <div class="text-subtitle1 text-weight-medium">{{ currentRoom?.room_number }}</div>
              <div class="text-body2 text-grey-7">{{ currentRoom?.room_type || currentRoom?.type_code }}</div>
            </div>
          </div>

          <div class="navigation-section">
            <q-btn flat round icon="chevron_left" color="primary" @click="changeMonth(-1)" class="nav-btn" />
            <div class="current-month-year">{{ currentCalendarView.year }}年{{ currentCalendarView.month }}月</div>
            <q-btn flat round icon="chevron_right" color="primary" @click="changeMonth(1)" class="nav-btn" />
          </div>
        </div>

        <div class="calendar-container">
          <q-date
            v-model="calendarDate"
            :events="roomCalendarEvents"
            :event-color="getEventColor"
            today-btn
            class="beautiful-calendar"
            @update:model-value="handleDateSelect"
            minimal
            :locale="locale"
          />
        </div>

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
              <q-chip :color="selectedDateInfo.color" text-color="white" class="status-chip-detailed">
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
</template>

<script setup>
import { ref } from 'vue'
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
  const now = new Date()

  // 重置视图到当前月份
  calendarDate.value = now.toISOString().substr(0, 10)
  currentCalendarView.value = { year: now.getFullYear(), month: now.getMonth() + 1 }

  // 加载数据
  await fetchMonthData(room, now.getFullYear(), now.getMonth() + 1)
}

// 翻页方法
const changeMonth = async (offset) => {
  const date = new Date(calendarDate.value)
  date.setMonth(date.getMonth() + offset)
  calendarDate.value = date.toISOString().substr(0, 10)

  const year = date.getFullYear()
  const month = date.getMonth() + 1
  currentCalendarView.value = { year, month }

  await fetchMonthData(currentRoom.value, year, month)
}

defineExpose({ open })
</script>

<style scoped>
/* 样式保持不变，记得保留之前的 CSS */
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

.calendar-header {
  background: linear-gradient(135deg, #1976d2 0%, #1565c0 100%);
  color: white;
  padding: 16px 24px;
}
/* ... 请确保之前的样式都在这里 ... */
.calendar-content {
  padding: 20px;
  flex: 1;
  overflow-y: auto;
}
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
.room-info-section, .navigation-section {
  display: flex;
  align-items: center;
  gap: 12px;
}
.beautiful-calendar {
  width: 100%;
}
.selected-date-info {
  background: linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%);
  border-radius: 12px;
  padding: 16px;
  margin-top: 12px;
}
.status-info, .guest-info {
  display: flex;
  align-items: center;
  gap: 8px;
}
</style>
