<template>
  <q-page class="shift-handover">
    <div class="q-pa-md">
      <!-- 标题和操作区域 -->
      <div class="row items-center justify-between q-mb-md">
        <div class="text-h4 text-weight-bold">交接班</div>
        <div class="row q-gutter-md">
          <q-btn color="primary" icon="print" label="打印" @click="printHandover" />
          <q-btn color="green" icon="download" label="导出Excel" @click="exportToExcel" />
          <q-btn color="orange" icon="save" label="保存交接记录" @click="saveHandover" />
          <q-btn color="blue" icon="history" label="历史记录" @click="openHistoryDialog" />
        </div>
      </div>

      <!-- 日期和人员信息 -->
      <div class="row q-col-gutter-md q-mb-md">
        <div class="col-md-4">
          <q-input v-model="selectedDate" type="date" label="交接日期" filled @update:model-value="loadShiftData" />
        </div>
        <div class="col-md-4">
          <q-input v-model="handoverPerson" label="交班人" filled />
        </div>
        <div class="col-md-4">
          <q-input v-model="receivePerson" label="接班人" filled />
        </div>
      </div>

      <!-- 主要交接班表格 -->
      <div class="shift-table-container">
        <table class="shift-table">
          <!-- 表头 -->
          <thead>
            <tr class="table-header">
              <th colspan="10" class="text-center text-h6 text-weight-bold">交接班</th>
            </tr>
            <tr class="sub-header">
              <th class="payment-method-header">支付方式</th>
              <th class="payment-method-header">备用金</th>
              <th class="income-header">客房<br/>收入1</th>
              <th class="income-header">休息房<br/>收入2</th>
              <th class="income-header">租车<br/>收入3</th>
              <th class="total-header">合计</th>
              <th class="deposit-header">客房<br/>退押</th>
              <th class="deposit-header">休息退押</th>
              <th class="retained-header">留存款</th>
              <th class="handover-header">交接款</th>
            </tr>
          </thead>

          <!-- 支付方式行 -->
          <tbody>
            <!-- 现金 -->
            <tr class="payment-row cash-row">
              <td class="payment-label">现金</td>
              <td class="editable-cell">
                <q-input v-model.number="paymentData.cash.reserveCash" type="number" dense borderless class="table-input" @update:model-value="calculateTotals" />
              </td>
              <td class="editable-cell">
                <q-input v-model.number="paymentData.cash.hotelIncome" type="number" dense borderless class="table-input" @update:model-value="calculateTotals" />
              </td>
              <td class="editable-cell">
                <q-input v-model.number="paymentData.cash.restIncome" type="number" dense borderless class="table-input" @update:model-value="calculateTotals" />
              </td>
              <td class="editable-cell">
                <q-input v-model.number="paymentData.cash.carRentIncome" type="number" dense borderless class="table-input" @update:model-value="calculateTotals" />
              </td>
              <td class="total-cell">{{ paymentData.cash.total.toFixed(0) }}</td>
              <td class="editable-cell">
                <q-input v-model.number="paymentData.cash.hotelDeposit" type="number" dense borderless class="table-input" @update:model-value="calculateTotals" />
              </td>
              <td class="editable-cell">
                <q-input v-model.number="paymentData.cash.restDeposit" type="number" dense borderless class="table-input" @update:model-value="calculateTotals" />
              </td>
              <td class="editable-cell">
                <q-input v-model.number="paymentData.cash.retainedAmount" type="number" dense borderless class="table-input" @update:model-value="calculateTotals" />
              </td>
              <td class="auto-calculate">{{ (paymentData.cash.total - paymentData.cash.hotelDeposit - paymentData.cash.restDeposit - paymentData.cash.retainedAmount).toFixed(0) }}</td>
            </tr>

            <!-- 微信 -->
            <tr class="payment-row wechat-row">
              <td class="payment-label">微信</td>
              <td class="editable-cell">
                <q-input v-model.number="paymentData.wechat.reserveCash" type="number" dense borderless class="table-input" @update:model-value="calculateTotals" />
              </td>
              <td class="editable-cell">
                <q-input v-model.number="paymentData.wechat.hotelIncome" type="number" dense borderless class="table-input" @update:model-value="calculateTotals" />
              </td>
              <td class="editable-cell">
                <q-input v-model.number="paymentData.wechat.restIncome" type="number" dense borderless class="table-input" @update:model-value="calculateTotals" />
              </td>
              <td class="editable-cell">
                <q-input v-model.number="paymentData.wechat.carRentIncome" type="number" dense borderless class="table-input" @update:model-value="calculateTotals" />
              </td>
              <td class="total-cell">{{ paymentData.wechat.total.toFixed(0) }}</td>
              <td class="editable-cell">
                <q-input v-model.number="paymentData.wechat.hotelDeposit" type="number" dense borderless class="table-input" @update:model-value="calculateTotals" />
              </td>
              <td class="editable-cell">
                <q-input v-model.number="paymentData.wechat.restDeposit" type="number" dense borderless class="table-input" @update:model-value="calculateTotals" />
              </td>
              <td class="editable-cell">
                <q-input v-model.number="paymentData.wechat.retainedAmount" type="number" dense borderless class="table-input" @update:model-value="calculateTotals" />
              </td>
              <td class="auto-calculate">{{ (paymentData.wechat.total - paymentData.wechat.hotelDeposit - paymentData.wechat.restDeposit - paymentData.wechat.retainedAmount).toFixed(0) }}</td>
            </tr>

            <!-- 支付宝 -->
            <tr class="payment-row digital-row">
              <td class="payment-label">微邮付</td>
              <td class="editable-cell">
                <q-input v-model.number="paymentData.digital.reserveCash" type="number" dense borderless class="table-input" @update:model-value="calculateTotals" />
              </td>
              <td class="editable-cell">
                <q-input v-model.number="paymentData.digital.hotelIncome" type="number" dense borderless class="table-input" @update:model-value="calculateTotals" />
              </td>
              <td class="editable-cell">
                <q-input v-model.number="paymentData.digital.restIncome" type="number" dense borderless class="table-input" @update:model-value="calculateTotals" />
              </td>
              <td class="editable-cell">
                <q-input v-model.number="paymentData.digital.carRentIncome" type="number" dense borderless class="table-input" @update:model-value="calculateTotals" />
              </td>
              <td class="total-cell">{{ paymentData.digital.total.toFixed(0) }}</td>
              <td class="editable-cell">
                <q-input v-model.number="paymentData.digital.hotelDeposit" type="number" dense borderless class="table-input" @update:model-value="calculateTotals" />
              </td>
              <td class="editable-cell">
                <q-input v-model.number="paymentData.digital.restDeposit" type="number" dense borderless class="table-input" @update:model-value="calculateTotals" />
              </td>
              <td class="editable-cell">
                <q-input v-model.number="paymentData.digital.retainedAmount" type="number" dense borderless class="table-input" @update:model-value="calculateTotals" />
              </td>
              <td class="auto-calculate">{{ (paymentData.digital.total - paymentData.digital.hotelDeposit - paymentData.digital.restDeposit - paymentData.digital.retainedAmount).toFixed(0) }}</td>
            </tr>

            <!-- 其他方式 -->
            <tr class="payment-row other-row">
              <td class="payment-label">其他方式</td>
              <td class="editable-cell">
                <q-input v-model.number="paymentData.other.reserveCash" type="number" dense borderless class="table-input" @update:model-value="calculateTotals" />
              </td>
              <td class="editable-cell">
                <q-input v-model.number="paymentData.other.hotelIncome" type="number" dense borderless class="table-input" @update:model-value="calculateTotals" />
              </td>
              <td class="editable-cell">
                <q-input v-model.number="paymentData.other.restIncome" type="number" dense borderless class="table-input" @update:model-value="calculateTotals" />
              </td>
              <td class="editable-cell">
                <q-input v-model.number="paymentData.other.carRentIncome" type="number" dense borderless class="table-input" @update:model-value="calculateTotals" />
              </td>
              <td class="total-cell">{{ paymentData.other.total.toFixed(0) }}</td>
              <td class="editable-cell">
                <q-input v-model.number="paymentData.other.hotelDeposit" type="number" dense borderless class="table-input" @update:model-value="calculateTotals" />
              </td>
              <td class="editable-cell">
                <q-input v-model.number="paymentData.other.restDeposit" type="number" dense borderless class="table-input" @update:model-value="calculateTotals" />
              </td>
              <td class="editable-cell">
                <q-input v-model.number="paymentData.other.retainedAmount" type="number" dense borderless class="table-input" @update:model-value="calculateTotals" />
              </td>
              <td class="auto-calculate">{{ (paymentData.other.total - paymentData.other.hotelDeposit - paymentData.other.restDeposit - paymentData.other.retainedAmount).toFixed(0) }}</td>
            </tr>


          </tbody>
        </table>

        <!-- 今日待办事项 -->
        <div class="row q-mt-lg">
          <div class="col-12">
            <div class="task-management-container">
                              <div class="task-management-header">
                  <q-icon name="task_alt" size="24px" class="q-mr-sm" />
                  <span class="text-h6 text-weight-bold">今日待办事项</span>
                </div>

              <div class="task-management-content">
                <div class="task-list-horizontal">
                  <div
                    v-for="(task, index) in taskList"
                    :key="task.id"
                    class="task-card"
                    :class="{ 'task-completed': task.completed }"
                  >
                    <q-checkbox
                      v-model="task.completed"
                      class="task-checkbox"
                      @update:model-value="updateTaskStatus(task.id, $event)"
                    />
                    <div class="task-content" @click="editTask(index)">
                      <div class="task-title" :class="{ 'completed': task.completed }">
                        {{ task.title }}
                      </div>
                      <div class="task-time" v-if="task.time">
                        <q-icon name="schedule" size="14px" class="q-mr-xs" />
                        {{ task.time }}
                      </div>
                    </div>
                    <q-btn
                      flat
                      round
                      dense
                      size="sm"
                      icon="close"
                      class="task-delete"
                      @click="deleteTask(index)"
                    />
                  </div>

                  <!-- 添加新任务卡片 -->
                  <div class="add-task-card">
                    <q-input
                      v-model="newTaskTitle"
                      placeholder="添加新任务..."
                      dense
                      borderless
                      class="add-task-input"
                      @keyup.enter="addNewTask"
                    >
                      <template v-slot:prepend>
                        <q-icon name="add" />
                      </template>
                      <template v-slot:append>
                        <q-btn
                          flat
                          round
                          dense
                          size="sm"
                          icon="add"
                          color="primary"
                          @click="addNewTask"
                          :disable="!newTaskTitle.trim()"
                        />
                      </template>
                    </q-input>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 特殊统计 -->
        <div class="row q-mt-md q-col-gutter-md">
          <div class="col-md-6">
            <table class="special-stats-table">
              <tbody>
                <tr>
                  <td class="stats-label">好评</td>
                  <td class="stats-value">遗1</td>
                  <td class="stats-label">得1</td>
                  <td class="stats-label">开房</td>
                  <td class="stats-number">{{ totalRooms }}</td>
                  <td class="stats-label">收银员</td>
                  <td rowspan="2" class="cashier-name">
                    <q-input v-model="cashierName" dense borderless class="text-center" placeholder="张" />
                  </td>
                </tr>
                <tr>
                  <td class="stats-label">大美卡</td>
                  <td class="stats-number">{{ vipCards }}</td>
                  <td class="stats-label">休息房</td>
                  <td class="stats-number">{{ restRooms }}</td>
                  <td class="stats-label">备注</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>


      </div>
    </div>

    <!-- 历史记录组件 -->
    <ShiftHandoverHistory ref="historyDialogRef" @close="onHistoryDialogClose" />
  </q-page>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue'
