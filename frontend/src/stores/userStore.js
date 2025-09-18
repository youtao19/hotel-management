import { defineStore } from 'pinia'
import { ref } from 'vue'
import { userApi } from '../api'

export const useUserStore = defineStore('user', () => {
  // 用户信息状态
  const user = ref({
    isLoggedIn: false,
    username: '',
    avatar: '',
    role: ''
  })

  // 加载状态
  const loading = ref(false)
  // 错误信息
  const error = ref(null)

  // 获取当前用户信息
  async function fetchCurrentUser() {
    try {
      loading.value = true
      error.value = null
      const userData = await userApi.getCurrentUser()
      if (userData) {
        user.value = {
          isLoggedIn: true,
          username: userData.username,
          avatar: userData.avatar || '/icons/default-avatar.png',
          role: userData.role || '员工'
        }
      }
      return userData
    } catch (err) {
      console.error('获取用户信息失败:', err)
      error.value = '获取用户信息失败'
      return null
    } finally {
      loading.value = false
    }
  }

  // 登录方法
  async function login(credentials) {
    try {
      loading.value = true
      error.value = null
      const response = await userApi.login(credentials)

      if (response && response.token) {
        // 存储token
        localStorage.setItem('token', response.token)

        // 获取用户信息
        const userData = response.user || await fetchCurrentUser()

        if (userData) {
          user.value = {
            isLoggedIn: true,
            username: userData.username,
            avatar: userData.avatar || '/icons/default-avatar.png',
            role: userData.role || '员工'
          }
          return true
        }
      }
      return false
    } catch (err) {
      console.error('登录失败:', err)
      error.value = '用户名或密码错误'
      return false
    } finally {
      loading.value = false
    }
  }

  // 登出方法
  async function logout() {
    try {
      loading.value = true
      // 调用登出API
      await userApi.logout()
      // 清除token
      localStorage.removeItem('token')
      // 重置用户状态
      user.value = {
        isLoggedIn: false,
        username: '',
        avatar: '',
        role: ''
      }
      return true
    } catch (err) {
      console.error('登出失败:', err)
      return false
    } finally {
      loading.value = false
    }
  }

  // 检查是否已登录
  async function checkAuth() {
    const token = localStorage.getItem('token')
    if (token && !user.value.isLoggedIn) {
      return await fetchCurrentUser()
    }
    return user.value.isLoggedIn
  }

  // 初始化 - 检查用户是否已登录
  function initialize() {
    checkAuth()
  }

  // 初始化
  initialize()

  return {
    user,
    loading,
    error,
    login,
    logout,
    checkAuth,
    fetchCurrentUser
  }
})
