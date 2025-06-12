<template>
  <q-page class="shift-handover">
    <div class="q-pa-md">
      <div class="row q-col-gutter-md">
        <!-- 页面标题 -->
        <div class="col-12">
          <q-card class="bg-primary text-white q-mb-md shadow-10">
            <q-card-section class="q-pa-lg">
              <div class="row items-center justify-between">
                <div>
                  <div class="text-h3 text-weight-bold q-mb-xs">
                    <q-icon name="swap_horizontal_circle" size="md" class="q-mr-sm" />
                    交接班管理
                  </div>
                  <div class="text-h6 text-white-7">{{ currentDate }} - {{ getCurrentDayOfWeek() }}</div>
                </div>
                <div class="text-right">
                  <q-chip color="white" text-color="primary" icon="person" class="q-mb-xs">
                    {{ cashierName }}
                  </q-chip>
                  <div class="text-subtitle1">
                    <q-icon name="schedule" size="sm" class="q-mr-xs" />
                    {{ shiftTime }}
                  </div>
                </div>
              </div>
            </q-card-section>
          </q-card>
        </div>

        <!-- 收款明细表区域 -->
        <div class="col-md-8 col-xs-12">
          <q-card>
            <q-card-section class="bg-secondary text-white">
              <div class="row items-center justify-between">
                <div class="text-h6">
                  <q-icon name="receipt_long" class="q-mr-xs" />
                  收款明细表
                </div>
                <q-btn-toggle
                  v-model="roomType"
                  :options="[
                    {label: '客房', value: 'hotel'},
                    {label: '休息房', value: 'rest'}
                  ]"
                  color="white"
                  text-color="primary"
                  toggle-color="primary"
                  size="sm"
                  @update:model-value="switchRoomType"
                />
              </div>
            </q-card-section>

            <!-- 明细表格 -->
            <q-card-section class="q-pa-none">
              <q-table
                :rows="receiptDetails"
                :columns="receiptColumns"
                row-key="id"
                :loading="loading"
                :pagination="pagination"
                dense
                flat
                bordered
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
                    <span class="text-weight-medium">¥{{ props.value.toFixed(2) }}</span>
                  </q-td>
                </template>

                <template v-slot:body-cell-deposit="props">
                  <q-td :props="props" class="text-right">
                    <span class="text-weight-medium">¥{{ props.value.toFixed(2) }}</span>
                  </q-td>
                </template>

                <template v-slot:body-cell-totalAmount="props">
                  <q-td :props="props" class="text-right">
                    <span class="text-weight-bold text-primary">¥{{ props.value.toFixed(2) }}</span>
                  </q-td>
                </template>

                <!-- 底部汇总行 -->
                <template v-slot:bottom>
                  <div class="full-width q-pa-md bg-grey-1">
                    <div class="row q-col-gutter-md">
                      <div class="col-md-6 col-xs-12">
                        <div class="text-subtitle2 q-mb-sm">按支付方式统计：</div>
                        <div class="row q-col-gutter-xs">
                          <div v-for="(amount, method) in paymentSummary" :key="method" class="col-auto">
                            <q-chip
                              :color="getPaymentMethodColor(method)"
                              text-color="white"
                              size="sm"
                            >
                              {{ method }}：¥{{ amount.toFixed(2) }}
                            </q-chip>
                          </div>
                        </div>
                      </div>
                      <div class="col-md-6 col-xs-12 text-right">
                        <div class="text-subtitle2">总计：<span class="text-h6 text-primary">¥{{ totalAmount.toFixed(2) }}</span></div>
                        <div class="text-caption text-grey-7">共 {{ receiptDetails.length }} 条记录</div>
                      </div>
                    </div>
                  </div>
                </template>
              </q-table>
            </q-card-section>
          </q-card>
        </div>

        <!-- 统计区域 -->
        <div class="col-md-4 col-xs-12">
          <q-card>
            <q-card-section class="bg-secondary text-white">
              <div class="text-h6">
                <q-icon name="summarize" class="q-mr-xs" />
                交接班统计
              </div>
            </q-card-section>

            <q-card-section class="q-pa-none">
              <!-- 收入统计 -->
              <q-list bordered separator>
                <q-item-label header class="text-weight-bold bg-blue-1">收入统计</q-item-label>

                <q-item>
                  <q-item-section>
                    <q-item-label>备用金</q-item-label>
                  </q-item-section>
                  <q-item-section side>
                    <q-input
                      v-model.number="statistics.reserveCash"
                      type="number"
                      dense
                      filled
                      prefix="¥"
                      class="text-right"
                      style="width: 100px"
                      @update:model-value="updateStatistics"
                    />
                  </q-item-section>
                </q-item>

                <q-item>
                  <q-item-section>
                    <q-item-label>客房收入</q-item-label>
                  </q-item-section>
                  <q-item-section side>
                    <q-item-label class="text-weight-bold text-positive">¥{{ statistics.hotelIncome.toFixed(2) }}</q-item-label>
                  </q-item-section>
                </q-item>

                <q-item>
                  <q-item-section>
                    <q-item-label>休息房收入</q-item-label>
                  </q-item-section>
                  <q-item-section side>
                    <q-item-label class="text-weight-bold text-positive">¥{{ statistics.restIncome.toFixed(2) }}</q-item-label>
                  </q-item-section>
                </q-item>

                <q-item>
                  <q-item-section>
                    <q-item-label>租车收入</q-item-label>
                  </q-item-section>
                  <q-item-section side>
                    <q-input
                      v-model.number="statistics.carRentalIncome"
                      type="number"
                      dense
                      filled
                      prefix="¥"
                      class="text-right"
                      style="width: 100px"
                      @update:model-value="updateStatistics"
                    />
                  </q-item-section>
                </q-item>

                <q-item class="bg-amber-1">
                  <q-item-section>
                    <q-item-label class="text-weight-bold">合计</q-item-label>
                  </q-item-section>
                  <q-item-section side>
                    <q-item-label class="text-h6 text-positive">¥{{ statistics.totalIncome.toFixed(2) }}</q-item-label>
                  </q-item-section>
                </q-item>

                <q-item-label header class="text-weight-bold bg-orange-1">退押统计</q-item-label>

                <q-item>
                  <q-item-section>
                    <q-item-label>客房退押</q-item-label>
                  </q-item-section>
                  <q-item-section side>
                    <q-input
                      v-model.number="statistics.hotelDeposit"
                      type="number"
                      dense
                      filled
                      prefix="¥"
                      class="text-right"
                      style="width: 100px"
                      @update:model-value="updateStatistics"
                    />
                  </q-item-section>
                </q-item>

                <q-item>
                  <q-item-section>
                    <q-item-label>休息退押</q-item-label>
                  </q-item-section>
                  <q-item-section side>
                    <q-input
                      v-model.number="statistics.restDeposit"
                      type="number"
                      dense
                      filled
                      prefix="¥"
                      class="text-right"
                      style="width: 100px"
                      @update:model-value="updateStatistics"
                    />
                  </q-item-section>
                </q-item>

                <q-item>
                  <q-item-section>
                    <q-item-label>留存款</q-item-label>
                  </q-item-section>
                  <q-item-section side>
                    <q-input
                      v-model.number="statistics.retainedAmount"
                      type="number"
                      dense
                      filled
                      prefix="¥"
                      class="text-right"
                      style="width: 100px"
                      @update:model-value="updateStatistics"
                    />
                  </q-item-section>
                </q-item>

                <q-item class="bg-green-1">
                  <q-item-section>
                    <q-item-label class="text-weight-bold">交接款</q-item-label>
                  </q-item-section>
                  <q-item-section side>
                    <q-item-label class="text-h6 text-green-8">¥{{ statistics.handoverAmount.toFixed(2) }}</q-item-label>
                  </q-item-section>
                </q-item>
              </q-list>

              <!-- 特殊统计项 -->
              <div class="q-pa-md">
                <div class="text-subtitle2 q-mb-sm">特殊统计</div>
                <div class="row q-col-gutter-sm">
                  <div class="col-6">
                    <q-card class="bg-green-1 text-center">
                      <q-card-section class="q-pa-sm">
                        <div class="text-caption">好评</div>
                        <q-input
                          v-model.number="statistics.goodReviews"
                          type="number"
                          dense
                          borderless
                          class="text-center text-h6"
                        />
                      </q-card-section>
                    </q-card>
                  </div>
                  <div class="col-6">
                    <q-card class="bg-blue-1 text-center">
                      <q-card-section class="q-pa-sm">
                        <div class="text-caption">大美卡</div>
                        <q-input
                          v-model.number="statistics.vipCards"
                          type="number"
                          dense
                          borderless
                          class="text-center text-h6"
                        />
                      </q-card-section>
                    </q-card>
                  </div>
                  <div class="col-6">
                    <q-card class="bg-purple-1 text-center">
                      <q-card-section class="q-pa-sm">
                        <div class="text-caption">开房</div>
                        <div class="text-h6">{{ statistics.totalRooms }}</div>
                      </q-card-section>
                    </q-card>
                  </div>
                  <div class="col-6">
                    <q-card class="bg-orange-1 text-center">
                      <q-card-section class="q-pa-sm">
                        <div class="text-caption">休息房</div>
                        <div class="text-h6">{{ statistics.restRooms }}</div>
                      </q-card-section>
                    </q-card>
                  </div>
                </div>
              </div>
            </q-card-section>
          </q-card>
        </div>

        <!-- 备注和操作区域 -->
        <div class="col-12">
          <q-card>
            <q-card-section class="bg-secondary text-white">
              <div class="text-h6">
                <q-icon name="notes" class="q-mr-xs" />
                备注与签名
              </div>
            </q-card-section>

            <q-card-section>
              <div class="row q-col-gutter-md">
                <div class="col-md-8 col-xs-12">
                  <q-input
                    v-model="remarks"
                    type="textarea"
                    filled
                    autogrow
                    label="交接班备注"
                    rows="3"
                  />
                </div>
                <div class="col-md-4 col-xs-12">
                  <div class="q-gutter-sm">
                    <q-input
                      v-model="cashierName"
                      filled
                      label="收银员签名"
                    />
                    <q-input
                      v-model="shiftTime"
                      filled
                      label="交班时间"
                      readonly
                    />
                  </div>
                </div>
              </div>
            </q-card-section>

            <!-- 操作按钮 -->
            <q-card-actions align="right" class="q-pa-md">
              <q-btn
                color="grey"
                outline
                icon="history"
                label="历史记录"
                @click="showHistory = true"
              />
              <q-btn
                color="secondary"
                icon="print"
                label="打印交接单"
                @click="printHandover"
              />
              <q-btn
                color="accent"
                icon="file_download"
                label="导出Excel"
                @click="exportToExcel"
              />
              <q-btn
                color="primary"
                icon="save"
                label="保存交接班"
                @click="saveHandover"
                :loading="saving"
              />
            </q-card-actions>
          </q-card>
        </div>

        <!-- 历史记录对话框 -->
        <q-dialog v-model="showHistory" maximized>
          <q-card>
            <q-card-section class="bg-primary text-white">
              <div class="row items-center">
                <div class="col">
                  <div class="text-h6">交接班历史记录</div>
                </div>
                <div class="col-auto">
                  <q-btn flat round icon="close" @click="showHistory = false" />
                </div>
              </div>
            </q-card-section>

            <q-card-section class="q-pa-none">
              <q-table
                :rows="historyRecords"
                :columns="historyColumns"
                row-key="id"
                :loading="loadingHistory"
                flat
                bordered
              >
                <template v-slot:body-cell-actions="props">
                  <q-td :props="props">
                    <q-btn
                      size="sm"
                      color="primary"
                      icon="visibility"
                      @click="viewHandoverDetail(props.row)"
                      dense
                      flat
                    >
                      查看
                    </q-btn>
                  </q-td>
                </template>
              </q-table>
            </q-card-section>
          </q-card>
        </q-dialog>
      </div>
    </div>
  </q-page>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { date } from 'quasar'
