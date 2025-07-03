<template>
  <q-page class="revenue-statistics">
    <div class="q-pa-md">
      <!-- 页面标题 -->
      <div class="row items-center q-mb-lg">
        <div class="col">
          <h1 class="text-h4 q-mb-none">收入统计</h1>
          <p class="text-subtitle1 text-grey-7 q-mb-none">酒店营收数据分析与统计</p>
        </div>
        <div class="col-auto">
          <q-btn
            color="primary"
            icon="refresh"
            label="刷新数据"
            @click="refreshAllData"
            :loading="loading"
          />
        </div>
      </div>

      <!-- 快速统计卡片 -->
      <div class="row q-col-gutter-md q-mb-lg">
        <div class="col-lg-4 col-md-6 col-sm-12">
          <q-card class="quick-stats-card">
            <q-card-section class="bg-primary text-white">
              <div class="text-h6">
                <q-icon name="today" class="q-mr-sm" />
                今日收入
              </div>
            </q-card-section>
            <q-card-section class="text-center">
              <div class="text-h3 text-primary">¥{{ formatCurrency(quickStats.today?.total_revenue || 0) }}</div>
              <div class="text-caption text-grey-7">订单数: {{ quickStats.today?.total_orders || 0 }}</div>
            </q-card-section>
          </q-card>
        </div>

        <div class="col-lg-4 col-md-6 col-sm-12">
          <q-card class="quick-stats-card">
            <q-card-section class="bg-green text-white">
              <div class="text-h6">
                <q-icon name="date_range" class="q-mr-sm" />
                本周收入
              </div>
            </q-card-section>
            <q-card-section class="text-center">
              <div class="text-h3 text-green">¥{{ formatCurrency(quickStats.thisWeek?.total_revenue || 0) }}</div>
              <div class="text-caption text-grey-7">订单数: {{ quickStats.thisWeek?.total_orders || 0 }}</div>
            </q-card-section>
          </q-card>
        </div>

        <div class="col-lg-4 col-md-6 col-sm-12">
          <q-card class="quick-stats-card">
            <q-card-section class="bg-orange text-white">
              <div class="text-h6">
                <q-icon name="calendar_month" class="q-mr-sm" />
                本月收入
              </div>
            </q-card-section>
            <q-card-section class="text-center">
              <div class="text-h3 text-orange">¥{{ formatCurrency(quickStats.thisMonth?.total_revenue || 0) }}</div>
              <div class="text-caption text-grey-7">订单数: {{ quickStats.thisMonth?.total_orders || 0 }}</div>
            </q-card-section>
          </q-card>
        </div>
      </div>

      <!-- 筛选器 -->
      <q-card flat bordered class="q-mb-lg">
        <q-card-section>
          <div class="row q-col-gutter-md items-end">
            <div class="col-lg-3 col-md-4 col-sm-6 col-xs-12">
              <q-input
                v-model="dateRange.start"
                type="date"
                label="开始日期"
                outlined
                dense
              />
            </div>
            <div class="col-lg-3 col-md-4 col-sm-6 col-xs-12">
              <q-input
                v-model="dateRange.end"
                type="date"
                label="结束日期"
                outlined
                dense
              />
            </div>
            <div class="col-lg-3 col-md-4 col-sm-6 col-xs-12">
              <q-select
                v-model="selectedPeriod"
                :options="periodOptions"
                label="统计周期"
                outlined
                dense
                emit-value
                map-options
              />
            </div>
            <div class="col-lg-3 col-md-12 col-sm-6 col-xs-12">
              <q-btn
                color="primary"
                icon="search"
                label="查询"
                @click="fetchRevenueData"
                :loading="loading"
                class="full-width"
              />
            </div>
          </div>
        </q-card-section>
      </q-card>

      <!-- 收入趋势图表 -->
      <q-card class="q-mb-lg">
        <q-card-section>
          <div class="text-h6 q-mb-md">
            <q-icon name="trending_up" class="q-mr-sm" />
            收入趋势图
          </div>
          <div class="chart-container" style="height: 400px;">
            <canvas ref="revenueChart"></canvas>
          </div>
        </q-card-section>
      </q-card>

      <!-- 支付方式统计 -->
      <div class="row q-col-gutter-md q-mb-lg">
        <div class="col-lg-6 col-md-12">
          <q-card>
            <q-card-section>
              <div class="text-h6 q-mb-md">
                <q-icon name="payment" class="q-mr-sm" />
                支付方式分布
              </div>
              <div class="chart-container" style="height: 300px;">
                <canvas ref="paymentChart"></canvas>
              </div>
            </q-card-section>
          </q-card>
        </div>

        <div class="col-lg-6 col-md-12">
          <q-card>
            <q-card-section>
              <div class="text-h6 q-mb-md">
                <q-icon name="hotel" class="q-mr-sm" />
                房型收入分布
              </div>
              <div class="chart-container" style="height: 300px;">
                <canvas ref="roomTypeChart"></canvas>
              </div>
            </q-card-section>
          </q-card>
        </div>
      </div>

      <!-- 详细数据表格 -->
      <q-card>
        <q-card-section>
          <div class="text-h6 q-mb-md">
            <q-icon name="table_chart" class="q-mr-sm" />
            详细收入数据
          </div>

          <q-table
            :rows="revenueData"
            :columns="tableColumns"
            row-key="date"
            :loading="loading"
            :pagination="{ rowsPerPage: 10 }"
            class="revenue-table"
          >
            <template v-slot:body-cell-total_revenue="props">
              <q-td :props="props">
                <span class="text-weight-bold text-positive">
                  ¥{{ formatCurrency(props.value) }}
                </span>
              </q-td>
            </template>

            <template v-slot:body-cell-order_count="props">
              <q-td :props="props">
                <q-chip color="primary" text-color="white" size="sm">
                  {{ props.value }}
                </q-chip>
              </q-td>
            </template>
          </q-table>
        </q-card-section>
      </q-card>
    </div>
  </q-page>
