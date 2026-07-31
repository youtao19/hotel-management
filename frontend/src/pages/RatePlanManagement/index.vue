<template>
  <q-page class="rate-plan-page">
    <section class="rate-plan-hero">
      <div>
        <div class="eyebrow">Rate Plan Control</div>
        <h1>售卖套餐</h1>
        <p>维护房型下可售卖的本地套餐，并查看渠道同步状态。</p>
      </div>

      <div class="stats-grid" aria-label="售卖套餐概览">
        <div class="metric-card">
          <span>套餐总数</span>
          <strong>{{ stats.total }}</strong>
        </div>
        <div class="metric-card">
          <span>启用中</span>
          <strong>{{ stats.active }}</strong>
        </div>
        <div class="metric-card">
          <span>钟点房</span>
          <strong>{{ stats.hourly }}</strong>
        </div>
        <div class="metric-card">
          <span>已同步</span>
          <strong>{{ stats.synced }}</strong>
        </div>
      </div>
    </section>

    <section class="rate-plan-toolbar">
      <q-select
        v-model="filters.roomTypeCode"
        :options="roomTypeFilterOptions"
        label="房型"
        emit-value
        map-options
        outlined
        dense
        clearable
        class="toolbar-field"
      />
      <q-input
        v-model.trim="filters.keyword"
        label="搜索套餐"
        outlined
        dense
        clearable
        class="toolbar-field keyword-field"
      >
        <template #prepend>
          <q-icon name="search" />
        </template>
      </q-input>
      <q-select
        v-model="filters.status"
        :options="statusFilterOptions"
        label="状态"
        emit-value
        map-options
        outlined
        dense
        clearable
        class="toolbar-field compact-field"
      />
      <q-select
        v-model="filters.salesType"
        :options="salesTypeFilterOptions"
        label="售卖类型"
        emit-value
        map-options
        outlined
        dense
        clearable
        class="toolbar-field compact-field"
      />

      <q-space />

      <q-btn
        flat
        round
        color="primary"
        icon="refresh"
        :loading="loading"
        aria-label="刷新售卖套餐"
        class="toolbar-icon-btn"
        @click="refreshAll"
      >
        <q-tooltip>刷新数据</q-tooltip>
      </q-btn>
      <q-btn
        color="primary"
        icon="add"
        label="新增套餐"
        unelevated
        class="primary-action"
        @click="openDialog()"
      />
    </section>

    <q-table
      :rows="filteredRatePlans"
      :columns="columns"
      row-key="id"
      :loading="loading"
      :pagination="{ rowsPerPage: 10 }"
      flat
      bordered
      class="rate-plan-table"
    >
      <template #body-cell-name="props">
        <q-td :props="props">
          <div class="plan-title">{{ props.row.name }}</div>
          <div class="plan-id">ID {{ props.row.id }}</div>
        </q-td>
      </template>

      <template #body-cell-room_type="props">
        <q-td :props="props">
          <q-badge outline color="teal-8" class="q-px-sm q-py-xs">
            {{ props.row.room_type_name || props.row.room_type_code }}
          </q-badge>
          <div class="code-text">{{ props.row.room_type_code }}</div>
        </q-td>
      </template>

      <template #body-cell-base_price="props">
        <q-td :props="props" class="text-right">
          <span class="price-text">¥{{ formatPrice(props.row.base_price) }}</span>
          <div class="code-text">{{ props.row.currency }}</div>
        </q-td>
      </template>

      <template #body-cell-sales_type="props">
        <q-td :props="props">
          <q-chip
            square
            dense
            :icon="getSalesTypeMeta(props.row.sales_type).icon"
            :color="getSalesTypeMeta(props.row.sales_type).color"
            text-color="white"
            class="status-chip"
          >
            {{ getSalesTypeMeta(props.row.sales_type).label }}
          </q-chip>
        </q-td>
      </template>

      <template #body-cell-status="props">
        <q-td :props="props">
          <q-chip
            square
            dense
            :icon="props.row.status === 1 ? 'check_circle' : 'pause_circle'"
            :color="props.row.status === 1 ? 'positive' : 'grey-7'"
            text-color="white"
            class="status-chip"
          >
            {{ props.row.status === 1 ? '启用' : '停用' }}
          </q-chip>
        </q-td>
      </template>

      <template #body-cell-channel="props">
        <q-td :props="props">
          <div v-if="props.row.is_synced" class="channel-state">
            <q-icon name="cloud_done" color="positive" size="18px" />
            <span>{{ props.row.douyin_rate_plan_id }}</span>
          </div>
          <div v-else class="channel-state muted">
            <q-icon name="cloud_off" color="grey-6" size="18px" />
            <span>未同步</span>
          </div>
        </q-td>
      </template>

      <template #body-cell-rules="props">
        <q-td :props="props">
          <div class="rule-summary">
            <span v-if="props.row.sales_type === 2">
              {{ props.row.hourly_earliest_check_in || '--:--' }}
              -
              {{ props.row.hourly_latest_check_out || '--:--' }}
              · {{ props.row.hourly_usage_duration || '-' }}小时
            </span>
            <span v-else-if="props.row.sales_type === 3">
              {{ props.row.midnight_enabled ? '凌晨房已启用' : '凌晨房未启用' }}
              <template v-if="props.row.midnight_latest_booking_time">
                · {{ props.row.midnight_latest_booking_time }}点前
              </template>
            </span>
            <span v-else>全日售卖</span>
          </div>
        </q-td>
      </template>

      <template #body-cell-actions="props">
        <q-td :props="props">
          <div class="row no-wrap justify-center q-gutter-xs">
            <q-btn
              flat
              round
              color="primary"
              icon="edit"
              aria-label="编辑售卖套餐"
              class="table-action-btn"
              @click="openDialog(props.row)"
            >
              <q-tooltip>编辑套餐</q-tooltip>
            </q-btn>
            <q-btn
              flat
              round
              :color="props.row.is_synced ? 'positive' : 'teal-8'"
              icon="cloud_sync"
              aria-label="同步到抖音"
              class="table-action-btn"
              :loading="isSyncingPlan(props.row.id)"
              :disable="props.row.sales_type === 3 || isSyncingPlan(props.row.id)"
              @click="confirmSyncDouyin(props.row)"
            >
              <q-tooltip>
                {{ getSyncTooltip(props.row) }}
              </q-tooltip>
            </q-btn>
            <q-btn
              flat
              round
              color="deep-orange-7"
              icon="published_with_changes"
              aria-label="通知抖音拉取价量态"
              class="table-action-btn"
              :loading="isNotifyingPlan(props.row.id)"
              :disable="!props.row.is_synced || isNotifyingPlan(props.row.id)"
              @click="openAriNotifyDialog(props.row)"
            >
              <q-tooltip>
                {{ props.row.is_synced ? '通知抖音拉取价量态' : '套餐同步到抖音后才能通知拉取' }}
              </q-tooltip>
            </q-btn>
            <q-btn
              flat
              round
              color="negative"
              icon="delete_outline"
              aria-label="删除售卖套餐"
              class="table-action-btn"
              @click="confirmDelete(props.row)"
            >
              <q-tooltip>{{ props.row.is_synced ? '已同步套餐由后端限制删除' : '删除套餐' }}</q-tooltip>
            </q-btn>
          </div>
        </q-td>
      </template>

      <template #no-data>
        <div class="empty-state">
          <q-icon name="inventory_2" size="42px" color="grey-5" />
          <div>暂无售卖套餐</div>
          <q-btn flat color="primary" icon="add" label="新增套餐" @click="openDialog()" />
        </div>
      </template>
    </q-table>

    <q-dialog v-model="dialogOpen" persistent class="rate-plan-dialog-wrapper">
      <q-card class="rate-plan-dialog">
        <!-- 弹窗头部：匹配设计图样式 -->
        <q-card-section class="dialog-heading">
          <div>
            <div class="dialog-title">{{ editingPlan ? '编辑售卖套餐' : '新增售卖套餐' }}</div>
            <div class="dialog-subtitle">创建后可在套餐列表继续编辑和上下架</div>
          </div>
          <q-btn
            flat
            round
            dense
            icon="close"
            class="dialog-close-btn"
            aria-label="关闭弹窗"
            @click="dialogOpen = false"
          />
        </q-card-section>

        <q-separator color="grey-3" />

        <q-form ref="formRef" @submit="submitForm">
          <q-card-section class="dialog-body">
            <!-- 基础信息板块 -->
            <div class="form-section">
              <div class="form-section-title">基础信息</div>

              <!-- 第1行：套餐名称 & 关联房型 -->
              <div class="row q-col-gutter-md q-mb-md">
                <div class="col-12 col-md-6">
                  <div class="field-label">套餐名称 <span class="text-negative">*</span></div>
                  <q-input
                    v-model.trim="form.name"
                    placeholder="例如：醉山塘·双人早餐套餐"
                    outlined
                    dense
                    class="custom-input"
                    :rules="[requiredRule('请输入套餐名称')]"
                  />
                </div>
                <div class="col-12 col-md-6">
                  <div class="field-label">关联房型 <span class="text-negative">*</span></div>
                  <q-select
                    v-model="form.room_type_code"
                    :options="roomTypeFormOptions"
                    placeholder="请选择关联房型"
                    emit-value
                    map-options
                    outlined
                    dense
                    class="custom-input"
                    :rules="[requiredRule('请选择房型')]"
                  />
                </div>
              </div>

              <!-- 第2行：售卖类型, 套餐售价, 状态 -->
              <div class="row q-col-gutter-md">
                <div class="col-12 col-md-4">
                  <div class="field-label">售卖类型 <span class="text-negative">*</span></div>
                  <q-select
                    v-model="form.sales_type"
                    :options="salesTypeOptions"
                    emit-value
                    map-options
                    outlined
                    dense
                    class="custom-input"
                  />
                </div>
                <div class="col-12 col-md-4">
                  <div class="field-label">套餐售价 <span class="text-negative">*</span></div>
                  <q-input
                    v-model.number="form.base_price"
                    type="number"
                    prefix="¥"
                    outlined
                    dense
                    class="custom-input price-input"
                    :rules="[requiredRule('请输入套餐售价'), nonNegativeRule]"
                  />
                </div>
                <div class="col-12 col-md-4">
                  <div class="field-label">状态 <span class="text-negative">*</span></div>
                  <q-select
                    v-model="form.status"
                    :options="statusOptions"
                    emit-value
                    map-options
                    outlined
                    dense
                    class="custom-input"
                  />
                </div>
              </div>

              <!-- 蓝条提示：房型基础价 -->
              <div class="info-tip-banner q-mt-md">
                <q-icon name="info" color="primary" size="18px" class="q-mr-xs" />
                <span class="info-tip-text">
                  房型基础价：<strong>¥ {{ selectedRoomTypeBasePrice || '260.00' }}</strong>
                </span>
              </div>
            </div>

            <!-- 售卖规则板块 -->
            <div class="form-section">
              <div class="form-section-title">售卖规则</div>

              <div class="row q-col-gutter-md">
                <!-- 售卖有效期 -->
                <div class="col-12 col-md-4">
                  <div class="rule-card" @click="toggleRuleDetails('validity')">
                    <div class="rule-card-icon-wrapper blue-bg">
                      <q-icon name="event" size="20px" color="primary" />
                    </div>
                    <div class="rule-card-content">
                      <div class="rule-card-title">售卖有效期</div>
                      <div class="rule-card-desc">{{ validityText }}</div>
                    </div>
                    <q-icon name="chevron_right" class="rule-card-arrow" />
                  </div>
                </div>

                <!-- 可订日期 -->
                <div class="col-12 col-md-4">
                  <div class="rule-card" @click="toggleRuleDetails('bookable')">
                    <div class="rule-card-icon-wrapper blue-bg">
                      <q-icon name="calendar_month" size="20px" color="primary" />
                    </div>
                    <div class="rule-card-content">
                      <div class="rule-card-title">可订日期</div>
                      <div class="rule-card-desc">{{ bookableText }}</div>
                    </div>
                    <q-icon name="chevron_right" class="rule-card-arrow" />
                  </div>
                </div>

                <!-- 取消规则 -->
                <div class="col-12 col-md-4">
                  <div class="rule-card" @click="toggleRuleDetails('cancel')">
                    <div class="rule-card-icon-wrapper blue-bg">
                      <q-icon name="shield" size="20px" color="primary" />
                    </div>
                    <div class="rule-card-content">
                      <div class="rule-card-title">取消规则</div>
                      <div class="rule-card-desc">{{ cancelRuleText }}</div>
                    </div>
                    <q-icon name="chevron_right" class="rule-card-arrow" />
                  </div>
                </div>
              </div>

              <!-- 特殊售卖类型 (钟点房 / 凌晨房) 的扩展配置 -->
              <div v-if="form.sales_type === 2" class="conditional-panel q-mt-sm">
                <div class="text-subtitle2 text-weight-bold q-mb-sm text-primary">钟点房特有规则</div>
                <div class="row q-col-gutter-md">
                  <div class="col-12 col-md-4">
                    <q-input
                      v-model.trim="form.hourly_earliest_check_in"
                      label="最早入住"
                      outlined
                      dense
                      mask="time"
                      placeholder="10:00"
                      :rules="[optionalTimeRule]"
                    />
                  </div>
                  <div class="col-12 col-md-4">
                    <q-input
                      v-model.trim="form.hourly_latest_check_out"
                      label="最晚离店"
                      outlined
                      dense
                      mask="time"
                      placeholder="18:00"
                      :rules="[optionalTimeRule]"
                    />
                  </div>
                  <div class="col-12 col-md-4">
                    <q-input
                      v-model.number="form.hourly_usage_duration"
                      label="使用时长"
                      type="number"
                      suffix="小时"
                      outlined
                      dense
                      :rules="[optionalRangeRule(1, 23, '使用时长为 1-23 小时')]"
                    />
                  </div>
                </div>
              </div>

              <div v-if="form.sales_type === 3" class="conditional-panel q-mt-sm">
                <div class="text-subtitle2 text-weight-bold q-mb-sm text-primary">凌晨房特有规则</div>
                <div class="row q-col-gutter-md items-center">
                  <div class="col-12 col-md-5">
                    <q-toggle
                      v-model="form.midnight_enabled"
                      color="primary"
                      label="启用凌晨房规则"
                    />
                  </div>
                  <div class="col-12 col-md-7">
                    <q-input
                      v-model.number="form.midnight_latest_booking_time"
                      label="最晚预定时间"
                      type="number"
                      suffix="点"
                      outlined
                      dense
                      :rules="[optionalRangeRule(1, 6, '最晚预定时间为 1-6 点')]"
                    />
                  </div>
                </div>
              </div>
            </div>

            <!-- 渠道配置板块 -->
            <div class="form-section">
              <div class="form-section-title">渠道配置</div>

              <div class="channel-card">
                <!-- 抖音渠道开关键 -->
                <div class="channel-row">
                  <div class="channel-info">
                    <div class="tiktok-badge">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M19.589 6.686a4.793 4.793 0 0 1-3.77-4.245V2h-3.445v13.672a2.896 2.896 0 1 1-2.896-2.896c.245 0 .484.032.713.09v-3.522a6.376 6.376 0 1 0 5.628 6.328V9.712a8.214 8.214 0 0 0 4.77 1.517V7.784a4.78 4.78 0 0 1-1.000-1.098z" fill="#ffffff"/>
                      </svg>
                    </div>
                    <div>
                      <div class="channel-name">抖音渠道</div>
                      <div class="channel-desc">开启后配置渠道专属参数</div>
                    </div>
                  </div>
                  <q-toggle
                    v-model="douyinChannelEnabled"
                    color="primary"
                    class="channel-toggle"
                  />
                </div>

                <!-- 高级 JSON 配置 折叠手风琴 -->
                <div class="json-config-accordion">
                  <div
                    class="json-config-header"
                    @click="showJsonConfig = !showJsonConfig"
                  >
                    <div class="json-config-title">
                      <q-icon name="code" size="18px" class="q-mr-xs text-grey-7" />
                      <span>高级 JSON 配置</span>
                    </div>
                    <q-icon
                      :name="showJsonConfig ? 'keyboard_arrow_up' : 'keyboard_arrow_down'"
                      size="20px"
                      color="grey-6"
                    />
                  </div>

                  <q-slide-transition>
                    <div v-show="showJsonConfig" class="json-config-body q-pt-sm">
                      <q-input
                        v-model="form.douyin_config_text"
                        placeholder="{}"
                        type="textarea"
                        outlined
                        dense
                        autogrow
                        class="json-textarea"
                        :rules="[jsonObjectRule]"
                      />
                    </div>
                  </q-slide-transition>
                </div>
              </div>
            </div>
          </q-card-section>

          <!-- 底部操作按钮 -->
          <q-card-actions align="right" class="dialog-actions">
            <q-btn
              flat
              label="取消"
              class="cancel-btn"
              @click="dialogOpen = false"
            />
            <q-btn
              type="submit"
              color="primary"
              label="保存"
              unelevated
              class="save-btn"
              :loading="saving"
            />
          </q-card-actions>
        </q-form>
      </q-card>
    </q-dialog>

    <!-- 售卖规则卡片详情子弹窗 -->
    <q-dialog v-model="ruleDetailDialogOpen">
      <q-card style="width: 400px; max-width: 90vw; border-radius: 12px;">
        <q-card-section class="row items-center q-pb-none">
          <div class="text-h6 text-weight-bold">{{ getRuleDetailTitle() }}</div>
          <q-space />
          <q-btn icon="close" flat round dense v-close-popup />
        </q-card-section>
        <q-card-section class="q-pt-md">
          <div class="text-body2 text-grey-8">
            {{ getRuleDetailContent() }}
          </div>
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="确定" color="primary" v-close-popup />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <q-dialog v-model="ariNotifyDialogOpen" persistent>
      <q-card class="ari-notify-dialog">
        <q-card-section class="dialog-heading">
          <div>
            <div class="text-h6">通知抖音拉取价量态</div>
            <div class="text-caption text-grey-7">
              当前套餐：{{ ariNotifyPlan?.name || '--' }}
            </div>
          </div>
          <q-btn
            flat
            round
            icon="close"
            aria-label="关闭价量态通知弹窗"
            @click="ariNotifyDialogOpen = false"
          />
        </q-card-section>

        <q-separator />

        <q-form ref="ariNotifyFormRef" @submit="submitAriNotify">
          <q-card-section class="dialog-body">
            <div class="row q-col-gutter-md">
              <div class="col-12 col-md-6">
                <q-input
                  v-model="ariNotifyForm.startDate"
                  label="开始日期"
                  type="date"
                  outlined
                  :rules="[requiredRule('请选择开始日期')]"
                />
              </div>
              <div class="col-12 col-md-6">
                <q-input
                  v-model="ariNotifyForm.endDate"
                  label="结束日期"
                  type="date"
                  outlined
                  :rules="[requiredRule('请选择结束日期'), endDateRule]"
                />
              </div>
              <div class="col-12">
                <q-input
                  v-model.trim="ariNotifyForm.accountId"
                  label="抖音 account_id（可选）"
                  outlined
                  hint="不填时使用后端配置的 DOUYIN_ACCOUNT_ID"
                />
              </div>
            </div>
          </q-card-section>

          <q-card-actions align="right" class="dialog-actions">
            <q-btn flat label="取消" color="grey-8" @click="ariNotifyDialogOpen = false" />
            <q-btn
              type="submit"
              color="primary"
              label="立即通知"
              icon="send"
              unelevated
              :loading="ariNotifySubmitting"
            />
          </q-card-actions>
        </q-form>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup>
