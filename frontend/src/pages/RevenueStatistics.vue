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
                <q-tooltip class="bg-white text-primary" anchor="bottom left" self="top left">
                  按今日开房时间统计
                </q-tooltip>
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
                <q-tooltip class="bg-white text-primary" anchor="bottom left" self="top left">
                  按本周开房时间统计
                </q-tooltip>
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
                <q-tooltip class="bg-white text-primary" anchor="bottom left" self="top left">
                  按本月开房时间统计
                </q-tooltip>
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
            <q-tooltip class="bg-white text-primary" anchor="bottom left" self="top left">
              <div class="text-body2">
                <strong>统计说明</strong>：按开房时间统计收入数据
              </div>
            </q-tooltip>
          </div>
          <div class="chart-container" style="height: 400px;">
            <canvas ref="revenueChart"></canvas>
          </div>
        </q-card-section>
      </q-card>

      <!-- 房型收入分布 -->
      <div class="q-mb-lg">
        <q-card>
          <q-card-section>
            <div class="text-h6 q-mb-md">
              <q-icon name="hotel" class="q-mr-sm" />
              房型收入分布
              <q-tooltip class="bg-white text-primary" anchor="bottom left" self="top left">
                <div class="text-body2">
                  <strong>统计说明</strong>：按开房时间统计房型收入分布
                </div>
              </q-tooltip>
            </div>
            <div class="chart-container" style="height: 300px;">
              <canvas ref="roomTypeChart"></canvas>
            </div>
          </q-card-section>
        </q-card>
      </div>

      <!-- 收款明细表 -->
      <q-card class="q-mb-lg">
        <q-card-section>
          <div class="row items-center justify-between q-mb-md">
            <div class="text-h6">
              <q-icon name="receipt_long" class="q-mr-sm" />
              收款明细表
              <q-tooltip class="bg-white text-primary" anchor="bottom left" self="top left">
                <div class="text-body2">
                  <strong>客房住宿</strong>：跨日期订单或房价>150元<br/>
                  <strong>休息房</strong>：当日订单且房价≤150元<br/>
                  <strong>查询范围</strong>：按开房时间筛选数据
                </div>
              </q-tooltip>
            </div>
            <div class="row q-gutter-xs items-center">
              <div class="receipt-type-buttons">
                <q-btn
                  :color="receiptType === 'hotel' ? 'primary' : 'white'"
                  :text-color="receiptType === 'hotel' ? 'white' : 'primary'"
                  :outline="receiptType !== 'hotel'"
                  unelevated
                  size="sm"
                  label="客房住宿"
                  class="receipt-type-btn receipt-type-btn-left"
                  @click="switchReceiptType('hotel')"
                />
                <q-btn
                  :color="receiptType === 'rest' ? 'primary' : 'white'"
                  :text-color="receiptType === 'rest' ? 'white' : 'primary'"
                  :outline="receiptType !== 'rest'"
                  unelevated
                  size="sm"
                  label="休息房"
                  class="receipt-type-btn receipt-type-btn-right"
                  @click="switchReceiptType('rest')"
                />
              </div>
              <q-btn
                color="primary"
                icon="refresh"
                size="sm"
                round
                @click="refreshReceiptDetails"
                :loading="receiptLoading"
              >
                <q-tooltip>刷新明细</q-tooltip>
              </q-btn>
            </div>
          </div>

          <!-- 日期选择和筛选区域 -->
          <div class="row q-col-gutter-md q-mb-md items-center">
            <div class="col-md-3 col-xs-6">
              <q-input
                v-model="receiptSelectedDate"
                filled
                label="查看日期"
                mask="####-##-##"
                dense
              >
                <template v-slot:append>
                  <q-icon name="event" class="cursor-pointer">
                    <q-popup-proxy cover transition-show="scale" transition-hide="scale">
                      <q-date
                        v-model="receiptSelectedDate"
                        @update:model-value="onReceiptDateChange"
                        :locale="langZhCn.date"
                      >
                        <div class="row items-center justify-end">
                          <q-btn v-close-popup label="确定" color="primary" flat />
                        </div>
                      </q-date>
                    </q-popup-proxy>
                  </q-icon>
                </template>
              </q-input>
            </div>
                         <div class="col-md-6 col-xs-12">
               <div class="row q-gutter-sm receipt-date-controls">
                <q-btn
                  color="primary"
                  icon="today"
                  label="今天"
                  size="sm"
                  @click="setReceiptToday"
                  :disable="receiptLoading"
                />
                <q-btn
                  color="secondary"
                  icon="skip_previous"
                  label="昨天"
                  size="sm"
                  @click="setReceiptYesterday"
                  :disable="receiptLoading"
                />
                <q-btn
                  color="accent"
                  icon="date_range"
                  label="本周"
                  size="sm"
                  @click="setReceiptThisWeek"
                  :disable="receiptLoading"
                />
                <q-btn
                  color="orange"
                  icon="calendar_month"
                  label="本月"
                  size="sm"
                  @click="setReceiptThisMonth"
                  :disable="receiptLoading"
                />
              </div>
            </div>
            <div class="col-md-3 col-xs-12">
              <div class="row q-gutter-sm">

                <q-chip
                  :color="receiptIsToday ? 'positive' : 'info'"
                  text-color="white"
                  icon="date_range"
                  size="sm"
                >
                  {{ formatReceiptDisplayDate(receiptSelectedDate) }}
                </q-chip>
              </div>
            </div>
          </div>

          <!-- 收款明细表格 -->
          <q-table
            :rows="receiptDetails"
            :columns="receiptColumns"
            row-key="id"
            :loading="receiptLoading"
            v-model:pagination="receiptPagination"
            :rows-per-page-options="[10, 20, 50, 100]"
            dense
            flat
            bordered
            class="receipt-table"
          >
            <!-- 自定义支付方式列 -->
            <template v-slot:body-cell-paymentMethod="props">
              <q-td :props="props">
                <q-chip
                  :color="getPaymentMethodColor(props.value)"
                  text-color="white"
                  dense
                  size="sm"
                >
                  {{ props.value }}
                </q-chip>
              </q-td>
            </template>

            <!-- 自定义金额列 -->
            <template v-slot:body-cell-roomFee="props">
              <q-td :props="props" class="text-right">
                <span class="text-weight-medium">¥{{ formatCurrency(props.value) }}</span>
              </q-td>
            </template>

            <template v-slot:body-cell-deposit="props">
              <q-td :props="props" class="text-right">
                <span class="text-weight-medium">¥{{ formatCurrency(props.value) }}</span>
              </q-td>
            </template>

            <template v-slot:body-cell-totalAmount="props">
              <q-td :props="props" class="text-right">
                <span class="text-weight-bold text-primary">¥{{ formatCurrency(props.value) }}</span>
              </q-td>
            </template>

            <!-- 底部汇总行 -->
            <template v-slot:bottom>
              <div class="full-width q-pa-md bg-grey-1">
                <div class="row items-center q-col-gutter-md">
                  <div class="col-12 col-md-6">
                    <div class="text-subtitle2 q-mb-sm">按支付方式统计：</div>
                    <div class="row q-col-gutter-xs">
                      <div v-for="(amount, method) in receiptPaymentSummary" :key="method" class="col-auto">
                        <q-chip
                          :color="getPaymentMethodColor(method)"
                          text-color="white"
                          size="sm"
                        >
                          {{ method }}：¥{{ formatCurrency(amount) }}
                        </q-chip>
                      </div>
                    </div>
                  </div>

                  <div class="col-12 col-md-6">
                    <div class="row items-center justify-end q-gutter-sm">
                      <div class="text-caption text-grey-7 q-mr-md">共 {{ receiptDetails.length }} 条记录</div>
                      <q-select
                        v-model="receiptPagination.rowsPerPage"
                        :options="[10, 20, 50, 100]"
                        dense
                        outlined
                        style="width: 110px"
                        :disable="receiptLoading"
                        :emit-value="true"
                        :map-options="true"
                        :options-dense="true"
                        :popup-content-class="'q-pa-xs'"
                        :display-value="`${receiptPagination.rowsPerPage}/页`"
                      />
                      <q-pagination
                        v-model="receiptPagination.page"
                        :max="receiptMaxPage"
                        max-pages="6"
                        direction-links
                        boundary-links
                        dense
                        :disable="receiptLoading || receiptMaxPage <= 1"
                      />
                    </div>
                    <div class="text-right q-mt-sm">
                      <span class="text-subtitle2">总计：<span class="text-h6 text-primary">¥{{ formatCurrency(receiptTotalAmount) }}</span></span>
                    </div>
                  </div>
                </div>
              </div>
            </template>
          </q-table>
        </q-card-section>
      </q-card>

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
import { ref, computed, onMounted, nextTick, watch } from 'vue'
import { useQuasar, date } from 'quasar'
import { revenueApi, shiftHandoverApi } from '../api/index'
import api from '../api/index'
import Chart from 'chart.js/auto'
import { useViewStore } from '../stores/viewStore'
import langZhCn from 'quasar/lang/zh-CN' // 导入中文语言包

