<template>
  <div class="check-data-container">
    <!-- 加载状态 -->
    <div v-if="isLoadingData" class="loading-container">
      <q-spinner-dots color="primary" size="50px" />
      <div class="text-body1 text-grey-7 q-mt-md">正在加载账单数据...</div>
    </div>

    <!-- 核对数据卡片 -->
    <q-card v-else flat bordered>
      <q-card-section>
        <div class="row items-center justify-between q-mb-md q-gutter-sm header-bar">
          <div class="text-h6 row items-center no-wrap">
            <q-icon name="fact_check" color="primary" class="q-mr-sm" />
            <span>请核对交接数据</span>
          </div>
          <q-input
            v-model="selectedDate"
            type="date"
            dense
            outlined
            label="账单日期"
            class="date-picker-input"
            @update:model-value="onDateChange"
          >
            <template #prepend>
              <q-icon name="event" />
            </template>
          </q-input>
        </div>

        <!-- 客房数据表格 -->
        <div class="data-check-section q-mb-lg">
          <div class="section-header row items-center justify-between q-mb-sm">
            <div class="text-subtitle1 text-weight-medium">客房数据</div>
            <q-btn
              size="sm"
              color="positive"
              outline
              icon="done_all"
              label="一键确认"
              @click="confirmAllRows('hotel')"
              :disable="isHotelBulkConfirmDisabled"
            >
              <q-tooltip>确认所有客房账单</q-tooltip>
            </q-btn>
          </div>

          <!-- 无数据提示 -->
          <div v-if="hotelRoomData.length === 0" class="no-data-hint q-pa-md text-center">
            <q-icon name="info" size="32px" color="grey-5" />
            <div class="text-body2 text-grey-6 q-mt-sm">今日暂无客房账单数据</div>
          </div>

          <q-table
            v-else
            :rows="hotelRoomData"
            :columns="roomColumns"
            row-key="billId"
            flat
            bordered
            hide-pagination
            :pagination="{ rowsPerPage: 0 }"
            class="data-check-table"
          >
            <template v-slot:body-cell-actions="props">
              <q-td :props="props" class="text-center">
                <div class="action-buttons">
                  <q-btn
                    size="sm"
                    round
                    dense
                    color="positive"
                    icon="check"
                    @click="confirmRow(props.row, 'hotel')"
                    :disable="props.row.confirmed"
                    class="q-mr-xs"
                  >
                    <q-tooltip>确认数据无误</q-tooltip>
                  </q-btn>
                  <q-btn
                    size="sm"
                    round
                    dense
                    color="primary"
                    icon="edit"
                    @click="editRow(props.row)"
                  >
                    <q-tooltip>{{ props.row.isAggregatedRoomFee ? '修改汇总后自动按日平均分配' : '修改数据' }}</q-tooltip>
                  </q-btn>
                </div>
              </q-td>
            </template>
            <template v-slot:body-cell-billId="props">
              <q-td :props="props">
                <span :class="props.row.confirmed ? 'text-positive' : ''">
                  {{ props.value }}
                </span>
              </q-td>
            </template>
          </q-table>

          <!-- 客房汇总行 -->
          <div class="summary-row q-pa-md bg-grey-1">
            <div class="text-weight-medium">
              <div class="row items-center q-mb-xs">
                <div class="col-2">汇总</div>
                <div class="col">
                  <span v-for="(amount, type) in hotelSummary.byType" :key="type" class="q-mr-md">
                    {{ type }}: ¥{{ amount.toFixed(2) }}
                  </span>
                </div>
                <div class="col-auto text-primary text-h6">
                  合计: ¥{{ hotelSummary.totalAmount.toFixed(2) }}
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 休息房数据表格 -->
        <div class="data-check-section q-mb-lg">
          <div class="section-header row items-center justify-between q-mb-sm">
            <div class="text-subtitle1 text-weight-medium">休息房数据</div>
            <q-btn
              size="sm"
              color="positive"
              outline
              icon="done_all"
              label="一键确认"
              @click="confirmAllRows('rest')"
              :disable="isRestBulkConfirmDisabled"
            >
              <q-tooltip>确认所有休息房账单</q-tooltip>
            </q-btn>
          </div>

          <!-- 无数据提示 -->
          <div v-if="restRoomData.length === 0" class="no-data-hint q-pa-md text-center">
            <q-icon name="info" size="32px" color="grey-5" />
            <div class="text-body2 text-grey-6 q-mt-sm">今日暂无休息房账单数据</div>
          </div>

          <q-table
            v-else
            :rows="restRoomData"
            :columns="roomColumns"
            row-key="billId"
            flat
            bordered
            hide-pagination
            :pagination="{ rowsPerPage: 0 }"
            class="data-check-table"
          >
            <template v-slot:body-cell-actions="props">
              <q-td :props="props" class="text-center">
                <div class="action-buttons">
                  <q-btn
                    size="sm"
                    round
                    dense
                    color="positive"
                    icon="check"
                    @click="confirmRow(props.row, 'rest')"
                    :disable="props.row.confirmed"
                    class="q-mr-xs"
                  >
                    <q-tooltip>确认数据无误</q-tooltip>
                  </q-btn>
                  <q-btn
                    size="sm"
                    round
                    dense
                    color="primary"
                    icon="edit"
                    @click="editRow(props.row)"
                  >
                    <q-tooltip>{{ props.row.isAggregatedRoomFee ? '修改汇总后自动按日平均分配' : '修改数据' }}</q-tooltip>
                  </q-btn>
                </div>
              </q-td>
            </template>
            <template v-slot:body-cell-billId="props">
              <q-td :props="props">
                <span :class="props.row.confirmed ? 'text-positive' : ''">
                  {{ props.value }}
                </span>
              </q-td>
            </template>
          </q-table>

          <!-- 休息房汇总行 -->
          <div class="summary-row q-pa-md bg-grey-1">
            <div class="text-weight-medium">
              <div class="row items-center q-mb-xs">
                <div class="col-2">汇总</div>
                <div class="col">
                  <span v-for="(amount, type) in restSummary.byType" :key="type" class="q-mr-md">
                    {{ type }}: ¥{{ amount.toFixed(2) }}
                  </span>
                </div>
                <div class="col-auto text-primary text-h6">
                  合计: ¥{{ restSummary.totalAmount.toFixed(2) }}
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 确认核对按钮 -->
        <div class="text-center">
          <q-btn
            :color="dataCheckCompleted ? 'grey-6' : 'positive'"
            :icon="dataCheckCompleted ? 'check_circle' : 'verified'"
            :label="dataCheckCompleted ? '数据核对已完成' : '确认核对'"
            size="md"
            @click="confirmDataCheck"
            :loading="isConfirmingData"
            :disable="isConfirmingData || !allDataConfirmed || dataCheckCompleted"
          />
        </div>
      </q-card-section>
    </q-card>

    <!-- 修改数据对话框 -->
    <q-dialog v-model="editDialog.show" persistent>
      <q-card style="min-width: 400px;">
        <q-card-section>
          <div class="text-h6">修改数据</div>
        </q-card-section>

        <q-card-section>
          <div class="q-mb-md">
            <strong>账单ID：</strong>{{ editDialog.data.billId }}
          </div>
          <div class="q-mb-md">
            <strong>订单号：</strong>{{ editDialog.data.orderNo }}
          </div>
          <q-banner
            v-if="editDialog.isAggregated"
            inline-actions
            dense
            class="bg-blue-1 text-blue-9 q-pa-sm q-mb-md rounded-borders"
          >
            汇总房费修改后，将平均分配到 {{ editDialog.aggregatedBills.length }} 天的原始房费账单。
          </q-banner>
          <div class="q-mb-md">
            <q-select
              v-model="editDialog.data.changeType"
              :options="changeTypeOptions"
              label="账单类型"
              outlined
              emit-value
              map-options
              :disable="editDialog.isAggregated"
            />
          </div>
          <div class="q-mb-md">
            <q-input
              v-model.number="editDialog.data.amount"
              type="number"
              label="金额"
              outlined
              prefix="¥"
              :hint="editDialog.isAggregated ? '修改后的总房费将平均分配到各日' : '正数表示收入，负数表示支出'"
            />
          </div>
        </q-card-section>

        <q-card-actions align="right">
          <q-btn
            color="negative"
            icon="close"
            label="取消"
            flat
            @click="cancelEdit"
            :disable="isSavingEdit"
          />
          <q-btn
            color="positive"
            icon="check"
            label="确认"
            @click="saveEdit"
            :loading="isSavingEdit"
            :disable="isSavingEdit"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useQuasar } from 'quasar'