import { computed, onActivated, onMounted, ref } from 'vue'
import { useQuasar } from 'quasar'
import { ratePlanApi, roomApi } from 'src/api'

const $q = useQuasar()

const salesTypeOptions = [
  { label: '全日房', value: 1, icon: 'hotel', color: 'teal-8' },
  { label: '钟点房', value: 2, icon: 'schedule', color: 'deep-orange-7' },
  { label: '凌晨房', value: 3, icon: 'nightlight', color: 'indigo-7' }
]

const statusOptions = [
  { label: '启用', value: 1 },
  { label: '停用', value: 0 }
]

const columns = [
  { name: 'name', label: '套餐', field: 'name', align: 'left', sortable: true, headerStyle: 'width: 13%;' },
  { name: 'room_type', label: '房型', field: 'room_type_code', align: 'left', sortable: true, headerStyle: 'width: 11%;' },
  { name: 'base_price', label: '基础价', field: 'base_price', align: 'right', sortable: true, headerStyle: 'width: 7%;' },
  { name: 'sales_type', label: '售卖类型', field: 'sales_type', align: 'center', sortable: true, headerStyle: 'width: 8%;' },
  { name: 'status', label: '状态', field: 'status', align: 'center', sortable: true, headerStyle: 'width: 7%;' },
  { name: 'rules', label: '规则摘要', field: 'sales_type', align: 'left', headerStyle: 'width: 7%;' },
  { name: 'channel', label: '抖音同步', field: 'is_synced', align: 'left', sortable: true, headerStyle: 'width: 180px;' },
  { name: 'updated_at', label: '更新时间', field: 'updated_at', align: 'left', sortable: true, headerStyle: 'width: 145px;' },
  { name: 'actions', label: '操作', field: 'actions', align: 'center', headerStyle: 'width: 155px;' }
]