import { date } from 'quasar'
import { useQuasar } from 'quasar'
import { shiftHandoverApi } from '../api/index.js'
import ShiftHandoverHistory from '../components/ShiftHandoverHistory.vue'

const $q = useQuasar()

// 基础数据
const selectedDate = ref(date.formatDate(new Date(), 'YYYY-MM-DD'))
const handoverPerson = ref('')
const receivePerson = ref('')
const cashierName = ref('张')
const notes = ref('')

// 任务列表相关
const newTaskTitle = ref('')
const taskList = ref([
  {
    id: 1,
    title: '检查101房间空调',
    time: '10:00',
    completed: false
  },
  {
    id: 2,
    title: '接待VIP客人',
    time: '12:30',
    completed: false
  },
  {
    id: 3,
    title: '安排会议室布置',
    time: '14:00',
    completed: true
  },
  {
    id: 4,
    title: '处理客户投诉',
    time: '15:30',
    completed: false
  },
  {
    id: 5,
    title: '检查库存',
    time: '16:00',
    completed: false
  }
])

// 历史记录组件引用
const historyDialogRef = ref(null)





// 支付方式数据结构
const paymentData = ref({
  cash: {
    reserveCash: 320,
    hotelIncome: 0,
    restIncome: 100,
    carRentIncome: 0,
    total: 420,
    hotelDeposit: 80,
    restDeposit: 0,
    retainedAmount: 300
  },
  wechat: {
    reserveCash: 0,
    hotelIncome: 2523,
    restIncome: 0,
    carRentIncome: 0,
    total: 2523,
    hotelDeposit: 20,
    restDeposit: 0,
    retainedAmount: 2503
  },
  digital: {
    reserveCash: 0,
    hotelIncome: 300,
    restIncome: 160,
    carRentIncome: 0,
    total: 460,
    hotelDeposit: 0,
    restDeposit: 0,
    retainedAmount: 460
  },
  other: {
    reserveCash: 0,
    hotelIncome: 0,
    restIncome: 0,
    carRentIncome: 0,
    total: 0,
    hotelDeposit: 0,
    restDeposit: 0,
    retainedAmount: 0
  }
})

