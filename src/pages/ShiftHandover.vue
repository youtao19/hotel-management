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
        </div>
      </div>

      <!-- 日期和班次信息 -->
      <div class="row q-col-gutter-md q-mb-md">
        <div class="col-md-3">
          <q-input v-model="selectedDate" type="date" label="交接日期" filled @update:model-value="loadShiftData" />
        </div>
        <div class="col-md-3">
          <q-select v-model="currentShift" :options="shiftOptions" label="当前班次" filled @update:model-value="loadShiftData" />
        </div>
        <div class="col-md-3">
          <q-input v-model="handoverPerson" label="交班人" filled />
        </div>
        <div class="col-md-3">
          <q-input v-model="receivePerson" label="接班人" filled />
        </div>
      </div>

      <!-- 主要交接班表格 -->
      <div class="shift-table-container">
        <table class="shift-table">
          <!-- 表头 -->
          <thead>
            <tr class="table-header">
              <th colspan="8" class="text-center text-h6 text-weight-bold">交接班</th>
              <th rowspan="2" class="notes-header">备忘录</th>
            </tr>
            <tr class="sub-header">
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

          <!-- 支付方式行 -->
          <tbody>
            <!-- 现金 -->
            <tr class="payment-row cash-row">
              <td class="payment-label">现金</td>
              <td>
                <q-input v-model.number="paymentData.cash.reserveCash" type="number" dense borderless class="table-input" @update:model-value="calculateTotals" />
              </td>
              <td class="auto-calculate">{{ paymentData.cash.hotelIncome.toFixed(0) }}</td>
              <td class="auto-calculate">{{ paymentData.cash.restIncome.toFixed(0) }}</td>
              <td class="total-cell">{{ paymentData.cash.total.toFixed(0) }}</td>
              <td>
                <q-input v-model.number="paymentData.cash.hotelDeposit" type="number" dense borderless class="table-input" @update:model-value="calculateTotals" />
              </td>
              <td>
                <q-input v-model.number="paymentData.cash.restDeposit" type="number" dense borderless class="table-input" @update:model-value="calculateTotals" />
              </td>
              <td>
                <q-input v-model.number="paymentData.cash.retainedAmount" type="number" dense borderless class="table-input" @update:model-value="calculateTotals" />
              </td>
              <td rowspan="4" class="notes-cell">
                <q-input v-model="notes" type="textarea" rows="8" placeholder="记录交接班相关信息..." borderless class="notes-input" />
              </td>
            </tr>

            <!-- 微信 -->
            <tr class="payment-row wechat-row">
              <td class="payment-label">微信</td>
              <td class="auto-calculate">{{ paymentData.wechat.reserveCash.toFixed(0) }}</td>
              <td class="auto-calculate">{{ paymentData.wechat.hotelIncome.toFixed(0) }}</td>
              <td class="auto-calculate">{{ paymentData.wechat.restIncome.toFixed(0) }}</td>
              <td class="total-cell">{{ paymentData.wechat.total.toFixed(0) }}</td>
              <td>
                <q-input v-model.number="paymentData.wechat.hotelDeposit" type="number" dense borderless class="table-input" @update:model-value="calculateTotals" />
              </td>
              <td>
                <q-input v-model.number="paymentData.wechat.restDeposit" type="number" dense borderless class="table-input" @update:model-value="calculateTotals" />
              </td>
              <td>
                <q-input v-model.number="paymentData.wechat.retainedAmount" type="number" dense borderless class="table-input" @update:model-value="calculateTotals" />
              </td>
            </tr>

            <!-- 数码付 -->
            <tr class="payment-row digital-row">
              <td class="payment-label">数码付</td>
              <td>
                <q-input v-model.number="paymentData.digital.reserveCash" type="number" dense borderless class="table-input" @update:model-value="calculateTotals" />
              </td>
              <td class="auto-calculate">{{ paymentData.digital.hotelIncome.toFixed(0) }}</td>
              <td class="auto-calculate">{{ paymentData.digital.restIncome.toFixed(0) }}</td>
              <td class="total-cell">{{ paymentData.digital.total.toFixed(0) }}</td>
              <td>
                <q-input v-model.number="paymentData.digital.hotelDeposit" type="number" dense borderless class="table-input" @update:model-value="calculateTotals" />
              </td>
              <td>
                <q-input v-model.number="paymentData.digital.restDeposit" type="number" dense borderless class="table-input" @update:model-value="calculateTotals" />
              </td>
              <td>
                <q-input v-model.number="paymentData.digital.retainedAmount" type="number" dense borderless class="table-input" @update:model-value="calculateTotals" />
              </td>
            </tr>

            <!-- 其他方式 -->
            <tr class="payment-row other-row">
              <td class="payment-label">其他方式</td>
              <td>
                <q-input v-model.number="paymentData.other.reserveCash" type="number" dense borderless class="table-input" @update:model-value="calculateTotals" />
              </td>
              <td class="auto-calculate">{{ paymentData.other.hotelIncome.toFixed(0) }}</td>
              <td class="auto-calculate">{{ paymentData.other.restIncome.toFixed(0) }}</td>
              <td class="total-cell">{{ paymentData.other.total.toFixed(0) }}</td>
              <td>
                <q-input v-model.number="paymentData.other.hotelDeposit" type="number" dense borderless class="table-input" @update:model-value="calculateTotals" />
              </td>
              <td>
                <q-input v-model.number="paymentData.other.restDeposit" type="number" dense borderless class="table-input" @update:model-value="calculateTotals" />
              </td>
              <td>
                <q-input v-model.number="paymentData.other.retainedAmount" type="number" dense borderless class="table-input" @update:model-value="calculateTotals" />
              </td>
            </tr>
          </tbody>
        </table>

        <!-- 汇总行 -->
        <table class="shift-table summary-table">
          <tbody>
            <tr class="summary-row">
              <td class="summary-label">合计</td>
              <td class="summary-total">{{ totalSummary.reserveCash.toFixed(0) }}</td>
              <td class="summary-total">{{ totalSummary.hotelIncome.toFixed(0) }}</td>
              <td class="summary-total">{{ totalSummary.restIncome.toFixed(0) }}</td>
              <td class="summary-grand-total">{{ totalSummary.grandTotal.toFixed(0) }}</td>
              <td class="summary-total">{{ totalSummary.hotelDeposit.toFixed(0) }}</td>
              <td class="summary-total">{{ totalSummary.restDeposit.toFixed(0) }}</td>
              <td class="summary-total">{{ totalSummary.retainedAmount.toFixed(0) }}</td>
              <td class="handover-amount">
                <div class="text-center">
                  <div class="text-caption">交接款</div>
                  <div class="text-h6 text-weight-bold text-green-8">{{ handoverAmount.toFixed(0) }}</div>
                </div>
              </td>
            </tr>
          </tbody>
        </table>

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
  </q-page>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { date } from 'quasar'