</template>

<script setup>
import { ref, computed, onMounted, nextTick } from 'vue'
import { useQuasar } from 'quasar'
import { revenueApi } from '../api/index'
import Chart from 'chart.js/auto'

const $q = useQuasar()

// 响应式数据
const loading = ref(false)
const quickStats = ref({
  today: { total_revenue: 0, total_orders: 0 },
  thisWeek: { total_revenue: 0, total_orders: 0 },
  thisMonth: { total_revenue: 0, total_orders: 0 }
})
const revenueData = ref([])
const roomTypeData = ref([])

// 日期范围
const dateRange = ref({
  start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 30天前
  end: new Date().toISOString().split('T')[0] // 今天
})

// 统计周期选项
const selectedPeriod = ref('daily')
const periodOptions = [
  { label: '每日统计', value: 'daily' },
  { label: '每周统计', value: 'weekly' },
  { label: '每月统计', value: 'monthly' }
]

// 图表引用
const revenueChart = ref(null)
const paymentChart = ref(null)
const roomTypeChart = ref(null)

// 图表实例
let revenueChartInstance = null
let paymentChartInstance = null
let roomTypeChartInstance = null

// 表格列定义
const tableColumns = computed(() => {
  const baseColumns = [
    {
      name: 'date',
      label: '日期',
      field: 'date',
      align: 'left',
      format: (val) => formatDate(val)
    },
    {
      name: 'order_count',
      label: '订单数',
      field: 'order_count',
      align: 'center'
    },
    {
      name: 'total_revenue',
      label: '总收入',
      field: 'total_revenue',
      align: 'right'
    },
    {
      name: 'total_room_fee',
      label: '房费收入',
      field: 'total_room_fee',
      align: 'right',
      format: (val) => `¥${formatCurrency(val || 0)}`
    },
    {
      name: 'cash_revenue',
      label: '现金收入',
      field: 'cash_revenue',
      align: 'right',
      format: (val) => `¥${formatCurrency(val || 0)}`
    },
    {
      name: 'wechat_revenue',
      label: '微信收入',
      field: 'wechat_revenue',
      align: 'right',
      format: (val) => `¥${formatCurrency(val || 0)}`
    },
    {
      name: 'alipay_revenue',
      label: '支付宝收入',
      field: 'alipay_revenue',
      align: 'right',
      format: (val) => `¥${formatCurrency(val || 0)}`
    }
  ]

  // 根据统计周期调整列
  if (selectedPeriod.value === 'weekly') {
    baseColumns[0] = {
      name: 'week',
      label: '周期',
      field: row => `${row.year}年第${row.week_number}周`,
      align: 'left'
    }
  } else if (selectedPeriod.value === 'monthly') {
    baseColumns[0] = {
      name: 'month',
      label: '月份',
      field: row => `${row.year}年${row.month}月`,
      align: 'left'
    }
  }

  return baseColumns
})

