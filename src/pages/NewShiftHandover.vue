<template>
  <q-page class="shift-handover">
    <div class="q-pa-md">
      <!-- 标题和操作区域 -->
      <div class="row items-center justify-between q-mb-md">
        <div class="text-h4 text-weight-bold">新版交接班</div>
        <div class="row q-gutter-md">
          <q-btn color="primary" icon="print" label="打印" @click="printHandover" />
          <q-btn color="green" icon="download" label="导出Excel" @click="exportToExcel" />
          <q-btn color="purple" icon="edit" label="保存金额修改" @click="saveAmountChanges" :loading="savingAmounts" />
          <q-btn color="orange" icon="save" label="保存交接记录" @click="saveHandover" />
          <q-btn color="blue" icon="history" label="历史记录" @click="openHistoryDialog" />
        </div>
      </div>

      <!-- 日期和人员信息 -->
      <div class="row q-col-gutter-md q-mb-md">
        <div class="col-md-4">
          <q-input v-model="selectedDate" type="date" label="交接日期" filled @update:model-value="loadHandoverData" />
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
            <tr v-for="(payment, key) in paymentData" :key="key" :class="`payment-row ${key}-row`">
              <td class="payment-label">{{ getPaymentMethodLabel(key) }}</td>
              <td class="editable-cell">
                <q-input v-model.number="payment.reserveCash" type="number" dense borderless class="table-input" @update:model-value="calculateTotals" />
              </td>
              <td class="editable-cell">
                <q-input v-model.number="payment.hotelIncome" type="number" dense borderless class="table-input" @update:model-value="calculateTotals" />
              </td>
              <td class="editable-cell">
                <q-input v-model.number="payment.restIncome" type="number" dense borderless class="table-input" @update:model-value="calculateTotals" />
              </td>
              <td class="editable-cell">
                <q-input v-model.number="payment.carRentIncome" type="number" dense borderless class="table-input" @update:model-value="calculateTotals" />
              </td>
              <td class="total-cell">{{ payment.total.toFixed(0) }}</td>
              <td class="editable-cell">
                <q-input v-model.number="payment.hotelDeposit" type="number" dense borderless class="table-input" @update:model-value="calculateTotals" />
              </td>
              <td class="editable-cell">
                <q-input v-model.number="payment.restDeposit" type="number" dense borderless class="table-input" @update:model-value="calculateTotals" />
              </td>
              <td class="editable-cell">
                <q-input v-model.number="payment.retainedAmount" type="number" dense borderless class="table-input" @update:model-value="calculateTotals" />
              </td>
              <td class="auto-calculate">{{ calculateHandoverAmount(payment).toFixed(0) }}</td>
            </tr>
          </tbody>
        </table>

        <!-- 备忘录 -->
        <div class="row q-mt-lg">
          <div class="col-12">
            <div class="task-management-container">
              <div class="task-management-header">
                <q-icon name="edit_note" size="24px" class="q-mr-sm" />
                <span class="text-h6 text-weight-bold">备忘录</span>
              </div>
              <div class="task-management-content">
                <div class="task-list-horizontal">
                  <div v-for="(task, index) in taskList" :key="task.id" class="task-card" :class="{ 'task-completed': task.completed }">
                    <q-checkbox v-model="task.completed" class="task-checkbox" @update:model-value="updateTaskStatus(task.id, $event)" />
                    <div class="task-content" @click="editTask(index)">
                      <div class="task-title" :class="{ 'completed': task.completed }">{{ task.title }}</div>
                      <div v-if="task.time" class="task-time">
                        <q-icon name="schedule" size="14px" class="q-mr-xs" />
                        {{ task.time }}
                      </div>
                    </div>
                    <q-btn flat round dense size="sm" icon="close" class="task-delete" @click="deleteTask(index)" />
                  </div>
                  <div class="add-task-card">
                    <q-input v-model="newTaskTitle" placeholder="添加新备忘录..." dense borderless class="add-task-input" @keyup.enter="addNewTask">
                      <template #prepend>
                        <q-icon name="add" />
                      </template>
                      <template #append>
                        <q-btn flat round dense size="sm" icon="add" color="primary" :disable="!newTaskTitle.trim()" @click="addNewTask" />
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
                  <td class="stats-number">
                    <q-input v-model.number="specialStats.totalRooms" type="number" dense borderless class="text-center" />
                  </td>
                  <td class="stats-label">收银员</td>
                  <td rowspan="2" class="cashier-name">
                    <q-input v-model="cashierName" dense borderless class="text-center" placeholder="张" />
                  </td>
                </tr>
                <tr>
                  <td class="stats-label">大美卡</td>
                  <td class="stats-number">
                    <q-input v-model.number="specialStats.vipCards" type="number" dense borderless class="text-center" />
                  </td>
                  <td class="stats-label">休息房</td>
                  <td class="stats-number">
                    <q-input v-model.number="specialStats.restRooms" type="number" dense borderless class="text-center" />
                  </td>
                  <td class="stats-label">备注</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>

    <!-- 历史记录组件 -->
    <ShiftHandoverHistory ref="historyDialogRef" />
  </q-page>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue'
