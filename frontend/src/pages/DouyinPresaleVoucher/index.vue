<template>
  <q-page class="q-pa-lg">
    <!-- 页头导航与主要操作 -->
    <div class="row items-center justify-between q-mb-lg header-container">
      <div>
        <div class="row items-center q-gutter-x-sm">
          <q-icon name="confirmation_number" color="primary" size="28px" />
          <span class="text-h5 text-weight-bold text-grey-9">抖音预售券</span>
        </div>
        <div class="text-grey-7 text-caption q-mt-xs">
          一张券绑定一个已同步的预定商品，提交保存后将自动同步至抖音进行审核。
        </div>
      </div>
      <q-btn color="primary" icon="add" label="新增预售券" unelevated class="shadow-1 action-btn" @click="openDialog()" />
    </div>

    <!-- 预售券表格视图 -->
    <q-card flat bordered class="rounded-borders table-card">
      <q-table
        :rows="vouchers"
        :columns="columns"
        row-key="id"
        :loading="loading"
        flat
        class="custom-table"
      >
        <template #body-cell-name="props">
          <q-td :props="props">
            <div class="row items-center q-gutter-x-sm">
              <q-avatar color="blue-1" text-color="primary" icon="confirmation_number" size="32px" />
              <div>
                <div class="text-weight-bold text-grey-9">{{ props.row.name }}</div>
                <div class="text-caption text-grey-6">ID: {{ props.row.id }}</div>
              </div>
            </div>
          </q-td>
        </template>

        <template #body-cell-rate_plan_name="props">
          <q-td :props="props">
            <q-chip dense color="grey-2" text-color="grey-9" icon="inventory_2" class="q-px-xs">
              {{ props.row.rate_plan_name || '未绑定套餐' }}
            </q-chip>
          </q-td>
        </template>

        <template #body-cell-price="props">
          <q-td :props="props">
            <div class="text-weight-bold text-primary font-money">¥{{ props.row.actual_amount }}</div>
            <div class="text-caption text-grey-5 text-strike font-money">¥{{ props.row.original_amount }}</div>
          </q-td>
        </template>

        <template #body-cell-audit_status="props">
          <q-td :props="props">
            <q-chip dense :color="auditColor(props.row.audit_status)" text-color="white" class="q-px-sm">
              {{ auditLabel(props.row.audit_status) }}
            </q-chip>
            <div v-if="props.row.audit_message" class="text-caption text-negative q-mt-xs">{{ props.row.audit_message }}</div>
          </q-td>
        </template>

        <template #body-cell-product_status="props">
          <q-td :props="props">
            <q-chip dense :color="productStatusColor(props.row.product_status)" text-color="white" class="q-px-sm">
              {{ productStatusLabel(props.row.product_status) }}
            </q-chip>
            <div v-if="props.row.last_product_status_error" class="text-caption text-negative q-mt-xs">
              {{ props.row.last_product_status_error }}
            </div>
          </q-td>
        </template>

        <template #body-cell-actions="props">
          <q-td :props="props">
            <q-btn flat round dense color="primary" icon="edit" @click="openDialog(props.row)">
              <q-tooltip>编辑预售券</q-tooltip>
            </q-btn>
            <q-btn
              v-if="props.row.douyin_voucher_id && props.row.product_status !== 'ONLINE'"
              flat
              round
              dense
              color="positive"
              icon="visibility"
              :loading="statusOperatingId === props.row.id"
              @click="confirmProductStatus(props.row, 'ONLINE')"
            >
              <q-tooltip>上线抖音商品</q-tooltip>
            </q-btn>
            <q-btn
              v-if="props.row.douyin_voucher_id && props.row.product_status === 'ONLINE'"
              flat
              round
              dense
              color="warning"
              icon="visibility_off"
              :loading="statusOperatingId === props.row.id"
              @click="confirmProductStatus(props.row, 'OFFLINE')"
            >
              <q-tooltip>下线抖音商品</q-tooltip>
            </q-btn>
          </q-td>
        </template>
      </q-table>
    </q-card>

    <!-- 美化后的新增 / 编辑预售券弹窗 -->
    <q-dialog v-model="dialogOpen" persistent class="voucher-dialog-wrapper">
      <q-card class="voucher-card">
        <!-- 弹窗 Header 区域 -->
        <q-card-section class="dialog-heading">
          <div class="row items-center q-gutter-x-sm">
            <q-avatar color="blue-1" text-color="primary" icon="confirmation_number" size="42px" class="header-avatar" />
            <div>
              <div class="dialog-title">{{ editingVoucher ? '编辑抖音预售券' : '新增抖音预售券' }}</div>
              <div class="dialog-subtitle">保存后立即同步至抖音店铺；抖音审核结果将自动通过 Webhook 更新。</div>
            </div>
          </div>
          <q-btn flat round dense icon="close" class="dialog-close-btn" v-close-popup aria-label="关闭弹窗" />
        </q-card-section>

        <q-separator color="grey-3" />

        <q-form ref="formRef" @submit="submit" class="dialog-form">
          <q-card-section class="dialog-body scroll">
            <!-- 模块 1：基础信息 -->
            <div class="form-section">
              <div class="form-section-header">
                <q-icon name="info" color="primary" size="20px" />
                <span class="form-section-title">基础信息</span>
              </div>

              <div class="row q-col-gutter-md">
                <div class="col-12 col-md-6">
                  <div class="field-label">关联已同步套餐 <span class="text-negative">*</span></div>
                  <q-select
                    v-model="form.ratePlanId"
                    :options="ratePlanOptions"
                    emit-value
                    map-options
                    outlined
                    dense
                    placeholder="请选择绑定套餐"
                    :disable="Boolean(editingVoucher)"
                    :rules="[required]"
                    class="custom-field"
                  >
                    <template #prepend>
                      <q-icon name="card_membership" color="primary" />
                    </template>
                  </q-select>
                </div>

                <div class="col-12 col-md-6">
                  <div class="field-label">预售券名称 <span class="text-negative">*</span></div>
                  <q-input
                    v-model.trim="form.name"
                    outlined
                    dense
                    placeholder="如：双人豪华大床房2天1晚预售券"
                    :rules="[required]"
                    class="custom-field"
                  >
                    <template #prepend>
                      <q-icon name="label" color="primary" />
                    </template>
                  </q-input>
                </div>
              </div>
            </div>

            <!-- 模块 2：价格与库存 -->
            <div class="form-section">
              <div class="form-section-header">
                <q-icon name="payments" color="primary" size="20px" />
                <span class="form-section-title">价格与库存</span>
                <q-space />
                <div v-if="discountInfo" class="discount-badge">
                  <q-chip dense color="orange-1" text-color="orange-9" icon="local_offer">
                    {{ discountInfo.discount }} （立省 ¥{{ discountInfo.savings }}）
                  </q-chip>
                </div>
              </div>

              <div class="row q-col-gutter-md q-mb-sm">
                <div class="col-12 col-md-6">
                  <div class="field-label">划线原价 (元) <span class="text-negative">*</span></div>
                  <q-input
                    v-model.number="form.originalAmount"
                    outlined
                    dense
                    type="number"
                    min="0"
                    step="0.01"
                    prefix="¥"
                    placeholder="0.00"
                    :rules="[nonNegative]"
                    class="custom-field"
                  />
                </div>
                <div class="col-12 col-md-6">
                  <div class="field-label">实际售价 (元) <span class="text-negative">*</span></div>
                  <q-input
                    v-model.number="form.actualAmount"
                    outlined
                    dense
                    type="number"
                    min="0"
                    step="0.01"
                    prefix="¥"
                    placeholder="0.00"
                    :rules="[nonNegative]"
                    class="custom-field"
                  />
                </div>
              </div>

              <!-- 库存类型切换与数量输入 -->
              <div class="inventory-card row items-center justify-between q-pa-sm q-px-md rounded-borders">
                <div class="row items-center q-gutter-x-sm">
                  <q-icon :name="form.inventoryIsLimited ? 'inventory_2' : 'all_inclusive'" :color="form.inventoryIsLimited ? 'primary' : 'positive'" size="22px" />
                  <div>
                    <div class="text-weight-bold text-subtitle2">
                      {{ form.inventoryIsLimited ? '限制库存数量' : '无限库存' }}
                    </div>
                    <div class="text-caption text-grey-6">
                      {{ form.inventoryIsLimited ? '设置预售券售卖总量，售完即止' : '不限制售卖总量' }}
                    </div>
                  </div>
                </div>
                <q-toggle v-model="form.inventoryIsLimited" color="primary" />
              </div>

              <div v-if="form.inventoryIsLimited" class="q-mt-sm">
                <div class="field-label">库存数量 <span class="text-negative">*</span></div>
                <q-input
                  v-model.number="form.inventoryCount"
                  outlined
                  dense
                  type="number"
                  min="0"
                  placeholder="请输入预售券库存总数"
                  :rules="[nonNegative]"
                  class="custom-field"
                >
                  <template #prepend>
                    <q-icon name="inventory" color="primary" />
                  </template>
                </q-input>
              </div>

              <div class="row q-col-gutter-md q-mt-xs">
                <div class="col-12 col-md-6">
                  <div class="field-label">单用户累计限购 (张) <span class="text-negative">*</span></div>
                  <q-input
                    v-model.number="form.eachPersonMax"
                    outlined
                    dense
                    type="number"
                    min="1"
                    step="1"
                    placeholder="售卖期内最多购买张数"
                    :rules="[positiveInteger]"
                    class="custom-field"
                  >
                    <template #prepend>
                      <q-icon name="person" color="primary" />
                    </template>
                  </q-input>
                </div>
                <div class="col-12 col-md-6">
                  <div class="field-label">单笔限购 (张) <span class="text-negative">*</span></div>
                  <q-input
                    v-model.number="form.eachPersonEachOrderMax"
                    outlined
                    dense
                    type="number"
                    min="1"
                    step="1"
                    placeholder="每笔订单最多购买张数"
                    :rules="[positiveInteger, eachOrderLimit]"
                    class="custom-field"
                  >
                    <template #prepend>
                      <q-icon name="shopping_cart" color="primary" />
                    </template>
                  </q-input>
                </div>
              </div>

              <div class="q-mt-md">
                <div class="field-label">退款规则 <span class="text-negative">*</span></div>
                <q-select
                  v-model="form.cancelBookingType"
                  :options="cancelBookingTypeOptions"
                  emit-value
                  map-options
                  outlined
                  dense
                  :rules="[required]"
                  class="custom-field"
                >
                  <template #prepend>
                    <q-icon name="published_with_changes" color="primary" />
                  </template>
                </q-select>
                <div class="text-caption text-grey-6 q-mt-xs">“未使用自动退”会向抖音同步为“可取消”。</div>
              </div>
            </div>

            <!-- 模块 3：有效期限 -->
            <div class="form-section">
              <div class="form-section-header">
                <q-icon name="date_range" color="primary" size="20px" />
                <span class="form-section-title">有效期限</span>
              </div>

              <div class="row q-col-gutter-md">
                <!-- 售卖开始时间 -->
                <div class="col-12 col-md-6">
                  <div class="field-label">售卖开始时间 <span class="text-negative">*</span></div>
                  <q-input
                    v-model="form.saleStartAt"
                    outlined
                    dense
                    placeholder="YYYY-MM-DD HH:mm"
                    :rules="[required]"
                    class="custom-field"
                  >
                    <template #prepend>
                      <q-icon name="play_circle" color="positive" />
                    </template>
                    <template #append>
                      <q-icon name="event" class="cursor-pointer">
                        <q-popup-proxy cover transition-show="scale" transition-hide="scale">
                          <q-date
                            v-model="form.saleStartAt"
                            mask="YYYY-MM-DD HH:mm"
                            :options="saleStartDateOptions"
                            :navigation-min-year-month="minimumSaleStartAt ? minimumSaleStartAt.slice(0, 7).replace('-', '/') : undefined"
                          >
                            <div class="row items-center justify-end">
                              <q-btn v-close-popup label="确定" color="primary" flat />
                            </div>
                          </q-date>
                        </q-popup-proxy>
                      </q-icon>
                      <q-icon name="access_time" class="cursor-pointer q-ml-xs">
                        <q-popup-proxy cover transition-show="scale" transition-hide="scale">
                          <q-time v-model="form.saleStartAt" mask="YYYY-MM-DD HH:mm" format24h :options="saleStartTimeOptions">
                            <div class="row items-center justify-end">
                              <q-btn v-close-popup label="确定" color="primary" flat />
                            </div>
                          </q-time>
                        </q-popup-proxy>
                      </q-icon>
                    </template>
                  </q-input>
                </div>

                <!-- 售卖结束时间 -->
                <div class="col-12 col-md-6">
                  <div class="field-label">售卖结束时间 <span class="text-negative">*</span></div>
                  <q-input
                    v-model="form.saleEndAt"
                    outlined
                    dense
                    placeholder="YYYY-MM-DD HH:mm"
                    :rules="[required]"
                    class="custom-field"
                  >
                    <template #prepend>
                      <q-icon name="stop_circle" color="negative" />
                    </template>
                    <template #append>
                      <q-icon name="event" class="cursor-pointer">
                        <q-popup-proxy cover transition-show="scale" transition-hide="scale">
                          <q-date v-model="form.saleEndAt" mask="YYYY-MM-DD HH:mm" :options="saleEndDateOptions">
                            <div class="row items-center justify-end">
                              <q-btn v-close-popup label="确定" color="primary" flat />
                            </div>
                          </q-date>
                        </q-popup-proxy>
                      </q-icon>
                      <q-icon name="access_time" class="cursor-pointer q-ml-xs">
                        <q-popup-proxy cover transition-show="scale" transition-hide="scale">
                          <q-time v-model="form.saleEndAt" mask="YYYY-MM-DD HH:mm" format24h :options="saleEndTimeOptions">
                            <div class="row items-center justify-end">
                              <q-btn v-close-popup label="确定" color="primary" flat />
                            </div>
                          </q-time>
                        </q-popup-proxy>
                      </q-icon>
                    </template>
                  </q-input>
                </div>

                <!-- 可预约开始日期 -->
                <div class="col-12 col-md-6">
                  <div class="field-label">可预约开始日期 <span class="text-negative">*</span></div>
                  <q-input
                    v-model="form.bookStartDate"
                    outlined
                    dense
                    placeholder="YYYY-MM-DD"
                    :rules="[required]"
                    class="custom-field"
                  >
                    <template #prepend>
                      <q-icon name="calendar_today" color="primary" />
                    </template>
                    <template #append>
                      <q-icon name="event" class="cursor-pointer">
                        <q-popup-proxy cover transition-show="scale" transition-hide="scale">
                          <q-date v-model="form.bookStartDate" mask="YYYY-MM-DD">
                            <div class="row items-center justify-end">
                              <q-btn v-close-popup label="确定" color="primary" flat />
                            </div>
                          </q-date>
                        </q-popup-proxy>
                      </q-icon>
                    </template>
                  </q-input>
                </div>

                <!-- 可预约结束日期 -->
                <div class="col-12 col-md-6">
                  <div class="field-label">可预约结束日期 <span class="text-negative">*</span></div>
                  <q-input
                    v-model="form.bookEndDate"
                    outlined
                    dense
                    placeholder="YYYY-MM-DD"
                    :rules="[required]"
                    class="custom-field"
                  >
                    <template #prepend>
                      <q-icon name="event_busy" color="primary" />
                    </template>
                    <template #append>
                      <q-icon name="event" class="cursor-pointer">
                        <q-popup-proxy cover transition-show="scale" transition-hide="scale">
                          <q-date v-model="form.bookEndDate" mask="YYYY-MM-DD">
                            <div class="row items-center justify-end">
                              <q-btn v-close-popup label="确定" color="primary" flat />
                            </div>
                          </q-date>
                        </q-popup-proxy>
                      </q-icon>
                    </template>
                  </q-input>
                </div>
              </div>
            </div>

            <!-- 模块 4：展示图集 -->
            <div class="form-section">
              <div class="form-section-header">
                <q-icon name="collections" color="primary" size="20px" />
                <span class="form-section-title">展示图集</span>
                <q-space />
                <span class="text-caption text-grey-6">选择本机图片上传；第 1 张为头图</span>
              </div>

              <q-file
                v-model="selectedImages"
                outlined
                multiple
                use-chips
                accept="image/jpeg,image/png,image/webp"
                label="选择 JPG、PNG 或 WebP 图片"
                :disable="uploadingImages"
                :loading="uploadingImages"
                @update:model-value="uploadImages"
                class="custom-field q-mb-xs"
              >
                <template #prepend>
                  <q-icon name="add_photo_alternate" color="primary" />
                </template>
              </q-file>
              <div class="text-caption text-grey-6 q-mb-sm">单张不超过 5MB；上传后会自动生成 ngrok 公网链接。</div>
              <q-input v-show="false" :model-value="form.imageUrls.length" :rules="[validateImageUrls]" />

              <!-- 实时图片缩略图预览列表 -->
              <div v-if="previewImages.length > 0" class="image-preview-container">
                <div class="text-caption text-weight-bold text-grey-8 q-mb-xs">图片实时预览 ({{ previewImages.length }} 张):</div>
                <div class="row q-gutter-sm">
                  <div
                    v-for="(img, idx) in previewImages"
                    :key="idx"
                    class="preview-thumb-box"
                  >
                    <img :src="img" class="thumb-img" @error="onImgError($event)" />
                    <q-btn
                      round
                      dense
                      flat
                      size="sm"
                      icon="close"
                      color="negative"
                      class="thumb-remove-btn"
                      @click="removeImage(idx)"
                    >
                      <q-tooltip>移除图片</q-tooltip>
                    </q-btn>
                    <q-chip
                      dense
                      size="10px"
                      :color="idx === 0 ? 'primary' : 'grey-8'"
                      text-color="white"
                      class="thumb-badge"
                    >
                      {{ idx === 0 ? '头图' : `详情图 ${idx}` }}
                    </q-chip>
                  </div>
                </div>
              </div>
            </div>
          </q-card-section>

          <q-separator color="grey-3" />

          <!-- 底部操作按钮区域 -->
          <q-card-actions align="right" class="dialog-actions">
            <q-btn flat label="取消" color="grey-7" v-close-popup />
            <q-btn
              type="submit"
              color="primary"
              icon="cloud_upload"
              label="保存并同步"
              unelevated
              :loading="saving"
              class="submit-btn"
            />
          </q-card-actions>
        </q-form>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useQuasar } from 'quasar'
