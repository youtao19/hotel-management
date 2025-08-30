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
            <q-input :model-value="normalizedPaymentData.cash.reserveCash" dense borderless class="table-input" readonly />
          </td>
          <td class="editable-cell">
            <q-input :model-value="normalizedPaymentData.cash.hotelIncome" dense borderless class="table-input" readonly />
          </td>
          <td class="editable-cell">
            <q-input :model-value="normalizedPaymentData.cash.restIncome" dense borderless class="table-input" readonly />
          </td>
          <td class="editable-cell">
            <q-input :model-value="normalizedPaymentData.cash.carRentIncome" dense borderless class="table-input" readonly />
          </td>
          <td class="total-cell">{{ normalizedPaymentData.cash.total.toFixed(0) }}</td>
          <td class="editable-cell">
            <q-input :model-value="normalizedPaymentData.cash.hotelDeposit" dense borderless class="table-input" readonly />
          </td>
          <td class="editable-cell">
            <q-input :model-value="normalizedPaymentData.cash.restDeposit" dense borderless class="table-input" readonly />
          </td>
          <td class="editable-cell">
            <q-input :model-value="normalizedPaymentData.cash.retainedAmount" dense borderless class="table-input" readonly />
          </td>
          <td class="auto-calculate">{{ (normalizedPaymentData.cash.total - normalizedPaymentData.cash.hotelDeposit - normalizedPaymentData.cash.restDeposit - normalizedPaymentData.cash.retainedAmount).toFixed(0) }}</td>
        </tr>
        <tr class="payment-row wechat-row">
          <td class="payment-label">微信</td>
          <td class="editable-cell">
            <q-input :model-value="normalizedPaymentData.wechat.reserveCash" dense borderless class="table-input" readonly />
          </td>
          <td class="editable-cell">
            <q-input :model-value="normalizedPaymentData.wechat.hotelIncome" dense borderless class="table-input" readonly />
          </td>
          <td class="editable-cell">
            <q-input :model-value="normalizedPaymentData.wechat.restIncome" dense borderless class="table-input" readonly />
          </td>
          <td class="editable-cell">
            <q-input :model-value="normalizedPaymentData.wechat.carRentIncome" dense borderless class="table-input" readonly />
          </td>
          <td class="total-cell">{{ normalizedPaymentData.wechat.total.toFixed(0) }}</td>
          <td class="editable-cell">
            <q-input :model-value="normalizedPaymentData.wechat.hotelDeposit" dense borderless class="table-input" readonly />
          </td>
          <td class="editable-cell">
            <q-input :model-value="normalizedPaymentData.wechat.restDeposit" dense borderless class="table-input" readonly />
          </td>
          <td class="editable-cell">
            <q-input :model-value="normalizedPaymentData.wechat.retainedAmount" dense borderless class="table-input" readonly />
          </td>
          <td class="auto-calculate">{{ (normalizedPaymentData.wechat.total - normalizedPaymentData.wechat.hotelDeposit - normalizedPaymentData.wechat.restDeposit - normalizedPaymentData.wechat.retainedAmount).toFixed(0) }}</td>
        </tr>
        <tr class="payment-row digital-row">
          <td class="payment-label">微邮付</td>
          <td class="editable-cell">
            <q-input :model-value="normalizedPaymentData.digital.reserveCash" dense borderless class="table-input" readonly />
          </td>
          <td class="editable-cell">
            <q-input :model-value="normalizedPaymentData.digital.hotelIncome" dense borderless class="table-input" readonly />
          </td>
          <td class="editable-cell">
            <q-input :model-value="normalizedPaymentData.digital.restIncome" dense borderless class="table-input" readonly />
          </td>
          <td class="editable-cell">
            <q-input :model-value="normalizedPaymentData.digital.carRentIncome" dense borderless class="table-input" readonly />
          </td>
          <td class="total-cell">{{ normalizedPaymentData.digital.total.toFixed(0) }}</td>
          <td class="editable-cell">
            <q-input :model-value="normalizedPaymentData.digital.hotelDeposit" dense borderless class="table-input" readonly />
          </td>
          <td class="editable-cell">
            <q-input :model-value="normalizedPaymentData.digital.restDeposit" dense borderless class="table-input" readonly />
          </td>
          <td class="editable-cell">
            <q-input :model-value="normalizedPaymentData.digital.retainedAmount" dense borderless class="table-input" readonly />
          </td>
          <td class="auto-calculate">{{ (normalizedPaymentData.digital.total - normalizedPaymentData.digital.hotelDeposit - normalizedPaymentData.digital.restDeposit - normalizedPaymentData.digital.retainedAmount).toFixed(0) }}</td>
        </tr>
        <tr class="payment-row other-row">
          <td class="payment-label">其他方式</td>
          <td class="editable-cell">
            <q-input :model-value="normalizedPaymentData.other.reserveCash" dense borderless class="table-input" readonly />
          </td>
          <td class="editable-cell">
            <q-input :model-value="normalizedPaymentData.other.hotelIncome" dense borderless class="table-input" readonly />
          </td>
          <td class="editable-cell">
            <q-input :model-value="normalizedPaymentData.other.restIncome" dense borderless class="table-input" readonly />
          </td>
          <td class="editable-cell">
            <q-input :model-value="normalizedPaymentData.other.carRentIncome" dense borderless class="table-input" readonly />
          </td>
          <td class="total-cell">{{ normalizedPaymentData.other.total.toFixed(0) }}</td>
          <td class="editable-cell">
            <q-input :model-value="normalizedPaymentData.other.hotelDeposit" dense borderless class="table-input" readonly />
          </td>
          <td class="editable-cell">
            <q-input :model-value="normalizedPaymentData.other.restDeposit" dense borderless class="table-input" readonly />
          </td>
          <td class="editable-cell">
            <q-input :model-value="normalizedPaymentData.other.retainedAmount" dense borderless class="table-input" readonly />
          </td>
          <td class="auto-calculate">{{ (normalizedPaymentData.other.total - normalizedPaymentData.other.hotelDeposit - normalizedPaymentData.other.restDeposit - normalizedPaymentData.other.retainedAmount).toFixed(0) }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  paymentData: { type: Object, required: true },
  readOnly: { type: Boolean, default: false }
})

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
