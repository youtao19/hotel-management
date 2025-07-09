<template>
  <div class="review-management q-pa-md">
    <q-card>
      <q-card-section>
        <div class="text-h6">客户好评管理</div>
        <div class="text-subtitle2 text-grey-7">管理客户好评邀请和评价状态</div>
      </q-card-section>

      <q-card-section>
        <!-- 统计卡片 -->
        <div class="row q-gutter-md q-mb-md">
          <q-card class="col-md-3 col-sm-6 col-xs-12" flat bordered>
            <q-card-section class="text-center">
              <div class="text-h4 text-positive">{{ statistics.pendingInvitations }}</div>
              <div class="text-subtitle2">可邀请好评</div>
            </q-card-section>
          </q-card>

          <q-card class="col-md-3 col-sm-6 col-xs-12" flat bordered>
            <q-card-section class="text-center">
              <div class="text-h4 text-warning">{{ statistics.pendingReviews }}</div>
              <div class="text-subtitle2">待设置评价</div>
            </q-card-section>
          </q-card>

          <q-card class="col-md-3 col-sm-6 col-xs-12" flat bordered>
            <q-card-section class="text-center">
              <div class="text-h4 text-positive">{{ statistics.positiveReviews }}</div>
              <div class="text-subtitle2">好评数量</div>
            </q-card-section>
          </q-card>

          <q-card class="col-md-3 col-sm-6 col-xs-12" flat bordered>
            <q-card-section class="text-center">
              <div class="text-h4 text-primary">{{ statistics.reviewRate }}%</div>
              <div class="text-subtitle2">好评率</div>
            </q-card-section>
          </q-card>
        </div>

        <!-- 标签页 -->
        <q-tabs v-model="activeTab" dense class="text-grey" active-color="primary" indicator-color="primary" align="justify">
          <q-tab name="pending-invitations" label="可邀请好评" />
          <q-tab name="pending-reviews" label="待设置评价" />
          <q-tab name="all-reviews" label="所有评价" />
        </q-tabs>

        <q-separator />

        <q-tab-panels v-model="activeTab" animated>
          <!-- 可邀请好评 -->
          <q-tab-panel name="pending-invitations">
            <div class="q-mb-md">
              <q-banner class="bg-blue-1 text-blue-9" dense>
                <template v-slot:avatar>
                  <q-icon name="info" color="blue" />
                </template>
                显示昨天和今天已入住的客户，可以邀请他们进行好评。如果列表为空，说明昨天和今天没有新入住的客户。
              </q-banner>
            </div>
            <q-table
              :rows="pendingInvitations"
              :columns="invitationColumns"
              row-key="order_id"
              :loading="loading"
              flat
              bordered
            >
              <template v-slot:body-cell-actions="props">
                <q-td :props="props">
                  <q-btn
                    flat
                    round
                    dense
                    color="positive"
                    icon="send"
                    @click="inviteReview(props.row)"
                  >
                    <q-tooltip>邀请好评</q-tooltip>
                  </q-btn>
                </q-td>
              </template>
            </q-table>
          </q-tab-panel>

          <!-- 待设置评价 -->
          <q-tab-panel name="pending-reviews">
            <q-table
              :rows="pendingReviews"
              :columns="reviewColumns"
              row-key="order_id"
              :loading="loading"
              flat
              bordered
            >
              <template v-slot:body-cell-actions="props">
                <q-td :props="props">
                  <q-btn-group flat>
                    <q-btn
                      flat
                      dense
                      color="positive"
                      icon="check_circle"
                      @click="setReviewStatus(props.row, true)"
                    >
                      <q-tooltip>已好评</q-tooltip>
                    </q-btn>
                    <q-btn
                      flat
                      dense
                      color="negative"
                      icon="cancel"
                      @click="setReviewStatus(props.row, false)"
                    >
                      <q-tooltip>未好评</q-tooltip>
                    </q-btn>
                  </q-btn-group>
                </q-td>
              </template>
            </q-table>
          </q-tab-panel>

          <!-- 所有评价 -->
          <q-tab-panel name="all-reviews">
            <q-table
              :rows="allBills"
              :columns="allReviewColumns"
              row-key="order_id"
              :loading="loading"
              flat
              bordered
            >
              <template v-slot:body-cell-review_status="props">
                <q-td :props="props">
                  <q-badge
                    v-if="props.row.review_invited && props.row.positive_review !== null"
                    :color="props.row.positive_review ? 'positive' : 'negative'"
                    :label="props.row.positive_review ? '好评' : '未好评'"
                  />
                  <q-badge
                    v-else-if="props.row.review_invited"
                    color="warning"
                    label="已邀请"
                  />
                  <q-badge
                    v-else
                    color="grey"
                    label="未邀请"
                  />
                </q-td>
              </template>
            </q-table>
          </q-tab-panel>
        </q-tab-panels>
      </q-card-section>
    </q-card>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useQuasar } from 'quasar'
import { useBillStore } from '../stores/billStore'

const billStore = useBillStore()
const $q = useQuasar()

// 响应式数据
const activeTab = ref('pending-invitations')
const loading = ref(false)
const pendingInvitations = ref([])
const pendingReviews = ref([])
const allBills = ref([])