import { douyinPresaleVoucherApi, ratePlanApi } from 'src/api'

const $q = useQuasar()
const vouchers = ref([])
const ratePlans = ref([])
const loading = ref(false)
const saving = ref(false)
const statusOperatingId = ref(null)
const dialogOpen = ref(false)
const editingVoucher = ref(null)
const formRef = ref(null)
const form = ref(defaultForm())
const selectedImages = ref([])
const uploadingImages = ref(false)
const minimumSaleStartAt = ref('')

const columns = [
  { name: 'name', label: '预售券', field: 'name', align: 'left' },
  { name: 'rate_plan_name', label: '绑定套餐', field: 'rate_plan_name', align: 'left' },
  { name: 'price', label: '实际价 / 划线价', field: 'actual_amount', align: 'right' },
  { name: 'inventory_count', label: '库存总量', field: row => row.inventory_is_limited ? row.inventory_count : '无限库存', align: 'center' },
  { name: 'purchase_limit', label: '限购', field: row => `累计 ${row.each_person_max} 张 / 单笔 ${row.each_person_each_order_max} 张`, align: 'center' },
  { name: 'book_end_date', label: '可预约至', field: 'book_end_date', align: 'center' },
  { name: 'audit_status', label: '审核状态', field: 'audit_status', align: 'center' },
  { name: 'product_status', label: '商品状态', field: 'product_status', align: 'center' },
  { name: 'actions', label: '操作', field: 'actions', align: 'center' }
]

