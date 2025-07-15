<template>
  <!-- 交接班详情对话框 -->
  <q-dialog v-model="showDialog" persistent>
    <q-card style="min-width: 900px; max-width: 1400px; width: 95vw; max-height: 90vh;">
      <q-card-section class="row items-center q-pb-none">
        <div class="text-h6">交接班记录详情</div>
        <q-space />
        <div class="row q-gutter-sm">
          <q-btn
            color="primary"
            icon="print"
            label="打印"
            size="sm"
            @click="printDetail"
          />
          <q-btn
            color="green"
            icon="download"
            label="导出"
            size="sm"
            @click="exportDetail"
          />
          <q-btn
            icon="close"
            flat
            round
            dense
            @click="closeDialog"
          />
        </div>
      </q-card-section>

      <q-card-section class="q-pt-sm detail-content">
        <!-- 基本信息 -->
        <div v-if="recordData" class="basic-info q-mb-md">
          <div class="row q-col-gutter-md">
            <div class="col-md-2">
              <q-input
                label="交接日期"
                :model-value="formatDate(recordData.shift_date)"
                readonly
                dense
                outlined
              />
            </div>
            <div class="col-md-2">
              <q-input
                label="班次时间"
                :model-value="recordData.shift_time || '-'"
                readonly
                dense
                outlined
              />
            </div>
            <div class="col-md-2">
              <q-input
                label="收银员"
                :model-value="recordData.cashier_name"
                readonly
                dense
                outlined
              />
            </div>
            <div class="col-md-3">
              <q-input
                label="交班人"
                :model-value="recordData.handover_person || '-'"
                readonly
                dense
                outlined
              />
            </div>
            <div class="col-md-3">
              <q-input
                label="接班人"
                :model-value="recordData.receive_person || '-'"
                readonly
                dense
                outlined
              />
            </div>
          </div>
        </div>

        <!-- HTML快照显示 -->
        <div v-if="recordData && recordData.html_snapshot" class="html-snapshot">
          <div class="text-h6 q-mb-md text-primary">
            <q-icon name="table_view" class="q-mr-sm" />
            交接班记录快照
          </div>
          <div class="snapshot-container" v-html="sanitizedHtml"></div>
        </div>

        <!-- 备用：结构化数据显示（仅在没有HTML快照时显示） -->
        <div v-else-if="recordData && (recordData.details || recordData.paymentData)" class="structured-data">
          <div class="text-h6 q-mb-md text-orange">
            <q-icon name="warning" class="q-mr-sm" />
            备用数据显示（HTML快照不可用）
          </div>

          <!-- 支付数据表格 -->
          <div v-if="recordData.paymentData || (recordData.details && recordData.details.paymentData)" class="payment-data q-mb-lg">
            <table class="detail-table">
              <thead>
                <tr class="table-header">
                  <th colspan="10" class="text-center text-h6 text-weight-bold">交接班</th>
                </tr>
                <tr class="sub-header">
                  <th>支付方式</th>
                  <th>备用金</th>
                  <th>客房收入1</th>
                  <th>休息房收入2</th>
                  <th>租车收入3</th>
                  <th>合计</th>
                  <th>客房退押</th>
                  <th>休息退押</th>
                  <th>留存款</th>
                  <th>交接款</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(payment, key) in recordData.details.paymentData" :key="key" :class="`${key}-row`">
                  <td class="payment-label">{{ getPaymentMethodName(key) }}</td>
                  <td>{{ payment.reserveCash || 0 }}</td>
                  <td>{{ payment.hotelIncome || 0 }}</td>
                  <td>{{ payment.restIncome || 0 }}</td>
                  <td>{{ payment.carRentIncome || 0 }}</td>
                  <td class="total-cell">{{ payment.total || 0 }}</td>
                  <td>{{ payment.hotelDeposit || 0 }}</td>
                  <td>{{ payment.restDeposit || 0 }}</td>
                  <td>{{ payment.retainedAmount || 0 }}</td>
                  <td class="handover-amount">{{ calculateHandoverAmount(payment) }}</td>
                </tr>
              </tbody>
            </table>
          </div>



          <!-- 特殊统计 -->
          <div v-if="recordData.details.specialStats" class="special-stats">
            <div class="text-h6 q-mb-md">统计信息</div>
            <div class="row q-col-gutter-md">
              <div class="col-md-2">
                <q-card flat bordered class="text-center q-pa-md">
                  <div class="text-h4 text-primary">{{ recordData.details.specialStats.totalRooms || 0 }}</div>
                  <div class="text-subtitle2">开房数</div>
                </q-card>
              </div>
              <div class="col-md-2">
                <q-card flat bordered class="text-center q-pa-md">
                  <div class="text-h4 text-orange">{{ recordData.details.specialStats.restRooms || 0 }}</div>
                  <div class="text-subtitle2">休息房数</div>
                </q-card>
              </div>
              <div class="col-md-2">
                <q-card flat bordered class="text-center q-pa-md">
                  <div class="text-h4 text-green">{{ recordData.details.specialStats.vipCards || 0 }}</div>
                  <div class="text-subtitle2">大美卡</div>
                </q-card>
              </div>
            </div>
          </div>
        </div>

        <!-- 备注信息 -->
        <div v-if="recordData && recordData.remarks" class="remarks-section q-mt-lg">
          <div class="text-h6 q-mb-md">备注</div>
          <q-card flat bordered class="q-pa-md">
            <div class="remarks-content">{{ recordData.remarks }}</div>
          </q-card>
        </div>

        <!-- 无数据提示 -->
        <div v-if="!recordData" class="no-data text-center q-pa-xl">
          <q-icon name="info" size="3rem" color="grey-5" />
          <div class="text-h6 text-grey-7 q-mt-md">暂无数据</div>
        </div>
      </q-card-section>

      <q-card-actions align="right" class="q-pa-md">
        <q-btn flat label="关闭" color="primary" @click="closeDialog" />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup>
