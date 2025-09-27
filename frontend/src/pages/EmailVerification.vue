<template>
  <div class="fullscreen bg-primary text-white text-center q-pa-md flex flex-center">
    <div>
      <div v-if="loading" class="text-h4">
        <q-spinner-dots color="white" size="2em" />
        <div class="q-mt-md">正在验证您的邮箱...</div>
      </div>

      <div v-if="success" class="text-h4">
        <q-icon name="check_circle" size="2em" />
        <div class="q-mt-md">邮箱验证成功！</div>
        <div class="text-subtitle1">将在 {{ countdown }} 秒后跳转到登录页面...</div>
      </div>

      <div v-if="error" class="text-h4">
        <q-icon name="error" size="2em" />
        <div class="q-mt-md">{{ errorMessage }}</div>
        <q-btn class="q-mt-xl" color="white" text-color="primary" unelevated to="/login" label="返回登录" no-caps />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { authApi } from '../api/index.js';

const route = useRoute();
const router = useRouter();

const loading = ref(true);
const success = ref(false);
const error = ref(false);
const errorMessage = ref('');
const countdown = ref(3);

onMounted(async () => {
  const { code } = route.params;

  if (!code) {
    loading.value = false;
    error.value = true;
    errorMessage.value = '无效的验证链接。';
    return;
  }

  try {
    // 调用邮箱验证API
    await authApi.verifyEmail(code);

    loading.value = false;
    success.value = true;

    // 验证成功后倒计时跳转到登录页面
    const interval = setInterval(() => {
      countdown.value--;
      if (countdown.value === 0) {
        clearInterval(interval);
        router.push('/login');
      }
    }, 1000);

  } catch (err) {
    loading.value = false;
    error.value = true;

    // 根据后端返回的错误状态码显示不同的错误信息
    if (err.response) {
      switch (err.response.status) {
        case 452: // 根据后端代码，452是CODE_INVALID的状态码
          errorMessage.value = '验证链接无效或已过期。';
          break;
        case 400:
          errorMessage.value = '验证请求格式错误。';
          break;
        case 500:
          errorMessage.value = '服务器内部错误，请稍后重试。';
          break;
        default:
          errorMessage.value = '邮箱验证失败，请稍后重试。';
      }
    } else {
      errorMessage.value = '网络连接错误，请检查网络后重试。';
    }

    console.error('邮箱验证失败:', err);
  }
});
</script>
