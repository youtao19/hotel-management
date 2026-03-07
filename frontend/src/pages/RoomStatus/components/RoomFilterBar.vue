<template>
  <q-card flat bordered class="q-mb-md bg-white room-filter-card">
    <q-card-section class="q-pa-md">
      <div class="row q-col-gutter-md items-center">
        <!-- 视图切换 -->
        <div class="col-auto">
          <q-btn-toggle
            :model-value="viewMode"
            @update:model-value="emit('update:viewMode', $event)"
            :options="viewOptions"
            toggle-color="primary"
            unelevated
            class="view-mode-toggle"
            padding="6px 20px"
          />
        </div>

        <!-- 日期控制 -->
        <div class="col-auto flex items-center q-gutter-x-sm">
          <q-btn flat round icon="chevron_left" color="primary" @click="emit('prev-range')" />
          <q-input
            dense
            outlined
            type="date"
            :model-value="activeDate"
            @update:model-value="handleDateChange"
            :label="dateCaption"
            style="width: 150px;"
          />
          <q-btn flat round icon="chevron_right" color="primary" @click="emit('next-range')" />
          <q-btn flat color="primary" label="今天" @click="emit('jump-today')" class="text-weight-bold" />
        </div>

        <q-separator vertical class="q-mx-sm" />

        <!-- 筛选条件 -->
        <div class="col-auto">
          <q-select
            dense
            outlined
            :model-value="type"
            @update:model-value="emit('update:type', $event)"
            :options="extendedRoomTypeOptions"
            emit-value
            map-options
            style="min-width: 140px"
          />
        </div>

        <div class="col-auto">
          <q-select
            dense
            outlined
            :model-value="status"
            @update:model-value="emit('update:status', $event)"
            :options="extendedStatusOptions"
            emit-value
            map-options
            style="min-width: 140px"
          />
        </div>

        <!-- 关键词搜索 -->
        <div class="col">
          <q-input
            dense
            outlined
            :model-value="keyword"
            @update:model-value="emit('update:keyword', $event)"
            placeholder="房号 / 订单号 / 客人 / 手机 / 备注"
            @keyup.enter="emit('search')"
            clearable
          >
            <template v-slot:prepend>
              <q-icon name="search" />
            </template>
          </q-input>
        </div>

        <!-- 操作按钮 -->
        <div class="col-auto flex q-gutter-x-sm">
          <q-btn
            unelevated
            color="primary"
            icon="search"
            label="查询"
            @click="emit('search')"
            :loading="loading"
            class="q-px-md"
          />
          <q-btn
            outline
            color="grey-8"
            icon="restart_alt"
            label="重置"
            @click="emit('reset')"
            class="q-px-md"
          />
        </div>
      </div>
      
      <!-- 统计信息栏 -->
      <div class="row items-center q-mt-md q-px-md q-py-sm bg-grey-1 rounded-borders summary-row" v-if="props.summary">
        <div class="text-caption text-grey-8 q-mr-xl flex items-center">
          <q-icon name="insights" size="18px" class="q-mr-xs" />
          房态统计
        </div>
        <div class="flex q-gutter-x-xl">
          <div v-for="item in summaryItems" :key="item.key" class="flex items-center">
            <span class="text-subtitle2 q-mr-sm text-grey-8">{{ item.label }}:</span>
            <span class="text-weight-bolder" :class="item.color" style="font-size: 18px;">{{ item.value }}</span>
          </div>
        </div>
      </div>
    </q-card-section>
  </q-card>
</template>

<script setup>
import { computed } from 'vue'

const viewOptions = [
  { label: '单日', value: 'day' },
  { label: '日历', value: 'calendar' }
]

const props = defineProps({
  viewMode: { type: String, required: true },
  date: { type: String, required: true },
  startDate: { type: String, required: true },
  type: { type: String, default: null },
  status: { type: String, default: null },
  keyword: { type: String, default: '' },
  roomTypeOptions: { type: Array, default: () => [] },
  statusOptions: { type: Array, default: () => [] },
  summary: { type: Object, default: () => ({}) },
  loading: { type: Boolean, default: false }
})

const emit = defineEmits([
  'update:viewMode',
  'update:date',
  'update:startDate',
  'update:type',
  'update:status',
  'update:keyword',
  'search',
  'reset',
  'jump-today',
  'prev-range',
  'next-range'
])

const activeDate = computed(() => (props.viewMode === 'calendar' ? props.startDate : props.date))
const dateCaption = computed(() => (props.viewMode === 'calendar' ? '14 天起始日' : '单日房态'))

const extendedRoomTypeOptions = computed(() => [
  { label: '全部房型', value: null },
  ...props.roomTypeOptions
])

const extendedStatusOptions = computed(() => [
  { label: '全部状态', value: null },
  ...props.statusOptions
])

const summaryItems = computed(() => ([
  { key: 'available', label: '可入住', value: props.summary?.available || 0, color: 'text-positive' },
  { key: 'reserved', label: '已预订', value: props.summary?.reserved || 0, color: 'text-primary' },
  { key: 'occupied', label: '已入住', value: props.summary?.occupied || 0, color: 'text-negative' }
]))

function handleDateChange(nextValue) {
  if (!nextValue) return

  // 中文注释：单日与日历共用这一套原生日期输入，仅分发不同字段。
  if (props.viewMode === 'calendar') {
    emit('update:startDate', nextValue)
    return
  }
  emit('update:date', nextValue)
}
</script>

<style scoped>
.room-filter-card {
  border-radius: 8px;
  border-color: #e2e8f0;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03) !important;
}

.view-mode-toggle {
  border: 1px solid var(--q-primary);
  border-radius: 6px;
}

.summary-row {
  border: 1px solid #e2e8f0;
}
</style>