const formRef = ref(null)
const ariNotifyFormRef = ref(null)
const ratePlans = ref([])
const roomTypes = ref([])
const loading = ref(false)
const saving = ref(false)
const syncingPlanIds = ref([])
const notifyingPlanIds = ref([])
const dialogOpen = ref(false)
const editingPlan = ref(null)
const ariNotifyDialogOpen = ref(false)
const ariNotifySubmitting = ref(false)
const ariNotifyPlan = ref(null)

// 抖音渠道开关状态及 JSON 面板折叠状态
const douyinChannelEnabled = ref(true)
const showJsonConfig = ref(false)

// 规则卡片摘要文案
const validityText = ref('长期有效')
const bookableText = ref('长期开放')
const cancelRuleText = ref('入住前 1 天免费取消')

// 规则卡片详情弹窗控制
const ruleDetailDialogOpen = ref(false)
const activeRuleType = ref('validity')

/**
 * 根据当前选中的房型代码，查找对应的房型基础价展示
 * 用于“基础信息”板块底部的蓝条提示
 */
const selectedRoomTypeBasePrice = computed(() => {
  if (!form.value.room_type_code) return null
  const targetRoomType = roomTypes.value.find(rt => rt.type_code === form.value.room_type_code)
  return targetRoomType ? formatPrice(targetRoomType.base_price) : null
})

