import { ref, computed } from "vue";
import { useUserStore } from "src/stores/userStore";
import { useDecimalUtils } from "./useDecimalUtils";

export function useHandoverSummary({ summaryDataObject, reserveBuckets, retainedAmounts }) {
  const userStore = useUserStore();
  const { PAY_WAY_KEYS, toDecimal, toAmountNumber, createPaywayBucket } = useDecimalUtils();

  const specialStats = ref({
    vipCards: 0,
    notes: "",
    goodReview: ""
  });

  const ensureBucket = (bucket) => (bucket ? { ...bucket } : createPaywayBucket());

  const confirmationData = computed(() => {
    const safeSummary = summaryDataObject?.value || {};
    const reserve = ensureBucket(reserveBuckets?.value);
    const hotelIncome = ensureBucket(safeSummary.hotelIncome);
    const restIncome = ensureBucket(safeSummary.restIncome);
    const carRentIncome = ensureBucket(safeSummary.carRentIncome);
    const hotelRefundDeposit = ensureBucket(safeSummary.hotelRefundDeposit);
    const restRefundDeposit = ensureBucket(safeSummary.restRefundDeposit);
    const totalRefundDeposit = createPaywayBucket();
    const retained = ensureBucket(retainedAmounts?.value);

    const totalIncome = createPaywayBucket();
    const handoverAmount = createPaywayBucket();

    PAY_WAY_KEYS.forEach((key) => {
      const incomeSum = toDecimal(reserve[key])
        .plus(hotelIncome[key])
        .plus(restIncome[key])
        .plus(carRentIncome[key]);
      totalIncome[key] = toAmountNumber(incomeSum);

      const refund = toDecimal(hotelRefundDeposit[key]).plus(restRefundDeposit[key]);
      totalRefundDeposit[key] = toAmountNumber(refund);

      const retainedValue = toDecimal(retained[key]);
      const handover = incomeSum.minus(refund).minus(retainedValue);
      handoverAmount[key] = toAmountNumber(handover);
    });

    return {
      paymentData: {
        reserve,
        hotelIncome,
        restIncome,
        carRentIncome,
        totalIncome,
        hotelRefundDeposit,
        restRefundDeposit,
        totalRefundDeposit,
        retainedAmount: retained,
        handoverAmount
      },
      totalRooms: safeSummary.totalRooms ?? 0,
      restRooms: safeSummary.restRooms ?? 0,
      vipCards: specialStats.value.vipCards,
      cashierName: userStore.user?.username || "交班人",
      notes: specialStats.value.notes,
      goodReview: specialStats.value.goodReview || "邀0得0",
      taskList: [],
      newTaskTitle: ""
    };
  });

  const updateRetainedAmount = (payWay, value) => {
    if (!retainedAmounts?.value) return;
    retainedAmounts.value = {
      ...retainedAmounts.value,
      [payWay]: toAmountNumber(value)
    };
  };

  const updateSpecialStats = (field, value) => {
    specialStats.value = {
      ...specialStats.value,
      [field]: value
    };
  };

  return {
    confirmationData,
    specialStats,
    updateRetainedAmount,
    updateSpecialStats
  };
}