import Decimal from 'decimal.js'
import { billApi } from '../../api/index.js'

const $q = useQuasar()

const PAY_WAY_KEYS = ['现金', '微信', '微邮付', '其他']
const INCOME_CHANGE_TYPES = ['房费', '收押', '押金', '补收', '订单账单']

Decimal.set({
  precision: 20,
  rounding: Decimal.ROUND_HALF_UP
})

const toDecimal = (value) => {
  if (Decimal.isDecimal(value)) {
    return value
  }
  if (value === undefined || value === null) {
    return new Decimal(0)
  }
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (trimmed === '') {
      return new Decimal(0)
    }
    const parsed = Number(trimmed)
    return Number.isNaN(parsed) ? new Decimal(0) : new Decimal(parsed)
  }
  if (typeof value === 'number') {
    return Number.isNaN(value) ? new Decimal(0) : new Decimal(value)
  }
  const parsed = Number(value)
  return Number.isNaN(parsed) ? new Decimal(0) : new Decimal(parsed)
}

const toAmountNumber = (value, places = 2) =>
  Number(toDecimal(value).toDecimalPlaces(places, Decimal.ROUND_HALF_UP).toString())

const normalizePayWay = (payWay) => (PAY_WAY_KEYS.includes(payWay) ? payWay : '其他')


