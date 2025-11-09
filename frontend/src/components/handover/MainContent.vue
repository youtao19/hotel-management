<template>
  <div class="main-content">
    <div class="content-layout">
      <!-- 左侧主要内容区域 -->
      <div class="main-area">

        <!-- 步骤内容区域 -->
        <div v-if="currentStep > 0 && currentStep !== -1" class="step-content q-mb-lg">
          <HandoverProcess
            :currentStep="currentStep"
            @step-change="handleStepChange"
            @complete="handleHandoverComplete"
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
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { useQuasar } from 'quasar'
import { useRouter } from 'vue-router'
import { shiftHandoverApi } from '../../api/index.js'
import { useUserStore } from 'src/stores/userStore'
import HandoverProcess from './HandoverProcess.vue'
import ShiftHandoverPaymentTable from './ShiftHandoverPaymentTable.vue'
import ShiftHandoverSpecialStats from './ShiftHandoverSpecialStats.vue'
import ShiftHandoverMemoList from './ShiftHandoverMemoList.vue'

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
const userStore = useUserStore()

// 响应式状态
const isHandoverInProgress = ref(false)
const currentStep = ref(0) // 0: 未开始, 1-6: 各个步骤

// 今日统计数据
const todayStats = ref({
  totalRooms: 0,
  restRooms: 0
})

// 最近交接记录（从API获取）
const recentHandovers = ref([])

// 当前时间
const currentTime = ref('')
let timeTimer = null

// 查看交接记录相关数据（从API获取）
const selectedRecord = ref(null)
const recordViewData = ref({
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
})

