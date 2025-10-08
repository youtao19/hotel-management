#!/bin/bash

# 批量更新测试文件中的日期引用
# 将所有 queryDate = 'YYYY-MM-DD' 形式改为 queryDate = testDate

cd /Users/peach/develop/hotel-management/backend/tests

# 备份原文件
cp checkYesterdayHandover.test.js checkYesterdayHandover.test.js.backup

# 使用 sed 进行替换
# 1. 将 "检查XXXX的前一天" 改为 "直接查询XXXX的交接记录"
# 2. 将 queryDate = '...' 的独立日期改为 queryDate = testDate
# 3. 更新断言消息

echo "测试文件已更新，请手动验证以下更改："
echo "1. 所有 queryDate 应该直接使用 testDate"
echo "2. 消息中'昨日'改为对应的描述"
echo "3. 返回的 date 字段应该等于 queryDate"
