<template>
  <q-page class="revenue-statistics">
    <div class="q-pa-md">
      <div class="text-h4 q-mb-md text-primary">收入统计</div>

      <QuickStatsCards
        :quick-stats="quickStats"
      />

      <RevenueFilterBar
        v-model:start="dateRange.start"
        v-model:end="dateRange.end"
        v-model:period="selectedPeriod"
        :period-options="periodOptions"
        :current-type="currentFilterType"
        :loading="loading"
        @filter="setFilter"
        @search="fetchMainStats"
      />

      <div class="row q-col-gutter-lg q-mb-lg">
        <div class="col-12 col-lg-4">
          <RoomTypeAnalysis
            :data="displayRoomTypeData"
            :selected-type="selectedRoomType"
            @toggle="toggleRoomType"
            @clear="clearSelectedRoomType"
          />
        </div>
        <div class="col-12 col-lg-8">
          <RevenueTrendAnalysis
            :date-range="dateRange"
            :room-type="selectedRoomType"
            :revenue-data="revenueData"
            :period-label="selectedPeriodLabel"
          />
        </div>
      </div>

      <DetailedBillTable />
    </div>
  </q-page>
</template>

<script setup>
import { onMounted, watch } from 'vue'
import QuickStatsCards from './components/QuickStatsCards.vue'
import RevenueFilterBar from './components/RevenueFilterBar.vue'
import RoomTypeAnalysis from './components/RoomTypeAnalysis.vue'
import RevenueTrendAnalysis from './components/RevenueTrendAnalysis.vue'
import DetailedBillTable from './components/DetailedBillTable.vue'

import { useRevenueFilters } from './composables/useRevenueFilters'
import { useRevenueData } from './composables/useRevenueData'

const {
  dateRange, selectedPeriod, periodOptions, currentFilterType, selectedPeriodLabel,
  setFilterToday, setFilterYesterday, setFilterThisWeek, setFilterThisMonth
} = useRevenueFilters()

const {
  loading, revenueData, displayRoomTypeData, quickStats, selectedRoomType,
  initBaseData, fetchMainStats, toggleRoomType, clearSelectedRoomType
} = useRevenueData(dateRange, selectedPeriod)

// 绑定筛选栏的快捷按钮事件
const setFilter = (type) => {
  if (type === 'today') setFilterToday()
  else if (type === 'yesterday') setFilterYesterday()
  else if (type === 'week') setFilterThisWeek()
  else if (type === 'month') setFilterThisMonth()
}

// 监听日期变化自动刷新（确保“单日”选择后首卡展示所选日期收入）
watch(() => [dateRange.value.start, dateRange.value.end], ([start, end]) => {
  if (start && end) fetchMainStats()
})

// 监听周期变化自动刷新
watch(selectedPeriod, fetchMainStats)

onMounted(async () => {
  await initBaseData()
  await fetchMainStats()
})
</script>

<style scoped>
.revenue-statistics { background-color: #f5f5f5; min-height: 100vh; }
</style>
