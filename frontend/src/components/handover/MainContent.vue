<template>
  <div class="main-content">
    <div class="content-layout">
      <!-- 左侧主要内容区域 -->
      <div class="main-area">

        <!-- 步骤内容区域 -->
        <div v-if="currentStep > 0 || currentStep === -1" class="step-content q-mb-lg">
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
            @logout="handleLogout"
          />
        </div>

        <!-- 查看交接记录内容 -->
        <div v-if="currentStep === -1" class="view-record-content">
          <q-card flat bordered class="record-detail-card">
            <q-card-section>
              <div class="record-header q-mb-lg">
                <div class="row items-center justify-between">
                  <div class="col">
                    <div class="text-h5 text-primary">
                      <q-icon name="description" class="q-mr-sm" />
                      交接记录详情
                    </div>
                    <div class="text-body2 text-grey-7 q-mt-sm">
                      {{ selectedRecord?.date }} {{ selectedRecord?.shift }} - 操作员：{{ selectedRecord?.operator }}
                    </div>
                  </div>
                  <div class="col-auto">
                    <q-btn
                      flat
                      round
                      icon="close"
                      @click="closeRecordView"
                      class="text-grey-6"
                    />
                  </div>
                </div>
              </div>

              <!-- 支付表格 -->
              <div class="q-mb-lg">
                <ShiftHandoverPaymentTable
                  :paymentData="recordViewData.paymentData"
                  :readOnly="true"
                />
              </div>

              <!-- 统计表格 -->
              <div class="q-mb-lg">
                <ShiftHandoverSpecialStats
                  :totalRooms="recordViewData.totalRooms"
                  :restRooms="recordViewData.restRooms"
                  :vipCards="recordViewData.vipCards"
                  :cashierName="recordViewData.cashierName"
                  :notes="recordViewData.notes"
                  :goodReview="recordViewData.goodReview"
                  :readOnly="true"
                />
              </div>

              <!-- 备忘录 -->
              <div class="q-mb-lg">
                <ShiftHandoverMemoList
                  :taskList="recordViewData.taskList"
                  :newTaskTitle="recordViewData.newTaskTitle"
                  :readOnly="true"
                />
              </div>
            </q-card-section>
          </q-card>
        </div>

        </div>

        <!-- 初始页面内容 -->
        <div v-if="currentStep === 0" class="initial-content">
          <!-- 欢迎卡片 -->
          <q-card flat bordered class="welcome-card q-mb-lg">
            <q-card-section>
              <div class="welcome-header">
                <q-icon name="swap_horiz" size="3rem" color="primary" class="q-mb-md" />
                <div class="text-h5 text-primary q-mb-sm">交接班系统</div>
                <div class="text-body1 text-grey-7">
                  欢迎使用酒店管理系统交接班功能，请在合适的时间开始交接班流程
                </div>
              </div>
            </q-card-section>
          </q-card>

          <!-- 快速统计卡片 -->
          <div class="quick-stats-grid q-mb-lg">
            <q-card flat bordered class="stat-card">
              <q-card-section class="text-center">
                <q-icon name="hotel" size="2rem" color="blue" class="q-mb-sm" />
                <div class="text-h6 text-blue">{{ todayStats.totalRooms }}</div>
                <div class="text-caption text-grey-6">今日开房</div>
              </q-card-section>
            </q-card>

            <q-card flat bordered class="stat-card">
              <q-card-section class="text-center">
                <q-icon name="weekend" size="2rem" color="green" class="q-mb-sm" />
                <div class="text-h6 text-green">{{ todayStats.restRooms }}</div>
                <div class="text-caption text-grey-6">休息房</div>
              </q-card-section>
            </q-card>

            <q-card flat bordered class="stat-card">
              <q-card-section class="text-center">
                <q-icon name="account_balance_wallet" size="2rem" color="orange" class="q-mb-sm" />
                <div class="text-h6 text-orange">¥{{ todayStats.totalIncome.toFixed(0) }}</div>
                <div class="text-caption text-grey-6">今日收入</div>
              </q-card-section>
            </q-card>

            <q-card flat bordered class="stat-card">
              <q-card-section class="text-center">
                <q-icon name="schedule" size="2rem" color="purple" class="q-mb-sm" />
                <div class="text-h6 text-purple">{{ currentTime }}</div>
                <div class="text-caption text-grey-6">当前时间</div>
              </q-card-section>
            </q-card>
          </div>

          <!-- 最近交接记录 -->
          <q-card flat bordered class="recent-handovers q-mb-lg">
            <q-card-section>
              <div class="text-h6 q-mb-md">
                <q-icon name="history" color="primary" class="q-mr-sm" />
                最近交接记录
              </div>
              <q-list>
                <q-item
                  v-for="record in recentHandovers"
                  :key="record.id"
                  clickable
                  @click="viewHandoverRecord(record)"
                  class="handover-record-item"
                >
                  <q-item-section avatar>
                    <q-icon :name="record.status === 'completed' ? 'check_circle' : 'schedule'"
                           :color="record.status === 'completed' ? 'positive' : 'warning'" />
                  </q-item-section>
                  <q-item-section>
                    <q-item-label>{{ record.date }} {{ record.shift }}</q-item-label>
                    <q-item-label caption>操作员：{{ record.operator }} | 状态：{{ record.statusText }}</q-item-label>
                  </q-item-section>
                  <q-item-section side>
                    <q-chip :color="record.status === 'completed' ? 'positive' : 'warning'"
                           text-color="white" size="sm">
                      {{ record.statusText }}
                    </q-chip>
                  </q-item-section>
                </q-item>
              </q-list>
            </q-card-section>
          </q-card>

          <!-- 注意事项 -->
          <q-card flat bordered class="notice-card q-mb-lg">
            <q-card-section>
              <div class="text-h6 q-mb-md">
                <q-icon name="info" color="info" class="q-mr-sm" />
                交接班注意事项
              </div>
              <div class="notice-content">
                <div class="notice-item">
                  <q-icon name="check" color="positive" class="q-mr-sm" />
                  <span>确保所有当日订单已处理完毕</span>
                </div>
                <div class="notice-item">
                  <q-icon name="check" color="positive" class="q-mr-sm" />
                  <span>核对现金、微信、微邮付等各项收入</span>
                </div>
                <div class="notice-item">
                  <q-icon name="check" color="positive" class="q-mr-sm" />
                  <span>检查房间清洁状态和维修情况</span>
                </div>
                <div class="notice-item">
                  <q-icon name="check" color="positive" class="q-mr-sm" />
                  <span>确认明日预订和特殊安排</span>
                </div>
              </div>
            </q-card-section>
          </q-card>
        </div>

        <!-- 主要操作按钮 -->
        <div class="handover-actions">
          <div v-if="currentStep === 0" class="initial-actions">
            <q-btn
              color="primary"
              size="xl"
              icon="swap_horiz"
              label="开始交接班"
              class="handover-btn q-mb-md"
              :loading="isHandoverInProgress"
              @click="handleStartHandover"
            />
          </div>

          <div v-else-if="currentStep < 6" class="step-actions">
            <!-- 步骤操作按钮 -->
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

            <!-- 快速操作按钮 -->
            <div class="quick-actions">
              <q-btn
                color="warning"
                icon="pause"
                label="暂停交接"
                flat
                class="q-mr-md"
                @click="pauseHandover"
              />
              <q-btn
                color="negative"
                icon="close"
                label="取消交接"
                flat
                @click="cancelHandover"
              />
            </div>
          </div>
        </div>
      </div>

      <!-- 右侧步骤进度条 -->
      <div class="sidebar">
        <div class="progress-sidebar">
          <div class="sidebar-header">
            <h6 class="text-primary q-mb-sm">交接班流程</h6>
            <p class="text-caption text-grey-7">当前进度</p>
          </div>

          <q-stepper
            v-model="currentStep"
            ref="stepper"
            color="primary"
            animated
            vertical
            flat
            class="sidebar-stepper"
          >
            <q-step
              :name="1"
              title="检查记录"
              caption="检查昨日有没有交接记录"
              icon="history"
              :done="currentStep > 1"
              :active="currentStep === 1"
            />
            <q-step
              :name="2"
              title="确认备用金"
              caption="核实备用金金额"
              icon="account_balance_wallet"
              :done="currentStep > 2"
              :active="currentStep === 2"
            />
            <q-step
              :name="3"
              title="核对数据"
              caption="核对交接数据"
              icon="fact_check"
              :done="currentStep > 3"
              :active="currentStep === 3"
            />
            <q-step
              :name="4"
              title="确认数据"
              caption="确认交接数据无误"
              icon="verified"
              :done="currentStep > 4"
              :active="currentStep === 4"
            />
            <q-step
              :name="5"
              title="接班信息"
              caption="输入接班人和交接时间"
              icon="person_add"
              :done="currentStep > 5"
              :active="currentStep === 5"
            />
            <q-step
              :name="6"
              title="完成交接"
              caption="完成交接流程"
              icon="check_circle"
              :done="currentStep > 6"
              :active="currentStep === 6"
            />
          </q-stepper>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useQuasar } from 'quasar'