const cancelBookingTypeOptions = [
  { label: '未使用自动退', value: 1 },
  { label: '不可取消', value: 3 }
]

const ratePlanOptions = computed(() => ratePlans.value.filter(plan => plan.is_synced).map(plan => ({ label: `${plan.name}（${plan.douyin_rate_plan_id}）`, value: plan.id })))

/** 实时计算折扣率与立省金额，增强表单输入反馈。 */
const discountInfo = computed(() => {
  const orig = Number(form.value.originalAmount)
  const act = Number(form.value.actualAmount)
  if (orig > 0 && act >= 0 && orig > act) {
    const discount = ((act / orig) * 10).toFixed(1) + '折'
    const savings = (orig - act).toFixed(2)
    return { discount, savings }
  }
  return null
})

/** 返回已由后端生成的公网图片链接，作为券面预览数据源。 */
const previewImages = computed(() => form.value.imageUrls)

/** 当图片地址加载失败时回退为默认图例 Icon 标记，避免出现破碎裂图。 */
function onImgError(e) {
  console.error('[Douyin Presale Voucher] 图片预览加载失败:', e.target.currentSrc || e.target.src)
  e.target.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="60" height="60" viewBox="0 0 24 24" fill="%23ccc"><path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/></svg>'
}

/** 返回新增预售券的默认表单，售卖开始时间由后端按北京时间生成。 */
function defaultForm(saleStartAt = '') {
  return { ratePlanId: null, name: '', originalAmount: null, actualAmount: null, inventoryIsLimited: true, inventoryCount: null, eachPersonMax: 1, eachPersonEachOrderMax: 1, cancelBookingType: 1, saleStartAt, saleEndAt: '', bookStartDate: '', bookEndDate: '', imageUrls: [] }
}

