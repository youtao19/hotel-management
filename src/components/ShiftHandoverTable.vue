<template>
  <div class="shift-table-container">
    <table class="shift-table">
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
      <tbody>
        <tr class="payment-row cash-row">
          <td class="payment-label">现金</td>
          <td class="editable-cell">
            <q-input :model-value="normalizedPaymentData.cash.reserveCash" @update:model-value="(v)=>updatePaymentField('cash','reserveCash',v)" type="number" dense borderless class="table-input" :readonly="readOnly" />
          </td>
          <td class="editable-cell">
            <q-input :model-value="normalizedPaymentData.cash.hotelIncome" @update:model-value="(v)=>updatePaymentField('cash','hotelIncome',v)" type="number" dense borderless class="table-input" :readonly="readOnly" />
          </td>
          <td class="editable-cell">
            <q-input :model-value="normalizedPaymentData.cash.restIncome" @update:model-value="(v)=>updatePaymentField('cash','restIncome',v)" type="number" dense borderless class="table-input" :readonly="readOnly" />
          </td>
          <td class="editable-cell">
            <q-input :model-value="normalizedPaymentData.cash.carRentIncome" @update:model-value="(v)=>updatePaymentField('cash','carRentIncome',v)" type="number" dense borderless class="table-input" :readonly="readOnly" />
          </td>
          <td class="total-cell">{{ normalizedPaymentData.cash.total.toFixed(0) }}</td>
          <td class="editable-cell">
            <q-input :model-value="normalizedPaymentData.cash.hotelDeposit" @update:model-value="(v)=>updatePaymentField('cash','hotelDeposit',v)" type="number" dense borderless class="table-input" :readonly="readOnly" />
          </td>
          <td class="editable-cell">
            <q-input :model-value="normalizedPaymentData.cash.restDeposit" @update:model-value="(v)=>updatePaymentField('cash','restDeposit',v)" type="number" dense borderless class="table-input" :readonly="readOnly" />
          </td>
          <td class="editable-cell">
            <q-input :model-value="normalizedPaymentData.cash.retainedAmount" @update:model-value="(v)=>updatePaymentField('cash','retainedAmount',v)" type="number" dense borderless class="table-input" :readonly="readOnly" />
          </td>
          <td class="auto-calculate">{{ (normalizedPaymentData.cash.total - normalizedPaymentData.cash.hotelDeposit - normalizedPaymentData.cash.restDeposit - normalizedPaymentData.cash.retainedAmount).toFixed(0) }}</td>
        </tr>
        <tr class="payment-row wechat-row">
          <td class="payment-label">微信</td>
          <td class="editable-cell">
            <q-input :model-value="normalizedPaymentData.wechat.reserveCash" @update:model-value="(v)=>updatePaymentField('wechat','reserveCash',v)" type="number" dense borderless class="table-input" :readonly="readOnly" />
          </td>
          <td class="editable-cell">
            <q-input :model-value="normalizedPaymentData.wechat.hotelIncome" @update:model-value="(v)=>updatePaymentField('wechat','hotelIncome',v)" type="number" dense borderless class="table-input" :readonly="readOnly" />
          </td>
          <td class="editable-cell">
            <q-input :model-value="normalizedPaymentData.wechat.restIncome" @update:model-value="(v)=>updatePaymentField('wechat','restIncome',v)" type="number" dense borderless class="table-input" :readonly="readOnly" />
          </td>
          <td class="editable-cell">
            <q-input :model-value="normalizedPaymentData.wechat.carRentIncome" @update:model-value="(v)=>updatePaymentField('wechat','carRentIncome',v)" type="number" dense borderless class="table-input" :readonly="readOnly" />
          </td>
          <td class="total-cell">{{ normalizedPaymentData.wechat.total.toFixed(0) }}</td>
          <td class="editable-cell">
            <q-input :model-value="normalizedPaymentData.wechat.hotelDeposit" @update:model-value="(v)=>updatePaymentField('wechat','hotelDeposit',v)" type="number" dense borderless class="table-input" :readonly="readOnly" />
          </td>
          <td class="editable-cell">
            <q-input :model-value="normalizedPaymentData.wechat.restDeposit" @update:model-value="(v)=>updatePaymentField('wechat','restDeposit',v)" type="number" dense borderless class="table-input" :readonly="readOnly" />
          </td>
          <td class="editable-cell">
            <q-input :model-value="normalizedPaymentData.wechat.retainedAmount" @update:model-value="(v)=>updatePaymentField('wechat','retainedAmount',v)" type="number" dense borderless class="table-input" :readonly="readOnly" />
          </td>
          <td class="auto-calculate">{{ (normalizedPaymentData.wechat.total - normalizedPaymentData.wechat.hotelDeposit - normalizedPaymentData.wechat.restDeposit - normalizedPaymentData.wechat.retainedAmount).toFixed(0) }}</td>
        </tr>
        <tr class="payment-row digital-row">
          <td class="payment-label">微邮付</td>
          <td class="editable-cell">
            <q-input :model-value="normalizedPaymentData.digital.reserveCash" @update:model-value="(v)=>updatePaymentField('digital','reserveCash',v)" type="number" dense borderless class="table-input" :readonly="readOnly" />
          </td>
          <td class="editable-cell">
            <q-input :model-value="normalizedPaymentData.digital.hotelIncome" @update:model-value="(v)=>updatePaymentField('digital','hotelIncome',v)" type="number" dense borderless class="table-input" :readonly="readOnly" />
          </td>
          <td class="editable-cell">
            <q-input :model-value="normalizedPaymentData.digital.restIncome" @update:model-value="(v)=>updatePaymentField('digital','restIncome',v)" type="number" dense borderless class="table-input" :readonly="readOnly" />
          </td>
          <td class="editable-cell">
            <q-input :model-value="normalizedPaymentData.digital.carRentIncome" @update:model-value="(v)=>updatePaymentField('digital','carRentIncome',v)" type="number" dense borderless class="table-input" :readonly="readOnly" />
          </td>
          <td class="total-cell">{{ normalizedPaymentData.digital.total.toFixed(0) }}</td>
          <td class="editable-cell">
            <q-input :model-value="normalizedPaymentData.digital.hotelDeposit" @update:model-value="(v)=>updatePaymentField('digital','hotelDeposit',v)" type="number" dense borderless class="table-input" :readonly="readOnly" />
          </td>
          <td class="editable-cell">
            <q-input :model-value="normalizedPaymentData.digital.restDeposit" @update:model-value="(v)=>updatePaymentField('digital','restDeposit',v)" type="number" dense borderless class="table-input" :readonly="readOnly" />
          </td>
          <td class="editable-cell">
            <q-input :model-value="normalizedPaymentData.digital.retainedAmount" @update:model-value="(v)=>updatePaymentField('digital','retainedAmount',v)" type="number" dense borderless class="table-input" :readonly="readOnly" />
          </td>
          <td class="auto-calculate">{{ (normalizedPaymentData.digital.total - normalizedPaymentData.digital.hotelDeposit - normalizedPaymentData.digital.restDeposit - normalizedPaymentData.digital.retainedAmount).toFixed(0) }}</td>
        </tr>
        <tr class="payment-row other-row">
          <td class="payment-label">其他方式</td>
          <td class="editable-cell">
            <q-input :model-value="normalizedPaymentData.other.reserveCash" @update:model-value="(v)=>updatePaymentField('other','reserveCash',v)" type="number" dense borderless class="table-input" :readonly="readOnly" />
          </td>
          <td class="editable-cell">
            <q-input :model-value="normalizedPaymentData.other.hotelIncome" @update:model-value="(v)=>updatePaymentField('other','hotelIncome',v)" type="number" dense borderless class="table-input" :readonly="readOnly" />
          </td>
          <td class="editable-cell">
            <q-input :model-value="normalizedPaymentData.other.restIncome" @update:model-value="(v)=>updatePaymentField('other','restIncome',v)" type="number" dense borderless class="table-input" :readonly="readOnly" />
          </td>
          <td class="editable-cell">
            <q-input :model-value="normalizedPaymentData.other.carRentIncome" @update:model-value="(v)=>updatePaymentField('other','carRentIncome',v)" type="number" dense borderless class="table-input" :readonly="readOnly" />
          </td>
          <td class="total-cell">{{ normalizedPaymentData.other.total.toFixed(0) }}</td>
          <td class="editable-cell">
            <q-input :model-value="normalizedPaymentData.other.hotelDeposit" @update:model-value="(v)=>updatePaymentField('other','hotelDeposit',v)" type="number" dense borderless class="table-input" :readonly="readOnly" />
          </td>
          <td class="editable-cell">
            <q-input :model-value="normalizedPaymentData.other.restDeposit" @update:model-value="(v)=>updatePaymentField('other','restDeposit',v)" type="number" dense borderless class="table-input" :readonly="readOnly" />
          </td>
          <td class="editable-cell">
            <q-input :model-value="normalizedPaymentData.other.retainedAmount" @update:model-value="(v)=>updatePaymentField('other','retainedAmount',v)" type="number" dense borderless class="table-input" :readonly="readOnly" />
          </td>
          <td class="auto-calculate">{{ (normalizedPaymentData.other.total - normalizedPaymentData.other.hotelDeposit - normalizedPaymentData.other.restDeposit - normalizedPaymentData.other.retainedAmount).toFixed(0) }}</td>
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
                <q-checkbox
                  v-model="task.completed"
                  class="task-checkbox"
                  @click.prevent.stop="readOnly && $event && $event.preventDefault()"
                  @update:model-value="updateTaskStatus(task.id, $event)"
                />
                <div class="task-content" @click="onEditTask(index)">
                  <div class="task-title" :class="{ 'completed': task.completed }">{{ task.title }}</div>
                  <div class="task-time" v-if="task.time">
                    <q-icon name="schedule" size="14px" class="q-mr-xs" />
                    {{ task.time }}
                  </div>
                </div>
                <q-btn v-if="!readOnly" flat round dense size="sm" icon="close" class="task-delete" @click="deleteTask(index)" />
              </div>
              <!-- 添加新任务卡片 -->
              <div class="add-task-card">
                <q-input v-model="localNewTaskTitle" placeholder="添加新备忘录..." dense borderless class="add-task-input" @keyup.enter="addNewTask">
                  <template #prepend>
                    <q-icon name="add" />
                  </template>
                  <template #append>
                    <q-btn flat round dense size="sm" icon="add" color="primary" @click="addNewTask" :disable="!localNewTaskTitle.trim()" />
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
              <td colspan="2" class="stats-value">
                <q-input v-model="localGoodReview" dense borderless class="text-center" placeholder="邀1得1" :readonly="readOnly" />
              </td>
              <td class="stats-label">开房</td>
              <td colspan="2" class="stats-number">
                <q-input v-model.number="localTotalRooms" type="number" dense borderless class="text-center" placeholder="0" :readonly="readOnly" />
              </td>
              <td class="stats-label">收银员</td>
              <td class="cashier-name">
                <q-input v-model="localCashierName" dense borderless class="text-center" placeholder="张" :readonly="readOnly" />
              </td>
            </tr>
            <tr>
              <td class="stats-label">大美卡</td>
              <td colspan="2" class="stats-number">
                <q-input v-model.number="localVipCards" type="number" dense borderless class="text-center" placeholder="0" :readonly="readOnly" />
              </td>
              <td class="stats-label">休息房</td>
              <td colspan="2" class="stats-number">
                <q-input v-model.number="localRestRooms" type="number" dense borderless class="text-center" placeholder="0" :readonly="readOnly" />
              </td>
              <td class="stats-label">备注</td>
              <td class="notes-cell">
                <q-input v-model="localNotes" dense borderless class="notes-input" placeholder="备注..." :readonly="readOnly" />
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
  readOnly: { type: Boolean, default: false },
  paymentData: { type: Object, required: true },
  taskList: { type: Array, required: true },
  newTaskTitle: { type: String, required: true },
  totalRooms: { type: Number, required: true },
  restRooms: { type: Number, required: true },
  vipCards: { type: Number, required: true },
  cashierName: { type: String, required: true },
  notes: { type: String, required: true },
  goodReview: { type: String, default: '邀1得1' }
})

