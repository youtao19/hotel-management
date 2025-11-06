<template>
  <div class="handover-process">
    <!-- 步骤1: 检查记录 -->
    <div v-if="currentStep === 1" class="step-1-content">
      <q-card flat bordered>
        <q-card-section>
          <div class="row items-center q-mb-md">
            <div class="col">
              <div class="text-h6">
                <q-icon name="history" color="primary" class="q-mr-sm" />
                昨日交接记录检查
              </div>
              <div class="text-body2 text-grey-7">
                检查昨日是否有未完成的交接记录，确保数据连续性
              </div>
            </div>
            <div class="col-auto">
              <q-btn
                color="primary"
                icon="search"
                label="检查昨日记录"
                @click="checkYesterdayRecord"
                :loading="isCheckingRecord"
                :disable="isCheckingRecord"
              />
            </div>
          </div>

          <!-- 检查结果显示区域 -->
          <div v-if="!isCheckingRecord && recordCheckResult.checked" class="record-check q-mt-md">
            <q-card flat bordered class="check-result-card">
              <q-card-section>
                <!-- 有记录的情况 -->
                <div v-if="recordCheckResult.hasRecord">
                  <div class="text-body1 text-positive q-mb-sm">
                    <q-icon name="check_circle" size="24px" class="q-mr-sm" />
                    ✅ 昨日（{{ recordCheckResult.yesterdayDate }}）有完整的交接记录
                  </div>
                  <div class="text-body2 text-grey-7 q-ml-lg">
                    • 包含 {{ recordCheckResult.recordCount }} 种支付方式（现金、微信、微邮付、其他）<br>
                    • 昨日交接款总额：¥{{ recordCheckResult.reserveAmount.toFixed(2) }}<br>
                    • 系统将自动导入为今日备用金
                  </div>
                </div>

                <!-- 无记录的情况 -->
                <div v-else>
                  <div class="text-body1 text-warning q-mb-sm">
                    <q-icon name="warning" size="24px" class="q-mr-sm" />
                    ⚠️ 昨日（{{ recordCheckResult.yesterdayDate }}）无完整交接记录
                  </div>
                  <div class="text-body2 text-grey-7 q-ml-lg">
                    • 找到 {{ recordCheckResult.recordCount }} 条记录，但需要 4 条（现金、微信、微邮付、其他）<br>
                    • 请在下一步手动输入今日备用金金额
                  </div>
                </div>
              </q-card-section>
            </q-card>
          </div>
        </q-card-section>
      </q-card>
    </div>

    <!-- 步骤2: 确认备用金 -->
    <div v-if="currentStep === 2" class="step-2-content">
      <q-card flat bordered>
        <q-card-section>
          <div class="text-h6 q-mb-md">
            <q-icon name="account_balance_wallet" color="primary" class="q-mr-sm" />
            备用金确认
          </div>

          <!-- 备用金表格 -->
          <div class="petty-cash-table q-mb-lg">
            <q-table
              :rows="pettyCashRows"
              :columns="pettyCashColumns"
              row-key="id"
              flat
              bordered
              hide-pagination
              :pagination="{ rowsPerPage: 0 }"
              class="reserve-cash-table"
            >
              <template v-slot:body-cell-cash="props">
                <q-td :props="props" class="input-cell">
                  <q-input
                    v-model.number="props.row.cash"
                    type="number"
                    dense
                    borderless
                    prefix="¥"
                    class="centered-input"
                    @update:model-value="updateTotal"
                  />
                </q-td>
              </template>
              <template v-slot:body-cell-wechat="props">
                <q-td :props="props" class="input-cell">
                  <q-input
                    v-model.number="props.row.wechat"
                    type="number"
                    dense
                    borderless
                    prefix="¥"
                    class="centered-input"
                    @update:model-value="updateTotal"
                  />
                </q-td>
              </template>
              <template v-slot:body-cell-weyoufu="props">
                <q-td :props="props" class="input-cell">
                  <q-input
                    v-model.number="props.row.weyoufu"
                    type="number"
                    dense
                    borderless
                    prefix="¥"
                    class="centered-input"
                    @update:model-value="updateTotal"
                  />
                </q-td>
              </template>
              <template v-slot:body-cell-other="props">
                <q-td :props="props" class="input-cell">
                  <q-input
                    v-model.number="props.row.other"
                    type="number"
                    dense
                    borderless
                    prefix="¥"
                    class="centered-input"
                    @update:model-value="updateTotal"
                  />
                </q-td>
              </template>
              <template v-slot:body-cell-total="props">
                <q-td :props="props" class="total-amount-cell">
                  <div class="text-weight-bold text-primary total-amount">
                    ¥{{ props.row.total.toFixed(2) }}
                  </div>
                </q-td>
              </template>
            </q-table>
          </div>

          <!-- 确认按钮 -->
          <div class="text-center">
            <q-btn
              color="positive"
              icon="check"
              label="确认备用金"
              size="md"
              @click="confirmReserveCash"
              :loading="isConfirmingCash"
              :disable="isConfirmingCash"
            />
          </div>
        </q-card-section>
      </q-card>
    </div>

    <!-- 步骤3: 核对数据 -->
    <div v-if="currentStep === 3" class="step-3-content">
      <CheckData ref="checkDataRef" />
    </div>

    <!-- 步骤4: 确认数据 -->
    <div v-if="currentStep === 4" class="step-4-content">
      <q-card flat bordered>
        <q-card-section>
          <div class="text-h6 q-mb-md">
            <q-icon name="verified" color="primary" class="q-mr-sm" />
            确认交接数据
          </div>

          <!-- 支付表格 -->
          <div class="q-mb-lg">
            <ShiftHandoverPaymentTable
              :paymentData="confirmationData.paymentData"
              :readOnly="false"
              @update-retained="handleRetainedAmountUpdate"
            />
          </div>

          <!-- 统计表格 -->
          <div class="q-mb-lg">
            <ShiftHandoverSpecialStats
              :totalRooms="confirmationData.totalRooms"
              :restRooms="confirmationData.restRooms"
              :vipCards="confirmationData.vipCards"
              :cashierName="confirmationData.cashierName"
              :notes="confirmationData.notes"
              :goodReview="confirmationData.goodReview"
              :readOnly="false"
              @update:vip-cards="value => handleSpecialStatsUpdate('vipCards', value)"
              @update:notes="value => handleSpecialStatsUpdate('notes', value)"
            />
          </div>

          <!-- 步骤四不展示备忘录 -->
        </q-card-section>
      </q-card>
    </div>

    <!-- 步骤5: 接班信息 -->
    <div v-if="currentStep === 5" class="step-5-content">
      <q-card flat bordered>
        <q-card-section>
          <div class="text-h6 q-mb-md">
            <q-icon name="person_add" color="primary" class="q-mr-sm" />
            接班人员信息
          </div>
          <div class="handover-info">
            <div class="row q-gutter-md">
              <div class="col">
                <q-input
                  v-model="handoverInfo.nextOperator"
                  label="接班人员"
                  outlined
                  :rules="[val => !!val || '请输入接班人员姓名']"
                />
              </div>
              <div class="col">
                <q-input
                  v-model="handoverInfo.handoverTime"
                  label="交接时间"
                  outlined
                  type="datetime-local"
                />
              </div>
            </div>
            <div class="q-mt-md">
              <q-input
                v-model="handoverInfo.notes"
                type="textarea"
                label="交接备注"
                outlined
                rows="3"
                placeholder="请输入需要说明的事项..."
              />
            </div>
          </div>
        </q-card-section>
      </q-card>
    </div>

    <!-- 步骤6: 完成交接 -->
    <div v-if="currentStep === 6" class="step-6-content">
      <HandoverComplete
        :handoverInfo="completeHandoverInfo"
        @logout="$emit('logout')"
      />
    </div>

    <!-- 步骤操作按钮 -->
    <div class="step-actions q-mt-lg">
      <div class="action-buttons q-mb-lg">
        <q-btn
          v-if="currentStep > 1"
          color="grey-6"
          icon="arrow_back"
          label="上一步"
          class="q-mr-md"
          @click="previousStep"
        />

        <q-btn
          v-if="currentStep < 5"
          color="primary"
          icon="arrow_forward"
          label="下一步"
          :loading="stepLoading"
          @click="nextStep"
        />

        <q-btn
          v-if="currentStep === 5"
          color="positive"
          icon="check"
          label="完成交接"
          :loading="stepLoading"
          @click="completeHandover"
        />
      </div>

    </div>
  </div>