/**
 * 打开售卖规则卡片对应的详情说明弹窗
 * @param {string} ruleType - 规则卡片类型: 'validity' | 'bookable' | 'cancel'
 */
function toggleRuleDetails(ruleType) {
  activeRuleType.value = ruleType
  ruleDetailDialogOpen.value = true
}

/**
 * 获取规则详情弹窗的标题
 */
function getRuleDetailTitle() {
  if (activeRuleType.value === 'validity') return '售卖有效期规则'
  if (activeRuleType.value === 'bookable') return '可订日期规则'
  return '取消规则说明'
}

/**
 * 获取规则详情弹窗的内容文本
 */
function getRuleDetailContent() {
  if (activeRuleType.value === 'validity') {
    return '当前套餐在售卖渠道中长期有效，如需设置特定上架时间段，可在保存后在套餐列表中管理上下架状态。'
  }
  if (activeRuleType.value === 'bookable') {
    return '客人可预订任意开放日期的房间。如需限制特殊节日或房型价格，可在房态房价日历中做针对性调整。'
  }
  return '客人可在预订入住日期前 1 天 24:00 前免费取消订单；逾期取消或未入住将扣除首晚房费。'
}

const filters = ref({
  roomTypeCode: '',
  keyword: '',
  status: null,
  salesType: null
})

