<template>
  <q-page class="douyin-room-page">
    <section class="page-hero">
      <div>
        <h1>抖音房型匹配</h1>
        <p>维护本地房型与抖音物理房型的一对一关系。</p>
      </div>
      <div class="hero-actions">
        <q-btn
          unelevated
          color="primary"
          icon="sync"
          label="刷新抖音房型"
          :loading="refreshing"
          @click="refreshDouyinRooms"
        />
        <q-btn
          flat
          color="primary"
          icon="refresh"
          label="刷新列表"
          :loading="loading"
          @click="fetchMappings"
        />
      </div>
    </section>

    <section class="summary-grid" aria-label="抖音房型匹配概览">
      <div class="summary-card">
        <q-icon name="category" />
        <div>
          <span>本地房型</span>
          <strong>{{ summary.localRoomTypeCount }}</strong>
        </div>
      </div>
      <div class="summary-card">
        <q-icon name="link" />
        <div>
          <span>已匹配</span>
          <strong>{{ summary.matchedCount }}</strong>
        </div>
      </div>
      <div class="summary-card">
        <q-icon name="link_off" />
        <div>
          <span>未匹配</span>
          <strong>{{ summary.unmatchedCount }}</strong>
        </div>
      </div>
      <div class="summary-card">
        <q-icon name="hotel" />
        <div>
          <span>抖音房型</span>
          <strong>{{ summary.douyinRoomCount }}</strong>
        </div>
      </div>
    </section>

    <section class="table-section">
      <q-table
        flat
        bordered
        row-key="localRoomType"
        :rows="mappingRows"
        :columns="columns"
        :loading="loading"
        :pagination="{ rowsPerPage: 20 }"
        no-data-label="暂无本地房型"
      >
        <template #body-cell-localRoomType="props">
          <q-td :props="props">
            <div class="room-type-name">{{ props.row.localRoomTypeName }}</div>
            <div class="room-type-code">{{ props.row.localRoomType }}</div>
          </q-td>
        </template>

        <template #body-cell-douyinRoom="props">
          <q-td :props="props">
            <q-select
              dense
              outlined
              emit-value
              map-options
              clearable
              option-value="value"
              option-label="label"
              option-disable="disable"
              class="room-select"
              :model-value="selectedRoomIds[props.row.localRoomType]"
              :options="getRoomOptions(props.row)"
              :disable="savingRoomTypes.includes(props.row.localRoomType)"
              @update:model-value="value => setSelectedRoom(props.row.localRoomType, value)"
            >
              <template #option="scope">
                <q-item v-bind="scope.itemProps">
                  <q-item-section>
                    <q-item-label>{{ scope.opt.label }}</q-item-label>
                    <q-item-label caption>{{ scope.opt.caption }}</q-item-label>
                  </q-item-section>
                  <q-item-section v-if="scope.opt.disable" side>
                    <q-badge color="grey-6" label="已绑定" />
                  </q-item-section>
                </q-item>
              </template>
            </q-select>
          </q-td>
        </template>

        <template #body-cell-status="props">
          <q-td :props="props">
            <q-badge
              rounded
              :color="getStatusMeta(props.row.matchStatus).color"
              :label="getStatusMeta(props.row.matchStatus).label"
            />
          </q-td>
        </template>

        <template #body-cell-actions="props">
          <q-td :props="props" class="actions-cell">
            <q-btn
              dense
              flat
              round
              color="primary"
              icon="save"
              :disable="!canSaveRow(props.row)"
              :loading="savingRoomTypes.includes(props.row.localRoomType)"
              @click="saveRowMapping(props.row)"
            >
              <q-tooltip>保存匹配</q-tooltip>
            </q-btn>
            <q-btn
              dense
              flat
              round
              color="negative"
              icon="link_off"
              :disable="!props.row.douyinRoomId || savingRoomTypes.includes(props.row.localRoomType)"
              @click="removeRowMapping(props.row)"
            >
              <q-tooltip>解除匹配</q-tooltip>
            </q-btn>
          </q-td>
        </template>
      </q-table>
    </section>
  </q-page>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useQuasar } from 'quasar'