</template>

<script setup>
import { ref, computed, reactive, watch } from 'vue'
import { useQuasar } from 'quasar'
import { shiftHandoverApi } from '../../api/index.js'
import { useShiftHandoverStore } from '../../stores/shiftHandoverStore.js'
import { useUserStore } from '../../stores/userStore.js'
import CheckData from './CheckData.vue'
import ShiftHandoverPaymentTable from './ShiftHandoverPaymentTable.vue'
import ShiftHandoverSpecialStats from './ShiftHandoverSpecialStats.vue'
import HandoverComplete from './HandoverComplete.vue'

// 定义 props
const props = defineProps({
  currentStep: {
    type: Number,
    required: true
  }
})

// 定义 emits
const emit = defineEmits(['step-change', 'complete', 'logout'])

const $q = useQuasar()
const shiftHandoverStore = useShiftHandoverStore()
const userStore = useUserStore()

// 响应式状态
const stepLoading = ref(false)

// CheckData 组件引用
const checkDataRef = ref(null)

// 保存步骤3的核对数据（持久化，避免组件销毁后丢失）
const savedCheckData = ref({
  hotelRoomData: [],
  restRoomData: [],
  hotelSummary: { roomFee: 0, deposit: 0, refundDeposit: 0, otherCharges: 0 },
  restSummary: { roomFee: 0, deposit: 0, refundDeposit: 0, otherCharges: 0 }
})

// 保存步骤3的汇总数据对象（用于步骤4展示）
const savedSummaryDataObject = ref({
  hotelIncome: { '现金': 0, '微信': 0, '微邮付': 0, '其他': 0 },
  restIncome: { '现金': 0, '微信': 0, '微邮付': 0, '其他': 0 },
  hotelRefundDeposit: { '现金': 0, '微信': 0, '微邮付': 0, '其他': 0 },  // 包含退押和退款
  restRefundDeposit: { '现金': 0, '微信': 0, '微邮付': 0, '其他': 0 }   // 包含退押和退款
})

