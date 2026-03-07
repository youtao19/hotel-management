<template>
  <div class="room-day-view">
    <div v-if="rooms.length" class="row q-col-gutter-md">
      <div
        v-for="room in rooms"
        :key="room.room_number"
        class="col-lg-3 col-md-4 col-sm-6 col-xs-12"
      >
        <RoomCard
          :room="room"
          @click-card="$emit('open-detail', room)"
          @show-remarks="$emit('show-remarks', room)"
          @book="$emit('book', room)"
          @check-in="$emit('check-in', room)"
          @check-out="$emit('check-out', room)"
          @set-cleaning="$emit('set-cleaning', room)"
          @set-maintenance="$emit('set-maintenance', room)"
          @finish-maintenance="$emit('finish-maintenance', room)"
          @finish-cleaning="$emit('finish-cleaning', room)"
        />
      </div>
    </div>

    <div v-else class="empty-state">
      <q-icon name="search_off" size="4rem" color="grey-5" />
      <div class="text-h6 text-grey-7 q-mt-sm">没有符合条件的房间</div>
      <div class="text-body2 text-grey-6">可调整日期、状态或关键词后重试</div>
    </div>
  </div>
</template>

<script setup>
import RoomCard from './RoomCard.vue'

defineProps({
  rooms: {
    type: Array,
    default: () => []
  }
})

defineEmits([
  'open-detail',
  'show-remarks',
  'book',
  'check-in',
  'check-out',
  'set-cleaning',
  'set-maintenance',
  'finish-maintenance',
  'finish-cleaning'
])
</script>

<style scoped>
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 280px;
  border: 1px dashed rgba(148, 163, 184, 0.45);
  border-radius: 20px;
  background: linear-gradient(180deg, #f8fbff 0%, #fefefe 100%);
}
</style>