// 工具函数
const formatCurrency = (value) => {
  if (!value) return '0.00'
  return Number(value).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const formatDate = (dateStr) => {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleDateString('zh-CN')
}

// 获取快速统计数据
const fetchQuickStats = async () => {
  try {
    console.log('开始获取快速统计数据...')
    const response = await revenueApi.getQuickStats()
    console.log('快速统计API响应:', response)
    quickStats.value = response.data || {
      today: { total_revenue: 0, total_orders: 0 },
      thisWeek: { total_revenue: 0, total_orders: 0 },
      thisMonth: { total_revenue: 0, total_orders: 0 }
    }
    console.log('快速统计数据设置完成:', quickStats.value)
  } catch (error) {
    console.error('获取快速统计数据失败:', error)
    $q.notify({
      type: 'negative',
      message: '获取快速统计数据失败',
      position: 'top'
    })
  }
}

// 获取收入数据
const fetchRevenueData = async () => {
  if (!dateRange.value.start || !dateRange.value.end) {
    $q.notify({
      type: 'warning',
      message: '请选择日期范围',
      position: 'top'
    })
    return
  }

  loading.value = true
  try {
    console.log('开始获取收入数据...', {
      period: selectedPeriod.value,
      startDate: dateRange.value.start,
      endDate: dateRange.value.end
    })

    let response
    switch (selectedPeriod.value) {
      case 'daily':
        response = await revenueApi.getDailyRevenue(dateRange.value.start, dateRange.value.end)
        break
      case 'weekly':
        response = await revenueApi.getWeeklyRevenue(dateRange.value.start, dateRange.value.end)
        break
      case 'monthly':
        response = await revenueApi.getMonthlyRevenue(dateRange.value.start, dateRange.value.end)
        break
    }

    console.log('收入数据API响应:', response)
    revenueData.value = response.data || []
    console.log('收入数据设置完成:', revenueData.value.length, '条记录')

    // 获取房型收入数据
    const roomTypeResponse = await revenueApi.getRoomTypeRevenue(dateRange.value.start, dateRange.value.end)
    console.log('房型收入API响应:', roomTypeResponse)
    roomTypeData.value = roomTypeResponse.data || []
    console.log('房型数据设置完成:', roomTypeData.value.length, '条记录')

    // 更新图表
    await nextTick()
    updateCharts()

  } catch (error) {
    console.error('获取收入数据失败:', error)
    $q.notify({
      type: 'negative',
      message: '获取收入数据失败',
      position: 'top'
    })
  } finally {
    loading.value = false
  }
}

// 更新图表
const updateCharts = () => {
  updateRevenueChart()
  updatePaymentChart()
  updateRoomTypeChart()
}

// 更新收入趋势图表
const updateRevenueChart = () => {
  if (!revenueChart.value || !revenueData.value || revenueData.value.length === 0) return

  // 销毁现有图表
  if (revenueChartInstance) {
    revenueChartInstance.destroy()
  }

  const ctx = revenueChart.value.getContext('2d')

  // 准备数据
  const labels = revenueData.value.map(item => {
    if (selectedPeriod.value === 'weekly') {
      return `第${item.week_number}周`
    } else if (selectedPeriod.value === 'monthly') {
      return `${item.month}月`
    } else {
      return formatDate(item.date)
    }
  }).reverse()

  const revenues = revenueData.value.map(item => item.total_revenue || 0).reverse()
  const orders = revenueData.value.map(item => item.order_count || 0).reverse()

  revenueChartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [
        {
          label: '收入金额',
          data: revenues,
          borderColor: 'rgb(25, 118, 210)',
          backgroundColor: 'rgba(25, 118, 210, 0.1)',
          yAxisID: 'y',
          tension: 0.4
        },
        {
          label: '订单数量',
          data: orders,
          borderColor: 'rgb(76, 175, 80)',
          backgroundColor: 'rgba(76, 175, 80, 0.1)',
          yAxisID: 'y1',
          tension: 0.4
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false,
      },
      scales: {
        x: {
          display: true,
          title: {
            display: true,
            text: '时间'
          }
        },
        y: {
          type: 'linear',
          display: true,
          position: 'left',
          title: {
            display: true,
            text: '收入金额 (¥)'
          },
          ticks: {
            callback: function(value) {
              return '¥' + formatCurrency(value)
            }
          }
        },
        y1: {
          type: 'linear',
          display: true,
          position: 'right',
          title: {
            display: true,
            text: '订单数量'
          },
          grid: {
            drawOnChartArea: false,
          },
        }
      },
      plugins: {
        tooltip: {
          callbacks: {
            label: function(context) {
              if (context.datasetIndex === 0) {
                return `收入: ¥${formatCurrency(context.parsed.y)}`
              } else {
                return `订单: ${context.parsed.y}单`
              }
            }
          }
        }
      }
    }
  })
}

