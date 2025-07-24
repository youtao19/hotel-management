<template>
  <div class="shift-table-container">
    <table class="shift-table">
      <!-- 表头 -->
      <thead>
        <tr class="table-header">
          <th colspan="10" class="text-center text-h6 text-weight-bold">交接班</th>
        </tr>
        <tr class="sub-header">
          <th class="payment-method-header">支付方式</th>
          <th class="payment-method-header">备用金<br/><small>(来自昨日)</small></th>
          <th class="income-header">客房<br/>收入1<br/><small>(房费+押金)</small></th>
          <th class="income-header">休息房<br/>收入2<br/><small>(房费+押金)</small></th>
          <th class="income-header">租车<br/>收入3</th>
          <th class="total-header">合计</th>
          <th class="deposit-header">客房<br/>退押<br/><small>(实退金额)</small></th>
          <th class="deposit-header">休息退押<br/><small>(实退金额)</small></th>
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
            <q-input
              :model-value="paymentData.cash.reserveCash"
              @update:model-value="(val) => updatePaymentField('cash', 'reserveCash', val)"
              type="number"
              dense
              borderless
              class="table-input"
            />
          </td>
          <td class="editable-cell">
            <q-input
              :model-value="paymentData.cash.hotelIncome"
              @update:model-value="(val) => updatePaymentField('cash', 'hotelIncome', val)"
              type="number"
              dense
              borderless
              class="table-input"
            />
          </td>
          <td class="editable-cell">
            <q-input
              :model-value="paymentData.cash.restIncome"
              @update:model-value="(val) => updatePaymentField('cash', 'restIncome', val)"
              type="number"
              dense
              borderless
              class="table-input"
            />
          </td>
          <td class="editable-cell">
            <q-input
              :model-value="paymentData.cash.carRentIncome"
              @update:model-value="(val) => updatePaymentField('cash', 'carRentIncome', val)"
              type="number"
              dense
              borderless
              class="table-input"
            />
          </td>
          <td class="total-cell">{{ paymentData.cash.total.toFixed(0) }}</td>
          <td class="editable-cell">
            <q-input
              :model-value="paymentData.cash.hotelDeposit"
              @update:model-value="(val) => updatePaymentField('cash', 'hotelDeposit', val)"
              type="number"
              dense
              borderless
              class="table-input"
            />
          </td>
          <td class="editable-cell">
            <q-input
              :model-value="paymentData.cash.restDeposit"
              @update:model-value="(val) => updatePaymentField('cash', 'restDeposit', val)"
              type="number"
              dense
              borderless
              class="table-input"
            />
          </td>
          <td class="editable-cell">
            <q-input
              :model-value="paymentData.cash.retainedAmount"
              @update:model-value="(val) => updatePaymentField('cash', 'retainedAmount', val)"
              type="number"
              dense
              borderless
              class="table-input"
            />
          </td>
          <td class="auto-calculate">{{ (paymentData.cash.total - paymentData.cash.hotelDeposit - paymentData.cash.restDeposit - paymentData.cash.retainedAmount).toFixed(0) }}</td>
        </tr>
        <!-- 微信 -->
        <tr class="payment-row wechat-row">
          <td class="payment-label">微信</td>
          <td class="editable-cell">
            <q-input
              :model-value="paymentData.wechat.reserveCash"
              @update:model-value="(val) => updatePaymentField('wechat', 'reserveCash', val)"
              type="number"
              dense
              borderless
              class="table-input"
            />
          </td>
          <td class="editable-cell">
            <q-input
              :model-value="paymentData.wechat.hotelIncome"
              @update:model-value="(val) => updatePaymentField('wechat', 'hotelIncome', val)"
              type="number"
              dense
              borderless
              class="table-input"
            />
          </td>
          <td class="editable-cell">
            <q-input
              :model-value="paymentData.wechat.restIncome"
              @update:model-value="(val) => updatePaymentField('wechat', 'restIncome', val)"
              type="number"
              dense
              borderless
              class="table-input"
            />
          </td>
          <td class="editable-cell">
            <q-input
              :model-value="paymentData.wechat.carRentIncome"
              @update:model-value="(val) => updatePaymentField('wechat', 'carRentIncome', val)"
              type="number"
              dense
              borderless
              class="table-input"
            />
          </td>
          <td class="total-cell">{{ paymentData.wechat.total.toFixed(0) }}</td>
          <td class="editable-cell">
            <q-input
              :model-value="paymentData.wechat.hotelDeposit"
              @update:model-value="(val) => updatePaymentField('wechat', 'hotelDeposit', val)"
              type="number"
              dense
              borderless
              class="table-input"
            />
          </td>
          <td class="editable-cell">
            <q-input
              :model-value="paymentData.wechat.restDeposit"
              @update:model-value="(val) => updatePaymentField('wechat', 'restDeposit', val)"
              type="number"
              dense
              borderless
              class="table-input"
            />
          </td>
          <td class="editable-cell">
            <q-input
              :model-value="paymentData.wechat.retainedAmount"
              @update:model-value="(val) => updatePaymentField('wechat', 'retainedAmount', val)"
              type="number"
              dense
              borderless
              class="table-input"
            />
          </td>
          <td class="auto-calculate">{{ (paymentData.wechat.total - paymentData.wechat.hotelDeposit - paymentData.wechat.restDeposit - paymentData.wechat.retainedAmount).toFixed(0) }}</td>
        </tr>
        <!-- 微邮付 -->
        <tr class="payment-row digital-row">
          <td class="payment-label">微邮付</td>
          <td class="editable-cell">
            <q-input
              :model-value="paymentData.digital.reserveCash"
              @update:model-value="(val) => updatePaymentField('digital', 'reserveCash', val)"
              type="number"
              dense
              borderless
              class="table-input"
            />
          </td>
          <td class="editable-cell">
            <q-input
              :model-value="paymentData.digital.hotelIncome"
              @update:model-value="(val) => updatePaymentField('digital', 'hotelIncome', val)"
              type="number"
              dense
              borderless
              class="table-input"
            />
          </td>
          <td class="editable-cell">
            <q-input
              :model-value="paymentData.digital.restIncome"
              @update:model-value="(val) => updatePaymentField('digital', 'restIncome', val)"
              type="number"
              dense
              borderless
              class="table-input"
            />
          </td>
          <td class="editable-cell">
            <q-input
              :model-value="paymentData.digital.carRentIncome"
              @update:model-value="(val) => updatePaymentField('digital', 'carRentIncome', val)"
              type="number"
              dense
              borderless
              class="table-input"
            />
          </td>
          <td class="total-cell">{{ paymentData.digital.total.toFixed(0) }}</td>
          <td class="editable-cell">
            <q-input
              :model-value="paymentData.digital.hotelDeposit"
              @update:model-value="(val) => updatePaymentField('digital', 'hotelDeposit', val)"
              type="number"
              dense
              borderless
              class="table-input"
            />
          </td>
          <td class="editable-cell">
            <q-input
              :model-value="paymentData.digital.restDeposit"
              @update:model-value="(val) => updatePaymentField('digital', 'restDeposit', val)"
              type="number"
              dense
              borderless
              class="table-input"
            />
          </td>
          <td class="editable-cell">
            <q-input
              :model-value="paymentData.digital.retainedAmount"
              @update:model-value="(val) => updatePaymentField('digital', 'retainedAmount', val)"
              type="number"
              dense
              borderless
              class="table-input"
            />
          </td>
          <td class="auto-calculate">{{ (paymentData.digital.total - paymentData.digital.hotelDeposit - paymentData.digital.restDeposit - paymentData.digital.retainedAmount).toFixed(0) }}</td>
        </tr>
        <!-- 其他方式 -->
        <tr class="payment-row other-row">
          <td class="payment-label">其他方式</td>
          <td class="editable-cell">
            <q-input
              :model-value="paymentData.other.reserveCash"
              @update:model-value="(val) => updatePaymentField('other', 'reserveCash', val)"
              type="number"
              dense
              borderless
              class="table-input"
            />
          </td>
          <td class="editable-cell">
            <q-input
              :model-value="paymentData.other.hotelIncome"
              @update:model-value="(val) => updatePaymentField('other', 'hotelIncome', val)"
              type="number"
              dense
              borderless
              class="table-input"
            />
          </td>
          <td class="editable-cell">
            <q-input
              :model-value="paymentData.other.restIncome"
              @update:model-value="(val) => updatePaymentField('other', 'restIncome', val)"
              type="number"
              dense
              borderless
              class="table-input"
            />
          </td>
          <td class="editable-cell">
            <q-input
              :model-value="paymentData.other.carRentIncome"
              @update:model-value="(val) => updatePaymentField('other', 'carRentIncome', val)"
              type="number"
              dense
              borderless
              class="table-input"
            />
          </td>
          <td class="total-cell">{{ paymentData.other.total.toFixed(0) }}</td>
          <td class="editable-cell">
            <q-input
              :model-value="paymentData.other.hotelDeposit"
              @update:model-value="(val) => updatePaymentField('other', 'hotelDeposit', val)"
              type="number"
              dense
              borderless
              class="table-input"
            />
          </td>
          <td class="editable-cell">
            <q-input
              :model-value="paymentData.other.restDeposit"
              @update:model-value="(val) => updatePaymentField('other', 'restDeposit', val)"
              type="number"
              dense
              borderless
              class="table-input"
            />
          </td>
          <td class="editable-cell">
            <q-input
              :model-value="paymentData.other.retainedAmount"
              @update:model-value="(val) => updatePaymentField('other', 'retainedAmount', val)"
              type="number"
              dense
              borderless
              class="table-input"
            />
          </td>
          <td class="auto-calculate">{{ (paymentData.other.total - paymentData.other.hotelDeposit - paymentData.other.restDeposit - paymentData.other.retainedAmount).toFixed(0) }}</td>
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
                  :value="localNewTaskTitle"
                  @update:model-value="$emit('update:newTaskTitle', $event)"
                  placeholder="添加新备忘录..."
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
                      :disable="!localNewTaskTitle.trim()"
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
              <td colspan='2' class="stats-value">邀1得1</td>
              <td class="stats-label">开房</td>
              <td class="stats-number">{{ totalRooms }}</td>
              <td class="stats-label">收银员</td>
              <td class="cashier-name">
                <q-input
                  :value="localCashierName"
                  @update:model-value="$emit('update:cashierName', $event)"
                  dense
                  borderless
                  class="text-center"
                  placeholder="张"
                />
              </td>
            </tr>
            <tr>
              <td class="stats-label">大美卡</td>
              <td colspan='2' class="stats-number">{{ vipCards }}</td>
              <td class="stats-label">休息房</td>
              <td class="stats-number">{{ restRooms }}</td>
              <td class="stats-label">备注</td>
              <td class="notes-cell">
                <q-input
                  :value="localNotes"
                  @update:model-value="$emit('update:notes', $event)"
                  dense
                  borderless
                  class="notes-input"
                  placeholder="备注..."
                />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, computed } from 'vue'

