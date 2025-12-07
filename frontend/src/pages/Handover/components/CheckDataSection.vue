<template>
  <div class="data-check-section q-mb-lg">
    <div class="section-header row items-center justify-between q-mb-sm">
      <div class="text-subtitle1 text-weight-medium">{{ title }}</div>
      <q-btn
        size="sm"
        color="positive"
        outline
        icon="done_all"
        label="一键确认"
        @click="$emit('confirm-all')"
        :disable="rows.length === 0 || rows.every(item => item.confirmed)"
      >
        <q-tooltip>确认所有记录</q-tooltip>
      </q-btn>
    </div>

    <div v-if="rows.length === 0" class="no-data-hint q-pa-md text-center">
      <q-icon name="info" size="32px" color="grey-5" />
      <div class="text-body2 text-grey-6 q-mt-sm">{{ emptyText }}</div>
    </div>

    <q-table
      v-else
      :rows="rows"
      :columns="columns"
      row-key="billId"
      flat
      bordered
      hide-pagination
      :pagination="{ rowsPerPage: 0 }"
      class="data-check-table"
    >
      <template #body-cell-actions="props">
        <q-td :props="props" class="text-center">
          <q-btn
            size="sm"
            round
            dense
            color="positive"
            icon="check"
            @click="$emit('confirm-row', props.row)"
            :disable="props.row.confirmed"
          >
            <q-tooltip>确认数据无误</q-tooltip>
          </q-btn>
        </q-td>
      </template>
      <template #body-cell-billId="props">
        <q-td :props="props">
          <span :class="props.row.confirmed ? 'text-positive' : ''">
            {{ props.value }}
          </span>
        </q-td>
      </template>
    </q-table>

    <div class="summary-row q-pa-md bg-grey-1">
      <div class="text-weight-medium">
        <div class="row items-center q-mb-xs">
          <div class="col-2">汇总</div>
          <div class="col">
            <span v-for="(amount, type) in summary.byType" :key="type" class="q-mr-md">
              {{ type }}: ¥{{ amount.toFixed(2) }}
            </span>
          </div>
          <div class="col-auto text-primary text-h6">
            合计: ¥{{ summary.totalAmount.toFixed(2) }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
defineProps({
  title: {
    type: String,
    required: true
  },
  rows: {
    type: Array,
    required: true
  },
  columns: {
    type: Array,
    required: true
  },
  summary: {
    type: Object,
    required: true
  },
  emptyText: {
    type: String,
    default: "暂无数据"
  }
});

defineEmits(["confirm-row", "confirm-all"]);
</script>

<style scoped>
.data-check-table :deep(.q-table__bottom) {
  display: none;
}

.data-check-table :deep(th),
.data-check-table :deep(td) {
  text-align: center;
}
</style>
