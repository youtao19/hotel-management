<template>
  <q-card>
    <q-card-section>
      <div class="text-h6 q-mb-md">详细收入数据</div>
      <div class="row q-gutter-sm q-mb-md">
        <q-input v-model="filters.date" label="日期" dense outlined type="date" style="width: 150px" />
        <q-input v-model="filters.roomNumber" label="房号" dense outlined style="width: 100px" />
        <q-btn label="查询" color="primary" @click="search" :loading="loading" />
        <q-btn label="重置" flat @click="resetFilters" />
      </div>
      <q-table :rows="rows" :columns="columns" :loading="loading" flat />
    </q-card-section>
  </q-card>
</template>

<script setup>
import { onMounted } from 'vue'
import { useDetailedBills } from '../composables/useDetailedBills'

const { rows, loading, filters, columns, fetchData, resetFilters, hasSearched } = useDetailedBills()

const search = () => {
  hasSearched.value = true
  fetchData()
}
onMounted(fetchData)
</script>