import { useQuasar } from 'quasar'
import { useRouter } from 'vue-router'
import api, { shiftHandoverApi } from '../api/index.js'

const $q = useQuasar()
const router = useRouter()

// 基础数据
const selectedDate = ref(date.formatDate(new Date(), 'YYYY-MM-DD'))
const currentShift = ref('白班')
const handoverPerson = ref('')
const receivePerson = ref('')
const cashierName = ref('张')
const notes = ref('')

// 班次选项
const shiftOptions = ['白班', '夜班']

// 支付方式数据结构
const paymentData = ref({
  cash: {
    reserveCash: 320,
    hotelIncome: 0,
    restIncome: 100,
    total: 420,
    hotelDeposit: 80,
    restDeposit: 0,
    retainedAmount: 320
  },
  wechat: {
    reserveCash: 0,
    hotelIncome: 2523,
    restIncome: 0,
    total: 2523,
    hotelDeposit: 20,
    restDeposit: 0,
    retainedAmount: 2503
  },
  digital: {
    reserveCash: 0,
    hotelIncome: 300,
    restIncome: 160,
    total: 460,
    hotelDeposit: 0,
    restDeposit: 0,
    retainedAmount: 460
  },
  other: {
    reserveCash: 0,
    hotelIncome: 0,
    restIncome: 0,
    total: 0,
    hotelDeposit: 0,
    restDeposit: 0,
    retainedAmount: 0
  }
})

// 特殊统计
const totalRooms = ref(29)
const restRooms = ref(3)
const vipCards = ref(6)

// 计算汇总数据
const totalSummary = computed(() => {
  const summary = {
    reserveCash: 0,
    hotelIncome: 0,
    restIncome: 0,
    grandTotal: 0,
    hotelDeposit: 0,
    restDeposit: 0,
    retainedAmount: 0
  }

  Object.values(paymentData.value).forEach(payment => {
    summary.reserveCash += payment.reserveCash || 0
    summary.hotelIncome += payment.hotelIncome || 0
    summary.restIncome += payment.restIncome || 0
    summary.grandTotal += payment.total || 0
    summary.hotelDeposit += payment.hotelDeposit || 0
    summary.restDeposit += payment.restDeposit || 0
    summary.retainedAmount += payment.retainedAmount || 0
  })

  return summary
})

// 交接款计算
const handoverAmount = computed(() => {
  return totalSummary.value.grandTotal - totalSummary.value.hotelDeposit -
         totalSummary.value.restDeposit - totalSummary.value.retainedAmount
})