// 计算各项合计
function calculateTotals() {
  // 现金行：备用金 + 客房收入 + 休息房收入 + 租车收入 = 合计
  paymentData.value.cash.total = (paymentData.value.cash.reserveCash || 0) +
                                 (paymentData.value.cash.hotelIncome || 0) +
                                 (paymentData.value.cash.restIncome || 0) +
                                 (paymentData.value.cash.carRentIncome || 0)

  // 其他支付方式：客房收入 + 休息房收入 + 租车收入 = 合计
  Object.keys(paymentData.value).forEach(paymentType => {
    if (paymentType !== 'cash') {
      const payment = paymentData.value[paymentType]
      payment.total = (payment.hotelIncome || 0) + (payment.restIncome || 0) + (payment.carRentIncome || 0)
    }
  })

  // 注意：留存款(retainedAmount)不在这里计算，由用户手动输入
  // 交接款会在模板中自动计算：合计 - 客房退押 - 休息退押 - 留存款
}

// 特殊统计
const totalRooms = ref(29)
const restRooms = ref(3)
const vipCards = ref(6)





// 加载数据
async function loadShiftData() {
  try {
    const response = await shiftHandoverApi.getStatistics({
      date: selectedDate.value
    })

    if (response) {
      // 根据支付方式分组统计数据
      updatePaymentData(response)
    }
  } catch (error) {
    console.error('加载数据失败:', error)
    $q.notify({
      type: 'negative',
      message: '加载数据失败'
    })
  }
}