import { useQuasar } from 'quasar'
import api from '../api/index.js'

const $q = useQuasar()

// 基础数据
const currentDate = computed(() => {
  return date.formatDate(new Date(), 'YYYY年MM月DD日')
})

const getCurrentDayOfWeek = () => {
  const days = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']
  return days[new Date().getDay()]
}

const shiftTime = ref(date.formatDate(new Date(), 'HH:mm'))
const cashierName = ref('张三') // 从用户状态获取
const roomType = ref('hotel')
const loading = ref(false)
const saving = ref(false)
const showHistory = ref(false)
const loadingHistory = ref(false)

// 分页设置
const pagination = ref({
  rowsPerPage: 0 // 显示所有行
})

// 明细表格列定义
const receiptColumns = [
  { name: 'roomNumber', label: '房号', field: 'room_number', align: 'center', style: 'width: 80px' },
  { name: 'orderNumber', label: '单号', field: 'order_number', align: 'left', style: 'width: 120px' },
  { name: 'roomFee', label: '房费', field: 'room_fee', align: 'right', style: 'width: 100px' },
  { name: 'deposit', label: '押金', field: 'deposit', align: 'right', style: 'width: 100px' },
  { name: 'paymentMethod', label: '支付方式', field: 'payment_method', align: 'center', style: 'width: 100px' },
  { name: 'totalAmount', label: '总额', field: 'total_amount', align: 'right', style: 'width: 120px' },
  { name: 'checkInTime', label: '开房时间', field: 'check_in_date', align: 'center', style: 'width: 140px' },
  { name: 'checkOutTime', label: '退房时间', field: 'check_out_date', align: 'center', style: 'width: 140px' }
]