// 保存特殊统计数据
const savedSpecialStats = ref({
  openCount: 0,
  restCount: 0,
  invited: 0,
  positive: 0
})

// 步骤相关数据
const formatDateTimeLocal = (date) => {
  const pad = (value) => String(value).padStart(2, '0')
  const year = date.getFullYear()
  const month = pad(date.getMonth() + 1)
  const day = pad(date.getDate())
  const hours = pad(date.getHours())
  const minutes = pad(date.getMinutes())
  return `${year}-${month}-${day}T${hours}:${minutes}`
}

const handoverInfo = ref({
  nextOperator: '',
  handoverTime: formatDateTimeLocal(new Date()),
  notes: ''
})

watch(
  () => props.currentStep,
  (newStep) => {
    if (newStep === 5) {
      handoverInfo.value.handoverTime = formatDateTimeLocal(new Date())
    }
  }
)

// 昨日记录检查相关数据
const isCheckingRecord = ref(false)
const recordCheckResult = ref({
  checked: false,
  hasRecord: false,
  yesterdayDate: '',
  recordCount: 0,
  reserveAmount: 0
})

// 备用金表格相关数据
const isConfirmingCash = ref(false)
const pettyCashColumns = [
  {
    name: 'label',
    label: '项目',
    field: 'label',
    align: 'left',
    headerStyle: 'font-weight: bold;'
  },
  {
    name: 'cash',
    label: '现金',
    field: 'cash',
    align: 'center',
    headerStyle: 'font-weight: bold;'
  },
  {
    name: 'wechat',
    label: '微信',
    field: 'wechat',
    align: 'center',
    headerStyle: 'font-weight: bold;'
  },
  {
    name: 'weyoufu',
    label: '微邮付',
    field: 'weyoufu',
    align: 'center',
    headerStyle: 'font-weight: bold;'
  },
  {
    name: 'other',
    label: '其他',
    field: 'other',
    align: 'center',
    headerStyle: 'font-weight: bold;'
  },
  {
    name: 'total',
    label: '合计',
    field: 'total',
    align: 'center',
    headerStyle: 'font-weight: bold; color: #1976d2;'
  }
]

const PAY_WAY_KEYS = ['现金', '微信', '微邮付', '其他']
const DEFAULT_CASH_RESERVE = 320

const pettyCashRows = ref([
  {
    id: 1,
    label: '备用金',
    cash: DEFAULT_CASH_RESERVE,
    wechat: 0,
    weyoufu: 0,
    other: 0,
    total: DEFAULT_CASH_RESERVE
  }
])

const DEFAULT_RETAINED_AMOUNTS = {
  '现金': DEFAULT_CASH_RESERVE,
  '微信': 0,
  '微邮付': 0,
  '其他': 0
}

const createDefaultRetainedBuckets = () => ({
  '现金': DEFAULT_RETAINED_AMOUNTS['现金'],
  '微信': DEFAULT_RETAINED_AMOUNTS['微信'],
  '微邮付': DEFAULT_RETAINED_AMOUNTS['微邮付'],
  '其他': DEFAULT_RETAINED_AMOUNTS['其他']
})

const retainedInitialized = ref(false)
const retainedAmounts = ref(createDefaultRetainedBuckets())

const specialStatsState = reactive({
  vipCards: 0,
  notes: '',
  goodReview: ''
})

const specialStatsInitialized = ref(false)

const mapReserveRowToBuckets = () => {
  const reserveCash = pettyCashRows.value[0] || { cash: 0, wechat: 0, weyoufu: 0, other: 0 }
  return {
    '现金': Number(reserveCash.cash) || 0,
    '微信': Number(reserveCash.wechat) || 0,
    '微邮付': Number(reserveCash.weyoufu) || 0,
    '其他': Number(reserveCash.other) || 0
  }
}

const initializeRetainedAmounts = () => {
  retainedAmounts.value = createDefaultRetainedBuckets()
  retainedInitialized.value = true
}

const countRoomNights = (rows = []) => {
  return rows.reduce((sum, row) => {
    if (row.changeType !== '房费') {
      return sum
    }
    if (row.isAggregatedRoomFee && Array.isArray(row.aggregatedBillIds) && row.aggregatedBillIds.length > 0) {
      return sum + row.aggregatedBillIds.length
    }
    return sum + 1
  }, 0)
}

