export interface Member {
    id: number;
    full_name: string;
    team_name: string;
    avatar: string;
    final_value: string;
    percent_finish: string;
    order: number;
    hangmuc_name: string;
    note: string;
    update_time: string;
    member_count?: number;
  }
  
  export interface RaceData {
    title: string;
    description: string;
    meta_title: string;
    meta_description: string;
    content: string;
    data: {
      members: Member[];
    };
  }
  
  export interface DailyKmData {
    memberId: number;
    date: string;
    km: number;
    memberName?: string;
    avatar?: string;
  }