// 更新支付方式图表
const updatePaymentChart = () => {
  if (!paymentChart.value || !revenueData.value || revenueData.value.length === 0) return

  // 销毁现有图表
  if (paymentChartInstance) {
    paymentChartInstance.destroy()
  }

  const ctx = paymentChart.value.getContext('2d')

  // 计算支付方式总收入
  const paymentData = revenueData.value.reduce((acc, item) => {
    acc.cash += item.cash_revenue || 0
    acc.wechat += item.wechat_revenue || 0
    acc.alipay += item.alipay_revenue || 0
    acc.credit_card += item.credit_card_revenue || 0
    return acc
  }, { cash: 0, wechat: 0, alipay: 0, credit_card: 0 })

  paymentChartInstance = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['现金', '微信', '支付宝', '信用卡'],
      datasets: [{
        data: [paymentData.cash, paymentData.wechat, paymentData.alipay, paymentData.credit_card],
        backgroundColor: [
          'rgba(76, 175, 80, 0.8)',
          'rgba(76, 175, 80, 0.6)',
          'rgba(25, 118, 210, 0.8)',
          'rgba(255, 152, 0, 0.8)'
        ],
        borderColor: [
          'rgba(76, 175, 80, 1)',
          'rgba(76, 175, 80, 0.8)',
          'rgba(25, 118, 210, 1)',
          'rgba(255, 152, 0, 1)'
        ],
        borderWidth: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        tooltip: {
          callbacks: {
            label: function(context) {
              const value = context.parsed
              const total = context.dataset.data.reduce((a, b) => a + b, 0)
              const percentage = ((value / total) * 100).toFixed(1)
              return `${context.label}: ¥${formatCurrency(value)} (${percentage}%)`
            }
          }
        },
        legend: {
          position: 'bottom'
        }
      }
    }
  })
}