const $q = useQuasar()
const viewStore = useViewStore()

// 响应式数据
const loading = ref(false)
const quickStats = ref({
  today: { total_revenue: 0, total_orders: 0 },
  thisWeek: { total_revenue: 0, total_orders: 0 },
  thisMonth: { total_revenue: 0, total_orders: 0 }
})
const revenueData = ref([])
const roomTypeData = ref([])

// 收款明细表相关数据
const receiptLoading = ref(false)
const importLoading = ref(false)
const receiptType = ref('hotel') // 'hotel' 或 'rest'
const receiptDetails = ref([])
const receiptSelectedDate = ref(date.formatDate(new Date(), 'YYYY-MM-DD')) // 当前选中的日期

// 收款明细分页
const receiptPagination = ref({ page: 1, rowsPerPage: 10 })
const receiptMaxPage = computed(() => {
  const total = receiptDetails.value.length
  const per = receiptPagination.value.rowsPerPage || 10
  return Math.max(1, Math.ceil(total / per))
})

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
const roomTypeChart = ref(null)

// 图表实例
let revenueChartInstance = null
let roomTypeChartInstance = null

// 收款明细表格列定义
const receiptColumns = [
  { name: 'roomNumber', label: '房号', field: 'room_number', align: 'center', style: 'width: 80px' },
  { name: 'guestName', label: '客户姓名', field: 'guest_name', align: 'center', style: 'width: 100px' },
  { name: 'orderNumber', label: '单号', field: 'order_number', align: 'left', style: 'width: 120px' },
  { name: 'roomFee', label: '房费', field: 'room_fee', align: 'right', style: 'width: 100px' },
  { name: 'deposit', label: '押金', field: 'deposit', align: 'right', style: 'width: 100px' },
  {
    name: 'paymentMethod',
    label: '支付方式',
    field: row => viewStore.getPaymentMethodName(row.payment_method) || row.payment_method,
    align: 'center',
    style: 'width: 100px'
  },
  { name: 'totalAmount', label: '总额', field: 'total_amount', align: 'right', style: 'width: 120px' },
  { name: 'stayDate', label: '入住日期', field: 'stay_date_display', align: 'center', style: 'width: 140px' }
]

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
      name: 'bill_count',
      label: '账单数',
      field: 'bill_count',
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
      label: '微邮付收入',
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