// 历史记录表格列
const historyColumns = [
  { name: 'shift_date', label: '交班日期', field: 'shift_date', align: 'center', style: 'width: 120px' },
  { name: 'cashier_name', label: '收银员', field: 'cashier_name', align: 'center', style: 'width: 100px' },
  { name: 'shift_time', label: '交班时间', field: 'shift_time', align: 'center', style: 'width: 100px' },
  { name: 'type', label: '类型', field: row => row.type === 'hotel' ? '客房' : '休息房', align: 'center', style: 'width: 80px' },
  {
    name: 'total_income',
    label: '总收入',
    field: row => {
      try {
        const stats = typeof row.statistics === 'string' ? JSON.parse(row.statistics) : row.statistics
        return `¥${(stats.totalIncome || 0).toFixed(2)}`
      } catch (e) {
        return '¥0.00'
      }
    },
    align: 'right',
    style: 'width: 120px'
  },
  {
    name: 'handover_amount',
    label: '交接款',
    field: row => {
      try {
        const stats = typeof row.statistics === 'string' ? JSON.parse(row.statistics) : row.statistics
        return `¥${(stats.handoverAmount || 0).toFixed(2)}`
      } catch (e) {
        return '¥0.00'
      }
    },
    align: 'right',
    style: 'width: 120px'
  },
  { name: 'created_at', label: '创建时间', field: 'created_at', align: 'center', style: 'width: 140px' },
  { name: 'actions', label: '操作', field: '', align: 'center', style: 'width: 80px' }
]

