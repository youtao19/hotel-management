<template>
  <!-- 历史记录对话框 -->
  <q-dialog v-model="showDialog" persistent>
    <q-card style="min-width: 800px; max-width: 1200px; width: 90vw;">
      <q-card-section class="row items-center q-pb-none">
        <div class="text-h6">交接班历史记录</div>
        <q-space />
        <q-btn icon="close" flat round dense @click="closeDialog" />
      </q-card-section>

      <q-card-section class="q-pt-none">
        <!-- 搜索和筛选 -->
        <div class="row q-gutter-md q-mb-md">
          <q-input
            v-model="historyFilter.cashierName"
            label="收银员姓名"
            dense
            outlined
            style="width: 200px"
            @update:model-value="loadHistoryRecords"
          />
          <q-input
            v-model="historyFilter.startDate"
            label="开始日期"
            type="date"
            dense
            outlined
            style="width: 200px"
            @update:model-value="loadHistoryRecords"
          />
          <q-input
            v-model="historyFilter.endDate"
            label="结束日期"
            type="date"
            dense
            outlined
            style="width: 200px"
            @update:model-value="loadHistoryRecords"
          />
          <q-btn color="primary" icon="search" label="搜索" @click="loadHistoryRecords" />
          <q-btn color="secondary" icon="refresh" label="刷新" @click="refreshHistory" />
        </div>

        <!-- 历史记录表格 -->
        <q-table
          :rows="historyRecords"
          :columns="historyColumns"
          row-key="id"
          :loading="historyLoading"
          :pagination="historyPagination"
          @request="onHistoryRequest"
          binary-state-sort
          class="history-table"
          style="max-height: 60vh;"
        >
          <template v-slot:body-cell-actions="props">
            <q-td :props="props">
              <q-btn
                size="sm"
                color="primary"
                icon="visibility"
                label="查看"
                @click="viewHistoryRecord(props.row)"
                class="q-mr-sm"
              />
              <q-btn
                size="sm"
                color="green"
                icon="download"
                label="导出"
                @click="exportHistoryRecord(props.row)"
                class="q-mr-sm"
              />
              <q-btn
                size="sm"
                color="negative"
                icon="delete"
                label="删除"
                @click="confirmDeleteRecord(props.row)"
              />
            </q-td>
          </template>
        </q-table>
      </q-card-section>
    </q-card>
  </q-dialog>

  <!-- 使用新的详情组件 -->
  <ShiftHandoverDetail
    ref="detailDialogRef"
    @close="onDetailDialogClose"
    @export="onExportDetail"
  />

  <!-- 删除确认对话框 -->
  <q-dialog v-model="showDeleteDialog" persistent>
    <q-card style="min-width: 400px;">
      <q-card-section class="row items-center">
        <q-avatar icon="warning" color="negative" text-color="white" />
        <span class="q-ml-sm text-h6">确认删除</span>
      </q-card-section>

      <q-card-section class="q-pt-none">
        <div class="text-body1">
          确定要删除这条交接班记录吗？
        </div>
        <div class="text-body2 text-grey-7 q-mt-sm" v-if="recordToDelete">
          <div><strong>日期：</strong>{{ formatDate(recordToDelete.shift_date) }}</div>
          <div><strong>收银员：</strong>{{ recordToDelete.cashier_name }}</div>
          <div><strong>类型：</strong>{{ recordToDelete.type === 'hotel' ? '客房' : '休息房' }}</div>
        </div>
        <div class="text-negative q-mt-md">
          <q-icon name="warning" class="q-mr-xs" />
          此操作不可撤销，请谨慎操作！
        </div>
      </q-card-section>

      <q-card-actions align="right">
        <q-btn flat label="取消" color="primary" @click="cancelDelete" />
        <q-btn
          label="确认删除"
          color="negative"
          @click="deleteRecord"
          :loading="deleting"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup>
import { ref, defineEmits, defineExpose } from 'vue'
import { useQuasar } from 'quasar'
import { shiftHandoverApi } from '../api/index.js'
import ShiftHandoverDetail from './ShiftHandoverDetail.vue'

const $q = useQuasar()

// 定义事件
const emit = defineEmits(['close'])

// 响应式数据
const showDialog = ref(false)
const historyRecords = ref([])
const historyLoading = ref(false)
const detailDialogRef = ref(null)

// 删除相关
const showDeleteDialog = ref(false)
const recordToDelete = ref(null)
const deleting = ref(false)

// 历史记录筛选条件
const historyFilter = ref({
  cashierName: '',
  startDate: '',
  endDate: ''
})

// 历史记录分页
const historyPagination = ref({
  sortBy: 'id',
  descending: true,
  page: 1,
  rowsPerPage: 10,
  rowsNumber: 0
})

