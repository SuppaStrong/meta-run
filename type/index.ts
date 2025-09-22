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

export interface Team {
  id: string;
  team_id: string;
  race_id: string;
  total_distance: string;
  avg_distance: string;
  order: string;
  actual_value: string;
  virtual_value: string;
  final_value: string;
  name: string;
  total: string;
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

export interface TeamRaceData {
  status: string;
  status_code: number;
  message: string;
  data: {
    teams: Team[];
    total: number;
    max_page: number;
    pageCurent: number;
    pageLimit: number;
    countTotalDistance: number;
    oneItem?: {
      id: string;
      thumbnail: string;
      start_time: string;
      finish_time: string;
    };
  };
}

export interface DailyKmData {
  memberId: number;
  date: string;
  km: number;
  memberName?: string;
  avatar?: string;
}