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
              <div class="text-caption text-grey-7">可用日期</div>
              <div class="text-h6 text-primary">{{ availableDates.length }}个</div>
            </q-card-section>
          </q-card>
          <q-card flat class="stats-card q-mt-xs">
            <q-card-section class="q-pa-sm">
              <div class="text-caption text-grey-7">本月交接</div>
              <div class="text-h6 text-secondary">{{ monthlyCount }}次</div>
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
          <div class="row items-center justify-between q-mb-xs">
            <div class="text-body2 text-primary">{{ record.date }}</div>
            <q-chip
              size="sm"
              color="positive"
              text-color="white"
              :label="`${record.paymentCount}种支付`"
            />
          </div>
          <div class="text-caption text-grey-7 q-mb-xs">
            <q-icon name="person" size="xs" class="q-mr-xs"/>
            {{ record.operator }}
          </div>
          <div v-if="record.vipCards > 0" class="text-caption text-orange-7">
            <q-icon name="card_membership" size="xs" class="q-mr-xs"/>
            VIP卡: {{ record.vipCards }}
          </div>
          <div v-if="record.taskList && record.taskList.length > 0" class="text-caption text-blue-7">
            <q-icon name="task_alt" size="xs" class="q-mr-xs"/>
            {{ record.taskList.length }} 条备忘录
          </div>
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

// 刷新历史记录
const refreshHistory = async () => {
  isLoading.value = true
  try {
    // 同时获取历史记录和可用日期
    await Promise.all([
      handleSearchHistory(),
      loadAvailableDates()
    ])

    $q.notify({
      type: 'positive',
      message: '历史记录已刷新',
      position: 'top'
    })
  } catch (error) {
    console.error('刷新历史记录失败:', error)
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
