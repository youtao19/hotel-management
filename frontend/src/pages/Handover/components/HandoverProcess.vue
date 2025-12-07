<template>
  <div class="handover-process">
    <div v-if="currentStep === 1" class="step-card">
      <q-card flat bordered>
        <q-card-section>
          <div class="row items-center q-mb-md">
            <div class="col">
              <div class="text-h6">
                <q-icon name="history" color="primary" class="q-mr-sm" />
                昨日交接记录检查
              </div>
              <div class="text-body2 text-grey-7">
                检查昨日是否有完整的交接记录，确保数据连续性
              </div>
            </div>
            <div class="col-auto">
              <q-btn
                color="primary"
                icon="search"
                label="检查昨日记录"
                @click="checkYesterdayRecord"
                :loading="isCheckingRecord"
                :disable="isCheckingRecord"
              />
            </div>
          </div>

          <div v-if="recordCheckResult.checked" class="q-mt-md">
            <q-banner
              :class="recordCheckResult.hasRecord ? 'bg-green-1 text-positive' : 'bg-orange-1 text-orange-9'"
              dense
              rounded
            >
              <template #avatar>
                <q-icon :name="recordCheckResult.hasRecord ? 'check_circle' : 'warning'" />
              </template>
              <div class="text-body1">
                {{ recordCheckResult.hasRecord ? '昨日记录完整' : '昨日记录缺失' }}（{{ recordCheckResult.yesterdayDate }}）
              </div>
              <div class="text-caption">
                找到 {{ recordCheckResult.recordCount }} 条记录，备用金：¥{{ recordCheckResult.reserveAmount.toFixed(2) }}
              </div>
            </q-banner>
          </div>
        </q-card-section>
      </q-card>
    </div>

    <div v-if="currentStep === 2" class="step-card">
      <q-card flat bordered>
        <q-card-section>
          <div class="text-h6 q-mb-md">
            <q-icon name="account_balance_wallet" color="primary" class="q-mr-sm" />
            备用金确认
          </div>
          <q-table
            :rows="pettyCashRows"
            :columns="pettyCashColumns"
            row-key="id"
            flat
            bordered
            hide-pagination
            :pagination="{ rowsPerPage: 0 }"
            class="reserve-cash-table"
          >
            <template #body-cell-cash="props">
              <q-td :props="props" class="input-cell">
                <q-input v-model.number="props.row.cash" type="number" dense borderless prefix="¥" @update:model-value="updateTotal" />
              </q-td>
            </template>
            <template #body-cell-wechat="props">
              <q-td :props="props" class="input-cell">
                <q-input v-model.number="props.row.wechat" type="number" dense borderless prefix="¥" @update:model-value="updateTotal" />
              </q-td>
            </template>
            <template #body-cell-weiyoufu="props">
              <q-td :props="props" class="input-cell">
                <q-input v-model.number="props.row.weiyoufu" type="number" dense borderless prefix="¥" @update:model-value="updateTotal" />
              </q-td>
            </template>
            <template #body-cell-other="props">
              <q-td :props="props" class="input-cell">
                <q-input v-model.number="props.row.other" type="number" dense borderless prefix="¥" @update:model-value="updateTotal" />
              </q-td>
            </template>
            <template #body-cell-total="props">
              <q-td :props="props" class="total-amount-cell">
                <div class="text-weight-bold text-primary total-amount">
                  ¥{{ props.row.total.toFixed(2) }}
                </div>
              </q-td>
            </template>
          </q-table>

          <div class="text-center q-mt-md">
            <q-btn color="positive" icon="check" label="确认备用金" @click="confirmReserveCash" />
          </div>
        </q-card-section>
      </q-card>
    </div>

    <div v-if="currentStep === 3" class="step-card">
      <CheckData
        :selected-date="selectedDate"
        :columns="roomColumns"
        :rows-hotel="hotelRoomData"
        :rows-rest="restRoomData"
        :rows-car="carIncomeData"
        :hotel-summary="hotelSummary"
        :rest-summary="restSummary"
        :car-summary="carSummary"
        :loading="isLoadingData"
        :confirming="isConfirmingData"
        :data-check-completed="dataCheckCompleted"
        :all-data-confirmed="allDataConfirmed"
        @update:date="updateDate"
        @confirm-row="onConfirmRow"
        @confirm-all="confirmAllRows"
        @confirm-data="confirmDataCheck"
      />
    </div>

    <div v-if="currentStep === 4" class="step-card">
      <q-card flat bordered>
        <q-card-section>
          <div class="text-h6 q-mb-md">
            <q-icon name="verified" color="primary" class="q-mr-sm" />
            确认交接数据
          </div>
          <ShiftHandoverPaymentTable
            :payment-data="confirmationData.paymentData"
            :read-only="false"
            @update-retained="handleRetainedAmountUpdate"
          />
          <div class="q-mt-lg">
            <ShiftHandoverSpecialStats
              :total-rooms="confirmationData.totalRooms"
              :rest-rooms="confirmationData.restRooms"
              :vip-cards="confirmationData.vipCards"
              :cashier-name="confirmationData.cashierName"
              :notes="confirmationData.notes"
              :good-review="confirmationData.goodReview"
              :read-only="false"
              @update:vip-cards="value => updateSpecialStats('vipCards', value)"
              @update:notes="value => updateSpecialStats('notes', value)"
              @update:good-review="value => updateSpecialStats('goodReview', value)"
            />
          </div>
        </q-card-section>
      </q-card>
    </div>

    <div v-if="currentStep === 5" class="step-card">
      <q-card flat bordered>
        <q-card-section>
          <div class="text-h6 q-mb-md">
            <q-icon name="person_add" color="primary" class="q-mr-sm" />
            接班人员信息
          </div>
          <div class="row q-gutter-md">
            <div class="col">
              <q-input v-model="handoverInfo.nextOperator" label="接班人员" outlined :rules="[val => !!val || '请输入接班人员姓名']" />
            </div>
            <div class="col">
              <q-input v-model="handoverInfo.handoverTime" label="交接时间" outlined type="datetime-local" />
            </div>
          </div>
          <div class="q-mt-md">
            <q-input v-model="handoverInfo.notes" type="textarea" label="交接备注" outlined rows="3" placeholder="请输入需要说明的事项..." />
          </div>
        </q-card-section>
      </q-card>
    </div>

    <div v-if="currentStep === 6" class="step-card">
      <HandoverComplete :handover-info="completeHandoverInfo" @logout="$emit('logout')" />
    </div>

    <div class="step-actions q-mt-lg">
      <q-btn v-if="currentStep > 1" color="grey-6" icon="arrow_back" label="上一步" class="q-mr-md" @click="previousStep" />
      <q-btn
        v-if="currentStep > 0 && currentStep < 5"
        color="primary"
        icon="arrow_forward"
        label="下一步"
        :loading="stepLoading"
        @click="nextStep"
      />
      <q-btn
        v-if="currentStep === 5"
        color="positive"
        icon="check"
        label="完成交接"
        :loading="stepLoading || submitting"
        @click="completeHandoverFlow"
      />
    </div>
  </div>