const form = ref(createDefaultForm())
const ariNotifyForm = ref(createDefaultAriNotifyForm())

const roomTypeFilterOptions = computed(() => {
  return roomTypes.value.map(roomType => ({
    label: `${roomType.type_name} (${roomType.type_code})`,
    value: roomType.type_code
  }))
})

const roomTypeFormOptions = computed(() => roomTypeFilterOptions.value)

const statusFilterOptions = computed(() => statusOptions)
const salesTypeFilterOptions = computed(() => salesTypeOptions)

const filteredRatePlans = computed(() => {
  const keyword = filters.value.keyword.toLowerCase()

  return ratePlans.value.filter(plan => {
    const matchesRoomType = !filters.value.roomTypeCode || plan.room_type_code === filters.value.roomTypeCode
    const matchesStatus = filters.value.status === null || filters.value.status === undefined || plan.status === filters.value.status
    const matchesSalesType = filters.value.salesType === null || filters.value.salesType === undefined || plan.sales_type === filters.value.salesType
    const matchesKeyword = !keyword || [plan.name, plan.room_type_name, plan.room_type_code, plan.douyin_rate_plan_id]
      .filter(Boolean)
      .some(value => String(value).toLowerCase().includes(keyword))

    return matchesRoomType && matchesStatus && matchesSalesType && matchesKeyword
  })
})

const stats = computed(() => {
  return {
    total: ratePlans.value.length,
    active: ratePlans.value.filter(plan => plan.status === 1).length,
    hourly: ratePlans.value.filter(plan => plan.sales_type === 2).length,
    synced: ratePlans.value.filter(plan => plan.is_synced).length
  }
})

function createDefaultForm() {
  return {
    room_type_code: '',
    name: '',
    base_price: 0,
    status: 1,
    sales_type: 1,
    currency: 'CNY',
    hourly_earliest_check_in: '',
    hourly_latest_check_out: '',
    hourly_usage_duration: null,
    midnight_latest_booking_time: null,
    midnight_enabled: false,
    douyin_config_text: '{}'
  }
}

function createDefaultAriNotifyForm() {
  return {
    startDate: '',
    endDate: '',
    accountId: ''
  }
}

function getSalesTypeMeta(value) {
  return salesTypeOptions.find(option => option.value === value) || salesTypeOptions[0]
}

function formatPrice(value) {
  const amount = Number(value || 0)
  return amount.toFixed(2)
}

function requiredRule(message) {
  return value => (value !== null && value !== undefined && value !== '') || message
}

function nonNegativeRule(value) {
  return Number(value) >= 0 || '基础价不能小于 0'
}

function currencyRule(value) {
  return /^[A-Z]{3}$/.test(String(value || '')) || '请输入三位大写币种'
}

function optionalTimeRule(value) {
  if (!value) return true
  return /^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(String(value)) || '时间格式为 HH:mm'
}

function optionalRangeRule(min, max, message) {
  return value => {
    if (value === null || value === undefined || value === '') return true
    const numberValue = Number(value)
    return Number.isInteger(numberValue) && numberValue >= min && numberValue <= max || message
  }
}

function formatLocalDate(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function getDefaultAriDateRange() {
  const startDate = new Date()
  const endDate = new Date()
  endDate.setDate(endDate.getDate() + 1)

  return {
    startDate: formatLocalDate(startDate),
    endDate: formatLocalDate(endDate)
  }
}

function endDateRule(value) {
  if (!value || !ariNotifyForm.value.startDate) return true
  return value >= ariNotifyForm.value.startDate || '结束日期不能早于开始日期'
}

function parseJsonObject(text) {
  if (!String(text || '').trim()) return {}
  const parsed = JSON.parse(text)
  if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') {
    throw new Error('JSON 必须是对象')
  }
  return parsed
}

function jsonObjectRule(value) {
  try {
    parseJsonObject(value)
    return true
  } catch (error) {
    return error.message || 'JSON 格式错误'
  }
}

function appendIfPresent(payload, key, value) {
  if (value !== null && value !== undefined && value !== '') {
    payload[key] = value
  }
}

function appendNumberIfPresent(payload, key, value) {
  if (value !== null && value !== undefined && value !== '') {
    payload[key] = Number(value)
  }
}

