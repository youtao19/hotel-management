<template>
  <div>
    <q-card class="q-mb-lg daily-card">
      <q-card-section>
        <div class="row items-center justify-between q-mb-md daily-card__header">
          <div class="col-auto">
            <div class="daily-card__title">
              每日营收明细
              <span class="text-caption text-grey-7">({{ roomType || '全部房型' }})</span>
            </div>
          </div>
          <div class="col-auto">
            <q-input
              v-model="searchKeyword"
              dense outlined
              placeholder="搜索房间号..."
              class="daily-card__search"
            >
              <template #prepend><q-icon name="search" /></template>
            </q-input>
          </div>
        </div>

        <q-table
          :rows="filteredRows"
          :columns="columns"
          :loading="loading"
          row-key="id"
          class="receipt-table react-daily-table"
          flat
          :pagination="{ rowsPerPage: 10 }"
        >
          <template #body-cell-paymentMethod="props">
            <q-td :props="props">
              <q-chip
                :color="getPayColor(props.value)"
                text-color="white"
                dense size="sm"
              >
                {{ props.value }}
              </q-chip>
            </q-td>
          </template>

          <template #body-cell-roomNumber="props">
            <q-td :props="props">
              <div class="daily-room-pill">{{ props.value }}</div>
            </q-td>
          </template>

          <template #body-cell-totalAmount="props">
            <q-td :props="props" class="text-right">
              <span class="text-weight-bold text-dark">¥{{ Number(props.value).toFixed(2) }}</span>
            </q-td>
          </template>
        </q-table>
      </q-card-section>
    </q-card>

    <q-card class="trend-card">
      <q-card-section>
        <div class="chart-container" style="height: 400px;">
          <canvas ref="chartRef"></canvas>
        </div>
      </q-card-section>
    </q-card>
  </div>
</template>

<script setup>
import { ref, watch, onMounted, nextTick } from 'vue'
import Chart from 'chart.js/auto'
// 引入刚刚创建的文件
import { useDailyReceipts } from '../composables/useDailyReceipts'

const props = defineProps(['dateRange', 'roomType', 'revenueData', 'periodLabel'])

// --- 使用 Hook 接管表格逻辑 ---
const {
  loading,
  filteredRows,
  searchKeyword,
  columns,
  fetchReceipts,
  getPayColor
} = useDailyReceipts()

// --- 图表逻辑 (Chart.js) ---
const chartRef = ref(null)
let chartInstance = null

const renderChart = () => {
  if (!chartRef.value || !props.revenueData) return
  if (chartInstance) chartInstance.destroy()

  const ctx = chartRef.value.getContext('2d')

  // 简单的数据映射
  const labels = props.revenueData.map(i => {
    // 处理不同周期的日期显示（后端返回的字段决定显示方式）
    if (i.week_start && i.week_end) return `${String(i.week_start).substring(5, 10)}-${String(i.week_end).substring(5, 10)}`
    if (i.month_start) return String(i.month_start).substring(0, 7)
    return i.date ? String(i.date).substring(5, 10) : ''
  }).reverse()

  const data = props.revenueData.map(i => i.total_revenue).reverse()

  chartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: '收入',
        data,
        borderColor: '#6366f1',
        backgroundColor: 'rgba(99, 102, 241, 0.1)',
        tension: 0.4,
        fill: true
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true } }
    }
  })
}

// --- 监听器 ---

// 1. 监听日期变化 -> 刷新表格
watch(() => [props.dateRange, props.roomType], ([newRange, newType]) => {
  if (newRange.start && newRange.end) {
    fetchReceipts(newRange.start, newRange.end, newType)
  }
}, { deep: true, immediate: true })

// 2. 监听数据变化 -> 刷新图表
watch(() => props.revenueData, () => {
  nextTick(renderChart)
}, { deep: true })

onMounted(() => {
  // 初始化图表
  renderChart()
})
</script>

<style scoped>
/* 保持原有的样式 */
.daily-room-pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 40px;
  padding: 6px 10px;
  border-radius: 12px;
  background-color: #e5edf8;
  color: #0f172a;
  font-weight: 700;
  font-size: 13px;
}
</style>