// 交接班相关函数
const handleStartHandover = async () => {
  try {
    isHandoverInProgress.value = true

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
      console.log('MainContent - 已取消交接班')
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
}

// 处理步骤变化
const handleStepChange = (step) => {
  currentStep.value = step
}

// 处理交接完成
const handleHandoverComplete = () => {
  // 可以在这里添加完成后的逻辑
  console.log('交接班已完成')
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

    await userStore.logout()

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

// 加载交接记录数据
const loadHandoverRecordData = async (date) => {
  try {
    // 并行请求所有需要的数据
    const [tableResponse, specialStatsResponse, memoResponse] = await Promise.all([
      shiftHandoverApi.getHandoverTableData({ date }),
      shiftHandoverApi.getSpecialStats({ date }),
      shiftHandoverApi.getAdminMemos({ date })
    ])

    // 处理表格数据
    if (tableResponse.success) {
      recordViewData.value.paymentData = tableResponse.data
      // 从表格数据中提取 vipCards、cashierName 和 notes
      recordViewData.value.vipCards = tableResponse.data.vipCards || 0
      recordViewData.value.cashierName = tableResponse.data.handoverPerson || ''
      recordViewData.value.notes = tableResponse.data.remarks || ''
    }

    // 处理统计数据
    if (specialStatsResponse.success) {
      const stats = specialStatsResponse.data
      recordViewData.value.totalRooms = stats.openCount || 0
      recordViewData.value.restRooms = stats.restCount || 0
      // 拼接好评字符串：邀X得Y
      recordViewData.value.goodReview = `邀${stats.invited || 0}得${stats.positive || 0}`
    }

    // 处理备忘录数据
    if (memoResponse.success) {
      recordViewData.value.taskList = memoResponse.data || []
    }



  } catch (error) {
    console.error('加载交接记录数据失败:', error)
    throw error
  }
}

// 查看交接记录
const viewHandoverRecord = async (record) => {
  try {
    console.log('点击查看记录:', record)

    selectedRecord.value = record
    currentStep.value = -1 // 使用-1表示查看记录状态

    // 调用后端API获取交接班表格数据
    await loadHandoverRecordData(record.date)

  } catch (error) {
    console.error('查看交接记录失败:', error)
    $q.notify({
      type: 'negative',
      message: '加载交接记录失败，请重试',
      position: 'top'
    })
  }
}

// 监听来自父组件的 selectedRecord 变化
watch(() => props.selectedRecord, async (newRecord) => {
  if (newRecord) {
    console.log('MainContent - 接收到选中的记录:', newRecord)
    selectedRecord.value = newRecord
    currentStep.value = -1 // 切换到查看记录状态

    console.log('MainContent - 当前步骤变更为:', currentStep.value)

    try {
      console.log('MainContent - 加载交接记录:', newRecord.date)
      // 调用后端API获取交接班表格数据
      await loadHandoverRecordData(newRecord.date)
    } catch (error) {
      console.error('从父组件加载交接记录失败:', error)
    }
  }
})

// 关闭记录查看
const closeRecordView = () => {
  selectedRecord.value = null
  currentStep.value = 0 // 返回初始状态

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

const formatLocalDate = (date = new Date()) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// 加载今日统计数据
const loadTodayStats = async () => {
  try {
    // 获取当地时区的当前日期（YYYY-MM-DD）
    const today = formatLocalDate(new Date())

    console.log('📊 [MainContent] 获取今日统计数据:', today)

    // 调用 API 获取今日开房和休息房数据
    const response = await shiftHandoverApi.getSpecialStats({ date: today })

    if (response.success) {
      todayStats.value.totalRooms = response.data.openCount || 0
      todayStats.value.restRooms = response.data.restCount || 0
    }
  } catch (error) {
    console.error('加载今日统计数据失败:', error)
  }
}

// 加载最近交接记录
const loadRecentHandovers = async () => {
  try {
    const response = await shiftHandoverApi.queryHandoverRecords()
    if (response.success) {
      // 取最近的3条记录并格式化
      recentHandovers.value = response.data.slice(0, 3).map(record => ({
        id: record.date,
        date: record.date,
        shift: '班次', // 可以根据时间判断班次
        operator: record.handoverPerson && record.takeoverPerson
          ? `${record.handoverPerson} → ${record.takeoverPerson}`
          : '未知',
        status: 'completed',
        statusText: '已完成'
      }))
    }
  } catch (error) {
    console.error('加载最近交接记录失败:', error)
  }
}

// 生命周期钩子
onMounted(() => {
  console.log('MainContent mounted')

  // 初始化时间
  updateCurrentTime()

  // 每秒更新时间
  timeTimer = setInterval(updateCurrentTime, 1000)

  // 加载今日统计数据
  loadTodayStats()

  // 加载最近交接记录
  loadRecentHandovers()
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
  width: 180px; /* 增加宽度以适应中文显示 */
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(10px);
  border-left: 1px solid rgba(0, 0, 0, 0.1);
  display: flex;
  flex-direction: column;
  overflow: hidden; /* 完全禁用边栏滚动 */
}

.progress-sidebar {
  padding: 12px;
  height: 100%;
  overflow: hidden; /* 完全禁用滚动 */
}

.sidebar-header {
  text-align: center;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid #e0e0e0;
}

.sidebar-stepper {
  background: transparent;
  overflow: hidden; /* 禁用stepper滚动 */
}

.sidebar-stepper :deep(.q-stepper__step-inner) {
  padding: 8px 4px; /* 增加左右内边距 */
}

.sidebar-stepper :deep(.q-stepper) {
  overflow: visible !important; /* 允许文字完全显示 */
}

.sidebar-stepper :deep(.q-stepper__content) {
  overflow: visible !important; /* 允许内容完全显示 */
}

.sidebar-stepper :deep(.q-stepper__title) {
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap; /* 禁止文字换行 */
  overflow: visible; /* 允许文字完全显示 */
  line-height: 1.2;
  margin-left: 4px; /* 与图标保持适当距离 */
}

.sidebar-stepper :deep(.q-stepper__caption) {
  font-size: 9px;
  line-height: 1.3;
  display: none; /* 在窄边栏中隐藏说明文字 */
}

/* 步骤内容区域 */
.step-content {
  width: 100%;
  max-width: 1000px; /* 增加最大宽度 */
}

/* 操作按钮区域 */
.handover-actions {
  width: 100%;
  max-width: 800px; /* 增加最大宽度 */
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

/* 响应式设计 */
@media (max-width: 1024px) {
  .sidebar {
    width: 140px; /* 调整中等屏幕宽度 */
  }

  .progress-sidebar {
    padding: 8px;
  }

  .sidebar-header h6 {
    font-size: 12px;
  }

  .sidebar-stepper :deep(.q-stepper__title) {
    font-size: 11px;
    white-space: nowrap;
    overflow: visible;
    margin-left: 3px;
  }

  .sidebar-stepper :deep(.q-stepper__caption) {
    display: none; /* 完全隐藏说明文字 */
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
    padding: 8px; /* 进一步减少内边距 */
  }

  .sidebar-stepper {
    display: flex;
    overflow-x: auto;
  }

  .sidebar-stepper :deep(.q-stepper__step) {
    min-width: 100px; /* 调整最小宽度以适应文字 */
  }

  .sidebar-stepper :deep(.q-stepper__title) {
    font-size: 10px;
    white-space: nowrap;
    overflow: visible;
    margin-left: 2px;
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
}

/* 初始页面内容样式 */
.initial-content {
  width: 100%;
  max-width: 1000px; /* 增加初始页面最大宽度 */
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
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
  max-width: 900px;
  margin: 0 auto;
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
  .sidebar {
    height: 80px; /* 移动端减少高度 */
  }

  .progress-sidebar {
    padding: 4px;
  }

  .sidebar-header {
    margin-bottom: 8px;
    padding-bottom: 8px;
  }

  .sidebar-header h6 {
    font-size: 10px;
  }

  .sidebar-header p {
    display: none; /* 隐藏副标题 */
  }

  .sidebar-stepper :deep(.q-stepper__step-inner) {
    padding: 4px 2px;
  }

  .sidebar-stepper :deep(.q-stepper__title) {
    font-size: 9px;
    white-space: nowrap;
    overflow: visible;
    margin-left: 2px;
  }

  .sidebar-stepper :deep(.q-stepper__caption) {
    display: none;
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

  /* 内容区域响应式 */
  .step-content,
  .initial-content,
  .view-record-content {
    max-width: 100%; /* 移动端充分利用宽度 */
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
  max-width: 1200px; /* 增加查看记录的最大宽度 */
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