import { date, useQuasar } from 'quasar'
import { shiftHandoverApi } from '../api/index.js'
import ShiftHandoverHistory from '../components/ShiftHandoverHistory.vue'

const $q = useQuasar()

// --- 状态定义 ---

const selectedDate = ref(date.formatDate(new Date(), 'YYYY-MM-DD'))
const handoverPerson = ref('')
const receivePerson = ref('')
const cashierName = ref('张')
const savingAmounts = ref(false)

// 备忘录
const newTaskTitle = ref('')
const taskList = ref([])

// 特殊统计
const specialStats = ref({
  totalRooms: 0,
  restRooms: 0,
  vipCards: 0
})

// 历史记录
const historyDialogRef = ref(null)

// --- 数据结构 ---

// 支付方式数据
const getInitialPaymentData = () => ({
  cash: { reserveCash: 320, hotelIncome: 0, restIncome: 0, carRentIncome: 0, total: 320, hotelDeposit: 0, restDeposit: 0, retainedAmount: 320 },
  wechat: { reserveCash: 0, hotelIncome: 0, restIncome: 0, carRentIncome: 0, total: 0, hotelDeposit: 0, restDeposit: 0, retainedAmount: 0 },
  digital: { reserveCash: 0, hotelIncome: 0, restIncome: 0, carRentIncome: 0, total: 0, hotelDeposit: 0, restDeposit: 0, retainedAmount: 0 },
  other: { reserveCash: 0, hotelIncome: 0, restIncome: 0, carRentIncome: 0, total: 0, hotelDeposit: 0, restDeposit: 0, retainedAmount: 0 }
})

const paymentData = ref(getInitialPaymentData())

// --- 计算逻辑 ---

function calculateTotals() {
  for (const key in paymentData.value) {
    const payment = paymentData.value[key]
    payment.total = (payment.reserveCash || 0) + (payment.hotelIncome || 0) + (payment.restIncome || 0) + (payment.carRentIncome || 0)
  }
}

const calculateHandoverAmount = (payment) => {
  return (payment.total || 0) - (payment.hotelDeposit || 0) - (payment.restDeposit || 0) - (payment.retainedAmount || 0)
}

// --- 数据加载与保存 ---

async function loadHandoverData() {
  try {
    // 1. 重置为初始状态
    paymentData.value = getInitialPaymentData()
    handoverPerson.value = ''
    receivePerson.value = ''
    cashierName.value = '张'
    taskList.value = []
    specialStats.value = { totalRooms: 0, restRooms: 0, vipCards: 0 }

    // 2. 尝试加载当天已保存的数据
    const savedData = await shiftHandoverApi.getLatestHandoverData({ date: selectedDate.value })

    if (savedData) {
      console.log('加载到已保存的数据:', savedData)
      const dataToRestore = savedData.details || savedData

      if (dataToRestore.paymentData) {
        // 使用 Object.assign 保持响应式
        Object.keys(paymentData.value).forEach(key => {
          if (dataToRestore.paymentData[key]) {
            Object.assign(paymentData.value[key], dataToRestore.paymentData[key])
          }
        })
      }

      handoverPerson.value = dataToRestore.handoverPerson || ''
      receivePerson.value = dataToRestore.receivePerson || ''
      cashierName.value = dataToRestore.cashierName || '张'
      taskList.value = dataToRestore.taskList || []

      if (dataToRestore.specialStats) {
        specialStats.value = dataToRestore.specialStats
      }

      calculateTotals()

      $q.notify({
        type: 'info',
        message: '已加载当天保存的记录',
        position: 'top'
      })
    } else {
      console.log('未找到当天的记录，使用初始数据')
    }
  } catch (error) {
    console.error('加载交接班数据失败:', error)
    $q.notify({ type: 'negative', message: '加载数据失败' })
  }
}

async function saveAmountChanges() {
  savingAmounts.value = true
  try {
    const handoverData = {
      date: selectedDate.value,
      handoverPerson: handoverPerson.value,
      receivePerson: receivePerson.value,
      cashierName: cashierName.value,
      paymentData: paymentData.value,
      taskList: taskList.value,
      specialStats: specialStats.value
    }
    await shiftHandoverApi.saveAmountChanges(handoverData)
    $q.notify({ type: 'positive', message: '金额修改已保存' })
  } catch (error) {
    console.error('保存金额修改失败:', error)
    $q.notify({ type: 'negative', message: '保存失败' })
  } finally {
    savingAmounts.value = false
  }
}

async function saveHandover() {
  try {
    const htmlSnapshot = generateHtmlSnapshot()
    const handoverData = {
      date: selectedDate.value,
      handoverPerson: handoverPerson.value,
      receivePerson: receivePerson.value,
      cashierName: cashierName.value,
      paymentData: paymentData.value,
      taskList: taskList.value,
      specialStats: specialStats.value,
      htmlSnapshot: htmlSnapshot
    }
    await shiftHandoverApi.saveHandover(handoverData)
    $q.notify({ type: 'positive', message: '交接记录保存成功' })
  } catch (error) {
    console.error('保存交接记录失败:', error)
    $q.notify({ type: 'negative', message: '保存失败' })
  }
}

