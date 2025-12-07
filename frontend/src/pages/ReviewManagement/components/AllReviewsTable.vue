<template>
  <q-table
    :rows="rows"
    :columns="columns"
    row-key="order_id"
    :loading="loading"
    flat
    bordered
  >
    <template #body-cell-review_status="props">
      <q-td :props="props">
        <q-badge
          v-if="props.row.review_invited && props.row.positive_review !== null"
          :color="props.row.positive_review ? 'positive' : 'negative'"
          :label="props.row.positive_review ? '好评' : '未好评'"
        />
        <q-badge
          v-else-if="props.row.review_invited"
          color="warning"
          label="已邀请"
        />
        <q-badge
          v-else
          color="grey"
          label="未邀请"
        />
      </q-td>
    </template>
  </q-table>
</template>

<script setup>
defineProps({
  rows: {
    type: Array,
    required: true
  },
  columns: {
    type: Array,
    required: true
  },
  loading: {
    type: Boolean,
    default: false
  }
});
</script>