const emit = defineEmits([
  'update:paymentData',
  'update:cashierName',
  'update:notes',
  'update:newTaskTitle',
  'update:totalRooms',
  'update:restRooms',
  'update:vipCards',
  'update:goodReview',
  // custom events use kebab-case to be compatible with DOM templates
  'update-task-status',
  'add-new-task',
  'delete-task',
  'edit-task'
])

// 规范化支付数据：兼容中文键和英文字段
function normalizePaymentData(src) {
  const safeNum = (v) => Number(v ?? 0) || 0
  const getRow = (obj) => ({
    reserveCash: safeNum(obj?.reserveCash ?? obj?.['备用金']),
    hotelIncome: safeNum(obj?.hotelIncome ?? obj?.['客房收入'] ?? obj?.['收入1']),
    restIncome: safeNum(obj?.restIncome ?? obj?.['休息房收入'] ?? obj?.['收入2']),
    carRentIncome: safeNum(obj?.carRentIncome ?? obj?.['租车收入'] ?? obj?.['收入3']),
    total: safeNum(obj?.total ?? obj?.['合计']),
    hotelDeposit: safeNum(obj?.hotelDeposit ?? obj?.['客房退押']),
    restDeposit: safeNum(obj?.restDeposit ?? obj?.['休息退押']),
    retainedAmount: safeNum(obj?.retainedAmount ?? obj?.['留存款'])
  })
  const s = src || {}
  const mapKey = (eKey, ...cKeys) => s?.[eKey] ?? cKeys.reduce((acc, k) => acc ?? s?.[k], undefined)
  const cash = getRow(mapKey('cash', '现金'))
  const wechat = getRow(mapKey('wechat', '微信'))
  const digital = getRow(mapKey('digital', '微邮付', '支付宝', '数字支付'))
  const other = getRow(mapKey('other', '其他', '其他方式'))
  // 若 total 未提供，则按四项收入计算
  const recalcTotal = (r) => ({ ...r, total: safeNum(r.reserveCash) + safeNum(r.hotelIncome) + safeNum(r.restIncome) + safeNum(r.carRentIncome) })
  return {
    cash: recalcTotal(cash),
    wechat: recalcTotal(wechat),
    digital: recalcTotal(digital),
    other: recalcTotal(other)
  }
}

