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
                <q-td :props="props">
                  <q-input
                    v-model.number="props.row.cash"
                    type="number"
                    dense
                    outlined
                    prefix="¥"
                    style="min-width: 100px;"
                    @update:model-value="updateTotal"
                  />
                </q-td>
              </template>
              <template v-slot:body-cell-wechat="props">
                <q-td :props="props">
                  <q-input
                    v-model.number="props.row.wechat"
                    type="number"
                    dense
                    outlined
                    prefix="¥"
                    style="min-width: 100px;"
                    @update:model-value="updateTotal"
                  />
                </q-td>
              </template>
              <template v-slot:body-cell-weyoufu="props">
                <q-td :props="props">
                  <q-input
                    v-model.number="props.row.weyoufu"
                    type="number"
                    dense
                    outlined
                    prefix="¥"
                    style="min-width: 100px;"
                    @update:model-value="updateTotal"
                  />
                </q-td>
              </template>
              <template v-slot:body-cell-other="props">
                <q-td :props="props">
                  <q-input
                    v-model.number="props.row.other"
                    type="number"
                    dense
                    outlined
                    prefix="¥"
                    style="min-width: 100px;"
                    @update:model-value="updateTotal"
                  />
                </q-td>
              </template>
              <template v-slot:body-cell-total="props">
                <q-td :props="props">
                  <div class="text-weight-bold text-primary">
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
              :readOnly="true"
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
              :readOnly="true"
            />
          </div>

          <!-- 备忘录 -->
          <div class="q-mb-lg">
            <ShiftHandoverMemoList
              :taskList="confirmationData.taskList"
              :newTaskTitle="confirmationData.newTaskTitle"
              :readOnly="true"
            />
          </div>
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
import { ref, computed, onMounted } from 'vue'
import { useQuasar } from 'quasar'
import { shiftHandoverApi } from '../../api/index.js'
import CheckData from './CheckData.vue'
import ShiftHandoverPaymentTable from './ShiftHandoverPaymentTable.vue'
import ShiftHandoverSpecialStats from './ShiftHandoverSpecialStats.vue'
import ShiftHandoverMemoList from './ShiftHandoverMemoList.vue'
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

// 步骤相关数据
const handoverInfo = ref({
  nextOperator: '',
  handoverTime: new Date().toISOString().slice(0, 16),
  notes: ''
})

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

const pettyCashRows = ref([
  {
    id: 1,
    label: '备用金',
    cash: 500,
    wechat: 0,
    weyoufu: 0,
    other: 0,
    total: 500
  }
])