function buildPayload() {
  const payload = {
    room_type_code: form.value.room_type_code,
    name: form.value.name,
    base_price: Number(form.value.base_price),
    status: Number(form.value.status),
    sales_type: Number(form.value.sales_type),
    currency: String(form.value.currency || 'CNY').trim().toUpperCase(),
    midnight_enabled: Boolean(form.value.midnight_enabled),
    douyin_config: parseJsonObject(form.value.douyin_config_text)
  }

  if (payload.sales_type === 2) {
    appendIfPresent(payload, 'hourly_earliest_check_in', form.value.hourly_earliest_check_in)
    appendIfPresent(payload, 'hourly_latest_check_out', form.value.hourly_latest_check_out)
    appendNumberIfPresent(payload, 'hourly_usage_duration', form.value.hourly_usage_duration)
  }

  if (payload.sales_type === 3) {
    appendNumberIfPresent(payload, 'midnight_latest_booking_time', form.value.midnight_latest_booking_time)
  }

  return payload
}

function getErrorMessage(error, fallback) {
  return error?.response?.data?.message || error?.message || fallback
}

function isSyncingPlan(id) {
  return syncingPlanIds.value.includes(Number(id))
}

function isNotifyingPlan(id) {
  return notifyingPlanIds.value.includes(Number(id))
}

function setSyncingPlan(id, syncing) {
  const normalizedId = Number(id)
  syncingPlanIds.value = syncing
    ? Array.from(new Set([...syncingPlanIds.value, normalizedId]))
    : syncingPlanIds.value.filter(planId => planId !== normalizedId)
}

function setNotifyingPlan(id, notifying) {
  const normalizedId = Number(id)
  notifyingPlanIds.value = notifying
    ? Array.from(new Set([...notifyingPlanIds.value, normalizedId]))
    : notifyingPlanIds.value.filter(planId => planId !== normalizedId)
}

function getSyncTooltip(plan) {
  if (plan.sales_type === 3) return '凌晨房暂不支持同步抖音'
  return plan.is_synced ? '更新抖音预定商品' : '同步到抖音'
}

async function fetchRatePlans() {
  const response = await ratePlanApi.getRatePlans()
  ratePlans.value = response.data || []
}

async function fetchRoomTypes() {
  const response = await roomApi.getRoomTypes()
  roomTypes.value = response.data || []
}

async function refreshAll() {
  loading.value = true
  try {
    await Promise.all([fetchRatePlans(), fetchRoomTypes()])
  } catch (error) {
    console.error('获取售卖套餐数据失败:', error)
    $q.notify({ type: 'negative', message: getErrorMessage(error, '获取售卖套餐数据失败') })
  } finally {
    loading.value = false
  }
}

function openDialog(plan = null) {
  editingPlan.value = plan
  form.value = plan
    ? {
        room_type_code: plan.room_type_code || '',
        name: plan.name || '',
        base_price: Number(plan.base_price || 0),
        status: Number(plan.status ?? 1),
        sales_type: Number(plan.sales_type ?? 1),
        currency: plan.currency || 'CNY',
        hourly_earliest_check_in: plan.hourly_earliest_check_in || '',
        hourly_latest_check_out: plan.hourly_latest_check_out || '',
        hourly_usage_duration: plan.hourly_usage_duration ?? null,
        midnight_latest_booking_time: plan.midnight_latest_booking_time ?? null,
        midnight_enabled: Boolean(plan.midnight_enabled),
        douyin_config_text: JSON.stringify(plan.douyin_config || {}, null, 2)
      }
    : createDefaultForm()

  douyinChannelEnabled.value = Boolean(plan ? plan.is_synced || (plan.douyin_config && Object.keys(plan.douyin_config).length > 0) : true)
  showJsonConfig.value = false
  dialogOpen.value = true
}

function openAriNotifyDialog(plan) {
  if (!plan?.is_synced || isNotifyingPlan(plan.id)) return

  ariNotifyPlan.value = plan
  ariNotifyForm.value = {
    ...createDefaultAriNotifyForm(),
    ...getDefaultAriDateRange()
  }
  ariNotifyDialogOpen.value = true
}

async function submitForm() {
  saving.value = true
  try {
    const valid = await formRef.value.validate()
    if (!valid) return

    const payload = buildPayload()
    if (editingPlan.value) {
      await ratePlanApi.updateRatePlan(editingPlan.value.id, payload)
      $q.notify({ type: 'positive', message: '售卖套餐已更新', icon: 'check_circle' })
    } else {
      await ratePlanApi.createRatePlan(payload)
      $q.notify({ type: 'positive', message: '售卖套餐已创建', icon: 'check_circle' })
    }

    dialogOpen.value = false
    await refreshAll()
  } catch (error) {
    console.error('保存售卖套餐失败:', error)
    $q.notify({ type: 'negative', message: getErrorMessage(error, '保存售卖套餐失败') })
  } finally {
    saving.value = false
  }
}

function confirmDelete(plan) {
  $q.dialog({
    title: '删除售卖套餐',
    message: `确认删除「${plan.name}」？`,
    cancel: { label: '取消', flat: true, color: 'grey-7' },
    ok: { label: '删除', color: 'negative', icon: 'delete_outline' },
    persistent: true
  }).onOk(async () => {
    try {
      await ratePlanApi.deleteRatePlan(plan.id)
      $q.notify({ type: 'positive', message: '售卖套餐已删除', icon: 'check_circle' })
      await refreshAll()
    } catch (error) {
      console.error('删除售卖套餐失败:', error)
      $q.notify({ type: 'negative', message: getErrorMessage(error, '删除售卖套餐失败') })
    }
  })
}