import { useRouter } from 'vue-router'
import CheckData from './CheckData.vue'
import ShiftHandoverPaymentTable from './ShiftHandoverPaymentTable.vue'
import ShiftHandoverSpecialStats from './ShiftHandoverSpecialStats.vue'
import ShiftHandoverMemoList from './ShiftHandoverMemoList.vue'
import HandoverComplete from './HandoverComplete.vue'

// 定义 props
const props = defineProps({
  selectedRecord: {
    type: Object,
    default: null
  }
})

// 主内容组件 - 组合式函数
const $q = useQuasar()
const router = useRouter()

// 响应式状态
const isHandoverInProgress = ref(false)
const currentStep = ref(0) // 0: 未开始, 1-6: 各个步骤
const stepLoading = ref(false)

// 步骤相关数据
const pettyCashAmount = ref(500)
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

// 今日统计数据
const todayStats = ref({
  totalRooms: 12,
  restRooms: 8,
  totalIncome: 3580,
  checkInCount: 15,
  checkOutCount: 8
})

// 最近交接记录
const recentHandovers = ref([
  {
    id: 1,
    date: '2024-01-15',
    shift: '早班',
    operator: '张三',
    status: 'completed',
    statusText: '已完成'
  },
  {
    id: 2,
    date: '2024-01-14',
    shift: '晚班',
    operator: '李四',
    status: 'completed',
    statusText: '已完成'
  },
  {
    id: 3,
    date: '2024-01-14',
    shift: '早班',
    operator: '王五',
    status: 'completed',
    statusText: '已完成'
  }
])

