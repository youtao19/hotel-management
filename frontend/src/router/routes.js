const routes = [
  {
    path: '/login',
    component: () => import('pages/Login.vue')
  },
  {
    path: '/register',
    component: () => import('pages/Register.vue')
  },
  {
    path: '/verify-email/:code',
    component: () => import('pages/EmailVerification.vue')
  },
  {
    path: '/',
    component: () => import('layouts/HomeView.vue'),
    children: [
      { path: '', redirect: '/Dash-board' },
      { path: 'Dash-board', component: () => import('pages/Dash-board.vue') },
      { path: 'room-status', component: () => import('pages/RoomStatus.vue') },
      { path: 'room-management', component: () => import('pages/RoomManagement.vue') },
      { path: 'ViewOrders', component: () => import('pages/ViewOrders.vue') },
      { path: 'CreateOrder', component: () => import('pages/CreateOrder.vue') },
      { path: 'shift-handover', component: () => import('pages/ShiftHandover.vue') },
      { path: 'review-management', component: () => import('pages/ReviewManagement.vue') },
      { path: 'revenue-statistics', component: () => import('pages/RevenueStatistics.vue') }
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
