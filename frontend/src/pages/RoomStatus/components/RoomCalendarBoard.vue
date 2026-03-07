<template>
  <div class="calendar-board">
    <div v-if="!rooms.length" class="calendar-empty">
      <q-icon name="event_busy" size="4rem" color="grey-5" />
      <div class="text-h6 text-grey-7 q-mt-sm">当前筛选下没有可展示的房间</div>
      <div class="text-body2 text-grey-6">可放宽条件后重新查询 14 天房态</div>
    </div>

    <div v-else class="calendar-table-wrap">
      <table class="calendar-table">
        <thead>
          <tr>
            <th class="sticky-room-col" rowspan="2">房号</th>
            <th
              v-for="header in dateHeaders"
              :key="header.date"
              :class="['date-header', { 'date-header--today': header.isToday }]"
            >
              <div class="date-main">{{ header.label }}</div>
              <div class="date-sub">{{ header.weekday }}</div>
            </th>
          </tr>
          <tr>
            <th
              v-for="header in dateHeaders"
              :key="`${header.date}-summary`"
              :class="['date-summary', { 'date-summary--today': header.isToday }]"
            >
              剩{{ getAvailableCount(header.date) }}间
            </th>
          </tr>
        </thead>

        <tbody>
          <template v-for="group in groupedRooms" :key="group.typeCode">
            <tr class="type-divider-row">
              <td :colspan="dateHeaders.length + 1">
                <div class="type-divider-content">
                  <span class="type-name">{{ group.typeName }}</span>
                  <span class="type-count">{{ group.rooms.length }} 间</span>
                </div>
              </td>
            </tr>

            <tr v-for="room in group.rooms" :key="room.room_number">
              <td class="sticky-room-col room-number-cell">
                <div class="room-number">{{ room.room_number }}</div>
                <div class="room-price">¥{{ room.price }}</div>
              </td>

              <td
                v-for="cell in room.calendar"
                :key="`${room.room_number}-${cell.date}`"
                :class="['calendar-cell', roomStore.getRoomStatusClass({ display_status: cell.display_status }), { 'calendar-cell--today': cell.date === todayDate }]"
                @click="$emit('open-cell', room, cell)"
              >
                <div class="cell-main">{{ getCellMainText(cell) }}</div>
                <div class="cell-sub">{{ getCellSubText(cell) }}</div>
              </td>
            </tr>
          </template>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { date as qDate } from 'quasar'
import { useRoomStore } from 'src/stores/roomStore'

const roomStore = useRoomStore()

const props = defineProps({
  rooms: {
    type: Array,
    default: () => []
  },
  dailySummary: {
    type: Array,
    default: () => []
  },
  todayDate: {
    type: String,
    required: true
  }
})

defineEmits(['open-cell'])

const WEEKDAY_LABELS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

const dailySummaryMap = computed(() => {
  return (props.dailySummary || []).reduce((acc, item) => {
    acc[item.date] = item
    return acc
  }, {})
})

const dateHeaders = computed(() => {
    return (props.dailySummary || []).map((item) => {
      const parsedDate = qDate.extractDate(item.date, 'YYYY-MM-DD')
      return {
        date: item.date,
        label: qDate.formatDate(parsedDate, 'MM-DD'),
        weekday: WEEKDAY_LABELS[parsedDate.getDay()],
        isToday: item.date === props.todayDate
      }
    })
  })

const groupedRooms = computed(() => {
  // 中文注释：房型分组仅用于表格展示，不承载业务判断。
  const groupMap = new Map()

  for (const room of props.rooms || []) {
    const groupKey = room.type_code || 'unknown'
    if (!groupMap.has(groupKey)) {
      groupMap.set(groupKey, {
        typeCode: groupKey,
        typeName: room.type_name || room.type_code || '未分组',
        rooms: []
      })
    }
    groupMap.get(groupKey).rooms.push(room)
  }

  return Array.from(groupMap.values())
})

function getAvailableCount(date) {
  return dailySummaryMap.value?.[date]?.available_count || 0
}

function getCellMainText(cell) {
  // 中文注释：主文本优先展示最关键的动作信息，保证单元格足够紧凑。
  if (cell.display_status === 'available') return `¥${cell.price}`
  if (cell.display_status === 'cleaning') return '清扫中'
  if (cell.display_status === 'repair') return '维修中'
  return cell.guest_name || (cell.display_status === 'occupied' ? '已入住' : '已预订')
}

function getCellSubText(cell) {
  if (cell.display_status === 'available') return '可入住'
  if (cell.display_status === 'occupied') return '入住'
  if (cell.display_status === 'reserved') return '预订'
  if (cell.display_status === 'cleaning') return '待完成'
  if (cell.display_status === 'repair') return '暂停使用'
  return ''
}
</script>

<style scoped>
.calendar-board {
  position: relative;
}

.calendar-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 320px;
  border: 1px dashed rgba(148, 163, 184, 0.45);
  border-radius: 20px;
  background: linear-gradient(180deg, #f8fbff 0%, #fefefe 100%);
}

.calendar-table-wrap {
  overflow: auto;
  border: 1px solid rgba(214, 221, 230, 0.9);
  border-radius: 20px;
  background: #fff;
  box-shadow: 0 20px 40px rgba(15, 23, 42, 0.06);
}

.calendar-table {
  width: 100%;
  min-width: 1200px;
  border-collapse: separate;
  border-spacing: 0;
}

.calendar-table th,
.calendar-table td {
  border-right: 1px solid rgba(226, 232, 240, 0.95);
  border-bottom: 1px solid rgba(226, 232, 240, 0.95);
}

.calendar-table thead th {
  position: sticky;
  top: 0;
  z-index: 3;
  background: #f8fafc;
}

.sticky-room-col {
  position: sticky;
  left: 0;
  z-index: 4;
  min-width: 92px;
  background: #ffffff;
}

.date-header {
  min-width: 98px;
  padding: 12px 8px 8px;
  text-align: center;
}

.date-header--today,
.date-summary--today {
  background: #eaf3ff;
  color: #1d4ed8;
}

.date-main {
  font-size: 15px;
  font-weight: 700;
}

.date-sub {
  font-size: 12px;
  color: #64748b;
}

.date-summary {
  padding: 6px 8px;
  font-size: 12px;
  font-weight: 600;
  color: #475569;
  text-align: center;
}

.type-divider-row td {
  background: linear-gradient(90deg, #eff6ff 0%, #ffffff 100%);
  padding: 10px 14px;
}

.type-divider-content {
  display: flex;
  align-items: center;
  gap: 10px;
}

.type-name {
  font-size: 14px;
  font-weight: 700;
  color: #1e3a8a;
}

.type-count {
  font-size: 12px;
  color: #64748b;
}

.room-number-cell {
  padding: 10px 8px;
}

.room-number {
  font-size: 15px;
  font-weight: 700;
  color: #0f172a;
}

.room-price {
  margin-top: 2px;
  font-size: 12px;
  color: #64748b;
}

.calendar-cell {
  min-width: 98px;
  height: 78px;
  padding: 10px 8px;
  cursor: pointer;
  transition: background 0.18s ease, transform 0.18s ease;
}

.calendar-cell:hover {
  transform: translateY(-1px);
  box-shadow: inset 0 0 0 1px rgba(37, 99, 235, 0.25);
}

.calendar-cell--today {
  box-shadow: inset 0 0 0 2px rgba(37, 99, 235, 0.3);
}

.cell-main {
  font-size: 13px;
  font-weight: 700;
  color: #0f172a;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.cell-sub {
  margin-top: 4px;
  font-size: 12px;
  color: #64748b;
}
</style>