// 更新支付数据
function updatePaymentData(data) {
  // 根据API返回的数据更新对应的支付方式统计
  if (data.paymentSummary) {
    Object.keys(data.paymentSummary).forEach(method => {
      const amount = data.paymentSummary[method] || 0

      if (method === '现金' && paymentData.value.cash) {
        paymentData.value.cash.hotelIncome = amount
      } else if (method === '微信' && paymentData.value.wechat) {
        paymentData.value.wechat.hotelIncome = amount
      } else if (method === '支付宝' && paymentData.value.digital) {
        paymentData.value.digital.hotelIncome = amount
      }
    })
  }

  // 更新统计数据
  if (data.totalRooms) totalRooms.value = data.totalRooms
  if (data.restRooms) restRooms.value = data.restRooms

  calculateTotals()
}

// 生成HTML快照
function generateHtmlSnapshot() {
  try {
    // 获取交接班表格容器
    const tableContainer = document.querySelector('.shift-table-container')
    if (!tableContainer) {
      console.warn('未找到交接班表格容器')
      return null
    }

    // 克隆容器以避免影响原始DOM
    const clonedContainer = tableContainer.cloneNode(true)

    // 移除不需要的交互元素（如输入框的交互功能）
    const inputs = clonedContainer.querySelectorAll('input')
    inputs.forEach(input => {
      const span = document.createElement('span')
      span.textContent = input.value || '0'
      span.className = 'static-value'
      input.parentNode.replaceChild(span, input)
    })

    // 移除任务相关的交互元素（包括add按钮和任务卡片）
    const taskCards = clonedContainer.querySelectorAll('.task-card, .add-task-card')
    taskCards.forEach(card => {
      if (card.parentNode) {
        card.parentNode.removeChild(card)
      }
    })

    // 移除今日待办事项整个区域
    const taskSections = clonedContainer.querySelectorAll('.task-section, [class*="task"]')
    taskSections.forEach(section => {
      if (section.parentNode) {
        section.parentNode.removeChild(section)
      }
    })





    // 添加统计信息
    const statsInfo = `
      <div class="stats-section" style="margin-top: 20px; padding: 15px; background: #f0f8ff; border-radius: 8px;">
        <h3 style="margin: 0 0 15px 0;">统计信息</h3>
        <div style="display: flex; justify-content: space-around; flex-wrap: wrap;">
          <div style="text-align: center; padding: 10px;">
            <div style="font-size: 24px; font-weight: bold; color: #2196f3;">${totalRooms.value}</div>
            <div>开房数</div>
          </div>
          <div style="text-align: center; padding: 10px;">
            <div style="font-size: 24px; font-weight: bold; color: #ff9800;">${restRooms.value}</div>
            <div>休息房数</div>
          </div>
          <div style="text-align: center; padding: 10px;">
            <div style="font-size: 24px; font-weight: bold; color: #4caf50;">${vipCards.value}</div>
            <div>大美卡</div>
          </div>
        </div>
      </div>
    `

    // 组合完整的HTML
    const fullHtml = `
      <div class="handover-snapshot" style="font-family: Arial, sans-serif; max-width: 1200px; margin: 0 auto;">
        ${clonedContainer.outerHTML}
        ${statsInfo}
        ${notes.value ? `
          <div class="notes-section" style="margin-top: 20px; padding: 15px; background: #fff3cd; border-radius: 8px;">
            <h3 style="margin: 0 0 10px 0;">备注</h3>
            <div>${notes.value}</div>
          </div>
        ` : ''}
      </div>
    `

    return fullHtml
  } catch (error) {
    console.error('生成HTML快照失败:', error)
    return null
  }
}

