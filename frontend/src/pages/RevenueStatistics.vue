<template>
  <q-page class="revenue-statistics">
    <div class="q-pa-md">
      <!-- 页面标题 -->
      <div class="row items-center q-mb-lg">
        <div class="col">
          <h1 class="text-h4 q-mb-none">收入统计</h1>
          <p class="text-subtitle1 text-grey-7 q-mb-none">酒店营收数据分析与统计</p>
        </div>
      </div>

      <!-- 快速统计卡片（方案 A: 现代商务风格） -->
      <div class="row q-col-gutter-md q-mb-lg">
        <div class="col-lg-4 col-md-6 col-sm-12">
          <q-card class="quick-stats-card modern-stat-card">
            <q-card-section class="modern-stat-section">
              <div class="modern-stat-header">
                <div>
                  <div class="modern-stat-title">今日收入</div>
                  <div class="modern-stat-subtitle">按今日开房时间统计</div>
                </div>
                <div class="modern-stat-icon">
                  <q-icon name="today" size="20px" />
                </div>
              </div>

              <div class="modern-stat-amount">
                <span class="modern-stat-currency">¥</span>
                <span class="modern-stat-value">
                  {{ formatCurrency(quickStats.today?.total_revenue || 0) }}
                </span>
              </div>

              <div class="modern-stat-footer">
                <div class="modern-stat-orders">
                  <span class="modern-stat-orders-count">
                    {{ quickStats.today?.total_orders || 0 }}
                  </span>
                  <span class="modern-stat-orders-label">今日订单</span>
                </div>
              </div>
            </q-card-section>
          </q-card>
        </div>

        <div class="col-lg-4 col-md-6 col-sm-12">
          <q-card class="quick-stats-card modern-stat-card">
            <q-card-section class="modern-stat-section">
              <div class="modern-stat-header">
                <div>
                  <div class="modern-stat-title">本周收入</div>
                  <div class="modern-stat-subtitle">按本周开房时间统计</div>
                </div>
                <div class="modern-stat-icon modern-stat-icon--week">
                  <q-icon name="date_range" size="20px" />
                </div>
              </div>

              <div class="modern-stat-amount">
                <span class="modern-stat-currency">¥</span>
                <span class="modern-stat-value">
                  {{ formatCurrency(quickStats.thisWeek?.total_revenue || 0) }}
                </span>
              </div>

              <div class="modern-stat-footer">
                <div class="modern-stat-orders">
                  <span class="modern-stat-orders-count">
                    {{ quickStats.thisWeek?.total_orders || 0 }}
                  </span>
                  <span class="modern-stat-orders-label">本周订单</span>
                </div>
              </div>
            </q-card-section>
          </q-card>
        </div>

        <div class="col-lg-4 col-md-6 col-sm-12">
          <q-card class="quick-stats-card modern-stat-card">
            <q-card-section class="modern-stat-section">
              <div class="modern-stat-header">
                <div>
                  <div class="modern-stat-title">本月收入</div>
                  <div class="modern-stat-subtitle">按本月开房时间统计</div>
                </div>
                <div class="modern-stat-icon modern-stat-icon--month">
                  <q-icon name="calendar_month" size="20px" />
                </div>
              </div>

              <div class="modern-stat-amount">
                <span class="modern-stat-currency">¥</span>
                <span class="modern-stat-value">
                  {{ formatCurrency(quickStats.thisMonth?.total_revenue || 0) }}
                </span>
              </div>

              <div class="modern-stat-footer">
                <div class="modern-stat-orders">
                  <span class="modern-stat-orders-count">
                    {{ quickStats.thisMonth?.total_orders || 0 }}
                  </span>
                  <span class="modern-stat-orders-label">本月订单</span>
                </div>
              </div>
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
            <div class="col-lg-2 col-md-4 col-sm-6 col-xs-12">
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
            <div class="col-lg-4 col-md-12 col-sm-12 col-xs-12">
              <div class="row items-center justify-end q-gutter-sm filter-actions-row">
                <div class="col-auto">
                  <q-btn
                    outline
                    color="primary"
                    label="今日"
                    @click="setFilterToday"
                  />
                </div>
                <div class="col-auto">
                  <q-btn
                    outline
                    color="secondary"
                    label="昨日"
                    @click="setFilterYesterday"
                  />
                </div>
                <div class="col-auto">
                  <q-btn
                    outline
                    color="accent"
                    label="本周"
                    @click="setFilterThisWeek"
                  />
                </div>
                <div class="col-auto">
                  <q-btn
                    outline
                    color="orange"
                    label="本月"
                    @click="setFilterThisMonth"
                  />
                </div>
                <div class="col-auto">
                  <q-btn
                    color="primary"
                    icon="search"
                    label="查询"
                    @click="fetchRevenueAndReceipt"
                    :loading="loading"
                  />
                </div>
              </div>
            </div>
          </div>
        </q-card-section>
      </q-card>

      <!-- 主内容布局：左侧房型 + 右侧每日明细与趋势 -->
      <div class="row q-col-gutter-xl q-mb-lg">
        <!-- 左侧：房型营收贡献 -->
        <div class="col-12 col-lg-4">
          <q-card>
            <q-card-section>
              <div class="row items-center justify-between q-mb-md">
                <div class="text-h6">
                  <q-icon name="hotel" class="q-mr-sm" />
                  房型营收贡献
                  <q-tooltip class="bg-white text-primary" anchor="bottom left" self="top left">
                    <div class="text-body2">
                      <strong>统计说明</strong>：按开房时间统计不同房型在当前日期范围内的收入贡献。
                    </div>
                  </q-tooltip>
                </div>
                <q-btn
                  v-if="selectedRoomType"
                  flat
                  dense
                  size="sm"
                  icon="close"
                  label="清除筛选"
                  class="text-grey-7"
                  @click="clearSelectedRoomType"
                />
              </div>

              <div v-if="displayRoomTypeData.length" class="column q-gutter-sm">
                <div
                  v-for="type in displayRoomTypeData"
                  :key="type.room_type || type.type_name"
                  class="room-type-item cursor-pointer"
                  :class="{ 'room-type-item--active': selectedRoomType === type.room_type }"
                  @click="toggleRoomType(type.room_type)"
                >
                  <div class="row items-start justify-between q-mb-xs">
                    <div>
                      <div class="room-type-name">
                        {{ type.type_name || type.room_type || '未命名房型' }}
                        <span
                          v-if="selectedRoomType === type.room_type"
                          class="room-type-dot"
                        />
                      </div>
                      <div class="text-caption text-grey-7 q-mt-xs">
                        订单数：{{ type.order_count || 0 }}
                        <span class="q-ml-md">
                          平均每单：¥{{ formatCurrency(type.avg_revenue_per_order || 0) }}
                        </span>
                      </div>
                    </div>
                    <div class="text-right">
                      <div class="text-subtitle1 text-primary text-weight-bold">
                        ¥{{ formatCurrency(type.total_revenue || 0) }}
                      </div>
                      <div class="text-caption text-grey-7">
                        {{ getRoomTypeShare(type) }}%
                      </div>
                    </div>
                  </div>
                  <div class="room-type-progress">
                    <div
                      class="room-type-progress-bar"
                      :style="{ width: `${getRoomTypeShare(type)}%` }"
                    />
                  </div>
                </div>
              </div>
              <div v-else class="text-caption text-grey-6">
                暂无房型收入数据
              </div>
            </q-card-section>
          </q-card>
        </div>

        <!-- 右侧：每日营收明细 + 收入趋势 -->
        <div class="col-12 col-lg-8">
          <!-- 每日营收明细（严格贴合 React 样式：仅标题 + 搜索 + 表格） -->
          <q-card class="q-mb-lg daily-card">
            <q-card-section>
              <div class="row items-center justify-between q-mb-md daily-card__header">
                <div class="col-auto">
                  <div class="row items-center">
                    <q-icon name="business" class="q-mr-sm text-primary" />
                    <div class="column">
                      <div class="daily-card__title">
                        每日营收明细
                        <span class="text-caption text-grey-7 q-ml-sm">
                          （{{ activeRoomTypeLabel || '全部房型' }}）
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
                <div class="col-auto">
                  <div class="row items-center q-gutter-sm">
                    <!-- 搜索房间号（前端过滤，参考 React 示例搜索框） -->
                    <q-input
                      v-model="receiptRoomSearch"
                      dense
                      outlined
                      clearable
                      debounce="0"
                      placeholder="搜索房间号..."
                      class="daily-card__search"
                    >
                      <template #prepend>
                        <q-icon name="search" class="text-grey-5" />
                      </template>
                    </q-input>
                  </div>
                </div>
              </div>

              <!-- 每日营收明细表格（React 风格：扁平表头 + 行样式） -->
              <q-table
                :rows="filteredReceiptDetails"
                :columns="receiptColumns"
                row-key="id"
                :loading="receiptLoading"
                v-model:pagination="receiptPagination"
                :rows-per-page-options="[10, 20, 50, 100]"
                flat
                separator="horizontal"
                class="receipt-table react-daily-table"
              >
                <!-- 自定义房号样式：圆角浅灰块 + 深色数字 -->
                <template #body-cell-roomNumber="props">
                  <q-td :props="props">
                    <div class="daily-room-pill">
                      {{ props.value }}
                    </div>
                  </q-td>
                </template>

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

                <template v-slot:body-cell-totalAmount="props">
                  <q-td :props="props" class="text-right">
                    <span class="text-weight-bold text-dark">¥{{ formatCurrency(props.value) }}</span>
                  </q-td>
                </template>

                <!-- 底部汇总行：使用当前筛选后的数据，并保留每页行数 + 翻页按钮 -->
                <template v-slot:bottom>
                  <div class="full-width q-pa-md bg-grey-1">
                    <div class="row items-center q-col-gutter-md">
                      <div class="col-12 col-md-6">
                        <div class="text-subtitle2 q-mb-sm">按支付方式统计：</div>
                        <div class="row q-col-gutter-xs">
                          <div
                            v-for="(amount, method) in receiptPaymentSummary"
                            :key="method"
                            class="col-auto"
                          >
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
                          <div class="text-caption text-grey-7 q-mr-md">
                            共 {{ filteredReceiptDetails.length }} 条记录
                          </div>
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
                          <span class="text-subtitle2">
                            总计：<span class="text-h6 text-primary">
                              ¥{{ formatCurrency(receiptTotalAmount) }}
                            </span>
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </template>
              </q-table>
            </q-card-section>
          </q-card>

          <!-- 收入趋势图表（在每日营收明细下方，风格对齐 React 示例） -->
          <q-card class="trend-card">
            <q-card-section>
              <div class="row items-center justify-between q-mb-md">
                <div class="col-auto">
                  <div class="row items-center">
                    <q-icon name="trending_up" class="q-mr-sm text-primary" />
                    <div class="column">
                      <div class="text-subtitle1 text-weight-bold text-dark">
                        {{ activeRoomTypeLabel ? `${activeRoomTypeLabel} - 营收趋势` : '全店营收趋势' }}
                      </div>
                      <div class="text-caption text-grey-6 q-mt-xs">
                        数据按当前选择的统计周期与日期范围自动更新。
                      </div>
                    </div>
                  </div>
                </div>
                <div class="col-auto">
                  <div class="row items-center q-gutter-xs">
                    <div class="trend-legend-dot" />
                    <div class="text-caption text-grey-7">
                      {{ selectedPeriodLabel }}
                    </div>
                  </div>
                </div>
              </div>
              <div class="chart-container" style="height: 400px;">
                <canvas ref="revenueChart"></canvas>
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
            :rows="billRows"
            :columns="billTableColumns"
            row-key="bill_id"
            :loading="billLoading"
            :pagination="billPagination"
            class="revenue-table"
            flat
          >
            <template #top>
              <div class="row q-col-gutter-md q-mb-md full-width">
                <div class="col-md-3 col-sm-4 col-xs-12">
                  <q-input
                    v-model="billFilters.date"
                    label="日期"
                    dense
                    filled
                    clearable
                  >
                    <template #append>
                      <q-icon name="event" class="cursor-pointer">
                        <q-popup-proxy cover transition-show="scale" transition-hide="scale">
                          <q-date
                            v-model="billFilters.date"
                            mask="YYYY-MM-DD"
                            :locale="langZhCn.date"
                          >
                            <div class="row items-center justify-end q-pa-sm">
                              <q-btn label="确定" color="primary" flat v-close-popup />
                            </div>
                          </q-date>
                        </q-popup-proxy>
                      </q-icon>
                    </template>
                  </q-input>
                </div>
                <div class="col-md-3 col-sm-4 col-xs-12">
                  <q-input
                    v-model="billFilters.roomNumber"
                    label="房间号"
                    dense
                    filled
                    clearable
                    @keyup.enter="applyBillFilters"
                    @clear="applyBillFilters"
                  />
                </div>
                <div class="col-auto self-end q-gutter-sm">
                  <q-btn
                    color="primary"
                    label="查询"
                    unelevated
                    @click="applyBillFilters"
                    :loading="billLoading"
                  />
                  <q-btn
                    flat
                    color="primary"
                    label="重置"
                    @click="resetBillFilters"
                    :disable="billLoading"
                  />
                </div>
              </div>
            </template>

            <template #body-cell-change_price="props">
              <q-td :props="props">
                <span :class="props.value >= 0 ? 'text-positive' : 'text-negative'">
                  ¥{{ formatCurrency(props.value) }}
                </span>
              </q-td>
            </template>

            <template #body-cell-create_time="props">
              <q-td :props="props">
                {{ formatDateTime(props.value) }}
              </q-td>
            </template>

            <!-- 查看备注：悬浮显示备注内容 -->
            <template #body-cell-remarks="props">
              <q-td :props="props">
                <q-btn
                  dense
                  flat
                  round
                  icon="info"
                  size="sm"
                  :disable="!props.row.remarks"
                >
                  <q-tooltip v-if="props.row.remarks">
                    {{ props.row.remarks }}
                  </q-tooltip>
                </q-btn>
              </q-td>
            </template>
          </q-table>
        </q-card-section>
      </q-card>
    </div>
  </q-page>
