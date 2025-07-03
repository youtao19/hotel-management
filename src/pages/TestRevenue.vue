<template>
  <q-page class="q-pa-md">
    <h1>收入API测试页面</h1>
    
    <q-btn @click="testQuickStats" color="primary" class="q-mr-md">
      测试快速统计API
    </q-btn>
    
    <q-btn @click="testDailyRevenue" color="secondary" class="q-mr-md">
      测试每日收入API
    </q-btn>
    
    <q-btn @click="testDirectFetch" color="accent">
      直接fetch测试
    </q-btn>
    
    <div class="q-mt-lg">
      <h3>测试结果:</h3>
      <pre>{{ testResult }}</pre>
    </div>
  </q-page>
</template>

<script setup>
import { ref } from 'vue'
import { revenueApi } from '../api/index'

const testResult = ref('')

const testQuickStats = async () => {
  try {
    testResult.value = '正在测试快速统计API...'
    console.log('开始测试快速统计API')
    
    const response = await revenueApi.getQuickStats()
    console.log('快速统计API响应:', response)
    
    testResult.value = JSON.stringify(response.data, null, 2)
  } catch (error) {
    console.error('快速统计API测试失败:', error)
    testResult.value = `错误: ${error.message}\n${error.stack}`
  }
}

const testDailyRevenue = async () => {
  try {
    testResult.value = '正在测试每日收入API...'
    console.log('开始测试每日收入API')
    
    const today = new Date().toISOString().split('T')[0]
    const lastMonth = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    
    const response = await revenueApi.getDailyRevenue(lastMonth, today)
    console.log('每日收入API响应:', response)
    
    testResult.value = JSON.stringify(response.data, null, 2)
  } catch (error) {
    console.error('每日收入API测试失败:', error)
    testResult.value = `错误: ${error.message}\n${error.stack}`
  }
}

const testDirectFetch = async () => {
  try {
    testResult.value = '正在直接fetch测试...'
    console.log('开始直接fetch测试')
    
    const response = await fetch('http://localhost:3000/api/revenue/quick-stats')
    console.log('直接fetch响应状态:', response.status)
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    
    const data = await response.json()
    console.log('直接fetch响应数据:', data)
    
    testResult.value = JSON.stringify(data, null, 2)
  } catch (error) {
    console.error('直接fetch测试失败:', error)
    testResult.value = `错误: ${error.message}\n${error.stack}`
  }
}
</script>