// 保存交接记录
async function saveHandover() {
  try {
    // 生成HTML快照
    const htmlSnapshot = generateHtmlSnapshot()

    const handoverData = {
      date: selectedDate.value,
      handoverPerson: handoverPerson.value,
      receivePerson: receivePerson.value,
      cashierName: cashierName.value,
      notes: notes.value,
      taskList: taskList.value,
      paymentData: paymentData.value,
      specialStats: {
        totalRooms: totalRooms.value,
        restRooms: restRooms.value,
        vipCards: vipCards.value
      },
      htmlSnapshot: htmlSnapshot // 添加HTML快照
    }

    await shiftHandoverApi.saveHandover(handoverData)

    $q.notify({
      type: 'positive',
      message: '交接记录保存成功'
    })
  } catch (error) {
    console.error('保存交接记录失败:', error)
    $q.notify({
      type: 'negative',
      message: '保存交接记录失败'
    })
  }
}

// 打印交接单
function printHandover() {
  const printStyles = `
    <style>
      @media print {
        body { margin: 0; font-family: Arial, sans-serif; font-size: 14px; }
        .print-header { text-align: center; margin-bottom: 20px; }
        .print-title { font-size: 20px; font-weight: bold; }
        .print-info { margin: 10px 0; }
        .print-table { width: 100%; border-collapse: collapse; margin: 10px 0; }
        .print-table th, .print-table td { border: 1px solid #000; padding: 8px; text-align: center; }
        .print-table th { background-color: #f0f0f0; }
        .notes-section { margin-top: 20px; }
        @page { margin: 15mm; }
      }
    </style>
  `

  const printContent = `
    ${printStyles}
    <div class="print-header">
      <div class="print-title">交接班记录</div>
      <div class="print-info">
        <span>日期: ${selectedDate.value}</span> &nbsp;&nbsp;
        <span>交班人: ${handoverPerson.value}</span> &nbsp;&nbsp;
        <span>接班人: ${receivePerson.value}</span>
      </div>
    </div>

    <table class="print-table">
      <thead>
        <tr>
          <th colspan="8">交接班</th>
        </tr>
        <tr>
          <th>各用金</th>
          <th>客房收入1</th>
          <th>休息房收入2</th>
          <th>租车收入3</th>
          <th>合计</th>
          <th>客房退押</th>
          <th>休息退押</th>
          <th>留存款</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>现金</td>
          <td>${paymentData.value.cash.reserveCash}</td>
          <td>${paymentData.value.cash.hotelIncome}</td>
          <td>${paymentData.value.cash.restIncome}</td>
          <td>${paymentData.value.cash.total}</td>
          <td>${paymentData.value.cash.hotelDeposit}</td>
          <td>${paymentData.value.cash.restDeposit}</td>
          <td>${paymentData.value.cash.retainedAmount}</td>
        </tr>
        <tr>
          <td>微信</td>
          <td>${paymentData.value.wechat.reserveCash}</td>
          <td>${paymentData.value.wechat.hotelIncome}</td>
          <td>${paymentData.value.wechat.restIncome}</td>
          <td>${paymentData.value.wechat.total}</td>
          <td>${paymentData.value.wechat.hotelDeposit}</td>
          <td>${paymentData.value.wechat.restDeposit}</td>
          <td>${paymentData.value.wechat.retainedAmount}</td>
        </tr>
        <tr>
          <td>数码付</td>
          <td>${paymentData.value.digital.reserveCash}</td>
          <td>${paymentData.value.digital.hotelIncome}</td>
          <td>${paymentData.value.digital.restIncome}</td>
          <td>${paymentData.value.digital.total}</td>
          <td>${paymentData.value.digital.hotelDeposit}</td>
          <td>${paymentData.value.digital.restDeposit}</td>
          <td>${paymentData.value.digital.retainedAmount}</td>
        </tr>
        <tr>
          <td>其他方式</td>
          <td>${paymentData.value.other.reserveCash}</td>
          <td>${paymentData.value.other.hotelIncome}</td>
          <td>${paymentData.value.other.restIncome}</td>
          <td>${paymentData.value.other.total}</td>
          <td>${paymentData.value.other.hotelDeposit}</td>
          <td>${paymentData.value.other.restDeposit}</td>
          <td>${paymentData.value.other.retainedAmount}</td>
        </tr>

      </tbody>
    </table>

    <div class="notes-section">
      <p><strong>开房数: ${totalRooms.value}</strong> &nbsp;&nbsp; <strong>休息房数: ${restRooms.value}</strong> &nbsp;&nbsp; <strong>大美卡: ${vipCards.value}</strong></p>
      <p><strong>收银员: ${cashierName.value}</strong></p>
      ${notes.value ? `<p><strong>备注:</strong> ${notes.value}</p>` : ''}
      ${taskList.value.length > 0 ? `
        <div style="margin-top: 15px;">
          <p><strong>今日待办事项:</strong></p>
          <ul style="margin: 5px 0; padding-left: 20px;">
            ${taskList.value.map(task => `
              <li style="margin: 3px 0; ${task.completed ? 'text-decoration: line-through; color: #999;' : ''}">
                ${task.completed ? '✓' : '○'} ${task.title} ${task.time ? `(${task.time})` : ''}
              </li>
            `).join('')}
          </ul>
        </div>
      ` : ''}
    </div>
  `

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
    const handoverData = {
      date: selectedDate.value,
      handoverPerson: handoverPerson.value,
      receivePerson: receivePerson.value,
      cashierName: cashierName.value,
      notes: notes.value,
      taskList: taskList.value,
      paymentData: paymentData.value,
      specialStats: {
        totalRooms: totalRooms.value,
        restRooms: restRooms.value,
        vipCards: vipCards.value
      }
    }

    const response = await shiftHandoverApi.exportNewHandover(handoverData)

    const url = window.URL.createObjectURL(new Blob([response]))
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `交接班记录_${selectedDate.value}.xlsx`)
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