// 明细数据
const receiptDetails = ref([])
const historyRecords = ref([])

// 统计数据
const statistics = ref({
  reserveCash: 1000,
  hotelIncome: 0,
  restIncome: 0,
  carRentalIncome: 0,
  totalIncome: 0,
  hotelDeposit: 0,
  restDeposit: 0,
  retainedAmount: 0,
  handoverAmount: 0,
  goodReviews: 0,
  vipCards: 0,
  totalRooms: 0,
  restRooms: 0
})

// 备注信息
const remarks = ref('')

// 计算属性
const totalAmount = computed(() => {
  return receiptDetails.value.reduce((sum, item) => sum + (item.total_amount || 0), 0)
})

const paymentSummary = computed(() => {
  const summary = {}
  receiptDetails.value.forEach(item => {
    const method = item.payment_method || '现金'
    summary[method] = (summary[method] || 0) + (item.total_amount || 0)
  })
  return summary
})

// 监听统计数据变化
watch(statistics, () => {
  updateHandoverAmount()
}, { deep: true })

// 获取支付方式对应的颜色
function getPaymentMethodColor(method) {
  const colors = {
    '现金': 'green',
    '微信': 'green-7',
    '支付宝': 'blue',
    '银行卡': 'purple',
    '其他': 'grey'
  }
  return colors[method] || 'grey'
}

