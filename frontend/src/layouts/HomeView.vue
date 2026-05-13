<template>
  <q-layout view="lHh Lpr lFf" class="app-shell">
    <q-header class="app-header">
      <q-toolbar class="header-toolbar">
        <q-btn
          flat
          round
          dense
          icon="menu"
          class="mobile-menu-btn"
          aria-label="打开导航"
          @click="toggleLeftDrawer"
        />

        <div class="header-breadcrumb q-ml-sm" v-if="$q.screen.gt.sm">
          <span class="text-grey-7">管理后台</span>
          <q-icon name="chevron_right" class="q-mx-xs text-grey-5" />
          <span class="text-weight-medium">{{ currentPageTitle }}</span>
        </div>

        <q-space />

        <div class="header-actions q-gutter-sm row items-center">
          <q-btn round flat icon="notifications" size="12px" class="text-grey-7">
            <q-badge floating color="red" rounded size="8px" />
          </q-btn>
          
          <div class="header-user q-ml-md">
            <q-btn v-if="userStore.user.isLoggedIn" flat no-caps class="user-profile-btn">
              <q-avatar size="32px" class="user-avatar">
                <img :src="userStore.user.avatar || 'https://cdn.quasar.dev/img/avatar.png'">
              </q-avatar>
              <div class="q-ml-sm user-name-wrapper" v-if="$q.screen.gt.xs">
                <div class="user-name">{{ userStore.user.username }}</div>
                <div class="user-role">管理员</div>
              </div>
              <q-icon name="expand_more" size="16px" class="q-ml-xs text-grey-6" />
              
              <q-menu
                class="user-dropdown-menu"
                transition-show="jump-down"
                transition-hide="jump-up"
                anchor="bottom right"
                self="top right"
                :offset="[0, 8]"
              >
                <q-list class="user-dropdown-list" style="min-width: 220px;">
                  <div class="q-pa-md bg-grey-1">
                    <div class="row items-center q-gutter-md">
                      <q-avatar size="48px">
                        <img :src="userStore.user.avatar || 'https://cdn.quasar.dev/img/avatar.png'">
                      </q-avatar>
                      <div>
                        <div class="text-weight-bold">{{ userStore.user.username }}</div>
                        <div class="text-caption text-grey-7">admin@hotel.com</div>
                      </div>
                    </div>
                  </div>

                  <q-separator />

                  <q-item clickable v-close-popup class="menu-item q-py-md">
                    <q-item-section avatar>
                      <q-icon name="person_outline" size="20px" />
                    </q-item-section>
                    <q-item-section>个人中心</q-item-section>
                  </q-item>

                  <q-item clickable v-close-popup class="menu-item q-py-md">
                    <q-item-section avatar>
                      <q-icon name="settings_outline" size="20px" />
                    </q-item-section>
                    <q-item-section>系统设置</q-item-section>
                  </q-item>

                  <q-separator />

                  <q-item clickable v-close-popup class="logout-item q-py-md text-negative" @click="showLogoutDialog = true">
                    <q-item-section avatar>
                      <q-icon name="logout" size="20px" />
                    </q-item-section>
                    <q-item-section>退出登录</q-item-section>
                  </q-item>
                </q-list>
              </q-menu>
            </q-btn>
            <q-btn v-else flat label="登录" color="primary" @click="goToLogin" />
          </div>
        </div>
      </q-toolbar>
    </q-header>

    <q-drawer
      v-model="leftDrawerOpen"
      show-if-above
      bordered
      :width="260"
      :mini="miniState"
      :breakpoint="1024"
      class="side-nav"
    >
      <div class="side-brand-container">
        <div class="side-brand">
          <div class="brand-logo bg-primary">
            <q-icon name="hotel" color="white" size="24px" />
          </div>
          <div class="brand-text q-ml-md" v-if="!miniState">
            <div class="brand-title">酒店管家</div>
            <div class="brand-status">
              <span class="status-dot"></span>
              系统运行中
            </div>
          </div>
        </div>
      </div>

      <q-scroll-area class="side-scroll">
        <q-list class="nav-list q-px-md q-mt-sm">
          <q-item
            v-for="item in mainNavItems"
            :key="item.to"
            clickable
            v-ripple
            exact
            :to="item.to"
            active-class="nav-item--active"
            class="nav-item q-mb-xs"
          >
            <q-item-section avatar>
              <q-icon :name="item.icon" size="22px" />
            </q-item-section>
            <q-item-section>
              <q-item-label class="text-weight-medium">{{ item.label }}</q-item-label>
            </q-item-section>
            <div class="active-indicator"></div>
          </q-item>

          <q-expansion-item
            v-model="douyinMenuOpen"
            icon="sync_alt"
            label="抖音管理"
            header-class="nav-group-header"
            expand-icon-class="nav-group-expand"
            class="nav-group q-mb-xs q-mt-sm"
            :class="{ 'nav-group--active': isDouyinRoute }"
          >
            <q-list class="nav-sub-list">
              <q-item
                v-for="item in douyinNavItems"
                :key="item.to"
                clickable
                v-ripple
                exact
                :to="item.to"
                active-class="nav-sub-item--active"
                class="nav-sub-item q-mb-xs"
              >
                <q-item-section avatar>
                  <q-icon :name="item.icon" size="18px" />
                </q-item-section>
                <q-item-section>
                  <q-item-label>{{ item.label }}</q-item-label>
                </q-item-section>
              </q-item>
            </q-list>
          </q-expansion-item>
        </q-list>
      </q-scroll-area>
    </q-drawer>

    <q-page-container class="page-container">
      <transition
        enter-active-class="animated fadeIn"
        leave-active-class="animated fadeOut"
        mode="out-in"
      >
        <router-view />
      </transition>
    </q-page-container>

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

    <LogoutConfirmDialog
      v-model="showLogoutDialog"
      @logout-success="onLogoutSuccess"
    />
  </q-layout>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useQuasar } from 'quasar'