</template>

<script setup>
import { computed, ref, onMounted } from "vue";
import { useQuasar } from "quasar";
import { useUserStore } from "src/stores/userStore";
import { useShiftHandoverStore } from "src/stores/shiftHandoverStore";
import CheckData from "./CheckData.vue";
import ShiftHandoverPaymentTable from "./ShiftHandoverPaymentTable.vue";
import ShiftHandoverSpecialStats from "./ShiftHandoverSpecialStats.vue";
import HandoverComplete from "./HandoverComplete.vue";
import { useYesterdayRecord } from "../composables/useYesterdayRecord";
import { usePettyCash } from "../composables/usePettyCash";
import { useCheckDataLogic } from "../composables/useCheckDataLogic";
import { useHandoverSummary } from "../composables/useHandoverSummary";
import { useHandoverSubmit } from "../composables/useHandoverSubmit";

const props = defineProps({
  currentStep: {
    type: Number,
    required: true
  }
});

const emit = defineEmits(["step-change", "complete", "logout"]);

const $q = useQuasar();
const userStore = useUserStore();
const shiftHandoverStore = useShiftHandoverStore();

const { isCheckingRecord, recordCheckResult, checkYesterdayRecord } = useYesterdayRecord();

const { pettyCashRows, retainedAmounts, updateTotal, confirmReserveCash, mapReserveRowToBuckets, applyYesterdayReserve } = usePettyCash();
const pettyCashColumns = [
  { name: "label", label: "项目", field: "label", align: "left" },
  { name: "cash", label: "现金", field: "cash", align: "center" },
  { name: "wechat", label: "微信", field: "wechat", align: "center" },
  { name: "weiyoufu", label: "微邮付", field: "weiyoufu", align: "center" },
  { name: "other", label: "其他", field: "other", align: "center" },
  { name: "total", label: "合计", field: "total", align: "center" }
];

