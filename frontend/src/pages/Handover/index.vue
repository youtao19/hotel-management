<template>
  <q-page class="handover-page">
    <div class="row full-height">
      <div class="col-1">
        <HistoryPanel @select-record="handleRecordSelect" />
      </div>
      <div class="col-11">
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
  height: 100vh;
  overflow: hidden;
}
</style>
