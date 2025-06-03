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
            bills.value.push(response.data.bill);
            return response.data.bill;
        } catch (error) {
            console.error('添加账单失败:', error);
            throw error;
        }
    }

    return {
        bills,
        currentBill,
        addBill
    }
})

export default useBillStore;