// 计算确认数据（从步骤3的核对数据中获取）
const confirmationData = computed(() => {
  // 优先使用保存的数据（步骤4时 CheckData 组件已销毁）
  // 如果没有保存的数据，尝试从 checkDataRef 获取（步骤3时）
  let hotelData = []
  let restData = []
  let hotelSum = { roomFee: 0, deposit: 0, refundDeposit: 0, otherCharges: 0 }
  let restSum = { roomFee: 0, deposit: 0, refundDeposit: 0, otherCharges: 0 }

  if (savedCheckData.value.hotelRoomData.length > 0 || savedCheckData.value.restRoomData.length > 0) {
    // 使用保存的数据
    hotelData = savedCheckData.value.hotelRoomData
    restData = savedCheckData.value.restRoomData
    hotelSum = savedCheckData.value.hotelSummary
    restSum = savedCheckData.value.restSummary
    console.log('📦 [步骤4] 使用保存的数据')
  } else if (checkDataRef.value) {
    // 使用实时数据（步骤3时）
    hotelData = checkDataRef.value.hotelRoomData || []
    restData = checkDataRef.value.restRoomData || []
    hotelSum = checkDataRef.value.hotelSummary || { roomFee: 0, deposit: 0, refundDeposit: 0, otherCharges: 0 }
    restSum = checkDataRef.value.restSummary || { roomFee: 0, deposit: 0, refundDeposit: 0, otherCharges: 0 }
    console.log('📡 [步骤4] 使用实时数据')
  } else {
    // 没有任何数据
    console.warn('⚠️ [步骤4] 没有可用的数据')
    return {
      paymentData: {
        reserve: { '现金': 0, '微信': 0, '微邮付': 0, '其他': 0 },
        hotelIncome: { '现金': 0, '微信': 0, '微邮付': 0, '其他': 0 },
        restIncome: { '现金': 0, '微信': 0, '微邮付': 0, '其他': 0 },
        carRentIncome: { '现金': 0, '微信': 0, '微邮付': 0, '其他': 0 },
        totalIncome: { '现金': 0, '微信': 0, '微邮付': 0, '其他': 0 },
        hotelDeposit: { '现金': 0, '微信': 0, '微邮付': 0, '其他': 0 },
        restDeposit: { '现金': 0, '微信': 0, '微邮付': 0, '其他': 0 },
        retainedAmount: { '现金': 0, '微信': 0, '微邮付': 0, '其他': 0 },
        handoverAmount: { '现金': 0, '微信': 0, '微邮付': 0, '其他': 0 }
      },
      totalRooms: 0,
      restRooms: 0,
      vipCards: 0,
      cashierName: '',
      notes: '',
      goodReview: '',
      taskList: [],
      newTaskTitle: ''
    }
  }

  console.log('📊 [步骤4] 获取核对数据:', {
    hotelDataCount: hotelData.length,
    restDataCount: restData.length,
    hotelSum,
    restSum,
    hotelDataSample: hotelData[0],
    restDataSample: restData[0],
    allHotelData: hotelData,
    allRestData: restData
  })

  // 按支付方式统计客房数据
  const hotelIncomeByPayment = { '现金': 0, '微信': 0, '微邮付': 0, '其他': 0 }
  const hotelDepositByPayment = { '现金': 0, '微信': 0, '微邮付': 0, '其他': 0 }

  hotelData.forEach(item => {
    const payWay = item.payWay || '其他'
    console.log('客房账单详情:', {
      orderNo: item.orderNo,
      payWay: payWay,
      payWayType: typeof payWay,
      roomFee: item.roomFee,
      deposit: item.deposit,
      完整item: item
    })

    // 确保支付方式在字典中
    if (!hotelIncomeByPayment.hasOwnProperty(payWay)) {
      console.warn(`⚠️ 未知的支付方式: "${payWay}"，将归入"其他"`)
      hotelIncomeByPayment['其他'] = (hotelIncomeByPayment['其他'] || 0) + (item.roomFee || 0)
      hotelDepositByPayment['其他'] = (hotelDepositByPayment['其他'] || 0) + (item.deposit || 0)
    } else {
      hotelIncomeByPayment[payWay] = (hotelIncomeByPayment[payWay] || 0) + (item.roomFee || 0)
      hotelDepositByPayment[payWay] = (hotelDepositByPayment[payWay] || 0) + (item.deposit || 0)
    }
  })

  // 按支付方式统计休息房数据
  const restIncomeByPayment = { '现金': 0, '微信': 0, '微邮付': 0, '其他': 0 }
  const restDepositByPayment = { '现金': 0, '微信': 0, '微邮付': 0, '其他': 0 }

  restData.forEach(item => {
    const payWay = item.payWay || '其他'
    console.log('休息房账单详情:', {
      orderNo: item.orderNo,
      payWay: payWay,
      payWayType: typeof payWay,
      roomFee: item.roomFee,
      deposit: item.deposit,
      完整item: item
    })

    // 确保支付方式在字典中
    if (!restIncomeByPayment.hasOwnProperty(payWay)) {
      console.warn(`⚠️ 未知的支付方式: "${payWay}"，将归入"其他"`)
      restIncomeByPayment['其他'] = (restIncomeByPayment['其他'] || 0) + (item.roomFee || 0)
      restDepositByPayment['其他'] = (restDepositByPayment['其他'] || 0) + (item.deposit || 0)
    } else {
      restIncomeByPayment[payWay] = (restIncomeByPayment[payWay] || 0) + (item.roomFee || 0)
      restDepositByPayment[payWay] = (restDepositByPayment[payWay] || 0) + (item.deposit || 0)
    }
  })

  console.log('💰 [步骤4] 按支付方式统计:', {
    hotelIncome: hotelIncomeByPayment,
    restIncome: restIncomeByPayment,
    hotelDeposit: hotelDepositByPayment,
    restDeposit: restDepositByPayment
  })

  // 计算总收入
  const totalIncome = { '现金': 0, '微信': 0, '微邮付': 0, '其他': 0 }
  Object.keys(totalIncome).forEach(key => {
    totalIncome[key] = (hotelIncomeByPayment[key] || 0) + (restIncomeByPayment[key] || 0)
  })

  // 获取备用金（来自步骤2）
  const reserveCash = pettyCashRows.value[0] || { cash: 0, wechat: 0, weyoufu: 0, other: 0 }
  const reserve = {
    '现金': reserveCash.cash || 0,
    '微信': reserveCash.wechat || 0,
    '微邮付': reserveCash.weyoufu || 0,
    '其他': reserveCash.other || 0
  }

  // 计算交接款（备用金 + 总收入）
  const handoverAmount = { '现金': 0, '微信': 0, '微邮付': 0, '其他': 0 }
  Object.keys(handoverAmount).forEach(key => {
    handoverAmount[key] = (reserve[key] || 0) + (totalIncome[key] || 0)
  })

  const result = {
    paymentData: {
      reserve,
      hotelIncome: hotelIncomeByPayment,
      restIncome: restIncomeByPayment,
      carRentIncome: { '现金': 0, '微信': 0, '微邮付': 0, '其他': 0 }, // 暂无数据
      totalIncome,
      hotelDeposit: hotelDepositByPayment,
      restDeposit: restDepositByPayment,
      retainedAmount: { '现金': 0, '微信': 0, '微邮付': 0, '其他': 0 }, // 暂无数据
      handoverAmount
    },
    totalRooms: hotelData.length,
    restRooms: restData.length,
    vipCards: 0, // 暂无数据
    cashierName: '', // 需要从用户信息获取
    notes: '',
    goodReview: '', // 暂无数据
    taskList: [],
    newTaskTitle: ''
  }

  console.log('🎯 [步骤4] 最终 confirmationData:', result)

  return result
})

