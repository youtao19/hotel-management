/**
 * 交接班日期计算逻辑测试
 * 用于验证前端日期计算是否正确
 */

// 辅助函数：将Date对象转换为本地日期字符串（YYYY-MM-DD）
function formatLocalDate(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function calculateHandoverDates(testTime) {
  const now = new Date(testTime)
  const currentHour = now.getHours()

  // 计算当前营业日
  let currentBusinessDate = new Date(now)
  if (currentHour < 8) {
    currentBusinessDate.setDate(currentBusinessDate.getDate() - 1)
  }

  // 计算要交接的营业日
  let handoverBusinessDate = new Date(currentBusinessDate)
  handoverBusinessDate.setDate(handoverBusinessDate.getDate() - 1)

  // 计算要查询的记录日期
  let queryDate = new Date(handoverBusinessDate)
  queryDate.setDate(queryDate.getDate() - 1)

  return {
    testTime: now.toLocaleString('zh-CN'),
    currentHour,
    currentBusinessDate: formatLocalDate(currentBusinessDate),
    handoverBusinessDate: formatLocalDate(handoverBusinessDate),
    queryDate: formatLocalDate(queryDate)
  }
}

console.log('='.repeat(80))
console.log('交接班日期计算逻辑测试')
console.log('='.repeat(80))

// 测试场景1：早上8点10分（正常交接时间）- 使用本地时区
console.log('\n【场景1】2025-10-08 08:10 - 正常交接时间')
const testDate1 = new Date(2025, 9, 8, 8, 10, 0) // 月份从0开始，9表示10月
const result1 = calculateHandoverDates(testDate1)
console.log(result1)
console.log('预期结果：')
console.log('  - 当前营业日：2025-10-08')
console.log('  - 要交接的营业日：2025-10-07')
console.log('  - 要查询的记录：2025-10-06')
console.log('  - 要保存的日期：2025-10-07')
console.log('实际结果：', result1.currentBusinessDate === '2025-10-08' &&
                           result1.handoverBusinessDate === '2025-10-07' &&
                           result1.queryDate === '2025-10-06' ? '✅ 通过' : '❌ 失败')

// 测试场景2：凌晨3点（补交接）- 使用本地时区
console.log('\n【场景2】2025-10-08 03:00 - 补交接昨天的记录')
const testDate2 = new Date(2025, 9, 8, 3, 0, 0) // 月份从0开始，9表示10月
const result2 = calculateHandoverDates(testDate2)
console.log(result2)
console.log('预期结果：')
console.log('  - 当前营业日：2025-10-07（还在10-07营业日范围内）')
console.log('  - 要交接的营业日：2025-10-06')
console.log('  - 要查询的记录：2025-10-05')
console.log('  - 要保存的日期：2025-10-06')
console.log('实际结果：', result2.currentBusinessDate === '2025-10-07' &&
                           result2.handoverBusinessDate === '2025-10-06' &&
                           result2.queryDate === '2025-10-05' ? '✅ 通过' : '❌ 失败')

// 测试场景3：下午3点
console.log('\n【场景3】2025-10-08 15:30 - 下午补交接')
const testDate3 = new Date(2025, 9, 8, 15, 30, 0)
const result3 = calculateHandoverDates(testDate3)
console.log(result3)
console.log('预期结果：')
console.log('  - 当前营业日：2025-10-08')
console.log('  - 要交接的营业日：2025-10-07')
console.log('  - 要查询的记录：2025-10-06')
console.log('  - 要保存的日期：2025-10-07')
console.log('实际结果：', result3.currentBusinessDate === '2025-10-08' &&
                           result3.handoverBusinessDate === '2025-10-07' &&
                           result3.queryDate === '2025-10-06' ? '✅ 通过' : '❌ 失败')

// 测试场景4：早上7点59分（临界点）
console.log('\n【场景4】2025-10-08 07:59 - 8点前临界点')
const testDate4 = new Date(2025, 9, 8, 7, 59, 0)
const result4 = calculateHandoverDates(testDate4)
console.log(result4)
console.log('预期结果：')
console.log('  - 当前营业日：2025-10-07')
console.log('  - 要交接的营业日：2025-10-06')
console.log('  - 要查询的记录：2025-10-05')
console.log('  - 要保存的日期：2025-10-06')
console.log('实际结果：', result4.currentBusinessDate === '2025-10-07' &&
                           result4.handoverBusinessDate === '2025-10-06' &&
                           result4.queryDate === '2025-10-05' ? '✅ 通过' : '❌ 失败')

// 测试场景5：早上8点整（临界点）
console.log('\n【场景5】2025-10-08 08:00 - 8点整临界点')
const testDate5 = new Date(2025, 9, 8, 8, 0, 0)
const result5 = calculateHandoverDates(testDate5)
console.log(result5)
console.log('预期结果：')
console.log('  - 当前营业日：2025-10-08')
console.log('  - 要交接的营业日：2025-10-07')
console.log('  - 要查询的记录：2025-10-06')
console.log('  - 要保存的日期：2025-10-07')
console.log('实际结果：', result5.currentBusinessDate === '2025-10-08' &&
                           result5.handoverBusinessDate === '2025-10-07' &&
                           result5.queryDate === '2025-10-06' ? '✅ 通过' : '❌ 失败')

console.log('\n' + '='.repeat(80))
console.log('测试完成')
console.log('='.repeat(80))
