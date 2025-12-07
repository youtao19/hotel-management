<template>
  <q-table
    :rows="rows"
    :columns="columns"
    row-key="order_id"
    :loading="loading"
    flat
    bordered
  >
    <template #body-cell-actions="props">
      <q-td :props="props">
        <q-btn-group flat>
          <q-btn
            flat
            dense
            color="positive"
            icon="check_circle"
            @click="$emit('positive', props.row)"
          >
            <q-tooltip>已好评</q-tooltip>
          </q-btn>
          <q-btn
            flat
            dense
            color="negative"
            icon="cancel"
            @click="$emit('negative', props.row)"
          >
            <q-tooltip>未好评</q-tooltip>
          </q-btn>
        </q-btn-group>
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

defineEmits(["positive", "negative"]);
</script>
