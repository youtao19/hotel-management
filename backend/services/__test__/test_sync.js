// test_sync.js
const douyinProductService = require('../douyinProductService'); // 路径根据你实际情况改

async function runTest() {
    console.log("🚀 开始测试抖音商品同步链路...");
    try {
        // 假设你要同步的本地套餐 ID 是 101
        const result = await douyinProductService.syncProductToDouyin(101);
        console.log("✅ 测试完美通过！最终返回结果:", result);
    } catch (error) {
        console.error("❌ 测试失败，拦截到错误:", error.message);
    } finally {
        process.exit(0); // 运行完自动退出 Node 进程
    }
}

runTest();
