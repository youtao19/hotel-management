<template>
  <div class="login-page">
    <div class="login-container">
      <!-- 登录卡片 -->
      <q-card class="login-card q-pa-lg">
        <!-- 酒店管理系统标题和图标 -->
        <div class="text-center q-mb-lg">
          <q-avatar size="80px" class="q-mb-md">
            <q-icon name="hotel" size="60px" color="primary" />
          </q-avatar>
          <div class="text-h4 text-weight-bold text-primary">酒店管理系统</div>
          <div class="text-subtitle1 text-grey-7">员工登录</div>
        </div>
        
        <!-- 登录表单 -->
        <q-form @submit="onSubmit" class="q-gutter-md">
          <!-- 用户名输入框 -->
          <q-input
            v-model="username"
            filled
            type="text"
            label="用户名"
            lazy-rules
            :rules="[val => !!val || '请输入用户名']"
          >
            <template v-slot:prepend>
              <q-icon name="person" />
            </template>
          </q-input>
          
          <!-- 密码输入框 -->
          <q-input
            v-model="password"
            filled
            :type="isPwd ? 'password' : 'text'"
            label="密码"
            lazy-rules
            :rules="[val => !!val || '请输入密码']"
          >
            <template v-slot:prepend>
              <q-icon name="lock" />
            </template>
            <template v-slot:append>
              <q-icon
                :name="isPwd ? 'visibility_off' : 'visibility'"
                class="cursor-pointer"
                @click="isPwd = !isPwd"
              />
            </template>
          </q-input>
          
          <!-- 记住我选项 -->
          <div class="row items-center justify-between">
            <q-checkbox v-model="rememberMe" label="记住我" />
            <q-btn flat dense color="primary" label="忘记密码?" />
          </div>
          
          <!-- 登录按钮 -->
          <q-btn
            type="submit"
            color="primary"
            class="full-width q-py-sm q-mt-md"
            size="lg"
            label="登录"
          />
        </q-form>
        
        <!-- 底部版权信息 -->
        <div class="text-center q-mt-lg text-grey-7 text-caption">
          © 2023 酒店管理系统 版权所有
        </div>
      </q-card>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useQuasar } from 'quasar'
import { useUserStore } from '../stores/userStore'

// 路由实例
const router = useRouter()
// Quasar实例，用于显示通知
const $q = useQuasar()
// 用户存储实例
const userStore = useUserStore()

// 表单数据
const username = ref('')
const password = ref('')
const rememberMe = ref(false)
const isPwd = ref(true)

/**
 * 表单提交处理函数
 */
function onSubmit() {
  // 模拟登录验证
  if (username.value === 'youtao' && password.value === '123') {
    // 更新用户登录状态
    userStore.login({
      username: username.value,
      avatar: 'https://cdn.quasar.dev/img/boy-avatar.png',
      role: '员工'
    })
    
    // 显示登录成功通知
    $q.notify({
      type: 'positive',
      message: '登录成功',
      position: 'top',
      timeout: 1500
    })
    
    // 如果选择了记住我，可以在这里存储登录信息
    if (rememberMe.value) {
      localStorage.setItem('rememberedUser', username.value)
    } else {
      localStorage.removeItem('rememberedUser')
    }
    
    // 登录成功后跳转到仪表盘页面
    setTimeout(() => {
      router.push('/Dash-board')
    }, 1000)
  } else {
    // 显示登录失败通知
    $q.notify({
      type: 'negative',
      message: '用户名或密码错误',
      position: 'top'
    })
  }
}

// 组件挂载时检查是否有记住的用户
if (localStorage.getItem('rememberedUser')) {
  username.value = localStorage.getItem('rememberedUser')
  rememberMe.value = true
}
</script>

<style scoped>
.login-page {
  height: 100vh;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.login-container {
  width: 100%;
  max-width: 450px;
  padding: 20px;
}

.login-card {
  border-radius: 12px;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
}

/* 响应式调整 */
@media (max-width: 599px) {
  .login-container {
    max-width: 90%;
  }
}
</style>
