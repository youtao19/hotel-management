import axios from 'axios'

// 创建axios实例
const api = axios.create({
  // 使用相对路径，通过 Vite/Quasar 的 proxy 转发到后端
  // Docker 环境：proxy 会转发到 http://backend:3000
  // 本地开发：proxy 会转发到 http://localhost:3000
  baseURL: '/api',
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

  // 根据房间号获取房间
  getRoomByNumber: (number) => api.get(`/rooms/number/${number}`),

  // 更新房间状态
  updateRoomStatus: (roomNumber, status) => {
    console.log(`前端发送更新房间状态请求: 房间号=${roomNumber}, 状态=${status}`);
    return api.patch(`/rooms/${roomNumber}/status`, { status });
  },

  // 添加新房间
  addRoom: (roomData) => api.post('/rooms', roomData),

  // 更新房间信息
  updateRoom: (roomNumber, roomData) => api.put(`/rooms/${roomNumber}`, roomData),

  // 删除房间
  deleteRoom: (roomNumber) => api.delete(`/rooms/${roomNumber}`),

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

  // 快速入住
  fastCheckIn: (orderData) => api.post('/orders/fast-check-in', orderData),

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

  // 办理入住（支持传递押金金额）
  checkIn: (orderId, data = {}) => api.post(`/orders/${orderId}/check-in`, data),

  // 提前退房
  earlyCheckout: (orderId, payload) => api.post(`/orders/${orderId}/early-checkout`, payload),
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

  // 创建其他收入
  createOtherIncome: (payload) => api.post('/bills/other-income', payload),

  // 获得账单
  getBillByOrderId: (orderId) => api.get(`/bills/${orderId}`),

  // 获取订单的所有账单（支持多账单）
  getBillsByOrderId: (orderId) => api.get(`/bills/order/${orderId}`),

  // 按日期获取账单（交接班核对用）
  getBillsByDate: (date) => api.get(`/bills/by-date/${date}`),

  // 获取所有账单
  getAllBills: () => api.get('/bills'),

  // 获取订单账单详情
  getOrderBillDetails: (orderId) => api.get(`/bills/order/${orderId}/details`),

  // 更新账单
  updateBill: (billId, updateData) => api.put(`/bills/${billId}`, updateData),

}

// 仪表盘备忘录相关接口
export const memoApi = {
  getMemos: (memoDate) => {
    const query = memoDate ? `?date=${memoDate}` : ''
    return api.get(`/dashboard/memos${query}`)
  },

  addMemo: (memoData) => api.post('/dashboard/memos', memoData),

  updateMemo: (memoId, memoData) => api.put(`/dashboard/memos/${memoId}`, memoData),

  deleteMemo: (memoId) => api.delete(`/dashboard/memos/${memoId}`)
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
  getDailyRevenue: (startDate, endDate, roomType) =>
    api.get('/revenue/daily', { params: { startDate, endDate, roomType } }),

  // 获取每周收入统计
  getWeeklyRevenue: (startDate, endDate, roomType) =>
    api.get('/revenue/weekly', { params: { startDate, endDate, roomType } }),

  // 获取每月收入统计
  getMonthlyRevenue: (startDate, endDate, roomType) =>
    api.get('/revenue/monthly', { params: { startDate, endDate, roomType } }),

  // 获取收入概览统计
  getRevenueOverview: (startDate, endDate) => api.get('/revenue/getOverview', { params: { startDate, endDate } }),

  // 获取房型收入统计
  getRoomTypeRevenue: (startDate, endDate) => api.get('/revenue/room-type', { params: { startDate, endDate } }),

  // 获取快速统计数据（今日、本周、本月）
  getQuickStats: () => api.get('/revenue/quick-stats'),

  // 获取账单明细
  getRevenueBills: (params = {}) => api.get('/revenue/bills', { params }),
}

// 交接班相关接口
export const shiftHandoverApi = {

  // 获取交接班表格（计算版本）
  getShiftTable: (params) => api.get('/handover/table', { params }),

  // 获取交接班表格数据（从handover表查询）
  getHandoverTableData: (params) => api.get('/handover/handover-table', { params }),

  // 获取备忘录
  getRemarks: (params) => api.get('/handover/remarks', { params }),

  // 获取交接班特殊统计（开房数、休息房数、好评邀/得）
  getSpecialStats: (params) => api.get('/handover/special-stats', { params }),

  // 保存管理员备忘录到交接班表
  saveAdminMemo: (memoData) => api.post('/handover/save-admin-memo', memoData),

  // 获取交接班表中的管理员备忘录
  getAdminMemos: (params) => api.get('/handover/admin-memos', { params }),

  // 检查昨日交接记录
  checkYesterdayRecord: (params) => api.get('/handover/check-yesterday', { params }),

  // 查询所有交接班记录
  queryHandoverRecords: () => api.get('/handover/query'),

  // 按日期范围查询交接班记录
  queryHandoverByRange: (params) => api.get('/handover/query-by-range', { params }),

  // 获取有交接记录的日期列表
  getAvailableHandoverDates: () => api.get('/handover/available-dates'),

  // 完成交接班（保存完整数据）
  completeHandover: (handoverData) => api.post('/handover/complete', handoverData)

}

export default api;