// 收款明细表计算属性
const receiptTotalAmount = computed(() => {
  return receiptDetails.value.reduce((sum, item) => sum + (item.total_amount || 0), 0)
})

const receiptPaymentSummary = computed(() => {
  const summary = {}
  receiptDetails.value.forEach(item => {
    const methodValue = item.payment_method || 'cash'
    const methodLabel = viewStore.getPaymentMethodName(methodValue)
    summary[methodLabel] = (summary[methodLabel] || 0) + (item.total_amount || 0)
  })
  return summary
})

// 收款明细表计算属性
const receiptIsToday = computed(() => {
  const today = date.formatDate(new Date(), 'YYYY-MM-DD')
  return receiptSelectedDate.value === today
})

// 工具函数
const formatCurrency = (value) => {
  if (!value) return '0.00'
  return Number(value).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const formatDate = (dateStr) => {
  if (!dateStr) return ''
  // 避免 'YYYY-MM-DD' 被 new Date() 当作 UTC 解析后在负时区减一天
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    // 直接返回或按需要格式化
    const [y,m,d] = dateStr.split('-')
    return `${y}-${m}-${d}`
  }
  try {
    return new Date(dateStr).toLocaleDateString('zh-CN')
  } catch {
    return dateStr
  }
}

// 收款明细表日期格式化
const formatReceiptDisplayDate = (dateStr) => {
  if (!dateStr) return ''
  try {
    return date.formatDate(new Date(dateStr), 'MM-DD')
  } catch (e) {
    return dateStr
  }
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
  console.log('fetchRevenueData 被调用')
  console.log('日期范围检查:', {
    start: dateRange.value.start,
    end: dateRange.value.end
  })

  if (!dateRange.value.start || !dateRange.value.end) {
    console.log('日期范围无效，显示警告')
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
        console.log('调用每日收入API...')
        response = await revenueApi.getDailyRevenue(dateRange.value.start, dateRange.value.end)
        break
      case 'weekly':
        console.log('调用每周收入API...')
        response = await revenueApi.getWeeklyRevenue(dateRange.value.start, dateRange.value.end)
        break
      case 'monthly':
        console.log('调用每月收入API...')
        response = await revenueApi.getMonthlyRevenue(dateRange.value.start, dateRange.value.end)
        break
    }

    console.log('收入数据API响应:', response)
    let raw = response.data || []
    // === 填充缺失日期（仅每日统计）===
    if (selectedPeriod.value === 'daily') {
      const filled = fillMissingDailyData(raw, dateRange.value.start, dateRange.value.end)
      raw = filled
    }
    revenueData.value = raw
    console.log('收入数据设置完成:', revenueData.value.length, '条记录')

    // 获取房型收入数据
    console.log('开始获取房型收入数据...')
    const roomTypeResponse = await revenueApi.getRoomTypeRevenue(dateRange.value.start, dateRange.value.end)
    console.log('房型收入API响应:', roomTypeResponse)
    roomTypeData.value = roomTypeResponse.data || []
    console.log('房型数据设置完成:', roomTypeData.value.length, '条记录')

    // 更新图表
    console.log('开始更新图表...')
    await nextTick()
    updateCharts()
    console.log('图表更新完成')

  } catch (error) {
    console.error('获取收入数据失败:', error)
    console.error('错误详情:', error.response || error.message || error)
    $q.notify({
      type: 'negative',
      message: '获取收入数据失败: ' + (error.message || '未知错误'),
      position: 'top'
    })
  } finally {
    loading.value = false
    console.log('fetchRevenueData 完成')
  }
}

