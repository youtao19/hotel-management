import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useUserStore = defineStore('user', () => {
  // 用户信息状态
  const user = ref({
    isLoggedIn: false,
    username: '',
    avatar: '',
    role: ''
  })

  // 登录方法
  function login(userData) {
    user.value = {
      isLoggedIn: true,
      username: userData.username,
      avatar: userData.avatar || 'https://cdn.quasar.dev/img/boy-avatar.png',
      role: userData.role || '员工'
    }
  }

  // 登出方法
  function logout() {
    user.value = {
      isLoggedIn: false,
      username: '',
      avatar: '',
      role: ''
    }
  }

  return {
    user,
    login,
    logout
  }
})
