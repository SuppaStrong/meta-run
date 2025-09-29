'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';

interface Member {
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
  bib_number?: number;
  original_km?: number;
  adjustment_km?: number;
}

interface Team {
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

interface DailyMemberKm {
  memberId: number;
  memberName: string;
  avatar: string;
  teamName: string;
  date: string;
  km: number;
  violationKm?: number;
}

interface WeeklyMemberKm {
  memberId: number;
  memberName: string;
  avatar: string;
  teamName: string;
  startDate: string;
  endDate: string;
  totalKm: number;
  adjustmentKm?: number;
  violationKm?: number;
  dailyBreakdown: {
    date: string;
    km: number;
    violationKm: number;
  }[];
}

interface WeeklyTeamKm {
  teamName: string;
  totalKm: number;
  memberCount: number;
  avgKm: number;
  members: {
    memberId: number;
    memberName: string;
    km: number;
  }[];
  startDate: string;
  endDate: string;
}

interface RaceInfo {
  title: string;
  meta_title: string;
  meta_description: string;
  description: string;
  content: string;
  thumbnail: string;
  start_time: string;
  finish_time: string;
  quantity: string;
  total_regiter?: number;
}

interface UserData {
  stt: number;
  name: string;
  gender: string;
  member_id: string;
  strava_id: string;
}

interface SafeImageProps {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  className?: string;
  onError?: React.ReactEventHandler<HTMLImageElement>;
  [key: string]: unknown;
}

// Helper functions for week calculation (outside component to avoid dependency issues)
const getMonday = (date: Date) => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff));
};

const getSunday = (date: Date) => {
  const monday = getMonday(date);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return sunday;
};

const formatDateForAPI = (date: Date) => {
  return date.toISOString().split('T')[0];
};