// 生成日期字符串列表 (YYYY-MM-DD) from start to end (inclusive)
const generateDateList = (start, end) => {
  const list = []
  const startDate = new Date(start + 'T00:00:00')
  const endDate = new Date(end + 'T00:00:00')
  for (let d = startDate; d <= endDate; d.setDate(d.getDate() + 1)) {
    list.push(d.toISOString().split('T')[0])
  }
  return list
}

// 填充缺失的每日数据为 0，确保趋势图起止日期与选择一致
const fillMissingDailyData = (rows, start, end) => {
  try {
    console.log('[DEBUG] 原始每日统计 rows 长度:', rows.length)
    if (rows[0]) console.log('[DEBUG] 第一条原始记录:', rows[0])
    const map = new Map()
    rows.forEach(r => {
      const rawDate = r.date || r.day || r.check_in_date
      if (!rawDate) return
      const normalized = typeof rawDate === 'string' ? rawDate.substring(0,10) : new Date(rawDate).toISOString().split('T')[0]
      // 覆盖 date 字段为标准 YYYY-MM-DD，避免后续格式化再次偏差
      const obj = {
        ...r,
        date: normalized,
        order_count: Number(r.order_count || 0),
        total_revenue: Number(r.total_revenue || 0),
        total_room_fee: Number(r.total_room_fee || 0),
        cash_revenue: Number(r.cash_revenue || 0),
        wechat_revenue: Number(r.wechat_revenue || 0),
        alipay_revenue: Number(r.alipay_revenue || 0)
      }
      map.set(normalized, obj)
    })
    const allDates = generateDateList(start, end)
    const filled = allDates.map(d => {
      if (map.has(d)) return map.get(d)
      return {
        date: d,
        order_count: 0,
        total_revenue: 0,
        total_room_fee: 0,
        cash_revenue: 0,
        wechat_revenue: 0,
        alipay_revenue: 0
      }
    })
    // 后端是 DESC，这里保持一致，后续前端仍 reverse() 变升序
    filled.sort((a,b) => a.date < b.date ? 1 : -1)
    const originalHasRevenue = rows.some(r => Number(r.total_revenue) > 0)
    const filledAllZero = filled.every(r => Number(r.total_revenue) === 0)
    console.log(`[DEBUG] originalHasRevenue=${originalHasRevenue} filledAllZero=${filledAllZero}`)
    if (originalHasRevenue && filledAllZero) {
      console.warn('[WARN] 填充后全部为0，回退到原始数据（可能日期键不匹配）')
      return rows
    }
    console.log(`已填充每日缺失数据: 原 ${rows.length} 条 -> 填充后 ${filled.length} 条`)
    return filled
  } catch (e) {
    console.warn('填充缺失日期失败, 使用原始数据:', e)
    return rows
  }
}