// 计算各项合计
function calculateTotals() {
  Object.keys(paymentData.value).forEach(paymentType => {
    const payment = paymentData.value[paymentType]
    payment.total = (payment.reserveCash || 0) + (payment.hotelIncome || 0) + (payment.restIncome || 0)
  })
}

// 加载班次数据
async function loadShiftData() {
  try {
    const response = await shiftHandoverApi.getStatistics({
      date: selectedDate.value,
      shift: currentShift.value
    })

    if (response) {
      // 根据支付方式分组统计数据
      updatePaymentData(response)
    }
  } catch (error) {
    console.error('加载班次数据失败:', error)
    $q.notify({
      type: 'negative',
      message: '加载班次数据失败'
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

// 保存交接记录
async function saveHandover() {
  try {
    const handoverData = {
      date: selectedDate.value,
      shift: currentShift.value,
      handoverPerson: handoverPerson.value,
      receivePerson: receivePerson.value,
      cashierName: cashierName.value,
      notes: notes.value,
      paymentData: paymentData.value,
      totalSummary: totalSummary.value,
      handoverAmount: handoverAmount.value,
      specialStats: {
        totalRooms: totalRooms.value,
        restRooms: restRooms.value,
        vipCards: vipCards.value
      }
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
        <span>班次: ${currentShift.value}</span> &nbsp;&nbsp;
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
        <tr style="font-weight: bold; background-color: #f0f0f0;">
          <td>合计</td>
          <td>${totalSummary.value.reserveCash}</td>
          <td>${totalSummary.value.hotelIncome}</td>
          <td>${totalSummary.value.restIncome}</td>
          <td>${totalSummary.value.grandTotal}</td>
          <td>${totalSummary.value.hotelDeposit}</td>
          <td>${totalSummary.value.restDeposit}</td>
          <td>${totalSummary.value.retainedAmount}</td>
        </tr>
      </tbody>
    </table>

    <div class="notes-section">
      <p><strong>交接款: ¥${handoverAmount.value.toFixed(2)}</strong></p>
      <p><strong>开房数: ${totalRooms.value}</strong> &nbsp;&nbsp; <strong>休息房数: ${restRooms.value}</strong> &nbsp;&nbsp; <strong>大美卡: ${vipCards.value}</strong></p>
      <p><strong>收银员: ${cashierName.value}</strong></p>
      ${notes.value ? `<p><strong>备注:</strong> ${notes.value}</p>` : ''}
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
      shift: currentShift.value,
      handoverPerson: handoverPerson.value,
      receivePerson: receivePerson.value,
      cashierName: cashierName.value,
      notes: notes.value,
      paymentData: paymentData.value,
      totalSummary: totalSummary.value,
      handoverAmount: handoverAmount.value,
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
    link.setAttribute('download', `交接班记录_${selectedDate.value}_${currentShift.value}.xlsx`)
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
  text-align: center;
  vertical-align: middle;
}

.table-header {
  background-color: #f8f9fa;
  font-weight: bold;
  height: 40px;
}

.sub-header {
  background-color: #e9ecef;
  font-weight: bold;
  height: 35px;
  font-size: 14px;
}

.payment-row {
  height: 45px;
}

.cash-row {
  background-color: #fff3cd;
}

.wechat-row {
  background-color: #d4edda;
}

.digital-row {
  background-color: #cce7ff;
}

.other-row {
  background-color: #f8d7da;
}

.payment-label {
  font-weight: bold;
  background-color: rgba(0, 0, 0, 0.05);
  width: 100px;
}

.auto-calculate {
  background-color: #f8f9fa;
  font-weight: bold;
}

.total-cell {
  background-color: #ffe6cc;
  font-weight: bold;
  color: #d63384;
}

.table-input {
  text-align: center;
  font-weight: bold;
}

.notes-header {
  background-color: #e9ecef;
  font-weight: bold;
  writing-mode: vertical-rl;
  text-orientation: mixed;
  width: 150px;
}

.notes-cell {
  width: 150px;
  padding: 5px;
}

.notes-input {
  width: 100%;
  height: 100%;
  resize: none;
}

.summary-table {
  margin-top: 0;
  border-top: none;
}

.summary-row {
  background-color: #fff3e0;
  font-weight: bold;
  height: 50px;
}

.summary-label {
  background-color: #ff9800;
  color: white;
  font-weight: bold;
}

.summary-total {
  font-size: 16px;
  color: #1976d2;
}

.summary-grand-total {
  font-size: 18px;
  color: #d32f2f;
  font-weight: bold;
}

.handover-amount {
  background-color: #c8e6c9;
  border: 2px solid #4caf50;
}

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
