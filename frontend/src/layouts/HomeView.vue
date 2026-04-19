<template>
    <!-- 主布局容器，lHh Lpr lFf 是 Quasar 布局视图配置 -->
    <q-layout view="lhh Lpr lFf">

      <!-- 页面顶部导航栏 -->
      <q-header elevated class="bg-primary text-white">
        <!-- 顶部单行导航：系统标题、功能导航和用户区保持在同一行 -->
        <q-toolbar class="header-toolbar">
          <!-- 左侧菜单按钮 -->
          <!-- <q-btn dense flat round icon="menu" @click="toggleLeftDrawer" /> -->

          <!-- 标题部分 -->
          <div class="header-brand">
            <q-avatar>
              <img src="/favicon.ico">
            </q-avatar>
            <div class="header-brand__title">酒店管理系统</div>
          </div>

          <!-- 中间导航标签区域 -->
          <q-tabs class="header-tabs" align="left" dense inline-label>
            <q-route-tab to="/Dash-board" label="仪表盘" icon="dashboard" />
            <q-route-tab to="/CreateOrder" label="创建订单" icon="note_add" />
            <q-route-tab to="/room-status" label="房间状态" icon="meeting_room" />
            <q-route-tab to="/room-management" label="房间管理" icon="home_work" />
            <q-route-tab to="/ViewOrders" label="查看订单" icon="receipt_long" />
            <q-route-tab to="/review-management" label="好评管理" icon="sentiment_satisfied_alt" />
            <q-route-tab to="/revenue-statistics" label="收入统计" icon="bar_chart" />
            <q-route-tab to="/handover" label="交接班" icon="swap_horiz" />
            <q-route-tab to="/other-income" label="其他收入" icon="payments" />
          </q-tabs>

          <!-- 用户信息显示区域 -->
          <div class="header-user">
            <q-btn v-if="userStore.user.isLoggedIn" flat no-caps class="user-profile-btn">
              <q-avatar size="28px" class="user-avatar">
                <img :src="userStore.user.avatar">
              </q-avatar>
              <div class="q-ml-sm user-name">{{ userStore.user.username }}</div>
              <!-- <q-icon name="keyboard_arrow_down" size="18px" class="q-ml-xs" /> -->
              <q-menu
                class="user-dropdown-menu"
                transition-show="jump-down"
                transition-hide="jump-up"
                anchor="bottom right"
                self="top right"
                :offset="[0, 8]"
              >
                <q-list class="user-dropdown-list" style="min-width: 200px; border-radius: 12px; overflow: hidden;">
                  <!-- 用户信息头部 -->
                  <q-item class="user-info-header">
                    <q-item-section avatar>
                      <q-avatar size="40px">
                        <img :src="userStore.user.avatar">
                      </q-avatar>
                    </q-item-section>
                    <q-item-section>
                      <q-item-label class="text-weight-bold">{{ userStore.user.username }}</q-item-label>
                      <q-item-label caption class="text-grey-6">在线</q-item-label>
                    </q-item-section>
                  </q-item>

                  <q-separator class="q-my-sm" />

                  <!-- 菜单项 -->
                  <q-item clickable v-close-popup class="menu-item">
                    <q-item-section avatar>
                      <q-icon name="person" color="primary" />
                    </q-item-section>
                    <q-item-section>
                      <q-item-label>个人资料</q-item-label>
                      <q-item-label caption class="text-grey-6">查看和编辑个人信息</q-item-label>
                    </q-item-section>
                  </q-item>

                  <q-item clickable v-close-popup class="menu-item">
                    <q-item-section avatar>
                      <q-icon name="settings" color="primary" />
                    </q-item-section>
                    <q-item-section>
                      <q-item-label>账户设置</q-item-label>
                      <q-item-label caption class="text-grey-6">管理账户偏好设置</q-item-label>
                    </q-item-section>
                  </q-item>

                  <q-separator class="q-my-sm" />

                  <q-item clickable v-close-popup @click="showLogoutDialog = true" class="logout-item">
                    <q-item-section avatar>
                      <q-icon name="logout" color="negative" />
                    </q-item-section>
                    <q-item-section>
                      <q-item-label class="text-negative">安全退出</q-item-label>
                      <q-item-label caption class="text-grey-6">退出当前登录</q-item-label>
                    </q-item-section>
                  </q-item>
                </q-list>
              </q-menu>
            </q-btn>
            <q-btn v-else flat label="登录" @click="goToLogin" />
          </div>

          <!-- 右侧菜单按钮 -->
          <!-- <q-btn dense flat round icon="menu" @click="toggleRightDrawer" /> -->
        </q-toolbar>
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
      <!-- <q-drawer show-if-above v-model="rightDrawerOpen" side="right" bordered>
        drawer content
      </q-drawer> -->

      <!-- 页面内容容器 -->
      <q-page-container>
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

      <!-- 登出确认对话框 -->
      <LogoutConfirmDialog
        v-model="showLogoutDialog"
        @logout-success="onLogoutSuccess"
      />

    </q-layout>
  </template>