import LogoutConfirmDialog from '../components/LogoutConfirmDialog.vue'
import { useUserStore } from '../stores/userStore'

const userStore = useUserStore()
const router = useRouter()
const route = useRoute()
const $q = useQuasar()

const mainNavItems = [
  { to: '/Dash-board', label: '仪表盘', icon: 'dashboard' },
  { to: '/CreateOrder', label: '创建订单', icon: 'note_add' },
  { to: '/room-status', label: '房间状态', icon: 'meeting_room' },
  { to: '/room-management', label: '房间管理', icon: 'home_work' },
  { to: '/ViewOrders', label: '查看订单', icon: 'receipt_long' },
  { to: '/review-management', label: '好评管理', icon: 'sentiment_satisfied_alt' },
  { to: '/revenue-statistics', label: '收入统计', icon: 'bar_chart' },
  { to: '/handover', label: '交接班', icon: 'swap_horiz' },
  { to: '/other-income', label: '其他收入', icon: 'payments' }
]

const douyinNavItems = [
  { to: '/douyin-room-matching', label: '房型匹配', icon: 'hotel' },
  { to: '/rate-plans', label: '售卖套餐', icon: 'sell' }
]

const leftDrawerOpen = ref(false)
const miniState = ref(false)
const showLoginDialog = ref(false)
const showLogoutDialog = ref(false)
const loginForm = ref({
  username: '',
  password: ''
})

const isDouyinRoute = computed(() => douyinNavItems.some((item) => route.path === item.to))
const douyinMenuOpen = ref(isDouyinRoute.value)

const currentPageTitle = computed(() => {
  const allItems = [...mainNavItems, ...douyinNavItems]
  const current = allItems.find(item => route.path === item.to)
  return current ? current.label : '首页'
})

watch(isDouyinRoute, (active) => {
  if (active) {
    douyinMenuOpen.value = true
  }
})

function toggleLeftDrawer() {
  if ($q.screen.gt.sm) {
    miniState.value = !miniState.value
  } else {
    leftDrawerOpen.value = !leftDrawerOpen.value
  }
}

function goToLogin() {
  router.push('/login')
}

function handleLogin() {}

