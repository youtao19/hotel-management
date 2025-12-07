import { ref } from "vue";
import { useDecimalUtils } from "./useDecimalUtils";

const DEFAULT_CASH_RESERVE = 320;

export function usePettyCash() {
  const { toAmountNumber, sumDecimals, createPaywayBucket } = useDecimalUtils();

  const pettyCashRows = ref([
    {
      id: 1,
      label: "备用金",
      cash: DEFAULT_CASH_RESERVE,
      wechat: 0,
      weiyoufu: 0,
      other: 0,
      total: DEFAULT_CASH_RESERVE
    }
  ]);

  const retainedAmounts = ref(createPaywayBucket({ 现金: DEFAULT_CASH_RESERVE }));

  const updateTotal = () => {
    const row = pettyCashRows.value[0];
    const total = sumDecimals(row.cash, row.wechat, row.weiyoufu, row.other);
    row.total = toAmountNumber(total);
  };

  const confirmReserveCash = () => {
    updateTotal();
    retainedAmounts.value = createPaywayBucket({ 现金: pettyCashRows.value[0].cash });
  };

  const mapReserveRowToBuckets = () => {
    const reserveCash = pettyCashRows.value[0] || { cash: 0, wechat: 0, weiyoufu: 0, other: 0 };
    return createPaywayBucket({
      现金: reserveCash.cash,
      微信: reserveCash.wechat,
      微邮付: reserveCash.weiyoufu,
      其他: reserveCash.other
    });
  };

  const applyYesterdayReserve = (amounts = {}) => {
    pettyCashRows.value[0].cash = DEFAULT_CASH_RESERVE;
    pettyCashRows.value[0].wechat = amounts.wechat || 0;
    pettyCashRows.value[0].weiyoufu = amounts.weiyoufu || 0;
    pettyCashRows.value[0].other = amounts.other || 0;
    updateTotal();
  };

  return {
    DEFAULT_CASH_RESERVE,
    pettyCashRows,
    retainedAmounts,
    updateTotal,
    confirmReserveCash,
    mapReserveRowToBuckets,
    applyYesterdayReserve
  };
}
