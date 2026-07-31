<template>
  <q-page class="handover-page">
    <div class="handover-root">
      <div class="handover-content-column">
        <MainContent />
      </div>
    </div>
  </q-page>
</template>

<script setup>
import MainContent from "./components/MainContent.vue";
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

.handover-content-column {
  width: 100%;
}

:global(.q-layout:has(.handover-page) .q-page-container) {
  padding-bottom: 0 !important;
}
</style>