// 任务管理方法
function addNewTask() {
  if (!newTaskTitle.value.trim()) return

  const newTask = {
    id: Date.now(),
    title: newTaskTitle.value.trim(),
    time: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
    completed: false
  }

  taskList.value.push(newTask)
  newTaskTitle.value = ''
}

function deleteTask(index) {
  taskList.value.splice(index, 1)
}

function editTask(index) {
  // 可以扩展为内联编辑功能
  const task = taskList.value[index]
  const newTitle = prompt('编辑任务:', task.title)
  if (newTitle && newTitle.trim()) {
    task.title = newTitle.trim()
  }
}

function updateTaskStatus(taskId, completed) {
  const task = taskList.value.find(t => t.id === taskId)
  if (task) {
    task.completed = completed
  }
}

// 历史记录相关方法
function openHistoryDialog() {
  if (historyDialogRef.value) {
    historyDialogRef.value.openDialog()
  }
}

function onHistoryDialogClose() {
  // 历史记录对话框关闭时的处理
  console.log('历史记录对话框已关闭')
}

// 监听支付数据变化
watch(paymentData, () => {
  calculateTotals()
}, { deep: true })



// 组件挂载时初始化
onMounted(async () => {
  await loadShiftData()
})
</script>

<style scoped>
.shift-handover {
  background-color: #f5f5f5;
  min-height: 100vh;
}

