import { defineStore } from 'pinia'
import { ref } from 'vue'
import { userApi } from '../api'
import { setAuthToken } from '../api/index'


export const useUserStore = defineStore('user', () => {
  // 用户信息状态
  const user = ref({
    isLoggedIn: false,
    username: '',
    avatar: '',
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

      // 专门针对 getCurrentUser 接口 swallow 401 错误
      const userData = await userApi.getCurrentUser().catch(err => {
        if (err.response?.status === 401) {
          // 401 表示用户未登录，这是正常情况，返回 null
          console.log('用户未登录')
          return null
        }
        // 其他错误继续抛出
        throw err
      })

      if (userData) {
        user.value = {
          isLoggedIn: true,
          username: userData.name, // 后端返回的是name字段
          avatar: userData.avatar || '/icons/default-avatar.png',
          role: userData.role || '员工'
        }
      } else {
        // 确保未登录状态
        user.value = {
          isLoggedIn: false,
          username: '',
          avatar: '',
        }
      }
      return userData
    } catch (err) {
      // 这里只会捕获非 401 的其他错误（网络错误、服务器错误等）
      console.error('获取用户信息失败:', err)
      error.value = '获取用户信息失败，请检查网络连接'
      return null
    } finally {
      loading.value = false
    }
  }

  // 登录方法
  async function login(credentials) {
    console.log('进入 userStore 的 login 方法',credentials);
    try {
      loading.value = true
      error.value = null
      console.log('使用store登陆');
      const response = await userApi.login(credentials)

      console.log('登录响应:', response);

      // 注意：axios响应拦截器已经返回了response.data，所以这里直接是用户数据
      // 成功登录时，后端返回 {id, name, email, token}，token 保存到 localStorage 供请求拦截器注入
      if (response && response.id) {
        setAuthToken(response.token)
        user.value = {
          isLoggedIn: true,
          username: response.name, // 后端返回的是name字段
          avatar: response.avatar || '/icons/default-avatar.png',
        }
        return true
      }
      return false
    } catch (err) {
      console.error('登录失败:', err)

      // 根据后端错误代码提供更准确的错误信息
      if (err.response) {
        switch (err.response.status) {
          case 400:
            error.value = '请检查输入的邮箱和密码格式'
            break
          case 450: // NO_Match
            error.value = '用户不存在，请检查邮箱地址'
            break
          case 451: // PW_INCORRECT
            error.value = '密码错误，请重新输入'
            break
          case 457: // email_not_verified
            error.value = '邮箱未验证，请先验证邮箱'
            // 返回特殊标识，让调用方知道这是邮箱未验证错误
            return { emailNotVerified: true }
            break
          case 429: // rate_limit
            const retryAfter = err.response.headers['retry-after']
            error.value = `请求过于频繁，请等待${retryAfter || 60}秒后重试`
            break
          default:
            error.value = '登录失败，请稍后重试'
        }
      } else {
        error.value = '网络连接异常，请检查网络设置'
      }

      return false
    } finally {
      loading.value = false
    }
  }

  // 登出方法
  async function logout() {
    try {
      loading.value = true
      error.value = null

      // 通知后端登出语义；JWT 无状态，后端不维护 session，前端最终以本地清理为准
      await userApi.logout()

    } catch (err) {
      console.error('登出API调用失败:', err)
      // 即使API调用失败，也继续执行前端登出逻辑
      // 因为用户点击登出就是想要登出，不应该因为网络问题而失败
    } finally {
      loading.value = false
    }

    // 无论API调用是否成功，都清理前端登录态和本地 token
    setAuthToken(null)
    user.value = {
      isLoggedIn: false,
      username: '',
      avatar: '',
    }

    // 清理本地存储中的相关数据
    localStorage.removeItem('rememberedUser')

    return true
  }

  // 检查是否已登录
  async function checkAuth() {
    // 无 token 直接判定未登录，避免无谓的 /user/info 请求和 401 噪声
    if (!localStorage.getItem('auth_token')) {
      user.value = {
        isLoggedIn: false,
        username: '',
        avatar: '',
      }
      return false
    }
    // 有 token 时再向后端确认，处理 token 过期或被吊销的情况
    const userData = await fetchCurrentUser()
    return !!userData
  }

  // 初始化 - 检查用户是否已登录（静默模式）
  async function initialize() {
    try {
      await checkAuth()
    } catch (error) {
      // 静默处理初始化错误，避免影响应用启动
      console.log('用户登录状态初始化完成')
    }
  }

  return {
    user,
    loading,
    error,
    login,
    logout,
    checkAuth,
    fetchCurrentUser,
    initialize
  }
}, {
  persist: {
    key: 'user-store',
    storage: localStorage,
    // 只持久化用户信息，不持久化loading和error状态
    paths: ['user']
  }
}
)
