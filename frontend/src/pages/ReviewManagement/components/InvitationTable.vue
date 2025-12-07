<template>
  <div>
    <div class="q-mb-md">
      <q-banner class="bg-blue-1 text-blue-9" dense>
        <template #avatar>
          <q-icon name="info" color="blue" />
        </template>
        显示昨天和今天已入住的客户，可以邀请他们进行好评。如果列表为空，说明昨天和今天没有新入住的客户。
      </q-banner>
    </div>

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
          <q-btn
            flat
            round
            dense
            color="positive"
            icon="send"
            @click="$emit('invite', props.row)"
          >
            <q-tooltip>邀请好评</q-tooltip>
          </q-btn>
        </q-td>
      </template>
    </q-table>
  </div>
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

defineEmits(["invite"]);
</script>