// 当前时间
const currentTime = ref('')
let timeTimer = null

// 查看交接记录相关数据
const selectedRecord = ref(null)
const recordViewData = ref({
  paymentData: {
    reserve: { '现金': 300, '微信': 0, '微邮付': 0, '其他': 0 },
    hotelIncome: { '现金': 800, '微信': 1200, '微邮付': 400, '其他': 200 },
    restIncome: { '现金': 300, '微信': 500, '微邮付': 150, '其他': 50 },
    carRentIncome: { '现金': 0, '微信': 150, '微邮付': 0, '其他': 0 },
    totalIncome: { '现金': 1400, '微信': 1850, '微邮付': 550, '其他': 250 },
    hotelDeposit: { '现金': 200, '微信': 300, '微邮付': 100, '其他': 0 },
    restDeposit: { '现金': 50, '微信': 100, '微邮付': 50, '其他': 0 },
    retainedAmount: { '现金': 150, '微信': 0, '微邮付': 0, '其他': 0 },
    handoverAmount: { '现金': 1000, '微信': 1450, '微邮付': 400, '其他': 250 }
  },
  totalRooms: 18,
  restRooms: 12,
  vipCards: 5,
  cashierName: '张三',
  notes: '昨日营业正常，无特殊情况',
  goodReview: '邀8得6',
  taskList: [
    { id: 1, title: '房间清洁检查完毕', completed: true, type: 'admin', time: '22:30' },
    { id: 2, title: '明日VIP客户接待准备', completed: true, type: 'order', time: '22:45' },
    { id: 3, title: '设备维护记录更新', completed: false, type: 'admin', time: '23:00' }
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

// 格式化交接时间
const formatHandoverTime = computed(() => {
  if (!handoverInfo.value.handoverTime) return '未设置'
  const date = new Date(handoverInfo.value.handoverTime)
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
})

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

// 交接班相关函数
const handleStartHandover = async () => {
  try {
    isHandoverInProgress.value = true

    $q.notify({
      type: 'info',
      message: '正在准备交接班数据...',
      position: 'top'
    })

    // 模拟数据准备过程

    // 显示交接班确认对话框
    $q.dialog({
      title: '确认交接班',
      message: '确定要开始交接班流程吗？系统将引导您完成以下步骤：\n\n1. 检查昨日交接记录\n2. 确认备用金\n3. 核对交接数据\n4. 确认交接数据\n5. 输入接班信息\n6. 完成交接',
      cancel: true,
      persistent: true,
      html: true
    }).onOk(() => {
      startHandoverProcess()
    }).onCancel(() => {
      $q.notify({
        type: 'info',
        message: '已取消交接班',
        position: 'top'
      })
    })
  } catch (error) {
    $q.notify({
      type: 'negative',
      message: '交接班准备失败，请重试',
      position: 'top'
    })
  } finally {
    isHandoverInProgress.value = false
  }
}

// 开始交接班流程
const startHandoverProcess = () => {
  currentStep.value = 1
  $q.notify({
    type: 'positive',
    message: '交接班流程已开始',
    position: 'top'
  })
}

// 下一步
const nextStep = async () => {
  try {
    stepLoading.value = true

    // 模拟步骤处理时间
    await new Promise(resolve => setTimeout(resolve, 1000))

    if (currentStep.value < 6) {
      currentStep.value += 1
      $q.notify({
        type: 'positive',
        message: `进入步骤 ${currentStep.value}: ${getStepTitle(currentStep.value)}`,
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
  if (currentStep.value > 1) {
    currentStep.value -= 1
    $q.notify({
      type: 'info',
      message: `返回步骤 ${currentStep.value}: ${getStepTitle(currentStep.value)}`,
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
    currentStep.value = 6

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

// 暂停交接
const pauseHandover = () => {
  $q.dialog({
    title: '暂停交接',
    message: '确定要暂停当前交接班流程吗？您可以稍后继续。',
    cancel: true,
    persistent: true
  }).onOk(() => {
    $q.notify({
      type: 'warning',
      message: '交接班已暂停',
      position: 'top'
    })
  })
}

// 取消交接
const cancelHandover = () => {
  $q.dialog({
    title: '取消交接',
    message: '确定要取消当前交接班流程吗？所有进度将会丢失。',
    cancel: true,
    persistent: true
  }).onOk(() => {
    currentStep.value = 0
    $q.notify({
      type: 'warning',
      message: '交接班已取消',
      position: 'top'
    })
  })
}

// 处理登出
const handleLogout = async () => {
  try {
    $q.notify({
      type: 'info',
      message: '正在处理登出...',
      position: 'top'
    })

    // 这里可以调用后端API来记录交接完成
    // await api.completeHandover(handoverData)

    // 清除本地存储的用户信息
    localStorage.removeItem('userToken')
    localStorage.removeItem('userInfo')

    // 清除其他可能的本地数据
    localStorage.removeItem('handoverData')

    $q.notify({
      type: 'positive',
      message: '交接班已完成，账号已登出',
      position: 'top',
      timeout: 2000
    })

    // 跳转到登录页面
    router.push('/login')

  } catch (error) {
    console.error('处理登出失败:', error)
    $q.notify({
      type: 'negative',
      message: '登出处理失败，请重试',
      position: 'top'
    })
  }
}

// 查看交接记录
const viewHandoverRecord = (record) => {
  console.log('点击查看记录:', record)
  console.log('当前步骤变更前:', currentStep.value)

  selectedRecord.value = record
  currentStep.value = -1 // 使用-1表示查看记录状态

  console.log('当前步骤变更后:', currentStep.value)

  $q.notify({
    type: 'info',
    message: `正在查看 ${record.date} ${record.shift} 的交接记录`,
    position: 'top'
  })
}

// 监听来自父组件的 selectedRecord 变化
watch(() => props.selectedRecord, (newRecord) => {
  if (newRecord) {
    console.log('MainContent - 接收到选中的记录:', newRecord)
    selectedRecord.value = newRecord
    currentStep.value = -1 // 切换到查看记录状态

    console.log('MainContent - 当前步骤变更为:', currentStep.value)
  }
})

// 关闭记录查看
const closeRecordView = () => {
  selectedRecord.value = null
  currentStep.value = 0 // 返回初始状态

  $q.notify({
    type: 'info',
    message: '已关闭交接记录查看',
    position: 'top'
  })
}

// 更新当前时间
const updateCurrentTime = () => {
  const now = new Date()
  currentTime.value = now.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}

// 生命周期钩子
onMounted(() => {
  console.log('MainContent mounted')

  // 初始化时间
  updateCurrentTime()

  // 每秒更新时间
  timeTimer = setInterval(updateCurrentTime, 1000)
})

onUnmounted(() => {
  if (timeTimer) {
    clearInterval(timeTimer)
  }
})
</script>

<style scoped>
.main-content {
  background: linear-gradient(135deg, #fafafa 0%, #e6e5e8 100%);
  position: relative;
  height: 100vh;
  display: flex;
  flex-direction: column;
  overflow: hidden; /* 取消主容器的滚动条 */
}

/* 新的内容布局 */
.content-layout {
  display: flex;
  flex: 1;
  height: 100vh;
  overflow: hidden;
}

/* 左侧主要内容区域 */
.main-area {
  flex: 1;
  padding: 20px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
}

/* 右侧边栏 */
.sidebar {
  width: 300px;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(10px);
  border-left: 1px solid rgba(0, 0, 0, 0.1);
  display: flex;
  flex-direction: column;
  overflow: hidden; /* 完全禁用边栏滚动 */
}

.progress-sidebar {
  padding: 20px;
  height: 100%;
  overflow: hidden; /* 完全禁用滚动 */
}

.sidebar-header {
  text-align: center;
  margin-bottom: 24px;
  padding-bottom: 16px;
  border-bottom: 1px solid #e0e0e0;
}

.sidebar-stepper {
  background: transparent;
  overflow: hidden; /* 禁用stepper滚动 */
}

.sidebar-stepper :deep(.q-stepper__step-inner) {
  padding: 12px 0;
}

.sidebar-stepper :deep(.q-stepper) {
  overflow: hidden !important; /* 强制禁用Quasar stepper的滚动 */
}

.sidebar-stepper :deep(.q-stepper__content) {
  overflow: hidden !important; /* 禁用stepper内容区滚动 */
}

.sidebar-stepper :deep(.q-stepper__title) {
  font-size: 14px;
  font-weight: 600;
}

.sidebar-stepper :deep(.q-stepper__caption) {
  font-size: 12px;
  line-height: 1.4;
}

/* 步骤内容区域 */
.step-content {
  width: 100%;
  max-width: 800px;
}

.step-content .q-card {
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(10px);
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
}

/* 各步骤特定样式 */
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

.completion-summary {
  padding: 20px;
}

.summary-info {
  margin-top: 20px;
}


/* 操作按钮区域 */
.handover-actions {
  width: 100%;
  max-width: 600px;
  display: flex;
  justify-content: center;
  text-align: center;
}

.initial-actions .handover-btn {
  padding: 20px 40px;
  font-size: 18px;
  font-weight: 600;
  border-radius: 12px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
  transition: all 0.3s ease;
  min-width: 200px;
}

.initial-actions .handover-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.2);
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

/* 快速操作按钮 */
.quick-actions {
  display: flex;
  gap: 12px;
  align-items: center;
}

.quick-actions .q-btn {
  border-radius: 6px;
  padding: 6px 12px;
  font-weight: 500;
  font-size: 12px;
  transition: all 0.2s ease;
}

.quick-actions .q-btn:hover {
  transform: translateY(-1px);
}

/* 响应式设计 */
@media (max-width: 1024px) {
  .sidebar {
    width: 250px;
  }

  .sidebar-header h6 {
    font-size: 14px;
  }

  .sidebar-stepper :deep(.q-stepper__title) {
    font-size: 13px;
  }

  .sidebar-stepper :deep(.q-stepper__caption) {
    font-size: 11px;
  }
}

@media (max-width: 768px) {
  .content-layout {
    flex-direction: column;
  }

  .sidebar {
    width: 100%;
    height: auto;
    order: -1;
    border-left: none;
    border-bottom: 1px solid rgba(0, 0, 0, 0.1);
  }

  .progress-sidebar {
    padding: 16px;
  }

  .sidebar-stepper {
    display: flex;
    overflow-x: auto;
  }

  .sidebar-stepper :deep(.q-stepper__step) {
    min-width: 120px;
  }

  .main-area {
    padding: 16px;
    gap: 16px;
  }

  .step-content {
    max-width: 100%;
  }

  .handover-actions {
    max-width: 100%;
  }

  .initial-actions .handover-btn {
    padding: 16px 32px;
    font-size: 16px;
    min-width: 180px;
  }

  .action-buttons {
    flex-direction: column;
    gap: 8px;
  }

  .action-buttons .q-btn {
    min-width: 200px;
  }

  .quick-actions {
    flex-direction: column;
    gap: 8px;
  }

  .quick-actions .q-btn {
    min-width: 150px;
  }
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

/* 初始页面内容样式 */
.initial-content {
  width: 100%;
  max-width: 800px;
  animation: fadeIn 0.5s ease-out;
}

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

.welcome-card {
  background: linear-gradient(135deg, rgba(25, 118, 210, 0.05) 0%, rgba(25, 118, 210, 0.1) 100%);
  border-radius: 16px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
}

.welcome-header {
  text-align: center;
  padding: 20px;
}

.quick-stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 16px;
}

.stat-card {
  background: rgba(255, 255, 255, 0.95);
  border-radius: 12px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
  transition: all 0.3s ease;
  border: 1px solid rgba(0, 0, 0, 0.05);
}

.stat-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
}

.recent-handovers {
  background: rgba(255, 255, 255, 0.95);
  border-radius: 12px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
}

.notice-card {
  background: rgba(255, 255, 255, 0.95);
  border-radius: 12px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
}

.notice-content {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.notice-item {
  display: flex;
  align-items: center;
  padding: 8px 12px;
  background: rgba(76, 175, 80, 0.05);
  border-radius: 8px;
  border-left: 3px solid #4caf50;
}

/* 小屏幕下进度条优化 */
@media (max-width: 600px) {
  .progress-stepper {
    font-size: 12px;
  }

  .progress-stepper :deep(.q-stepper__step-inner) {
    padding: 8px 4px;
  }

  .progress-stepper :deep(.q-stepper__title) {
    font-size: 11px;
  }

  .progress-stepper :deep(.q-stepper__caption) {
    display: none;
  }

  /* 表格响应式 */
  .reserve-cash-table :deep(td) {
    padding: 8px 4px;
  }

  .reserve-cash-table :deep(.q-input) {
    min-width: 80px !important;
  }

  /* 初始页面响应式 */
  .quick-stats-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 12px;
  }

  .stat-card {
    border-radius: 8px;
  }

  .welcome-header {
    padding: 16px;
  }

  .notice-item {
    padding: 6px 10px;
  }
}

/* 交接记录查看样式 */
.handover-record-item {
  transition: all 0.2s ease;
  border-radius: 8px;
  margin: 4px 0;
}

.handover-record-item:hover {
  background-color: rgba(25, 118, 210, 0.04);
  transform: translateX(4px);
}

.view-record-content {
  width: 100%;
  max-width: 1000px;
  animation: slideInFromRight 0.3s ease-out;
}

@keyframes slideInFromRight {
  from {
    opacity: 0;
    transform: translateX(20px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

.record-detail-card {
  background: rgba(255, 255, 255, 0.95);
  border-radius: 16px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
}

.record-header {
  border-bottom: 1px solid rgba(0, 0, 0, 0.08);
  padding-bottom: 16px;
}

/* 记录详情响应式 */
@media (max-width: 768px) {
  .view-record-content {
    max-width: 100%;
  }

  .record-detail-card {
    border-radius: 12px;
  }

  .handover-record-item:hover {
    transform: none;
  }
}
</style>