const normalizedPaymentData = computed(() => normalizePaymentData(props.paymentData))

const localCashierName = ref(props.cashierName)
const localNotes = ref(props.notes)
const localNewTaskTitle = ref(props.newTaskTitle)
const localTotalRooms = ref(props.totalRooms)
const localRestRooms = ref(props.restRooms)
const localVipCards = ref(props.vipCards)
const localGoodReview = ref(props.goodReview)

watch(() => props.cashierName, v => { localCashierName.value = v })
watch(() => props.notes, v => { localNotes.value = v })
watch(() => props.newTaskTitle, v => { localNewTaskTitle.value = v })
watch(() => props.totalRooms, v => { localTotalRooms.value = v })
watch(() => props.restRooms, v => { localRestRooms.value = v })
watch(() => props.vipCards, v => { localVipCards.value = v })
watch(() => props.goodReview, v => { localGoodReview.value = v })

watch(localCashierName, v => emit('update:cashierName', v))
watch(localNotes, v => emit('update:notes', v))
watch(localNewTaskTitle, v => emit('update:newTaskTitle', v))
watch(localTotalRooms, v => emit('update:totalRooms', v))
watch(localRestRooms, v => emit('update:restRooms', v))
watch(localVipCards, v => emit('update:vipCards', v))
watch(localGoodReview, v => emit('update:goodReview', v))

