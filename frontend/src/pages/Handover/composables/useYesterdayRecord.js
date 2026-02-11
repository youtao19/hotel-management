import { ref } from "vue";
import { useQuasar } from "quasar";
import { shiftHandoverApi } from "src/api";
import { useDecimalUtils } from "./useDecimalUtils";

export function useYesterdayRecord() {
  const $q = useQuasar();
  const { sumDecimals, toAmountNumber } = useDecimalUtils();

  const isCheckingRecord = ref(false);
  const recordCheckResult = ref({
    checked: false,
    hasRecord: false,
    yesterdayDate: "",
    recordCount: 0,
    reserveAmount: 0,
    reserveDefaults: {
      cash: 320,
      wechat: 0,
      weiyoufu: 0,
      other: 0
    }
  });

  const formatLocalDate = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const checkYesterdayRecord = async () => {
    try {
      isCheckingRecord.value = true;
      recordCheckResult.value.checked = false;

      const now = new Date();
      const currentHour = now.getHours();

      // 当前营业日：如果还没到 8 点，视为上一营业日
      const currentBusinessDate = new Date(now);
      if (currentHour < 8) {
        currentBusinessDate.setDate(currentBusinessDate.getDate() - 1);
      }

      // 要交接的营业日 = 当前营业日的前一天
      const handoverBusinessDate = new Date(currentBusinessDate);
      handoverBusinessDate.setDate(handoverBusinessDate.getDate() - 1);

      // 需要检查的“昨日交接记录” = 要交接营业日的前一天
      const queryDate = new Date(handoverBusinessDate);
      queryDate.setDate(queryDate.getDate() - 1);
      const queryDateStr = formatLocalDate(queryDate);

      const response = await shiftHandoverApi.checkYesterdayRecord({ date: queryDateStr });
      if (!response.success) {
        throw new Error(response.message || "检查失败");
      }

      const { date, isComplete, paymentCount, handoverAmounts, reserveDefaults } = response.data || {};
      // 统一后端口径：现金固定320，微信来自昨日交接款，微邮付/其他固定为0。
      const normalizedReserveDefaults = {
        cash: 320,
        wechat: Number(reserveDefaults?.wechat) || 0,
        weiyoufu: 0,
        other: 0
      };
      recordCheckResult.value.checked = true;
      recordCheckResult.value.hasRecord = Boolean(isComplete);
      recordCheckResult.value.yesterdayDate = date || queryDateStr;
      recordCheckResult.value.recordCount = paymentCount || 0;
      recordCheckResult.value.reserveAmount = 0;
      recordCheckResult.value.reserveDefaults = normalizedReserveDefaults;

      if (isComplete && handoverAmounts) {
        const totalReserve = sumDecimals(
          handoverAmounts.cash,
          handoverAmounts.wechat,
          handoverAmounts.weiyoufu,
          handoverAmounts.other
        );
        recordCheckResult.value.reserveAmount = toAmountNumber(totalReserve);
        $q.notify({
          type: "positive",
          message: `昨日（${recordCheckResult.value.yesterdayDate}）交接记录完整，交接款 ¥${recordCheckResult.value.reserveAmount.toFixed(
            2
          )} 已保存`,
          position: "top"
        });
      } else {
        $q.notify({
          type: "warning",
          message: `昨日（${recordCheckResult.value.yesterdayDate}）无完整交接记录，微信备用金按 0 处理`,
          position: "top"
        });
      }
    } catch (error) {
      console.error("检查昨日交接记录失败:", error);
      $q.notify({
        type: "negative",
        message: error.message || "检查昨日交接记录失败，请稍后重试",
        position: "top"
      });
      recordCheckResult.value.checked = true;
      recordCheckResult.value.hasRecord = false;
      recordCheckResult.value.reserveDefaults = {
        cash: 320,
        wechat: 0,
        weiyoufu: 0,
        other: 0
      };
    } finally {
      isCheckingRecord.value = false;
    }
  };

  return {
    isCheckingRecord,
    recordCheckResult,
    checkYesterdayRecord
  };
}
