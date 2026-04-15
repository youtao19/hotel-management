type phyRoomType = {
  account_id: string;
  rate_plan: {
    hotel_id?: string;
    rooms: Array<{
      room_id: string;
      rate_plans: Array<{
        out_rate_plan_id: string;
        rate_plan_name: string;
        hourly_room_detail?: {
          earliest_check_in?: string;
          latest_check_out?: string;
          usage_duration?: number;
        };
      }>;
    }>;
  };
};

export type PhyRoomType = {
  phyRoomType: phyRoomType;
}