/** 判断日期是否不早于服务器给出的最早售卖日期。 */
function saleStartDateOptions(date) {
  return date.replaceAll('/', '-') >= minimumSaleStartAt.value.slice(0, 10)
}

/** 当选择最早售卖日期时，屏蔽早于服务器默认时刻的时间。 */
function saleStartTimeOptions(hour, minute) {
  const selectedDate = form.value.saleStartAt.slice(0, 10)
  const minimumDate = minimumSaleStartAt.value.slice(0, 10)
  if (selectedDate > minimumDate) return true
  if (selectedDate < minimumDate) return false

  const minimumHour = Number(minimumSaleStartAt.value.slice(11, 13))
  const minimumMinute = Number(minimumSaleStartAt.value.slice(14, 16))
  if (hour > minimumHour) return true
  if (hour < minimumHour) return false
  return minute === null || minute >= minimumMinute
}

/** 屏蔽早于售卖开始日期的结束日期，避免无效时间段。 */
function saleEndDateOptions(date) {
  return !form.value.saleStartAt || date.replaceAll('/', '-') >= form.value.saleStartAt.slice(0, 10)
}

/** 同日结束时间必须晚于售卖开始时间，跨日时间可自由选择。 */
function saleEndTimeOptions(hour, minute) {
  if (form.value.saleEndAt.slice(0, 10) !== form.value.saleStartAt.slice(0, 10)) return true

  const startHour = Number(form.value.saleStartAt.slice(11, 13))
  const startMinute = Number(form.value.saleStartAt.slice(14, 16))
  if (hour > startHour) return true
  if (hour < startHour) return false
  return minute === null || minute > startMinute
}

