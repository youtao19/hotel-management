import { defineRouter } from '#q-app/wrappers'
import { createRouter, createMemoryHistory, createWebHistory, createWebHashHistory } from 'vue-router'
import routes from './routes'

/*
 * If not building with SSR mode, you can
 * directly export the Router instantiation;
 *
 * The function below can be async too; either use
 * async/await or return a Promise which resolves
 * with the Router instance.
 */

export default defineRouter(function (/* { store, ssrContext } */) {
  const createHistory = process.env.SERVER
    ? createMemoryHistory
    : (process.env.VUE_ROUTER_MODE === 'history' ? createWebHistory : createWebHashHistory)

  const Router = createRouter({
    scrollBehavior: () => ({ left: 0, top: 0 }),
    routes,

    // Leave this as is and make changes in quasar.conf.js instead!
    // quasar.conf.js -> build -> vueRouterMode
    // quasar.conf.js -> build -> publicPath
    history: createHistory(process.env.VUE_ROUTER_BASE)
  })

  // 添加路由守卫
  Router.beforeEach(async (to, from, next) => {
    // 动态导入userStore，避免循环依赖
    const { useUserStore } = await import('src/stores/userStore')
    const userStore = useUserStore()

    // 定义不需要认证的路由
    const publicRoutes = ['/login', '/register']
    const isPublicRoute = publicRoutes.includes(to.path) || to.path.startsWith('/email-verify/')

    // 如果是公共路由，直接放行
    if (isPublicRoute) {
      return next()
    }

    // 检查用户是否已登录
    try {
      const isAuthenticated = await userStore.checkAuth()

      if (isAuthenticated) {
        next()
      } else {
        // 未登录，重定向到登录页
        next('/login')
      }
    } catch (error) {
      console.error('路由守卫检查登录状态失败:', error)
      // 出错时也重定向到登录页
      next('/login')
    }
  })

  return Router
})
