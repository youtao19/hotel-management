<template>
  <q-card>
    <q-card-section>
      <div class="row items-center justify-between q-mb-md">
        <div class="text-h6"><q-icon name="hotel" class="q-mr-sm" />房型营收贡献</div>
        <q-btn v-if="selectedType" flat dense size="sm" icon="close" label="清除" @click="$emit('clear')" />
      </div>

      <div v-if="data.length" class="column q-gutter-sm">
        <div v-for="type in data" :key="type.room_type"
             class="room-type-item cursor-pointer"
             :class="{ 'room-type-item--active': selectedType === type.room_type }"
             @click="$emit('toggle', type.room_type)">
          <div class="row items-start justify-between q-mb-xs">
            <div>
              <div class="room-type-name">
                {{ type.type_name }}
                <span v-if="selectedType === type.room_type" class="room-type-dot" />
              </div>
              <div class="text-caption text-grey-7">订单: {{ type.order_count }}</div>
            </div>
            <div class="text-right">
              <div class="text-subtitle1 text-primary text-weight-bold">¥{{ format(type.total_revenue) }}</div>
              <div class="text-caption text-grey-7">{{ getShare(type) }}%</div>
            </div>
          </div>
          <div class="room-type-progress">
            <div class="room-type-progress-bar" :style="{ width: `${getShare(type)}%` }" />
          </div>
        </div>
      </div>
      <div v-else class="text-caption text-grey-6">暂无数据</div>
    </q-card-section>
  </q-card>
</template>

<script setup>
import { computed } from 'vue'
const props = defineProps(['data', 'selectedType'])
defineEmits(['toggle', 'clear'])

const format = (v) => Number(v).toLocaleString('zh-CN', { minimumFractionDigits: 2 })
const total = computed(() => props.data.reduce((s, i) => s + i.total_revenue, 0))
const getShare = (type) => total.value ? (type.total_revenue / total.value * 100).toFixed(1) : 0
</script>

<style scoped>
/* 复制 .room-type-item 相关 CSS */
.room-type-item { border-radius: 10px; border: 1px solid #e2e8f0; padding: 12px; background: #fff; transition: all 0.2s; }
.room-type-item:hover { border-color: #6366f1; transform: translateY(-2px); }
.room-type-item--active { border-color: #4f46e5; background: #eef2ff; }
.room-type-dot { width: 8px; height: 8px; border-radius: 50%; background: #4f46e5; margin-left: 6px; display: inline-block; }
.room-type-progress { height: 6px; background: #e5e7eb; border-radius: 999px; overflow: hidden; margin-top: 8px; }
.room-type-progress-bar { height: 100%; background: linear-gradient(90deg, #6366f1, #22c55e); }
</style>