/** 未输入内容时阻止提交，让后端不用承担纯界面必填提示。 */
function required(value) {
  return Boolean(value) || '请填写此项'
}

/** 价格和库存均不允许负数，最终业务校验仍由后端执行。 */
function nonNegative(value) {
  return (value !== null && value !== '' && Number(value) >= 0) || '请输入不小于 0 的数值'
}

/** 校验限购数量必须是大于零的整数，最终仍由后端保护业务约束。 */
function positiveInteger(value) {
  return (Number.isInteger(Number(value)) && Number(value) > 0) || '请输入大于 0 的整数'
}

/** 保证单笔购买数量不超过该用户在售卖期内的累计上限。 */
function eachOrderLimit(value) {
  return Number(value) <= Number(form.value.eachPersonMax) || '单笔限购不能大于单用户累计限购'
}

/** 确认至少有一张已由后端生成的公网券面图，后端仍会复核。 */
function validateImageUrls(value) {
  return Number(value) > 0 || '请至少上传一张图片'
}

/** 上传新选择的图片，并将后端生成的公网链接追加到券面图集。 */
async function uploadImages(files) {
  const images = Array.isArray(files) ? files : files ? [files] : []
  if (images.length === 0) return
  uploadingImages.value = true
  try {
    const response = await douyinPresaleVoucherApi.uploadImages(images)
    form.value.imageUrls.push(...response.data)
    console.log('[Douyin Presale Voucher] 图片上传地址:', response.data)
    selectedImages.value = []
    $q.notify({ type: 'positive', message: '图片已上传并生成公网链接' })
  } catch (error) {
    $q.notify({ type: 'negative', message: error?.response?.data?.message || '图片上传失败' })
  } finally {
    uploadingImages.value = false
  }
}