const props = defineProps({
  paymentData: {
    type: Object,
    required: true
  },
  taskList: {
    type: Array,
    required: true
  },
  newTaskTitle: {
    type: String,
    required: true
  },
  totalRooms: {
    type: Number,
    required: true
  },
  restRooms: {
    type: Number,
    required: true
  },
  vipCards: {
    type: Number,
    required: true
  },
  cashierName: {
    type: String,
    required: true
  },
  notes: {
    type: String,
    required: true
  }
})

const emit = defineEmits([
  'update:paymentData',
  'update:cashierName',
  'update:notes',
  'update:newTaskTitle',
  'updateTaskStatus',
  'addNewTask',
  'deleteTask',
  'editTask'
])

// --- 创建计算属性来引用 props ---
const paymentData = computed(() => props.paymentData)

const localCashierName = ref(props.cashierName)
const localNotes = ref(props.notes)
const localNewTaskTitle = ref(props.newTaskTitle)

// --- Watchers to sync props to local state ---
// 移除 paymentData 的 watcher，因为现在使用计算属性

watch(() => props.cashierName, (newVal) => {
  localCashierName.value = newVal
})

watch(() => props.notes, (newVal) => {
  localNotes.value = newVal
})

watch(() => props.newTaskTitle, (newVal) => {
  localNewTaskTitle.value = newVal
})