// 更新交接款金额
function updateHandoverAmount() {
  statistics.value.totalIncome =
    statistics.value.hotelIncome +
    statistics.value.restIncome +
    statistics.value.carRentalIncome +
    statistics.value.reserveCash

  statistics.value.handoverAmount =
    statistics.value.totalIncome -
    statistics.value.hotelDeposit -
    statistics.value.restDeposit -
    statistics.value.retainedAmount
}

// 更新统计数据
function updateStatistics() {
  updateHandoverAmount()
}

// 切换房间类型
async function switchRoomType(type) {
  loading.value = true
  try {
    const today = date.formatDate(new Date(), 'YYYY-MM-DD')
    const response = await api.get('/shift-handover/receipts', {
      params: {
        type: type,
        startDate: today,
        endDate: today
      }
    })

    receiptDetails.value = response.map(item => ({
      ...item,
      room_fee: parseFloat(item.room_fee || 0),
      deposit: parseFloat(item.deposit || 0),
      total_amount: parseFloat(item.total_amount || 0),
      check_in_date: item.check_in_date ? date.formatDate(new Date(item.check_in_date), 'MM-DD HH:mm') : '',
      check_out_date: item.check_out_date ? date.formatDate(new Date(item.check_out_date), 'MM-DD HH:mm') : ''
    }))

    await loadStatistics()
  } catch (error) {
    console.error('获取收款明细失败:', error)
    $q.notify({
      type: 'negative',
      message: '获取收款明细失败'
    })
  } finally {
    loading.value = false
  }
}

// 加载统计数据
async function loadStatistics() {
  try {
    const today = date.formatDate(new Date(), 'YYYY-MM-DD')
    const response = await api.get('/shift-handover/statistics', {
      params: { date: today }
    })

    // 合并统计数据，保留用户输入的值
    const currentReserveCash = statistics.value.reserveCash
    const currentCarRentalIncome = statistics.value.carRentalIncome
    const currentHotelDeposit = statistics.value.hotelDeposit
    const currentRestDeposit = statistics.value.restDeposit
    const currentRetainedAmount = statistics.value.retainedAmount
    const currentGoodReviews = statistics.value.goodReviews
    const currentVipCards = statistics.value.vipCards

    Object.assign(statistics.value, {
      ...response,
      reserveCash: currentReserveCash,
      carRentalIncome: currentCarRentalIncome,
      hotelDeposit: currentHotelDeposit,
      restDeposit: currentRestDeposit,
      retainedAmount: currentRetainedAmount,
      goodReviews: currentGoodReviews,
      vipCards: currentVipCards
    })

    updateHandoverAmount()
  } catch (error) {
    console.error('获取统计数据失败:', error)
  }
}