/** 移除不需要提交给抖音的券面图链接，不删除服务器上的历史上传文件。 */
function removeImage(index) {
  form.value.imageUrls.splice(index, 1)
}

/** 查询页面所需数据，套餐下拉只显示已得到抖音商品ID的记录。 */
async function load() {
  loading.value = true
  try {
    const [voucherResponse, planResponse] = await Promise.all([douyinPresaleVoucherApi.getVouchers(), ratePlanApi.getRatePlans()])
    vouchers.value = voucherResponse.data || []
    ratePlans.value = planResponse.data || []
  } catch (error) {
    $q.notify({ type: 'negative', message: error?.response?.data?.message || '获取预售券数据失败' })
  } finally {
    loading.value = false
  }
}

/** 打开编辑表单；新增时向后端获取北京时间两分钟后的默认售卖时间。 */
async function openDialog(voucher = null) {
  editingVoucher.value = voucher
  selectedImages.value = []
  if (!voucher) {
    try {
      const response = await douyinPresaleVoucherApi.getSaleTimeDefault()
      minimumSaleStartAt.value = response.data.saleStartAt
      form.value = defaultForm(response.data.saleStartAt)
    } catch (error) {
      $q.notify({ type: 'negative', message: error?.response?.data?.message || '获取售卖时间默认值失败' })
      return
    }
  } else {
    minimumSaleStartAt.value = ''
    form.value = {
      ratePlanId: voucher.rate_plan_id,
      name: voucher.name,
      originalAmount: Number(voucher.original_amount),
      actualAmount: Number(voucher.actual_amount),
      inventoryIsLimited: voucher.inventory_is_limited,
      inventoryCount: voucher.inventory_count,
      eachPersonMax: voucher.each_person_max,
      eachPersonEachOrderMax: voucher.each_person_each_order_max,
      cancelBookingType: Number(voucher.cancel_booking_type || 3),
      saleStartAt: voucher.sale_start_at ? voucher.sale_start_at.replace('T', ' ').slice(0, 16) : '',
      saleEndAt: voucher.sale_end_at ? voucher.sale_end_at.replace('T', ' ').slice(0, 16) : '',
      bookStartDate: voucher.book_start_date || '',
      bookEndDate: voucher.book_end_date || '',
      imageUrls: voucher.image_urls || []
    }
  }
  dialogOpen.value = true
}

