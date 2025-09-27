<template>
  <q-dialog v-model="showDialog" persistent>
    <q-card style="min-width: 350px; max-width: 450px;">
      <!-- 卡片头部 -->
      <q-card-section class="row items-center q-pb-none">
        <q-icon name="logout" color="blue" size="24px" class="q-mr-sm" />
        <div class="text-h6">确认登出</div>
        <q-space />
        <q-btn icon="close" flat round dense v-close-popup :disable="loading" />
      </q-card-section>

      <!-- 卡片内容 -->
      <q-card-section class="q-pt-sm">
        <div class="text-body1 q-mb-md">
          {{ currentUser.username }}，您确定要退出登录吗？
        </div>
      </q-card-section>

      <!-- 卡片操作按钮 -->
      <q-card-actions align="right" class="q-pt-none">
        <q-btn
          flat
          label="取消"
          color="grey"
          v-close-popup
          :disable="loading"
        />
        <q-btn
          unelevated
          :label="loading ? '正在登出...' : '确认登出'"
          color="blue"
          @click="handleLogout"
          :loading="loading"
          :disable="loading"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useQuasar } from 'quasar'
import { useUserStore } from '../stores/userStore'

// Props
const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false
  }
})

// Emits
const emit = defineEmits(['update:modelValue', 'logout-success'])

// Composables
const router = useRouter()
const $q = useQuasar()
const userStore = useUserStore()

// Data
const loading = ref(false)

// Computed
const showDialog = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val)
})

const currentUser = computed(() => userStore.user)

// Methods
const handleLogout = async () => {
  loading.value = true

  try {
    // 显示登出进度
    const progressNotify = $q.notify({
      type: 'ongoing',
      message: '正在安全退出...',
      spinner: true,
      timeout: 0
    })

    // 调用登出方法
    const success = await userStore.logout()

    // 关闭进度通知
    progressNotify()

    if (success) {
      // 显示成功消息
      $q.notify({
        type: 'positive',
        message: '已安全退出登录',
        icon: 'check_circle',
        position: 'top',
        timeout: 2000
      })

      // 关闭对话框
      showDialog.value = false

      // 发送成功事件
      emit('logout-success')

      // 延迟跳转到登录页面
      setTimeout(() => {
        router.push('/login')
      }, 500)

    } else {
      throw new Error('登出失败')
    }

  } catch (error) {
    console.error('登出过程中发生错误:', error)

    $q.notify({
      type: 'negative',
      message: '登出失败，请重试',
      icon: 'error',
      position: 'top',
      timeout: 3000
    })
  } finally {
    loading.value = false
  }
}

// 当对话框关闭时重置状态
const resetState = () => {
  loading.value = false
}
</script>

<style scoped>
.q-card {
  border-radius: 12px;
}
</style>