// 创建四种支付方式汇总对象
const createPaywayBucket = (seed = {}) => {
  const bucket = {}
  PAY_WAY_KEYS.forEach(key => {
    const source = Object.prototype.hasOwnProperty.call(seed, key) ? seed[key] : 0
    bucket[key] = toAmountNumber(source)
  })
  return bucket
}

// 创建表格数据汇总对象
const createSummaryBuckets = () => ({
  hotelIncome: createPaywayBucket(),
  restIncome: createPaywayBucket(),
  hotelRefundDeposit: createPaywayBucket(),
  restRefundDeposit: createPaywayBucket()
})

/**
 * 增加汇总对象中指定支付方式的金额
 * @param bucket 汇总对象
 * @param payWay 支付方式
 * @param amount 金额
 * @param param3 选项对象，absolute 表示是否取绝对值
 */
const incrementBucket = (bucket, payWay, amount, { absolute = false } = {}) => {
  if (!bucket) {
    return
  }
  const key = normalizePayWay(payWay)
  const delta = absolute ? toDecimal(amount).abs() : toDecimal(amount)
  const updated = toDecimal(bucket[key]).plus(delta)
    bucket[key] = toAmountNumber(updated)
  }

// 账单类型选项
const changeTypeOptions = [
  '房费',
  '收押',
  '补收',
  '退押',
  '退款',
]

const REFUND_CHANGE_TYPES = ['退押', '退押金', '退款']

