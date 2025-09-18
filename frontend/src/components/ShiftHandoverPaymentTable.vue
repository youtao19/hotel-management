<template>
  <div class="shift-table-wrapper">
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
            <q-input :model-value="paymentData.reserve[payWay.cash]" dense borderless class="table-input" readonly />
          </td>
          <td class="editable-cell">
            <q-input :model-value="paymentData.hotelIncome[payWay.cash]" dense borderless class="table-input" readonly />
          </td>
          <td class="editable-cell">
            <q-input :model-value="paymentData.restIncome[payWay.cash]" dense borderless class="table-input" readonly />
          </td>
          <td class="editable-cell">
            <q-input :model-value="paymentData.carRentIncome[payWay.cash]" dense borderless class="table-input" readonly />
          </td>
          <td class="total-cell">{{ paymentData.totalIncome[payWay.cash].toFixed(0) }}</td>
          <td class="editable-cell">
            <q-input :model-value="paymentData.hotelDeposit[payWay.cash]" dense borderless class="table-input" readonly />
          </td>
          <td class="editable-cell">
            <q-input :model-value="paymentData.restDeposit[payWay.cash]" dense borderless class="table-input" readonly />
          </td>
          <td class="editable-cell">
            <q-input :model-value="paymentData.retainedAmount[payWay.cash]" dense borderless class="table-input" readonly />
          </td>
          <td class="auto-calculate">{{ paymentData.handoverAmount[payWay.cash].toFixed(0) }}</td>
        </tr>
        <tr class="payment-row wechat-row">
          <td class="payment-label">微信</td>
          <td class="editable-cell">
            <q-input :model-value="paymentData.reserve[payWay.wechat]" dense borderless class="table-input" readonly />
          </td>
          <td class="editable-cell">
            <q-input :model-value="paymentData.hotelIncome[payWay.wechat]" dense borderless class="table-input" readonly />
          </td>
          <td class="editable-cell">
            <q-input :model-value="paymentData.restIncome[payWay.wechat]" dense borderless class="table-input" readonly />
          </td>
          <td class="editable-cell">
            <q-input :model-value="paymentData.carRentIncome[payWay.wechat]" dense borderless class="table-input" readonly />
          </td>
          <td class="total-cell">{{ paymentData.totalIncome[payWay.wechat].toFixed(0) }}</td>
          <td class="editable-cell">
            <q-input :model-value="paymentData.hotelDeposit[payWay.wechat]" dense borderless class="table-input" readonly />
          </td>
          <td class="editable-cell">
            <q-input :model-value="paymentData.restDeposit[payWay.wechat]" dense borderless class="table-input" readonly />
          </td>
          <td class="editable-cell">
            <q-input :model-value="paymentData.retainedAmount[payWay.wechat]" dense borderless class="table-input" readonly />
          </td>
          <td class="auto-calculate">{{ paymentData.handoverAmount[payWay.wechat].toFixed(0) }}</td>
        </tr>
        <tr class="payment-row digital-row">
          <td class="payment-label">微邮付</td>
          <td class="editable-cell">
            <q-input :model-value="paymentData.reserve[payWay.digital]" dense borderless class="table-input" readonly />
          </td>
          <td class="editable-cell">
            <q-input :model-value="paymentData.hotelIncome[payWay.digital]" dense borderless class="table-input" readonly />
          </td>
          <td class="editable-cell">
            <q-input :model-value="paymentData.restIncome[payWay.digital]" dense borderless class="table-input" readonly />
          </td>
          <td class="editable-cell">
            <q-input :model-value="paymentData.carRentIncome[payWay.digital]" dense borderless class="table-input" readonly />
          </td>
              <td class="total-cell">{{ paymentData.totalIncome[payWay.digital].toFixed(0) }}</td>
          <td class="editable-cell">
            <q-input :model-value="paymentData.hotelDeposit[payWay.digital]" dense borderless class="table-input" readonly />
          </td>
          <td class="editable-cell">
            <q-input :model-value="paymentData.restDeposit[payWay.digital]" dense borderless class="table-input" readonly />
          </td>
          <td class="editable-cell">
            <q-input :model-value="paymentData.retainedAmount[payWay.digital]" dense borderless class="table-input" readonly />
          </td>
          <td class="auto-calculate">{{ paymentData.handoverAmount[payWay.digital].toFixed(0) }}</td>
        </tr>
        <tr class="payment-row other-row">
          <td class="payment-label">其他方式</td>
          <td class="editable-cell">
            <q-input :model-value="paymentData.reserve[payWay.other]" dense borderless class="table-input" readonly />
          </td>
          <td class="editable-cell">
            <q-input :model-value="paymentData.hotelIncome[payWay.other]" dense borderless class="table-input" readonly />
          </td>
          <td class="editable-cell">
            <q-input :model-value="paymentData.restIncome[payWay.other]" dense borderless class="table-input" readonly />
          </td>
          <td class="editable-cell">
            <q-input :model-value="paymentData.carRentIncome[payWay.other]" dense borderless class="table-input" readonly />
          </td>
          <td class="total-cell">{{ paymentData.totalIncome[payWay.other].toFixed(0) }}</td>
          <td class="editable-cell">
            <q-input :model-value="paymentData.hotelDeposit[payWay.other]" dense borderless class="table-input" readonly />
          </td>
          <td class="editable-cell">
              <q-input :model-value="paymentData.restDeposit[payWay.other]" dense borderless class="table-input" readonly />
          </td>
          <td class="editable-cell">
            <q-input :model-value="paymentData.retainedAmount[payWay.other]" dense borderless class="table-input" readonly />
          </td>
          <td class="auto-calculate">{{ paymentData.handoverAmount[payWay.other].toFixed(0) }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup>
import { defineProps, computed } from 'vue'
const props = defineProps({
  paymentData: { type: Object, required: true },
  readOnly: { type: Boolean, default: false }
})

const payWay = { cash: '现金', wechat: '微信', digital: '微邮付', other: '其他' }

function createEmptyBuckets() {
  return { '现金': 0, '微信': 0, '微邮付': 0, '其他': 0 }
}

function createEmptyPaymentData() {
  return {
    reserve: createEmptyBuckets(),
    hotelIncome: createEmptyBuckets(),
    restIncome: createEmptyBuckets(),
    carRentIncome: createEmptyBuckets(),
    totalIncome: createEmptyBuckets(),
    hotelDeposit: createEmptyBuckets(),
    restDeposit: createEmptyBuckets(),
    retainedAmount: createEmptyBuckets(),
    handoverAmount: createEmptyBuckets()
  }
}

const paymentData = computed(() => {
  const pd = props.paymentData || {}
  const empty = createEmptyPaymentData()
  return {
    reserve: pd.reserve || empty.reserve,
    hotelIncome: pd.hotelIncome || empty.hotelIncome,
    restIncome: pd.restIncome || empty.restIncome,
    carRentIncome: pd.carRentIncome || empty.carRentIncome,
    totalIncome: pd.totalIncome || empty.totalIncome,
    hotelDeposit: pd.hotelDeposit || empty.hotelDeposit,
    restDeposit: pd.restDeposit || empty.restDeposit,
    retainedAmount: pd.retainedAmount || empty.retainedAmount,
    handoverAmount: pd.handoverAmount || empty.handoverAmount
  }
})

</script>

<style scoped>

.shift-table-wrapper {
  margin-bottom: 20px;
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

@media (max-width: 768px) {
  .shift-table { font-size: 12px; }
  .shift-table th, .shift-table td { padding: 4px; }
}
</style>
