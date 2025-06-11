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
    path: '/',
    component: () => import('layouts/HomeView.vue'),
    children: [
      { path: '', redirect: '/Dash-board' },
      { path: 'Dash-board', component: () => import('pages/Dash-board.vue') },
      { path: 'room-status', component: () => import('pages/RoomStatus.vue') },
      { path: 'ViewOrders', component: () => import('pages/ViewOrders.vue') },
      { path: 'CreateOrder', component: () => import('pages/CreateOrder.vue') },
      { path: 'shift-handover', component: () => import('pages/ShiftHandover.vue') }
    ]
  },

  // Always leave this as last one,
  // but you can also remove it
  {
    path: '/:catchAll(.*)*',
    redirect: '/login'
  }
]

export default routes