const formatLocalDate = (date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const getDefaultHandoverDate = () => {
  const date = new Date()
  date.setDate(date.getDate() - 1)
  return date
}

const selectedDate = ref(formatLocalDate(getDefaultHandoverDate()))

// 响应式数据
const isConfirmingData = ref(false)
const dataCheckCompleted = ref(false) // 数据核对是否已完成
const isLoadingData = ref(false) // 是否正在加载数据
const isSavingEdit = ref(false) // 是否正在保存编辑

// 表格列定义
const roomColumns = [
  {
    name: 'billId',
    label: '账单ID',
    field: 'billId',
    align: 'left',
    headerStyle: 'font-weight: bold;'
  },
  {
    name: 'orderNo',
    label: '订单号',
    field: 'orderNo',
    align: 'left',
    headerStyle: 'font-weight: bold;'
  },
  {
    name: 'roomNo',
    label: '房号',
    field: 'roomNo',
    align: 'center',
    headerStyle: 'font-weight: bold;'
  },
  {
    name: 'guestName',
    label: '姓名',
    field: 'guestName',
    align: 'center',
    headerStyle: 'font-weight: bold;'
  },
  {
    name: 'changeType',
    label: '账单类型',
    field: 'changeType',
    align: 'center',
    headerStyle: 'font-weight: bold;'
  },
  {
    name: 'amount',
    label: '金额',
    field: 'amount',
    align: 'center',
    headerStyle: 'font-weight: bold;',
    format: val => {
      if (val === 0) return '-'
      const prefix = val > 0 ? '+' : ''
      return `${prefix}¥${val.toFixed(2)}`
    }
  },
  {
    name: 'payWay',
    label: '支付方式',
    field: 'payWay',
    align: 'center',
    headerStyle: 'font-weight: bold;'
  },
  {
    name: 'actions',
    label: '操作',
    field: 'actions',
    align: 'center',
    headerStyle: 'font-weight: bold;'
  }
]

// 客房数据
const hotelRoomData = ref([])

// 休息房数据
const restRoomData = ref([])

// 编辑对话框数据
const editDialog = ref({
  show: false,
  data: {
    billId: '',
    orderNo: '',
    changeType: '',
    amount: 0
  },
  originalData: null,
  isAggregated: false,
  aggregatedBills: []
})

// 汇总数据对象（按支付方式统计）
const summaryDataObject = ref(createSummaryBuckets())

// 对账单数据进行汇总统计
const summarizeRoomData = (rows = []) => {
  const totalDecimal = rows.reduce((sum, item) => sum.plus(toDecimal(item.amount || 0)), new Decimal(0))
  const byTypeDecimal = {}

  // 按账单类型汇总
  rows.forEach(bill => {
    const type = bill.changeType || '未知'
    const amountDecimal = toDecimal(bill.amount || 0)
    if (!byTypeDecimal[type]) {
      byTypeDecimal[type] = amountDecimal
    } else {
      byTypeDecimal[type] = byTypeDecimal[type].plus(amountDecimal)
    }
  })

  // 转换为普通数字
  const byType = {}
  Object.keys(byTypeDecimal).forEach(key => {
    byType[key] = toAmountNumber(byTypeDecimal[key])
  })

  return {
    totalAmount: toAmountNumber(totalDecimal),
    byType
  }
}

// 计算属性 - 客房汇总
const hotelSummary = computed(() => summarizeRoomData(hotelRoomData.value))

// 计算属性 - 休息房汇总
const restSummary = computed(() => summarizeRoomData(restRoomData.value))

// 计算属性 - 是否所有数据都已确认
const allDataConfirmed = computed(() => {
  const hotelData = hotelRoomData.value || []
  const restData = restRoomData.value || []

  // 如果没有数据，返回 true（允许跳过）
  const totalCount = hotelData.length + restData.length
  if (totalCount === 0) {
    return true
  }

  // 检查所有数据是否都已确认
  const allHotelConfirmed = hotelData.every(item => item.confirmed)
  const allRestConfirmed = restData.every(item => item.confirmed)

  return allHotelConfirmed && allRestConfirmed
})

const isHotelBulkConfirmDisabled = computed(() => {
  const hotelData = hotelRoomData.value || []
  return hotelData.length === 0 || hotelData.every(item => item.confirmed)
})

const isRestBulkConfirmDisabled = computed(() => {
  const restData = restRoomData.value || []
  return restData.length === 0 || restData.every(item => item.confirmed)
})


/**
 * 将单个账单对象映射为表格行数据
 * @param {Object} bill - 账单对象
 * @param {Object} overrides - 可选的覆盖字段
 * @return {Object} - 映射后的表格行数据
 */
const mapBillToRow = (bill, overrides = {}) => {
  const normalizedAmount = overrides.amount !== undefined ? overrides.amount : (parseFloat(bill.change_price) || 0)
  const changeType = overrides.changeType || bill.change_type
  const signedAmount = REFUND_CHANGE_TYPES.includes(changeType) ? -Math.abs(normalizedAmount) : normalizedAmount
  const normalizedSignedAmount = toAmountNumber(signedAmount)
  const normalizedPayWay = overrides.payWay !== undefined ? overrides.payWay : (bill.pay_way || '其他')
  const row = {
    billId: overrides.billId !== undefined ? overrides.billId : bill.bill_id,
    orderNo: bill.order_id,
    roomNo: bill.room_number || '未知',
    guestName: bill.guest_name || '未知',
    changeType,
    amount: normalizedSignedAmount,
    payWay: normalizedPayWay,
    stayDate: bill.stay_date,
    createTime: overrides.createTime || bill.create_time,
    confirmed: false,
    isAggregatedRoomFee: Boolean(overrides.isAggregatedRoomFee)
  }

  if (overrides.aggregatedBillIds) {
    row.aggregatedBillIds = overrides.aggregatedBillIds
  }
  if (overrides.aggregatedBills) {
    row.aggregatedBills = overrides.aggregatedBills.map(item => ({
      ...item,
      change_price: toAmountNumber(item.change_price)
    }))
  }

  return row
}

const extractDatePart = (value = '') => {
  if (!value) {
    return ''
  }
  if (typeof value !== 'string') {
    return ''
  }
  if (value.includes('T')) {
    return value.split('T')[0]
  }
  if (value.includes(' ')) {
    return value.split(' ')[0]
  }
  return value.slice(0, 10)
}

const matchesTargetDate = (bill, targetDate) => {
  const createDate = extractDatePart(bill.create_time)
  if (createDate) {
    return createDate === targetDate
  }
  return extractDatePart(bill.stay_date) === targetDate
}

// 构建表格行数据，汇总同一订单的房费账单
const buildTableRows = (bills = [], targetDate) => {
  if (!Array.isArray(bills)) {
    return []
  }

  const filteredBills = bills.filter(bill => matchesTargetDate(bill, targetDate))
  const rows = []
  const aggregateGroups = new Map()

  filteredBills.forEach(bill => {
    const rawAmount = parseFloat(bill.change_price) || 0
    const normalizedAmount = REFUND_CHANGE_TYPES.includes(bill.change_type) ? -Math.abs(rawAmount) : rawAmount

    if (bill.change_type === '房费') {
      const aggregateKey = `${bill.order_id || bill.bill_id}-${targetDate}`

      if (!aggregateGroups.has(aggregateKey)) {
        aggregateGroups.set(aggregateKey, {
          firstBill: bill,
          totalAmount: new Decimal(0),
          billIds: [],
          payWays: new Set(),
          bills: []
        })

        rows.push({ __aggregateKey: aggregateKey })
      }

      const group = aggregateGroups.get(aggregateKey)
      const normalizedDecimal = toDecimal(normalizedAmount)
      group.totalAmount = group.totalAmount.plus(normalizedDecimal)
      group.billIds.push(bill.bill_id)
      group.bills.push({
        ...bill,
        change_price: toAmountNumber(normalizedDecimal)
      })
      if (bill.pay_way) {
        group.payWays.add(bill.pay_way)
      }
    } else {
      rows.push(mapBillToRow(bill))
    }
  })

  return rows.map(row => {
    if (!row.__aggregateKey) {
      row.isAggregatedRoomFee = false
      return row
    }

    const group = aggregateGroups.get(row.__aggregateKey)
    if (!group) {
      return row
    }

    const { firstBill, totalAmount, billIds, payWays } = group
    const isAggregated = billIds.length > 1
    const payWayCount = payWays.size
    let payWayLabel = '其他'

    if (payWayCount === 1) {
      payWayLabel = Array.from(payWays)[0]
    } else if (payWayCount > 1) {
      payWayLabel = '多渠道'
    }

    return mapBillToRow(firstBill, {
      billId: isAggregated ? `ROOMFEE-${firstBill.order_id || firstBill.bill_id}-${targetDate}` : billIds[0],
      amount: toAmountNumber(totalAmount),
      payWay: payWayLabel,
      createTime: targetDate,
      isAggregatedRoomFee: isAggregated,
      aggregatedBillIds: billIds,
      aggregatedBills: group.bills
    })
  })
}

const onDateChange = (value) => {
  if (!value) {
    return
  }
  loadBillsData(value)
}

// 计算并更新汇总数据对象
const calculateSummaryData = () => {
  // 重置汇总对象
  summaryDataObject.value = createSummaryBuckets()

  // 统计客房数据
  hotelRoomData.value.forEach(bill => {
    const payWay = bill.payWay || '其他'
    const changeType = bill.changeType
    const amount = bill.amount || 0

    // 确保支付方式存在于对象中
    const normalizedPayWay = normalizePayWay(payWay)

    // 根据账单类型分类统计
    if (INCOME_CHANGE_TYPES.includes(changeType)) {
      // 收入类型：房费 + 收押 + 补收 + 订单账单（兼容旧数据）
      incrementBucket(summaryDataObject.value.hotelIncome, normalizedPayWay, amount)
      console.log(`💰 [收入统计] 客房收入: ${bill.orderNo}, 类型: ${changeType}, 金额: ${amount}, 支付方式: ${normalizedPayWay}`)
    } else if (changeType === '退押' || changeType === '退押金' || changeType === '退款') {
      // 退押金/退款是负数，取绝对值统计实退金额（合并到退押列）
      incrementBucket(summaryDataObject.value.hotelRefundDeposit, normalizedPayWay, amount, { absolute: true })
      console.log(`💰 [退款统计] 客房退款/退押: ${bill.orderNo}, 类型: ${changeType}, 金额: ${amount}, 支付方式: ${normalizedPayWay}`)
    } else {
      // 未知类型，记录警告
      console.warn(`⚠️ [未知类型] 客房账单: ${bill.orderNo}, 类型: ${changeType}, 金额: ${amount}`)
    }
  })

  // 统计休息房数据
  restRoomData.value.forEach(bill => {
    const payWay = bill.payWay || '其他'
    const changeType = bill.changeType
    const amount = bill.amount || 0

    // 确保支付方式存在于对象中
    const normalizedPayWay = normalizePayWay(payWay)

    // 根据账单类型分类统计
    if (INCOME_CHANGE_TYPES.includes(changeType)) {
      // 收入类型：房费 + 收押 + 补收 + 订单账单（兼容旧数据）
      incrementBucket(summaryDataObject.value.restIncome, normalizedPayWay, amount)
      console.log(`💰 [收入统计] 休息房收入: ${bill.orderNo}, 类型: ${changeType}, 金额: ${amount}, 支付方式: ${normalizedPayWay}`)
    } else if (changeType === '退押' || changeType === '退押金' || changeType === '退款') {
      // 退押金/退款是负数，取绝对值统计实退金额（合并到退押列）
      incrementBucket(summaryDataObject.value.restRefundDeposit, normalizedPayWay, amount, { absolute: true })
      console.log(`💰 [退款统计] 休息房退款/退押: ${bill.orderNo}, 类型: ${changeType}, 金额: ${amount}, 支付方式: ${normalizedPayWay}`)
    } else {
      // 未知类型，记录警告
      console.warn(`⚠️ [未知类型] 休息房账单: ${bill.orderNo}, 类型: ${changeType}, 金额: ${amount}`)
    }
  })

  console.log('📊 [汇总对象更新]:', JSON.parse(JSON.stringify(summaryDataObject.value)))
  console.log('📊 [客房退押详情]:', summaryDataObject.value.hotelRefundDeposit)
  console.log('📊 [休息退押详情]:', summaryDataObject.value.restRefundDeposit)
}

// 确认行数据
const confirmRow = (row, type) => {
  row.confirmed = true
  // 确认后重新计算汇总数据
  calculateSummaryData()
}

const confirmAllRows = (type) => {
  const isRest = type === 'rest'
  const targetData = isRest ? restRoomData.value : hotelRoomData.value

  if (!targetData || targetData.length === 0) {
    $q.notify({
      type: 'info',
      message: isRest ? '暂无休息房账单可以确认' : '暂无客房账单可以确认',
      position: 'top'
    })
    return
  }

  const pendingRows = targetData.filter(item => !item.confirmed)

  if (pendingRows.length === 0) {
    $q.notify({
      type: 'info',
      message: isRest ? '休息房账单已全部确认' : '客房账单已全部确认',
      position: 'top'
    })
    return
  }

  pendingRows.forEach(row => {
    row.confirmed = true
  })

  calculateSummaryData()

  $q.notify({
    type: 'positive',
    message: isRest ? '休息房账单已全部确认' : '客房账单已全部确认',
    position: 'top'
  })
}

// 编辑行数据
const editRow = (row) => {
  const isAggregated = Boolean(row.isAggregatedRoomFee && Array.isArray(row.aggregatedBillIds) && row.aggregatedBillIds.length > 1)
  const aggregatedBills = isAggregated ? (row.aggregatedBills || []) : []

  editDialog.value.data = {
    billId: row.billId,
    orderNo: row.orderNo,
    changeType: isAggregated ? '房费' : row.changeType,
    amount: row.amount
  }
  editDialog.value.originalData = row
  editDialog.value.isAggregated = isAggregated
  editDialog.value.aggregatedBills = aggregatedBills.slice()
  editDialog.value.show = true
}

// 取消编辑
const cancelEdit = () => {
  editDialog.value.show = false
  editDialog.value.data = {
    billId: '',
    orderNo: '',
    changeType: '',
    amount: 0
  }
  editDialog.value.originalData = null
  editDialog.value.isAggregated = false
  editDialog.value.aggregatedBills = []
}

const toTimestamp = (value, fallback = Number.POSITIVE_INFINITY) => {
  if (!value) {
    return fallback
  }

  if (typeof value === 'string') {
    let normalized = value.includes('T') ? value : value.replace(' ', 'T')
    normalized = normalized.replace(/(\.\d{3})\d+$/, '$1')
    const timestamp = Date.parse(normalized)
    return Number.isNaN(timestamp) ? fallback : timestamp
  }

  if (value instanceof Date) {
    const timestamp = value.getTime()
    return Number.isNaN(timestamp) ? fallback : timestamp
  }

  if (typeof value === 'number') {
    return Number.isNaN(value) ? fallback : value
  }

  const timestamp = Date.parse(value)
  return Number.isNaN(timestamp) ? fallback : timestamp
}

const getBillSortKey = (bill = {}) => {
  const stayDate = bill.stay_date
  if (stayDate) {
    const normalizedStayDate = stayDate.includes('T') ? stayDate : `${stayDate}T00:00:00`
    const stayTimestamp = toTimestamp(normalizedStayDate)
    if (Number.isFinite(stayTimestamp)) {
      return stayTimestamp
    }
  }
  return toTimestamp(bill.create_time)
}

const sortBillsChronologically = (bills = []) => bills.slice().sort((a, b) => getBillSortKey(a) - getBillSortKey(b))

// 平均分配总金额到指定份数，处理四舍五入问题
const distributeAmountEvenly = (totalAmount, count) => {
  if (count <= 0) {
    return []
  }

  const totalCents = Math.round(toDecimal(totalAmount).mul(100).toNumber())
  const sign = totalCents >= 0 ? 1 : -1
  const absTotal = Math.abs(totalCents)
  const baseCents = Math.floor(absTotal / count)
  let remainder = absTotal - baseCents * count
  const result = []

  for (let i = 0; i < count; i += 1) {
    let cents = baseCents
    if (remainder > 0) {
      cents += 1
      remainder -= 1
    }
    result.push((cents * sign) / 100)
  }

  return result
}


// 在用户修改“汇总房费”后，将修改的总金额平均分配到每一天的原始房费账单中，并同步更新数据库与前端表格数据
const saveAggregatedRoomFee = async () => {
  const originalRow = editDialog.value.originalData
  if (!originalRow) {
    throw new Error('未找到需要更新的账单记录')
  }

  const sourceBills = editDialog.value.aggregatedBills.length > 0
    ? editDialog.value.aggregatedBills
    : (originalRow.aggregatedBills || [])

  if (!Array.isArray(sourceBills) || sourceBills.length === 0) {
    throw new Error('未找到原始房费明细，无法更新')
  }

  const rawAmount = editDialog.value.data.amount
  if (Number.isNaN(Number(rawAmount))) {
    throw new Error('请输入有效的金额')
  }
  const totalAmount = toAmountNumber(rawAmount)

  const sortedBills = sortBillsChronologically(sourceBills)
  const distributedAmounts = distributeAmountEvenly(totalAmount, sortedBills.length)

  const updatedBills = []

  for (let i = 0; i < sortedBills.length; i += 1) {
    const bill = sortedBills[i]
    const newAmount = distributedAmounts[i]
    const payload = {
      change_type: '房费',
      change_price: newAmount
    }

    console.log('🧮 [saveAggregatedRoomFee] 准备更新多日房费账单:', {
      billId: bill.bill_id,
      orderNo: bill.order_id,
      stayDate: bill.stay_date,
      newAmount
    })

    const response = await billApi.updateBill(bill.bill_id, payload)

    if (!response.success || !response.data) {
      throw new Error(response.message || `账单 ${bill.bill_id} 更新失败`)
    }

    const updatedBill = response.data
    updatedBills.push({
      ...bill,
      ...updatedBill,
      change_price: parseFloat(updatedBill.change_price) || newAmount,
      stay_date: updatedBill.stay_date || bill.stay_date,
      create_time: updatedBill.create_time || bill.create_time,
      pay_way: updatedBill.pay_way || bill.pay_way
    })
  }

  const payWaySet = new Set(updatedBills.map(item => item.pay_way).filter(Boolean))
  const newPayWay = payWaySet.size === 0 ? '其他' : (payWaySet.size === 1 ? Array.from(payWaySet)[0] : '多渠道')

  originalRow.amount = totalAmount
  originalRow.changeType = '房费'
  originalRow.payWay = newPayWay
  originalRow.confirmed = false
  originalRow.aggregatedBills = updatedBills
  originalRow.aggregatedBillIds = updatedBills.map(item => item.bill_id)

  editDialog.value.aggregatedBills = updatedBills

  dataCheckCompleted.value = false
  calculateSummaryData()

  return {
    totalAmount,
    billCount: updatedBills.length
  }
}

// 保存编辑
const saveEdit = async () => {
  if (!editDialog.value.originalData) {
    return
  }

  try {
    isSavingEdit.value = true

    if (editDialog.value.isAggregated) {
      const { totalAmount, billCount } = await saveAggregatedRoomFee()

      $q.notify({
        type: 'positive',
        message: `汇总房费已更新为 ¥${totalAmount.toFixed(2)}，并平均分配至 ${billCount} 天，记得重新确认数据`,
        position: 'top'
      })

      cancelEdit()
      return
    }

    const updateData = {
      change_type: editDialog.value.data.changeType,
      change_price: editDialog.value.data.amount
    }

    console.log('📝 [saveEdit] 准备更新账单:', {
      billId: editDialog.value.data.billId,
      updateData
    })

    const response = await billApi.updateBill(editDialog.value.data.billId, updateData)

    console.log('✅ [saveEdit] API返回数据:', response)

    if (!response.success || !response.data) {
      throw new Error(response.message || '更新失败')
    }

    const updatedBill = response.data
    const originalRow = editDialog.value.originalData

    originalRow.changeType = updatedBill.change_type
    originalRow.amount = parseFloat(updatedBill.change_price) || 0
    originalRow.payWay = updatedBill.pay_way
    originalRow.confirmed = false // 修改后需要重新确认

    dataCheckCompleted.value = false

    calculateSummaryData()

    $q.notify({
      type: 'positive',
      message: `账单 ${editDialog.value.data.billId} 更新成功，请重新确认数据`,
      position: 'top'
    })

    cancelEdit()
  } catch (error) {
    console.error('❌ [saveEdit] 更新账单失败:', error)
    $q.notify({
      type: 'negative',
      message: error.message || '更新账单失败，请重试',
      position: 'top'
    })
  } finally {
    isSavingEdit.value = false
  }
}

// 确认数据核对
const confirmDataCheck = async () => {
  // 如果已经完成，直接返回
  if (dataCheckCompleted.value) {
    $q.notify({
      type: 'info',
      message: '数据核对已完成，无需重复操作',
      position: 'top'
    })
    return
  }

  try {
    isConfirmingData.value = true

    // 计算最终汇总数据
    calculateSummaryData()

    // 设置为已完成状态
    dataCheckCompleted.value = true

  } catch (error) {
    console.error('确认数据核对失败:', error)
    $q.notify({
      type: 'negative',
      message: '确认数据核对失败，请重试',
      position: 'top'
    })
  } finally {
    isConfirmingData.value = false
  }
}

// 加载账单数据
const loadBillsData = async (targetDate) => {
  try {
    isLoadingData.value = true

    const fallbackDate = targetDate || selectedDate.value || formatLocalDate(new Date())
    const checkDateStr = fallbackDate || formatLocalDate(new Date())
    selectedDate.value = checkDateStr
    dataCheckCompleted.value = false

    // 调用API获取指定日期的账单数据
    const response = await billApi.getBillsByDate(checkDateStr)

    if (response.success) {
      const {
        hotelBills = [],
        restBills = [],
        totalCount = 0
      } = response.data || {}

      console.log('📊 [CheckData] API返回数据:', {
        hotelBills: hotelBills.length,
        restBills: restBills.length,
        totalCount,
        hotelBillsData: hotelBills,
        restBillsData: restBills
      })

      const hotelRows = buildTableRows(hotelBills, checkDateStr)
      const restRows = buildTableRows(restBills, checkDateStr)

      hotelRoomData.value = hotelRows
      restRoomData.value = restRows

      console.log('✅ [CheckData] 数据转换完成:', {
        checkDate: checkDateStr,
        hotelCount: hotelRoomData.value.length,
        restCount: restRoomData.value.length,
        totalCount,
        hotelAggregatedCount: hotelRows.filter(item => item.isAggregatedRoomFee).length,
        restAggregatedCount: restRows.filter(item => item.isAggregatedRoomFee).length
      })

      // 加载数据后初始计算汇总数据
      calculateSummaryData()
    } else {
      throw new Error(response.message || '加载失败')
    }

  } catch (error) {
    console.error('加载账单数据失败:', error)
    $q.notify({
      type: 'negative',
      message: error.message || '加载账单数据失败，请重试',
      position: 'top'
    })
  } finally {
    isLoadingData.value = false
  }
}

// 生命周期
onMounted(() => {
  // 默认加载当前选择日期（当天）的账单数据
  loadBillsData()
})

// 暴露数据给父组件
defineExpose({
  hotelRoomData,
  restRoomData,
  hotelSummary,
  restSummary,
  dataCheckCompleted,
  allDataConfirmed,
  summaryDataObject,  // 暴露汇总数据对象给步骤4使用
  selectedDate,
  loadBillsData
})
</script>

<style scoped>
.check-data-container {
  padding: 20px;
  max-width: 1000px;
  margin: 0 auto;
}

/* 加载状态样式 */
.loading-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  min-height: 400px;
}

