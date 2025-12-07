const routes = [
  // 无布局的页面（登录、注册、邮箱验证）
  {
    path: '/login',
    component: () => import('pages/Login.vue')
  },
  {
    path: '/register',
    component: () => import('pages/Register.vue')
  },
  {
    path: '/email-verify/:code',
    component: () => import('pages/EmailVerification.vue')
  },

  // 有主布局的页面
  {
    path: '/',
    component: () => import('layouts/HomeView.vue'),
    children: [
      { path: '', redirect: '/Dash-board' },
      { path: 'Dash-board', component: () => import('pages/Dash-board.vue') },
      { path: 'room-status', component: () => import('pages/RoomStatus/index.vue') },
      { path: 'room-management', component: () => import('pages/RoomManagement/index.vue') },
      { path: 'ViewOrders', component: () => import('pages/OrderManagement/index.vue') },
      { path: 'CreateOrder', component: () => import('pages/CreateOrder/index.vue') },
      { path: 'review-management', component: () => import('pages/ReviewManagement/index.vue') },
      { path: 'revenue-statistics', component: () => import('pages/Revenue/index.vue') },
      { path: 'handover', component: () => import('pages/Handover.vue') },
      { path: 'other-income', component: () => import('pages/OtherIncome.vue') }
    ]
  },

  // 请始终将此项保留为最后一项，
  // 但你也可以将其移除
  {
    path: '/:catchAll(.*)*',
    redirect: '/login'
  }
]

export default routes
