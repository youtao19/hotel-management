<template>
  <q-page class="handover-page">
    <div class="handover-root row">
      <div class="handover-history-column col-1">
        <HistoryPanel @select-record="handleRecordSelect" />
      </div>
      <div class="handover-content-column col-11">
        <MainContent :selected-record="selectedRecord" />
      </div>
    </div>
  </q-page>
</template>

<script setup>
import { ref } from "vue";
import HistoryPanel from "./components/HistoryPanel.vue";
import MainContent from "./components/MainContent.vue";

const selectedRecord = ref(null);

const handleRecordSelect = (record) => {
  selectedRecord.value = record;
};
</script>

<style scoped>
.handover-page {
  height: calc(100vh - 65px);
  max-height: calc(100vh - 65px);
  min-height: 0;
  overflow: hidden;
}

.handover-root,
.handover-history-column,
.handover-content-column {
  height: 100%;
  min-height: 0;
  overflow: hidden;
}

:global(.q-layout:has(.handover-page) .q-page-container) {
  padding-bottom: 0 !important;
}
</style>
