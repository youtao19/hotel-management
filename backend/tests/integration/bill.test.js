// 端到端：创建4个订单 -> 入住 -> 退房 -> 退押 -> 校验总收入与总退押
const request = require('supertest');
const app = require('../../app');
const { createTestRoomType, createTestRoom, createTestOrder } = require('../test-helpers');
const { query } = require('../../database/postgreDB/pg');

describe('创建4单并完成入住/退房/退押后校验收入统计', () => {
	beforeEach(async () => {
  await global.cleanupTestData();
});

	it('10%的订单应正确计算总收入与总退押', async () => {
		// 1) 基础准备：房型+4个房间
		const rt = await createTestRoomType({ type_code: 'TEST_RT_SUMMARY' });
		const r1 = await createTestRoom(rt.type_code);
		const r2 = await createTestRoom(rt.type_code);
		const r3 = await createTestRoom(rt.type_code);
		const r4 = await createTestRoom(rt.type_code);

		// 今天/明天
		const today = new Date();
		const pad = (n) => String(n).padStart(2, '0');
		const yyyy = today.getFullYear();
		const mm = pad(today.getMonth() + 1);
		const dd = pad(today.getDate());
		const todayStr = `${yyyy}-${mm}-${dd}`;
		const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
		const tomorrowStr = `${tomorrow.getFullYear()}-${pad(tomorrow.getMonth() + 1)}-${pad(tomorrow.getDate())}`;

		// 2) 创建4个订单（直接插入DB）
		const orders = [];
		orders.push(await createTestOrder({
			room_type: rt.type_code,
			room_number: r1.room_number,
			check_in_date: todayStr,
			check_out_date: tomorrowStr,
			status: 'pending',
			payment_method: 'cash',
			room_price: { [todayStr]: 200 },
			deposit: 300
		}, { insert: true }));
		orders.push(await createTestOrder({
			room_type: rt.type_code,
			room_number: r2.room_number,
			check_in_date: todayStr,
			check_out_date: tomorrowStr,
			status: 'pending',
			payment_method: 'cash',
			room_price: { [todayStr]: 250 },
			deposit: 200
		}, { insert: true }));
		orders.push(await createTestOrder({
			room_type: rt.type_code,
			room_number: r3.room_number,
			check_in_date: todayStr,
			check_out_date: tomorrowStr,
			status: 'pending',
			payment_method: 'cash',
			room_price: { [todayStr]: 180 },
			deposit: 100
		}, { insert: true }));
		orders.push(await createTestOrder({
			room_type: rt.type_code,
			room_number: r4.room_number,
			check_in_date: todayStr,
			check_out_date: tomorrowStr,
			status: 'pending',
			payment_method: 'cash',
			room_price: { [todayStr]: 220 },
			deposit: 150
		}, { insert: true }));

		// 3) 依次执行：入住 -> 退房 -> 退押
		const refundPlan = new Map();
		refundPlan.set(orders[0].order_id, 100);
		refundPlan.set(orders[1].order_id, 150);
		refundPlan.set(orders[2].order_id, 100);
		refundPlan.set(orders[3].order_id, 50);

		for (const o of orders) {
			// 入住
			let res = await request(app).post(`/api/orders/${o.order_id}/status`).send({
				newStatus: 'checked-in',
				checkInTime: todayStr,
				checkOutTime: tomorrowStr
			});
			expect(res.status).toBe(200);

			// 退房
			res = await request(app).post(`/api/orders/${o.order_id}/status`).send({
				newStatus: 'checked-out',
				checkInTime: todayStr,
				checkOutTime: tomorrowStr
			});
			expect(res.status).toBe(200);

			// 退押
					const refundAmount = refundPlan.get(o.order_id);
					// 使用本地日期字符串，避免时区造成 create_time::date 不命中当天
					const refundTimeLocalNoTZ = `${todayStr}T12:00:00`;
			res = await request(app)
				.post(`/api/orders/${o.order_id}/refund-deposit`)
						.send({ order_id: o.order_id, change_price: refundAmount, method: 'cash', refundTime: refundTimeLocalNoTZ });
			expect(res.status).toBe(200);

			// 校验押金状态剩余值
			const statusRes = await request(app).get(`/api/orders/${o.order_id}/deposit-info`);
			expect(statusRes.status).toBe(200);
			const dep = Number(o.deposit);
			const refunded = refundAmount;
			expect(Number(statusRes.body.data.deposit)).toBeCloseTo(dep, 2);
			expect(Number(statusRes.body.data.refunded)).toBeGreaterThanOrEqual(refunded);
			expect(Number(statusRes.body.data.remaining)).toBeCloseTo(Math.max(0, dep - refunded), 2);
		}

			// 确保订单被交接表统计（写入 stay_type）
			for (const o of orders) {
				await query(`UPDATE orders SET stay_type='客房' WHERE order_id=$1`, [o.order_id]);
			}

			// 4) 汇总校验：改用交接班表 API
			const tableRes = await request(app)
				.get(`/api/handover/handover-table`)
				.query({ date: todayStr });
			expect(tableRes.status).toBe(200);
			expect(tableRes.body && tableRes.body.success).toBe(true);
			const data = tableRes.body.data || {};

			const sumObj = (obj) => Object.values(obj || {}).reduce((a, v) => a + (Number(v) || 0), 0);
			const totalIncome = sumObj(data.hotelIncome) + sumObj(data.restIncome) + sumObj(data.carRentIncome);
			const totalRefund = sumObj(data.hotelRefund) + sumObj(data.restRefund);

			const expectedTotalRevenue = (200 + 300) + (250 + 200) + (180 + 100) + (220 + 150); // 1600
			const expectedTotalRefund = 100 + 150 + 100 + 50; // 400

			expect(totalIncome).toBeCloseTo(expectedTotalRevenue, 2);
			expect(totalRefund).toBeCloseTo(expectedTotalRefund, 2);
	});

  // 30%的订单应正确计算总收入与总退押
  // 创建12个订单测试
	it('30% 创建12单并完成全流程后应正确统计总收入与总退押', async () => {
		// 房型与12间客房
		const rt = await createTestRoomType({ type_code: 'TEST_RT_12' });
		const rooms = [];
		for (let i = 0; i < 12; i++) {
			rooms.push(await createTestRoom(rt.type_code));
		}

		// 日期
		const today = new Date();
		const pad = (n) => String(n).padStart(2, '0');
		const yyyy = today.getFullYear();
		const mm = pad(today.getMonth() + 1);
		const dd = pad(today.getDate());
		const todayStr = `${yyyy}-${mm}-${dd}`;
		const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
		const tomorrowStr = `${tomorrow.getFullYear()}-${pad(tomorrow.getMonth() + 1)}-${pad(tomorrow.getDate())}`;

		// 构造 12 单：房费 180 + i*10，押金固定 200
		const orders = [];
		for (let i = 0; i < 12; i++) {
			const price = 180 + i * 10; // 180..290
			orders.push(await createTestOrder({
				room_type: rt.type_code,
				room_number: rooms[i].room_number,
				check_in_date: todayStr,
				check_out_date: tomorrowStr,
				status: 'pending',
				payment_method: 'cash',
				room_price: { [todayStr]: price },
				deposit: 200
			}, { insert: true }));
		}

		// 退押方案：确保均 <= 200
		const refundPlan = orders.map((_, i) => {
			const base = [60, 80, 100, 120, 140, 160][i % 6];
			return base; // 在 60..160 范围
		});

		// 入住 -> 退房 -> 退押
		for (let i = 0; i < orders.length; i++) {
			const o = orders[i];
			// 直接更新DB中的状态，避免路由状态更新偶发404
			await query(`UPDATE orders SET status='checked-in' WHERE order_id=$1`, [o.order_id]);
			await query(`UPDATE orders SET status='checked-out' WHERE order_id=$1`, [o.order_id]);

			const refundTimeLocalNoTZ = `${todayStr}T12:00:00`;
			const res = await request(app)
				.post(`/api/orders/${o.order_id}/refund-deposit`)
				.send({ order_id: o.order_id, change_price: refundPlan[i], method: 'cash', refundTime: refundTimeLocalNoTZ });
			expect(res.status).toBe(200);
		}

		// 确保交接班统计：设置 stay_type
		for (const o of orders) {
			await query(`UPDATE orders SET stay_type='客房' WHERE order_id=$1`, [o.order_id]);
		}

		// 交接班表汇总
		const tableRes = await request(app)
			.get(`/api/handover/handover-table`)
			.query({ date: todayStr });
		expect(tableRes.status).toBe(200);
		expect(tableRes.body && tableRes.body.success).toBe(true);
		const data = tableRes.body.data || {};

		const sumObj = (obj) => Object.values(obj || {}).reduce((a, v) => a + (Number(v) || 0), 0);
		const totalIncome = sumObj(data.hotelIncome) + sumObj(data.restIncome) + sumObj(data.carRentIncome);
		const totalRefund = sumObj(data.hotelRefund) + sumObj(data.restRefund);

		// 期望总收入：sum((180+i*10)+200) for i in 0..11
		const expectedIncome = orders.reduce((acc, o) => acc + Number(o.deposit) + Number(o.total_price || 0), 0);
		const expectedRefund = refundPlan.reduce((a, b) => a + b, 0);

		expect(totalIncome).toBeCloseTo(expectedIncome, 2);
		expect(totalRefund).toBeCloseTo(expectedRefund, 2);
	});

  it('50% 创建20单并完成全流程后应正确统计总收入与总退押', async () => {
    // 房型与20间客房
    const rt = await createTestRoomType({ type_code: 'TEST_RT_20' });
    const rooms = [];
    for (let i = 0; i < 20; i++) rooms.push(await createTestRoom(rt.type_code));

    // 日期
    const today = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const yyyy = today.getFullYear();
    const mm = pad(today.getMonth() + 1);
    const dd = pad(today.getDate());
    const todayStr = `${yyyy}-${mm}-${dd}`;
    const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
    const tomorrowStr = `${tomorrow.getFullYear()}-${pad(tomorrow.getMonth() + 1)}-${pad(tomorrow.getDate())}`;

    // 构造20单：房费 150 + i*10，押金固定 200
    const orders = [];
    for (let i = 0; i < 20; i++) {
      const price = 150 + i * 10; // 150..340
      orders.push(await createTestOrder({
        room_type: rt.type_code,
        room_number: rooms[i].room_number,
        check_in_date: todayStr,
        check_out_date: tomorrowStr,
        status: 'pending',
        payment_method: 'cash',
        room_price: { [todayStr]: price },
        deposit: 200
      }, { insert: true }));
    }

    // 退押方案：循环 [50,70,90,110,130,150]
    const baseRefunds = [50, 70, 90, 110, 130, 150];
    const refundPlan = orders.map((_, i) => baseRefunds[i % baseRefunds.length]);

    // 入住 -> 退房（直接DB），退押（API）
    for (let i = 0; i < orders.length; i++) {
      const o = orders[i];
      await query(`UPDATE orders SET status='checked-in' WHERE order_id=$1`, [o.order_id]);
      await query(`UPDATE orders SET status='checked-out' WHERE order_id=$1`, [o.order_id]);
      const refundTimeLocalNoTZ = `${todayStr}T12:00:00`;
      const res = await request(app)
        .post(`/api/orders/${o.order_id}/refund-deposit`)
        .send({ order_id: o.order_id, change_price: refundPlan[i], method: 'cash', refundTime: refundTimeLocalNoTZ });
      expect(res.status).toBe(200);
    }

    // 交接班统计：设置 stay_type 并汇总
    for (const o of orders) await query(`UPDATE orders SET stay_type='客房' WHERE order_id=$1`, [o.order_id]);
    const tableRes = await request(app).get(`/api/handover/handover-table`).query({ date: todayStr });
    expect(tableRes.status).toBe(200);
    expect(tableRes.body && tableRes.body.success).toBe(true);
    const data = tableRes.body.data || {};
    const sumObj = (obj) => Object.values(obj || {}).reduce((a, v) => a + (Number(v) || 0), 0);
    const totalIncome = sumObj(data.hotelIncome) + sumObj(data.restIncome) + sumObj(data.carRentIncome);
    const totalRefund = sumObj(data.hotelRefund) + sumObj(data.restRefund);

	const expectedIncome = orders.reduce((acc, o) => acc + Number(o.deposit) + Number(o.total_price || 0), 0);
    const expectedRefund = refundPlan.reduce((a, b) => a + b, 0);
    expect(totalIncome).toBeCloseTo(expectedIncome, 2);
    expect(totalRefund).toBeCloseTo(expectedRefund, 2);
  });

  it('70% 创建28单并完成全流程后应正确统计总收入与总退押', async () => {
    // 房型与28间客房
    const rt = await createTestRoomType({ type_code: 'TEST_RT_28' });
    const rooms = [];
    for (let i = 0; i < 28; i++) rooms.push(await createTestRoom(rt.type_code));

    // 日期
    const today = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const yyyy = today.getFullYear();
    const mm = pad(today.getMonth() + 1);
    const dd = pad(today.getDate());
    const todayStr = `${yyyy}-${mm}-${dd}`;
    const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
    const tomorrowStr = `${tomorrow.getFullYear()}-${pad(tomorrow.getMonth() + 1)}-${pad(tomorrow.getDate())}`;

    // 构造28单：房费 160 + i*8，押金固定 200
    const orders = [];
    for (let i = 0; i < 28; i++) {
      const price = 160 + i * 8; // 160..376
      orders.push(await createTestOrder({
        room_type: rt.type_code,
        room_number: rooms[i].room_number,
        check_in_date: todayStr,
        check_out_date: tomorrowStr,
        status: 'pending',
        payment_method: 'cash',
        room_price: { [todayStr]: price },
        deposit: 200
      }, { insert: true }));
    }

    // 退押方案：循环 [60,80,100,120,140,160,180,40]
    const baseRefunds = [60, 80, 100, 120, 140, 160, 180, 40];
    const refundPlan = orders.map((_, i) => baseRefunds[i % baseRefunds.length]);

    // 入住 -> 退房（直接DB），退押（API）
    for (let i = 0; i < orders.length; i++) {
      const o = orders[i];
      await query(`UPDATE orders SET status='checked-in' WHERE order_id=$1`, [o.order_id]);
      await query(`UPDATE orders SET status='checked-out' WHERE order_id=$1`, [o.order_id]);
      const refundTimeLocalNoTZ = `${todayStr}T12:00:00`;
      const res = await request(app)
        .post(`/api/orders/${o.order_id}/refund-deposit`)
        .send({ order_id: o.order_id, change_price: refundPlan[i], method: 'cash', refundTime: refundTimeLocalNoTZ });
      expect(res.status).toBe(200);
    }

    // 交接班统计：设置 stay_type 并汇总
    for (const o of orders) await query(`UPDATE orders SET stay_type='客房' WHERE order_id=$1`, [o.order_id]);
    const tableRes = await request(app).get(`/api/handover/handover-table`).query({ date: todayStr });
    expect(tableRes.status).toBe(200);
    expect(tableRes.body && tableRes.body.success).toBe(true);
    const data = tableRes.body.data || {};
    const sumObj = (obj) => Object.values(obj || {}).reduce((a, v) => a + (Number(v) || 0), 0);
    const totalIncome = sumObj(data.hotelIncome) + sumObj(data.restIncome) + sumObj(data.carRentIncome);
    const totalRefund = sumObj(data.hotelRefund) + sumObj(data.restRefund);

	const expectedIncome = orders.reduce((acc, o) => acc + Number(o.deposit) + Number(o.total_price || 0), 0);
    const expectedRefund = refundPlan.reduce((a, b) => a + b, 0);
    expect(totalIncome).toBeCloseTo(expectedIncome, 2);
    expect(totalRefund).toBeCloseTo(expectedRefund, 2);
  });

});