export default function App() {
  const [personalData, setPersonalData] = useState<Member[]>([]);
  const [filteredPersonalData, setFilteredPersonalData] = useState<Member[]>([]);
  const [teamData, setTeamData] = useState<Team[]>([]);
  const [dailyRankings, setDailyRankings] = useState<DailyMemberKm[]>([]);
  const [weeklyRankings, setWeeklyRankings] = useState<WeeklyMemberKm[]>([]);
  const [weeklyTeamRankings, setWeeklyTeamRankings] = useState<WeeklyTeamKm[]>([]);
  const [raceInfo, setRaceInfo] = useState<RaceInfo | null>(null);
  const [userData, setUserData] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [dailyLoading, setDailyLoading] = useState(false);
  const [weeklyLoading, setWeeklyLoading] = useState(false);
  const [weeklyTeamLoading, setWeeklyTeamLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'personal' | 'team' | 'daily' | 'weekly' | 'weeklyTeam'>('personal');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedWeekDate, setSelectedWeekDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedWeekTeamDate, setSelectedWeekTeamDate] = useState(new Date().toISOString().split('T')[0]);
  const [showConfetti, setShowConfetti] = useState(false);
  const [countTotalDistance, setCountTotalDistance] = useState(0);
  const [teamSortBy, setTeamSortBy] = useState<'total' | 'average'>('total');
  const [weeklyTeamSortBy, setWeeklyTeamSortBy] = useState<'total' | 'average'>('total');
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
  const [genderFilter, setGenderFilter] = useState<'all' | 'male' | 'female'>('all');

  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement>) => {
    e.currentTarget.src = '/meta.png';
  };

  const getUserData = useCallback((memberId: number | string) => {
    return userData.find(user => user.member_id === String(memberId));
  }, [userData]);

  const SafeImage = ({ src, alt, onError, ...props }: SafeImageProps) => {
    const safeSrc = src && src.trim() !== '' ? src : '/meta.png';
    return <Image src={safeSrc} alt={alt} onError={onError || handleImageError} {...props} />;
  };

  const customStyles = `
    @keyframes fade-in-up {
      from { opacity: 0; transform: translateY(30px); }
      to { opacity: 1; transform: translateY(0); }
    }
    
    @keyframes confetti-fall {
      0% { transform: translateY(-100vh) rotate(0deg); opacity: 1; }
      100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
    }
    
    @keyframes pulse-glow {
      0%, 100% { box-shadow: 0 0 20px rgba(251, 191, 36, 0.5); }
      50% { box-shadow: 0 0 40px rgba(251, 191, 36, 0.8), 0 0 60px rgba(251, 191, 36, 0.4); }
    }
    
    @keyframes slide-in {
      from { opacity: 0; transform: translateX(-20px); }
      to { opacity: 1; transform: translateX(0); }
    }
    
    @keyframes shimmer {
      0% { background-position: -200% 0; }
      100% { background-position: 200% 0; }
    }
    
    @keyframes float {
      0%, 100% { transform: translateY(0px); }
      50% { transform: translateY(-10px); }
    }
    
    .animate-fade-in-up { animation: fade-in-up 1s ease-out; }
    .animate-slide-in { animation: slide-in 0.8s ease-out; }
    .animate-shimmer { 
      background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent);
      background-size: 200% 100%;
      animation: shimmer 2s infinite;
    }
    .animate-float { animation: float 3s ease-in-out infinite; }
    .confetti-piece { position: fixed; width: 10px; height: 10px; animation: confetti-fall 3s linear infinite; z-index: 9999; }
    .pulse-glow { animation: pulse-glow 2s ease-in-out infinite; }
    .text-shadow-lg { text-shadow: 0 4px 8px rgba(0, 0, 0, 0.6), 0 2px 4px rgba(0, 0, 0, 0.4); }
    .gradient-text {
      background: linear-gradient(135deg, #fbbf24, #f59e0b, #fb923c, #f97316);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      background-size: 200% auto;
      animation: shimmer 3s linear infinite;
    }
    
    .content-html {
      line-height: 1.8;
    }
    
    .content-html p {
      margin-bottom: 1rem;
    }
    
    .content-html ul {
      list-style-type: disc;
      margin-left: 2rem;
      margin-bottom: 1rem;
    }
    
    .content-html li {
      margin-bottom: 0.5rem;
    }
    
    .content-html b {
      font-weight: bold;
      color: #fbbf24;
    }
    
    .content-html i {
      font-style: italic;
    }
    
    .content-html a {
      color: #60a5fa;
      text-decoration: underline;
    }

    .description-collapsed {
      max-height: 100px;
      overflow: hidden;
      position: relative;
    }

    .description-collapsed::after {
      content: '';
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      height: 50px;
      background: linear-gradient(to bottom, transparent, rgba(0, 0, 0, 0.9));
    }

    @media (max-width: 768px) {
      .mobile-table {
        display: block;
      }
      .mobile-table thead {
        display: none;
      }
      .mobile-table tbody {
        display: block;
      }
      .mobile-table tr {
        display: block;
        margin-bottom: 1rem;
        padding: 1rem;
        border: 1px solid rgba(255,255,255,0.1);
        border-radius: 0.75rem;
        background: rgba(255,255,255,0.05);
        backdrop-filter: blur(8px);
      }
      .mobile-table td {
        display: block;
        text-align: left !important;
        padding: 0.25rem 0;
        border: none;
      }
      .mobile-table td:before {
        content: attr(data-label) ": ";
        font-weight: bold;
        color: #fbbf24;
        display: inline-block;
        width: 80px;
        font-size: 0.75rem;
      }
    }

    @media (max-width: 640px) {
      .mobile-hidden { display: none !important; }
      .mobile-full { width: 100% !important; }
      .mobile-text-sm { font-size: 0.875rem !important; }
      .mobile-p-2 { padding: 0.5rem !important; }
      .mobile-gap-2 { gap: 0.5rem !important; }
      .mobile-px-2 { padding-left: 0.5rem !important; padding-right: 0.5rem !important; }
      .mobile-py-1 { padding-top: 0.25rem !important; padding-bottom: 0.25rem !important; }
      .mobile-text-xs { font-size: 0.75rem !important; }
      .mobile-mb-2 { margin-bottom: 0.5rem !important; }
      .mobile-mt-2 { margin-top: 0.5rem !important; }
      .mobile-rounded { border-radius: 0.5rem !important; }
      .mobile-shadow { box-shadow: 0 1px 3px rgba(0,0,0,0.2) !important; }
    }

    @media (max-width: 640px) {
      .container {
        padding-left: 1rem !important;
        padding-right: 1rem !important;
      }
      
      .mobile-grid {
        display: grid;
        grid-template-columns: 1fr;
        gap: 0.75rem;
      }
      
      .mobile-flex-col {
        flex-direction: column !important;
      }
      
      .mobile-items-start {
        align-items: flex-start !important;
      }
      
      .mobile-w-full {
        width: 100% !important;
      }
    }
  `;

  const Confetti = () => {
    const colors = ['#fbbf24', '#f59e0b', '#ef4444', '#10b981', '#3b82f6', '#8b5cf6'];
    const pieces = Array.from({ length: 50 }, (_, i) => i);
    
    return (
      <div className="fixed inset-0 pointer-events-none z-50">
        {pieces.map((i) => (
          <div
            key={i}
            className="confetti-piece"
            style={{
              left: `${Math.random() * 100}%`,
              backgroundColor: colors[Math.floor(Math.random() * colors.length)],
              animationDelay: `${Math.random() * 2}s`,
              animationDuration: `${2 + Math.random() * 2}s`,
            }}
          />
        ))}
      </div>
    );
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const getRankStyling = (rank: number) => {
    switch (rank) {
      case 1:
        return { bg: 'bg-gradient-to-r from-yellow-400 to-yellow-600', text: 'text-yellow-900 font-bold', icon: '👑', glow: 'shadow-yellow-400/50' };
      case 2:
        return { bg: 'bg-gradient-to-r from-gray-300 to-gray-500', text: 'text-gray-900 font-bold', icon: '🥈', glow: 'shadow-gray-400/50' };
      case 3:
        return { bg: 'bg-gradient-to-r from-amber-600 to-amber-800', text: 'text-amber-100 font-bold', icon: '🥉', glow: 'shadow-amber-600/50' };
      default:
        return { bg: 'bg-gray-600', text: 'text-orange-400 font-medium', icon: '', glow: '' };
    }
  };

  const getFilteredPersonalData = useCallback(() => {
    if (genderFilter === 'all') {
      return personalData;
    }
    
    return personalData.filter(member => {
      const user = getUserData(member.bib_number || member.id);
      if (!user) return false;
      
      const userGender = user.gender.toLowerCase();
      return genderFilter === 'male' 
        ? userGender === 'male' || userGender === 'm' 
        : userGender === 'female' || userGender === 'f';
    });
  }, [personalData, genderFilter, getUserData]);

  useEffect(() => {
    setFilteredPersonalData(getFilteredPersonalData());
  }, [getFilteredPersonalData]);

  const getSortedTeams = useCallback(() => {
    const sorted = [...teamData].sort((a, b) => {
      if (teamSortBy === 'total') {
        return parseFloat(b.total_distance) - parseFloat(a.total_distance);
      } else {
        return parseFloat(b.avg_distance) - parseFloat(a.avg_distance);
      }
    });
    return sorted;
  }, [teamData, teamSortBy]);

  const fetchDailyRankings = useCallback(async (date: string) => {
    setDailyLoading(true);
    try {
      const memberIds = personalData
        .filter(m => m.bib_number)
        .map(m => m.bib_number as number);

      if (memberIds.length === 0) {
        console.log('No members with bib_number found');
        setDailyLoading(false);
        return;
      }

      const response = await fetch('/api/daily-km', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberIds, date })
      });

      const results = await response.json();
      
      const enrichedResults = results.map((r: DailyMemberKm) => {
        const member = personalData.find(m => m.bib_number === r.memberId);
        return {
          ...r,
          memberName: member?.full_name || 'Unknown',
          avatar: member?.avatar || '/meta.png',
          teamName: member?.team_name || 'N/A'
        };
      });

      setDailyRankings(enrichedResults);
    } catch (error) {
      console.error('Error fetching daily rankings:', error);
    } finally {
      setDailyLoading(false);
    }
  }, [personalData]);

  const fetchWeeklyRankings = useCallback(async (weekDate: string) => {
    setWeeklyLoading(true);
    try {
      const memberIds = personalData
        .filter(m => m.bib_number)
        .map(m => m.bib_number as number);

      if (memberIds.length === 0) {
        console.log('No members with bib_number found');
        setWeeklyLoading(false);
        return;
      }

      const monday = getMonday(new Date(weekDate));
      const sunday = getSunday(new Date(weekDate));
      const startDate = formatDateForAPI(monday);
      const endDate = formatDateForAPI(sunday);

      const response = await fetch('/api/weekly-km', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberIds, startDate, endDate })
      });

      const results = await response.json();
      
      const enrichedResults = results.map((r: WeeklyMemberKm) => {
        const member = personalData.find(m => m.bib_number === r.memberId);
        return {
          ...r,
          memberName: member?.full_name || 'Unknown',
          avatar: member?.avatar || '/meta.png',
          teamName: member?.team_name || 'N/A'
        };
      });

      setWeeklyRankings(enrichedResults);
    } catch (error) {
      console.error('Error fetching weekly rankings:', error);
    } finally {
      setWeeklyLoading(false);
    }
  }, [personalData]);

  const fetchWeeklyTeamRankings = useCallback(async (weekDate: string) => {
    setWeeklyTeamLoading(true);
    try {
      const monday = getMonday(new Date(weekDate));
      const sunday = getSunday(new Date(weekDate));
      const startDate = formatDateForAPI(monday);
      const endDate = formatDateForAPI(sunday);

      const response = await fetch('/api/weekly-team-km', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ startDate, endDate })
      });

      const results = await response.json();
      setWeeklyTeamRankings(results);
    } catch (error) {
      console.error('Error fetching weekly team rankings:', error);
    } finally {
      setWeeklyTeamLoading(false);
    }
  }, []);

  const getSortedWeeklyTeams = useCallback(() => {
    const sorted = [...weeklyTeamRankings].sort((a, b) => {
      if (weeklyTeamSortBy === 'total') {
        return b.totalKm - a.totalKm;
      } else {
        return b.avgKm - a.avgKm;
      }
    });
    return sorted;
  }, [weeklyTeamRankings, weeklyTeamSortBy]);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const userResponse = await fetch('/user.json');
        const userJson = await userResponse.json();
        setUserData(userJson);

        const personalRes = await fetch('/api/race/personal/1');
        const personalJson = await personalRes.json();
        const personalMembers = personalJson.data?.members || [];
        setPersonalData(personalMembers);

        if (personalJson.data?.oneItem) {
          setRaceInfo(personalJson.data.oneItem);
        }

        const teamRes = await fetch('/api/race/team');
        const teamJson = await teamRes.json();
        const teams = teamJson.data?.teams || [];
        setTeamData(teams);
        setCountTotalDistance(teamJson.data?.countTotalDistance || 0);

        setShowConfetti(true);
        setTimeout(() => setShowConfetti(false), 5000);
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  useEffect(() => {
    if (activeTab === 'daily' && personalData.length > 0) {
      fetchDailyRankings(selectedDate);
    }
  }, [activeTab, selectedDate, personalData, fetchDailyRankings]);

  useEffect(() => {
    if (activeTab === 'weekly' && personalData.length > 0) {
      fetchWeeklyRankings(selectedWeekDate);
    }
  }, [activeTab, selectedWeekDate, personalData, fetchWeeklyRankings]);

  useEffect(() => {
    if (activeTab === 'weeklyTeam') {
      fetchWeeklyTeamRankings(selectedWeekTeamDate);
    }
  }, [activeTab, selectedWeekTeamDate, fetchWeeklyTeamRankings]);

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSelectedDate(e.target.value);
  };

  const handleWeekDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSelectedWeekDate(e.target.value);
  };

  const handleWeekTeamDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSelectedWeekTeamDate(e.target.value);
  };

  const isPersonal = activeTab === 'personal';
  const isTeam = activeTab === 'team';
  const isDaily = activeTab === 'daily';
  const isWeekly = activeTab === 'weekly';
  const isWeeklyTeam = activeTab === 'weeklyTeam';

  const getGenderStats = () => {
    const maleCount = personalData.filter(member => {
      const user = getUserData(member.bib_number || member.id);
      if (!user) return false;
      const userGender = user.gender.toLowerCase();
      return userGender === 'male' || userGender === 'm';
    }).length;

    const femaleCount = personalData.filter(member => {
      const user = getUserData(member.bib_number || member.id);
      if (!user) return false;
      const userGender = user.gender.toLowerCase();
      return userGender === 'female' || userGender === 'f';
    }).length;

    return { maleCount, femaleCount };
  };

  const PersonalPodium = () => {
    if (filteredPersonalData.length < 3) return null;
    const top3 = filteredPersonalData.slice(0, 3);

    return (
      <div className="hidden md:block mb-8">
        <div className="flex justify-center items-end gap-4 md:gap-6 h-80 md:h-96">
          <div className="flex flex-col items-center animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
            <div className="relative mb-4 animate-float" style={{ animationDelay: '0.2s' }}>
              <SafeImage width={64} height={64} src={top3[1].avatar} alt="2nd" className="h-16 w-16 md:h-20 md:w-20 rounded-full object-cover border-4 border-gray-300 shadow-xl" />
              <div className="absolute -top-2 -right-2 text-2xl md:text-3xl">🥈</div>
            </div>
            <div className="backdrop-blur-md bg-gray-300/20 rounded-2xl p-4 md:p-6 text-center h-32 md:h-40 w-44 md:w-52 flex flex-col justify-center shadow-xl border border-gray-300/30">
              <div className="font-bold text-white text-sm md:text-lg truncate mb-2">{top3[1].full_name}</div>
              <div className="text-xs md:text-sm text-gray-200 font-semibold">{parseFloat(top3[1].final_value).toFixed(2)} km</div>
              <div className="text-xs text-gray-300 mt-1 truncate">{top3[1].team_name}</div>
            </div>
            <div className="bg-gradient-to-b from-gray-300 to-gray-500 w-full h-24 md:h-28 rounded-b-2xl flex items-center justify-center shadow-lg">
              <span className="text-white font-bold text-2xl md:text-3xl">2</span>
            </div>
          </div>

          <div className="flex flex-col items-center animate-fade-in-up" style={{ animationDelay: '0s' }}>
            <div className="relative mb-4 animate-float">
              <div className="pulse-glow rounded-full p-1 bg-gradient-to-r from-yellow-400 to-orange-400">
                <SafeImage width={80} height={80} src={top3[0].avatar} alt="1st" className="h-20 w-20 md:h-24 md:w-24 rounded-full object-cover border-4 border-white shadow-2xl" />
              </div>
              <div className="absolute -top-3 -right-3 text-3xl md:text-4xl animate-bounce">👑</div>
            </div>
            <div className="backdrop-blur-md bg-gradient-to-br from-yellow-400/30 via-orange-400/30 to-yellow-400/30 rounded-2xl p-4 md:p-6 text-center h-40 md:h-48 w-48 md:w-56 flex flex-col justify-center shadow-2xl border-2 border-yellow-300/40 relative overflow-hidden">
              <div className="absolute inset-0 animate-shimmer"></div>
              <div className="relative z-10">
                <div className="text-lg md:text-2xl mb-2">🏆 CHAMPION</div>
                <div className="font-bold text-white text-base md:text-xl truncate mb-2">{top3[0].full_name}</div>
                <div className="text-xs md:text-sm text-yellow-100 font-semibold">{parseFloat(top3[0].final_value).toFixed(2)} km</div>
                <div className="text-xs text-yellow-200 mt-1 truncate">{top3[0].team_name}</div>
              </div>
            </div>
            <div className="bg-gradient-to-b from-yellow-400 via-yellow-500 to-yellow-600 w-full h-32 md:h-40 rounded-b-2xl flex items-center justify-center shadow-lg relative overflow-hidden">
              <div className="absolute inset-0 animate-shimmer"></div>
              <span className="text-white font-bold text-3xl md:text-4xl relative z-10">1</span>
            </div>
          </div>

          <div className="flex flex-col items-center animate-fade-in-up" style={{ animationDelay: '0.4s' }}>
            <div className="relative mb-4 animate-float" style={{ animationDelay: '0.4s' }}>
              <SafeImage width={64} height={64} src={top3[2].avatar} alt="3rd" className="h-16 w-16 md:h-20 md:w-20 rounded-full object-cover border-4 border-amber-600 shadow-xl" />
              <div className="absolute -top-2 -right-2 text-2xl md:text-3xl">🥉</div>
            </div>
            <div className="backdrop-blur-md bg-amber-600/20 rounded-2xl p-4 md:p-6 text-center h-28 md:h-36 w-44 md:w-52 flex flex-col justify-center shadow-xl border border-amber-500/30">
              <div className="font-bold text-white text-sm md:text-lg truncate mb-2">{top3[2].full_name}</div>
              <div className="text-xs md:text-sm text-amber-200 font-semibold">{parseFloat(top3[2].final_value).toFixed(2)} km</div>
              <div className="text-xs text-amber-300 mt-1 truncate">{top3[2].team_name}</div>
            </div>
            <div className="bg-gradient-to-b from-amber-600 to-amber-800 w-full h-20 md:h-24 rounded-b-2xl flex items-center justify-center shadow-lg">
              <span className="text-white font-bold text-2xl md:text-3xl">3</span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const TeamPodium = () => {
    const sortedTeams = getSortedTeams();
    if (sortedTeams.length < 3) return null;
    const top3 = sortedTeams.slice(0, 3);

    return (
      <div className="mb-6 md:mb-8">
        <div className="text-center mb-4 md:mb-6">
          <h3 className="text-sm md:text-lg lg:text-xl font-bold text-orange-400">
            🏆 Top 3 theo {teamSortBy === 'total' ? 'Tổng KM' : 'KM Trung Bình'}
          </h3>
        </div>
        
        <div className="block md:hidden space-y-3">
          {top3.map((team, index) => {
            const rank = index + 1;
            const rankStyle = getRankStyling(rank);
            return (
              <div key={team.id} className="backdrop-blur-md bg-white/10 rounded-xl p-4 border border-white/20">
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-full ${rankStyle.bg} ${rankStyle.text} flex items-center justify-center`}>
                    <span className="text-lg font-bold">{rankStyle.icon} {rank}</span>
                  </div>
                  <div className="flex-1">
                    <div className="font-bold text-white text-sm truncate">{team.name}</div>
                    <div className="text-xs text-gray-300">{team.total} thành viên</div>
                    <div className="text-orange-400 text-sm font-semibold">
                      {teamSortBy === 'total' 
                        ? `${parseFloat(team.total_distance).toFixed(2)} km` 
                        : `${parseFloat(team.avg_distance).toFixed(2)} km TB`
                      }
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="hidden md:flex justify-center items-end gap-4 md:gap-6 h-80 md:h-96">
          <div className="flex flex-col items-center animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
            <div className="relative mb-4 animate-float" style={{ animationDelay: '0.2s' }}>
              <div className="h-16 w-16 md:h-20 md:w-20 rounded-full bg-gradient-to-br from-gray-300 to-gray-500 flex items-center justify-center border-4 border-white shadow-xl">
                <span className="text-xl md:text-2xl">👥</span>
              </div>
              <div className="absolute -top-2 -right-2 text-2xl md:text-3xl">🥈</div>
            </div>
            <div className="backdrop-blur-md bg-gray-300/20 rounded-2xl p-4 md:p-6 text-center h-32 md:h-40 w-44 md:w-52 flex flex-col justify-center shadow-xl border border-gray-300/30">
              <div className="font-bold text-white text-sm md:text-lg truncate mb-2">{top3[1].name}</div>
              <div className="text-xs md:text-sm text-gray-200 font-semibold">
                {teamSortBy === 'total' 
                  ? `${parseFloat(top3[1].total_distance).toFixed(2)} km` 
                  : `${parseFloat(top3[1].avg_distance).toFixed(2)} km TB`
                }
              </div>
              <div className="text-xs text-gray-300 mt-1">{top3[1].total} thành viên</div>
            </div>
            <div className="bg-gradient-to-b from-gray-300 to-gray-500 w-full h-24 md:h-28 rounded-b-2xl flex items-center justify-center shadow-lg">
              <span className="text-white font-bold text-2xl md:text-3xl">2</span>
            </div>
          </div>

          <div className="flex flex-col items-center animate-fade-in-up" style={{ animationDelay: '0s' }}>
            <div className="relative mb-4 animate-float">
              <div className="pulse-glow rounded-full p-1 bg-gradient-to-r from-yellow-400 to-orange-400">
                <div className="h-20 w-20 md:h-24 md:w-24 rounded-full bg-gradient-to-br from-yellow-400 to-orange-400 flex items-center justify-center border-4 border-white shadow-2xl">
                  <span className="text-2xl md:text-3xl">👥</span>
                </div>
              </div>
              <div className="absolute -top-3 -right-3 text-3xl md:text-4xl animate-bounce">👑</div>
            </div>
            <div className="backdrop-blur-md bg-gradient-to-br from-yellow-400/30 via-orange-400/30 to-yellow-400/30 rounded-2xl p-4 md:p-6 text-center h-40 md:h-48 w-48 md:w-56 flex flex-col justify-center shadow-2xl border-2 border-yellow-300/40 relative overflow-hidden">
              <div className="absolute inset-0 animate-shimmer"></div>
              <div className="relative z-10">
                <div className="text-lg md:text-2xl mb-2">🏆 CHAMPION TEAM</div>
                <div className="font-bold text-white text-base md:text-xl truncate mb-2">{top3[0].name}</div>
                <div className="text-xs md:text-sm text-yellow-100 font-semibold">
                  {teamSortBy === 'total' 
                    ? `${parseFloat(top3[0].total_distance).toFixed(2)} km` 
                    : `${parseFloat(top3[0].avg_distance).toFixed(2)} km TB`
                  }
                </div>
                <div className="text-xs text-yellow-200 mt-1">{top3[0].total} thành viên</div>
              </div>
            </div>
            <div className="bg-gradient-to-b from-yellow-400 via-yellow-500 to-yellow-600 w-full h-32 md:h-40 rounded-b-2xl flex items-center justify-center shadow-lg relative overflow-hidden">
              <div className="absolute inset-0 animate-shimmer"></div>
              <span className="text-white font-bold text-3xl md:text-4xl relative z-10">1</span>
            </div>
          </div>

          <div className="flex flex-col items-center animate-fade-in-up" style={{ animationDelay: '0.4s' }}>
            <div className="relative mb-4 animate-float" style={{ animationDelay: '0.4s' }}>
              <div className="h-16 w-16 md:h-20 md:w-20 rounded-full bg-gradient-to-br from-amber-600 to-amber-800 flex items-center justify-center border-4 border-white shadow-xl">
                <span className="text-xl md:text-2xl">👥</span>
              </div>
              <div className="absolute -top-2 -right-2 text-2xl md:text-3xl">🥉</div>
            </div>
            <div className="backdrop-blur-md bg-amber-600/20 rounded-2xl p-4 md:p-6 text-center h-28 md:h-36 w-44 md:w-52 flex flex-col justify-center shadow-xl border border-amber-500/30">
              <div className="font-bold text-white text-sm md:text-lg truncate mb-2">{top3[2].name}</div>
              <div className="text-xs md:text-sm text-amber-200 font-semibold">
                {teamSortBy === 'total' 
                  ? `${parseFloat(top3[2].total_distance).toFixed(2)} km` 
                  : `${parseFloat(top3[2].avg_distance).toFixed(2)} km TB`
                }
              </div>
              <div className="text-xs text-amber-300 mt-1">{top3[2].total} thành viên</div>
            </div>
            <div className="bg-gradient-to-b from-amber-600 to-amber-800 w-full h-20 md:h-24 rounded-b-2xl flex items-center justify-center shadow-lg">
              <span className="text-white font-bold text-2xl md:text-3xl">3</span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const DailyPodium = () => {
    if (dailyRankings.length < 3) return null;
    const top3 = dailyRankings.slice(0, 3);

    return (
      <div className="mb-6 md:mb-8">
        <div className="text-center mb-4 md:mb-6">
          <h3 className="text-sm md:text-lg lg:text-xl font-bold text-orange-400">
            🏆 Top 3 ngày {formatDate(selectedDate)}
          </h3>
        </div>
        
        <div className="block md:hidden space-y-3">
          {top3.map((record, index) => {
            const rank = index + 1;
            const rankStyle = getRankStyling(rank);
            return (
              <div key={`${record.memberId}-${index}`} className="backdrop-blur-md bg-white/10 rounded-xl p-4 border border-white/20">
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-full ${rankStyle.bg} ${rankStyle.text} flex items-center justify-center`}>
                    <span className="text-lg font-bold">{rankStyle.icon} {rank}</span>
                  </div>
                  <div className="flex items-center flex-1">
                    <SafeImage width={40} height={40} src={record.avatar} alt={record.memberName} className="h-10 w-10 rounded-full object-cover mr-3 border-2 border-white/20" />
                    <div className="flex-1">
                      <div className="font-bold text-white text-sm truncate">{record.memberName}</div>
                      <div className="text-xs text-gray-300">{record.teamName}</div>
                      <div className="text-orange-400 text-sm font-semibold">{record.km.toFixed(2)} km</div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="hidden md:flex justify-center items-end gap-4 md:gap-6 h-80 md:h-96">
          <div className="flex flex-col items-center animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
            <div className="relative mb-4 animate-float" style={{ animationDelay: '0.2s' }}>
              <SafeImage width={64} height={64} src={top3[1].avatar} alt="2nd" className="h-16 w-16 md:h-20 md:w-20 rounded-full object-cover border-4 border-gray-300 shadow-xl" />
              <div className="absolute -top-2 -right-2 text-2xl md:text-3xl">🥈</div>
            </div>
            <div className="backdrop-blur-md bg-gray-300/20 rounded-2xl p-4 md:p-6 text-center h-32 md:h-40 w-44 md:w-52 flex flex-col justify-center shadow-xl border border-gray-300/30">
              <div className="font-bold text-white text-sm md:text-lg truncate mb-2">{top3[1].memberName}</div>
              <div className="text-xs md:text-sm text-gray-200 font-semibold">{top3[1].km.toFixed(2)} km</div>
              <div className="text-xs text-gray-300 mt-1 truncate">{top3[1].teamName}</div>
            </div>
            <div className="bg-gradient-to-b from-gray-300 to-gray-500 w-full h-24 md:h-28 rounded-b-2xl flex items-center justify-center shadow-lg">
              <span className="text-white font-bold text-2xl md:text-3xl">2</span>
            </div>
          </div>

          <div className="flex flex-col items-center animate-fade-in-up" style={{ animationDelay: '0s' }}>
            <div className="relative mb-4 animate-float">
              <div className="pulse-glow rounded-full p-1 bg-gradient-to-r from-yellow-400 to-orange-400">
                <SafeImage width={80} height={80} src={top3[0].avatar} alt="1st" className="h-20 w-20 md:h-24 md:w-24 rounded-full object-cover border-4 border-white shadow-2xl" />
              </div>
              <div className="absolute -top-3 -right-3 text-3xl md:text-4xl animate-bounce">👑</div>
            </div>
            <div className="backdrop-blur-md bg-gradient-to-br from-yellow-400/30 via-orange-400/30 to-yellow-400/30 rounded-2xl p-4 md:p-6 text-center h-40 md:h-48 w-48 md:w-56 flex flex-col justify-center shadow-2xl border-2 border-yellow-300/40 relative overflow-hidden">
              <div className="absolute inset-0 animate-shimmer"></div>
              <div className="relative z-10">
                <div className="text-lg md:text-2xl mb-2">🏆 DAILY CHAMPION</div>
                <div className="font-bold text-white text-base md:text-xl truncate mb-2">{top3[0].memberName}</div>
                <div className="text-xs md:text-sm text-yellow-100 font-semibold">{top3[0].km.toFixed(2)} km</div>
                <div className="text-xs text-yellow-200 mt-1 truncate">{top3[0].teamName}</div>
              </div>
            </div>
            <div className="bg-gradient-to-b from-yellow-400 via-yellow-500 to-yellow-600 w-full h-32 md:h-40 rounded-b-2xl flex items-center justify-center shadow-lg relative overflow-hidden">
              <div className="absolute inset-0 animate-shimmer"></div>
              <span className="text-white font-bold text-3xl md:text-4xl relative z-10">1</span>
            </div>
          </div>

          <div className="flex flex-col items-center animate-fade-in-up" style={{ animationDelay: '0.4s' }}>
            <div className="relative mb-4 animate-float" style={{ animationDelay: '0.4s' }}>
              <SafeImage width={64} height={64} src={top3[2].avatar} alt="3rd" className="h-16 w-16 md:h-20 md:w-20 rounded-full object-cover border-4 border-amber-600 shadow-xl" />
              <div className="absolute -top-2 -right-2 text-2xl md:text-3xl">🥉</div>
            </div>
            <div className="backdrop-blur-md bg-amber-600/20 rounded-2xl p-4 md:p-6 text-center h-28 md:h-36 w-44 md:w-52 flex flex-col justify-center shadow-xl border border-amber-500/30">
              <div className="font-bold text-white text-sm md:text-lg truncate mb-2">{top3[2].memberName}</div>
              <div className="text-xs md:text-sm text-amber-200 font-semibold">{top3[2].km.toFixed(2)} km</div>
              <div className="text-xs text-amber-300 mt-1 truncate">{top3[2].teamName}</div>
            </div>
            <div className="bg-gradient-to-b from-amber-600 to-amber-800 w-full h-20 md:h-24 rounded-b-2xl flex items-center justify-center shadow-lg">
              <span className="text-white font-bold text-2xl md:text-3xl">3</span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const WeeklyPodium = () => {
    if (weeklyRankings.length < 3) return null;
    const top3 = weeklyRankings.slice(0, 3);
    const monday = getMonday(new Date(selectedWeekDate));
    const sunday = getSunday(new Date(selectedWeekDate));

    return (
      <div className="mb-6 md:mb-8">
        <div className="text-center mb-4 md:mb-6">
          <h3 className="text-sm md:text-lg lg:text-xl font-bold text-orange-400">
            🏆 Top 3 tuần {formatDate(formatDateForAPI(monday))} - {formatDate(formatDateForAPI(sunday))}
          </h3>
        </div>
        
        <div className="block md:hidden space-y-3">
          {top3.map((record, index) => {
            const rank = index + 1;
            const rankStyle = getRankStyling(rank);
            return (
              <div key={`${record.memberId}-${index}`} className="backdrop-blur-md bg-white/10 rounded-xl p-4 border border-white/20">
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-full ${rankStyle.bg} ${rankStyle.text} flex items-center justify-center`}>
                    <span className="text-lg font-bold">{rankStyle.icon} {rank}</span>
                  </div>
                  <div className="flex items-center flex-1">
                    <SafeImage width={40} height={40} src={record.avatar} alt={record.memberName} className="h-10 w-10 rounded-full object-cover mr-3 border-2 border-white/20" />
                    <div className="flex-1">
                      <div className="font-bold text-white text-sm truncate">{record.memberName}</div>
                      <div className="text-xs text-gray-300">{record.teamName}</div>
                      <div className="text-orange-400 text-sm font-semibold">{record.totalKm.toFixed(2)} km</div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="hidden md:flex justify-center items-end gap-4 md:gap-6 h-80 md:h-96">
          <div className="flex flex-col items-center animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
            <div className="relative mb-4 animate-float" style={{ animationDelay: '0.2s' }}>
              <SafeImage width={64} height={64} src={top3[1].avatar} alt="2nd" className="h-16 w-16 md:h-20 md:w-20 rounded-full object-cover border-4 border-gray-300 shadow-xl" />
              <div className="absolute -top-2 -right-2 text-2xl md:text-3xl">🥈</div>
            </div>
            <div className="backdrop-blur-md bg-gray-300/20 rounded-2xl p-4 md:p-6 text-center h-32 md:h-40 w-44 md:w-52 flex flex-col justify-center shadow-xl border border-gray-300/30">
              <div className="font-bold text-white text-sm md:text-lg truncate mb-2">{top3[1].memberName}</div>
              <div className="text-xs md:text-sm text-gray-200 font-semibold">{top3[1].totalKm.toFixed(2)} km</div>
              <div className="text-xs text-gray-300 mt-1 truncate">{top3[1].teamName}</div>
            </div>
            <div className="bg-gradient-to-b from-gray-300 to-gray-500 w-full h-24 md:h-28 rounded-b-2xl flex items-center justify-center shadow-lg">
              <span className="text-white font-bold text-2xl md:text-3xl">2</span>
            </div>
          </div>

          <div className="flex flex-col items-center animate-fade-in-up" style={{ animationDelay: '0s' }}>
            <div className="relative mb-4 animate-float">
              <div className="pulse-glow rounded-full p-1 bg-gradient-to-r from-yellow-400 to-orange-400">
                <SafeImage width={80} height={80} src={top3[0].avatar} alt="1st" className="h-20 w-20 md:h-24 md:w-24 rounded-full object-cover border-4 border-white shadow-2xl" />
              </div>
              <div className="absolute -top-3 -right-3 text-3xl md:text-4xl animate-bounce">👑</div>
            </div>
            <div className="backdrop-blur-md bg-gradient-to-br from-yellow-400/30 via-orange-400/30 to-yellow-400/30 rounded-2xl p-4 md:p-6 text-center h-40 md:h-48 w-48 md:w-56 flex flex-col justify-center shadow-2xl border-2 border-yellow-300/40 relative overflow-hidden">
              <div className="absolute inset-0 animate-shimmer"></div>
              <div className="relative z-10">
                <div className="text-lg md:text-2xl mb-2">🏆 WEEKLY CHAMPION</div>
                <div className="font-bold text-white text-base md:text-xl truncate mb-2">{top3[0].memberName}</div>
                <div className="text-xs md:text-sm text-yellow-100 font-semibold">{top3[0].totalKm.toFixed(2)} km</div>
                <div className="text-xs text-yellow-200 mt-1 truncate">{top3[0].teamName}</div>
              </div>
            </div>
            <div className="bg-gradient-to-b from-yellow-400 via-yellow-500 to-yellow-600 w-full h-32 md:h-40 rounded-b-2xl flex items-center justify-center shadow-lg relative overflow-hidden">
              <div className="absolute inset-0 animate-shimmer"></div>
              <span className="text-white font-bold text-3xl md:text-4xl relative z-10">1</span>
            </div>
          </div>

          <div className="flex flex-col items-center animate-fade-in-up" style={{ animationDelay: '0.4s' }}>
            <div className="relative mb-4 animate-float" style={{ animationDelay: '0.4s' }}>
              <SafeImage width={64} height={64} src={top3[2].avatar} alt="3rd" className="h-16 w-16 md:h-20 md:w-20 rounded-full object-cover border-4 border-amber-600 shadow-xl" />
              <div className="absolute -top-2 -right-2 text-2xl md:text-3xl">🥉</div>
            </div>
            <div className="backdrop-blur-md bg-amber-600/20 rounded-2xl p-4 md:p-6 text-center h-28 md:h-36 w-44 md:w-52 flex flex-col justify-center shadow-xl border border-amber-500/30">
              <div className="font-bold text-white text-sm md:text-lg truncate mb-2">{top3[2].memberName}</div>
              <div className="text-xs md:text-sm text-amber-200 font-semibold">{top3[2].totalKm.toFixed(2)} km</div>
              <div className="text-xs text-amber-300 mt-1 truncate">{top3[2].teamName}</div>
            </div>
            <div className="bg-gradient-to-b from-amber-600 to-amber-800 w-full h-20 md:h-24 rounded-b-2xl flex items-center justify-center shadow-lg">
              <span className="text-white font-bold text-2xl md:text-3xl">3</span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const { maleCount, femaleCount } = getGenderStats();

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: customStyles }} />
      {showConfetti && <Confetti />}
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 text-white">
        <div className="relative overflow-hidden bg-black">
          <div className="absolute inset-0">
            <SafeImage 
              src='/meta.jpg'
              width={1920}  
              height={1080}
              alt="Race Banner" 
              className="w-full h-full object-cover opacity-40"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-black/20 to-black"></div>
          </div>

          <div className="relative container mx-auto px-3 md:px-4 py-6 md:py-8 lg:py-20">
            <div className="max-w-6xl mx-auto">
              <h1 className="text-2xl md:text-4xl lg:text-6xl font-black text-white mb-4 md:mb-6 text-shadow-lg animate-fade-in-up">
                {raceInfo?.meta_title || raceInfo?.title || 'META RUN 2025'}
              </h1>

              {raceInfo?.content && (
                <div className="animate-fade-in-up mb-4">
                  <div 
                    className={`text-sm md:text-base lg:text-lg text-gray-300 max-w-4xl content-html ${!isDescriptionExpanded ? 'description-collapsed' : ''}`}
                    dangerouslySetInnerHTML={{ __html: raceInfo.content }}
                  />
                  <button
                    onClick={() => setIsDescriptionExpanded(!isDescriptionExpanded)}
                    className="mt-2 px-3 py-1 md:px-4 md:py-2 bg-orange-500/20 hover:bg-orange-500/30 rounded-lg text-orange-300 text-xs md:text-sm font-semibold transition-all"
                  >
                    {isDescriptionExpanded ? '▲ Thu gọn' : '▼ Hiển thị thêm'}
                  </button>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4 mb-6 md:mb-8 animate-fade-in-up mobile-grid">
                <div className="backdrop-blur-xl bg-white/10 rounded-xl p-3 md:p-4 border border-white/20 hover:bg-white/15 transition-all duration-300 transform hover:scale-105 mobile-shadow">
                  <div className="flex items-center gap-3">
                    <div className="text-xl md:text-2xl lg:text-3xl">📅</div>
                    <div>
                      <div className="text-xs text-gray-400 mb-1">Thời gian thi đấu</div>
                      <div className="font-bold text-white text-xs md:text-sm">
                        {raceInfo?.start_time && raceInfo?.finish_time ? (
                          <>
                            {formatDate(raceInfo.start_time)} - {formatDate(raceInfo.finish_time)}
                          </>
                        ) : (
                          '15/09/2025 - 15/10/2025'
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="backdrop-blur-xl bg-white/10 rounded-xl p-3 md:p-4 border border-white/20 hover:bg-white/15 transition-all duration-300 transform hover:scale-105 mobile-shadow">
                  <div className="flex items-center gap-3">
                    <div className="text-xl md:text-2xl lg:text-3xl">🎯</div>
                    <div>
                      <div className="text-xs text-gray-400 mb-1">Tổng quãng đường</div>
                      <div className="font-bold text-white text-xs md:text-sm">
                        {countTotalDistance.toFixed(2)} km
                      </div>
                    </div>
                  </div>
                </div>

                <div className="backdrop-blur-xl bg-white/10 rounded-xl p-3 md:p-4 border border-white/20 hover:bg-white/15 transition-all duration-300 transform hover:scale-105 mobile-shadow">
                  <div className="flex items-center gap-3">
                    <div className="text-xl md:text-2xl lg:text-3xl">👥</div>
                    <div>
                      <div className="text-xs text-gray-400 mb-1">Vận động viên</div>
                      <div className="font-bold text-white text-xs md:text-sm">
                        {personalData.length} người
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="absolute bottom-0 left-0 right-0">
            <svg className="w-full h-8 md:h-16 fill-current text-gray-900" viewBox="0 0 1200 120" preserveAspectRatio="none">
              <path d="M0,0 C150,100 350,0 600,50 C850,100 1050,0 1200,50 L1200,120 L0,120 Z"></path>
            </svg>
          </div>
        </div>

        <div className="container mx-auto px-3 md:px-4 py-4 md:py-8 max-w-7xl">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-4 md:mb-6 lg:mb-8 gap-3 md:gap-4 lg:gap-6 backdrop-blur-md bg-white/10 rounded-xl md:rounded-2xl p-4 md:p-6 border border-white/20 shadow-xl mobile-flex-col mobile-items-start">
            <div className="flex items-center gap-3 md:gap-4">
              <div className="text-xl md:text-2xl">
                {isPersonal ? '👤' : isTeam ? '👥' : isDaily ? '📅' : isWeekly ? '📊' : '🏆'}
              </div>
              <h2 className="text-lg md:text-2xl font-bold text-white">
                {isPersonal ? 'Personal Rankings' : isTeam ? 'Team Rankings' : isDaily ? 'Daily Rankings' : isWeekly ? 'Weekly Rankings' : 'Weekly Team Rankings'}
              </h2>
            </div>

            {isPersonal && (
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 md:gap-4 mobile-w-full">
                <div className="flex items-center gap-2">
                  <span className="text-xs md:text-sm font-medium text-white">Filter:</span>
                  <div className="flex gap-1">
                    <button
                      onClick={() => setGenderFilter('all')}
                      className={`px-2 py-1 md:px-3 md:py-1 rounded-md text-xs transition-all ${genderFilter === 'all' ? 'bg-orange-500 text-white' : 'bg-white/10 text-gray-300 hover:text-white'}`}
                    >
                      All ({personalData.length})
                    </button>
                    <button
                      onClick={() => setGenderFilter('male')}
                      className={`px-2 py-1 md:px-3 md:py-1 rounded-md text-xs transition-all ${genderFilter === 'male' ? 'bg-blue-500 text-white' : 'bg-white/10 text-gray-300 hover:text-white'}`}
                    >
                      👨 Nam ({maleCount})
                    </button>
                    <button
                      onClick={() => setGenderFilter('female')}
                      className={`px-2 py-1 md:px-3 md:py-1 rounded-md text-xs transition-all ${genderFilter === 'female' ? 'bg-pink-500 text-white' : 'bg-white/10 text-gray-300 hover:text-white'}`}
                    >
                      👩 Nữ ({femaleCount})
                    </button>
                  </div>
                </div>
              </div>
            )}

            {isDaily && (
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 md:gap-4 mobile-w-full">
                <label className="text-xs md:text-sm font-medium text-white whitespace-nowrap">Chọn ngày:</label>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={handleDateChange}
                  className="px-3 py-2 md:px-4 md:py-2 rounded-lg md:rounded-xl bg-white/10 border border-white/20 text-white text-sm backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-orange-400 mobile-w-full"
                  max={new Date().toISOString().split('T')[0]}
                />
              </div>
            )}

            {isWeekly && (
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 md:gap-4 mobile-w-full">
                <label className="text-xs md:text-sm font-medium text-white whitespace-nowrap">Chọn tuần:</label>
                <div className="flex flex-col gap-1">
                  <input
                    type="date"
                    value={selectedWeekDate}
                    onChange={handleWeekDateChange}
                    className="px-3 py-2 md:px-4 md:py-2 rounded-lg md:rounded-xl bg-white/10 border border-white/20 text-white text-sm backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-orange-400 mobile-w-full"
                    max={new Date().toISOString().split('T')[0]}
                  />
                  <span className="text-xs text-gray-400">
                    {formatDate(formatDateForAPI(getMonday(new Date(selectedWeekDate))))} - {formatDate(formatDateForAPI(getSunday(new Date(selectedWeekDate))))}
                  </span>
                </div>
              </div>
            )}

            {isWeeklyTeam && (
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 md:gap-4 mobile-w-full">
                <label className="text-xs md:text-sm font-medium text-white whitespace-nowrap">Chọn tuần:</label>
                <div className="flex flex-col gap-1">
                  <input
                    type="date"
                    value={selectedWeekTeamDate}
                    onChange={handleWeekTeamDateChange}
                    className="px-3 py-2 md:px-4 md:py-2 rounded-lg md:rounded-xl bg-white/10 border border-white/20 text-white text-sm backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-orange-400 mobile-w-full"
                    max={new Date().toISOString().split('T')[0]}
                  />
                  <span className="text-xs text-gray-400">
                    {formatDate(formatDateForAPI(getMonday(new Date(selectedWeekTeamDate))))} - {formatDate(formatDateForAPI(getSunday(new Date(selectedWeekTeamDate))))}
                  </span>
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-center mb-4 md:mb-6 lg:mb-8">
            <div className="backdrop-blur-md bg-white/10 rounded-xl md:rounded-2xl p-1 md:p-2 border border-white/20 shadow-lg w-full max-w-2xl md:max-w-none md:w-auto overflow-x-auto">
              <div className="flex gap-1 min-w-max">
                <button 
                  onClick={() => setActiveTab('personal')} 
                  className={`py-2 px-3 md:py-3 md:px-5 font-bold rounded-lg md:rounded-xl transition-all duration-200 text-xs md:text-sm flex items-center justify-center gap-1 md:gap-2 whitespace-nowrap ${activeTab === 'personal' ? 'bg-white/20 text-white shadow-lg backdrop-blur-sm' : 'text-gray-300 hover:text-white hover:bg-white/10'}`}
                >
                  <span>👤</span> Personal
                </button>
                <button 
                  onClick={() => setActiveTab('team')} 
                  className={`py-2 px-3 md:py-3 md:px-5 font-bold rounded-lg md:rounded-xl transition-all duration-200 text-xs md:text-sm flex items-center justify-center gap-1 md:gap-2 whitespace-nowrap ${activeTab === 'team' ? 'bg-white/20 text-white shadow-lg backdrop-blur-sm' : 'text-gray-300 hover:text-white hover:bg-white/10'}`}
                >
                  <span>👥</span> Team
                </button>
                <button 
                  onClick={() => setActiveTab('daily')} 
                  className={`py-2 px-3 md:py-3 md:px-5 font-bold rounded-lg md:rounded-xl transition-all duration-200 text-xs md:text-sm flex items-center justify-center gap-1 md:gap-2 whitespace-nowrap ${activeTab === 'daily' ? 'bg-white/20 text-white shadow-lg backdrop-blur-sm' : 'text-gray-300 hover:text-white hover:bg-white/10'}`}
                >
                  <span>📅</span> Daily
                </button>
                <button 
                  onClick={() => setActiveTab('weekly')} 
                  className={`py-2 px-3 md:py-3 md:px-5 font-bold rounded-lg md:rounded-xl transition-all duration-200 text-xs md:text-sm flex items-center justify-center gap-1 md:gap-2 whitespace-nowrap ${activeTab === 'weekly' ? 'bg-white/20 text-white shadow-lg backdrop-blur-sm' : 'text-gray-300 hover:text-white hover:bg-white/10'}`}
                >
                  <span>📊</span> Weekly
                </button>
                <button 
                  onClick={() => setActiveTab('weeklyTeam')} 
                  className={`py-2 px-3 md:py-3 md:px-5 font-bold rounded-lg md:rounded-xl transition-all duration-200 text-xs md:text-sm flex items-center justify-center gap-1 md:gap-2 whitespace-nowrap ${activeTab === 'weeklyTeam' ? 'bg-white/20 text-white shadow-lg backdrop-blur-sm' : 'text-gray-300 hover:text-white hover:bg-white/10'}`}
                >
                  <span>🏆</span> W.Team
                </button>
              </div>
            </div>
          </div>

          {loading && (
            <div className="flex flex-col items-center justify-center py-16 md:py-20">
              <div className="animate-spin rounded-full h-8 w-8 md:h-12 md:w-12 border-4 border-gray-400 border-t-orange-400"></div>
              <div className="mt-4 text-white font-medium text-sm md:text-base">Loading race data...</div>
            </div>
          )}

          {!loading && isPersonal && (
            <div className="space-y-4 md:space-y-6 pt-8 md:pt-20">
              <PersonalPodium />
              <div className="overflow-hidden rounded-xl md:rounded-2xl backdrop-blur-md bg-white/10 border border-white/20 shadow-2xl">
                <div className="overflow-x-auto">
                  <table className="w-full mobile-table">
                    <thead className="backdrop-blur-sm bg-white/20">
                      <tr>
                        <th className="px-3 md:px-6 py-3 md:py-4 text-left text-xs md:text-sm font-bold text-white">🏅 Hạng</th>
                        <th className="px-3 md:px-6 py-3 md:py-4 text-left text-xs md:text-sm font-bold text-white">👤 Tên</th>
                        <th className="px-3 md:px-6 py-3 md:py-4 text-left text-xs md:text-sm font-bold text-white">🏃‍♂️ Quãng đường</th>
                        <th className="px-3 md:px-6 py-3 md:py-4 text-left text-xs md:text-sm font-bold text-white mobile-hidden">📊 Trạng thái</th>
                        <th className="px-3 md:px-6 py-3 md:py-4 text-left text-xs md:text-sm font-bold text-white mobile-hidden">Team</th>
                        <th className="px-3 md:px-6 py-3 md:py-4 text-left text-xs md:text-sm font-bold text-white">🔗 Links</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/10">
                      {filteredPersonalData.map((member, index) => {
                        const rank = index + 1;
                        const rankStyle = getRankStyling(rank);
                        const totalKm = parseFloat(member.final_value || '0');
                        const percentage = parseFloat(member.percent_finish || '0');
                        const user = getUserData(member.bib_number || member.id);
                        const hasAdjustment = member.adjustment_km !== undefined && member.adjustment_km !== 0;

                        return (
                          <tr key={member.id || index} className={`hover:bg-white/5 transition-colors duration-200 ${rank <= 3 ? 'bg-white/5' : ''}`}>
                            <td className="px-3 md:px-6 py-3 md:py-4 whitespace-nowrap" data-label="Hạng">
                              <div className={`inline-flex items-center justify-center w-8 h-8 md:w-10 md:h-10 rounded-full ${rankStyle.bg} ${rankStyle.text} shadow-lg`}>
                                <span className="text-xs md:text-sm font-bold">{rankStyle.icon} {rank}</span>
                              </div>
                            </td>
                            <td className="px-3 md:px-6 py-3 md:py-4 whitespace-nowrap" data-label="Tên">
                              <div className="flex items-center">
                                <SafeImage width={32} height={32} src={member.avatar || '/meta.png'} alt="Avatar" className="h-8 w-8 md:h-10 md:w-10 rounded-full object-cover mr-2 md:mr-3 border-2 border-white/20 shadow-md" />
                                <div>
                                  <div className="text-xs md:text-sm font-semibold text-white truncate max-w-[120px] md:max-w-none flex items-center gap-2">
                                    {member.full_name}
                                    {user && (
                                      <span className={`text-xs ${user.gender.toLowerCase() === 'male' || user.gender.toLowerCase() === 'm' ? 'text-blue-400' : 'text-pink-400'}`}>
                                        {user.gender.toLowerCase() === 'male' || user.gender.toLowerCase() === 'm' ? '👨' : '👩'}
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-xs text-gray-300">BIB: {member.bib_number || 'N/A'}</div>
                                  <div className="md:hidden text-xs text-gray-400 mt-1">{member.team_name}</div>
                                </div>
                              </div>
                            </td>
                            <td className="px-3 md:px-6 py-3 md:py-4 whitespace-nowrap" data-label="Quãng đường">
                              <div className="text-xs md:text-sm font-semibold text-white">{totalKm.toFixed(2)} km</div>
                              {hasAdjustment && (
                                <div className={`text-xs ${member.adjustment_km! < 0 ? 'text-red-400' : 'text-green-400'}`}>
                                  Điều chỉnh: {member.adjustment_km! > 0 ? '+' : ''}{member.adjustment_km!.toFixed(2)} km
                                </div>
                              )}
                              <div className="text-xs text-gray-400">{percentage.toFixed(1)}%</div>
                              <div className="md:hidden mt-1">
                                <span className={`inline-flex items-center px-2 py-1 text-xs font-semibold rounded-full ${percentage >= 100 ? 'bg-green-500/30 text-green-200' : 'bg-orange-500/30 text-orange-200'}`}>
                                  {percentage >= 100 ? '✅' : '🏃‍♂️'}
                                </span>
                              </div>
                            </td>
                            <td className="px-3 md:px-6 py-3 md:py-4 whitespace-nowrap mobile-hidden" data-label="Trạng thái">
                              <span className={`inline-flex items-center px-2 py-1 text-xs font-semibold rounded-full ${percentage >= 100 ? 'bg-green-500/30 text-green-200' : 'bg-orange-500/30 text-orange-200'}`}>
                                {percentage >= 100 ? '✅ Hoàn thành' : '🏃‍♂️ Đang thi'}
                              </span>
                            </td>
                            <td className="px-3 md:px-6 py-3 md:py-4 whitespace-nowrap text-xs text-gray-300 mobile-hidden" data-label="Team">{member.team_name || 'N/A'}</td>
                            <td className="px-3 md:px-6 py-3 md:py-4 whitespace-nowrap" data-label="Links">
                              <div className="flex flex-col md:flex-row gap-1 md:gap-2">
                                <a
                                  href={`https://84race.com/member/${member.bib_number || member.id}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center px-2 py-1 bg-blue-500/20 text-blue-300 rounded-md hover:bg-blue-500/30 transition-colors text-xs"
                                >
                                  <span className="mr-1">🏃</span>
                                  84Race
                                </a>
                                {user?.strava_id && (
                                  <a
                                    href={`https://www.strava.com/athletes/${user.strava_id}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center px-2 py-1 bg-orange-500/20 text-orange-300 rounded-md hover:bg-orange-500/30 transition-colors text-xs"
                                  >
                                    <span className="mr-1">🔥</span>
                                    Strava
                                  </a>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {!loading && isTeam && (
            <div className="space-y-4 md:space-y-6 pt-4 md:pt-8 lg:pt-20">
              <div className="flex justify-center mb-4 md:mb-6">
                <div className="backdrop-blur-md bg-white/10 rounded-xl p-1 border border-white/20 w-full max-w-sm md:max-w-none md:w-auto">
                  <div className="flex flex-col sm:flex-row gap-1">
                    <button
                      onClick={() => setTeamSortBy('total')}
                      className={`px-4 py-2 md:px-6 md:py-2 rounded-lg font-semibold transition-all text-xs md:text-sm flex items-center justify-center gap-1 md:gap-2 flex-1 sm:flex-initial ${teamSortBy === 'total' ? 'bg-orange-500 text-white' : 'text-gray-300 hover:text-white'}`}
                    >
                      <span>📊</span> Tổng KM
                    </button>
                    <button
                      onClick={() => setTeamSortBy('average')}
                      className={`px-4 py-2 md:px-6 md:py-2 rounded-lg font-semibold transition-all text-xs md:text-sm flex items-center justify-center gap-1 md:gap-2 flex-1 sm:flex-initial ${teamSortBy === 'average' ? 'bg-orange-500 text-white' : 'text-gray-300 hover:text-white'}`}
                    >
                      <span>📈</span> KM Trung Bình
                    </button>
                  </div>
                </div>
              </div>

              <TeamPodium />
              <div className="overflow-hidden rounded-xl md:rounded-2xl backdrop-blur-md bg-white/10 border border-white/20 shadow-2xl">
                <div className="overflow-x-auto">
                  <table className="w-full mobile-table">
                    <thead className="backdrop-blur-sm bg-white/20">
                      <tr>
                        <th className="px-3 md:px-6 py-3 md:py-4 text-left text-xs md:text-sm font-bold text-white">🏅 Hạng</th>
                        <th className="px-3 md:px-6 py-3 md:py-4 text-left text-xs md:text-sm font-bold text-white">👥 Tên đội</th>
                        <th className="px-3 md:px-6 py-3 md:py-4 text-left text-xs md:text-sm font-bold text-white mobile-hidden">👤 Thành viên</th>
                        <th className="px-3 md:px-6 py-3 md:py-4 text-left text-xs md:text-sm font-bold text-white">📊 TỔNG KM</th>
                        <th className="px-3 md:px-6 py-3 md:py-4 text-left text-xs md:text-sm font-bold text-white">📈 KM TB</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/10">
                      {getSortedTeams().map((team, index) => {
                        const rank = index + 1;
                        const rankStyle = getRankStyling(rank);

                        return (
                          <tr key={team.id || index} className={`hover:bg-white/5 transition-colors ${rank <= 3 ? 'bg-white/5' : ''}`}>
                            <td className="px-3 md:px-6 py-3 md:py-4 whitespace-nowrap" data-label="Hạng">
                              <div className={`inline-flex items-center justify-center w-8 h-8 md:w-10 md:h-10 rounded-full ${rankStyle.bg} ${rankStyle.text} shadow-lg`}>
                                <span className="text-xs md:text-sm font-bold">{rankStyle.icon} {rank}</span>
                              </div>
                            </td>
                            <td className="px-3 md:px-6 py-3 md:py-4 whitespace-nowrap" data-label="Tên đội">
                              <div className="flex items-center">
                                <div className="h-8 w-8 md:h-10 md:w-10 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center mr-2 md:mr-3 border-2 border-white/20 shadow-md">
                                  <span className="text-sm md:text-xl">👥</span>
                                </div>
                                <div>
                                  <div className="text-xs md:text-sm font-semibold text-white truncate max-w-[120px] md:max-w-none">{team.name}</div>
                                  <div className="md:hidden text-xs text-white mt-1">{team.total} thành viên</div>
                                </div>
                              </div>
                            </td>
                            <td className="px-3 md:px-6 py-3 md:py-4 whitespace-nowrap mobile-hidden" data-label="Thành viên">
                              <div className="text-xs md:text-sm font-semibold text-white">{team.total}</div>
                            </td>
                            <td className="px-3 md:px-6 py-3 md:py-4 whitespace-nowrap" data-label="Tổng KM">
                              <div className="text-xs md:text-sm font-bold text-orange-400">{parseFloat(team.total_distance).toFixed(2)} km</div>
                            </td>
                            <td className="px-3 md:px-6 py-3 md:py-4 whitespace-nowrap" data-label="KM TB">
                              <div className="text-xs md:text-sm font-semibold text-blue-400">{parseFloat(team.avg_distance).toFixed(2)} km</div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {!loading && isDaily && (
            <div className="space-y-4 md:space-y-6 pt-8 md:pt-20">
              {!dailyLoading && dailyRankings.length >= 3 && <DailyPodium />}

              <div className="overflow-hidden rounded-xl md:rounded-2xl backdrop-blur-md bg-white/10 border border-white/20 shadow-2xl">
                {dailyLoading ? (
                  <div className="flex flex-col items-center justify-center py-16 md:py-20">
                    <div className="animate-spin rounded-full h-8 w-8 md:h-12 md:w-12 border-4 border-gray-400 border-t-orange-400"></div>
                    <div className="mt-4 text-white font-medium text-sm md:text-base">Đang tải dữ liệu ngày {formatDate(selectedDate)}...</div>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full mobile-table">
                      <thead className="backdrop-blur-sm bg-white/20">
                        <tr>
                          <th className="px-3 md:px-6 py-3 md:py-4 text-left text-xs md:text-sm font-bold text-white">🏅 Hạng</th>
                          <th className="px-3 md:px-6 py-3 md:py-4 text-left text-xs md:text-sm font-bold text-white">👤 Vận động viên</th>
                          <th className="px-3 md:px-6 py-3 md:py-4 text-left text-xs md:text-sm font-bold text-white mobile-hidden">📅 Ngày</th>
                          <th className="px-3 md:px-6 py-3 md:py-4 text-left text-xs md:text-sm font-bold text-white">🏃‍♂️ KM chạy được</th>
                          <th className="px-3 md:px-6 py-3 md:py-4 text-left text-xs md:text-sm font-bold text-white mobile-hidden">Team</th>
                          <th className="px-3 md:px-6 py-3 md:py-4 text-left text-xs md:text-sm font-bold text-white">🔗 Links</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/10">
                        {dailyRankings.map((record, index) => {
                          const rank = index + 1;
                          const rankStyle = getRankStyling(rank);
                          const user = getUserData(record.memberId);

                          return (
                            <tr key={`${record.memberId}-${index}`} className={`hover:bg-white/5 transition-colors ${rank <= 3 ? 'bg-white/5' : ''}`}>
                              <td className="px-3 md:px-6 py-3 md:py-4 whitespace-nowrap" data-label="Hạng">
                                <div className={`inline-flex items-center justify-center w-8 h-8 md:w-10 md:h-10 rounded-full ${rankStyle.bg} ${rankStyle.text} shadow-lg`}>
                                  <span className="text-xs md:text-sm font-bold">{rankStyle.icon} {rank}</span>
                                </div>
                              </td>
                              <td className="px-3 md:px-6 py-3 md:py-4 whitespace-nowrap" data-label="Vận động viên">
                                <div className="flex items-center">
                                  <SafeImage width={32} height={32} src={record.avatar} alt={record.memberName} className="h-8 w-8 md:h-10 md:w-10 rounded-full object-cover mr-2 md:mr-3 border-2 border-white/20 shadow-md" />
                                  <div>
                                    <div className="text-xs md:text-sm font-semibold text-white truncate max-w-[120px] md:max-w-none">{record.memberName}</div>
                                    <div className="text-xs text-gray-300">BIB: {record.memberId}</div>
                                    <div className="md:hidden text-xs text-gray-400 mt-1">{record.teamName}</div>
                                    <div className="md:hidden text-xs text-white mt-1">{formatDate(record.date)}</div>
                                  </div>
                                </div>
                              </td>
                              <td className="px-3 md:px-6 py-3 md:py-4 whitespace-nowrap mobile-hidden" data-label="Ngày">
                                <div className="text-xs md:text-sm text-white">{formatDate(record.date)}</div>
                              </td>
                              <td className="px-3 md:px-6 py-3 md:py-4 whitespace-nowrap" data-label="KM chạy được">
                                <div className="text-xs md:text-sm font-bold text-orange-400">{record.km.toFixed(2)} km</div>
                                {record.violationKm && record.violationKm > 0 && (
                                  <div className="text-xs text-red-400 mt-1">Vi phạm: {record.violationKm.toFixed(2)} km</div>
                                )}
                              </td>
                              <td className="px-3 md:px-6 py-3 md:py-4 whitespace-nowrap mobile-hidden" data-label="Team">
                                <div className="text-xs text-gray-300">{record.teamName}</div>
                              </td>
                              <td className="px-3 md:px-6 py-3 md:py-4 whitespace-nowrap" data-label="Links">
                                <div className="flex flex-col md:flex-row gap-1 md:gap-2">
                                  <a
                                    href={`https://84race.com/member/${record.memberId}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center px-2 py-1 bg-blue-500/20 text-blue-300 rounded-md hover:bg-blue-500/30 transition-colors text-xs"
                                  >
                                    <span className="mr-1">🏃</span>
                                    84Race
                                  </a>
                                  {user?.strava_id && (
                                    <a
                                      href={`https://www.strava.com/athletes/${user.strava_id}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center px-2 py-1 bg-orange-500/20 text-orange-300 rounded-md hover:bg-orange-500/30 transition-colors text-xs"
                                    >
                                      <span className="mr-1">🔥</span>
                                      Strava
                                    </a>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                {!dailyLoading && dailyRankings.length === 0 && (
                  <div className="text-center py-12 md:py-16">
                    <div className="text-3xl md:text-4xl mb-4">📅</div>
                    <div className="text-base md:text-lg text-white font-semibold">Chưa có dữ liệu cho ngày này</div>
                    <div className="text-sm text-gray-300 mt-2">Vui lòng chọn ngày khác</div>
                  </div>
                )}
              </div>
            </div>
          )}

          {!loading && isWeekly && (
            <div className="space-y-4 md:space-y-6 pt-8 md:pt-20">
              {!weeklyLoading && weeklyRankings.length >= 3 && <WeeklyPodium />}

              <div className="overflow-hidden rounded-xl md:rounded-2xl backdrop-blur-md bg-white/10 border border-white/20 shadow-2xl">
                {weeklyLoading ? (
                  <div className="flex flex-col items-center justify-center py-16 md:py-20">
                    <div className="animate-spin rounded-full h-8 w-8 md:h-12 md:w-12 border-4 border-gray-400 border-t-orange-400"></div>
                    <div className="mt-4 text-white font-medium text-sm md:text-base">
                      Đang tải dữ liệu tuần {formatDate(formatDateForAPI(getMonday(new Date(selectedWeekDate))))} - {formatDate(formatDateForAPI(getSunday(new Date(selectedWeekDate))))}...
                    </div>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full mobile-table">
                      <thead className="backdrop-blur-sm bg-white/20">
                        <tr>
                          <th className="px-3 md:px-6 py-3 md:py-4 text-left text-xs md:text-sm font-bold text-white">🏅 Hạng</th>
                          <th className="px-3 md:px-6 py-3 md:py-4 text-left text-xs md:text-sm font-bold text-white">👤 Vận động viên</th>
                          <th className="px-3 md:px-6 py-3 md:py-4 text-left text-xs md:text-sm font-bold text-white mobile-hidden">📅 Tuần</th>
                          <th className="px-3 md:px-6 py-3 md:py-4 text-left text-xs md:text-sm font-bold text-white">🏃‍♂️ Tổng KM</th>
                          <th className="px-3 md:px-6 py-3 md:py-4 text-left text-xs md:text-sm font-bold text-white mobile-hidden">Team</th>
                          <th className="px-3 md:px-6 py-3 md:py-4 text-left text-xs md:text-sm font-bold text-white">🔗 Links</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/10">
                        {weeklyRankings.map((record, index) => {
                          const rank = index + 1;
                          const rankStyle = getRankStyling(rank);
                          const user = getUserData(record.memberId);
                          const hasAdjustment = record.adjustmentKm !== undefined && record.adjustmentKm !== 0;

                          return (
                            <tr key={`${record.memberId}-${index}`} className={`hover:bg-white/5 transition-colors ${rank <= 3 ? 'bg-white/5' : ''}`}>
                              <td className="px-3 md:px-6 py-3 md:py-4 whitespace-nowrap" data-label="Hạng">
                                <div className={`inline-flex items-center justify-center w-8 h-8 md:w-10 md:h-10 rounded-full ${rankStyle.bg} ${rankStyle.text} shadow-lg`}>
                                  <span className="text-xs md:text-sm font-bold">{rankStyle.icon} {rank}</span>
                                </div>
                              </td>
                              <td className="px-3 md:px-6 py-3 md:py-4 whitespace-nowrap" data-label="Vận động viên">
                                <div className="flex items-center">
                                  <SafeImage width={32} height={32} src={record.avatar} alt={record.memberName} className="h-8 w-8 md:h-10 md:w-10 rounded-full object-cover mr-2 md:mr-3 border-2 border-white/20 shadow-md" />
                                  <div>
                                    <div className="text-xs md:text-sm font-semibold text-white truncate max-w-[120px] md:max-w-none">{record.memberName}</div>
                                    <div className="text-xs text-gray-300">BIB: {record.memberId}</div>
                                    <div className="md:hidden text-xs text-gray-400 mt-1">{record.teamName}</div>
                                    <div className="md:hidden text-xs text-white mt-1">
                                      {formatDate(record.startDate)} - {formatDate(record.endDate)}
                                    </div>
                                  </div>
                                </div>
                              </td>
                              <td className="px-3 md:px-6 py-3 md:py-4 whitespace-nowrap mobile-hidden" data-label="Tuần">
                                <div className="text-xs md:text-sm text-white">
                                  {formatDate(record.startDate)} - {formatDate(record.endDate)}
                                </div>
                              </td>
                              <td className="px-3 md:px-6 py-3 md:py-4 whitespace-nowrap" data-label="Tổng KM">
                                <div className="text-xs md:text-sm font-bold text-orange-400">{record.totalKm.toFixed(2)} km</div>
                                {hasAdjustment && (
                                  <div className={`text-xs ${record.adjustmentKm! < 0 ? 'text-red-400' : 'text-green-400'}`}>
                                    Điều chỉnh: {record.adjustmentKm! > 0 ? '+' : ''}{record.adjustmentKm!.toFixed(2)} km
                                  </div>
                                )}
                                {record.violationKm && record.violationKm > 0 && (
                                  <div className="text-xs text-red-400 mt-1">Vi phạm: {record.violationKm.toFixed(2)} km</div>
                                )}
                              </td>
                              <td className="px-3 md:px-6 py-3 md:py-4 whitespace-nowrap mobile-hidden" data-label="Team">
                                <div className="text-xs text-gray-300">{record.teamName}</div>
                              </td>
                              <td className="px-3 md:px-6 py-3 md:py-4 whitespace-nowrap" data-label="Links">
                                <div className="flex flex-col md:flex-row gap-1 md:gap-2">
                                  <a
                                    href={`https://84race.com/member/${record.memberId}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center px-2 py-1 bg-blue-500/20 text-blue-300 rounded-md hover:bg-blue-500/30 transition-colors text-xs"
                                  >
                                    <span className="mr-1">🏃</span>
                                    84Race
                                  </a>
                                  {user?.strava_id && (
                                    <a
                                      href={`https://www.strava.com/athletes/${user.strava_id}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center px-2 py-1 bg-orange-500/20 text-orange-300 rounded-md hover:bg-orange-500/30 transition-colors text-xs"
                                    >
                                      <span className="mr-1">🔥</span>
                                      Strava
                                    </a>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                {!weeklyLoading && weeklyRankings.length === 0 && (
                  <div className="text-center py-12 md:py-16">
                    <div className="text-3xl md:text-4xl mb-4">📊</div>
                    <div className="text-base md:text-lg text-white font-semibold">Chưa có dữ liệu cho tuần này</div>
                    <div className="text-sm text-gray-300 mt-2">Vui lòng chọn tuần khác</div>
                  </div>
                )}
              </div>
            </div>
          )}

          {!loading && isWeeklyTeam && (
            <div className="space-y-4 md:space-y-6 pt-8 md:pt-20">
              <div className="flex justify-center mb-4 md:mb-6">
                <div className="backdrop-blur-md bg-white/10 rounded-xl p-1 border border-white/20 w-full max-w-sm md:max-w-none md:w-auto">
                  <div className="flex flex-col sm:flex-row gap-1">
                    <button
                      onClick={() => setWeeklyTeamSortBy('total')}
                      className={`px-4 py-2 md:px-6 md:py-2 rounded-lg font-semibold transition-all text-xs md:text-sm flex items-center justify-center gap-1 md:gap-2 flex-1 sm:flex-initial ${weeklyTeamSortBy === 'total' ? 'bg-orange-500 text-white' : 'text-gray-300 hover:text-white'}`}
                    >
                      <span>📊</span> Tổng KM
                    </button>
                    <button
                      onClick={() => setWeeklyTeamSortBy('average')}
                      className={`px-4 py-2 md:px-6 md:py-2 rounded-lg font-semibold transition-all text-xs md:text-sm flex items-center justify-center gap-1 md:gap-2 flex-1 sm:flex-initial ${weeklyTeamSortBy === 'average' ? 'bg-orange-500 text-white' : 'text-gray-300 hover:text-white'}`}
                    >
                      <span>📈</span> KM Trung Bình
                    </button>
                  </div>
                </div>
              </div>

              {!weeklyTeamLoading && getSortedWeeklyTeams().length >= 3 && (
                <div className="mb-6 md:mb-8">
                  <div className="text-center mb-4 md:mb-6">
                    <h3 className="text-sm md:text-lg lg:text-xl font-bold text-orange-400">
                      🏆 Top 3 Team tuần {formatDate(formatDateForAPI(getMonday(new Date(selectedWeekTeamDate))))} - {formatDate(formatDateForAPI(getSunday(new Date(selectedWeekTeamDate))))}
                    </h3>
                  </div>
                  
                  <div className="block md:hidden space-y-3">
                    {getSortedWeeklyTeams().slice(0, 3).map((team, index) => {
                      const rank = index + 1;
                      const rankStyle = getRankStyling(rank);
                      return (
                        <div key={team.teamName} className="backdrop-blur-md bg-white/10 rounded-xl p-4 border border-white/20">
                          <div className="flex items-center gap-3">
                            <div className={`w-12 h-12 rounded-full ${rankStyle.bg} ${rankStyle.text} flex items-center justify-center`}>
                              <span className="text-lg font-bold">{rankStyle.icon} {rank}</span>
                            </div>
                            <div className="flex-1">
                              <div className="font-bold text-white text-sm truncate">{team.teamName}</div>
                              <div className="text-xs text-gray-300">{team.memberCount} thành viên</div>
                              <div className="text-orange-400 text-sm font-semibold">
                                {weeklyTeamSortBy === 'total' 
                                  ? `${team.totalKm.toFixed(2)} km` 
                                  : `${team.avgKm.toFixed(2)} km TB`
                                }
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="hidden md:flex justify-center items-end gap-4 md:gap-6 h-80 md:h-96">
                    {getSortedWeeklyTeams().slice(0, 3).map((team, index) => {
                      const rank = index + 1;
                      if (rank === 2) {
                        return (
                          <div key={team.teamName} className="flex flex-col items-center animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
                            <div className="relative mb-4 animate-float" style={{ animationDelay: '0.2s' }}>
                              <div className="h-16 w-16 md:h-20 md:w-20 rounded-full bg-gradient-to-br from-gray-300 to-gray-500 flex items-center justify-center border-4 border-white shadow-xl">
                                <span className="text-xl md:text-2xl">👥</span>
                              </div>
                              <div className="absolute -top-2 -right-2 text-2xl md:text-3xl">🥈</div>
                            </div>
                            <div className="backdrop-blur-md bg-gray-300/20 rounded-2xl p-4 md:p-6 text-center h-32 md:h-40 w-44 md:w-52 flex flex-col justify-center shadow-xl border border-gray-300/30">
                              <div className="font-bold text-white text-sm md:text-lg truncate mb-2">{team.teamName}</div>
                              <div className="text-xs md:text-sm text-gray-200 font-semibold">
                                {weeklyTeamSortBy === 'total' 
                                  ? `${team.totalKm.toFixed(2)} km` 
                                  : `${team.avgKm.toFixed(2)} km TB`
                                }
                              </div>
                              <div className="text-xs text-gray-300 mt-1">{team.memberCount} thành viên</div>
                            </div>
                            <div className="bg-gradient-to-b from-gray-300 to-gray-500 w-full h-24 md:h-28 rounded-b-2xl flex items-center justify-center shadow-lg">
                              <span className="text-white font-bold text-2xl md:text-3xl">2</span>
                            </div>
                          </div>
                        );
                      } else if (rank === 1) {
                        return (
                          <div key={team.teamName} className="flex flex-col items-center animate-fade-in-up" style={{ animationDelay: '0s' }}>
                            <div className="relative mb-4 animate-float">
                              <div className="pulse-glow rounded-full p-1 bg-gradient-to-r from-yellow-400 to-orange-400">
                                <div className="h-20 w-20 md:h-24 md:w-24 rounded-full bg-gradient-to-br from-yellow-400 to-orange-400 flex items-center justify-center border-4 border-white shadow-2xl">
                                  <span className="text-2xl md:text-3xl">👥</span>
                                </div>
                              </div>
                              <div className="absolute -top-3 -right-3 text-3xl md:text-4xl animate-bounce">👑</div>
                            </div>
                            <div className="backdrop-blur-md bg-gradient-to-br from-yellow-400/30 via-orange-400/30 to-yellow-400/30 rounded-2xl p-4 md:p-6 text-center h-40 md:h-48 w-48 md:w-56 flex flex-col justify-center shadow-2xl border-2 border-yellow-300/40 relative overflow-hidden">
                              <div className="absolute inset-0 animate-shimmer"></div>
                              <div className="relative z-10">
                                <div className="text-lg md:text-2xl mb-2">🏆 CHAMPION</div>
                                <div className="font-bold text-white text-base md:text-xl truncate mb-2">{team.teamName}</div>
                                <div className="text-xs md:text-sm text-yellow-100 font-semibold">
                                  {weeklyTeamSortBy === 'total' 
                                    ? `${team.totalKm.toFixed(2)} km` 
                                    : `${team.avgKm.toFixed(2)} km TB`
                                  }
                                </div>
                                <div className="text-xs text-yellow-200 mt-1">{team.memberCount} thành viên</div>
                              </div>
                            </div>
                            <div className="bg-gradient-to-b from-yellow-400 via-yellow-500 to-yellow-600 w-full h-32 md:h-40 rounded-b-2xl flex items-center justify-center shadow-lg relative overflow-hidden">
                              <div className="absolute inset-0 animate-shimmer"></div>
                              <span className="text-white font-bold text-3xl md:text-4xl relative z-10">1</span>
                            </div>
                          </div>
                        );
                      } else {
                        return (
                          <div key={team.teamName} className="flex flex-col items-center animate-fade-in-up" style={{ animationDelay: '0.4s' }}>
                            <div className="relative mb-4 animate-float" style={{ animationDelay: '0.4s' }}>
                              <div className="h-16 w-16 md:h-20 md:w-20 rounded-full bg-gradient-to-br from-amber-600 to-amber-800 flex items-center justify-center border-4 border-white shadow-xl">
                                <span className="text-xl md:text-2xl">👥</span>
                              </div>
                              <div className="absolute -top-2 -right-2 text-2xl md:text-3xl">🥉</div>
                            </div>
                            <div className="backdrop-blur-md bg-amber-600/20 rounded-2xl p-4 md:p-6 text-center h-28 md:h-36 w-44 md:w-52 flex flex-col justify-center shadow-xl border border-amber-500/30">
                              <div className="font-bold text-white text-sm md:text-lg truncate mb-2">{team.teamName}</div>
                              <div className="text-xs md:text-sm text-amber-200 font-semibold">
                                {weeklyTeamSortBy === 'total' 
                                  ? `${team.totalKm.toFixed(2)} km` 
                                  : `${team.avgKm.toFixed(2)} km TB`
                                }
                              </div>
                              <div className="text-xs text-amber-300 mt-1">{team.memberCount} thành viên</div>
                            </div>
                            <div className="bg-gradient-to-b from-amber-600 to-amber-800 w-full h-20 md:h-24 rounded-b-2xl flex items-center justify-center shadow-lg">
                              <span className="text-white font-bold text-2xl md:text-3xl">3</span>
                            </div>
                          </div>
                        );
                      }
                    })}
                  </div>
                </div>
              )}

              <div className="overflow-hidden rounded-xl md:rounded-2xl backdrop-blur-md bg-white/10 border border-white/20 shadow-2xl">
                {weeklyTeamLoading ? (
                  <div className="flex flex-col items-center justify-center py-16 md:py-20">
                    <div className="animate-spin rounded-full h-8 w-8 md:h-12 md:w-12 border-4 border-gray-400 border-t-orange-400"></div>
                    <div className="mt-4 text-white font-medium text-sm md:text-base">
                      Đang tải dữ liệu team tuần {formatDate(formatDateForAPI(getMonday(new Date(selectedWeekTeamDate))))} - {formatDate(formatDateForAPI(getSunday(new Date(selectedWeekTeamDate))))}...
                    </div>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full mobile-table">
                      <thead className="backdrop-blur-sm bg-white/20">
                        <tr>
                          <th className="px-3 md:px-6 py-3 md:py-4 text-left text-xs md:text-sm font-bold text-white">🏅 Hạng</th>
                          <th className="px-3 md:px-6 py-3 md:py-4 text-left text-xs md:text-sm font-bold text-white">👥 Team</th>
                          <th className="px-3 md:px-6 py-3 md:py-4 text-left text-xs md:text-sm font-bold text-white mobile-hidden">👤 Thành viên</th>
                          <th className="px-3 md:px-6 py-3 md:py-4 text-left text-xs md:text-sm font-bold text-white">📊 Tổng KM</th>
                          <th className="px-3 md:px-6 py-3 md:py-4 text-left text-xs md:text-sm font-bold text-white mobile-hidden">📈 KM TB</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/10">
                        {getSortedWeeklyTeams().map((team, index) => {
                          const rank = index + 1;
                          const rankStyle = getRankStyling(rank);

                          return (
                            <tr key={team.teamName} className={`hover:bg-white/5 transition-colors ${rank <= 3 ? 'bg-white/5' : ''}`}>
                              <td className="px-3 md:px-6 py-3 md:py-4 whitespace-nowrap" data-label="Hạng">
                                <div className={`inline-flex items-center justify-center w-8 h-8 md:w-10 md:h-10 rounded-full ${rankStyle.bg} ${rankStyle.text} shadow-lg`}>
                                  <span className="text-xs md:text-sm font-bold">{rankStyle.icon} {rank}</span>
                                </div>
                              </td>
                              <td className="px-3 md:px-6 py-3 md:py-4 whitespace-nowrap" data-label="Team">
                                <div className="flex items-center">
                                  <div className="h-8 w-8 md:h-10 md:w-10 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center mr-2 md:mr-3 border-2 border-white/20 shadow-md">
                                    <span className="text-sm md:text-xl">👥</span>
                                  </div>
                                  <div>
                                    <div className="text-xs md:text-sm font-semibold text-white truncate max-w-[120px] md:max-w-none">{team.teamName}</div>
                                    <div className="md:hidden text-xs text-white mt-1">{team.memberCount} thành viên</div>
                                  </div>
                                </div>
                              </td>
                              <td className="px-3 md:px-6 py-3 md:py-4 whitespace-nowrap mobile-hidden" data-label="Thành viên">
                                <div className="text-xs md:text-sm font-semibold text-white">{team.memberCount}</div>
                              </td>
                              <td className="px-3 md:px-6 py-3 md:py-4 whitespace-nowrap" data-label="Tổng KM">
                                <div className="text-xs md:text-sm font-bold text-orange-400">{team.totalKm.toFixed(2)} km</div>
                                <div className="md:hidden text-xs text-blue-400 mt-1">TB: {team.avgKm.toFixed(2)} km</div>
                              </td>
                              <td className="px-3 md:px-6 py-3 md:py-4 whitespace-nowrap mobile-hidden" data-label="KM TB">
                                <div className="text-xs md:text-sm font-semibold text-blue-400">{team.avgKm.toFixed(2)} km</div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                {!weeklyTeamLoading && weeklyTeamRankings.length === 0 && (
                  <div className="text-center py-12 md:py-16">
                    <div className="text-3xl md:text-4xl mb-4">🏆</div>
                    <div className="text-base md:text-lg text-white font-semibold">Chưa có dữ liệu team cho tuần này</div>
                    <div className="text-sm text-gray-300 mt-2">Vui lòng chọn tuần khác</div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}