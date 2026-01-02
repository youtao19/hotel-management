import { ref, computed } from "vue";
import { useQuasar } from "quasar";
import { billApi } from "src/api";
import { useDecimalUtils } from "./useDecimalUtils";

export function useCheckDataLogic() {
  const $q = useQuasar();
  const { PAY_WAY_KEYS, toDecimal, toAmountNumber, createPaywayBucket, sumDecimals } = useDecimalUtils();

  const formatLocalDate = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const getDefaultDate = () => {
    const date = new Date();
    date.setDate(date.getDate() - 1);
    return formatLocalDate(date);
  };

  const selectedDate = ref(getDefaultDate());
  const isLoadingData = ref(false);
  const isConfirmingData = ref(false);
  const dataCheckCompleted = ref(false);

  const hotelRoomData = ref([]);
  const restRoomData = ref([]);
  const carIncomeData = ref([]);
  const backendSummaryDataObject = ref(null);

  const roomColumns = [
    { name: "billId", label: "账单ID", field: "billId", align: "left" },
    { name: "orderNo", label: "订单号", field: "orderNo", align: "left" },
    { name: "roomNo", label: "房号", field: "roomNo", align: "center" },
    { name: "guestName", label: "姓名", field: "guestName", align: "center" },
    { name: "changeType", label: "账单类型", field: "changeType", align: "center" },
    {
      name: "amount",
      label: "金额",
      field: "amount",
      align: "center",
      format: (val) => {
        if (val === 0) return "-";
        const prefix = val > 0 ? "+" : "";
        return `${prefix}¥${val.toFixed(2)}`;
      }
    },
    { name: "payWay", label: "支付方式", field: "payWay", align: "center" },
    { name: "actions", label: "操作", field: "actions", align: "center" }
  ];

  const summarizeRoomData = (rows = []) => {
    const totalDecimal = rows.reduce((sum, item) => sum.plus(toDecimal(item.amount || 0)), toDecimal(0));
    const byTypeDecimal = {};

    rows.forEach((bill) => {
      const type = bill.changeType || "未知";
      const amountDecimal = toDecimal(bill.amount || 0);
      if (!byTypeDecimal[type]) {
        byTypeDecimal[type] = amountDecimal;
      } else {
        byTypeDecimal[type] = byTypeDecimal[type].plus(amountDecimal);
      }
    });

    const byType = {};
    Object.keys(byTypeDecimal).forEach((key) => {
      byType[key] = toAmountNumber(byTypeDecimal[key]);
    });

    return {
      totalAmount: toAmountNumber(totalDecimal),
      byType
    };
  };

  const hotelSummary = computed(() => summarizeRoomData(hotelRoomData.value));
  const restSummary = computed(() => summarizeRoomData(restRoomData.value));
  const carSummary = computed(() => summarizeRoomData(carIncomeData.value));

  const allDataConfirmed = computed(() => {
    const hotel = hotelRoomData.value || [];
    const rest = restRoomData.value || [];
    const car = carIncomeData.value || [];
    const totalCount = hotel.length + rest.length + car.length;
    if (totalCount === 0) return true;
    return (
      hotel.every((item) => item.confirmed) &&
      rest.every((item) => item.confirmed) &&
      car.every((item) => item.confirmed)
    );
  });

  const summaryDataObject = computed(() => {
    if (backendSummaryDataObject.value) return backendSummaryDataObject.value;
    const buckets = {
      hotelIncome: createPaywayBucket(),
      restIncome: createPaywayBucket(),
      hotelRefundDeposit: createPaywayBucket(),
      restRefundDeposit: createPaywayBucket(),
      carRentIncome: createPaywayBucket()
    };

    const isRefund = (type) => ["退押", "退押金", "退款"].includes(type);
    const isIncome = (type) => ["房费", "收押", "补收", "订单账单"].includes(type);

    const accumulate = (rows, incomeBucket, refundBucket) => {
      rows.forEach((bill) => {
        const payWay = PAY_WAY_KEYS.includes(bill.payWay) ? bill.payWay : "其他";
        const amount = bill.amount || 0;
        if (isIncome(bill.changeType)) {
          buckets[incomeBucket][payWay] = toAmountNumber(sumDecimals(buckets[incomeBucket][payWay], amount));
        } else if (isRefund(bill.changeType)) {
          buckets[refundBucket][payWay] = toAmountNumber(
            sumDecimals(buckets[refundBucket][payWay], Math.abs(amount))
          );
        }
      });
    };

    accumulate(hotelRoomData.value, "hotelIncome", "hotelRefundDeposit");
    accumulate(restRoomData.value, "restIncome", "restRefundDeposit");
    accumulate(carIncomeData.value, "carRentIncome", "carRentIncome");

    return {
      ...buckets,
      totalRooms: hotelRoomData.value.length,
      restRooms: restRoomData.value.length
    };
  });

  const mapBillToRow = (bill) => {
    const normalizeAmount = () => {
      const raw = Number(bill.change_price ?? bill.amount ?? 0);
      if (["退押", "退押金", "退款"].includes(bill.change_type || bill.changeType)) {
        return -Math.abs(raw);
      }
      return raw;
    };

    return {
      billId: bill.bill_id ?? bill.billId ?? "",
      orderNo: bill.order_id ?? bill.orderNo ?? "",
      roomNo: bill.room_number ?? bill.roomNo ?? "未知",
      guestName: bill.guest_name ?? bill.guestName ?? "未知",
      changeType: bill.change_type ?? bill.changeType ?? "未知",
      amount: toAmountNumber(normalizeAmount()),
      payWay: bill.pay_way ?? bill.payWay ?? "其他",
      stayDate: bill.stay_date,
      createTime: bill.create_time,
      confirmed: false
    };
  };

  const loadBillsData = async (targetDate) => {
    try {
      isLoadingData.value = true;
      const dateToCheck = targetDate || selectedDate.value || formatLocalDate(new Date());
      selectedDate.value = dateToCheck;
      dataCheckCompleted.value = false;

      const response = await billApi.getBillsByDate(dateToCheck);
      if (!response.success) throw new Error(response.message || "加载失败");

      const { hotelBills = [], restBills = [], carBills = [] } = response.data || {};
      hotelRoomData.value = hotelBills.map(mapBillToRow);
      restRoomData.value = restBills.map(mapBillToRow);
      carIncomeData.value = carBills.map(mapBillToRow);
      backendSummaryDataObject.value = response.data?.summaryDataObject || null;
    } catch (error) {
      console.error("加载账单数据失败:", error);
      $q.notify({
        type: "negative",
        message: error.message || "加载账单数据失败，请重试",
        position: "top"
      });
      hotelRoomData.value = [];
      restRoomData.value = [];
      carIncomeData.value = [];
      backendSummaryDataObject.value = null;
    } finally {
      isLoadingData.value = false;
    }
  };

  const confirmRow = (row) => {
    row.confirmed = true;
  };

  const confirmAllRows = (type) => {
    let targetData = hotelRoomData.value;
    if (type === "rest") targetData = restRoomData.value;
    if (type === "car") targetData = carIncomeData.value;
    targetData.forEach((item) => (item.confirmed = true));
  };

  const confirmDataCheck = async () => {
    try {
      isConfirmingData.value = true;
      if (!allDataConfirmed.value) {
        $q.notify({
          type: "warning",
          message: "请先确认所有账单后再继续",
          position: "top"
        });
        return;
      }
      dataCheckCompleted.value = true;
      $q.notify({
        type: "positive",
        message: "账单核对完成",
        position: "top"
      });
    } finally {
      isConfirmingData.value = false;
    }
  };

  const updateDate = (value) => {
    if (!value) return;
    selectedDate.value = value;
    loadBillsData(value);
  };

  const exposeSummary = computed(() => ({
    summaryDataObject: summaryDataObject.value,
    hotelRoomData: hotelRoomData.value,
    restRoomData: restRoomData.value,
    carIncomeData: carIncomeData.value
  }));

  return {
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
    updateDate,
    exposeSummary
  };
}
