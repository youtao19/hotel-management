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
    // 留存款口径固定：现金留存 320，不受页面展示值影响。
    retainedAmounts.value = createPaywayBucket({ 现金: DEFAULT_CASH_RESERVE });
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
    // 备用金口径固定：现金320、微信取后端返回值、微邮付和其他固定0。
    pettyCashRows.value[0].cash = DEFAULT_CASH_RESERVE;
    pettyCashRows.value[0].wechat = Number(amounts.wechat) || 0;
    pettyCashRows.value[0].weiyoufu = 0;
    pettyCashRows.value[0].other = 0;
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