/** 把多行图片和浏览器控件的本地日期时间转成后端约定的 YYYY-MM-DD HH:mm 格式。 */
function buildPayload() {
  const payload = form.value
  return {
    ...payload,
    ratePlanId: Number(payload.ratePlanId),
    originalAmount: Number(payload.originalAmount),
    actualAmount: Number(payload.actualAmount),
    inventoryCount: payload.inventoryIsLimited ? Number(payload.inventoryCount) : undefined,
    eachPersonMax: Number(payload.eachPersonMax),
    eachPersonEachOrderMax: Number(payload.eachPersonEachOrderMax),
    cancelBookingType: Number(payload.cancelBookingType),
    saleStartAt: payload.saleStartAt ? payload.saleStartAt.replace(/[T/]/g, match => match === 'T' ? ' ' : '-') : '',
    saleEndAt: payload.saleEndAt ? payload.saleEndAt.replace(/[T/]/g, match => match === 'T' ? ' ' : '-') : '',
    bookStartDate: payload.bookStartDate ? payload.bookStartDate.replaceAll('/', '-') : '',
    bookEndDate: payload.bookEndDate ? payload.bookEndDate.replaceAll('/', '-') : '',
    imageUrls: payload.imageUrls
  }
}

/** 保存后立即同步抖音，失败信息保留由后端返回的 logid 用于排查。 */
async function submit() {
  if (!await formRef.value.validate()) return
  saving.value = true
  try {
    const payload = buildPayload()
    if (editingVoucher.value) await douyinPresaleVoucherApi.updateVoucher(editingVoucher.value.id, payload)
    else await douyinPresaleVoucherApi.createVoucher(payload)
    $q.notify({ type: 'positive', message: '预售券已同步到抖音，等待审核结果' })
    dialogOpen.value = false
    await load()
  } catch (error) {
    const voucherId = error?.response?.data?.voucher_id
    if (!editingVoucher.value && Number.isInteger(voucherId)) {
      // 首次同步失败后本地草稿已存在，后续保存必须更新该草稿而非重复创建。
      editingVoucher.value = { id: voucherId }
    }
    $q.notify({ type: 'negative', message: error?.response?.data?.message || '同步预售券失败' })
  } finally {
    saving.value = false
  }
}

