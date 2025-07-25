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
          <td class="static-cell">{{ paymentData.cash?.reserveCash || 0 }}</td>
          <td class="static-cell">{{ paymentData.cash?.hotelIncome || 0 }}</td>
          <td class="static-cell">{{ paymentData.cash?.restIncome || 0 }}</td>
          <td class="static-cell">{{ paymentData.cash?.carRentIncome || 0 }}</td>
          <td class="total-cell">{{ (paymentData.cash?.total || 0).toFixed(0) }}</td>
          <td class="static-cell">{{ paymentData.cash?.hotelDeposit || 0 }}</td>
          <td class="static-cell">{{ paymentData.cash?.restDeposit || 0 }}</td>
          <td class="static-cell">{{ paymentData.cash?.retainedAmount || 0 }}</td>
          <td class="auto-calculate">{{ ((paymentData.cash?.total || 0) - (paymentData.cash?.hotelDeposit || 0) - (paymentData.cash?.restDeposit || 0) - (paymentData.cash?.retainedAmount || 0)).toFixed(0) }}</td>
        </tr>
        <!-- 微信 -->
        <tr class="payment-row wechat-row">
          <td class="payment-label">微信</td>
          <td class="static-cell">{{ paymentData.wechat?.reserveCash || 0 }}</td>
          <td class="static-cell">{{ paymentData.wechat?.hotelIncome || 0 }}</td>
          <td class="static-cell">{{ paymentData.wechat?.restIncome || 0 }}</td>
          <td class="static-cell">{{ paymentData.wechat?.carRentIncome || 0 }}</td>
          <td class="total-cell">{{ (paymentData.wechat?.total || 0).toFixed(0) }}</td>
          <td class="static-cell">{{ paymentData.wechat?.hotelDeposit || 0 }}</td>
          <td class="static-cell">{{ paymentData.wechat?.restDeposit || 0 }}</td>
          <td class="static-cell">{{ paymentData.wechat?.retainedAmount || 0 }}</td>
          <td class="auto-calculate">{{ ((paymentData.wechat?.total || 0) - (paymentData.wechat?.hotelDeposit || 0) - (paymentData.wechat?.restDeposit || 0) - (paymentData.wechat?.retainedAmount || 0)).toFixed(0) }}</td>
        </tr>
        <!-- 微邮付 -->
        <tr class="payment-row digital-row">
          <td class="payment-label">微邮付</td>
          <td class="static-cell">{{ paymentData.digital?.reserveCash || 0 }}</td>
          <td class="static-cell">{{ paymentData.digital?.hotelIncome || 0 }}</td>
          <td class="static-cell">{{ paymentData.digital?.restIncome || 0 }}</td>
          <td class="static-cell">{{ paymentData.digital?.carRentIncome || 0 }}</td>
          <td class="total-cell">{{ (paymentData.digital?.total || 0).toFixed(0) }}</td>
          <td class="static-cell">{{ paymentData.digital?.hotelDeposit || 0 }}</td>
          <td class="static-cell">{{ paymentData.digital?.restDeposit || 0 }}</td>
          <td class="static-cell">{{ paymentData.digital?.retainedAmount || 0 }}</td>
          <td class="auto-calculate">{{ ((paymentData.digital?.total || 0) - (paymentData.digital?.hotelDeposit || 0) - (paymentData.digital?.restDeposit || 0) - (paymentData.digital?.retainedAmount || 0)).toFixed(0) }}</td>
        </tr>
        <!-- 其他方式 -->
        <tr class="payment-row other-row">
          <td class="payment-label">其他方式</td>
          <td class="static-cell">{{ paymentData.other?.reserveCash || 0 }}</td>
          <td class="static-cell">{{ paymentData.other?.hotelIncome || 0 }}</td>
          <td class="static-cell">{{ paymentData.other?.restIncome || 0 }}</td>
          <td class="static-cell">{{ paymentData.other?.carRentIncome || 0 }}</td>
          <td class="total-cell">{{ (paymentData.other?.total || 0).toFixed(0) }}</td>
          <td class="static-cell">{{ paymentData.other?.hotelDeposit || 0 }}</td>
          <td class="static-cell">{{ paymentData.other?.restDeposit || 0 }}</td>
          <td class="static-cell">{{ paymentData.other?.retainedAmount || 0 }}</td>
          <td class="auto-calculate">{{ ((paymentData.other?.total || 0) - (paymentData.other?.hotelDeposit || 0) - (paymentData.other?.restDeposit || 0) - (paymentData.other?.retainedAmount || 0)).toFixed(0) }}</td>
        </tr>
      </tbody>
    </table>
    <!-- 备忘录 -->
    <div class="row q-mt-lg" v-if="taskList && taskList.length > 0">
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
                :key="task.id || index"
                class="task-card readonly-task"
                :class="{ 'task-completed': task.completed }"
              >
                <q-icon
                  :name="task.completed ? 'check_circle' : 'radio_button_unchecked'"
                  :color="task.completed ? 'green' : 'grey'"
                  class="task-icon"
                />
                <div class="task-content">
                  <div class="task-title" :class="{ 'completed': task.completed }">
                    {{ task.title }}
                  </div>
                  <div class="task-time" v-if="task.time">
                    <q-icon name="schedule" size="14px" class="q-mr-xs" />
                    {{ task.time }}
                  </div>
                </div>
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
              <td class="cashier-name">{{ cashierName }}</td>
            </tr>
            <tr>
              <td class="stats-label">大美卡</td>
              <td colspan='2' class="stats-number">{{ vipCards }}</td>
              <td class="stats-label">休息房</td>
              <td class="stats-number">{{ restRooms }}</td>
              <td class="stats-label">备注</td>
              <td class="notes-cell">{{ notes || '-' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup>
const props = defineProps({
  paymentData: {
    type: Object,
    default: () => ({
      cash: {},
      wechat: {},
      digital: {},
      other: {}
    })
  },
  taskList: {
    type: Array,
    default: () => []
  },
  totalRooms: {
    type: Number,
    default: 0
  },
  restRooms: {
    type: Number,
    default: 0
  },
  vipCards: {
    type: Number,
    default: 0
  },
  cashierName: {
    type: String,
    default: ''
  },
  notes: {
    type: String,
    default: ''
  }
})
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

.static-cell {
  background-color: white;
  text-align: center !important;
  font-weight: bold;
  color: #388e3c;
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

.task-card.task-completed {
  opacity: 0.7;
  background: #f5f5f5;
  border-color: #ccc;
}

.task-icon {
  margin-right: 10px;
  align-self: flex-start;
  margin-top: 2px;
}

.task-content {
  flex: 1;
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

.notes-cell {
  background-color: #fff3cd;
  font-weight: bold;
  width: 120px;
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
