<template>
  <q-page class="douyin-sync-page">
    <div class="q-pa-md">
      <div class="row items-center q-mb-lg">
        <div class="col">
          <h1 class="text-h4 q-mb-none">抖音商品同步</h1>
          <p class="text-subtitle1 text-grey-7 q-mb-none">查看本地套餐与抖音售卖房型的同步状态</p>
        </div>
        <div class="col-auto">
          <q-btn
            color="primary"
            icon="refresh"
            label="刷新"
            :loading="loading"
            @click="fetchRatePlans"
          />
        </div>
      </div>

      <q-table
        flat
        bordered
        row-key="localRatePlanId"
        :rows="ratePlans"
        :columns="columns"
        :loading="loading"
        :pagination="{ rowsPerPage: 10 }"
        no-data-label="暂无套餐数据"
        class="rate-plan-table"
      >
        <template #body-cell-localDataStatus="props">
          <q-td :props="props">
            <q-chip
              dense
              square
              :color="getLocalDataColor(props.row.localDataStatus)"
              text-color="white"
            >
              {{ getLocalDataLabel(props.row.localDataStatus) }}
            </q-chip>
          </q-td>
        </template>

        <template #body-cell-douyinRoomName="props">
          <q-td :props="props">
            <div v-if="props.row.isDouyinRoomBound">
              <div class="text-weight-medium">{{ props.row.douyinRoomName || '-' }}</div>
              <div class="text-caption text-grey-7">{{ props.row.douyinRoomId }}</div>
            </div>
            <q-chip v-else dense square color="grey-6" text-color="white">未绑定</q-chip>
          </q-td>
        </template>

        <template #body-cell-syncStatus="props">
          <q-td :props="props">
            <q-chip
              dense
              square
              :color="props.row.isSynced ? 'positive' : 'grey-6'"
              text-color="white"
            >
              {{ props.row.isSynced ? '已同步' : '未同步' }}
            </q-chip>
            <div v-if="props.row.douyinRatePlanId" class="text-caption text-grey-7 q-mt-xs">
              {{ props.row.douyinRatePlanId }}
            </div>
          </q-td>
        </template>

        <template #body-cell-actions="props">
          <q-td :props="props">
            <q-btn
              color="primary"
              icon="cloud_sync"
              label="同步"
              dense
              unelevated
              :disable="!canSync(props.row)"
              :loading="syncingId === props.row.localRatePlanId"
              @click="syncRatePlan(props.row)"
            >
              <q-tooltip v-if="!canSync(props.row)">
                {{ getDisabledReason(props.row) }}
              </q-tooltip>
            </q-btn>
          </q-td>
        </template>
      </q-table>
    </div>
  </q-page>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { useQuasar } from 'quasar'
import { douyinApi } from '../../api'

const $q = useQuasar()
const loading = ref(false)
const syncingId = ref(null)
const ratePlans = ref([])

const columns = [
  { name: 'localRatePlanId', label: '套餐ID', field: 'localRatePlanId', align: 'left', sortable: true },
  { name: 'ratePlanName', label: '本地套餐', field: 'ratePlanName', align: 'left', sortable: true },
  { name: 'roomNumber', label: '房间', field: row => row.roomNumber || '-', align: 'left' },
  { name: 'localRoomTypeName', label: '本地房型', field: row => row.localRoomTypeName || row.localRoomType || '-', align: 'left' },
  { name: 'localDataStatus', label: '本地数据', field: 'localDataStatus', align: 'left' },
  { name: 'douyinRoomName', label: '抖音物理房型', field: 'douyinRoomName', align: 'left' },
  { name: 'syncStatus', label: '同步状态', field: 'syncStatus', align: 'left' },
  { name: 'actions', label: '操作', field: 'actions', align: 'right' }
]

function getErrorMessage(error) {
  return error?.response?.data?.message || error?.message || '操作失败'
}

function getLocalDataLabel(status) {
  const labelMap = {
    OK: '正常',
    ROOM_MISSING: '房间缺失',
    ROOM_TYPE_MISSING: '房型缺失'
  }
  return labelMap[status] || '未知'
}

function getLocalDataColor(status) {
  if (status === 'OK') return 'positive'
  if (status === 'ROOM_MISSING' || status === 'ROOM_TYPE_MISSING') return 'negative'
  return 'grey-6'
}

function canSync(row) {
  return row.localDataStatus === 'OK' && row.isDouyinRoomBound
}

function getDisabledReason(row) {
  if (row.localDataStatus !== 'OK') {
    return `本地数据异常：${getLocalDataLabel(row.localDataStatus)}`
  }
  if (!row.isDouyinRoomBound) {
    return '本地房型尚未绑定抖音物理房型'
  }
  return ''
}

async function fetchRatePlans() {
  loading.value = true
  try {
    const response = await douyinApi.getRatePlans()
    ratePlans.value = Array.isArray(response?.data) ? response.data : []
  } catch (error) {
    $q.notify({
      type: 'negative',
      message: getErrorMessage(error),
      position: 'top'
    })
  } finally {
    loading.value = false
  }
}

async function syncRatePlan(row) {
  syncingId.value = row.localRatePlanId
  try {
    const response = await douyinApi.syncRatePlan({
      localRatePlanId: row.localRatePlanId
    })
    const douyinRatePlanId = response.douyinRatePlanId || '未知'

    $q.notify({
      type: 'positive',
      message: `同步成功，抖音套餐ID：${douyinRatePlanId}`,
      position: 'top'
    })
    await fetchRatePlans()
  } catch (error) {
    $q.notify({
      type: 'negative',
      message: getErrorMessage(error),
      position: 'top'
    })
  } finally {
    syncingId.value = null
  }
}

onMounted(fetchRatePlans)
</script>

<style scoped>
.douyin-sync-page {
  background-color: #f5f5f5;
  min-height: 100vh;
}

.rate-plan-table {
  border-radius: 8px;
}

.rate-plan-table :deep(.q-table__top),
.rate-plan-table :deep(.q-table__bottom),
.rate-plan-table :deep(th) {
  background-color: #fafafa;
}

@media (max-width: 599px) {
  .rate-plan-table :deep(.q-table__container) {
    overflow-x: auto;
  }
}
</style>