import { ref, computed, defineEmits, defineExpose } from 'vue'
import DOMPurify from 'dompurify'

// 定义事件
const emit = defineEmits(['close', 'export'])

// 响应式数据
const showDialog = ref(false)
const recordData = ref(null)

// 计算属性：安全的HTML内容
const sanitizedHtml = computed(() => {
  if (!recordData.value?.html_snapshot) return ''

  // 使用DOMPurify清理HTML内容，防止XSS攻击
  return DOMPurify.sanitize(recordData.value.html_snapshot, {
    ALLOWED_TAGS: ['div', 'span', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'br', 'strong', 'em', 'ul', 'ol', 'li'],
    ALLOWED_ATTR: ['class', 'style', 'id']
  })
})

// 方法
function openDialog(record) {
  recordData.value = record
  showDialog.value = true
}

function closeDialog() {
  showDialog.value = false
  recordData.value = null
  emit('close')
}

function formatDate(dateStr) {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleDateString('zh-CN')
}

function getPaymentMethodName(key) {
  const names = {
    cash: '现金',
    wechat: '微信',
    digital: '支付宝',
    other: '其他方式'
  }
  return names[key] || key
}

function calculateHandoverAmount(payment) {
  const total = payment.total || 0
  const hotelDeposit = payment.hotelDeposit || 0
  const restDeposit = payment.restDeposit || 0
  const retainedAmount = payment.retainedAmount || 0
  return total - hotelDeposit - restDeposit - retainedAmount
}

function printDetail() {
  if (recordData.value?.html_snapshot) {
    // 如果有HTML快照，直接打印HTML内容
    const printWindow = window.open('', '_blank')
    const printContent = `
      <html>
        <head>
          <title>交接班记录详情</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            @media print { body { margin: 0; } }
          </style>
        </head>
        <body>
          ${sanitizedHtml.value}
        </body>
      </html>
    `
    printWindow.document.write(printContent)
    printWindow.document.close()
    printWindow.focus()
    printWindow.print()
    printWindow.close()
  } else {
    // 打印当前对话框内容
    window.print()
  }
}

