<template>
    <div class="register-page">
      <div class="register-container">
        <!-- 注册卡片 -->
        <q-card class="register-card q-pa-lg">
          <!-- 酒店管理系统标题和图标 -->
          <div class="text-center q-mb-lg">
            <q-avatar size="80px" class="q-mb-md">
              <q-icon name="person_add" size="60px" color="primary" /> <!-- 使用注册图标 -->
            </q-avatar>
            <div class="text-h4 text-weight-bold text-primary">酒店管理系统</div>
            <div class="text-subtitle1 text-grey-7">新员工注册</div>
          </div>

          <!-- 注册表单 -->
          <q-form @submit="onSubmit" class="q-gutter-md">
            <!-- 用户名输入框 -->
            <q-input
              v-model="name"
              filled
              type="text"
              label="姓名/用户名"
              lazy-rules
              :rules="[val => !!val || '请输入姓名或用户名']"
            >
              <template v-slot:prepend>
                <q-icon name="badge" />
              </template>
            </q-input>

            <!-- 邮箱输入框 -->
            <q-input
              v-model="email"
              filled
              type="email"
              label="邮箱地址"
              lazy-rules
              :rules="[
                val => !!val || '请输入邮箱地址',
                val => /.+@.+\..+/.test(val) || '请输入有效的邮箱地址'
              ]"
            >
              <template v-slot:prepend>
                <q-icon name="email" />
              </template>
            </q-input>

            <!-- 密码输入框 -->
            <q-input
              v-model="password"
              filled
              :type="isPwd ? 'password' : 'text'"
              label="密码"
              lazy-rules
              :rules="[
                val => !!val || '请输入密码',
                val => val.length >= 6 || '密码长度至少为 6 位' // 添加最小长度规则
              ]"
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

             <!-- 确认密码输入框 -->
            <q-input
              v-model="confirmPassword"
              filled
              :type="isConfirmPwd ? 'password' : 'text'"
              label="确认密码"
              lazy-rules
              :rules="[
                val => !!val || '请再次输入密码',
                val => val === password || '两次输入的密码不一致'
              ]"
            >
              <template v-slot:prepend>
                <q-icon name="lock_outline" />
              </template>
               <template v-slot:append>
                <q-icon
                  :name="isConfirmPwd ? 'visibility_off' : 'visibility'"
                  class="cursor-pointer"
                  @click="isConfirmPwd = !isConfirmPwd"
                />
              </template>
            </q-input>

            <!-- 注册按钮 -->
            <q-btn
              type="submit"
              color="primary"
              class="full-width q-py-sm q-mt-md"
              size="lg"
              label="注册"
            />
          </q-form>

           <!-- 返回登录链接 -->
          <div class="text-center q-mt-md">
            <q-btn flat dense color="primary" label="已有账户？前往登录" @click="goToLogin" />
          </div>

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
  import axios from 'axios'

  // 路由实例
  const router = useRouter()
  // Quasar实例，用于显示通知
  const $q = useQuasar()

  // 表单数据
  const name = ref('')
  const email = ref('')
  const password = ref('')
  const confirmPassword = ref('') // 新增确认密码
  const isPwd = ref(true)
  const isConfirmPwd = ref(true) // 控制确认密码可见性

/**
 * 表单提交处理函数 - 处理注册逻辑
 */
 async function onSubmit() {
  let isSubmitting = true; // 本地变量用于跟踪提交状态

  try {
    console.log('开始注册请求...');

    // 前端再次验证
    if (!name.value || !email.value || !password.value || !confirmPassword.value) {
      $q.notify({
        type: 'negative',
        message: '请填写所有必填字段',
        position: 'top'
      });
      return;
    }

    if (password.value !== confirmPassword.value) {
      $q.notify({
        type: 'negative',
        message: '两次输入的密码不一致',
        position: 'top'
      });
      return;
    }

    // 调用后端注册 API
    console.log('表单数据:', { name: name.value, email: email.value, pw: password.value });

    // 检查是否存在此邮箱
    const checkResponse = await fetch('/check-email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email: email.value })
    }).catch(() => null);

    if (checkResponse && checkResponse.status === 409) {
      $q.notify({
        type: 'negative',
        message: '该邮箱已被注册',
        position: 'top'
      });
      return;
    }

    // 由于后端可能尚未完全配置好，我们将使用模拟注册流程
    // 在实际实现中，应替换为真实的API调用
    localStorage.setItem('justRegistered', 'true');
    localStorage.setItem('registeredEmail', email.value);
    localStorage.setItem('registeredName', name.value);

    // 存储用户信息到本地，模拟注册功能
    let users = JSON.parse(localStorage.getItem('users') || '[]');
    users.push({
      id: Date.now(),
      name: name.value,
      email: email.value,
      password: password.value // 实际系统中应使用加密存储
    });
    localStorage.setItem('users', JSON.stringify(users));

    // 显示注册成功通知
    $q.notify({
      type: 'positive',
      message: '注册成功！正在跳转到登录页面...',
      position: 'top',
      timeout: 2500
    });

    // 注册成功后跳转到登录页面
    setTimeout(() => {
      router.push('/login');
    }, 1500);

  } catch (error) {
    isSubmitting = false;

    console.error('注册请求失败:', error);
    // 更详细地打印错误信息
    if (error.response) {
      console.error('错误响应数据:', error.response.data);
      console.error('错误状态码:', error.response.status);
    } else if (error.request) {
      console.error('请求已发送但未收到响应:', error.request);
    } else {
      console.error('请求设置过程中出错:', error.message);
    }

    let errorMessage = '注册失败，请稍后重试';

    $q.notify({
      type: 'negative',
      message: errorMessage,
      position: 'top',
      timeout: 3000
    });
  }
}

  /**
   * 跳转到登录页面
   */
  function goToLogin() {
    router.push('/login') // 假设登录页路由为 '/login'
  }

  </script>

  <style scoped>
  /* 复制 Login.vue 的样式并调整类名 */
  .register-page {
    height: 100vh;
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  }

  .register-container {
    width: 100%;
    max-width: 480px; /* 可以比登录稍宽一点以容纳更多字段 */
    padding: 20px;
  }

  .register-card {
    border-radius: 12px;
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
  }

  /* 响应式调整 */
  @media (max-width: 599px) {
    .register-container {
      max-width: 90%;
    }
  }
  </style>