// --- 界面操作 ---

function getPaymentMethodLabel(key) {
  const labels = {
    cash: '现金',
    wechat: '微信',
    digital: '微邮付',
    other: '其他方式'
  }
  return labels[key] || key
}

function openHistoryDialog() {
  historyDialogRef.value?.openDialog()
}

// ... (打印, 导出Excel, 备忘录管理等函数保持不变)
// 这些功能较为独立，直接复用

// --- 生命周期与监听 ---

onMounted(() => {
  loadHandoverData()
})

watch(paymentData, calculateTotals, { deep: true })


// --- 辅助函数 (打印/导出/备忘录) ---

function generateHtmlSnapshot() {
  // 实现与原组件类似的HTML快照生成逻辑
  return '<div>HTML Snapshot Placeholder</div>'
}

function printHandover() {
  // 实现与原组件类似的打印逻辑
  window.print()
}

async function exportToExcel() {
  try {
    const handoverData = {
      date: selectedDate.value,
      handoverPerson: handoverPerson.value,
      receivePerson: receivePerson.value,
      cashierName: cashierName.value,
      taskList: taskList.value,
      paymentData: paymentData.value,
      specialStats: specialStats.value
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
    $q.notify({ type: 'positive', message: 'Excel文件已下载' })
  } catch (error) {
    console.error('导出Excel失败:', error)
    $q.notify({ type: 'negative', message: '导出Excel失败' })
  }
}

function addNewTask() {
  if (!newTaskTitle.value.trim()) return
  taskList.value.push({
    id: Date.now(),
    title: newTaskTitle.value.trim(),
    time: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
    completed: false
  })
  newTaskTitle.value = ''
}

function deleteTask(index) {
  taskList.value.splice(index, 1)
}

function editTask(index) {
  const task = taskList.value[index]
  const newTitle = prompt('编辑备忘录:', task.title)
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

</script>

<style scoped>
/* 样式与 ShiftHandover.vue 保持一致 */
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
}
.sub-header {
  background-color: #e9ecef;
  font-weight: bold;
  font-size: 13px;
  line-height: 1.2;
}
.payment-method-header { background-color: #e3f2fd; width: 80px; }
.income-header { background-color: #f3e5f5; width: 90px; }
.total-header { background-color: #fff3e0; width: 80px; }
.deposit-header { background-color: #e8f5e8; width: 80px; }
.retained-header { background-color: #fce4ec; width: 80px; }
.handover-header { background-color: #e0f2f1; width: 80px; }

.payment-row.cash-row { background-color: #ffeaa7; }
.payment-row.wechat-row { background-color: #a4e8a4; }
.payment-row.digital-row { background-color: #81c7f0; }
.payment-row.other-row { background-color: #f0b7ba; }

.payment-label {
  font-weight: bold;
  background-color: rgba(0, 0, 0, 0.05);
}
.editable-cell {
  background-color: white;
}
.auto-calculate, .total-cell {
  background-color: #f8f9fa;
  font-weight: bold;
}
.total-cell {
  color: #d63384;
}
.table-input :deep(.q-field__native) {
  text-align: center;
  font-weight: 500;
}

/* Task Management Styles */
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
  justify-content: center;
  margin-bottom: 16px;
  color: #2c3e50;
  background-color: #e8f5e8;
  border-bottom: 2px solid #a5d6a7;
  padding: 12px;
  border-radius: 8px 8px 0 0;
}
.task-list-horizontal {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}
.task-card {
  display: flex;
  align-items: center;
  background: #f1f8e9;
  border: 1px solid #81c784;
  border-radius: 8px;
  padding: 12px;
  min-width: 200px;
  position: relative;
}
.task-card.task-completed {
  opacity: 0.7;
  background: #f5f5f5;
}
.task-checkbox { margin-right: 10px; }
.task-content { flex: 1; cursor: pointer; }
.task-title.completed { text-decoration: line-through; color: #999; }
.task-time { font-size: 12px; color: #666; }
.task-delete { opacity: 0; transition: opacity 0.2s; color: #f44336; }
.task-card:hover .task-delete { opacity: 1; }
.add-task-card {
  display: flex;
  align-items: center;
  background: #f3f9f3;
  border: 2px dashed #a5d6a7;
  border-radius: 8px;
  padding: 12px;
  min-width: 200px;
}

/* Special Stats Table */
.special-stats-table {
  width: 100%;
  border-collapse: collapse;
  border: 2px solid #333;
}
.special-stats-table td {
  border: 1px solid #333;
  padding: 8px;
  text-align: center;
}
.stats-label { background-color: #e3f2fd; font-weight: bold; }
.stats-value { background-color: #f3e5f5; font-weight: bold; }
.stats-number { background-color: #fff3e0; font-weight: bold; }
.cashier-name { background-color: #e8f5e8; font-weight: bold; }
.text-center input { text-align: center !important; }
</style>