// 更新图表
const updateCharts = () => {
  updateRevenueChart()
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
  const bills = revenueData.value.map(item => item.bill_count || 0).reverse()

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
        },
        {
          label: '账单数量',
          data: bills,
          borderColor: 'rgb(255, 152, 0)',
          backgroundColor: 'rgba(255, 152, 0, 0.1)',
          yAxisID: 'y1',
          borderDash: [6,4],
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
              if (context.dataset.label === '收入金额') return `收入: ¥${formatCurrency(context.parsed.y)}`
              if (context.dataset.label === '订单数量') return `订单: ${context.parsed.y}单`
              if (context.dataset.label === '账单数量') return `账单: ${context.parsed.y}张`
              return `${context.dataset.label}: ${context.parsed.y}`
            }
          }
        }
      }
    }
  })
}

// 更新房型收入图表
const updateRoomTypeChart = () => {
  if (!roomTypeChart.value || !roomTypeData.value || roomTypeData.value.length === 0) return
  if (roomTypeChartInstance) roomTypeChartInstance.destroy()
  const ctx = roomTypeChart.value.getContext('2d')
  const labels = roomTypeData.value.map(item => item.type_name || item.room_type)
  const revenues = roomTypeData.value.map(item => item.total_revenue || 0)
  const orders = roomTypeData.value.map(item => item.order_count || 0)
  roomTypeChartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        { label: '收入金额', data: revenues, backgroundColor: 'rgba(25,118,210,0.8)', borderColor: 'rgba(25,118,210,1)', borderWidth: 1, yAxisID: 'y' },
        { label: '订单数量', data: orders, backgroundColor: 'rgba(76,175,80,0.8)', borderColor: 'rgba(76,175,80,1)', borderWidth: 1, yAxisID: 'y1' }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { title: { display: true, text: '房型' } },
        y: { type: 'linear', display: true, position: 'left', title: { display: true, text: '收入金额 (¥)' }, ticks: { callback: v => '¥' + formatCurrency(v) } },
        y1: { type: 'linear', display: true, position: 'right', title: { display: true, text: '订单数量' }, grid: { drawOnChartArea: false } }
      },
      plugins: { tooltip: { callbacks: { label: ctx => ctx.datasetIndex === 0 ? `收入: ¥${formatCurrency(ctx.parsed.y)}` : `订单: ${ctx.parsed.y}单` } } }
    }
  })
}

// 生成示例收款明细数据
const generateSampleReceiptData = (type) => {
  const paymentMethods = ['现金', '微信', '微邮付', '银行卡']
  const guestNames = ['张三', '李四', '王五', '赵六', '孙七', '周八', '吴九', '郑十']

  const sampleData = []
  const isHotel = type === 'hotel'
  const basePrice = isHotel ? 200 : 100
  const count = Math.floor(Math.random() * 8) + 3 // 3-10条记录

  for (let i = 0; i < count; i++) {
    const roomNumber = isHotel ? `${Math.floor(Math.random() * 9) + 1}0${Math.floor(Math.random() * 9) + 1}` : `${Math.floor(Math.random() * 9) + 1}${Math.floor(Math.random() * 9) + 1}${Math.floor(Math.random() * 9) + 1}`
    const guestName = guestNames[Math.floor(Math.random() * guestNames.length)]
    const paymentMethod = paymentMethods[Math.floor(Math.random() * paymentMethods.length)]
    const roomFee = basePrice + Math.floor(Math.random() * 100)
    const deposit = isHotel ? Math.floor(Math.random() * 200) + 100 : Math.floor(Math.random() * 50) + 50

    sampleData.push({
      room_number: roomNumber,
      guest_name: guestName,
      order_number: `ORD${Date.now()}${i}`.substring(0, 12),
      room_fee: roomFee,
      deposit: deposit,
      payment_method: paymentMethod,
      total_amount: roomFee + deposit,
      stay_date: receiptSelectedDate.value
    })
  }

  return sampleData
}