</template>

<script setup>
import { ref, computed, onMounted, nextTick, watch, onBeforeUnmount } from 'vue'
import { useQuasar, date } from 'quasar'
import { revenueApi, roomApi } from '../api/index'
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
const selectedRoomType = ref(null)
const allRoomTypes = ref([])

// 账单明细数据
const billRows = ref([])
const billLoading = ref(false)
const billFilters = ref({
  date: '',
  roomNumber: ''
})
const billPagination = ref({ rowsPerPage: 10 })
let suppressBillWatch = false
let billRoomFilterTimer = null

const billTableColumns = [
  { name: 'bill_id', label: '账单ID', field: 'bill_id', align: 'left' },
  { name: 'order_id', label: '订单ID', field: 'order_id', align: 'left' },
  { name: 'room_number', label: '房间号', field: 'room_number', align: 'center' },
  { name: 'guest_name', label: '客人姓名', field: 'guest_name', align: 'center' },
  { name: 'create_time', label: '创建时间', field: 'create_time', align: 'center' },
  {
    name: 'pay_way',
    label: '支付方式',
    field: row => viewStore.getPaymentMethodName(row.pay_way) || row.pay_way,
    align: 'center'
  },
  { name: 'change_type', label: '金额类型', field: 'change_type', align: 'center' },
  { name: 'change_price', label: '金额', field: 'change_price', align: 'right' },
  { name: 'remarks', label: '备注', field: 'remarks', align: 'center' }
]