// --- 移除 localPaymentData 的 watcher，因为现在使用计算属性 ---

watch(localCashierName, (newVal) => {
  emit('update:cashierName', newVal)
})

watch(localNotes, (newVal) => {
  emit('update:notes', newVal)
})

watch(localNewTaskTitle, (newVal) => {
  emit('update:newTaskTitle', newVal)
})

// --- Methods for tasks (forwarded) ---
function updatePaymentField(paymentType, field, value) {
  const newPaymentData = JSON.parse(JSON.stringify(props.paymentData))
  newPaymentData[paymentType][field] = Number(value) || 0

  // 计算合计
  Object.keys(newPaymentData).forEach(type => {
    const payment = newPaymentData[type]
    payment.total = (payment.reserveCash || 0) +
                   (payment.hotelIncome || 0) +
                   (payment.restIncome || 0) +
                   (payment.carRentIncome || 0)
  })

  emit('update:paymentData', newPaymentData)
}

function updateTaskStatus(taskId, completed) { emit('updateTaskStatus', taskId, completed) }
function addNewTask() { emit('addNewTask') }
function deleteTask(index) { emit('deleteTask', index) }
function editTask(index) { emit('editTask', index) }
</script>

<style scoped>
/* 保持原有样式不变 */
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
  text-align: center;
  color: #388e3c;
  font-weight: 500;
}

.add-task-input :deep(.q-field__native::placeholder) {
  color: #66bb6a;
  opacity: 0.8;
}

.table-input :deep(input) {
  text-align: center !important;
}

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
  background: #f1f8e9;
  border: 1px solid #81c784;
  border-radius: 8px;
  padding: 12px;
  min-width: 200px;
  max-width: 300px;
  transition: all 0.3s ease;
  position: relative;
}

.task-card:hover {
  background: #e8f5e8;
  border-color: #66bb6a;
  box-shadow: 0 2px 8px rgba(102, 187, 106, 0.2);
}

.task-card.task-completed {
  opacity: 0.7;
  background: #f5f5f5;
  border-color: #ccc;
}

.task-card.task-completed:hover {
  background: #eeeeee;
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
  background: #f3f9f3;
  border: 2px dashed #a5d6a7;
  border-radius: 8px;
  padding: 12px;
  min-width: 200px;
  max-width: 300px;
  transition: all 0.3s ease;
}

.add-task-card:hover {
  background: #e8f5e8;
  border-color: #81c784;
}

.add-task-input {
  font-size: 14px;
  width: 100%;
  text-align: center;
}

.add-task-input :deep(.q-field__control) {
  background: transparent;
}

.add-task-input :deep(.q-field__native) {
  text-align: center;
  color: #388e3c;
  font-weight: 500;
}

.add-task-input :deep(.q-field__native::placeholder) {
  color: #66bb6a;
  opacity: 0.8;
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