function confirmSyncDouyin(plan) {
  if (plan.sales_type === 3 || isSyncingPlan(plan.id)) return

  $q.dialog({
    title: plan.is_synced ? '更新抖音商品' : '同步抖音商品',
    message: `确认将「${plan.name}」同步到抖音预定商品？`,
    cancel: { label: '取消', flat: true, color: 'grey-7' },
    ok: { label: plan.is_synced ? '更新' : '同步', color: 'primary', icon: 'cloud_sync' },
    persistent: true
  }).onOk(async () => {
    setSyncingPlan(plan.id, true)
    try {
      const response = await ratePlanApi.syncDouyinRatePlan(plan.id)
      const douyinId = response?.data?.douyin?.douyinId || response?.data?.rate_plan?.douyin_rate_plan_id
      $q.notify({
        type: 'positive',
        message: getSyncSuccessMessage(douyinId),
        icon: 'cloud_done'
      })
      await refreshAll()
    } catch (error) {
      console.error('同步抖音商品失败:', error)
      $q.notify({ type: 'negative', message: getSyncErrorMessage(error) })
    } finally {
      setSyncingPlan(plan.id, false)
    }
  })
}

function getSyncSuccessMessage(douyinId) {
  return douyinId ? `抖音同步成功：${douyinId}` : '抖音同步成功'
}

function getSyncErrorMessage(error) {
  return getErrorMessage(error, '同步抖音商品失败')
}

async function submitAriNotify() {
  if (!ariNotifyPlan.value) return

  ariNotifySubmitting.value = true
  setNotifyingPlan(ariNotifyPlan.value.id, true)

  try {
    const valid = await ariNotifyFormRef.value.validate()
    if (!valid) return

    const payload = {
      localRatePlanIds: [ariNotifyPlan.value.id],
      startDate: ariNotifyForm.value.startDate,
      endDate: ariNotifyForm.value.endDate
    }

    if (ariNotifyForm.value.accountId) {
      payload.accountId = ariNotifyForm.value.accountId
    }

    const response = await ratePlanApi.notifyDouyinAri(payload)
    const douyinLogId = response?.data?.data?.douyinLogId

    $q.notify({
      type: 'positive',
      icon: 'task_alt',
      message: douyinLogId ? `已通知抖音拉取价量态，logid：${douyinLogId}` : '已通知抖音拉取价量态'
    })
    ariNotifyDialogOpen.value = false
  } catch (error) {
    console.error('通知抖音拉取价量态失败:', error)
    const douyinLogId = error?.response?.data?.douyin_log_id
    $q.notify({
      type: 'negative',
      message: douyinLogId
        ? `${getErrorMessage(error, '通知抖音拉取价量态失败')}，logid：${douyinLogId}`
        : getErrorMessage(error, '通知抖音拉取价量态失败')
    })
  } finally {
    ariNotifySubmitting.value = false
    if (ariNotifyPlan.value) {
      setNotifyingPlan(ariNotifyPlan.value.id, false)
    }
  }
}

onMounted(refreshAll)
onActivated(refreshAll)
</script>

<style scoped>
.rate-plan-page {
  --surface: #ffffff;
  --surface-muted: #f4f7f6;
  --ink: #17221f;
  --ink-soft: #5e6b67;
  --line: rgba(23, 34, 31, 0.11);
  --accent: #0f766e;
  --accent-dark: #115e59;
  --amber: #b7791f;

  min-height: 100vh;
  padding: 24px;
  background:
    linear-gradient(180deg, rgba(244, 247, 246, 0.96), rgba(249, 250, 248, 1)),
    repeating-linear-gradient(90deg, rgba(15, 118, 110, 0.04) 0 1px, transparent 1px 84px);
  color: var(--ink);
}

.rate-plan-hero {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(320px, 520px);
  gap: 24px;
  align-items: end;
  max-width: 1600px;
  margin: 0 auto 18px;
  padding: 24px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.82);
  box-shadow: 0 16px 36px rgba(23, 34, 31, 0.08);
}

.eyebrow {
  color: var(--accent-dark);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0;
  text-transform: uppercase;
}

.rate-plan-hero h1 {
  margin: 8px 0 6px;
  font-size: 36px;
  font-weight: 760;
  line-height: 1.12;
}

.rate-plan-hero p {
  max-width: 680px;
  margin: 0;
  color: var(--ink-soft);
  font-size: 15px;
  line-height: 1.6;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
}

.metric-card {
  min-height: 88px;
  padding: 14px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--surface);
}

.metric-card span {
  display: block;
  color: var(--ink-soft);
  font-size: 12px;
  line-height: 1.4;
}

.metric-card strong {
  display: block;
  margin-top: 8px;
  font-size: 28px;
  line-height: 1;
  font-variant-numeric: tabular-nums;
}

.rate-plan-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
  max-width: 1600px;
  margin: 0 auto;
  padding: 14px 20px;
  border: 1px solid var(--line);
  border-bottom: 0;
  border-radius: 8px 8px 0 0;
  background: var(--surface);
}

.toolbar-field {
  width: 150px;
}

.keyword-field {
  width: 200px;
}

.compact-field {
  width: 120px;
}

.toolbar-icon-btn {
  min-width: 38px;
  min-height: 38px;
}

.table-action-btn {
  min-width: 30px;
  min-height: 30px;
  width: 30px;
  height: 30px;
  padding: 0;
}

.primary-action {
  min-height: 38px;
  border-radius: 8px;
  background: var(--accent);
}

.rate-plan-table {
  max-width: 1600px;
  margin: 0 auto;
  border-color: var(--line);
  border-radius: 0 0 8px 8px;
  overflow: hidden;
  box-shadow: 0 18px 42px rgba(23, 34, 31, 0.08);
}

.rate-plan-table :deep(.q-table) {
  table-layout: fixed;
  width: 100%;
}

.rate-plan-table :deep(.q-table__top),
.rate-plan-table :deep(thead tr) {
  background: #f7faf8;
}

.rate-plan-table :deep(.q-table th) {
  color: #44524e;
  font-size: 12px;
  font-weight: 700;
  padding: 10px 4px;
  white-space: nowrap;
}