// 历史记录表格列定义
const historyColumns = [
  {
    name: 'id',
    label: 'ID',
    field: 'id',
    sortable: true,
    align: 'left',
    style: 'width: 80px'
  },
  {
    name: 'shift_date',
    label: '日期',
    field: 'shift_date',
    sortable: true,
    align: 'center',
    format: (val) => val ? new Date(val).toLocaleDateString('zh-CN') : ''
  },
  {
    name: 'shift_time',
    label: '班次时间',
    field: 'shift_time',
    sortable: true,
    align: 'center'
  },
  {
    name: 'cashier_name',
    label: '收银员',
    field: 'cashier_name',
    sortable: true,
    align: 'center'
  },
  {
    name: 'handover_person',
    label: '交班人',
    field: 'handover_person',
    sortable: true,
    align: 'center',
    format: (val) => val || '-'
  },
  {
    name: 'receive_person',
    label: '接班人',
    field: 'receive_person',
    sortable: true,
    align: 'center',
    format: (val) => val || '-'
  },
  {
    name: 'type',
    label: '类型',
    field: 'type',
    sortable: true,
    align: 'center',
    format: (val) => val === 'hotel' ? '客房' : '休息房'
  },
  {
    name: 'total_income',
    label: '总收入',
    field: 'total_income',
    sortable: true,
    align: 'center',
    format: (val) => val ? `¥${parseFloat(val).toFixed(0)}` : '¥0'
  },
  {
    name: 'actions',
    label: '操作',
    field: 'actions',
    align: 'center',
    style: 'width: 200px'
  }
]

// 方法
async function loadHistoryRecords() {
  historyLoading.value = true
  try {
    const params = {
      page: historyPagination.value.page,
      limit: historyPagination.value.rowsPerPage,
      sortBy: historyPagination.value.sortBy,
      descending: historyPagination.value.descending,
      ...historyFilter.value
    }

    const response = await shiftHandoverApi.getHandoverHistory(params)
    historyRecords.value = response.data || []
    historyPagination.value.rowsNumber = response.total || 0
  } catch (error) {
    console.error('加载历史记录失败:', error)
    $q.notify({
      type: 'negative',
      message: '加载历史记录失败'
    })
  } finally {
    historyLoading.value = false
  }
}

async function onHistoryRequest(props) {
  const { page, rowsPerPage, sortBy, descending } = props.pagination

  historyPagination.value.page = page
  historyPagination.value.rowsPerPage = rowsPerPage
  historyPagination.value.sortBy = sortBy
  historyPagination.value.descending = descending

  await loadHistoryRecords()
}

function refreshHistory() {
  historyFilter.value = {
    cashierName: '',
    startDate: '',
    endDate: ''
  }
  historyPagination.value.page = 1
  loadHistoryRecords()
}

function viewHistoryRecord(record) {
  if (detailDialogRef.value) {
    detailDialogRef.value.openDialog(record)
  }
}

async function exportHistoryRecord(record) {
  try {
    await shiftHandoverApi.exportHandover(record)
    $q.notify({
      type: 'positive',
      message: '导出成功'
    })
  } catch (error) {
    console.error('导出失败:', error)
    $q.notify({
      type: 'negative',
      message: '导出失败'
    })
  }
}

function openDialog() {
  showDialog.value = true
  loadHistoryRecords()
}

function closeDialog() {
  showDialog.value = false
  emit('close')
}

function onDetailDialogClose() {
  // 详情对话框关闭时的处理
  console.log('详情对话框已关闭')
}

function onExportDetail(record) {
  // 处理详情导出
  exportHistoryRecord(record)
}

// 删除相关方法
function confirmDeleteRecord(record) {
  recordToDelete.value = record
  showDeleteDialog.value = true
}

function cancelDelete() {
  showDeleteDialog.value = false
  recordToDelete.value = null
}

async function deleteRecord() {
  if (!recordToDelete.value) return

  deleting.value = true
  try {
    await shiftHandoverApi.deleteHandoverRecord(recordToDelete.value.id)

    $q.notify({
      type: 'positive',
      message: '删除成功',
      position: 'top'
    })

    // 刷新列表
    await loadHistoryRecords()

    // 关闭对话框
    showDeleteDialog.value = false
    recordToDelete.value = null
  } catch (error) {
    console.error('删除交接班记录失败:', error)
    $q.notify({
      type: 'negative',
      message: '删除失败: ' + (error.response?.data?.message || error.message || '未知错误'),
      position: 'top'
    })
  } finally {
    deleting.value = false
  }
}

// 格式化日期的辅助方法
function formatDate(dateStr) {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleDateString('zh-CN')
}

function closeDetailDialog() {
  showHistoryDetailDialog.value = false
  selectedHistoryRecord.value = null
}

// 暴露方法给父组件
defineExpose({
  openDialog
})
</script>

<style scoped>
.history-table {
  margin-top: 16px;
}

.history-data {
  background-color: #f5f5f5;
  padding: 16px;
  border-radius: 8px;
  font-family: 'Courier New', monospace;
  font-size: 12px;
  max-height: 400px;
  overflow-y: auto;
  white-space: pre-wrap;
  word-wrap: break-word;
}

.remarks-content {
  background-color: #f9f9f9;
  padding: 12px;
  border-radius: 6px;
  border-left: 4px solid #2196f3;
}
</style>