/* 无数据提示样式 */
.no-data-hint {
  background: rgba(245, 245, 245, 0.5);
  border: 1px dashed #d0d0d0;
  border-radius: 8px;
  margin-bottom: 16px;
}

/* 数据检查表格样式 */
.data-check-table {
  background: rgba(255, 255, 255, 0.95);
  border-radius: 8px;
}

.data-check-table :deep(.q-table__top) {
  padding: 16px;
}

.data-check-table :deep(.q-table__bottom) {
  display: none;
}

.data-check-table :deep(th) {
  background: #f5f5f5;
  font-weight: 600;
  color: #333;
}

.data-check-table :deep(td) {
  padding: 12px 8px;
  vertical-align: middle; /* 确保垂直居中 */
}

.header-bar {
  flex-wrap: wrap;
}

.date-picker-input {
  min-width: 180px;
}

/* 汇总行样式 */
.summary-row {
  border-radius: 0 0 8px 8px;
  border: 1px solid #e0e0e0;
  border-top: none;
  background-color: #f8f9fa !important;
}

/* 数据检查部分样式 */
.data-check-section {
  margin-bottom: 24px;
}

.section-header {
  gap: 12px;
}

.data-check-section .text-subtitle1 {
  color: #1976d2;
  border-bottom: 2px solid #e3f2fd;
  padding-bottom: 8px;
}

/* 操作按钮居中样式 */
.action-buttons {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 4px; /* 按钮间距 */
}

/* 响应式设计 */
@media (max-width: 768px) {
  .check-data-container {
    padding: 16px;
  }

  .data-check-table :deep(td) {
    padding: 8px 4px;
  }

  .data-check-table :deep(.q-btn) {
    min-width: 32px;
  }

  .action-buttons {
    gap: 2px; /* 移动端减小按钮间距 */
  }

  .date-picker-input {
    width: 100%;
  }

  .summary-row .row > div {
    font-size: 12px;
  }
}
</style>
