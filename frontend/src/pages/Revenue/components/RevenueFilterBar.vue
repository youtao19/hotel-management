<template>
  <q-card flat bordered class="q-mb-lg">
    <q-card-section>
      <div class="row q-col-gutter-md items-end">
        <div class="col-lg-3 col-md-4 col-sm-6 col-xs-12">
          <q-input :model-value="start" @update:model-value="$emit('update:start', $event)" type="date" label="开始日期" outlined dense />
        </div>
        <div class="col-lg-3 col-md-4 col-sm-6 col-xs-12">
          <q-input :model-value="end" @update:model-value="$emit('update:end', $event)" type="date" label="结束日期" outlined dense />
        </div>
        <div class="col-lg-2 col-md-4 col-sm-6 col-xs-12">
          <q-select :model-value="period" @update:model-value="$emit('update:period', $event)" :options="periodOptions" label="统计周期" outlined dense emit-value map-options />
        </div>
        <div class="col-lg-4 col-md-12 col-sm-12 col-xs-12">
          <div class="row items-center justify-end q-gutter-sm filter-actions-row">
            <div class="col-auto">
              <div class="date-filter-group">
                <div v-for="type in ['today', 'yesterday', 'week', 'month']" :key="type"
                     class="date-filter-item"
                     :class="{ 'active': currentType === type }"
                     @click="$emit('filter', type)">
                  {{ typeName(type) }}
                </div>
              </div>
            </div>
            <div class="col-auto">
              <q-btn color="primary" icon="search" label="查询" @click="$emit('search')" :loading="loading" unelevated />
            </div>
          </div>
        </div>
      </div>
    </q-card-section>
  </q-card>
</template>

<script setup>
defineProps(['start', 'end', 'period', 'periodOptions', 'currentType', 'loading'])
defineEmits(['update:start', 'update:end', 'update:period', 'filter', 'search'])

const typeName = (t) => ({ today: '今日', yesterday: '昨日', week: '本周', month: '本月' }[t])
</script>

<style scoped>
.date-filter-group {
  display: flex; align-items: center; background-color: #fff;
  border: 1px solid #e2e8f0; border-radius: 12px; padding: 4px;
}
.date-filter-item {
  padding: 6px 16px; font-size: 14px; font-weight: 500; color: #64748b;
  cursor: pointer; border-radius: 8px; transition: all 0.2s;
}
.date-filter-item:hover { color: #0f172a; background-color: #f8fafc; }
.date-filter-item.active { background-color: #eef2ff; color: #4f46e5; font-weight: 600; }
</style>
