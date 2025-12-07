<template>
  <div class="check-data-container">
    <div v-if="loading" class="loading-container">
      <q-spinner-dots color="primary" size="50px" />
      <div class="text-body1 text-grey-7 q-mt-md">正在加载账单数据...</div>
    </div>

    <q-card v-else flat bordered>
      <q-card-section>
        <div class="row items-center justify-between q-mb-md q-gutter-sm header-bar">
          <div class="text-h6 row items-center no-wrap">
            <q-icon name="fact_check" color="primary" class="q-mr-sm" />
            <span>请核对交接数据</span>
          </div>
          <q-input
            :model-value="selectedDate"
            type="date"
            dense
            outlined
            label="账单日期"
            class="date-picker-input"
            @update:model-value="$emit('update:date', $event)"
          >
            <template #prepend>
              <q-icon name="event" />
            </template>
          </q-input>
        </div>

        <SectionBlock
          title="客房数据"
          :rows="rowsHotel"
          :columns="columns"
          :summary="hotelSummary"
          empty-text="今日暂无客房账单数据"
          @confirm-all="$emit('confirm-all', 'hotel')"
          @confirm-row="row => $emit('confirm-row', { row, type: 'hotel' })"
        />

        <SectionBlock
          title="休息房数据"
          :rows="rowsRest"
          :columns="columns"
          :summary="restSummary"
          empty-text="今日暂无休息房账单数据"
          @confirm-all="$emit('confirm-all', 'rest')"
          @confirm-row="row => $emit('confirm-row', { row, type: 'rest' })"
        />

        <SectionBlock
          title="租车收入"
          :rows="rowsCar"
          :columns="columns"
          :summary="carSummary"
          empty-text="今日暂无租车收入数据"
          @confirm-all="$emit('confirm-all', 'car')"
          @confirm-row="row => $emit('confirm-row', { row, type: 'car' })"
        />

        <div class="text-center">
          <q-btn
            :color="dataCheckCompleted ? 'grey-6' : 'positive'"
            :icon="dataCheckCompleted ? 'check_circle' : 'verified'"
            :label="dataCheckCompleted ? '数据核对已完成' : '确认核对'"
            size="md"
            @click="$emit('confirm-data')"
            :loading="confirming"
            :disable="confirming || !allDataConfirmed || dataCheckCompleted"
          />
        </div>
      </q-card-section>
    </q-card>
  </div>
</template>

<script setup>
import SectionBlock from "./CheckDataSection.vue";

defineProps({
  selectedDate: {
    type: String,
    required: true
  },
  columns: {
    type: Array,
    required: true
  },
  rowsHotel: {
    type: Array,
    required: true
  },
  rowsRest: {
    type: Array,
    required: true
  },
  rowsCar: {
    type: Array,
    required: true
  },
  hotelSummary: {
    type: Object,
    required: true
  },
  restSummary: {
    type: Object,
    required: true
  },
  carSummary: {
    type: Object,
    required: true
  },
  loading: {
    type: Boolean,
    default: false
  },
  confirming: {
    type: Boolean,
    default: false
  },
  dataCheckCompleted: {
    type: Boolean,
    default: false
  },
  allDataConfirmed: {
    type: Boolean,
    default: false
  }
});

defineEmits(["update:date", "confirm-row", "confirm-all", "confirm-data"]);
</script>

<style scoped>
.check-data-container {
  width: 100%;
}

.loading-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 0;
}

.header-bar {
  gap: 12px;
}
</style>