// 获取支付方式对应的颜色
const getPaymentMethodColor = (method) => {
  const colors = {
    [viewStore.paymentMethodOptions[0].label]: 'orange',  // 微邮付
    [viewStore.paymentMethodOptions[1].label]: 'green-7', // 微信
    [viewStore.paymentMethodOptions[2].label]: 'green',   // 现金
    '其他': 'grey'
  }
  return colors[method] || 'grey'
}

// 获取收款明细
const fetchReceiptDetails = async (customStartDate = null, customEndDate = null) => {
  receiptLoading.value = true
  try {
    // 确定查询的日期范围
    let startDate, endDate

    if (customStartDate && customEndDate) {
      // 使用自定义日期范围（用于本周、本月等查询）
      startDate = customStartDate
      endDate = customEndDate
    } else {
      // 使用选中的日期（单天查询）
      try {
        const formattedDate = date.formatDate(new Date(receiptSelectedDate.value), 'YYYY-MM-DD')
        startDate = endDate = formattedDate
      } catch (e) {
        // 如果日期无效，使用今天的日期
        const today = date.formatDate(new Date(), 'YYYY-MM-DD')
        receiptSelectedDate.value = today
        startDate = endDate = today
      }
    }

    const response = await api.get('/revenue-statistics/receipts', {
      params: {
        type: receiptType.value,
        startDate: startDate,
        endDate: endDate
      }
    })

    if (!response.success) {
      throw new Error(response.message || '获取收款明细失败')
    }

    receiptDetails.value = response.data.map(item => {
      const raw = item.stay_date
      let stayDateDisplay = ''
      if (raw) {
        if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
          stayDateDisplay = raw
        } else {
          // ISO 字符串情况，转为本地日期（不受时区减一天影响）
            try {
              const dt = new Date(raw)
              const y = dt.getFullYear()
              const m = String(dt.getMonth()+1).padStart(2,'0')
              const d = String(dt.getDate()).padStart(2,'0')
              stayDateDisplay = `${y}-${m}-${d}`
            } catch { stayDateDisplay = String(raw).substring(0,10) }
        }
      }
      return {
        ...item,
        room_fee: parseFloat(item.room_fee || 0),
        deposit: parseFloat(item.deposit || 0),
        total_amount: parseFloat(item.total_amount || 0),
        guest_name: item.guest_name || '未知客户',
        stay_date_display: stayDateDisplay
      }
    })

    // 重置分页到第一页，避免页码越界
    receiptPagination.value.page = 1

    console.log(`获取到 ${receiptDetails.value.length} 条${receiptType.value === 'hotel' ? '客房' : '休息房'}明细`)
  } catch (error) {
    console.error('获取收款明细失败:', error)
    // 生成示例数据用于演示
    receiptDetails.value = generateSampleReceiptData(receiptType.value)
    $q.notify({
      type: 'warning',
      message: '获取收款明细失败，显示示例数据',
      position: 'top'
    })
  } finally {
    receiptLoading.value = false
  }
}

// 切换收款明细类型
const switchReceiptType = async (type) => {
  if (type && type !== receiptType.value) {
    receiptType.value = type
    await fetchReceiptDetails()
  } else if (!type) {
    // 如果没有传递参数，说明是从 q-btn-toggle 调用的
    await fetchReceiptDetails()
  }
}

// 刷新收款明细
const refreshReceiptDetails = async () => {
  await fetchReceiptDetails()
}

// 收款明细日期变化处理
const onReceiptDateChange = async () => {
  await fetchReceiptDetails()
}

// 快捷日期选择方法
const setReceiptToday = async () => {
  const today = date.formatDate(new Date(), 'YYYY-MM-DD')
  receiptSelectedDate.value = today
  await fetchReceiptDetails()
}

