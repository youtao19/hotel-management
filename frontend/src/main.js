import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import { createRouter, createWebHistory } from 'vue-router'
import routes from './router/routes'

// 创建路由实例
const router = createRouter({
  history: createWebHistory(),
  routes
})

// 创建应用实例
const app = createApp(App)

// 创建并使用Pinia
const pinia = createPinia()
app.use(pinia)

// 使用路由
app.use(router)

// 挂载应用
app.mount('#app')
