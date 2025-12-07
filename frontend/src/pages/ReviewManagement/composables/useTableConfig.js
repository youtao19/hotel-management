// 定义表格列与时间格式化工具，保持配置与业务逻辑解耦
export function useTableConfig() {
  const invitationColumns = [
    { name: "order_id", label: "订单号", field: "order_id", align: "left" },
    { name: "guest_name", label: "客户姓名", field: "guest_name", align: "left" },
    { name: "room_number", label: "房间号", field: "room_number", align: "center" },
    { name: "check_in_date", label: "入住日期", field: "check_in_date", align: "center", format: val => formatDate(val) },
    { name: "phone", label: "联系电话", field: "phone", align: "center" },
    { name: "actions", label: "操作", field: "actions", align: "center" }
  ];

  const reviewColumns = [
    { name: "order_id", label: "订单号", field: "order_id", align: "left" },
    { name: "guest_name", label: "客户姓名", field: "guest_name", align: "left" },
    { name: "room_number", label: "房间号", field: "room_number", align: "center" },
    { name: "review_invite_time", label: "邀请时间", field: "review_invite_time", align: "center", format: val => formatDateTime(val) },
    { name: "phone", label: "联系电话", field: "phone", align: "center" },
    { name: "actions", label: "操作", field: "actions", align: "center" }
  ];

  const allReviewColumns = [
    { name: "order_id", label: "订单号", field: "order_id", align: "left" },
    { name: "guest_name", label: "客户姓名", field: "guest_name", align: "left" },
    { name: "room_number", label: "房间号", field: "room_number", align: "center" },
    { name: "create_time", label: "下单时间", field: "create_time", align: "center", format: val => formatDateTime(val) },
    { name: "review_status", label: "评价状态", field: "review_status", align: "center" },
    { name: "review_update_time", label: "评价时间", field: "review_update_time", align: "center", format: val => val ? formatDateTime(val) : "-" }
  ];

  return {
    invitationColumns,
    reviewColumns,
    allReviewColumns,
    formatDate,
    formatDateTime
  };
}

function formatDate(dateString) {
  if (!dateString) return "-";
  return new Date(dateString).toLocaleDateString("zh-CN");
}

function formatDateTime(dateString) {
  if (!dateString) return "-";
  return new Date(dateString).toLocaleString("zh-CN");
}