.shift-table-container {
  background: white;
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
}

.shift-table {
  width: 100%;
  border-collapse: collapse;
  border: 2px solid #333;
  margin-bottom: 0;
}

.shift-table th,
.shift-table td {
  border: 1px solid #333;
  padding: 8px;
  text-align: center !important;
  vertical-align: middle;
}

.shift-table td * {
  text-align: center !important;
}

.table-header {
  background-color: #f8f9fa;
  font-weight: bold;
  height: 40px;
}

.sub-header {
  background-color: #e9ecef;
  font-weight: bold;
  height: 45px;
  font-size: 13px;
  line-height: 1.2;
}

.sub-header th {
  vertical-align: middle;
  text-align: center;
  padding: 6px 4px;
}

.payment-method-header {
  background-color: #e3f2fd;
  width: 80px;
}

.income-header {
  background-color: #f3e5f5;
  width: 90px;
}

.total-header {
  background-color: #fff3e0;
  width: 80px;
}

.deposit-header {
  background-color: #e8f5e8;
  width: 80px;
}

.retained-header {
  background-color: #fce4ec;
  width: 80px;
}

.handover-header {
  background-color: #e0f2f1;
  width: 80px;
}

.payment-row {
  height: 45px;
}

.cash-row {
  background-color: #ffeaa7;
}

.wechat-row {
  background-color: #a4e8a4;
}

.digital-row {
  background-color: #81c7f0;
}

.other-row {
  background-color: #f0b7ba;
}

.payment-label {
  font-weight: bold;
  background-color: rgba(0, 0, 0, 0.05);
  width: 80px;
  text-align: center !important;
}

.reserve-cash-cell {
  background-color: white;
  position: relative;
  text-align: center !important;
  font-weight: bold;
}