function updatePaymentField(paymentType, field, value) {
  if (props.readOnly) return
  const newPaymentData = JSON.parse(JSON.stringify(props.paymentData))
  newPaymentData[paymentType][field] = Number(value) || 0
  Object.keys(newPaymentData).forEach(type => {
    const p = newPaymentData[type]
    p.total = (p.reserveCash || 0) + (p.hotelIncome || 0) + (p.restIncome || 0) + (p.carRentIncome || 0)
  })
  emit('update:paymentData', newPaymentData)
}

function updateTaskStatus(taskId, completed) { emit('update-task-status', taskId, completed) }
function addNewTask() { emit('add-new-task') }
function deleteTask(index) { if (!props.readOnly) emit('delete-task', index) }
function onEditTask(index) { if (!props.readOnly) emit('edit-task', index) }
</script>

<style scoped>
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

.shift-table td * { text-align: center !important; }

.table-header { background-color: #f8f9fa; font-weight: bold; height: 40px; }
.sub-header { background-color: #e9ecef; font-weight: bold; height: 45px; font-size: 13px; line-height: 1.2; }
.sub-header th { vertical-align: middle; text-align: center; padding: 6px 4px; }

.payment-method-header { background-color: #e3f2fd; width: 80px; }
.income-header { background-color: #f3e5f5; width: 90px; }
.total-header { background-color: #fff3e0; width: 80px; }
.deposit-header { background-color: #e8f5e8; width: 80px; }
.retained-header { background-color: #fce4ec; width: 80px; }
.handover-header { background-color: #e0f2f1; width: 80px; }

.payment-row { height: 45px; }
.cash-row { background-color: #ffeaa7; }
.wechat-row { background-color: #a4e8a4; }
.digital-row { background-color: #81c7f0; }
.other-row { background-color: #f0b7ba; }

.payment-label { font-weight: bold; background-color: rgba(0, 0, 0, 0.05); width: 80px; text-align: center !important; }
.editable-cell { background-color: white; position: relative; text-align: center !important; }
.auto-calculate { background-color: #f8f9fa; font-weight: bold; text-align: center !important; }
.total-cell { background-color: #ffe6cc; font-weight: bold; color: #d63384; text-align: center !important; }

.table-input { text-align: center !important; font-weight: bold; width: 100%; }
.table-input :deep(.q-field__control) { text-align: center !important; }
.table-input :deep(.q-field__native) { text-align: center; color: #388e3c; font-weight: 500; }
.table-input :deep(input) { text-align: center !important; }

.task-management-container { background: white; border-radius: 12px; padding: 20px; box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1); border: 1px solid #e0e0e0; }
.task-management-header { display: flex; align-items: center; justify-content: center; margin-bottom: 16px; color: #2c3e50; background-color: #e8f5e8; border-bottom: 2px solid #a5d6a7; padding: 12px; border-radius: 8px 8px 0 0; }
.task-management-content { min-height: 100px; }
.task-list-horizontal { display: flex; flex-wrap: wrap; gap: 12px; align-items: flex-start; }
.task-card { display: flex; align-items: center; background: #f1f8e9; border: 1px solid #81c784; border-radius: 8px; padding: 12px; min-width: 200px; max-width: 300px; transition: all 0.3s ease; position: relative; }
.task-card:hover { background: #e8f5e8; border-color: #66bb6a; box-shadow: 0 2px 8px rgba(102, 187, 106, 0.2); }
.task-card.task-completed { opacity: 0.7; background: #f5f5f5; border-color: #ccc; }
.task-card.task-completed:hover { background: #eeeeee; }
.task-checkbox { margin-right: 10px; align-self: flex-start; margin-top: 2px; }
.task-content { flex: 1; cursor: pointer; padding: 2px; border-radius: 4px; min-width: 0; }
.task-title { font-size: 14px; line-height: 1.4; margin-bottom: 4px; font-weight: 500; word-wrap: break-word; }
.task-title.completed { text-decoration: line-through; color: #999; }
.task-time { font-size: 12px; color: #666; display: flex; align-items: center; }
.task-delete { opacity: 0; transition: opacity 0.2s; color: #f44336; margin-left: 8px; align-self: flex-start; }
.task-card:hover .task-delete { opacity: 1; }

.add-task-card { display: flex; align-items: center; background: #f3f9f3; border: 2px dashed #a5d6a7; border-radius: 8px; padding: 12px; min-width: 200px; max-width: 300px; transition: all 0.3s ease; }
.add-task-card:hover { background: #e8f5e8; border-color: #81c784; }
.add-task-input { font-size: 14px; width: 100%; text-align: center; }
.add-task-input :deep(.q-field__control) { background: transparent; }
.add-task-input :deep(.q-field__native) { text-align: center; color: #388e3c; font-weight: 500; }
.add-task-input :deep(.q-field__native::placeholder) { color: #66bb6a; opacity: 0.8; }

.special-stats-table { width: 100%; border-collapse: collapse; border: 2px solid #333; margin-top: 20px; }
.special-stats-table td { border: 1px solid #333; padding: 8px; text-align: center; height: 35px; }
.stats-label { background-color: #e3f2fd; font-weight: bold; width: 80px; }
.stats-value { background-color: #f3e5f5; font-weight: bold; width: 60px; }
.stats-number { background-color: #fff3e0; font-weight: bold; font-size: 16px; color: #f57c00; width: 80px; }
.cashier-name { background-color: #e8f5e8; font-weight: bold; font-size: 18px; width: 100px; }

@media (max-width: 768px) {
  .shift-table { font-size: 12px; }
  .shift-table th, .shift-table td { padding: 4px; }
  .notes-cell { width: 120px; }
}
</style>
