
<template>
  <div class="row q-col-gutter-md q-mb-lg">
    <div class="col-lg-4 col-md-6 col-sm-12">
      <q-card class="quick-stats-card modern-stat-card">
        <q-card-section class="modern-stat-section">
          <div class="modern-stat-header">
            <div>
              <div class="modern-stat-title">{{ selectedTitle }}</div>
              <div class="modern-stat-subtitle">所选范围统计</div>
            </div>
            <div class="modern-stat-icon"><q-icon name="event_note" size="20px" /></div>
          </div>
          <div class="modern-stat-amount">
            <span class="modern-stat-currency">¥</span>
            <span class="modern-stat-value">{{ formatCurrency(selectedRangeStats.total_revenue) }}</span>
          </div>
          <div class="modern-stat-footer">
            <div class="modern-stat-orders">
              <span class="modern-stat-orders-count">{{ selectedRangeStats.total_orders }}</span>
              <span class="modern-stat-orders-label">订单数</span>
            </div>
          </div>
        </q-card-section>
      </q-card>
    </div>

    <div class="col-lg-4 col-md-6 col-sm-12">
      <q-card class="quick-stats-card modern-stat-card">
        <q-card-section class="modern-stat-section">
          <div class="modern-stat-header">
            <div><div class="modern-stat-title">本周收入</div></div>
            <div class="modern-stat-icon modern-stat-icon--week"><q-icon name="date_range" size="20px" /></div>
          </div>
          <div class="modern-stat-amount">
            <span class="modern-stat-currency">¥</span>
            <span class="modern-stat-value">{{ formatCurrency(quickStats.thisWeek?.total_revenue) }}</span>
          </div>
          <div class="modern-stat-footer">
            <span class="modern-stat-orders-count">{{ quickStats.thisWeek?.total_orders || 0 }}</span>
            <span class="modern-stat-orders-label q-ml-sm">本周订单</span>
          </div>
        </q-card-section>
      </q-card>
    </div>

    <div class="col-lg-4 col-md-6 col-sm-12">
      <q-card class="quick-stats-card modern-stat-card">
        <q-card-section class="modern-stat-section">
          <div class="modern-stat-header">
            <div><div class="modern-stat-title">本月收入</div></div>
            <div class="modern-stat-icon modern-stat-icon--month"><q-icon name="calendar_month" size="20px" /></div>
          </div>
          <div class="modern-stat-amount">
            <span class="modern-stat-currency">¥</span>
            <span class="modern-stat-value">{{ formatCurrency(quickStats.thisMonth?.total_revenue) }}</span>
          </div>
          <div class="modern-stat-footer">
            <span class="modern-stat-orders-count">{{ quickStats.thisMonth?.total_orders || 0 }}</span>
            <span class="modern-stat-orders-label q-ml-sm">本月订单</span>
          </div>
        </q-card-section>
      </q-card>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { date } from 'quasar'

const props = defineProps(['quickStats', 'selectedRangeStats', 'dateRange'])

const formatCurrency = (val) => Number(val || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2 })

const selectedTitle = computed(() => {
  const { start, end } = props.dateRange
  const today = date.formatDate(new Date(), 'YYYY-MM-DD')
  if (start === today && end === today) return '今日收入'
  return `${start} 收入`
})
</script>

<style scoped>
/* 复制原文件中 .modern-stat-card 相关的 CSS */
.modern-stat-card { border-radius: 1.25rem; border: 1px solid #e5e7eb; transition: all 0.3s; }
.modern-stat-card:hover { box-shadow: 0 22px 45px rgba(15, 23, 42, 0.12); }
.modern-stat-section { padding: 24px; }
.modern-stat-header { display: flex; justify-content: space-between; margin-bottom: 16px; }
.modern-stat-icon { padding: 8px; border-radius: 0.75rem; background-color: #eef2ff; color: #4f46e5; }
.modern-stat-icon--week { background-color: #ecfdf5; color: #059669; }
.modern-stat-icon--month { background-color: #fff7ed; color: #ea580c; }
.modern-stat-amount { display: flex; align-items: baseline; gap: 4px; margin-bottom: 4px; font-weight: 700; font-size: 28px; }
.modern-stat-footer { display: flex; align-items: center; margin-top: 16px; padding-top: 12px; border-top: 1px solid #f3f4f6; }
.modern-stat-orders-count { width: 24px; height: 24px; border-radius: 999px; background: #f3f4f6; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 12px; }
</style>