// 统计数据
const statistics = computed(() => {
  // 确保数据存在且为数组
  const allBillsArray = Array.isArray(allBills.value) ? allBills.value : []
  const pendingInvitationsArray = Array.isArray(pendingInvitations.value) ? pendingInvitations.value : []
  const pendingReviewsArray = Array.isArray(pendingReviews.value) ? pendingReviews.value : []

  const totalBills = allBillsArray.length
  const invited = allBillsArray.filter(bill => bill.review_invited).length
  const positive = allBillsArray.filter(bill => bill.positive_review === true).length
  const pending = pendingInvitationsArray.length
  const pendingReviewCount = pendingReviewsArray.length

  return {
    pendingInvitations: pending,
    pendingReviews: pendingReviewCount,
    positiveReviews: positive,
    reviewRate: invited > 0 ? Math.round((positive / invited) * 100) : 0
  }
})

// 表格列定义
const invitationColumns = [
  { name: 'order_id', label: '订单号', field: 'order_id', align: 'left' },
  { name: 'guest_name', label: '客户姓名', field: 'guest_name', align: 'left' },
  { name: 'room_number', label: '房间号', field: 'room_number', align: 'center' },
  { name: 'check_in_date', label: '入住日期', field: 'check_in_date', align: 'center', format: val => formatDate(val) },
  { name: 'phone', label: '联系电话', field: 'phone', align: 'center' },
  { name: 'actions', label: '操作', field: 'actions', align: 'center' }
]

const reviewColumns = [
  { name: 'order_id', label: '订单号', field: 'order_id', align: 'left' },
  { name: 'guest_name', label: '客户姓名', field: 'guest_name', align: 'left' },
  { name: 'room_number', label: '房间号', field: 'room_number', align: 'center' },
  { name: 'review_invite_time', label: '邀请时间', field: 'review_invite_time', align: 'center', format: val => formatDateTime(val) },
  { name: 'phone', label: '联系电话', field: 'phone', align: 'center' },
  { name: 'actions', label: '操作', field: 'actions', align: 'center' }
]

const allReviewColumns = [
  { name: 'order_id', label: '订单号', field: 'order_id', align: 'left' },
  { name: 'guest_name', label: '客户姓名', field: 'guest_name', align: 'left' },
  { name: 'room_number', label: '房间号', field: 'room_number', align: 'center' },
  { name: 'create_time', label: '账单时间', field: 'create_time', align: 'center', format: val => formatDateTime(val) },
  { name: 'review_status', label: '评价状态', field: 'review_status', align: 'center' },
  { name: 'review_update_time', label: '评价时间', field: 'review_update_time', align: 'center', format: val => val ? formatDateTime(val) : '-' }
]

// 格式化日期
function formatDate(dateString) {
  if (!dateString) return '-'
  return new Date(dateString).toLocaleDateString('zh-CN')
}

// 格式化日期时间
function formatDateTime(dateString) {
  if (!dateString) return '-'
  return new Date(dateString).toLocaleString('zh-CN')
}

// 邀请好评
async function inviteReview(bill) {
  try {
    loading.value = true
    await billStore.inviteReview(bill.order_id)

    $q.notify({
      type: 'positive',
      message: `已成功邀请客户 ${bill.guest_name} 参与好评`,
      position: 'top'
    })

    // 刷新数据
    await fetchData()
  } catch (error) {
    console.error('邀请好评失败:', error)
    $q.notify({
      type: 'negative',
      message: '邀请好评失败: ' + (error.response?.data?.message || error.message),
      position: 'top'
    })
  } finally {
    loading.value = false
  }
}

// 设置评价状态
async function setReviewStatus(bill, isPositive) {
  try {
    loading.value = true
    await billStore.updateReviewStatus(bill.order_id, isPositive)

    $q.notify({
      type: 'positive',
      message: `已将客户 ${bill.guest_name} 的评价设置为${isPositive ? '好评' : '未好评'}`,
      position: 'top'
    })

    // 刷新数据
    await fetchData()
  } catch (error) {
    console.error('设置评价状态失败:', error)
    $q.notify({
      type: 'negative',
      message: '设置评价状态失败: ' + (error.response?.data?.message || error.message),
      position: 'top'
    })
  } finally {
    loading.value = false
  }
}

// 获取数据
async function fetchData() {
  try {
    loading.value = true

    // 并行获取所有数据
    const [pendingInvitationsData, pendingReviewsData, allBillsData] = await Promise.all([
      billStore.fetchPendingInvitations(),
      billStore.fetchPendingReviews(),
      billStore.fetchAllBills()
    ])

    // 确保数据为数组格式
    pendingInvitations.value = Array.isArray(pendingInvitationsData) ? pendingInvitationsData : []
    pendingReviews.value = Array.isArray(pendingReviewsData) ? pendingReviewsData : []
    allBills.value = Array.isArray(allBillsData) ? allBillsData : []

    console.log('获取数据成功:', {
      pendingInvitations: pendingInvitations.value.length,
      pendingReviews: pendingReviews.value.length,
      allBills: allBills.value.length
    })

  } catch (error) {
    console.error('获取数据失败:', error)

    // 设置默认空数组
    pendingInvitations.value = []
    pendingReviews.value = []
    allBills.value = []

    $q.notify({
      type: 'negative',
      message: '获取数据失败: ' + (error.response?.data?.message || error.message),
      position: 'top'
    })
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  fetchData()
})
</script>

<style scoped>
.review-management {
  max-width: 1200px;
  margin: 0 auto;
}
</style>
