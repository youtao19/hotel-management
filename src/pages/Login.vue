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
          <!-- 登录按钮下方 -->
          <div class="text-center q-mt-md">
            <q-btn flat dense color="primary" label="还没有账户？立即注册" @click="goToRegister" />
          </div>
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
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useQuasar } from 'quasar'
import { useUserStore } from '../stores/userStore'
import axios from 'axios' // 导入 axios

// 路由实例
const router = useRouter()
// Quasar实例，用于显示通知
const $q = useQuasar()
// 用户存储实例
const userStore = useUserStore()

// 表单数据
const username = ref('') // 存储用户邮箱
const password = ref('')
const rememberMe = ref(false)
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
    if (!username.value || !password.value) {
      $q.notify({
        type: 'negative',
        message: '请填写所有必填字段',
        position: 'top'
      });
      return;
    }

    // 调用后端登录 API
    console.log('登录表单数据:', { email: username.value, pw: password.value });

    const response = await axios.post('/api/auth/login', {
      email: username.value, // 将 username 作为 email 发送给后端
      pw: password.value
    });

    console.log('登录请求成功返回:', response);
    isLoading = false;

    // 检查后端返回的状态码 (axios 默认认为 2xx 为成功)
    // 后端在成功时返回了用户信息
    if (response.data) {
      // 更新用户登录状态，使用后端返回的数据
      userStore.login({
        id: response.data.id, // 使用后端返回的 id
        username: response.data.name, // 使用后端返回的 name 作为 username
        email: response.data.email, // 使用后端返回的 email
        avatar: 'https://cdn.quasar.dev/img/boy-avatar.png',
        role: '员工'
      });

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
      // 理论上 axios 成功回调里 response.data 应该存在，但也处理一下以防万一
      $q.notify({
        type: 'negative',
        message: '登录响应异常',
        position: 'top'
      });
    }
  } catch (error) {
    console.error('登录请求失败:', error);

    // 更详细地打印错误信息
    if (error.response) {
      console.error('错误响应数据:', error.response.data);
      console.error('错误状态码:', error.response.status);
    } else if (error.request) {
      console.error('请求已发送但未收到响应:', error.request);
    } else {
      console.error('请求设置过程中出错:', error.message);
    }

    let errorMessage = '登录失败，请稍后重试';
    if (error.response) {
      // 尝试从后端响应获取更具体的错误信息
      const status = error.response.status;
      const backendMessage = error.response.data?.message;

      if (status === 400) {
        errorMessage = backendMessage || '请求数据格式错误（例如邮箱格式不正确）';
      } else if (status === 401 || status === 450) { // 450 是自定义的 NO_Match 状态码
        errorMessage = backendMessage || '用户名或密码错误';
      } else if (status === 429) { // 429 是请求频率限制
        errorMessage = backendMessage || '尝试次数过多，请稍后再试';
      } else if (status === 404) {
        errorMessage = '登录API不存在，请检查服务器配置';
      } else {
        errorMessage = backendMessage || `发生错误 (${status})`;
      }
    } else if (error.request) {
      errorMessage = '服务器没有响应，请检查网络连接';
    }

    $q.notify({
      type: 'negative',
      message: errorMessage,
      position: 'top',
      timeout: 3000
    });
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