<script setup>
// 导入 Vue 的响应式 API
import { ref } from 'vue'
// 导入用户 store
import { useUserStore } from '../stores/userStore'
// 导入路由
import { useRouter } from 'vue-router'
// 导入Quasar
import { useQuasar } from 'quasar'
// 导入登出确认对话框组件
import LogoutConfirmDialog from '../components/LogoutConfirmDialog.vue'

// 初始化用户 store
const userStore = useUserStore()
// 初始化路由
const router = useRouter()
// 初始化Quasar
const $q = useQuasar()

// 定义左侧抽屉菜单的状态（默认关闭）
const leftDrawerOpen = ref(false)
// 定义右侧抽屉菜单的状态（默认关闭）
const rightDrawerOpen = ref(false)
// 控制登录对话框显示状态
const showLoginDialog = ref(false)
// 控制登出确认对话框显示状态
const showLogoutDialog = ref(false)
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
}

/**
 * 处理登出成功事件
 */
function onLogoutSuccess() {
  // 显示登出成功的额外反馈
  $q.notify({
    type: 'info',
    message: '期待您的再次光临！',
    icon: 'waving_hand',
    position: 'center',
    timeout: 2000
  })
}
</script>

<style scoped>
/* 顶部工具栏保持单行布局，避免标题、导航和用户区拆成两行 */
.header-toolbar {
  gap: 12px;
  min-height: 64px;
  padding: 0 16px;
}

/* 左侧品牌区保留原有图标和标题文案 */
.header-brand {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
}

.header-brand__title {
  font-size: 20px;
  font-weight: 500;
  white-space: nowrap;
}

/* 导航标签占据中间主要空间，维持原有功能入口不变 */
.header-tabs {
  flex: 1;
  min-width: 0;
}

.header-tabs :deep(.q-tabs__content) {
  justify-content: flex-start;
  flex-wrap: nowrap;
}

.header-tabs :deep(.q-tab) {
  min-height: 64px;
  padding: 0 14px;
}

.header-more {
  flex-shrink: 0;
  min-height: 40px;
}

/* 右侧用户区固定在工具栏末端 */
.header-user {
  flex-shrink: 0;
  margin-left: auto;
}

/* 用户下拉菜单样式 */
.user-dropdown-menu :deep(.q-menu) {
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15);
  border: 1px solid rgba(0, 0, 0, 0.08);
}

.user-dropdown-list {
  padding: 8px 0;
  background: white;
}

/* 用户信息头部样式 */
.user-info-header {
  padding: 16px 20px 12px;
  background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
  border-bottom: 1px solid rgba(0, 0, 0, 0.08);
  margin-bottom: 4px;
}

.user-info-header :deep(.q-item__section--avatar) {
  min-width: 48px;
}

/* 菜单项样式 */
.menu-item {
  padding: 12px 20px;
  transition: all 0.2s ease;
  border-radius: 0;
}

.menu-item:hover {
  background-color: #f8f9fa;
  transform: translateX(4px);
}

.menu-item :deep(.q-item__section--avatar) {
  min-width: 40px;
}

.menu-item :deep(.q-icon) {
  font-size: 20px;
}

/* 退出项特殊样式 */
.logout-item {
  padding: 12px 20px;
  transition: all 0.2s ease;
  border-radius: 0;
}

.logout-item:hover {
  background-color: #fff5f5;
  transform: translateX(4px);
}

.logout-item :deep(.q-item__section--avatar) {
  min-width: 40px;
}

.logout-item :deep(.q-icon) {
  font-size: 20px;
}

/* 分割线样式 */
.user-dropdown-list :deep(.q-separator) {
  margin: 8px 16px;
  background-color: rgba(0, 0, 0, 0.08);
}

/* 用户按钮样式 */
.user-profile-btn {
  padding: 8px 12px;
  border-radius: 8px;
  transition: all 0.2s ease;
}

.user-profile-btn:hover {
  background-color: rgba(255, 255, 255, 0.1);
  transform: translateY(-1px);
}

.user-avatar {
  border: 2px solid rgba(255, 255, 255, 0.3);
  transition: all 0.2s ease;
}

.user-profile-btn:hover .user-avatar {
  border-color: rgba(255, 255, 255, 0.6);
  transform: scale(1.05);
}

.user-name {
  color: white;
  font-weight: 500;
  transition: all 0.2s ease;
}

.user-profile-btn:hover .user-name {
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
}

/* 响应式调整 */
@media (max-width: 599px) {
  .header-toolbar {
    flex-wrap: wrap;
    padding-top: 8px;
    padding-bottom: 8px;
  }

  .header-brand {
    width: 100%;
  }

  .header-tabs {
    order: 3;
    width: 100%;
  }

  .header-more {
    order: 2;
    margin-left: auto;
  }

  .header-tabs :deep(.q-tab) {
    min-height: 48px;
  }

  .header-user {
    margin-left: 0;
  }

  .user-dropdown-list {
    min-width: 180px !important;
  }

  .menu-item,
  .logout-item,
  .user-info-header {
    padding-left: 16px;
    padding-right: 16px;
  }
}
</style>
