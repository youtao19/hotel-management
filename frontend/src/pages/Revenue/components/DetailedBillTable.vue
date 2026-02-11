<template>
  <q-card>
    <q-card-section>
      <div class="text-h6 q-mb-md">详细收入数据</div>
      <div class="row q-col-gutter-sm q-row-gutter-sm q-mb-md">
        <!-- 单日过滤：沿用历史行为 -->
        <div class="col-12 col-sm-6 col-md-3 col-lg-3">
          <q-input v-model="filters.date" label="日期" dense outlined type="date" clearable />
        </div>
        <!-- 基础检索 -->
        <div class="col-12 col-sm-6 col-md-3 col-lg-3">
          <q-input v-model="filters.roomNumber" label="房号" dense outlined clearable />
        </div>
        <div class="col-12 col-sm-6 col-md-3 col-lg-3">
          <q-input v-model="filters.orderId" label="订单号" dense outlined clearable />
        </div>
        <div class="col-12 col-sm-6 col-md-3 col-lg-3">
          <q-input v-model="filters.guestName" label="客人名" dense outlined clearable />
        </div>
        <!-- 业务字段筛选 -->
        <div class="col-12 col-sm-6 col-md-3 col-lg-3">
          <q-select
            v-model="filters.payWay"
            :options="payWayOptions"
            label="支付方式"
            dense
            outlined
            clearable
          />
        </div>
        <div class="col-12 col-sm-6 col-md-3 col-lg-3">
          <q-select
            v-model="filters.changeType"
            :options="changeTypeOptions"
            label="账单类型"
            dense
            outlined
            clearable
          />
        </div>
        <!-- 操作按钮 -->
        <div class="col-12 col-lg-auto row items-center q-gutter-sm">
          <q-btn label="查询" color="primary" @click="search" :loading="loading" />
          <q-btn label="重置" flat @click="resetFilters" />
        </div>
      </div>
      <q-table
        :rows="rows"
        :columns="columns"
        :loading="loading"
        flat
        bordered
        row-key="bill_id"
      />
    </q-card-section>
  </q-card>
</template>

<script setup>
import { onMounted } from 'vue'
import { useDetailedBills } from '../composables/useDetailedBills'

const {
  rows,
  loading,
  filters,
  columns,
  payWayOptions,
  changeTypeOptions,
  fetchData,
  resetFilters,
  hasSearched
} = useDetailedBills()

// 触发“查询”后才将当前筛选条件应用到后端接口。
const search = () => {
  hasSearched.value = true
  fetchData()
}
onMounted(fetchData)
</script>