.editable-cell {
  background-color: white;
  position: relative;
  text-align: center !important;
}

.auto-calculate {
  background-color: #f8f9fa;
  font-weight: bold;
  text-align: center !important;
}

.total-cell {
  background-color: #ffe6cc;
  font-weight: bold;
  color: #d63384;
  text-align: center !important;
}

.table-input {
  text-align: center !important;
  font-weight: bold;
  width: 100%;
}

.table-input :deep(.q-field__control) {
  text-align: center !important;
}

.table-input :deep(.q-field__native) {
  text-align: center !important;
}

.table-input :deep(input) {
  text-align: center !important;
}







/* 任务管理容器 */
.task-management-container {
  background: white;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
  border: 1px solid #e0e0e0;
}

.task-management-header {
  display: flex;
  align-items: center;
  margin-bottom: 16px;
  color: #2196f3;
  border-bottom: 2px solid #e3f2fd;
  padding-bottom: 12px;
}

.task-management-content {
  min-height: 100px;
}

.task-list-horizontal {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: flex-start;
}

.task-card {
  display: flex;
  align-items: center;
  background: #f8f9fa;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  padding: 12px;
  min-width: 200px;
  max-width: 300px;
  transition: all 0.3s ease;
  position: relative;
}

.task-card:hover {
  background: #e3f2fd;
  border-color: #2196f3;
  box-shadow: 0 2px 8px rgba(33, 150, 243, 0.2);
}

.task-card.task-completed {
  opacity: 0.7;
  background: #f0f0f0;
  border-color: #ccc;
}

.task-card.task-completed:hover {
  background: #e8e8e8;
}

.task-checkbox {
  margin-right: 10px;
  align-self: flex-start;
  margin-top: 2px;
}

.task-content {
  flex: 1;
  cursor: pointer;
  padding: 2px;
  border-radius: 4px;
  min-width: 0;
}

.task-title {
  font-size: 14px;
  line-height: 1.4;
  margin-bottom: 4px;
  font-weight: 500;
  word-wrap: break-word;
}

.task-title.completed {
  text-decoration: line-through;
  color: #999;
}

.task-time {
  font-size: 12px;
  color: #666;
  display: flex;
  align-items: center;
}

.task-delete {
  opacity: 0;
  transition: opacity 0.2s;
  color: #f44336;
  margin-left: 8px;
  align-self: flex-start;
}

.task-card:hover .task-delete {
  opacity: 1;
}

.add-task-card {
  display: flex;
  align-items: center;
  background: linear-gradient(135deg, #e3f2fd 0%, #f3e5f5 100%);
  border: 2px dashed #2196f3;
  border-radius: 8px;
  padding: 12px;
  min-width: 200px;
  max-width: 300px;
  transition: all 0.3s ease;
}

.add-task-card:hover {
  background: linear-gradient(135deg, #bbdefb 0%, #e1bee7 100%);
  border-color: #1976d2;
}

.add-task-input {
  font-size: 14px;
  width: 100%;
}



/* .summary-row {
  background-color: #ff9800;
  font-weight: bold;
  height: 50px;
  color: white;
} */



.special-stats-table {
  width: 100%;
  border-collapse: collapse;
  border: 2px solid #333;
  margin-top: 20px;
}

.special-stats-table td {
  border: 1px solid #333;
  padding: 8px;
  text-align: center;
  height: 35px;
}

.stats-label {
  background-color: #e3f2fd;
  font-weight: bold;
  width: 80px;
}

.stats-value {
  background-color: #f3e5f5;
  font-weight: bold;
  width: 60px;
}

.stats-number {
  background-color: #fff3e0;
  font-weight: bold;
  font-size: 16px;
  color: #f57c00;
  width: 80px;
}

.cashier-name {
  background-color: #e8f5e8;
  font-weight: bold;
  font-size: 18px;
  width: 100px;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .shift-table {
    font-size: 12px;
  }

  .shift-table th,
  .shift-table td {
    padding: 4px;
  }

  .notes-cell {
    width: 120px;
  }
}


</style>
