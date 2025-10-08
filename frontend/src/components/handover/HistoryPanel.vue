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
        </div>

        <!-- 统计信息 -->


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
          <div class="text-body2 text-primary q-mb-xs">{{ record.date }}</div>
        </q-card-section>
      </q-card>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useQuasar } from 'quasar'
import { shiftHandoverApi } from '../../api/index.js'

// 响应式状态
const $q = useQuasar()
const isLoading = ref(false)
const historyRecords = ref([])
const availableDates = ref([])

// 计算属性
const hasHistoryRecords = computed(() => historyRecords.value.length > 0)


// 搜索历史记录
const handleSearchHistory = async () => {
  try {
    isLoading.value = true
    $q.notify({
      type: 'info',
      message: '正在查询交接班历史记录...',
      position: 'top'
    })

    // 调用后端API查询所有交接班记录
    const response = await shiftHandoverApi.queryHandoverRecords()

    if (response.success) {
      // 将后端返回的数据转换为前端需要的格式
      historyRecords.value = response.data.map(record => ({
        id: record.date, // 使用日期作为唯一标识
        date: record.date,
        operator: record.handoverPerson ? `${record.handoverPerson} → ${record.takeoverPerson}` : '未知',
        handoverPerson: record.handoverPerson,
        takeoverPerson: record.takeoverPerson,
        vipCards: record.vipCards,
        taskList: record.taskList,
        remarks: record.remarks,
        paymentCount: record.paymentCount
      }))

      $q.notify({
        type: 'positive',
        message: `查询成功，找到 ${historyRecords.value.length} 条交接班记录`,
        position: 'top'
      })
    } else {
      throw new Error(response.message || '查询失败')
    }
  } catch (error) {
    console.error('查询交接班历史记录失败:', error)
    $q.notify({
      type: 'negative',
      message: error.message || '查询失败，请重试',
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
  // 发送事件到父组件
  console.log('Selected record:', record)
  emit('select-record', record)
}


// 获取可用日期
const loadAvailableDates = async () => {
  try {
    const response = await shiftHandoverApi.getAvailableHandoverDates()
    if (response.success) {
      availableDates.value = response.data
      console.log('可用的交接班日期:', availableDates.value)
    }
  } catch (error) {
    console.error('获取可用日期失败:', error)
  }
}



// 生命周期钩子
onMounted(() => {
  console.log('HistoryPanel mounted')
  // 组件挂载时自动加载可用日期
  loadAvailableDates()
})
</script>

<style scoped>
.history-panel {
  background-color: #f5f5f5;
  padding: 16px 8px;
  border-right: 1px solid #e0e0e0;
  height: 100vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.history-header {
  margin-bottom: 16px;
  flex-shrink: 0;
}

.history-stats {
  margin-bottom: 12px;
  flex-shrink: 0;
}

.stats-card {
  background: rgba(255, 255, 255, 0.8);
  border-radius: 8px;
  border: 1px solid rgba(25, 118, 210, 0.2);
}

.history-list {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding-right: 4px;
}

/* 自定义滚动条样式 */
.history-list::-webkit-scrollbar {
  width: 6px;
}

.history-list::-webkit-scrollbar-track {
  background: rgba(0, 0, 0, 0.05);
  border-radius: 3px;
}

.history-list::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.2);
  border-radius: 3px;
}

.history-list::-webkit-scrollbar-thumb:hover {
  background: rgba(0, 0, 0, 0.3);
}

.history-item {
  cursor: pointer;
  transition: all 0.2s ease;
}

.history-item:hover {
  background-color: #e3f2fd;
  transform: translateX(2px);
}

.operator-line {
  display: flex;
  align-items: center;
  white-space: nowrap;
  overflow: hidden;
}

.operator-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
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
