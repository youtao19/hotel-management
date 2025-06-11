<template>
    <!-- 主布局容器，hHh lpR fFf 是 Quasar 布局视图配置 -->
    <q-layout view="hHh lpR fFf">

      <!-- 页面顶部导航栏 -->
      <q-header elevated class="bg-primary text-white q-pa-none">
        <!-- 工具栏部分 -->
        <q-toolbar class="q-pa-none">
          <!-- 左侧菜单按钮 -->
          <!-- <q-btn dense flat round icon="menu" @click="toggleLeftDrawer" /> -->

          <!-- 标题部分 -->
          <q-toolbar-title>
            <q-avatar>
              <img src="https://cdn.quasar.dev/logo-v2/svg/logo-mono-white.svg">
            </q-avatar>
            酒店管理系统
          </q-toolbar-title>

          <!-- 用户信息显示区域 -->
          <div class="q-ml-md">
            <q-btn v-if="userStore.user.isLoggedIn" flat no-caps>
              <q-avatar size="28px">
                <img :src="userStore.user.avatar">
              </q-avatar>
              <div class="q-ml-sm">{{ userStore.user.username }}</div>
              <q-menu>
                <q-list style="min-width: 100px">
                  <q-item clickable v-close-popup @click="userStore.logout">
                    <q-item-section>登出</q-item-section>
                  </q-item>
                  <q-item clickable v-close-popup>
                    <q-item-section>个人设置</q-item-section>
                  </q-item>
                </q-list>
              </q-menu>
            </q-btn>
            <q-btn v-else flat label="登录" @click="goToLogin" />
          </div>

          <!-- 右侧菜单按钮 -->
          <!-- <q-btn dense flat round icon="menu" @click="toggleRightDrawer" /> -->
        </q-toolbar>

        <!-- 导航标签栏 -->
        <q-tabs align="left" dense>
          <q-route-tab to="/Dash-board" label="仪表盘" />
          <q-route-tab to="/CreateOrder" label="创建订单" />
          <q-route-tab to="/room-status" label="房间状态" />
          <q-route-tab to="/ViewOrders" label="查看订单" />
          <q-route-tab to="/shift-handover" label="交接班" />
        </q-tabs>
      </q-header>

      <!-- 左侧抽屉菜单 -->
      <!-- <q-drawer show-if-above v-model="leftDrawerOpen" side="left" bordered>
        <q-list>
            <q-item>
                <q-item-section>
                    <q-item-label>
                        <q-icon name="dashboard" />
                        仪表盘
                        </q-item-label>
                </q-item-section>
            </q-item>
        </q-list>
      </q-drawer> -->

      <!-- 右侧抽屉菜单 -->
      <!-- <q-drawer show-if-above v-model="rightDrawerOpen" side="right" bordered> -->
        <!-- drawer content -->
      <!-- </q-drawer> -->

      <!-- 页面内容容器 -->
      <q-page-container class="q-pa-none">
        <!-- 路由视图，根据当前路由显示不同组件 -->
        <router-view />
      </q-page-container>

      <!-- 登录对话框 -->
      <q-dialog v-model="showLoginDialog">
        <q-card style="min-width: 350px">
          <q-card-section>
            <div class="text-h6">用户登录</div>
          </q-card-section>

          <q-card-section>
            <q-input v-model="loginForm.username" label="用户名" :dense="true" />
            <q-input v-model="loginForm.password" label="密码" type="password" :dense="true" class="q-mt-sm" />
          </q-card-section>

          <q-card-actions align="right">
            <q-btn flat label="取消" color="primary" v-close-popup />
            <q-btn flat label="登录" color="primary" @click="handleLogin" v-close-popup />
          </q-card-actions>
        </q-card>
      </q-dialog>

    </q-layout>
  </template>

<script setup>
// 导入 Vue 的响应式 API
import { ref } from 'vue'
// 导入用户 store
import { useUserStore } from '../stores/userStore'
// 导入路由
import { useRouter } from 'vue-router'

// 初始化用户 store
const userStore = useUserStore()
// 初始化路由
const router = useRouter()

// 定义左侧抽屉菜单的状态（默认关闭）
const leftDrawerOpen = ref(false)
// 定义右侧抽屉菜单的状态（默认关闭）
const rightDrawerOpen = ref(false)
// 控制登录对话框显示状态
const showLoginDialog = ref(false)
// 登录表单数据
const loginForm = ref({
  username: '',
  password: ''
})

/**
 * 切换左侧抽屉菜单的开关状态
 */
function toggleLeftDrawer() {
  leftDrawerOpen.value = !leftDrawerOpen.value
}

/**
 * 切换右侧抽屉菜单的开关状态
 */
function toggleRightDrawer() {
  rightDrawerOpen.value = !rightDrawerOpen.value
}

/**
 * 跳转到登录页面
 */
function goToLogin() {
  router.push('/login')
}

/**
 * 处理用户登录
 */
function handleLogin() {
  // 这里应该有验证逻辑和后端API调用
  // 为了演示，直接使用表单数据登录
  if (loginForm.value.username) {
    userStore.login({
      username: loginForm.value.username,
      avatar: 'https://cdn.quasar.dev/img/boy-avatar.png',
      role: '管理员'
    })

    // 重置表单
    loginForm.value = {
      username: '',
      password: ''
    }
  }
}
</script>
