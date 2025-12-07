<template>
  <div class="handover-complete-container">
    <q-card flat class="completion-card">
      <q-card-section class="text-center">
        <!-- 成功图标 -->
        <div class="success-icon q-mb-lg">
          <q-icon name="check_circle" size="6rem" color="positive" />
        </div>

        <!-- 主标题 -->
        <div class="text-h4 text-positive q-mb-md completion-title">
          交接班完成
        </div>

        <!-- 描述信息 -->
        <div class="text-h6 text-grey-7 q-mb-xl">
          交接班流程已成功完成
        </div>

        <!-- 倒计时提示 -->
        <div class="countdown-section q-mb-xl">
          <div class="text-body1 text-grey-8 q-mb-sm">
            系统将在 <span class="countdown-number">{{ countdown }}</span> 秒后自动登出
          </div>
          <div class="text-body2 text-grey-6">
            请使用接班人账号重新登录
          </div>
        </div>

        <!-- 进度条 -->
        <div class="progress-section q-mb-xl">
          <q-linear-progress
            :value="progressValue"
            size="8px"
            color="positive"
            class="countdown-progress"
          />
        </div>

        <!-- 立即登出按钮 -->
        <div class="action-section">
          <q-btn
            color="primary"
            size="lg"
            icon="logout"
            label="立即登出"
            class="logout-btn"
            @click="handleLogout"
            :loading="isLoggingOut"
          />
        </div>

        <!-- 交接信息摘要 -->
        <div class="handover-summary q-mt-xl">
          <q-separator class="q-mb-md" />
          <div class="text-body2 text-grey-7">
            <div class="summary-row">
              <span>交班人员：</span>
              <span class="text-weight-bold">{{ handoverInfo.currentOperator }}</span>
            </div>
            <div class="summary-row">
              <span>接班人员：</span>
              <span class="text-weight-bold">{{ handoverInfo.nextOperator }}</span>
            </div>
            <div class="summary-row">
              <span>交接时间：</span>
              <span class="text-weight-bold">{{ handoverInfo.completedTime }}</span>
            </div>
          </div>
        </div>
      </q-card-section>
    </q-card>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useQuasar } from 'quasar'
import { useRouter } from 'vue-router'
import { useUserStore } from 'src/stores/userStore'

// 交接完成组件 - 组合式函数
const $q = useQuasar()
const router = useRouter()
const userStore = useUserStore()

// 响应式数据
const countdown = ref(5)
const isLoggingOut = ref(false)
let countdownTimer = null

// 计算属性
const progressValue = computed(() => {
  return (5 - countdown.value) / 5
})

// Props
const props = defineProps({
  handoverInfo: {
    type: Object,
    default: () => ({
      currentOperator: '张三',
      nextOperator: '李四',
      completedTime: new Date().toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      })
    })
  }
})

const emit = defineEmits(['logout'])

// 开始倒计时
const startCountdown = () => {
  countdownTimer = setInterval(() => {
    countdown.value--

    if (countdown.value <= 0) {
      clearInterval(countdownTimer)
      handleLogout()
    }
  }, 1000)
}

// 处理登出
const handleLogout = async () => {
  try {
    isLoggingOut.value = true

    // 清除倒计时
    if (countdownTimer) {
      clearInterval(countdownTimer)
    }

    $q.notify({ type: 'info', message: '正在登出...', position: 'top' })

    // 通过 userStore 调用后端登出路由
    await userStore.logout()

    // 发出登出事件给父级做后续导航
    emit('logout')

    $q.notify({ type: 'positive', message: '已成功登出，请使用接班人账号登录', position: 'top', timeout: 3000 })

    router.push('/login')

  } catch (error) {
    console.error('登出失败:', error)
    $q.notify({
      type: 'negative',
      message: '登出失败，请重试',
      position: 'top'
    })
  } finally {
    isLoggingOut.value = false
  }
}

// 生命周期
onMounted(() => {
  // 显示完成通知
  $q.notify({
    type: 'positive',
    message: '交接班流程已完成！',
    position: 'top',
    timeout: 2000
  })

  // 开始倒计时
  startCountdown()
})

onUnmounted(() => {
  // 清理倒计时
  if (countdownTimer) {
    clearInterval(countdownTimer)
  }
})
</script>

<style scoped>
.handover-complete-container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 60vh;
  padding: 20px;
}

.completion-card {
  max-width: 600px;
  width: 100%;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(10px);
  border-radius: 20px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  padding: 40px 20px;
}

.success-icon {
  animation: successPulse 2s ease-in-out infinite;
}

@keyframes successPulse {
  0%, 100% {
    transform: scale(1);
    opacity: 1;
  }
  50% {
    transform: scale(1.05);
    opacity: 0.8;
  }
}

.completion-title {
  font-weight: 700;
  letter-spacing: 1px;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.countdown-section {
  background: rgba(76, 175, 80, 0.1);
  border-radius: 12px;
  padding: 20px;
  border: 2px solid rgba(76, 175, 80, 0.2);
}

.countdown-number {
  font-size: 1.5em;
  font-weight: bold;
  color: #4caf50;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
}

.progress-section {
  max-width: 300px;
  margin: 0 auto;
}

.countdown-progress {
  border-radius: 4px;
  background: rgba(76, 175, 80, 0.1);
}

.logout-btn {
  padding: 16px 32px;
  font-size: 16px;
  font-weight: 600;
  border-radius: 12px;
  box-shadow: 0 4px 16px rgba(25, 118, 210, 0.3);
  transition: all 0.3s ease;
  min-width: 160px;
}

.logout-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(25, 118, 210, 0.4);
}

.handover-summary {
  background: rgba(245, 245, 245, 0.5);
  border-radius: 8px;
  padding: 16px;
  max-width: 400px;
  margin: 0 auto;
}

.summary-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.summary-row:last-child {
  margin-bottom: 0;
}

/* 响应式设计 */
@media (max-width: 600px) {
  .completion-card {
    padding: 30px 15px;
    border-radius: 16px;
  }

  .completion-title {
    font-size: 1.8rem;
  }

  .success-icon .q-icon {
    font-size: 4rem !important;
  }

  .logout-btn {
    padding: 14px 28px;
    font-size: 15px;
    min-width: 140px;
  }

  .countdown-section {
    padding: 16px;
  }
}

/* 暗色主题适配 */
.body--dark .completion-card {
  background: rgba(30, 30, 30, 0.95);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.body--dark .countdown-section {
  background: rgba(76, 175, 80, 0.15);
  border-color: rgba(76, 175, 80, 0.3);
}

.body--dark .handover-summary {
  background: rgba(255, 255, 255, 0.05);
}
</style>