// 保存交接班记录
async function saveHandover() {
  if (!cashierName.value.trim()) {
    $q.notify({
      type: 'negative',
      message: '请输入收银员姓名'
    })
    return
  }

  saving.value = true
  try {
    const handoverData = {
      type: roomType.value,
      details: receiptDetails.value,
      statistics: statistics.value,
      remarks: remarks.value,
      cashier_name: cashierName.value,
      shift_time: shiftTime.value,
      shift_date: date.formatDate(new Date(), 'YYYY-MM-DD')
    }

    const response = await api.post('/shift-handover/save', handoverData)

    if (response && response.success) {
      $q.notify({
        type: 'positive',
        message: '交接班记录已保存',
        icon: 'check_circle'
      })

      // 重置表单
      remarks.value = ''
      await loadHistoryRecords()
    }
  } catch (error) {
    console.error('保存交接班记录失败:', error)
    $q.notify({
      type: 'negative',
      message: '保存交接班记录失败'
    })
  } finally {
    saving.value = false
  }
}

// 打印交接单
function printHandover() {
  // 创建打印样式
  const printStyles = `
    <style>
      @media print {
        body { margin: 0; font-family: Arial, sans-serif; font-size: 12px; }
        .print-header { text-align: center; margin-bottom: 20px; }
        .print-title { font-size: 18px; font-weight: bold; }
        .print-date { font-size: 14px; margin-top: 5px; }
        .print-table { width: 100%; border-collapse: collapse; margin-bottom: 15px; }
        .print-table th, .print-table td { border: 1px solid #000; padding: 5px; text-align: center; }
        .print-table th { background-color: #f0f0f0; }
        .print-summary { display: flex; justify-content: space-between; }
        .print-section { margin-bottom: 15px; }
        .print-section h3 { margin: 0 0 10px 0; font-size: 14px; }
        @page { margin: 15mm; }
      }
    </style>
  `

  // 生成打印内容
  const printContent = `
    ${printStyles}
    <div class="print-header">
      <div class="print-title">交接班记录单</div>
      <div class="print-date">${currentDate.value}</div>
      <div>收银员：${cashierName.value} | 交班时间：${shiftTime.value}</div>
    </div>

    <div class="print-section">
      <h3>${roomType.value === 'hotel' ? '客房' : '休息房'}收款明细</h3>
      <table class="print-table">
        <thead>
          <tr>
            <th>房号</th>
            <th>单号</th>
            <th>房费</th>
            <th>押金</th>
            <th>支付方式</th>
            <th>总额</th>
            <th>开房时间</th>
            <th>退房时间</th>
          </tr>
        </thead>
        <tbody>
          ${receiptDetails.value.map(item => `
            <tr>
              <td>${item.room_number}</td>
              <td>${item.order_number}</td>
              <td>¥${(item.room_fee || 0).toFixed(2)}</td>
              <td>¥${(item.deposit || 0).toFixed(2)}</td>
              <td>${item.payment_method}</td>
              <td>¥${(item.total_amount || 0).toFixed(2)}</td>
              <td>${item.check_in_date}</td>
              <td>${item.check_out_date}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>

    <div class="print-summary">
      <div class="print-section">
        <h3>统计信息</h3>
        <div>备用金：¥${statistics.value.reserveCash.toFixed(2)}</div>
        <div>客房收入：¥${statistics.value.hotelIncome.toFixed(2)}</div>
        <div>休息房收入：¥${statistics.value.restIncome.toFixed(2)}</div>
        <div>租车收入：¥${statistics.value.carRentalIncome.toFixed(2)}</div>
        <div><strong>合计：¥${statistics.value.totalIncome.toFixed(2)}</strong></div>
        <div>客房退押：¥${statistics.value.hotelDeposit.toFixed(2)}</div>
        <div>休息退押：¥${statistics.value.restDeposit.toFixed(2)}</div>
        <div>留存款：¥${statistics.value.retainedAmount.toFixed(2)}</div>
        <div><strong>交接款：¥${statistics.value.handoverAmount.toFixed(2)}</strong></div>
      </div>

      <div class="print-section">
        <h3>特殊统计</h3>
        <div>好评：${statistics.value.goodReviews}</div>
        <div>大美卡：${statistics.value.vipCards}</div>
        <div>开房数：${statistics.value.totalRooms}</div>
        <div>休息房数：${statistics.value.restRooms}</div>
      </div>
    </div>

    ${remarks.value ? `
      <div class="print-section">
        <h3>备注</h3>
        <div>${remarks.value}</div>
      </div>
    ` : ''}
  `

  // 打开新窗口并打印
  const printWindow = window.open('', '_blank')
  printWindow.document.write(printContent)
  printWindow.document.close()
  printWindow.focus()
  printWindow.print()
  printWindow.close()
}

// 导出Excel
async function exportToExcel() {
  try {
    const response = await api.post('/shift-handover/export', {
      type: roomType.value,
      details: receiptDetails.value,
      statistics: statistics.value,
      date: date.formatDate(new Date(), 'YYYY-MM-DD')
    }, {
      responseType: 'blob'
    })

    // 创建下载链接
    const url = window.URL.createObjectURL(new Blob([response]))
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `交接班记录_${date.formatDate(new Date(), 'YYYY-MM-DD')}.xlsx`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)

    $q.notify({
      type: 'positive',
      message: 'Excel文件已下载'
    })
  } catch (error) {
    console.error('导出Excel失败:', error)
    $q.notify({
      type: 'negative',
      message: '导出Excel失败'
    })
  }
}

// 加载历史记录
async function loadHistoryRecords() {
  loadingHistory.value = true
  try {
    const endDate = date.formatDate(new Date(), 'YYYY-MM-DD')
    const startDate = date.formatDate(date.subtractFromDate(new Date(), { days: 30 }), 'YYYY-MM-DD')

    const response = await api.get('/shift-handover/history', {
      params: { startDate, endDate }
    })

    historyRecords.value = response.map(item => ({
      ...item,
      shift_date: date.formatDate(new Date(item.shift_date), 'YYYY-MM-DD'),
      created_at: date.formatDate(new Date(item.created_at), 'MM-DD HH:mm')
    }))
  } catch (error) {
    console.error('加载历史记录失败:', error)
    $q.notify({
      type: 'negative',
      message: '加载历史记录失败'
    })
  } finally {
    loadingHistory.value = false
  }
}

// 查看历史记录详情
function viewHandoverDetail(record) {
  // 这里可以实现查看详情的逻辑
  console.log('查看详情:', record)
}

// 组件挂载时初始化
onMounted(async () => {
  await switchRoomType(roomType.value)
  await loadHistoryRecords()
})
</script>

<style scoped>
.shift-handover {
  max-width: 1600px;
  margin: 0 auto;
  padding: 16px;
}

.q-table th {
  font-weight: bold;
  background-color: #f5f5f5;
}

.q-table .q-td {
  font-size: 0.85rem;
}

.q-input .q-field__native {
  text-align: right;
}

/* 增强标题区域的视觉效果 */
.q-card.bg-primary {
  background: linear-gradient(135deg, #1976D2 0%, #1565C0 100%) !important;
  border-radius: 12px;
}

/* 打印样式 */
@media print {
  .q-btn, .q-dialog {
    display: none !important;
  }

  .shift-handover {
    max-width: none;
    padding: 0;
  }

  .q-card {
    box-shadow: none;
    border: 1px solid #ddd;
  }

  .q-table {
    font-size: 11px;
  }
}

/* 响应式调整 */
@media (max-width: 768px) {
  .q-table {
    font-size: 0.75rem;
  }

  .q-card-section {
    padding: 8px;
  }

  .shift-handover {
    padding: 8px;
  }
}
</style>
