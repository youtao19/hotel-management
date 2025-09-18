<template>
  <q-layout view="lHh Lpr lFf">
    <q-header elevated>
      <q-toolbar>
        <q-toolbar-title>
          酒店管理系统
        </q-toolbar-title>
        <div>
          <q-btn flat to="/" label="仪表盘" />
          <q-btn flat to="/CreateOrder" label="创建订单" />
          <q-btn flat to="/RoomStatus" label="房间状态" />
          <q-btn flat to="/ViewOrders" label="查看订单" />
          <q-btn flat to="/ShiftHandover" label="交接班" />
        </div>
      </q-toolbar>
    </q-header>

    <q-page-container>
      <router-view />
    </q-page-container>
  </q-layout>
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
