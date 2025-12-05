<template>
  <q-card
    :class="roomStore.getRoomStatusClass(room)"
    class="cursor-pointer room-card"
    @click="$emit('click-card', room)"
  >
    <q-card-section class="room-header">
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
      <div class="row q-mb-sm">
        <div class="col-5"><div class="text-subtitle2 text-grey-7">类型:</div></div>
        <div class="col-7"><div class="text-subtitle2 text-weight-bold">{{ viewStore.getRoomTypeName(room.type_code) }}</div></div>
      </div>
      <div class="row q-mb-sm">
        <div class="col-5"><div class="text-subtitle2 text-grey-7">价格:</div></div>
        <div class="col-7"><div class="text-subtitle2 text-weight-bold text-primary">¥{{ room.price }}/晚</div></div>
      </div>

      <template v-if="displayStatus === ROOM_STATES.OCCUPIED">
        <div class="row q-mb-sm">
          <div class="col-5"><div class="text-subtitle2 text-grey-7">客人:</div></div>
          <div class="col-7"><div class="text-subtitle2 text-weight-bold">{{ room.currentGuest || room.guest_name || '未知客人' }}</div></div>
        </div>
        <div class="row q-mb-sm">
          <div class="col-5"><div class="text-subtitle2 text-grey-7">退房日期:</div></div>
          <div class="col-7">
            <div class="text-subtitle2 text-weight-bold">
              <q-tooltip>将在此日期退房</q-tooltip>
              {{ viewStore.formatDate(room.checkOutDate || room.check_out_date) || '未设置' }}
            </div>
          </div>
        </div>
      </template>

      <template v-if="displayStatus === ROOM_STATES.RESERVED">
        <div class="row q-mb-sm">
          <div class="col-5"><div class="text-subtitle2 text-grey-7">客人:</div></div>
          <div class="col-7"><div class="text-subtitle2 text-weight-bold">{{ room.currentGuest || room.guest_name || '未知客人' }}</div></div>
        </div>
        <div class="row q-mb-sm">
          <div class="col-5"><div class="text-subtitle2 text-grey-7">预计入住:</div></div>
          <div class="col-7">
            <div class="text-subtitle2 text-weight-bold">
              {{ viewStore.formatDate(room.checkInDate || room.check_in_date) || '未设置' }}
            </div>
          </div>
        </div>
      </template>
    </q-card-section>

    <q-card-actions align="center" class="q-pa-sm q-mt-auto">
      <q-btn-group flat>
        <q-btn
          v-if="[ROOM_STATES.RESERVED, ROOM_STATES.OCCUPIED].includes(displayStatus)"
          color="secondary" icon="notes" label="查看备注" size="sm"
          @click.stop="$emit('show-remarks', room)"
        />
        <q-btn
          v-if="displayStatus === ROOM_STATES.AVAILABLE"
          color="primary" icon="book_online" label="预订" size="sm"
          @click.stop="$emit('book', room)"
        />
        <q-btn
          v-if="displayStatus === ROOM_STATES.RESERVED"
          color="positive" icon="login" label="办理入住" size="sm"
          @click.stop="$emit('check-in', room)"
        />
        <q-btn
          v-if="displayStatus === ROOM_STATES.OCCUPIED"
          color="negative" icon="logout" label="退房" size="sm"
          @click.stop="$emit('check-out', room)"
        />
        <q-btn
          v-if="displayStatus !== ROOM_STATES.CLEANING && displayStatus !== ROOM_STATES.REPAIR"
          color="warning" icon="cleaning_services" label="清理" size="sm"
          @click.stop="$emit('set-cleaning', room)"
        />
        <q-btn
          v-if="displayStatus !== ROOM_STATES.REPAIR"
          color="grey" icon="build" label="维修" size="sm"
          @click.stop="$emit('set-maintenance', room)"
        />
        <q-btn
          v-if="displayStatus === ROOM_STATES.REPAIR"
          color="green" icon="check" label="完成维修" size="sm"
          @click.stop="$emit('finish-maintenance', room)"
        />
        <q-btn
          v-if="displayStatus === ROOM_STATES.CLEANING"
          color="green" icon="check" label="完成清洁" size="sm"
          @click.stop="$emit('finish-cleaning', room)"
        />
      </q-btn-group>
    </q-card-actions>
  </q-card>
</template>

<script setup>
import { computed } from 'vue'
import { useRoomStore } from 'src/stores/roomStore' // 注意根据你的实际路径调整
import { useViewStore } from 'src/stores/viewStore'

const props = defineProps({
  room: {
    type: Object,
    required: true
  }
})

// 定义向父组件发出的事件
const emit = defineEmits([
  'click-card',
  'show-remarks',
  'book',
  'check-in',
  'check-out',
  'set-cleaning',
  'set-maintenance',
  'finish-maintenance',
  'finish-cleaning'
])

const roomStore = useRoomStore()
const viewStore = useViewStore()
const ROOM_STATES = roomStore.ROOM_STATES

// 计算当前房间的显示状态，减少模板中的重复调用
const displayStatus = computed(() => roomStore.getRoomDisplayStatus(props.room))

</script>

<style scoped>
/* 这里直接放入你原文件里关于 .room-card, .status-chip 等相关的 CSS */
.room-card {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 250px;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
  overflow: hidden;
}

.room-card:hover {
  transform: translateY(-5px);
  box-shadow: 0 8px 15px rgba(0, 0, 0, 0.1);
}

.room-header {
  position: relative;
  padding: 8px 16px;
}

.status-chip {
  position: absolute;
  top: 8px;
  right: 8px;
  font-size: 0.8rem;
}

.room-info {
  flex: 1;
  padding-top: 12px;
}
</style>
