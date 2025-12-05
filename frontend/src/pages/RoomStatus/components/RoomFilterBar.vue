<template>
  <div class="q-mb-lg filters-row">
    <q-card flat bordered class="filter-card glassy-card">
      <q-card-section class="q-pa-lg">
        <div class="row q-col-gutter-md items-center">
          <div class="col-12 col-md-4 col-lg-3">
            <q-input
              filled dense stack-label readonly
              input-class="filter-input"
              label="查看指定日期房间状态"
              placeholder="YYYY-MM-DD"
              :model-value="formattedDate || ''"
              clearable
              clear-icon="close"
              @clear="$emit('update:date', null)"
            >
              <template #prepend>
                <q-icon name="event" color="teal-6" />
              </template>
              <template #append>
                <q-btn round dense flat icon="expand_more" color="grey-7" class="date-icon-btn">
                  <q-popup-proxy cover transition-show="scale" transition-hide="scale">
                    <q-date
                      :model-value="date"
                      @update:model-value="(val) => $emit('update:date', val)"
                      default-view="Calendar"
                      today-btn
                      :locale="locale"
                    >
                      <div class="row items-center justify-end q-pa-sm">
                        <q-btn v-close-popup label="确定" color="primary" flat />
                      </div>
                    </q-date>
                  </q-popup-proxy>
                </q-btn>
              </template>
            </q-input>
          </div>

          <div class="col-12 col-md-3 col-lg-2">
            <q-select
              :model-value="type"
              @update:model-value="(val) => $emit('update:type', val)"
              :options="roomTypeOptions"
              label="房型筛选"
              filled dense emit-value map-options
              :clearable="!!type"
              clear-icon="close"
              input-class="filter-input"
              popup-content-class="rounded-popup"
              dropdown-icon="expand_more"
            >
              <template #prepend>
                <q-icon :name="getRoomTypeIcon(type)" color="teal-6" />
              </template>
            </q-select>
          </div>

          <div class="col-12 col-md-3 col-lg-2">
            <q-select
              :model-value="status"
              @update:model-value="(val) => $emit('update:status', val)"
              :options="statusOptions"
              label="状态"
              filled dense emit-value map-options
              :clearable="!!status"
              clear-icon="close"
              input-class="filter-input"
              popup-content-class="rounded-popup"
              dropdown-icon="expand_more"
            >
              <template #prepend>
                <q-icon name="credit_card" color="teal-6" />
              </template>
            </q-select>
          </div>

          <div class="col-12 col-lg-5">
            <div class="row items-center q-gutter-md">
              <div class="col-auto">
                <q-btn
                  color="primary" icon="search" label="查询房间状态"
                  unelevated class="search-btn"
                  :loading="loading"
                  @click="$emit('search')"
                />
              </div>
              <div class="col-auto">
                <q-chip color="positive" text-color="white" size="md" icon="check_circle" class="pill-chip">
                  总可用: {{ totalAvailable }}间
                </q-chip>
              </div>
              <div class="col-auto flex items-center q-gutter-sm">
                <q-btn
                  outline color="grey" icon="restart_alt" size="sm" round
                  class="refresh-btn"
                  @click="$emit('reset')"
                >
                  <q-tooltip>重置筛选</q-tooltip>
                </q-btn>
              </div>
            </div>
          </div>
        </div>
      </q-card-section>
    </q-card>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import langZhCn from 'quasar/lang/zh-CN' // 导入中文语言包

const locale = langZhCn.date

// 定义 Props：接收父组件的数据
const props = defineProps({
  date: String,
  type: String, // 选中的房型
  status: String, // 选中的状态
  roomTypeOptions: Array, // 房型选项列表
  statusOptions: Array, // 状态选项列表
  loading: Boolean, // 加载状态
  totalAvailable: Number // 可用房间数
})

// 定义 Emits：支持 v-model 和按钮事件
const emit = defineEmits([
  'update:date',
  'update:type',
  'update:status',
  'search',
  'reset'
])

// 格式化日期显示 (原逻辑迁移至此)
const formattedDate = computed(() => {
  if (!props.date) return ''
  let dateStr = props.date.replace(/\//g, '-') // 兼容处理
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return props.date

  return d.toLocaleDateString('zh-CN', {
    year: 'numeric', month: 'long', day: 'numeric', weekday: 'long'
  })
})

// 简单的图标辅助函数 (如果图标逻辑很简单，可以放这里；如果复杂，建议父组件传 icon 或者保持现状)
const getRoomTypeIcon = (selectedType) => {
  // 这里为了解耦，简单处理：如果有选中，返回默认图标，或者父组件可以通过 slot/props 传递更详细的配置
  // 暂时保留一个默认逻辑，或者你可以把 getRoomTypeIcon 的逻辑通过 composables 引入
  return selectedType ? 'bed' : 'apartment'
}
</script>

<style scoped>
/* 搬运原有的 CSS */
.filters-row .filter-card {
  border-radius: 16px;
  box-shadow: 0 8px 20px rgba(33, 118, 255, 0.08);
  border: 1px solid rgba(229, 232, 236, 0.9);
  background: #fff;
}
.glassy-card {
  border-radius: 16px;
  box-shadow: 0 10px 24px rgba(50, 115, 220, 0.08);
  border: 1px solid rgba(229, 232, 236, 0.9);
}
.filter-input { padding: 0 8px; }
.rounded-popup { border-radius: 12px; }
.search-btn {
  height: 42px;
  border-radius: 12px;
  box-shadow: 0 8px 16px rgba(33, 118, 255, 0.24);
  transition: all 0.2s ease;
}
.search-btn:hover {
  filter: brightness(1.04);
  transform: translateY(-1px);
}
.pill-chip { border-radius: 999px; }
.date-icon-btn { background: #f1f4f9; }
.refresh-btn { border-color: #d3d7dd; }
</style>