// 计算确认数据（从步骤3的汇总数据对象中获取）
const confirmationData = computed(() => {
  // 优先使用保存的汇总数据对象
  const summaryData = savedSummaryDataObject.value

  console.log('📦 [步骤4] 使用汇总数据对象:', JSON.parse(JSON.stringify(summaryData)))
  console.log('📦 [步骤4] 客房退押:', summaryData.hotelRefundDeposit)
  console.log('📦 [步骤4] 休息退押:', summaryData.restRefundDeposit)

  // 获取备用金（来自步骤2）
  const reserve = mapReserveRowToBuckets()

  // 计算总退押（客房退押 + 休息房退押）- 已包含退押金和退款
  const totalRefundDeposit = { '现金': 0, '微信': 0, '微邮付': 0, '其他': 0 }
  PAY_WAY_KEYS.forEach(key => {
    totalRefundDeposit[key] = (summaryData.hotelRefundDeposit[key] || 0) + (summaryData.restRefundDeposit[key] || 0)
  })

  if (!retainedInitialized.value) {
    initializeRetainedAmounts()
  }

  const currentRetained = { ...retainedAmounts.value }

  // 计算合计与交接款
  const totalAmount = { '现金': 0, '微信': 0, '微邮付': 0, '其他': 0 }
  const handoverAmount = { '现金': 0, '微信': 0, '微邮付': 0, '其他': 0 }

  PAY_WAY_KEYS.forEach(key => {
    const reserveValue = reserve[key] || 0
    const hotelIncomeValue = summaryData.hotelIncome[key] || 0
    const restIncomeValue = summaryData.restIncome[key] || 0
    const carIncomeValue = 0 // 暂无租车收入数据

    const rowTotal = reserveValue + hotelIncomeValue + restIncomeValue + carIncomeValue
    const roundedRowTotal = Number(rowTotal.toFixed(2))
    totalAmount[key] = roundedRowTotal

    if (currentRetained[key] === undefined || currentRetained[key] === null) {
      currentRetained[key] = Number(reserveValue.toFixed(2))
    } else {
      const numericRetained = Number(currentRetained[key])
      currentRetained[key] = Number.isNaN(numericRetained) ? 0 : Number(numericRetained.toFixed(2))
    }

    const refundTotal = Number((totalRefundDeposit[key] || 0).toFixed(2))
    const computedHandover = roundedRowTotal - refundTotal - currentRetained[key]
    handoverAmount[key] = Number(computedHandover.toFixed(2))
  })

  const retainedChanged = PAY_WAY_KEYS.some(key => currentRetained[key] !== retainedAmounts.value[key])
  if (retainedChanged) {
    retainedAmounts.value = { ...currentRetained }
  }

  // 获取房间统计数据（优先使用特殊统计API的数据）
  const hotelRoomRows = savedCheckData.value.hotelRoomData || []
  const restRoomRows = savedCheckData.value.restRoomData || []

  let totalRooms = countRoomNights(hotelRoomRows)
  let restRooms = countRoomNights(restRoomRows)

  if (totalRooms === 0 && savedSpecialStats.value.openCount) {
    totalRooms = savedSpecialStats.value.openCount
  }
  if (restRooms === 0 && savedSpecialStats.value.restCount) {
    restRooms = savedSpecialStats.value.restCount
  }

  // 格式化好评数据为 "邀X得Y"
  const derivedGoodReview = `邀${savedSpecialStats.value.invited || 0}得${savedSpecialStats.value.positive || 0}`

  if (!specialStatsInitialized.value) {
    specialStatsState.vipCards = Number(savedSpecialStats.value.vipCards || 0)
    specialStatsState.notes = ''
    specialStatsState.goodReview = derivedGoodReview
    specialStatsInitialized.value = true
  }

  if (!specialStatsState.goodReview) {
    specialStatsState.goodReview = derivedGoodReview
  }

  const result = {
    paymentData: {
      reserve,
      hotelIncome: summaryData.hotelIncome,
      restIncome: summaryData.restIncome,
      carRentIncome: { '现金': 0, '微信': 0, '微邮付': 0, '其他': 0 }, // 暂无数据
      totalIncome: totalAmount,
      hotelRefundDeposit: summaryData.hotelRefundDeposit,
      restRefundDeposit: summaryData.restRefundDeposit,
      totalRefundDeposit, // 总退押（已包含退押金和退款）
      retainedAmount: currentRetained,
      handoverAmount
    },
    totalRooms,
    restRooms,
    vipCards: specialStatsState.vipCards,
    cashierName: userStore.user.username || '交班人',
    notes: specialStatsState.notes,
    goodReview: specialStatsState.goodReview,
    taskList: [],
    newTaskTitle: ''
  }

  console.log('🎯 [步骤4] 最终 confirmationData:', result)
  console.log('🎯 [步骤4] paymentData.hotelRefundDeposit:', result.paymentData.hotelRefundDeposit)
  console.log('🎯 [步骤4] paymentData.restRefundDeposit:', result.paymentData.restRefundDeposit)

  return result
})

// 完成交接的信息
const completeHandoverInfo = computed(() => ({
  currentOperator: userStore.user.username || '交班人', // 当前交班人（从 userStore 获取）
  nextOperator: handoverInfo.value.nextOperator || '接班人', // 接班人
  completedTime: new Date().toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}))

// 更新备用金总计
const updateTotal = () => {
  const row = pettyCashRows.value[0]
  row.total = (row.cash || 0) + (row.wechat || 0) + (row.weyoufu || 0) + (row.other || 0)
}

const handleRetainedAmountUpdate = ({ payWay, value }) => {
  if (!PAY_WAY_KEYS.includes(payWay)) {
    return
  }
  const numericValue = Number(value)
  retainedAmounts.value = {
    ...retainedAmounts.value,
    [payWay]: Number.isNaN(numericValue) ? 0 : Number(numericValue.toFixed(2))
  }
}

const handleSpecialStatsUpdate = (field, value) => {
  if (field === 'vipCards') {
    specialStatsState.vipCards = Number(value) || 0
  } else if (field === 'notes') {
    specialStatsState.notes = value || ''
  }
}