/** 将内部审核状态枚举转换为运营可读文本。 */
function auditLabel(status) {
  return ({ PENDING: '待审核', APPROVED: '审核通过', REJECTED: '审核未通过' })[status] || '待同步'
}

/** 审核失败突出显示，提醒运营修改后重新提交。 */
function auditColor(status) {
  return ({ PENDING: 'orange-8', APPROVED: 'positive', REJECTED: 'negative' })[status] || 'grey-7'
}

/** 返回抖音商品上架状态的运营展示文案。 */
function productStatusLabel(status) {
  return ({ ONLINE: '已上线', OFFLINE: '已下线' })[status] || '未操作'
}

/** 返回抖音商品上架状态的展示颜色。 */
function productStatusColor(status) {
  return ({ ONLINE: 'positive', OFFLINE: 'grey-7' })[status] || 'grey-6'
}

/** 二次确认后调用后端变更抖音商品的上架状态。 */
function confirmProductStatus(voucher, operation) {
  const isOnline = operation === 'ONLINE'
  $q.dialog({
    title: isOnline ? '上线预售券' : '下线预售券',
    message: `确认${isOnline ? '上线' : '下线'}「${voucher.name}」的抖音商品？`,
    cancel: { label: '取消', flat: true, color: 'grey-7' },
    ok: { label: isOnline ? '上线' : '下线', color: isOnline ? 'positive' : 'warning', icon: isOnline ? 'visibility' : 'visibility_off' },
    persistent: true
  }).onOk(async () => {
    statusOperatingId.value = voucher.id
    try {
      await douyinPresaleVoucherApi.updateProductStatus(voucher.id, operation)
      $q.notify({ type: 'positive', message: isOnline ? '预售券已上线' : '预售券已下线' })
      await load()
    } catch (error) {
      $q.notify({ type: 'negative', message: error?.response?.data?.message || '更新抖音商品状态失败' })
    } finally {
      statusOperatingId.value = null
    }
  })
}

onMounted(load)
</script>

<style scoped>
.voucher-dialog-wrapper :deep(.q-dialog__inner--minimized > div) {
  max-width: 840px;
  max-height: calc(100vh - 48px);
}

.voucher-card {
  width: min(840px, calc(100vw - 32px));
  max-width: 840px;
  max-height: calc(100vh - 48px);
  display: flex;
  flex-direction: column;
  border-radius: 16px;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.15);
  background: #ffffff;
  overflow: hidden;
}

.dialog-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px 16px;
  background: #ffffff;
  flex-shrink: 0;
}

.header-avatar {
  background: rgba(25, 118, 210, 0.08);
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
  margin-top: 2px;
}

.dialog-close-btn {
  color: #9ca3af;
  transition: color 0.2s ease;
}

.dialog-close-btn:hover {
  color: #374151;
}

.dialog-form {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.dialog-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding: 20px 24px 24px;
}

.form-section {
  background: #f9fafb;
  border: 1px solid #f3f4f6;
  border-radius: 12px;
  padding: 16px 20px;
}

.form-section-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 14px;
}

.form-section-title {
  font-size: 15px;
  font-weight: 700;
  color: #1f2937;
}

.field-label {
  font-size: 13px;
  font-weight: 600;
  color: #374151;
  margin-bottom: 6px;
}

.custom-field :deep(.q-field__control) {
  border-radius: 8px;
  background: #ffffff;
}

.inventory-card {
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
}

.image-preview-container {
  background: #ffffff;
  border: 1px dashed #d1d5db;
  border-radius: 8px;
  padding: 12px;
  margin-top: 8px;
}

.preview-thumb-box {
  position: relative;
  width: 76px;
  height: 76px;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid #e5e7eb;
  background: #f3f4f6;
}

.thumb-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.thumb-remove-btn {
  position: absolute;
  top: 0;
  right: 0;
  background: rgba(255, 255, 255, 0.82);
}

.thumb-badge {
  position: absolute;
  bottom: 4px;
  left: 50%;
  transform: translateX(-50%);
  white-space: nowrap;
  padding: 0 4px;
}

.dialog-actions {
  padding: 14px 24px;
  background: #f9fafb;
  border-top: 1px solid #f3f4f6;
  flex-shrink: 0;
}

.submit-btn {
  padding: 0 20px;
  font-weight: 600;
  border-radius: 8px;
}

.font-money {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}
</style>
