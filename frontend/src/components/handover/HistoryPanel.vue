<template>
  <div class="history-panel">
        <div class="history-header">
          <div class="text-subtitle2 text-grey-8 q-mb-sm">历史记录</div>
          <q-btn
            color="primary"
            icon="search"
            label="查询"
            size="md"
            class="full-width q-mb-md"
            :loading="isLoading"
            @click="handleSearchHistory"
          />
          <q-btn
            color="secondary"
            icon="refresh"
            label="刷新"
            size="sm"
            class="full-width"
            flat
            :loading="isLoading"
            @click="refreshHistory"
          />
        </div>

        <!-- 统计信息 -->
        <div class="history-stats q-mb-md">
          <q-card flat class="stats-card">
            <q-card-section class="q-pa-sm">
              <div class="text-caption text-grey-7">本月交接</div>
              <div class="text-h6 text-primary">{{ monthlyCount }}次</div>
            </q-card-section>
          </q-card>
        </div>

    <div class="history-list">
      <div v-if="!hasHistoryRecords && !isLoading" class="no-records">
        <q-icon name="history" size="md" color="grey-5" />
        <div class="text-caption text-grey-5 q-mt-xs">暂无历史记录</div>
      </div>

      <q-card
        v-for="record in historyRecords"
        :key="record.id"
        class="history-item q-mb-sm"
        flat
        bordered
        clickable
        @click="handleSelectRecord(record)"
      >
        <q-card-section class="q-pa-sm">
          <div class="text-caption text-grey-7">
            {{ formatDate(record.date) }}
          </div>
          <div class="text-caption text-grey-6">
            {{ record.operator }}
          </div>
        </q-card-section>
      </q-card>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useQuasar } from 'quasar'

// 响应式状态
const $q = useQuasar()
const isLoading = ref(false)
const historyRecords = ref([
  {
    id: 1,
    date: '2024-01-15',
    operator: '张三'
  },
  {
    id: 2,
    date: '2024-01-14',
    operator: '李四'
  },
  {
    id: 3,
    date: '2024-01-14',
    operator: '王五'
  }
])

// 计算属性
const hasHistoryRecords = computed(() => historyRecords.value.length > 0)

const monthlyCount = computed(() => {
  const currentMonth = new Date().getMonth()
  const currentYear = new Date().getFullYear()

  return historyRecords.value.filter(record => {
    const recordDate = new Date(record.date)
    return recordDate.getMonth() === currentMonth && recordDate.getFullYear() === currentYear
  }).length
})

// 工具函数
const formatDate = (dateString) => {
  const date = new Date(dateString)
  return `${date.getMonth() + 1}/${date.getDate()}`
}

// 搜索历史记录
const handleSearchHistory = async () => {
  try {
    isLoading.value = true
    $q.notify({
      type: 'info',
      message: '正在查询历史记录...',
      position: 'top'
    })

    // 这里可以添加实际的API调用
    // const response = await api.getHandoverHistory()
    // historyRecords.value = response.data

    // 模拟API调用延迟
    await new Promise(resolve => setTimeout(resolve, 1000))

    // 模拟添加新的历史记录
    const newRecord = {
      id: Date.now(),
      date: new Date().toISOString().split('T')[0],
      operator: '系统管理员'
    }
    historyRecords.value.unshift(newRecord)

    $q.notify({
      type: 'positive',
      message: '历史记录已更新',
      position: 'top'
    })
  } catch (error) {
    $q.notify({
      type: 'negative',
      message: '查询失败，请重试',
      position: 'top'
    })
  } finally {
    isLoading.value = false
  }
}

// 定义事件
const emit = defineEmits(['select-record'])

// 选择历史记录
const handleSelectRecord = (record) => {
  $q.notify({
    type: 'info',
    message: `查看 ${record.date} ${record.operator} 的交接记录`,
    position: 'top'
  })

  // 发送事件到父组件
  console.log('Selected record:', record)
  emit('select-record', record)
}

// 删除历史记录
const deleteRecord = (recordId) => {
  const index = historyRecords.value.findIndex(record => record.id === recordId)
  if (index > -1) {
    historyRecords.value.splice(index, 1)
    $q.notify({
      type: 'positive',
      message: '记录已删除',
      position: 'top'
    })
  }
}

// 刷新历史记录
const refreshHistory = async () => {
  isLoading.value = true
  try {
    // 模拟API调用
    await new Promise(resolve => setTimeout(resolve, 500))

    $q.notify({
      type: 'positive',
      message: '历史记录已刷新',
      position: 'top'
    })
  } catch (error) {
    $q.notify({
      type: 'negative',
      message: '刷新失败',
      position: 'top'
    })
  } finally {
    isLoading.value = false
  }
}

// 生命周期钩子
onMounted(() => {
  console.log('HistoryPanel mounted')
  // 组件挂载时自动加载历史记录
  refreshHistory()
})
</script>

<style scoped>
.history-panel {
  background-color: #f5f5f5;
  padding: 16px 8px;
  border-right: 1px solid #e0e0e0;
  height: 100vh;
}

.history-header {
  margin-bottom: 16px;
}

.history-stats {
  margin-bottom: 12px;
}

.stats-card {
  background: rgba(255, 255, 255, 0.8);
  border-radius: 8px;
  border: 1px solid rgba(25, 118, 210, 0.2);
}

.history-list {
  max-height: calc(100vh - 120px);
  overflow-y: auto;
}

.history-item {
  cursor: pointer;
  transition: all 0.2s ease;
}

.history-item:hover {
  background-color: #e3f2fd;
  transform: translateX(2px);
}

.no-records {
  text-align: center;
  padding: 24px 8px;
  color: #9e9e9e;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .history-panel {
    padding: 8px 4px;
  }
}
</style>