// 收款明细表相关数据
const receiptLoading = ref(false)
const importLoading = ref(false)
const receiptType = ref('hotel') // 'hotel' 或 'rest'
const receiptDetails = ref([])
const receiptSelectedDate = ref(date.formatDate(new Date(), 'YYYY-MM-DD')) // 当前选中的日期
const receiptRoomSearch = ref('')

// 收款明细分页
const receiptPagination = ref({ page: 1, rowsPerPage: 10 })
const receiptMaxPage = computed(() => {
  const total = filteredReceiptDetails.value.length
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
  {
    name: 'roomType',
    label: '房型',
    field: row => row.room_type_name || row.room_type || '',
    align: 'center',
    style: 'width: 120px'
  },
  { name: 'guestName', label: '客户姓名', field: 'guest_name', align: 'center', style: 'width: 100px' },
  { name: 'orderNumber', label: '单号', field: 'order_number', align: 'left', style: 'width: 120px' },
  { name: 'stayDate', label: '入住日期', field: 'stay_date_display', align: 'center', style: 'width: 140px' },
  {
    name: 'paymentMethod',
    label: '支付方式',
    field: row => viewStore.getPaymentMethodName(row.payment_method) || row.payment_method,
    align: 'center',
    style: 'width: 100px'
  },
  { name: 'totalAmount', label: '实收金额', field: 'total_amount', align: 'right', style: 'width: 120px' }
]

// 展示用房型列表：始终包含所有房型，对没有收入的房型补 0
const displayRoomTypeData = computed(() => {
  if (!allRoomTypes.value.length) return roomTypeData.value

  const aggMap = new Map()
  roomTypeData.value.forEach(item => {
    if (!item) return
    const key = item.room_type || item.type_code
    if (!key) return
    aggMap.set(key, item)
  })

  return allRoomTypes.value.map(rt => {
    const key = rt.type_code
    const agg = aggMap.get(key)
    if (agg) {
      return {
        room_type: key,
        type_name: agg.type_name || rt.type_name,
        order_count: Number(agg.order_count || 0),
        total_revenue: Number(agg.total_revenue || 0),
        avg_revenue_per_order: Number(agg.avg_revenue_per_order || 0),
        total_room_fee: Number(agg.total_room_fee || 0),
        total_deposit_refund: Number(agg.total_deposit_refund || 0)
      }
    }
    return {
      room_type: key,
      type_name: rt.type_name,
      order_count: 0,
      total_revenue: 0,
      avg_revenue_per_order: 0,
      total_room_fee: 0,
      total_deposit_refund: 0
    }
  })
})

// 当前选中房型名称（用于标题显示）
const activeRoomTypeLabel = computed(() => {
  if (!selectedRoomType.value) return ''
  const found = displayRoomTypeData.value.find(item => item.room_type === selectedRoomType.value)
  return found?.type_name || selectedRoomType.value
})

// 房型总收入（用于计算占比）
const roomTypeTotalRevenue = computed(() => {
  return displayRoomTypeData.value.reduce((sum, item) => sum + Number(item.total_revenue || 0), 0)
})

// 计算房型收入占比（保留 1 位小数）
const getRoomTypeShare = (type) => {
  const total = roomTypeTotalRevenue.value || 0
  if (!total) return 0
  const val = Number(type.total_revenue || 0)
  return Math.round((val / total) * 1000) / 10
}

// 根据选中房型筛选每日收款明细
const filteredReceiptDetails = computed(() => {
  let list = receiptDetails.value

  // 按房型筛选
  if (selectedRoomType.value) {
    list = list.filter(item => item.room_type === selectedRoomType.value)
  }

  // 按房间号搜索（参考 React 示例中的搜索框）
  const keyword = (receiptRoomSearch.value || '').trim()
  if (keyword) {
    list = list.filter(item => String(item.room_number || '').includes(keyword))
  }

  return list
})

// 收款明细表计算属性（基于筛选后的数据）
const receiptTotalAmount = computed(() => {
  return filteredReceiptDetails.value.reduce((sum, item) => sum + (item.total_amount || 0), 0)
})

const receiptPaymentSummary = computed(() => {
  const summary = {}
  filteredReceiptDetails.value.forEach(item => {
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

// 趋势图右上角标签（类似 React 示例中的时间范围文案）
const selectedPeriodLabel = computed(() => {
  const periodMap = {
    daily: '每日统计',
    weekly: '每周统计',
    monthly: '每月统计'
  }
  return periodMap[selectedPeriod.value] || '统计周期'
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

const formatDateTime = (dateTime) => {
  if (!dateTime) return ''
  try {
    return date.formatDate(new Date(dateTime), 'YYYY-MM-DD HH:mm')
  } catch (e) {
    return dateTime
  }
}

// 房型筛选相关
const toggleRoomType = (roomTypeCode) => {
  if (!roomTypeCode) return
  selectedRoomType.value = selectedRoomType.value === roomTypeCode ? null : roomTypeCode
}

const clearSelectedRoomType = () => {
  selectedRoomType.value = null
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

const extractBillList = (payload) => {
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload?.data)) return payload.data
  if (Array.isArray(payload?.rows)) return payload.rows
  if (Array.isArray(payload?.bills)) return payload.bills
  return []
}

const fetchBillDetails = async () => {
  billLoading.value = true
  try {
    const params = {}
    if (billFilters.value.date) params.date = billFilters.value.date
    if (billFilters.value.roomNumber && billFilters.value.roomNumber.trim()) {
      params.roomNumber = billFilters.value.roomNumber.trim()
    }

    const response = await revenueApi.getRevenueBills(params)
    const list = extractBillList(response)

    const hasDateFilter = !!billFilters.value.date
    const roomFilter = (billFilters.value.roomNumber || '').trim()
    const hasRoomFilter = roomFilter.length > 0

    const normalizeTime = (value) => {
      if (!value) return 0
      const time = new Date(value).getTime()
      return Number.isFinite(time) ? time : 0
    }

    const mapped = list.map(item => ({
      ...item,
      change_price: Number(item.change_price || 0),
      create_time: item.create_time,
      stay_date: item.stay_date || item.create_time
    }))

    mapped.sort((a, b) => {
      const createDiff = normalizeTime(b.create_time) - normalizeTime(a.create_time)
      if (createDiff !== 0) {
        return createDiff
      }

      if (hasRoomFilter) {
        const roomA = a.room_number ? String(a.room_number) : ''
        const roomB = b.room_number ? String(b.room_number) : ''
        const roomCompare = roomA.localeCompare(roomB, 'zh-Hans-CN', { numeric: true, sensitivity: 'base' })
        if (roomCompare !== 0) {
          return roomCompare
        }
      }

      if (hasDateFilter) {
        const dateDiff = normalizeTime(a.stay_date) - normalizeTime(b.stay_date)
        if (dateDiff !== 0) {
          return dateDiff
        }
      }

      const billIdA = Number(a.bill_id) || 0
      const billIdB = Number(b.bill_id) || 0
      return billIdB - billIdA
    })

    billRows.value = mapped
  } catch (error) {
    console.error('获取收入账单明细失败:', error)
    $q.notify({
      type: 'negative',
      message: '获取收入账单明细失败',
      position: 'top'
    })
  } finally {
    billLoading.value = false
  }
}

const applyBillFilters = async () => {
  if (billRoomFilterTimer) {
    clearTimeout(billRoomFilterTimer)
    billRoomFilterTimer = null
  }
  await fetchBillDetails()
}

const resetBillFilters = async () => {
  const hadFilters = !!billFilters.value.date || !!billFilters.value.roomNumber
  if (billRoomFilterTimer) {
    clearTimeout(billRoomFilterTimer)
    billRoomFilterTimer = null
  }
  suppressBillWatch = true
  billFilters.value.date = ''
  billFilters.value.roomNumber = ''
  try {
    if (hadFilters) {
      await fetchBillDetails()
    }
  } finally {
    suppressBillWatch = false
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
      endDate: dateRange.value.end,
      roomType: selectedRoomType.value
    })

    let response
    switch (selectedPeriod.value) {
      case 'daily':
        console.log('调用每日收入API...')
        response = await revenueApi.getDailyRevenue(
          dateRange.value.start,
          dateRange.value.end,
          selectedRoomType.value || undefined
        )
        break
      case 'weekly':
        console.log('调用每周收入API...')
        response = await revenueApi.getWeeklyRevenue(
          dateRange.value.start,
          dateRange.value.end,
          selectedRoomType.value || undefined
        )
        break
      case 'monthly':
        console.log('调用每月收入API...')
        response = await revenueApi.getMonthlyRevenue(
          dateRange.value.start,
          dateRange.value.end,
          selectedRoomType.value || undefined
        )
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

// 同步获取收入趋势 + 每日营收明细（按顶部日期范围）
const fetchRevenueAndReceipt = async () => {
  if (!dateRange.value.start || !dateRange.value.end) {
    $q.notify({
      type: 'warning',
      message: '请选择日期范围',
      position: 'top'
    })
    return
  }
  await Promise.all([
    fetchRevenueData(),
    fetchReceiptDetails(dateRange.value.start, dateRange.value.end)
  ])
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

// 顶部筛选：快速设置日期范围
const setFilterToday = () => {
  const today = date.formatDate(new Date(), 'YYYY-MM-DD')
  dateRange.value.start = today
  dateRange.value.end = today
}

const setFilterYesterday = () => {
  const yesterday = date.subtractFromDate(new Date(), { days: 1 })
  const y = date.formatDate(yesterday, 'YYYY-MM-DD')
  dateRange.value.start = y
  dateRange.value.end = y
}

const setFilterThisWeek = () => {
  const today = new Date()
  const currentDay = today.getDay() // 0为周日，1为周一
  const mondayOffset = currentDay === 0 ? -6 : 1 - currentDay
  const monday = date.addToDate(today, { days: mondayOffset })
  const sunday = date.addToDate(monday, { days: 6 })
  dateRange.value.start = date.formatDate(monday, 'YYYY-MM-DD')
  dateRange.value.end = date.formatDate(sunday, 'YYYY-MM-DD')
}

const setFilterThisMonth = () => {
  const today = new Date()
  const firstDayOfMonth = date.startOfDate(today, 'month')
  const lastDayOfMonth = date.endOfDate(today, 'month')
  dateRange.value.start = date.formatDate(firstDayOfMonth, 'YYYY-MM-DD')
  dateRange.value.end = date.formatDate(lastDayOfMonth, 'YYYY-MM-DD')
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

  revenueChartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [
        {
          label: '收入金额',
          data: revenues,
          borderColor: '#6366f1',
          backgroundColor: 'rgba(99, 102, 241, 0.12)',
          yAxisID: 'y',
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
          },
          grid: {
            color: '#f1f5f9',
            drawBorder: false
          },
          ticks: {
            color: '#64748b'
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
            },
            color: '#64748b'
          },
          grid: {
            color: '#f1f5f9',
            drawBorder: false
          }
        }
      },
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              return `收入: ¥${formatCurrency(context.parsed.y)}`
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
  const label = String(method || '').trim()
  if (label === '现金') return 'orange'      // 现金：橘色
  if (label === '微信') return 'green'       // 微信：绿色
  if (label === '微邮付') return 'primary'   // 微邮付：蓝色
  if (label === '平台') return 'grey-7'      // 平台：灰色
  return 'grey'
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

watch(() => billFilters.value.date, () => {
  if (suppressBillWatch) return
  fetchBillDetails()
})

watch(() => billFilters.value.roomNumber, () => {
  if (suppressBillWatch) return
  if (billRoomFilterTimer) clearTimeout(billRoomFilterTimer)
  billRoomFilterTimer = setTimeout(() => {
    fetchBillDetails()
  }, 400)
})

onBeforeUnmount(() => {
  if (billRoomFilterTimer) clearTimeout(billRoomFilterTimer)
})


// 组件挂载时初始化
onMounted(async () => {
  await fetchQuickStats()
  try {
    const rtRes = await roomApi.getRoomTypes()
    allRoomTypes.value = rtRes.data || []
  } catch (e) {
    console.error('获取房型列表失败:', e)
  }
  await fetchRevenueData()
  await fetchReceiptDetails(dateRange.value.start, dateRange.value.end)
  await fetchBillDetails()
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
    fetchRevenueAndReceipt()
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

watch(() => selectedRoomType.value, () => {
  // 切换房型时联动更新趋势图
  scheduleRevenueFetch()
  // 同时重置每日明细分页到第一页
  receiptPagination.value.page = 1
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
  height: auto;
  transition: transform 0.3s ease, box-shadow 0.3s ease;
  border-radius: 24px;
  overflow: hidden;
}

.quick-stats-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 18px 40px rgba(15, 23, 42, 0.06);
}

/* 顶部统计卡片 - 方案 A: 现代商务风格 */
.modern-stat-card {
  position: relative;
  overflow: hidden;
  background-color: #ffffff;
  border-radius: 1.25rem;
  border: 1px solid #e5e7eb;
  box-shadow: 0 2px 15px -3px rgba(0, 0, 0, 0.07),
    0 10px 20px -2px rgba(0, 0, 0, 0.04);
  transition: box-shadow 0.3s ease, transform 0.3s ease;
}

.modern-stat-card:hover {
  box-shadow: 0 22px 45px rgba(15, 23, 42, 0.12);
}

.modern-stat-section {
  padding: 24px;
}

.modern-stat-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 16px;
}

.modern-stat-title {
  font-size: 14px;
  color: #6b7280;
  font-weight: 500;
  margin-bottom: 4px;
}

.modern-stat-subtitle {
  font-size: 12px;
  color: #9ca3af;
}

.modern-stat-icon {
  padding: 8px;
  border-radius: 0.75rem;
  background-color: #eef2ff;
  color: #4f46e5;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.3s ease;
}

.modern-stat-card:hover .modern-stat-icon {
  transform: scale(1.08);
}

.modern-stat-icon--week {
  background-color: #ecfdf5;
  color: #059669;
}

.modern-stat-icon--month {
  background-color: #fff7ed;
  color: #ea580c;
}

.modern-stat-amount {
  display: flex;
  align-items: baseline;
  gap: 4px;
  margin-bottom: 4px;
}

.modern-stat-currency {
  font-size: 20px;
  font-weight: 700;
  color: #111827;
}

.modern-stat-value {
  font-size: 34px;
  font-weight: 700;
  color: #111827;
  letter-spacing: -0.03em;
}

.modern-stat-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 16px;
  padding-top: 12px;
  border-top: 1px solid #f3f4f6;
}

.modern-stat-orders {
  display: flex;
  align-items: center;
  gap: 8px;
}

.modern-stat-orders-count {
  width: 24px;
  height: 24px;
  border-radius: 999px;
  background-color: #f3f4f6;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 700;
  color: #4b5563;
}

.modern-stat-orders-label {
  font-size: 13px;
  color: #6b7280;
}

.modern-stat-link {
  opacity: 0;
  font-size: 13px;
  font-weight: 500;
  color: #4f46e5;
  transition: opacity 0.3s ease;
  padding: 0;
  min-width: 0;
}

.modern-stat-card:hover .modern-stat-link {
  opacity: 1;
}

.chart-container {
  position: relative;
  background: white;
  border-radius: 16px;
  padding: 16px;
}

.revenue-table {
  border-radius: 8px;
}

/* 顶部统计卡片 React 风格 */
.react-stat-card {
  background-color: #ffffff;
  border: 1px solid #e5edf8;
  box-shadow: 0 18px 40px rgba(15, 23, 42, 0.04);
}

.react-stat-icon {
  width: 56px;
  height: 56px;
  border-radius: 18px;
  background-color: #eef2ff;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #4f46e5;
  font-size: 24px;
}

.react-stat-title {
  font-size: 14px;
  color: #6b7280;
  font-weight: 500;
}

.react-stat-subtitle {
  font-size: 12px;
  color: #9ca3af;
}

.react-stat-value {
  font-size: 28px;
  font-weight: 700;
  color: #111827;
}

/* 每日营收卡片（React 风格：大圆角白卡） */
.daily-card {
  border-radius: 24px;
  border: 1px solid #e5edf8;
  box-shadow: 0 18px 40px rgba(15, 23, 42, 0.06);
}

.daily-card__header {
  margin-bottom: 16px;
}

.daily-card__search {
  min-width: 180px;
}

.daily-card__title {
  font-size: 18px;
  font-weight: 700;
  color: #0f172a;
}

/* 趋势图卡片（React 风格） */
.trend-card {
  border-radius: 16px;
  border: 1px solid #e2e8f0;
  box-shadow: 0 10px 25px rgba(15, 23, 42, 0.06);
}

.trend-legend-dot {
  width: 10px;
  height: 10px;
  border-radius: 999px;
  background-color: #6366f1;
}

/* 顶部筛选区域：防止快捷按钮与查询按钮换行 */
.filter-actions-row {
  flex-wrap: nowrap;
}

/* React 风格的每日营收表格 */
.react-daily-table :deep(.q-table__top) {
  display: none;
}

.react-daily-table :deep(.q-table__middle) {
  border-radius: 16px;
}

.react-daily-table :deep(thead tr) {
  background-color: #f8fafc;
}

.react-daily-table :deep(th) {
  font-weight: 600;
  color: #64748b;
  padding: 12px 24px;
  border-bottom: 1px solid #e2e8f0;
}

.react-daily-table :deep(td) {
  padding: 16px 24px;
  color: #1e293b;
}

.react-daily-table :deep(tbody tr:hover) {
  background-color: #f8fafc;
}

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

/* 房型营收卡片样式（参考 React 设计风格） */
.room-type-item {
  border-radius: 10px;
  border: 1px solid #e2e8f0;
  padding: 12px 14px;
  background-color: #ffffff;
  transition: border-color 0.2s ease, box-shadow 0.2s ease, transform 0.15s ease;
}

.room-type-item:hover {
  border-color: #6366f1;
  box-shadow: 0 8px 18px rgba(15, 23, 42, 0.12);
  transform: translateY(-2px);
}

.room-type-item--active {
  border-color: #4f46e5;
  box-shadow: 0 10px 22px rgba(79, 70, 229, 0.22);
  background: linear-gradient(135deg, #eef2ff, #ffffff);
}

.room-type-name {
  font-weight: 600;
  color: #0f172a;
  display: inline-flex;
  align-items: center;
}

.room-type-dot {
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background-color: #4f46e5;
  margin-left: 6px;
}

.room-type-progress {
  margin-top: 8px;
  width: 100%;
  height: 6px;
  border-radius: 999px;
  background-color: #e5e7eb;
  overflow: hidden;
}

.room-type-progress-bar {
  height: 100%;
  border-radius: 999px;
  background: linear-gradient(90deg, #6366f1, #22c55e);
  transition: width 0.4s ease;
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