import { douyinRoomMappingApi } from '../../api'

const $q = useQuasar()

const loading = ref(false)
const refreshing = ref(false)
const mappingRows = ref([])
const douyinRooms = ref([])
const selectedRoomIds = ref({})
const savingRoomTypes = ref([])
const summary = ref({
  localRoomTypeCount: 0,
  matchedCount: 0,
  unmatchedCount: 0,
  douyinRoomCount: 0
})

const columns = [
  { name: 'localRoomType', label: '本地房型', field: 'localRoomTypeName', align: 'left', sortable: true },
  { name: 'douyinRoom', label: '抖音物理房型', field: 'douyinRoomName', align: 'left' },
  { name: 'status', label: '状态', field: 'matchStatus', align: 'left', sortable: true },
  { name: 'actions', label: '操作', field: 'actions', align: 'right' }
]

const boundRoomMap = computed(() => {
  return douyinRooms.value.reduce((map, room) => {
    if (room.boundLocalRoomType) {
      map[room.roomId] = room.boundLocalRoomType
    }
    return map
  }, {})
})

function applyPageData(data) {
  summary.value = data?.summary || summary.value
  mappingRows.value = data?.items || []
  douyinRooms.value = data?.douyinRooms || []

  const nextSelected = {}
  for (const row of mappingRows.value) {
    nextSelected[row.localRoomType] = row.douyinRoomId || null
  }
  selectedRoomIds.value = nextSelected
}

async function fetchMappings() {
  loading.value = true
  try {
    const response = await douyinRoomMappingApi.getMappings()
    applyPageData(response.data)
  } catch (error) {
    console.error('获取抖音房型匹配失败:', error)
    $q.notify({ type: 'negative', message: getErrorMessage(error, '获取抖音房型匹配失败') })
  } finally {
    loading.value = false
  }
}

async function refreshDouyinRooms() {
  refreshing.value = true
  try {
    const response = await douyinRoomMappingApi.refreshRooms()
    applyPageData(response.data)
    const savedCount = response.data?.refresh?.savedCount || 0
    $q.notify({ type: 'positive', message: `已刷新 ${savedCount} 个抖音物理房型`, icon: 'sync' })
  } catch (error) {
    console.error('刷新抖音房型失败:', error)
    $q.notify({ type: 'negative', message: getErrorMessage(error, '刷新抖音房型失败') })
  } finally {
    refreshing.value = false
  }
}

function getRoomOptions(row) {
  return douyinRooms.value.map((room) => {
    const boundLocalRoomType = boundRoomMap.value[room.roomId]
    const disabledByOther = boundLocalRoomType && boundLocalRoomType !== row.localRoomType
    return {
      label: room.roomName || room.roomId,
      value: room.roomId,
      caption: room.roomId,
      disable: Boolean(disabledByOther)
    }
  })
}

function setSelectedRoom(localRoomType, douyinRoomId) {
  selectedRoomIds.value = {
    ...selectedRoomIds.value,
    [localRoomType]: douyinRoomId || null
  }
}

function canSaveRow(row) {
  const selected = selectedRoomIds.value[row.localRoomType]
  return Boolean(selected && selected !== row.douyinRoomId)
}

function setSaving(localRoomType, saving) {
  if (saving) {
    savingRoomTypes.value = [...savingRoomTypes.value, localRoomType]
    return
  }

  savingRoomTypes.value = savingRoomTypes.value.filter((item) => item !== localRoomType)
}