function onLogoutSuccess() {
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
.app-shell {
  background: #f8fafc;
}

/* --- Header Styles --- */
.app-header {
  background: #ffffff;
  color: #1e293b;
  border-bottom: 1px solid #e2e8f0;
  box-shadow: none;
}

.header-toolbar {
  min-height: 64px;
  padding: 0 24px;
}

.header-breadcrumb {
  display: flex;
  align-items: center;
  font-size: 14px;
}

.user-profile-btn {
  padding: 4px 8px;
  border-radius: 12px;
  transition: all 0.2s ease;
}

.user-profile-btn:hover {
  background: #f1f5f9;
}

.user-name {
  font-size: 14px;
  font-weight: 600;
  color: #1e293b;
  line-height: 1.2;
}

.user-role {
  font-size: 11px;
  color: #64748b;
  font-weight: 500;
}

.user-avatar {
  border: 2px solid #f1f5f9;
}

/* --- Sidebar Styles --- */
:deep(.side-nav) {
  background: #ffffff;
  color: #64748b;
  border-right: 1px solid #e2e8f0 !important;
  transition: all 0.3s cubic-bezier(0.25, 0.8, 0.5, 1);
}

.side-brand-container {
  padding: 24px 12px;
  display: flex;
  justify-content: center;
  transition: padding 0.3s ease;
}

.side-brand {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: #f8fafc;
  border-radius: 16px;
  border: 1px solid #f1f5f9;
  width: 100%;
  transition: all 0.3s ease;
}

/* Mini 模式下的品牌区优化 */
:deep(.q-drawer--mini) .side-brand-container {
  padding: 20px 0;
}

:deep(.q-drawer--mini) .side-brand {
  background: transparent;
  border-color: transparent;
  padding: 0;
  justify-content: center;
}

.brand-logo {
  width: 40px;
  height: 40px;
  min-width: 40px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
  box-shadow: 0 4px 12px rgba(37, 99, 235, 0.2);
}

.brand-title {
  color: #0f172a;
  font-size: 16px;
  font-weight: 700;
  letter-spacing: -0.2px;
  white-space: nowrap;
}

.brand-status {
  font-size: 11px;
  color: #94a3b8;
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 2px;
  white-space: nowrap;
}

.status-dot {
  width: 6px;
  height: 6px;
  background: #10b981;
  border-radius: 50%;
}

.side-scroll {
  height: calc(100% - 110px);
}

.nav-list {
  padding-bottom: 24px;
}

.nav-item {
  border-radius: 12px;
  min-height: 48px;
  color: #64748b;
  margin-bottom: 4px;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  padding: 0 16px;
  position: relative;
}

/* Mini 模式下的导航项居中 */
:deep(.q-drawer--mini) .nav-item {
  padding: 0;
  display: flex;
  justify-content: center;
}

:deep(.q-drawer--mini) .q-item__section--avatar {
  margin: 0;
  padding: 0;
  min-width: 48px;
  display: flex;
  justify-content: center;
}

.nav-item:hover {
  color: #0f172a;
  background: #f1f5f9;
}

.nav-item--active {
  color: #2563eb !important;
  background: #eff6ff !important;
}

.nav-item--active :deep(.q-icon) {
  color: #2563eb;
}

.active-indicator {
  position: absolute;
  left: 0;
  top: 12px;
  bottom: 12px;
  width: 3px;
  background: #2563eb;
  border-radius: 0 4px 4px 0;
  opacity: 0;
  transition: opacity 0.2s ease;
}

/* Mini 模式下隐藏侧边指示条，改用整体背景色块 */
:deep(.q-drawer--mini) .active-indicator {
  display: none;
}

.nav-item--active .active-indicator {
  opacity: 1;
}

.nav-group {
  border-radius: 12px;
}

:deep(.nav-group-header) {
  border-radius: 12px;
  min-height: 48px;
  color: #64748b;
  padding: 0 16px;
}

:deep(.q-drawer--mini) .nav-group-header {
  padding: 0;
  justify-content: center;
}

:deep(.nav-group-header:hover) {
  background: #f1f5f9;
  color: #0f172a;
}

.nav-group--active :deep(.nav-group-header) {
  color: #2563eb;
}

.nav-sub-list {
  padding: 4px 0 4px 12px;
}

.nav-sub-item {
  border-radius: 10px;
  min-height: 40px;
  color: #64748b;
  margin-top: 2px;
}

.nav-sub-item--active {
  color: #2563eb;
  background: #eff6ff !important;
  font-weight: 600;
}

.sidebar-banner {
  border: 1px solid #e2e8f0;
  background: #f8fafc !important;
  color: #64748b !important;
}

.sidebar-banner :deep(.q-icon) {
  color: #3b82f6 !important;
}

/* --- Page Content --- */
.page-container {
  padding-bottom: 24px;
}

/* --- User Dropdown --- */
.user-dropdown-list {
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
}

.menu-item {
  transition: all 0.2s ease;
  font-size: 14px;
}

.menu-item:hover {
  background: #f8fafc;
  color: #1976d2;
}

.logout-item:hover {
  background: #fef2f2;
}

/* --- Utilities --- */
.mobile-menu-btn {
  margin-right: 8px;
  color: #64748b;
}

/* 移除 display: none，让桌面端也能看到菜单按钮 */
@media (min-width: 1025px) {
  /* .mobile-menu-btn {
    display: none;
  } */
}
</style>