// 确认备用金
const confirmReserveCash = async () => {
  try {
    isConfirmingCash.value = true

    const total = pettyCashRows.value[0].total

    $q.notify({
      type: 'positive',
      message: `备用金确认完成，总计: ¥${total.toFixed(2)}`,
      position: 'top'
    })

    retainedInitialized.value = false
    initializeRetainedAmounts()

  } catch (error) {
    console.error('确认备用金失败:', error)
    $q.notify({
      type: 'negative',
      message: '确认备用金失败，请重试',
      position: 'top'
    })
  } finally {
    isConfirmingCash.value = false
  }
}

// 辅助函数：将Date对象转换为本地日期字符串（YYYY-MM-DD）
const formatLocalDate = (date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// 获取特殊统计数据
const fetchSpecialStatsData = async () => {
  try {
    console.log('📊 [获取特殊统计] 开始调用API...')

    // 计算要查询的日期（与核对数据的日期逻辑一致）
    const now = new Date()
    const currentHour = now.getHours()

    // 计算当前营业日
    let currentBusinessDate = new Date(now)
    if (currentHour < 8) {
      currentBusinessDate.setDate(currentBusinessDate.getDate() - 1)
    }

    // 计算要查询的营业日（当前营业日的前一天）
    let queryDate = new Date(currentBusinessDate)
    queryDate.setDate(queryDate.getDate() - 1)
    const queryDateStr = formatLocalDate(queryDate)

    console.log('📊 [获取特殊统计] 查询日期:', queryDateStr)

    // 调用API
    const response = await shiftHandoverApi.getSpecialStats({ date: queryDateStr })

    if (response.success) {
      savedSpecialStats.value = {
        openCount: response.data.openCount || 0,
        restCount: response.data.restCount || 0,
        invited: response.data.invited || 0,
        positive: response.data.positive || 0
      }

      specialStatsInitialized.value = false

      console.log('✅ [获取特殊统计] 数据获取成功:', savedSpecialStats.value)

      $q.notify({
        type: 'positive',
        message: `特殊统计加载成功：客房${savedSpecialStats.value.openCount}间，休息房${savedSpecialStats.value.restCount}间`,
        position: 'top',
        timeout: 2000
      })
    } else {
      throw new Error(response.message || '获取失败')
    }
  } catch (error) {
    console.error('❌ [获取特殊统计] 失败:', error)

    // 出错时使用默认值
    savedSpecialStats.value = {
      openCount: 0,
      restCount: 0,
      invited: 0,
      positive: 0
    }

    specialStatsInitialized.value = false

    $q.notify({
      type: 'warning',
      message: '特殊统计数据加载失败，使用默认值',
      position: 'top',
      timeout: 2000
    })
  }
}

// 检查昨日交接记录
const checkYesterdayRecord = async () => {
  try {
    isCheckingRecord.value = true
    recordCheckResult.value.checked = false

    // 交接班业务逻辑：
    // 1. 营业日从每天8:00开始，到次日8:00结束
    // 2. 交接的是"前一个营业日"的工作和账目
    // 3. 查询的是"要交接的营业日的前一天"的交接记录
    const now = new Date()
    const currentHour = now.getHours()

    // 计算当前营业日
    let currentBusinessDate = new Date(now)
    if (currentHour < 8) {
      // 还没到8点，还在昨天营业日的时间范围内
      currentBusinessDate.setDate(currentBusinessDate.getDate() - 1)
    }

    // 计算要交接的营业日（当前营业日的前一天）
    let handoverBusinessDate = new Date(currentBusinessDate)
    handoverBusinessDate.setDate(handoverBusinessDate.getDate() - 1)

    // 计算要查询的记录日期（要交接的营业日的前一天）
    let queryDate = new Date(handoverBusinessDate)
    queryDate.setDate(queryDate.getDate() - 1)
    const queryDateStr = formatLocalDate(queryDate)

    console.log('📅 [检查记录] 日期计算:', {
      currentTime: now.toLocaleString('zh-CN'),
      currentHour,
      currentBusinessDate: formatLocalDate(currentBusinessDate),
      handoverBusinessDate: formatLocalDate(handoverBusinessDate),
      queryDate: queryDateStr,
      logic: '查询"要交接营业日的前一天"的交接记录'
    })

    // 调用后端API检查昨日交接记录
    // 后端直接查询传入的日期
    const response = await shiftHandoverApi.checkYesterdayRecord({ date: queryDateStr })

    if (response.success) {
      // 后端返回的数据结构：{ date, hasRecord, isComplete, paymentCount, handoverAmounts, ... }
      const { date, isComplete, paymentCount, handoverAmounts } = response.data

      recordCheckResult.value.checked = true
      recordCheckResult.value.hasRecord = isComplete
      recordCheckResult.value.yesterdayDate = date
      recordCheckResult.value.recordCount = paymentCount || 0

      if (isComplete && handoverAmounts) {
        // 如果有完整的昨日记录，保存交接款到 store，作为今日备用金
        const totalReserve = handoverAmounts.cash + handoverAmounts.wechat + handoverAmounts.weyoufu + handoverAmounts.other
        recordCheckResult.value.reserveAmount = totalReserve

        shiftHandoverStore.setYesterdayHandoverAmounts(handoverAmounts)

        console.log('昨日交接记录完整，已保存交接款到 store:', handoverAmounts)
        console.log('昨日交接款总额:', totalReserve)

        $q.notify({
          type: 'positive',
          message: `检查完成：昨日（${date}）交接记录完整，交接款 ¥${totalReserve.toFixed(2)} 将作为今日备用金`,
          position: 'top'
        })
      } else {
        // 无完整记录，清空 store 中的昨日交接款
        recordCheckResult.value.reserveAmount = 0
        shiftHandoverStore.clearYesterdayHandoverAmounts()

        $q.notify({
          type: 'warning',
          message: `检查完成：昨日（${date}）无完整交接记录（找到${paymentCount}条记录，需要4条），请手动输入备用金`,
          position: 'top'
        })
      }
    } else {
      throw new Error(response.message || '检查失败')
    }

  } catch (error) {
    console.error('检查昨日交接记录失败:', error)
    $q.notify({
      type: 'negative',
      message: error.message || '检查昨日交接记录失败，请稍后重试',
      position: 'top'
    })

    // 出错时设置为无记录状态，并填充昨天的日期信息
    recordCheckResult.value.checked = true
    recordCheckResult.value.hasRecord = false
    recordCheckResult.value.yesterdayDate = yesterdayStr
    recordCheckResult.value.recordCount = 0
    recordCheckResult.value.reserveAmount = 0
  } finally {
    isCheckingRecord.value = false
  }
}

// 下一步
const nextStep = async () => {
  try {
    stepLoading.value = true

    // 步骤1进入步骤2时，检查是否已完成昨日记录检查
    if (props.currentStep === 1) {
      if (!recordCheckResult.value.checked) {
        $q.notify({
          type: 'warning',
          message: '请先检查昨日交接记录',
          position: 'top'
        })
        return
      }

      // 如果有昨日记录，自动填入昨日交接款作为备用金
      if (recordCheckResult.value.hasRecord) {
        const amounts = shiftHandoverStore.yesterdayHandoverAmounts
        pettyCashRows.value[0].cash = DEFAULT_CASH_RESERVE
        pettyCashRows.value[0].wechat = amounts.wechat || 0
        pettyCashRows.value[0].weyoufu = amounts.weyoufu || 0
        pettyCashRows.value[0].other = amounts.other || 0
        updateTotal()

        console.log('✅ [步骤1→2] 自动填入昨日交接款作为备用金（现金使用默认）:', {
          ...amounts,
          cash: DEFAULT_CASH_RESERVE
        })

        $q.notify({
          type: 'positive',
          message: `已自动填入昨日交接款作为今日备用金（现金默认 ¥${DEFAULT_CASH_RESERVE}）`,
          position: 'top',
          timeout: 2000
        })
      } else {
        // 如果没有昨日记录，使用默认备用金（现金 320）并清空其他支付方式
        pettyCashRows.value[0].cash = DEFAULT_CASH_RESERVE
        pettyCashRows.value[0].wechat = 0
        pettyCashRows.value[0].weyoufu = 0
        pettyCashRows.value[0].other = 0
        updateTotal()

        console.log('⚠️ [步骤1→2] 无昨日记录，请手动输入备用金')

        $q.notify({
          type: 'info',
          message: `无昨日交接记录，已使用默认现金备用金 ¥${DEFAULT_CASH_RESERVE}`,
          position: 'top',
          timeout: 2000
        })
      }
    }

    // 步骤3进入步骤4时，检查数据核对是否完成
    if (props.currentStep === 3) {
      console.log('🔍 [步骤验证] checkDataRef:', checkDataRef.value)

      if (!checkDataRef.value) {
        $q.notify({
          type: 'warning',
          message: '请先完成数据核对',
          position: 'top'
        })
        return
      }

      // 打印 checkDataRef 暴露的所有属性
      console.log('🔍 [步骤验证] checkDataRef 暴露的属性:', {
        hotelRoomData: checkDataRef.value.hotelRoomData,
        restRoomData: checkDataRef.value.restRoomData,
        hotelSummary: checkDataRef.value.hotelSummary,
        restSummary: checkDataRef.value.restSummary,
        allDataConfirmed: checkDataRef.value.allDataConfirmed,
        dataCheckCompleted: checkDataRef.value.dataCheckCompleted
      })

      // 检查数据（defineExpose 会自动解包，直接访问即可）
      const hotelData = checkDataRef.value.hotelRoomData || []
      const restData = checkDataRef.value.restRoomData || []

      const unwrap = (candidate) => {
        if (candidate && typeof candidate === 'object' && 'value' in candidate) {
          return candidate.value
        }
        return candidate
      }

      const allConfirmed = unwrap(checkDataRef.value.allDataConfirmed)
      const dataCheckCompleted = unwrap(checkDataRef.value.dataCheckCompleted)

      console.log('🔍 [步骤验证] 数据核对状态:', {
        hotelDataCount: hotelData.length,
        restDataCount: restData.length,
        allConfirmed,
        dataCheckCompleted,
        hotelConfirmedStatus: hotelData.map(item => ({ orderNo: item.orderNo, confirmed: item.confirmed })),
        restConfirmedStatus: restData.map(item => ({ orderNo: item.orderNo, confirmed: item.confirmed }))
      })

      const hasAnyData = hotelData.length > 0 || restData.length > 0

      if (hasAnyData && !allConfirmed) {
        $q.notify({
          type: 'warning',
          message: '请确认所有账单数据后再进入下一步',
          position: 'top'
        })
        return
      }

      // 检查数据核对是否完成
      if (!dataCheckCompleted) {
        $q.notify({
          type: 'warning',
          message: hasAnyData
            ? '请点击"确认核对"按钮完成数据核对'
            : '今日暂无账单数据，请先点击"确认核对"后继续',
          position: 'top'
        })
        return
      }

      // ✅ 数据验证通过，保存数据到 savedCheckData（避免组件销毁后丢失）
      savedCheckData.value = {
        hotelRoomData: [...hotelData],
        restRoomData: [...restData],
        hotelSummary: checkDataRef.value.hotelSummary,
        restSummary: checkDataRef.value.restSummary
      }

      // 保存汇总数据对象（用于步骤4展示）
      if (checkDataRef.value.summaryDataObject) {
        savedSummaryDataObject.value = JSON.parse(JSON.stringify(checkDataRef.value.summaryDataObject))
        console.log('💾 [步骤3→4] 保存汇总数据对象:', savedSummaryDataObject.value)
      }

      console.log('💾 [步骤3→4] 保存核对数据:', savedCheckData.value)

      // 调用后端API获取特殊统计数据
      await fetchSpecialStatsData()

      if (!retainedInitialized.value) {
        initializeRetainedAmounts()
      }
    }

    if (props.currentStep < 6) {
      emit('step-change', props.currentStep + 1)
    }
  } catch (error) {
    $q.notify({
      type: 'negative',
      message: '步骤执行失败，请重试',
      position: 'top'
    })
  } finally {
    stepLoading.value = false
  }
}

// 上一步
const previousStep = () => {
  if (props.currentStep > 1) {
    emit('step-change', props.currentStep - 1)
  }
}

// 完成交接
const completeHandover = async () => {
  console.log('🎯 [完成交接] 开始执行，接班人员:', handoverInfo.value.nextOperator)

  // ⚠️ 先验证，验证通过后再设置 loading
  // 验证接班人员是否填写
  if (!handoverInfo.value.nextOperator || handoverInfo.value.nextOperator.trim() === '') {
    console.warn('❌ [完成交接] 验证失败：未填写接班人员')
    $q.notify({
      type: 'warning',
      message: '请输入接班人员姓名',
      position: 'top'
    })
    return  // ✅ 验证失败，直接返回，不继续执行
  }

  console.log('✅ [完成交接] 验证通过，开始处理...')

  try {
    stepLoading.value = true

    $q.notify({
      type: 'info',
      message: '正在保存交接班数据...',
      position: 'top'
    })

    // 准备交接班数据
    // 交接班业务逻辑：保存的是"要交接的营业日"的日期
    const now = new Date()
    const currentHour = now.getHours()

    // 计算当前营业日
    let currentBusinessDate = new Date(now)
    if (currentHour < 8) {
      // 还没到8点，还在昨天营业日的时间范围内
      currentBusinessDate.setDate(currentBusinessDate.getDate() - 1)
    }

    // 计算要交接的营业日（当前营业日的前一天）
    let handoverBusinessDate = new Date(currentBusinessDate)
    handoverBusinessDate.setDate(handoverBusinessDate.getDate() - 1)
    const handoverDateStr = formatLocalDate(handoverBusinessDate)

    console.log('📤 [完成交接] 日期计算:', {
      currentTime: now.toLocaleString('zh-CN'),
      currentHour,
      currentBusinessDate: formatLocalDate(currentBusinessDate),
      handoverBusinessDate: handoverDateStr,
      logic: '保存"要交接的营业日"的日期'
    })

    // 转换字段名：前端使用 hotelRefundDeposit/restRefundDeposit，后端使用 hotelDeposit/restDeposit
    const paymentDataForBackend = {
      reserve: confirmationData.value.paymentData.reserve,
      hotelIncome: confirmationData.value.paymentData.hotelIncome,
      restIncome: confirmationData.value.paymentData.restIncome,
      carRentIncome: confirmationData.value.paymentData.carRentIncome,
      totalIncome: confirmationData.value.paymentData.totalIncome,
      hotelDeposit: confirmationData.value.paymentData.hotelRefundDeposit,  // 字段名转换
      restDeposit: confirmationData.value.paymentData.restRefundDeposit,    // 字段名转换
      totalRefundDeposit: confirmationData.value.paymentData.totalRefundDeposit,
      retainedAmount: confirmationData.value.paymentData.retainedAmount,
      handoverAmount: confirmationData.value.paymentData.handoverAmount
    }

    const handoverData = {
      date: handoverDateStr,
      handoverPerson: userStore.user.username || '当前操作员', // 从 userStore 获取当前用户名
      receivePerson: handoverInfo.value.nextOperator.trim(),
      paymentData: paymentDataForBackend,
      vipCard: confirmationData.value.vipCards || 0,
      taskList: confirmationData.value.taskList || [],
      notes: handoverInfo.value.notes || ''
    }

    console.log('📤 [完成交接] 准备保存的数据:', {
      currentTime: now.toLocaleString('zh-CN'),
      currentHour,
      handoverDate: handoverDateStr,
      handoverData
    })

    // 调用后端 API 保存交接班数据
    const response = await shiftHandoverApi.completeHandover(handoverData)

    if (response.success) {
      console.log('✅ [完成交接] 数据保存成功:', response.data)

      $q.notify({
        type: 'positive',
        message: '交接班数据已保存',
        position: 'top'
      })

      // 跳转到完成页面（步骤6）
      emit('step-change', 6)
      emit('complete')

      $q.notify({
        type: 'positive',
        message: '交接班流程已完成！',
        position: 'top'
      })
    } else {
      throw new Error(response.message || '保存失败')
    }

  } catch (error) {
    console.error('❌ [完成交接] 执行失败:', error)
    $q.notify({
      type: 'negative',
      message: error.message || '完成交接失败，请重试',
      position: 'top'
    })
  } finally {
    stepLoading.value = false
    console.log('🏁 [完成交接] 执行结束')
  }
}


// 获取步骤标题
const getStepTitle = (step) => {
  const titles = {
    1: '检查记录',
    2: '确认备用金',
    3: '核对数据',
    4: '确认数据',
    5: '接班信息',
    6: '完成交接'
  }
  return titles[step] || '未知步骤'
}
</script>

<style scoped>
.handover-process {
  width: 100%;
  max-width: 1000px; /* 增加最大宽度以利用更多空间 */
}

.step-1-content,
.step-2-content,
.step-4-content,
.step-5-content,
.step-6-content {
  animation: slideIn 0.3s ease-out;
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.step-content .q-card {
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(10px);
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
}

/* 步骤操作按钮 */
.step-actions {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
}

.action-buttons {
  display: flex;
  gap: 12px;
  align-items: center;
}

.action-buttons .q-btn {
  padding: 12px 24px;
  font-weight: 600;
  border-radius: 8px;
  min-width: 120px;
  transition: all 0.2s ease;
}

.action-buttons .q-btn:hover {
  transform: translateY(-1px);
}


/* 备用金表格样式 */
.reserve-cash-table {
  background: rgba(255, 255, 255, 0.95);
  border-radius: 8px;
  border: 1px solid #e0e0e0;
}

.reserve-cash-table :deep(.q-table__top) {
  padding: 16px;
}

.reserve-cash-table :deep(.q-table__bottom) {
  display: none;
}

.reserve-cash-table :deep(th) {
  background: #f5f5f5;
  font-weight: 600;
  color: #333;
  text-align: center !important;
  padding: 14px 12px;
  border-bottom: 2px solid #e0e0e0;
  font-size: 15px;
}

.reserve-cash-table :deep(td) {
  padding: 16px 12px;
  text-align: center !important;
  vertical-align: middle;
  border-bottom: 1px solid #f0f0f0;
}

.reserve-cash-table :deep(tbody tr:hover) {
  background-color: #f8f9fa;
}

.reserve-cash-table :deep(.q-input) {
  font-weight: 500;
}

.reserve-cash-table :deep(.q-input .q-field__control) {
  height: 40px;
  text-align: center;
}

.reserve-cash-table :deep(.q-input .q-field__native) {
  text-align: center;
  font-weight: 500;
  font-size: 16px;
}

.reserve-cash-table :deep(.q-input input) {
  text-align: center !important;
}

.reserve-cash-table :deep(.q-input .q-field__prefix) {
  font-weight: 500;
  color: #666;
}

/* 合计列样式 */
.reserve-cash-table :deep(.total-amount-cell) {
  background-color: #e3f2fd !important;
  font-size: 17px;
}

.reserve-cash-table :deep(.total-amount) {
  text-align: center;
  font-size: 18px;
  letter-spacing: 0.5px;
}

/* 第一列标签样式 */
.reserve-cash-table :deep(td:first-child) {
  font-weight: 600;
  background-color: #fafafa;
  color: #555;
}

/* 输入框单元格样式 */
.reserve-cash-table :deep(.input-cell) {
  background-color: #ffffff;
  padding: 8px 4px !important;
}

.reserve-cash-table :deep(.input-cell:hover) {
  background-color: #f5f5f5;
}

/* 居中输入框样式 */
.reserve-cash-table :deep(.centered-input) {
  width: 100%;
  max-width: 200px;
  margin: 0 auto;
}

.reserve-cash-table :deep(.centered-input .q-field__control) {
  background-color: transparent;
  border-radius: 4px;
  padding: 4px 8px;
}

.reserve-cash-table :deep(.centered-input .q-field__control:hover) {
  background-color: #f8f9fa;
}

.reserve-cash-table :deep(.centered-input .q-field__control:focus-within) {
  background-color: #e3f2fd;
  box-shadow: 0 0 0 2px rgba(25, 118, 210, 0.2);
}

/* 检查结果卡片样式 */
.check-result-card {
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.95) 0%, rgba(250, 250, 250, 0.95) 100%);
  border-radius: 12px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
  border: 1px solid rgba(0, 0, 0, 0.08);
}

.check-result-card .text-positive {
  display: flex;
  align-items: center;
}

.check-result-card .text-warning {
  display: flex;
  align-items: center;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .action-buttons {
    flex-direction: column;
    gap: 8px;
  }

  .action-buttons .q-btn {
    min-width: 200px;
  }


  /* 表格响应式 */
  .reserve-cash-table :deep(td) {
    padding: 10px 4px;
  }

  .reserve-cash-table :deep(th) {
    padding: 10px 6px;
    font-size: 13px;
  }

  .reserve-cash-table :deep(.centered-input) {
    max-width: 100px;
  }

  .reserve-cash-table :deep(.total-amount) {
    font-size: 16px;
  }
}
</style>
