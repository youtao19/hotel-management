<template>
  <q-dialog
    :model-value="modelValue"
    position="right"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <q-card class="detail-drawer-card">
      <q-card-section class="detail-header">
        <div>
          <div class="detail-room-number">{{ room?.room_number }} 房</div>
          <div class="detail-room-meta">{{ roomTypeName }}</div>
        </div>
        <q-btn icon="close" flat round dense color="white" v-close-popup />
      </q-card-section>

      <q-card-section class="detail-body" v-if="room && cell">
        <div class="detail-overview">
          <q-badge :color="statusColor" :label="statusText" rounded />
          <div class="detail-date">{{ cell.date }}</div>
          <div class="detail-price">房价 ¥{{ cell.price }}</div>
        </div>

        <q-list bordered separator class="detail-list">
          <q-item>
            <q-item-section>
              <q-item-label caption>订单号</q-item-label>
              <q-item-label>{{ cell.order_id || '无' }}</q-item-label>
            </q-item-section>
          </q-item>
          <q-item>
            <q-item-section>
              <q-item-label caption>客人姓名</q-item-label>
              <q-item-label>{{ cell.guest_name || room.guest_name || '无' }}</q-item-label>
            </q-item-section>
          </q-item>
          <q-item>
            <q-item-section>
              <q-item-label caption>手机号</q-item-label>
              <q-item-label>{{ cell.phone || room.phone || '无' }}</q-item-label>
            </q-item-section>
          </q-item>
          <q-item>
            <q-item-section>
              <q-item-label caption>入住 / 退房</q-item-label>
              <q-item-label>{{ cell.check_in_date || room.check_in_date || '无' }} 至 {{ cell.check_out_date || room.check_out_date || '无' }}</q-item-label>
            </q-item-section>
          </q-item>
          <q-item>
            <q-item-section>
              <q-item-label caption>备注</q-item-label>
              <q-item-label class="detail-remarks">{{ cell.remarks || room.remarks || '无备注' }}</q-item-label>
            </q-item-section>
          </q-item>
        </q-list>

        <div class="detail-actions">
          <q-btn
            v-if="viewMode === 'calendar'"
            outline
            color="primary"
            icon="calendar_view_day"
            label="切到该日单日视图"
            @click="emit('go-day-view', cell.date)"
          />

          <q-btn
            v-if="showCreateOrder"
            color="primary"
            icon="book_online"
            label="创建订单"
            @click="emit('book', room, cell)"
          />

          <q-btn
            v-if="canOperate && showRemarksButton"
            outline
            color="secondary"
            icon="notes"
            label="查看备注"
            @click="emit('show-remarks', room)"
          />

          <q-btn
            v-if="canOperate && displayStatus === 'reserved'"
            color="positive"
            icon="login"
            label="办理入住"
            @click="emit('check-in', room)"
          />

          <q-btn
            v-if="canOperate && displayStatus === 'occupied'"
            color="negative"
            icon="logout"
            label="办理退房"
            @click="emit('check-out', room)"
          />

          <q-btn
            v-if="canOperate && displayStatus !== 'cleaning' && displayStatus !== 'repair'"
            outline
            color="orange-8"
            icon="cleaning_services"
            label="设为清扫"
            @click="emit('set-cleaning', room)"
          />

          <q-btn
            v-if="canOperate && displayStatus !== 'repair'"
            outline
            color="grey-8"
            icon="build"
            label="设为维修"
            @click="emit('set-maintenance', room)"
          />

          <q-btn
            v-if="canOperate && displayStatus === 'cleaning'"
            color="positive"
            icon="check"
            label="完成清洁"
            @click="emit('finish-cleaning', room)"
          />

          <q-btn
            v-if="canOperate && displayStatus === 'repair'"
            color="positive"
            icon="check_circle"
            label="完成维修"
            @click="emit('finish-maintenance', room)"
          />
        </div>
      </q-card-section>
    </q-card>
  </q-dialog>
</template>

<script setup>
import { computed } from 'vue'
import { useViewStore } from 'src/stores/viewStore'

const STATUS_META = {
  available: { color: 'positive', text: '可入住' },
  reserved: { color: 'primary', text: '已预订' },
  occupied: { color: 'negative', text: '已入住' },
  cleaning: { color: 'orange-8', text: '清扫中' },
  repair: { color: 'grey-8', text: '维修中' }
}

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  room: { type: Object, default: null },
  cell: { type: Object, default: null },
  viewMode: { type: String, required: true },
  todayDate: { type: String, required: true }
})

const emit = defineEmits([
  'update:modelValue',
  'go-day-view',
  'book',
  'show-remarks',
  'check-in',
  'check-out',
  'set-cleaning',
  'set-maintenance',
  'finish-cleaning',
  'finish-maintenance'
])

const viewStore = useViewStore()
const displayStatus = computed(() => props?.cell?.display_status || props?.room?.display_status || 'available')
const roomTypeName = computed(() => viewStore.getRoomTypeName(props?.room?.type_code) || props?.room?.type_name || '未知房型')
const statusColor = computed(() => STATUS_META[displayStatus.value]?.color || STATUS_META.available.color)
const statusText = computed(() => STATUS_META[displayStatus.value]?.text || STATUS_META.available.text)
const canOperate = computed(() => props.viewMode === 'day' || props?.cell?.date === props.todayDate)
const showCreateOrder = computed(() => displayStatus.value === 'available')
const showRemarksButton = computed(() => ['reserved', 'occupied'].includes(displayStatus.value))
</script>

<style scoped>
.detail-drawer-card {
  width: 420px;
  max-width: 92vw;
  height: 100vh;
  border-radius: 0;
  display: flex;
  flex-direction: column;
}

.detail-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: #fff;
  background: linear-gradient(135deg, #2563eb 0%, #0f172a 100%);
}

.detail-room-number {
  font-size: 24px;
  font-weight: 700;
}

.detail-room-meta {
  margin-top: 4px;
  font-size: 13px;
  opacity: 0.82;
}

.detail-body {
  flex: 1;
  overflow: auto;
  padding: 18px;
}

.detail-overview {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  margin-bottom: 16px;
}

.detail-date,
.detail-price {
  font-size: 13px;
  color: #475569;
}

.detail-list {
  border-radius: 16px;
  overflow: hidden;
}

.detail-remarks {
  white-space: pre-wrap;
  word-break: break-word;
}

.detail-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 18px;
}
</style>
