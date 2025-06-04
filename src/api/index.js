import axios from 'axios'

// 创建axios实例
const api = axios.create({
  baseURL: 'http://localhost:3000/api', // 后端API运行在3000端口
  timeout: 10000, // 请求超时时间,
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
  getAllRooms: () => api.get('/rooms'),

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

  // 获取房间类型
  getRoomTypes: () => api.get('/room-types'),

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
}

// 库存相关接口
export const inventoryApi = {
  // 获取指定日期的库存
  getInventoryByDate: (date) => api.get(`/inventory/date/${date}`),

  // 更新库存
  updateInventory: (date, typeCode, data) => api.patch(`/inventory/${date}/${typeCode}`, data),
}

export default api; // Export the configured axios instance as default