// 完成交接的信息
const completeHandoverInfo = computed(() => ({
  currentOperator: '张三', // 当前交班人
  nextOperator: handoverInfo.value.nextOperator || '李四', // 接班人
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

// 确认备用金
const confirmReserveCash = async () => {
  try {
    isConfirmingCash.value = true

    $q.notify({
      type: 'info',
      message: '正在确认备用金...',
      position: 'top'
    })

    // 模拟确认延迟
    await new Promise(resolve => setTimeout(resolve, 1000))

    const total = pettyCashRows.value[0].total

    $q.notify({
      type: 'positive',
      message: `备用金确认完成，总计: ¥${total.toFixed(2)}`,
      position: 'top'
    })

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

// 检查昨日交接记录
const checkYesterdayRecord = async () => {
  try {
    isCheckingRecord.value = true
    recordCheckResult.value.checked = false



    // 获取今天的日期
    const today = new Date().toISOString().split('T')[0]

    // 调用后端API检查昨日交接记录
    const response = await shiftHandoverApi.checkYesterdayRecord({ date: today })

    if (response.success) {
      const { hasYesterdayRecord, yesterdayDate, recordCount, reserveAmount } = response.data

      recordCheckResult.value.checked = true
      recordCheckResult.value.hasRecord = hasYesterdayRecord
      recordCheckResult.value.yesterdayDate = yesterdayDate
      recordCheckResult.value.recordCount = recordCount
      recordCheckResult.value.reserveAmount = reserveAmount

      if (hasYesterdayRecord) {
        // 如果有昨日记录，自动将昨日交接款作为今日备用金
        if (reserveAmount > 0) {
          console.log('自动导入昨日交接款作为今日备用金:', reserveAmount)
        }
      } else {
        $q.notify({
          type: 'warning',
          message: `检查完成：昨日（${yesterdayDate}）无完整交接记录（找到${recordCount}条记录，需要4条）`,
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

    // 出错时设置为无记录状态
    recordCheckResult.value.checked = true
    recordCheckResult.value.hasRecord = false
  } finally {
    isCheckingRecord.value = false
  }
}

// 下一步
const nextStep = async () => {
  try {
    stepLoading.value = true

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
      const allConfirmed = checkDataRef.value.allDataConfirmed
      const dataCheckCompleted = checkDataRef.value.dataCheckCompleted

      console.log('🔍 [步骤验证] 数据核对状态:', {
        hotelDataCount: hotelData.length,
        restDataCount: restData.length,
        allConfirmed,
        dataCheckCompleted,
        hotelConfirmedStatus: hotelData.map(item => ({ orderNo: item.orderNo, confirmed: item.confirmed })),
        restConfirmedStatus: restData.map(item => ({ orderNo: item.orderNo, confirmed: item.confirmed }))
      })

      // 如果没有数据，也不能进入下一步
      if (hotelData.length === 0 && restData.length === 0) {
        $q.notify({
          type: 'warning',
          message: '当前没有账单数据，请确认是否已加载数据',
          position: 'top'
        })
        return
      }

      if (!allConfirmed) {
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
          message: '请点击"确认核对"按钮完成数据核对',
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

      console.log('💾 [步骤3→4] 保存核对数据:', savedCheckData.value)
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
    const today = new Date().toISOString().split('T')[0]
    const handoverData = {
      date: today,
      handoverPerson: '当前操作员', // TODO: 从用户 store 获取当前用户名
      receivePerson: handoverInfo.value.nextOperator.trim(),
      paymentData: confirmationData.value.paymentData,
      vipCard: confirmationData.value.vipCards || 0,
      taskList: confirmationData.value.taskList || [],
      notes: handoverInfo.value.notes || ''
    }

    console.log('📤 [完成交接] 准备保存的数据:', handoverData)

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
}

.reserve-cash-table :deep(td) {
  padding: 12px 8px;
}

.reserve-cash-table :deep(.q-input) {
  font-weight: 500;
}

.reserve-cash-table :deep(.q-input .q-field__control) {
  height: 32px;
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
    padding: 8px 4px;
  }

  .reserve-cash-table :deep(.q-input) {
    min-width: 80px !important;
  }
}
</style>
