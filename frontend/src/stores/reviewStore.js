import { defineStore } from 'pinia';
import { ref } from 'vue';
import { reviewApi } from '../api';

export const useReviewStore = defineStore('review', () => {
    const pendingInvitations = ref([]);
    const pendingReviews = ref([]);
    const reviewStats = ref({});

    /**
     * 获取待邀请好评的订单
     * @returns {Promise<Array>} 待邀请好评的订单列表
     */
    async function fetchPendingInvitations() {
        try {
            const response = await reviewApi.getPendingInvitations();
            pendingInvitations.value = Array.isArray(response.orders) ? response.orders : [];
            return pendingInvitations.value;
        } catch (error) {
            console.error('获取待邀请好评订单失败:', error);
            pendingInvitations.value = [];
            throw error;
        }
    }

    /**
     * 获取已邀请但未设置好评状态的订单
     * @returns {Promise<Array>} 待更新好评状态的订单列表
     */
    async function fetchPendingReviews() {
        try {
            const response = await reviewApi.getPendingReviews();
            pendingReviews.value = Array.isArray(response.orders) ? response.orders : [];
            return pendingReviews.value;
        } catch (error) {
            console.error('获取待更新好评状态订单失败:', error);
            pendingReviews.value = [];
            throw error;
        }
    }

    /**
     * 邀请客户好评
     * @param {string} orderId - 订单ID
     * @returns {Promise<Object>} 更新后的订单
     */
    async function inviteReview(orderId) {
        try {
            const response = await reviewApi.inviteReview(orderId);

            // 从待邀请列表中移除该订单
            const invitationIndex = pendingInvitations.value.findIndex(order => order.order_id === orderId);
            if (invitationIndex !== -1) {
                pendingInvitations.value.splice(invitationIndex, 1);
            }

            // 添加到待更新好评状态列表
            if (response.order) {
                pendingReviews.value.push(response.order);
            }

            return response.order;
        } catch (error) {
            console.error('邀请好评失败:', error);
            throw error;
        }
    }

    /**
     * 更新好评状态
     * @param {string} orderId - 订单ID
     * @param {boolean} positive_review - 是否好评
     * @returns {Promise<Object>} 更新后的订单
     */
    async function updateReviewStatus(orderId, positive_review) {
        try {
            const response = await reviewApi.updateReviewStatus(orderId, positive_review);

            // 从待更新好评状态列表中移除该订单
            const reviewIndex = pendingReviews.value.findIndex(order => order.order_id === orderId);
            if (reviewIndex !== -1) {
                pendingReviews.value.splice(reviewIndex, 1);
            }

            return response.order;
        } catch (error) {
            console.error('更新好评状态失败:', error);
            throw error;
        }
    }

    /**
     * 获取好评统计信息
     * @param {Object} params - 查询参数
     * @returns {Promise<Object>} 统计数据
     */
    async function fetchReviewStatistics(params = {}) {
        try {
            const response = await reviewApi.getReviewStatistics(params);
            reviewStats.value = response || {};
            return reviewStats.value;
        } catch (error) {
            console.error('获取好评统计失败:', error);
            reviewStats.value = {};
            throw error;
        }
    }

    /**
     * 获取所有好评记录
     * @param {Object} params - 查询参数
     * @returns {Promise<Array>} 好评记录列表
     */
    async function fetchAllReviews(params = {}) {
        try {
            const response = await reviewApi.getAllReviews(params);
            return Array.isArray(response.orders) ? response.orders : [];
        } catch (error) {
            console.error('获取所有好评记录失败:', error);
            throw error;
        }
    }

    /**
     * 刷新所有数据
     */
    async function refreshAll() {
        try {
            await Promise.all([
                fetchPendingInvitations(),
                fetchPendingReviews(),
                fetchReviewStatistics()
            ]);
        } catch (error) {
            console.error('刷新评价数据失败:', error);
            throw error;
        }
    }

    return {
        pendingInvitations,
        pendingReviews,
        reviewStats,
        fetchPendingInvitations,
        fetchPendingReviews,
        inviteReview,
        updateReviewStatus,
        fetchReviewStatistics,
        fetchAllReviews,
        refreshAll
    }
})

export default useReviewStore;