// 更新房型收入图表
const updateRoomTypeChart = () => {
  if (!roomTypeChart.value || !roomTypeData.value || roomTypeData.value.length === 0) return

  // 销毁现有图表
  if (roomTypeChartInstance) {
    roomTypeChartInstance.destroy()
  }

  const ctx = roomTypeChart.value.getContext('2d')

  const labels = roomTypeData.value.map(item => item.type_name || item.room_type)
  const revenues = roomTypeData.value.map(item => item.total_revenue || 0)
  const orders = roomTypeData.value.map(item => item.order_count || 0)

  roomTypeChartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [
        {
          label: '收入金额',
          data: revenues,
          backgroundColor: 'rgba(25, 118, 210, 0.8)',
          borderColor: 'rgba(25, 118, 210, 1)',
          borderWidth: 1,
          yAxisID: 'y'
        },
        {
          label: '订单数量',
          data: orders,
          backgroundColor: 'rgba(76, 175, 80, 0.8)',
          borderColor: 'rgba(76, 175, 80, 1)',
          borderWidth: 1,
          yAxisID: 'y1'
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          title: {
            display: true,
            text: '房型'
          }
        },
        y: {
          type: 'linear',
          display: true,
          position: 'left',
          title: {
            display: true,
            text: '收入金额 (¥)'
          },
          ticks: {
            callback: function(value) {
              return '¥' + formatCurrency(value)
            }
          }
        },
        y1: {
          type: 'linear',
          display: true,
          position: 'right',
          title: {
            display: true,
            text: '订单数量'
          },
          grid: {
            drawOnChartArea: false,
          }
        }
      },
      plugins: {
        tooltip: {
          callbacks: {
            label: function(context) {
              if (context.datasetIndex === 0) {
                return `收入: ¥${formatCurrency(context.parsed.y)}`
              } else {
                return `订单: ${context.parsed.y}单`
              }
            }
          }
        }
      }
    }
  })
}

// 刷新所有数据
const refreshAllData = async () => {
  await Promise.all([
    fetchQuickStats(),
    fetchRevenueData()
  ])
}

// 组件挂载时初始化
onMounted(async () => {
  await fetchQuickStats()
  await fetchRevenueData()
})
</script>

<style scoped>
.revenue-statistics {
  max-width: 100%;
  background-color: #f5f5f5;
  min-height: 100vh;
}

.quick-stats-card {
  height: 140px;
  transition: transform 0.3s ease, box-shadow 0.3s ease;
  border-radius: 12px;
  overflow: hidden;
}

.quick-stats-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.15);
}

.chart-container {
  position: relative;
  background: white;
  border-radius: 8px;
  padding: 16px;
}

.revenue-table {
  border-radius: 8px;
}

/* 卡片样式优化 */
.q-card {
  border-radius: 12px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
  transition: box-shadow 0.3s ease;
}

.q-card:hover {
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.12);
}

/* 标题样式 */
.text-h4 {
  color: #1976d2;
  font-weight: 600;
}

.text-subtitle1 {
  margin-top: 4px;
}

/* 快速统计数字样式 */
.text-h3 {
  font-weight: 700;
  margin: 8px 0;
}

/* 筛选器样式 */
.q-input, .q-select {
  background: white;
}

/* 图表容器样式 */
.chart-container canvas {
  border-radius: 4px;
}

/* 表格样式优化 */
.revenue-table :deep(.q-table__top) {
  padding: 16px;
  background: #f8f9fa;
  border-radius: 8px 8px 0 0;
}

.revenue-table :deep(.q-table__bottom) {
  border-radius: 0 0 8px 8px;
}

.revenue-table :deep(.q-td) {
  padding: 12px 16px;
}

.revenue-table :deep(.q-th) {
  padding: 16px;
  font-weight: 600;
  color: #1976d2;
  background: #f8f9fa;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .quick-stats-card {
    height: 120px;
  }

  .text-h3 {
    font-size: 1.8rem;
  }

  .chart-container {
    padding: 12px;
  }
}

@media (max-width: 480px) {
  .revenue-statistics {
    padding: 8px;
  }

  .quick-stats-card {
    height: 100px;
  }

  .text-h3 {
    font-size: 1.5rem;
  }
}

/* 加载状态样式 */
.q-btn--loading {
  pointer-events: none;
}

/* 图标样式 */
.q-icon {
  vertical-align: middle;
}

/* 芯片样式 */
.q-chip {
  font-weight: 500;
}

/* 动画效果 */
@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.q-card {
  animation: fadeIn 0.6s ease-out;
}

/* 滚动条样式 */
:deep(.q-table__container) {
  border-radius: 8px;
}

:deep(.q-table__container)::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

:deep(.q-table__container)::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 4px;
}

:deep(.q-table__container)::-webkit-scrollbar-thumb {
  background: #c1c1c1;
  border-radius: 4px;
}

:deep(.q-table__container)::-webkit-scrollbar-thumb:hover {
  background: #a8a8a8;
}
</style>