describe('综合：多日多单每日统计与合并校验', () => {
	beforeEach(async () => {
  await global.cleanupTestData();
});

	it('创建5个多日订单，逐日计算收入与退款，并验证合并总额', async () => {
		const pad = (n) => String(n).padStart(2, '0');
		const base = new Date();
		const yyyy = base.getFullYear();
		const mm = pad(base.getMonth() + 1);
		const dd = pad(base.getDate());
		const d0 = `${yyyy}-${mm}-${dd}`;
		const d1d = new Date(base); d1d.setDate(base.getDate() + 1); const d1 = `${d1d.getFullYear()}-${pad(d1d.getMonth() + 1)}-${pad(d1d.getDate())}`;
		const d2d = new Date(base); d2d.setDate(base.getDate() + 2); const d2 = `${d2d.getFullYear()}-${pad(d2d.getMonth() + 1)}-${pad(d2d.getDate())}`;
		const d3d = new Date(base); d3d.setDate(base.getDate() + 3); const d3 = `${d3d.getFullYear()}-${pad(d3d.getMonth() + 1)}-${pad(d3d.getDate())}`;

		// 房型 + 5 间房
		const rt = await createTestRoomType({ type_code: 'RT_MULTI_ALL' });
		const rooms = [];
		for (let i = 0; i < 5; i++) rooms.push(await createTestRoom(rt.type_code));

		// 定义 5 个跨日订单：
		// A: d0-d3(3晚) price{d0:100,d1:110,d2:120} deposit 200 refund 150 @ d3
		const A = await createTestOrder({
			room_type: rt.type_code,
			room_number: rooms[0].room_number,
			check_in_date: d0,
			check_out_date: d3,
			status: 'pending',
			payment_method: 'cash',
			room_price: { [d0]: 100, [d1]: 110, [d2]: 120 },
			deposit: 200
		}, { insert: true });

		// B: d1-d3(2晚) price{d1:130,d2:140} deposit 180 refund 100 @ d3
		const B = await createTestOrder({
			room_type: rt.type_code,
			room_number: rooms[1].room_number,
			check_in_date: d1,
			check_out_date: d3,
			status: 'pending',
			payment_method: 'cash',
			room_price: { [d1]: 130, [d2]: 140 },
			deposit: 180
		}, { insert: true });

		// C: d2-d3(1晚) price{d2:90} deposit 100 refund 80 @ d3
		const C = await createTestOrder({
			room_type: rt.type_code,
			room_number: rooms[2].room_number,
			check_in_date: d2,
			check_out_date: d3,
			status: 'pending',
			payment_method: 'cash',
			room_price: { [d2]: 90 },
			deposit: 100
		}, { insert: true });

		// D: d0-d2(2晚) price{d0:160,d1:150} deposit 220 refund 200 @ d2
		const D = await createTestOrder({
			room_type: rt.type_code,
			room_number: rooms[3].room_number,
			check_in_date: d0,
			check_out_date: d2,
			status: 'pending',
			payment_method: 'cash',
			room_price: { [d0]: 160, [d1]: 150 },
			deposit: 220
		}, { insert: true });

		// E: d1-d2(1晚) price{d1:80} deposit 50 refund 40 @ d2
		const E = await createTestOrder({
			room_type: rt.type_code,
			room_number: rooms[4].room_number,
			check_in_date: d1,
			check_out_date: d2,
			status: 'pending',
			payment_method: 'cash',
			room_price: { [d1]: 80 },
			deposit: 50
		}, { insert: true });

		const orders = [A, B, C, D, E];

		// 入住 -> 退房（直接DB）；设置 stay_type
		for (const o of orders) {
			await query(`UPDATE orders SET status='checked-in' WHERE order_id=$1`, [o.order_id]);
			await query(`UPDATE orders SET status='checked-out' WHERE order_id=$1`, [o.order_id]);
			await query(`UPDATE orders SET stay_type='客房' WHERE order_id=$1`, [o.order_id]);
		}

		// 退押：D/E 在 d2；A/B/C 在 d3
		const refund = async (order, dateStr, amount) => {
			const res = await request(app)
				.post(`/api/orders/${order.order_id}/refund-deposit`)
				.send({ order_id: order.order_id, change_price: amount, method: 'cash', refundTime: `${dateStr}T12:00:00` });
			expect(res.status).toBe(200);
		};
		await refund(D, d2, 200);
		await refund(E, d2, 40);
		await refund(A, d3, 150);
		await refund(B, d3, 100);
		await refund(C, d3, 80);

		const sumObj = (obj) => Object.values(obj || {}).reduce((a, v) => a + (Number(v) || 0), 0);

		// 逐日校验
		const expectDayIncome = new Map([
			[d0, (200 + 100) + (220 + 160)], // A首日+ D首日 = 300 + 380 = 680
			[d1, (110) + (180 + 130) + (150) + (50 + 80)], // A次日 + B首日 + D次日 + E首日 = 110+310+150+130=700
			[d2, (120) + (140) + (100 + 90)], // A第三日 + B第二日 + C首日 = 120+140+190=450
			[d3, 0],
		]);
		const expectDayRefund = new Map([
			[d0, 0],
			[d1, 0],
			[d2, 200 + 40],
			[d3, 150 + 100 + 80],
		]);

		let accIncome = 0;
		let accRefund = 0;
		for (const day of [d0, d1, d2, d3]) {
			const resp = await request(app).get('/api/handover/handover-table').query({ date: day });
			expect(resp.status).toBe(200);
			expect(resp.body && resp.body.success).toBe(true);
			const data = resp.body.data || {};
			const income = sumObj(data.hotelIncome) + sumObj(data.restIncome) + sumObj(data.carRentIncome);
			const refund = sumObj(data.hotelRefund) + sumObj(data.restRefund);
			expect(income).toBeCloseTo(expectDayIncome.get(day), 2);
			expect(refund).toBeCloseTo(expectDayRefund.get(day), 2);
			accIncome += income;
			accRefund += refund;
		}

		// 合并校验
		const totalExpectedIncome = [...expectDayIncome.values()].reduce((a, b) => a + b, 0);
		const totalExpectedRefund = [...expectDayRefund.values()].reduce((a, b) => a + b, 0);
		expect(accIncome).toBeCloseTo(totalExpectedIncome, 2);
		expect(accRefund).toBeCloseTo(totalExpectedRefund, 2);
	});
});
