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
            <!-- 有记录的情况 -->
            <div v-if="recordCheckResult.hasRecord" class="text-body2 text-positive">
              ✅ 昨日有交接记录，将自动导入备用金
            </div>

            <!-- 无记录的情况 -->
            <div v-else class="text-body2 text-negative">
              ❌ 昨日没有交接记录，请手动输入备用金
            </div>
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
      <CheckData />
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
  hasRecord: false
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

// 确认数据的模拟数据
const confirmationData = ref({
  paymentData: {
    reserve: { '现金': 500, '微信': 0, '微邮付': 0, '其他': 0 },
    hotelIncome: { '现金': 1200, '微信': 800, '微邮付': 300, '其他': 100 },
    restIncome: { '现金': 400, '微信': 600, '微邮付': 200, '其他': 50 },
    carRentIncome: { '现金': 0, '微信': 200, '微邮付': 0, '其他': 0 },
    totalIncome: { '现金': 2100, '微信': 1600, '微邮付': 500, '其他': 150 },
    hotelDeposit: { '现金': 300, '微信': 200, '微邮付': 100, '其他': 0 },
    restDeposit: { '现金': 100, '微信': 150, '微邮付': 50, '其他': 0 },
    retainedAmount: { '现金': 200, '微信': 0, '微邮付': 0, '其他': 0 },
    handoverAmount: { '现金': 1600, '微信': 1250, '微邮付': 350, '其他': 150 }
  },
  totalRooms: 15,
  restRooms: 8,
  vipCards: 3,
  cashierName: '张三',
  notes: '今日正常营业，无异常情况',
  goodReview: '邀5得3',
  taskList: [
    { id: 1, title: '检查房间清洁状况', completed: true, type: 'admin', time: '14:30' },
    { id: 2, title: '确认明日预订情况', completed: false, type: 'order', time: '15:00' },
    { id: 3, title: '整理前台文件', completed: true, type: 'admin', time: '16:00' }
  ],
  newTaskTitle: ''
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

    $q.notify({
      type: 'info',
      message: '正在检查昨日交接记录...',
      position: 'top'
    })

    // 模拟检查延迟
    await new Promise(resolve => setTimeout(resolve, 1500))

    // 模拟随机结果
    const hasRecord = Math.random() > 0.5

    recordCheckResult.value.checked = true
    recordCheckResult.value.hasRecord = hasRecord

    if (hasRecord) {
      $q.notify({
        type: 'positive',
        message: '检查完成：发现昨日交接记录',
        position: 'top'
      })
    } else {
      $q.notify({
        type: 'warning',
        message: '检查完成：昨日无交接记录',
        position: 'top'
      })
    }

  } catch (error) {
    console.error('检查昨日交接记录失败:', error)
    $q.notify({
      type: 'negative',
      message: '检查昨日交接记录失败，请稍后重试',
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

    // 模拟步骤处理时间
    await new Promise(resolve => setTimeout(resolve, 1000))

    if (props.currentStep < 6) {
      emit('step-change', props.currentStep + 1)
      $q.notify({
        type: 'positive',
        message: `进入步骤 ${props.currentStep + 1}: ${getStepTitle(props.currentStep + 1)}`,
        position: 'top'
      })
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
    $q.notify({
      type: 'info',
      message: `返回步骤 ${props.currentStep - 1}: ${getStepTitle(props.currentStep - 1)}`,
      position: 'top'
    })
  }
}

// 完成交接
const completeHandover = async () => {
  try {
    stepLoading.value = true

    $q.notify({
      type: 'info',
      message: '正在完成交接班...',
      position: 'top'
    })

    // 模拟完成交接的处理时间
    await new Promise(resolve => setTimeout(resolve, 2000))

    // 跳转到完成页面（步骤6）
    emit('step-change', 6)
    emit('complete')

    $q.notify({
      type: 'positive',
      message: '交接班流程已完成！',
      position: 'top'
    })

  } catch (error) {
    $q.notify({
      type: 'negative',
      message: '完成交接失败，请重试',
      position: 'top'
    })
  } finally {
    stepLoading.value = false
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
