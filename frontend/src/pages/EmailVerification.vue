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
        <div class="text-subtitle1">将在 {{ countdown }} 秒后跳转到仪表盘...</div>
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
import { useUserStore } from '../stores/userStore';
import axios from 'axios';

const route = useRoute();
const router = useRouter();
const userStore = useUserStore();

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
    const response = await axios.post('/api/auth/email-verify', { code });

    loading.value = false;
    success.value = true;

    // Log the user in
    userStore.login(response.data.user);

    const interval = setInterval(() => {
      countdown.value--;
      if (countdown.value === 0) {
        clearInterval(interval);
        router.push('/Dash-board');
      }
    }, 1000);

  } catch (err) {
    loading.value = false;
    error.value = true;
    if (err.response && err.response.status === 452) {
        errorMessage.value = '验证链接无效或已过期。';
    } else {
        errorMessage.value = '邮箱验证失败，请稍后重试。';
    }
  }
});
</script>