const {
  selectedDate,
  isLoadingData,
  isConfirmingData,
  dataCheckCompleted,
  hotelRoomData,
  restRoomData,
  carIncomeData,
  roomColumns,
  hotelSummary,
  restSummary,
  carSummary,
  allDataConfirmed,
  summaryDataObject,
  loadBillsData,
  confirmRow,
  confirmAllRows,
  confirmDataCheck,
  updateDate
} = useCheckDataLogic();

const reserveBuckets = computed(() => mapReserveRowToBuckets());
const { confirmationData, updateRetainedAmount, updateSpecialStats } = useHandoverSummary({
  summaryDataObject,
  reserveBuckets,
  retainedAmounts
});

const handoverInfo = ref({
  nextOperator: "",
  handoverTime: formatDateTimeLocal(new Date()),
  notes: ""
});

const { submitting, completeHandover } = useHandoverSubmit({
  confirmationData,
  handoverInfo,
  selectedHandoverDate: selectedDate
});

const stepLoading = ref(false);

const completeHandoverInfo = computed(() => ({
  currentOperator: userStore.user?.username || "交班人",
  nextOperator: handoverInfo.value.nextOperator || "接班人",
  completedTime: new Date().toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  })
}));

function formatDateTimeLocal(date) {
  const pad = (value) => String(value).padStart(2, "0");
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

const handleRetainedAmountUpdate = ({ payWay, value }) => updateRetainedAmount(payWay, value);

const onConfirmRow = ({ row }) => {
  confirmRow(row);
};

const nextStep = async () => {
  try {
    stepLoading.value = true;
    if (props.currentStep === 1 && !recordCheckResult.value.checked) {
      $q.notify({ type: "warning", message: "请先检查昨日交接记录", position: "top" });
      return;
    }
    if (props.currentStep === 1 && recordCheckResult.value.hasRecord) {
      applyYesterdayReserve(shiftHandoverStore.yesterdayHandoverAmounts || {});
    }
    if (props.currentStep === 3) {
      if (!dataCheckCompleted.value) {
        $q.notify({ type: "warning", message: "请完成数据核对", position: "top" });
        return;
      }
    }
    if (props.currentStep < 6) {
      emit("step-change", props.currentStep + 1);
    }
  } finally {
    stepLoading.value = false;
  }
};

const previousStep = () => {
  if (props.currentStep > 1) {
    emit("step-change", props.currentStep - 1);
  }
};

const completeHandoverFlow = async () => {
  const success = await completeHandover();
  if (success) {
    emit("step-change", 6);
    emit("complete");
  }
};

onMounted(() => {
  loadBillsData(selectedDate.value);
});
</script>

<style scoped>
.handover-process {
  width: 100%;
  max-width: 1000px;
}

.step-card {
  animation: slideIn 0.3s ease-out;
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.step-actions {
  display: flex;
  justify-content: flex-start;
  gap: 12px;
}

.reserve-cash-table :deep(.q-table__bottom) {
  display: none;
}

.reserve-cash-table :deep(th),
.reserve-cash-table :deep(td) {
  text-align: center;
}
</style>
