-- 来源快照标记用于冻结交接班统计口径，避免后续账单变动影响已交接数据。
COMMENT ON COLUMN handover.source_snapshot_created IS '是否已生成交接来源账单快照';