const setReceiptYesterday = async () => {
  const yesterday = date.subtractFromDate(new Date(), { days: 1 })
  receiptSelectedDate.value = date.formatDate(yesterday, 'YYYY-MM-DD')
  await fetchReceiptDetails()
}

const setReceiptThisWeek = async () => {
  const today = new Date()
  const currentDay = today.getDay() // 0为周日，1为周一
  const mondayOffset = currentDay === 0 ? -6 : 1 - currentDay // 计算到周一的偏移

  const monday = date.addToDate(today, { days: mondayOffset })
  const sunday = date.addToDate(monday, { days: 6 })

  const startDate = date.formatDate(monday, 'YYYY-MM-DD')
  const endDate = date.formatDate(sunday, 'YYYY-MM-DD')

  // 设置显示日期为今天
  receiptSelectedDate.value = date.formatDate(new Date(), 'YYYY-MM-DD')
  await fetchReceiptDetails(startDate, endDate)
}

const setReceiptThisMonth = async () => {
  const today = new Date()
  const firstDayOfMonth = date.startOfDate(today, 'month')
  const lastDayOfMonth = date.endOfDate(today, 'month')

  const startDate = date.formatDate(firstDayOfMonth, 'YYYY-MM-DD')
  const endDate = date.formatDate(lastDayOfMonth, 'YYYY-MM-DD')

  // 设置显示日期为今天
  receiptSelectedDate.value = date.formatDate(new Date(), 'YYYY-MM-DD')
  await fetchReceiptDetails(startDate, endDate)
}


// 刷新所有数据
const refreshAllData = async () => {
  await Promise.all([
    fetchQuickStats(),
    fetchRevenueData(),
    fetchReceiptDetails()
  ])
}

// 组件挂载时初始化
onMounted(async () => {
  await fetchQuickStats()
  await fetchRevenueData()
  await fetchReceiptDetails()
})

// ============= 自动刷新逻辑（日期 / 周期变化时自动更新趋势图） =============
const hasMounted = ref(false)
let dateRangeFetchTimer = null

const scheduleRevenueFetch = () => {
  if (!hasMounted.value) return
  if (!dateRange.value.start || !dateRange.value.end) return
  // 避免频繁请求，做简单防抖
  if (dateRangeFetchTimer) clearTimeout(dateRangeFetchTimer)
  dateRangeFetchTimer = setTimeout(() => {
    fetchRevenueData()
  }, 400)
}

watch(() => selectedPeriod.value, () => {
  scheduleRevenueFetch()
})

watch([
  () => dateRange.value.start,
  () => dateRange.value.end
], () => {
  scheduleRevenueFetch()
})

// 将 hasMounted 设为 true，避免初次挂载时 watch 重复触发一次
onMounted(() => {
  hasMounted.value = true
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

/* 收款明细表样式 */
.receipt-table {
  border-radius: 8px;
  overflow: hidden;
}

.receipt-table :deep(.q-table__top) {
  background-color: #f5f5f5;
  padding: 16px;
}

.receipt-table :deep(.q-table__bottom) {
  background-color: #f8f9fa;
  border-top: 1px solid #e0e0e0;
}

.receipt-table :deep(.q-table thead th) {
  background-color: #fafafa;
  font-weight: 600;
  color: #424242;
  padding: 16px 12px;
}

.receipt-table :deep(.q-table tbody tr:hover) {
  background-color: #f5f5f5;
}

.receipt-table :deep(.q-chip) {
  font-weight: 500;
}

.receipt-table :deep(.q-td) {
  padding: 12px;
}

/* 收款明细快捷按钮样式 */
.receipt-table :deep(.q-btn-group) {
  box-shadow: none;
}

.receipt-date-controls .q-btn {
  margin-right: 4px;
  border-radius: 4px;
}

.receipt-date-controls .q-chip {
  margin-left: 8px;
}

/* 收款类型切换按钮样式 */
.receipt-type-buttons {
  display: inline-flex;
  border: 1px solid #1976d2;
  border-radius: 4px;
  overflow: hidden;
}

.receipt-type-btn {
  border-radius: 0 !important;
  border: none !important;
  min-width: 80px;
}

.receipt-type-btn-left {
  border-right: 1px solid #1976d2 !important;
}

.receipt-type-btn:deep(.q-btn__wrapper) {
  padding: 6px 12px;
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