async function saveRowMapping(row) {
  const douyinRoomId = selectedRoomIds.value[row.localRoomType]
  if (!douyinRoomId) return

  setSaving(row.localRoomType, true)
  try {
    const response = await douyinRoomMappingApi.saveMappings({
      mappings: [
        {
          localRoomType: row.localRoomType,
          douyinRoomId
        }
      ]
    })
    applyPageData(response.data)
    $q.notify({ type: 'positive', message: '抖音房型匹配已保存', icon: 'check_circle' })
  } catch (error) {
    console.error('保存抖音房型匹配失败:', error)
    $q.notify({ type: 'negative', message: getErrorMessage(error, '保存抖音房型匹配失败') })
  } finally {
    setSaving(row.localRoomType, false)
  }
}

function removeRowMapping(row) {
  $q.dialog({
    title: '解除抖音房型匹配',
    message: `确认解除「${row.localRoomTypeName}」的抖音房型匹配？`,
    cancel: { label: '取消', flat: true, color: 'grey-7' },
    ok: { label: '解除', color: 'negative', icon: 'link_off' },
    persistent: true
  }).onOk(async () => {
    setSaving(row.localRoomType, true)
    try {
      const response = await douyinRoomMappingApi.deleteMapping(row.localRoomType)
      applyPageData(response.data)
      $q.notify({ type: 'positive', message: '抖音房型匹配已解除', icon: 'check_circle' })
    } catch (error) {
      console.error('解除抖音房型匹配失败:', error)
      $q.notify({ type: 'negative', message: getErrorMessage(error, '解除抖音房型匹配失败') })
    } finally {
      setSaving(row.localRoomType, false)
    }
  })
}

function getStatusMeta(status) {
  const statusMap = {
    MATCHED: { label: '已匹配', color: 'positive' },
    UNMATCHED: { label: '未匹配', color: 'grey-7' },
    MATCHED_BUT_ROOM_CACHE_MISSING: { label: '缓存缺失', color: 'warning' },
    DOUYIN_ROOM_INACTIVE: { label: '抖音房型下架', color: 'orange' }
  }

  return statusMap[status] || { label: '未知', color: 'grey-7' }
}

function getErrorMessage(error, fallback) {
  return error?.response?.data?.message
    || error?.response?.data?.error
    || error?.message
    || fallback
}

onMounted(fetchMappings)
</script>

<style scoped>
.douyin-room-page {
  --surface: #ffffff;
  --surface-muted: #f5f7fb;
  --line: #dfe6ef;
  --text-strong: #1d2433;
  --text-muted: #637083;
  min-height: 100%;
  background: var(--surface-muted);
  padding: 24px;
}

.page-hero {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 18px;
}

.page-hero h1 {
  margin: 0;
  color: var(--text-strong);
  font-size: 28px;
  font-weight: 700;
  line-height: 1.2;
}

.page-hero p {
  margin: 6px 0 0;
  color: var(--text-muted);
}

.hero-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 10px;
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 18px;
}

.summary-card {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 84px;
  padding: 16px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--surface);
}

.summary-card .q-icon {
  color: #126c59;
  font-size: 28px;
}

.summary-card span {
  display: block;
  color: var(--text-muted);
  font-size: 13px;
}

.summary-card strong {
  display: block;
  color: var(--text-strong);
  font-size: 24px;
  line-height: 1.1;
}

.table-section {
  background: var(--surface);
  border-radius: 8px;
}

.room-type-name {
  color: var(--text-strong);
  font-weight: 600;
}

.room-type-code {
  color: var(--text-muted);
  font-size: 12px;
}

.room-select {
  min-width: 280px;
}

.actions-cell {
  white-space: nowrap;
}

@media (max-width: 900px) {
  .douyin-room-page {
    padding: 16px;
  }

  .page-hero {
    display: block;
  }

  .hero-actions {
    justify-content: flex-start;
    margin-top: 14px;
  }

  .summary-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 560px) {
  .summary-grid {
    grid-template-columns: 1fr;
  }

  .room-select {
    min-width: 220px;
  }
}
</style>
