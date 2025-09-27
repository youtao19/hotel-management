import axios from 'axios'

// 创建axios实例
const api = axios.create({
  baseURL: 'http://localhost:3000/api', // 后端API运行在3000端口
  timeout: 30000, // 增加到30秒
  withCredentials: true // 允许携带session cookie
})

// 请求拦截器
api.interceptors.request.use(
  config => {
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
  async error => {
    const originalRequest = error.config

    // 如果是超时错误且没有重试过
    if (error.code === 'ECONNABORTED' && error.message.includes('timeout') && !originalRequest._retry) {
      console.log('请求超时，正在重试...')
      originalRequest._retry = true
      originalRequest.timeout = 60000 // 重试时使用更长的超时时间

      try {
        return await api(originalRequest)
      } catch (retryError) {
        console.error('重试请求失败:', retryError)
        return Promise.reject(retryError)
      }
    }

    // 处理错误响应
    if (error.response) {
      const status = error.response.status
      const url = originalRequest.url

      // 对于 /user/info 接口的 401 错误，完全静默处理
      if (status === 401 && (url === '/user/info' || url.endsWith('/user/info'))) {
        // 不记录任何日志，静默处理
      } else if (status !== 401) {
        // 其他非 401 错误正常记录
        console.error('API请求错误:', error.response || error)
      }
      // 其他 401 错误（非 user/info 接口）也不记录日志，但组件可以自行处理
    } else {
      console.error('网络请求失败:', error.message || error)
    }

    return Promise.reject(error)
  }
)

// 房间相关接口
export const roomApi = {
  // 获取所有房间
  getAllRooms: (date = null) => {
    const url = date ? `/rooms?date=${date}` : '/rooms';
    const cacheBuster = `_=${new Date().getTime()}`;
    const finalUrl = url.includes('?') ? `${url}&${cacheBuster}` : `${url}?${cacheBuster}`;
    return api.get(finalUrl);
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
  getAllOrders: () => {
    const cacheBuster = `_=${Date.now()}`
    return api.get(`/orders?${cacheBuster}`)
  },

  // 根据ID获取订单
  getOrderById: (orderId) => api.get(`/orders/${orderId}`),

  // 添加新订单
  addOrder: (orderData) => api.post('/orders/new', orderData),

  // 更新订单状态
  updateOrderStatus: (orderId, statusData) => api.post(`/orders/${orderId}/status`, statusData),

  // 更新订单（支持多字段）
  updateOrder: (orderId, updatedFields) => api.put(`/orders/${orderId}`, updatedFields),

  // 更新订单和相关账单（联合事务）
  updateOrderWithBills: (orderId, orderData, billUpdates, changedBy = 'system') =>
    api.put(`/orders/${orderId}/with-bills`, { orderData, billUpdates, changedBy }),

  // 退押金
  refundDeposit: (order_id, refundData) => api.post(`/orders/${order_id}/refund-deposit`, refundData),

  // 获取押金状态
  getDepositInfo: (order_id) => api.get(`/orders/${order_id}/deposit-info`),

  // 办理入住
  checkIn: (orderId) => api.post(`/orders/${orderId}/check-in`),
}

// 用户相关接口
export const userApi = {
  // 用户登录
  login: (credentials) => api.post('/auth/login', credentials),

  // 获取当前用户信息
  getCurrentUser: () => api.get('/user/info'),

  // 用户登出
  logout: () => api.get('/user/logout'),
}

// 认证相关接口
export const authApi = {
  // 用户注册
  signup: (credentials) => api.post('/auth/signup', credentials),

  // 检查邮箱是否存在
  checkEmail: (email) => api.get(`/auth/check/email/${email}`),

  // 发送邮箱验证邮件
  sendEmailVerification: (email) => api.post('/auth/send-email-verification', { email }),

  // 验证邮箱
  verifyEmail: (code) => api.post('/auth/email-verify', { code }),
}

// 账单相关接口
export const billApi = {
  // 创建账单
  createBill: (billData) => api.post('/bills/add', billData),

  // 获得账单
  getBillByOrderId: (orderId) => api.get(`/bills/${orderId}`),

  // 获取订单的所有账单（支持多账单）
  getBillsByOrderId: (orderId) => api.get(`/bills/order/${orderId}`),

  // 获取所有账单
  getAllBills: () => api.get('/bills'),

  // 获取订单账单详情
  getOrderBillDetails: (orderId) => api.get(`/bills/order/${orderId}/details`),

  // 更新账单
  updateBill: (billId, updateData) => api.put(`/bills/${billId}`, updateData),

  // 根据订单号和日期更新账单
  updateBillByOrderAndDate: (orderId, stayDate, updateData) => api.put(`/bills/order/${orderId}/date/${stayDate}`, updateData),

  // 邀请客户好评
  inviteReview: (orderId) => api.post(`/bills/${orderId}/invite-review`),

  // 更新好评状态
  updateReviewStatus: (orderId, positive_review) => api.put(`/bills/${orderId}/review-status`, { positive_review }),

  // 获取待邀请好评的账单
  getPendingInvitations: () => api.get('/bills/pending-invitations'),

  // 获取已邀请但未设置好评状态的账单
  getPendingReviews: () => api.get('/bills/pending-reviews'),
}

// 好评相关接口
export const reviewApi = {
  // 邀请客户好评
  inviteReview: (orderId) => api.post(`/reviews/${orderId}/invite`),

  // 更新好评状态
  updateReviewStatus: (orderId, positive_review) => api.put(`/reviews/${orderId}/status`, { positive_review }),

  // 获取特定订单的好评信息
  getReviewByOrderId: (orderId) => api.get(`/reviews/${orderId}`),

  // 获取待邀请好评的订单
  getPendingInvitations: () => api.get('/reviews/pending-invitations'),

  // 获取已邀请但未设置好评状态的订单
  getPendingReviews: () => api.get('/reviews/pending-reviews'),

  // 获取所有好评记录
  getAllReviews: (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    return api.get(`/reviews/all${queryString ? '?' + queryString : ''}`);
  },

  // 获取好评统计信息
  getReviewStatistics: (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    return api.get(`/reviews/statistics${queryString ? '?' + queryString : ''}`);
  },
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

// 交接班相关接口
export const shiftHandoverApi = {

  // 导出Excel
  exportHandover: (handoverData) => api.post('/shift-handover/export', handoverData, { responseType: 'blob' }),

  // 获取交接班表格（计算版本）
  getShiftTable: (params) => api.get('/handover/table', { params }),

  // 获取交接班表格数据（从handover表查询）
  getHandoverTableData: (params) => api.get('/handover/handover-table', { params }),

  // 获取备忘录
  getRemarks: (params) => api.get('/handover/remarks', { params }),

  // 获取统计信息
  getStatistics: (params) => api.get('/handover/statistics', { params }),

  // 获取交接班特殊统计（开房数、休息房数、好评邀/得）
  getSpecialStats: (params) => api.get('/handover/special-stats', { params }),

  // 获取某日已保存的备用金（若后端实现）
  getReserveCash: (date) => api.get('/handover/reserve-cash', { params: { date } }),

  // 获取已有交接班日期（可访问日期）
  getAvailableDates: () => api.get('/handover/dates'),

  // 获取已有交接班日期（宽松模式：支持支付方式0，只要有记录就可选择）
  getAvailableDatesFlexible: () => api.get('/handover/dates-flexible'),

  // 开始交接班（首日默认、避免重复创建）
  startHandover: (handoverData) => api.post('/handover/start', handoverData),

  // 保存页面数据（保存完整的页面数据，包括金额、统计数据等）
  saveAmountChanges: (amountData) => api.post('/handover/save-amounts', amountData),

  // 保存管理员备忘录到交接班表
  saveAdminMemo: (memoData) => api.post('/handover/save-admin-memo', memoData),

  // 获取交接班表中的管理员备忘录
  getAdminMemos: (params) => api.get('/handover/admin-memos', { params })

}

export default api;
