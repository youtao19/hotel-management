<template>
  <div id="app">
    <router-view />
  </div>
</template>

<script setup>
// 这里可以添加全局逻辑
import { onMounted } from 'vue'

onMounted(() => {
  console.log('应用已加载')
})
</script>

<style>
/* 添加全局样式 */
body {
  margin: 0;
  padding: 0;
  font-family: Arial, sans-serif;
}

#app {
  width: 100%;
  height: 100vh;
}
</style>
