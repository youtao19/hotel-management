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
            type="email"
            label="邮箱地址"
            placeholder="请输入您的邮箱"
            lazy-rules
            :rules="[
              val => !!val || '请输入邮箱地址',
              val => /.+@.+\..+/.test(val) || '请输入有效的邮箱格式'
            ]"
          >
            <template v-slot:prepend>
              <q-icon name="email" />
            </template>
          </q-input>

          <!-- 密码输入框 -->
          <q-input
            v-model="pw"
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
          <!-- 登录按钮下方 -->
          <div class="text-center q-mt-md">
            <q-btn flat dense color="primary" label="还没有账户？立即注册" @click="goToRegister" />
          </div>

        </q-form>

        <!-- 底部版权信息 -->
        <div class="text-center q-mt-lg text-grey-7 text-caption">
          © 2025 酒店管理系统 版权所有
        </div>
      </q-card>
    </div>

    <!-- 邮箱验证提示对话框 -->
    <q-dialog v-model="showEmailVerificationDialog" persistent>
      <q-card style="min-width: 350px">
        <q-card-section>
          <div class="text-h6">邮箱验证</div>
        </q-card-section>

        <q-card-section class="q-pt-none">
          <p>您的邮箱 <strong>{{ username }}</strong> 尚未验证。</p>
          <p>请查收您的邮箱并点击验证链接，或者点击下方按钮重新发送验证邮件。</p>
        </q-card-section>

        <q-card-actions align="right">
          <q-btn flat label="取消" color="grey" v-close-popup />
          <q-btn
            flat
            label="重新发送验证邮件"
            color="primary"
            :loading="isResendingEmail"
            @click="resendVerificationEmail"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>

  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useQuasar } from 'quasar'
import { useUserStore } from '../stores/userStore'
import axios from 'axios' // 导入 axios
import { authApi } from '../api/index.js'

// 路由实例
const router = useRouter()
// Quasar实例，用于显示通知
const $q = useQuasar()
// 用户存储实例
const userStore = useUserStore()

// 表单数据
const username = ref('') // 存储用户邮箱
const pw = ref('')
const rememberMe = ref(false)
// 邮箱验证相关变量
const showEmailVerificationDialog = ref(false)
const isResendingEmail = ref(false)
const isPwd = ref(true)

/**
 * 表单提交处理函数
 */
async function onSubmit() { // 将函数改为异步
  try {
    console.log('开始登录请求...');

    // 显示加载状态
    let isLoading = true;

    // 验证表单
    if (!username.value || !pw.value) {
      $q.notify({
        type: 'negative',
        message: '请填写所有必填字段',
        position: 'top'
      });
      return;
    }

    // 使用userStore的login方法
    console.log('登录表单数据:', { email: username.value, pw: pw.value });

    const result = await userStore.login({
      email: username.value,
      pw: pw.value
    });

    console.log('登录结果:', result);

    isLoading = false;

    // 检查是否是邮箱未验证错误
    if (result && result.emailNotVerified) {
      // 显示邮箱验证对话框
      showEmailVerificationDialog.value = true;
      $q.notify({
        type: 'warning',
        message: '您的邮箱尚未验证，请先验证邮箱后再登录',
        position: 'top',
        timeout: 4000
      });
      return;
    }

    if (result === true) {
      console.log('登录成功');

      // 显示登录成功通知
      $q.notify({
        type: 'positive',
        message: '登录成功，正在跳转到主页...',
        position: 'top',
        timeout: 1500
      });

      // 如果选择了记住我 (存储 email)
      if (rememberMe.value) {
        localStorage.setItem('rememberedUser', username.value);
      } else {
        localStorage.removeItem('rememberedUser');
      }

      // 清除注册数据
      localStorage.removeItem('justRegistered');
      localStorage.removeItem('registeredEmail');
      localStorage.removeItem('registeredName');

      // 登录成功后跳转到仪表盘页面
      setTimeout(() => {
        router.push('/Dash-board');
      }, 1000);

    } else {
      // 登录失败，显示错误信息
      $q.notify({
        type: 'negative',
        message: userStore.error || '登录失败，请检查用户名和密码',
        position: 'top',
        timeout: 3000
      });
    }
  } catch (error) {
    console.error('登录过程中发生错误:', error);
    $q.notify({
      type: 'negative',
      message: '登录过程中发生错误，请稍后重试',
      position: 'top',
      timeout: 3000
    });
  }
}

// 重发验证邮件的方法
async function resendVerificationEmail() {
  if (!username.value) {
    $q.notify({
      type: 'negative',
      message: '请先输入邮箱地址',
      position: 'top'
    });
    return;
  }

  try {
    isResendingEmail.value = true;
    await authApi.sendEmailVerification(username.value);

    $q.notify({
      type: 'positive',
      message: '验证邮件已重新发送，请查收您的邮箱',
      position: 'top',
      timeout: 4000
    });

    showEmailVerificationDialog.value = false;
  } catch (error) {
    console.error('重发验证邮件失败:', error);

    let errorMessage = '发送验证邮件失败，请稍后重试';
    if (error.response && error.response.status === 429) {
      errorMessage = '请求过于频繁，请稍后再试';
    }

    $q.notify({
      type: 'negative',
      message: errorMessage,
      position: 'top'
    });
  } finally {
    isResendingEmail.value = false;
  }
}


// 组件挂载后的钩子函数
onMounted(() => {
  // 1. 检查是否有记住的用户
  if (localStorage.getItem('rememberedUser')) {
    username.value = localStorage.getItem('rememberedUser');
    rememberMe.value = true;
  }

  // 2. 检查是否从注册页面跳转过来
  if (localStorage.getItem('justRegistered') === 'true') {
    username.value = localStorage.getItem('registeredEmail') || '';

    // 显示欢迎信息
    const registeredName = localStorage.getItem('registeredName') || '';

    $q.notify({
      type: 'positive',
      message: `欢迎您，${registeredName}！请使用刚才注册的邮箱和密码登录。`,
      position: 'top',
      timeout: 4000
    });
  }
});

// 跳转到注册页面
function goToRegister() {
  router.push('/register');
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
