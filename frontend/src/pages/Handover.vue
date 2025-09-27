<template>
  <q-page class="handover-page">
    <div class="row full-height">
      <!-- 左侧历史记录区域 (1/12) -->
      <div class="col-1">
        <HistoryPanel @select-record="handleRecordSelect" />
      </div>

      <!-- 右侧主要内容区域 (11/12) -->
      <div class="col-11">
        <MainContent :selectedRecord="selectedRecord" />
      </div>
    </div>
  </q-page>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import HistoryPanel from 'components/handover/HistoryPanel.vue'
import MainContent from 'components/handover/MainContent.vue'

// 选中的记录
const selectedRecord = ref(null)

// 处理记录选择
const handleRecordSelect = (record) => {
  console.log('Handover page - Record selected:', record)
  selectedRecord.value = record
}

// 生命周期钩子
onMounted(() => {
  console.log('Handover page mounted - Container component')
})
</script>

<style scoped>
.handover-page {
  height: 100vh;
  overflow: hidden; /* 取消页面级别的滚动条 */
}
</style>