.rate-plan-table :deep(.q-table th:first-child),
.rate-plan-table :deep(.q-table td:first-child) {
  padding-left: 16px;
}

.rate-plan-table :deep(.q-table th:last-child),
.rate-plan-table :deep(.q-table td:last-child) {
  padding-right: 14px;
}

.rate-plan-table :deep(.q-table tbody td) {
  height: 60px;
  padding: 10px 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.rate-plan-table :deep(.q-table tbody tr:hover) {
  background: #f1f8f6;
}

.plan-title {
  color: var(--ink);
  font-weight: 700;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.plan-id,
.code-text,
.rule-summary,
.channel-state {
  color: var(--ink-soft);
  font-size: 12px;
  line-height: 1.5;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.price-text {
  color: var(--amber);
  font-size: 15px;
  font-weight: 760;
  font-variant-numeric: tabular-nums;
}

.status-chip {
  min-width: 68px;
  justify-content: center;
}

.channel-state {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--ink);
  font-variant-numeric: tabular-nums;
  max-width: 100%;
}

.channel-state span {
  white-space: nowrap;
  display: inline-block;
}

.channel-state.muted {
  color: var(--ink-soft);
}

.empty-state {
  display: flex;
  width: 100%;
  min-height: 180px;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  color: var(--ink-soft);
}

.rate-plan-dialog-wrapper :deep(.q-dialog__inner--minimized > div) {
  max-width: 920px;
}

.rate-plan-dialog {
  width: min(920px, calc(100vw - 32px));
  max-width: 920px;
  border-radius: 12px;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
  overflow: hidden;
  background: #ffffff;
}

.dialog-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px 16px;
  background: #ffffff;
}

.dialog-title {
  font-size: 18px;
  font-weight: 700;
  color: #111827;
  line-height: 1.3;
}

.dialog-subtitle {
  font-size: 13px;
  color: #6b7280;
  margin-top: 4px;
}

.dialog-close-btn {
  color: #9ca3af;
  transition: color 0.2s ease;
}

.dialog-close-btn:hover {
  color: #374151;
}

.dialog-body {
  display: flex;
  flex-direction: column;
  gap: 24px;
  padding: 20px 24px 24px;
}

.form-section {
  display: flex;
  flex-direction: column;
}

.form-section-title {
  color: #111827;
  font-size: 15px;
  font-weight: 700;
  margin-bottom: 14px;
}

.field-label {
  font-size: 13px;
  font-weight: 500;
  color: #374151;
  margin-bottom: 6px;
}

.custom-input :deep(.q-field__control) {
  border-radius: 6px;
  background: #ffffff;
}

.info-tip-banner {
  display: flex;
  align-items: center;
  background: #f0f5ff;
  border: 1px solid #dbeafe;
  border-radius: 8px;
  padding: 10px 14px;
  color: #2563eb;
  font-size: 13px;
}

.info-tip-text strong {
  color: #1d4ed8;
  font-weight: 700;
}

/* 售卖规则卡片 */
.rule-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.2s ease;
  user-select: none;
}

.rule-card:hover {
  border-color: #2563eb;
  box-shadow: 0 4px 12px rgba(37, 99, 235, 0.08);
  transform: translateY(-1px);
}

.rule-card-icon-wrapper {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.rule-card-icon-wrapper.blue-bg {
  background: #eff6ff;
}

.rule-card-content {
  flex: 1;
  min-width: 0;
}

.rule-card-title {
  font-size: 14px;
  font-weight: 600;
  color: #1f2937;
  line-height: 1.3;
}

.rule-card-desc {
  font-size: 12px;
  color: #6b7280;
  margin-top: 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.rule-card-arrow {
  color: #9ca3af;
  font-size: 18px;
  transition: transform 0.2s ease;
}

.rule-card:hover .rule-card-arrow {
  color: #2563eb;
  transform: translateX(2px);
}

/* 渠道配置 */
.channel-card {
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  padding: 16px;
}

.channel-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.channel-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.tiktok-badge {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: #000000;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.channel-name {
  font-size: 14px;
  font-weight: 600;
  color: #111827;
  line-height: 1.3;
}

.channel-desc {
  font-size: 12px;
  color: #6b7280;
  margin-top: 2px;
}

.json-config-accordion {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px dashed #e5e7eb;
}

.json-config-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  cursor: pointer;
  user-select: none;
  padding: 4px 0;
}

.json-config-title {
  display: flex;
  align-items: center;
  font-size: 13px;
  font-weight: 500;
  color: #4b5563;
}

.dialog-actions {
  padding: 16px 24px 20px;
  background: #ffffff;
  border-top: 1px solid #f3f4f6;
  gap: 12px;
}

.cancel-btn {
  min-width: 76px;
  height: 36px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  color: #374151;
  font-weight: 500;
  background: #ffffff;
}

.save-btn {
  min-width: 76px;
  height: 36px;
  border-radius: 6px;
  background: #165dff !important;
  color: #ffffff;
  font-weight: 500;
}

.conditional-panel {
  padding: 16px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #f9fafb;
}

.ari-notify-dialog {
  width: min(560px, calc(100vw - 32px));
  border-radius: 12px;
}

.ari-notify-dialog .dialog-heading {
  background: #ffffff;
}

@media (max-width: 1024px) {
  .rate-plan-hero {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 720px) {
  .rate-plan-page {
    padding: 12px;
  }

  .rate-plan-hero {
    padding: 18px;
  }

  .rate-plan-hero h1 {
    font-size: 28px;
  }

  .stats-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .toolbar-field,
  .keyword-field,
  .compact-field {
    width: 100%;
  }

  .rate-plan-toolbar .q-space {
    display: none;
  }

  .primary-action {
    width: 100%;
  }
}
</style>
