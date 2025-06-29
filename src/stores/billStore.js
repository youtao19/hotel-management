import { defineStore } from 'pinia';
import { ref } from 'vue';
import { billApi } from '../api';

export const useBillStore = defineStore('bill', () => {
    const bills = ref([]);
    const currentBill = ref(null);

    /**
     * 添加新账单
     * @param {Object} billData - 账单数据
     * @returns {Promise<Object>} 新创建的账单
     */
    async function addBill(billData) {
        try {
            const response = await billApi.createBill(billData);
            bills.value.push(response.bill);
            return response.bill;
        } catch (error) {
            console.error('添加账单失败:', error);
            throw error;
        }
    }

    /**
     * 邀请客户好评
     * @param {string} orderId - 订单ID
     * @returns {Promise<Object>} 更新后的账单
     */
    async function inviteReview(orderId) {
        try {
            const response = await billApi.inviteReview(orderId);

            // 更新本地账单状态
            const billIndex = bills.value.findIndex(bill => bill.order_id === orderId);
            if (billIndex !== -1) {
                bills.value[billIndex] = response.bill;
            }

            return response.bill;
        } catch (error) {
            console.error('邀请好评失败:', error);
            throw error;
        }
    }

    /**
     * 更新好评状态
     * @param {string} orderId - 订单ID
     * @param {boolean} positive_review - 是否好评
     * @returns {Promise<Object>} 更新后的账单
     */
    async function updateReviewStatus(orderId, positive_review) {
        try {
            const response = await billApi.updateReviewStatus(orderId, positive_review);

            // 更新本地账单状态
            const billIndex = bills.value.findIndex(bill => bill.order_id === orderId);
            if (billIndex !== -1) {
                bills.value[billIndex] = response.bill;
            }

            return response.bill;
        } catch (error) {
            console.error('更新好评状态失败:', error);
            throw error;
        }
    }

    /**
     * 获取所有账单
     * @returns {Promise<Array>} 所有账单列表
     */
    async function fetchAllBills() {
        try {
            const response = await billApi.getAllBills();
            bills.value = Array.isArray(response.bills) ? response.bills : [];
            return bills.value;
        } catch (error) {
            console.error('获取所有账单失败:', error);
            bills.value = [];
            throw error;
        }
    }

    /**
     * 获取待邀请好评的账单
     * @returns {Promise<Array>} 待邀请好评的账单列表
     */
    async function fetchPendingInvitations() {
        try {
            const response = await billApi.getPendingInvitations();
            return Array.isArray(response.bills) ? response.bills : [];
        } catch (error) {
            console.error('获取待邀请好评账单失败:', error);
            throw error;
        }
    }

    /**
     * 获取已邀请但未设置好评状态的账单
     * @returns {Promise<Array>} 待更新好评状态的账单列表
     */
    async function fetchPendingReviews() {
        try {
            const response = await billApi.getPendingReviews();
            return Array.isArray(response.bills) ? response.bills : [];
        } catch (error) {
            console.error('获取待更新好评状态账单失败:', error);
            throw error;
        }
    }

    return {
        bills,
        currentBill,
        addBill,
        inviteReview,
        updateReviewStatus,
        fetchAllBills,
        fetchPendingInvitations,
        fetchPendingReviews
    }
})

export default useBillStore;
