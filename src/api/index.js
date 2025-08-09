import axios from 'axios'

// 创建axios实例
const api = axios.create({
  baseURL: 'http://localhost:3000/api', // 后端API运行在3000端口
  timeout: 10000, // 请求超时时间
  withCredentials: false // 避免CORS预检请求
})

// 请求拦截器
api.interceptors.request.use(
  config => {
    // 可以在这里添加请求头等通用配置
    const token = localStorage.getItem('token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  error => {
    return Promise.reject(error)
  }
)

// 响应拦截器
api.interceptors.response.use(
  response => {
    // 直接返回响应数据，无需解析
    return response.data
  },
  error => {
    // 处理错误响应
    console.error('API请求错误:', error.response || error)
    return Promise.reject(error)
  }
)

// 房间相关接口
export const roomApi = {
  // 获取所有房间
  getAllRooms: (date = null) => {
    const url = date ? `/rooms?date=${date}` : '/rooms';
    return api.get(url);
  },

  // 根据ID获取房间
  getRoomById: (id) => api.get(`/rooms/${id}`),

  // 根据房间号获取房间
  getRoomByNumber: (number) => api.get(`/rooms/number/${number}`),

  // 更新房间状态
  updateRoomStatus: (id, status) => {
    console.log(`前端发送更新房间状态请求: ID=${id}, 状态=${status}`);
    return api.post(`/rooms/${id}/status`, { status });
  },

  // 添加新房间
  addRoom: (roomData) => api.post('/rooms', roomData),

  // 更新房间信息
  updateRoom: (id, roomData) => api.put(`/rooms/${id}`, roomData),

  // 删除房间
  deleteRoom: (id) => api.delete(`/rooms/${id}`),

  // 获取房间类型
  getRoomTypes: () => api.get('/room-types'),

  // 添加房型
  addRoomType: (roomTypeData) => api.post('/room-types', roomTypeData),

  // 更新房型
  updateRoomType: (code, roomTypeData) => api.put(`/room-types/${code}`, roomTypeData),

  // 删除房型
  deleteRoomType: (code) => api.delete(`/room-types/${code}`),

  getAvailableRooms: (params) => api.get(`/rooms/available?${params}`),
  changePendingRoom: (data) => api.post(`/rooms/change-room`, data),
}

// 订单相关接口
export const orderApi = {
  // 获取所有订单
  getAllOrders: () => api.get('/orders'),

  // 添加新订单
  addOrder: (orderData) => api.post('/orders/new', orderData),

  // 更新订单状态
  updateOrderStatus: (orderId, statusData) => api.post(`/orders/${orderId}/status`, statusData),

  // 更新订单房间信息
  updateOrderRoom: (orderId, roomData) => api.patch(`/orders/${orderId}/room`, roomData),

  // 办理入住
  checkIn: (orderId, checkInData) => api.patch(`/orders/${orderId}/check-in`, checkInData),

  // 办理退房
  checkOut: (orderId, checkOutData) => api.patch(`/orders/${orderId}/check-out`, checkOutData),

  // 退押金
  refundDeposit: (orderNumber, refundData) => api.post(`/orders/${orderNumber}/refund-deposit`, refundData),
}

// 用户相关接口
export const userApi = {
  // 用户登录
  login: (credentials) => api.post('/auth/login', credentials),

  // 获取当前用户信息
  getCurrentUser: () => api.get('/users/me'),

  // 用户登出
  logout: () => api.post('/auth/logout'),
}

// 账单相关接口
export const billApi = {
  // 创建账单
  createBill: (billData) => api.post('/bills/create', billData),

  // 获得账单
  getBillByOrderId: (orderId) => api.get(`/bills/${orderId}`),

  // 邀请客户好评
  inviteReview: (orderId) => api.post(`/bills/${orderId}/invite-review`),

  // 更新好评状态
  updateReviewStatus: (orderId, positive_review) => api.post(`/bills/${orderId}/review-status`, { positive_review }),

  // 获取所有账单
  getAllBills: () => api.get('/bills/all'),

  // 获取待邀请好评的账单
  getPendingInvitations: () => api.get('/bills/pending-invitations'),

  // 获取已邀请但未设置好评状态的账单
  getPendingReviews: () => api.get('/bills/pending-reviews'),
}

// 收入统计相关接口
export const revenueApi = {
  // 获取每日收入统计
  getDailyRevenue: (startDate, endDate) => api.get('/revenue/daily', { params: { startDate, endDate } }),

  // 获取每周收入统计
  getWeeklyRevenue: (startDate, endDate) => api.get('/revenue/weekly', { params: { startDate, endDate } }),

  // 获取每月收入统计
  getMonthlyRevenue: (startDate, endDate) => api.get('/revenue/monthly', { params: { startDate, endDate } }),

  // 获取收入概览统计
  getRevenueOverview: (startDate, endDate) => api.get('/revenue/overview', { params: { startDate, endDate } }),

  // 获取房型收入统计
  getRoomTypeRevenue: (startDate, endDate) => api.get('/revenue/room-type', { params: { startDate, endDate } }),

  // 获取快速统计数据（今日、本周、本月）
  getQuickStats: () => api.get('/revenue/quick-stats'),
}

// 库存相关接口
export const inventoryApi = {
  // 获取指定日期的库存
  getInventoryByDate: (date) => api.get(`/inventory/date/${date}`),

  // 更新库存
  updateInventory: (date, typeCode, data) => api.patch(`/inventory/${date}/${typeCode}`, data),
}

// 交接班相关接口
export const shiftHandoverApi = {
  // 获取收款明细
  getReceiptDetails: (params) => api.get('/shift-handover/receipts', { params }),

  // 获取统计数据
  getStatistics: (params) => api.get('/shift-handover/statistics', { params }),

  // 获取前一天的交接班记录
  getPreviousHandoverData: (params) => api.get('/shift-handover/previous-handover', { params }),

  // 获取当天的交接班记录
  getCurrentHandoverData: (params) => api.get('/shift-handover/current-handover', { params }),

  // 保存交接班记录
  saveHandover: (handoverData) => api.post('/shift-handover/save', handoverData),

  // 获取历史记录
  getHandoverHistory: (params) => api.get('/shift-handover/history', { params }),

  // 导出Excel
  exportHandover: (handoverData) => api.post('/shift-handover/export', handoverData, { responseType: 'blob' }),

  // 导出新版Excel
  exportNewHandover: (handoverData) => api.post('/shift-handover/export-new', handoverData, { responseType: 'blob' }),

  // 导入收款明细到交接班
  importReceiptsToShiftHandover: (importData) => api.post('/shift-handover/import-receipts', importData),

  // 保存金额修改
  saveAmountChanges: (amountData) => api.post('/shift-handover/save-amounts', amountData),

  // 删除交接班记录
  deleteHandoverRecord: (recordId) => api.delete(`/shift-handover/${recordId}`),
}

export default api;