function exportDetail() {
  emit('export', recordData.value)
}

// 暴露方法给父组件
defineExpose({
  openDialog
})
</script>

<style scoped>
.basic-info {
  background: #f8f9fa;
  padding: 16px;
  border-radius: 8px;
  border: 1px solid #e9ecef;
}

.snapshot-container {
  background: white;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.detail-table {
  width: 100%;
  border-collapse: collapse;
  border: 2px solid #333;
  margin-bottom: 20px;
}

.detail-table th,
.detail-table td {
  border: 1px solid #333;
  padding: 8px;
  text-align: center;
}

.table-header {
  background-color: #f8f9fa;
  font-weight: bold;
}

.sub-header {
  background-color: #e9ecef;
  font-weight: bold;
  font-size: 13px;
}

.cash-row { background-color: #ffeaa7; }
.wechat-row { background-color: #a4e8a4; }
.digital-row { background-color: #81c7f0; }
.other-row { background-color: #f0b7ba; }

.payment-label {
  font-weight: bold;
  background-color: rgba(0, 0, 0, 0.05);
}

.total-cell {
  background-color: #ffe6cc;
  font-weight: bold;
  color: #d63384;
}

.handover-amount {
  background-color: #e0f2f1;
  font-weight: bold;
  color: #2e7d32;
}

.task-items {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.task-item {
  display: flex;
  align-items: center;
  padding: 8px 12px;
  background: #f8f9fa;
  border-radius: 6px;
  border: 1px solid #e9ecef;
}

.task-item.completed {
  opacity: 0.7;
  background: #e8f5e8;
}

.task-item.completed .task-title {
  text-decoration: line-through;
  color: #666;
}

.task-time {
  font-size: 12px;
}

.remarks-content {
  line-height: 1.6;
  color: #333;
}

.no-data {
  color: #666;
}

/* 确保HTML快照中的样式正确显示 */
.snapshot-container :deep(.shift-table) {
  width: 100%;
  border-collapse: collapse;
  border: 2px solid #333;
  margin: 20px 0;
}

.snapshot-container :deep(.shift-table th),
.snapshot-container :deep(.shift-table td) {
  border: 1px solid #333;
  padding: 8px;
  text-align: center;
}

.snapshot-container :deep(.handover-header) {
  text-align: center;
  margin-bottom: 20px;
  padding: 20px;
  background: #f8f9fa;
  border-radius: 8px;
}

.snapshot-container :deep(.task-section) {
  margin-top: 20px;
  padding: 15px;
  background: #f9f9f9;
  border-radius: 8px;
}

.snapshot-container :deep(.stats-section) {
  margin-top: 20px;
  padding: 15px;
  background: #f0f8ff;
  border-radius: 8px;
}

.snapshot-container :deep(.notes-section) {
  margin-top: 20px;
  padding: 15px;
  background: #fff3cd;
  border-radius: 8px;
}

.snapshot-container :deep(.static-value) {
  font-weight: bold;
  color: #333;
}

/* 解决双滚动条问题 */
.detail-content {
  max-height: calc(90vh - 120px);
  overflow-y: auto;
  overflow-x: hidden;
}

/* 确保HTML快照容器不产生额外滚动条 */
.html-snapshot {
  overflow: visible;
}

.snapshot-container {
  overflow: visible;
  max-width: 100%;
}

/* 优化滚动条样式 */
.detail-content::-webkit-scrollbar {
  width: 8px;
}

.detail-content::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 4px;
}

.detail-content::-webkit-scrollbar-thumb {
  background: #c1c1c1;
  border-radius: 4px;
}

.detail-content::-webkit-scrollbar-thumb:hover {
  background: #a8a8a8;
}
</style>
