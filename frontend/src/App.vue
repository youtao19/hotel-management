<template>
  <div id="q-app">
    <router-view />
  </div>
</template>

<script setup>
// 这里可以添加全局逻辑
import { onMounted } from 'vue'
import { useUserStore } from 'src/stores/userStore'

const userStore = useUserStore()

onMounted(async () => {
  console.log('应用已加载')
  // 初始化用户状态，检查是否有持久化的登录状态
  try {
    await userStore.initialize()
    console.log('用户状态初始化完成')
  } catch (error) {
    console.log('用户状态初始化失败:', error)
  }
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
