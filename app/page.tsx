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

export default function App() {
  const [personalData, setPersonalData] = useState<Member[]>([]);
  const [teamData, setTeamData] = useState<Team[]>([]);
  const [dailyRankings, setDailyRankings] = useState<DailyMemberKm[]>([]);
  const [raceInfo, setRaceInfo] = useState<RaceInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [dailyLoading, setDailyLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'personal' | 'team' | 'daily'>('personal');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [showConfetti, setShowConfetti] = useState(false);
  const [countTotalDistance, setCountTotalDistance] = useState(0);
  const [teamSortBy, setTeamSortBy] = useState<'total' | 'average'>('total');
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);

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

  // Sort teams based on selected criteria
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

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
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

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSelectedDate(e.target.value);
  };

  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement>) => {
    e.currentTarget.src = '/meta.png';
  };

  const isPersonal = activeTab === 'personal';
  const isTeam = activeTab === 'team';
  const isDaily = activeTab === 'daily';

  // Personal podium component
  const PersonalPodium = () => {
    if (personalData.length < 3) return null;
    const top3 = personalData.slice(0, 3);

    return (
      <div className="hidden lg:block mb-8">
        <div className="flex justify-center items-end gap-6 h-96">
          <div className="flex flex-col items-center animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
            <div className="relative mb-4 animate-float" style={{ animationDelay: '0.2s' }}>
              <Image width={40} height={40} src={top3[1].avatar} alt="2nd" className="h-20 w-20 rounded-full object-cover border-4 border-gray-300 shadow-xl" onError={handleImageError} />
              <div className="absolute -top-2 -right-2 text-3xl">🥈</div>
            </div>
            <div className="backdrop-blur-md bg-gray-300/20 rounded-2xl p-6 text-center h-40 w-52 flex flex-col justify-center shadow-xl border border-gray-300/30">
              <div className="font-bold text-white text-lg truncate mb-2">{top3[1].full_name}</div>
              <div className="text-sm text-gray-200 font-semibold">{parseFloat(top3[1].final_value).toFixed(2)} km</div>
              <div className="text-xs text-gray-300 mt-1">{top3[1].team_name}</div>
            </div>
            <div className="bg-gradient-to-b from-gray-300 to-gray-500 w-full h-28 rounded-b-2xl flex items-center justify-center shadow-lg">
              <span className="text-white font-bold text-3xl">2</span>
            </div>
          </div>

          <div className="flex flex-col items-center animate-fade-in-up" style={{ animationDelay: '0s' }}>
            <div className="relative mb-4 animate-float">
              <div className="pulse-glow rounded-full p-1 bg-gradient-to-r from-yellow-400 to-orange-400">
                <Image width={40} height={40} src={top3[0].avatar} alt="1st" className="h-24 w-24 rounded-full object-cover border-4 border-white shadow-2xl" onError={handleImageError} />
              </div>
              <div className="absolute -top-3 -right-3 text-4xl animate-bounce">👑</div>
            </div>
            <div className="backdrop-blur-md bg-gradient-to-br from-yellow-400/30 via-orange-400/30 to-yellow-400/30 rounded-2xl p-6 text-center h-48 w-56 flex flex-col justify-center shadow-2xl border-2 border-yellow-300/40 relative overflow-hidden">
              <div className="absolute inset-0 animate-shimmer"></div>
              <div className="relative z-10">
                <div className="text-2xl mb-2">🏆 CHAMPION</div>
                <div className="font-bold text-white text-xl truncate mb-2">{top3[0].full_name}</div>
                <div className="text-sm text-yellow-100 font-semibold">{parseFloat(top3[0].final_value).toFixed(2)} km</div>
                <div className="text-xs text-yellow-200 mt-1">{top3[0].team_name}</div>
              </div>
            </div>
            <div className="bg-gradient-to-b from-yellow-400 via-yellow-500 to-yellow-600 w-full h-40 rounded-b-2xl flex items-center justify-center shadow-lg relative overflow-hidden">
              <div className="absolute inset-0 animate-shimmer"></div>
              <span className="text-white font-bold text-4xl relative z-10">1</span>
            </div>
          </div>

          <div className="flex flex-col items-center animate-fade-in-up" style={{ animationDelay: '0.4s' }}>
            <div className="relative mb-4 animate-float" style={{ animationDelay: '0.4s' }}>
              <Image width={40} height={40} src={top3[2].avatar} alt="3rd" className="h-20 w-20 rounded-full object-cover border-4 border-amber-600 shadow-xl" onError={handleImageError} />
              <div className="absolute -top-2 -right-2 text-3xl">🥉</div>
            </div>
            <div className="backdrop-blur-md bg-amber-600/20 rounded-2xl p-6 text-center h-36 w-52 flex flex-col justify-center shadow-xl border border-amber-500/30">
              <div className="font-bold text-white text-lg truncate mb-2">{top3[2].full_name}</div>
              <div className="text-sm text-amber-200 font-semibold">{parseFloat(top3[2].final_value).toFixed(2)} km</div>
              <div className="text-xs text-amber-300 mt-1">{top3[2].team_name}</div>
            </div>
            <div className="bg-gradient-to-b from-amber-600 to-amber-800 w-full h-24 rounded-b-2xl flex items-center justify-center shadow-lg">
              <span className="text-white font-bold text-3xl">3</span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Team podium component
  const TeamPodium = () => {
    const sortedTeams = getSortedTeams();
    if (sortedTeams.length < 3) return null;
    const top3 = sortedTeams.slice(0, 3);

    return (
      <div className="hidden lg:block mb-8">
        <div className="text-center mb-6">
          <h3 className="text-xl font-bold text-orange-400">
            Top 3 theo {teamSortBy === 'total' ? 'Tổng KM' : 'KM Trung Bình'}
          </h3>
        </div>
        <div className="flex justify-center items-end gap-6 h-96">
          <div className="flex flex-col items-center animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
            <div className="relative mb-4 animate-float" style={{ animationDelay: '0.2s' }}>
              <div className="h-20 w-20 rounded-full bg-gradient-to-br from-gray-300 to-gray-500 flex items-center justify-center border-4 border-gray-300 shadow-xl">
                <span className="text-3xl">👥</span>
              </div>
              <div className="absolute -top-2 -right-2 text-3xl">🥈</div>
            </div>
            <div className="backdrop-blur-md bg-gray-300/20 rounded-2xl p-6 text-center h-40 w-52 flex flex-col justify-center shadow-xl border border-gray-300/30">
              <div className="font-bold text-white text-lg truncate mb-2">{top3[1].name}</div>
              <div className="text-sm text-gray-200 font-semibold">
                {teamSortBy === 'total' 
                  ? `${parseFloat(top3[1].total_distance).toFixed(2)} km`
                  : `${parseFloat(top3[1].avg_distance).toFixed(2)} km TB`
                }
              </div>
              <div className="text-xs text-gray-300 mt-1">{top3[1].total} thành viên</div>
            </div>
            <div className="bg-gradient-to-b from-gray-300 to-gray-500 w-full h-28 rounded-b-2xl flex items-center justify-center shadow-lg">
              <span className="text-white font-bold text-3xl">2</span>
            </div>
          </div>

          <div className="flex flex-col items-center animate-fade-in-up" style={{ animationDelay: '0s' }}>
            <div className="relative mb-4 animate-float">
              <div className="pulse-glow rounded-full p-1 bg-gradient-to-r from-yellow-400 to-orange-400">
                <div className="h-24 w-24 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center border-4 border-white shadow-2xl">
                  <span className="text-4xl">👥</span>
                </div>
              </div>
              <div className="absolute -top-3 -right-3 text-4xl animate-bounce">👑</div>
            </div>
            <div className="backdrop-blur-md bg-gradient-to-br from-yellow-400/30 via-orange-400/30 to-yellow-400/30 rounded-2xl p-6 text-center h-48 w-56 flex flex-col justify-center shadow-2xl border-2 border-yellow-300/40 relative overflow-hidden">
              <div className="absolute inset-0 animate-shimmer"></div>
              <div className="relative z-10">
                <div className="text-2xl mb-2">🏆 TOP TEAM</div>
                <div className="font-bold text-white text-xl truncate mb-2">{top3[0].name}</div>
                <div className="text-sm text-yellow-100 font-semibold">
                  {teamSortBy === 'total' 
                    ? `${parseFloat(top3[0].total_distance).toFixed(2)} km`
                    : `${parseFloat(top3[0].avg_distance).toFixed(2)} km TB`
                  }
                </div>
                <div className="text-xs text-yellow-200 mt-1">{top3[0].total} thành viên</div>
              </div>
            </div>
            <div className="bg-gradient-to-b from-yellow-400 via-yellow-500 to-yellow-600 w-full h-40 rounded-b-2xl flex items-center justify-center shadow-lg relative overflow-hidden">
              <div className="absolute inset-0 animate-shimmer"></div>
              <span className="text-white font-bold text-4xl relative z-10">1</span>
            </div>
          </div>

          <div className="flex flex-col items-center animate-fade-in-up" style={{ animationDelay: '0.4s' }}>
            <div className="relative mb-4 animate-float" style={{ animationDelay: '0.4s' }}>
              <div className="h-20 w-20 rounded-full bg-gradient-to-br from-amber-600 to-amber-800 flex items-center justify-center border-4 border-amber-600 shadow-xl">
                <span className="text-3xl">👥</span>
              </div>
              <div className="absolute -top-2 -right-2 text-3xl">🥉</div>
            </div>
            <div className="backdrop-blur-md bg-amber-600/20 rounded-2xl p-6 text-center h-36 w-52 flex flex-col justify-center shadow-xl border border-amber-500/30">
              <div className="font-bold text-white text-lg truncate mb-2">{top3[2].name}</div>
              <div className="text-sm text-amber-200 font-semibold">
                {teamSortBy === 'total' 
                  ? `${parseFloat(top3[2].total_distance).toFixed(2)} km`
                  : `${parseFloat(top3[2].avg_distance).toFixed(2)} km TB`
                }
              </div>
              <div className="text-xs text-amber-300 mt-1">{top3[2].total} thành viên</div>
            </div>
            <div className="bg-gradient-to-b from-amber-600 to-amber-800 w-full h-24 rounded-b-2xl flex items-center justify-center shadow-lg">
              <span className="text-white font-bold text-3xl">3</span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Daily podium component
  const DailyPodium = () => {
    if (dailyRankings.length < 3) return null;

    return (
      <div className="hidden lg:block mb-8">
        <div className="flex justify-center items-end gap-6 h-96">
          <div className="flex flex-col items-center animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
            <div className="relative mb-4 animate-float" style={{ animationDelay: '0.2s' }}>
              <Image width={40} height={40} src={dailyRankings[1].avatar} alt="2nd" className="h-20 w-20 rounded-full object-cover border-4 border-gray-300 shadow-xl" onError={handleImageError} />
              <div className="absolute -top-2 -right-2 text-3xl">🥈</div>
            </div>
            <div className="backdrop-blur-md bg-gray-300/20 rounded-2xl p-6 text-center h-40 w-52 flex flex-col justify-center shadow-xl border border-gray-300/30">
              <div className="font-bold text-white text-lg truncate mb-2">{dailyRankings[1].memberName}</div>
              <div className="text-sm text-gray-200 font-semibold">{dailyRankings[1].km.toFixed(2)} km</div>
              <div className="text-xs text-gray-300 mt-1">{formatDate(dailyRankings[1].date)}</div>
            </div>
            <div className="bg-gradient-to-b from-gray-300 to-gray-500 w-full h-28 rounded-b-2xl flex items-center justify-center shadow-lg">
              <span className="text-white font-bold text-3xl">2</span>
            </div>
          </div>

          <div className="flex flex-col items-center animate-fade-in-up" style={{ animationDelay: '0s' }}>
            <div className="relative mb-4 animate-float">
              <div className="pulse-glow rounded-full p-1 bg-gradient-to-r from-yellow-400 to-orange-400">
                <Image width={40} height={40} src={dailyRankings[0].avatar} alt="1st" className="h-24 w-24 rounded-full object-cover border-4 border-white shadow-2xl" onError={handleImageError} />
              </div>
              <div className="absolute -top-3 -right-3 text-4xl animate-bounce">👑</div>
            </div>
            <div className="backdrop-blur-md bg-gradient-to-br from-yellow-400/30 via-orange-400/30 to-yellow-400/30 rounded-2xl p-6 text-center h-48 w-56 flex flex-col justify-center shadow-2xl border-2 border-yellow-300/40 relative overflow-hidden">
              <div className="absolute inset-0 animate-shimmer"></div>
              <div className="relative z-10">
                <div className="text-2xl mb-2">🏆 TOP 1</div>
                <div className="font-bold text-white text-xl truncate mb-2">{dailyRankings[0].memberName}</div>
                <div className="text-sm text-yellow-100 font-semibold">{dailyRankings[0].km.toFixed(2)} km</div>
                <div className="text-xs text-yellow-200 mt-1">{formatDate(dailyRankings[0].date)}</div>
              </div>
            </div>
            <div className="bg-gradient-to-b from-yellow-400 via-yellow-500 to-yellow-600 w-full h-40 rounded-b-2xl flex items-center justify-center shadow-lg relative overflow-hidden">
              <div className="absolute inset-0 animate-shimmer"></div>
              <span className="text-white font-bold text-4xl relative z-10">1</span>
            </div>
          </div>

          <div className="flex flex-col items-center animate-fade-in-up" style={{ animationDelay: '0.4s' }}>
            <div className="relative mb-4 animate-float" style={{ animationDelay: '0.4s' }}>
              <Image width={40} height={40} src={dailyRankings[2].avatar} alt="3rd" className="h-20 w-20 rounded-full object-cover border-4 border-amber-600 shadow-xl" onError={handleImageError} />
              <div className="absolute -top-2 -right-2 text-3xl">🥉</div>
            </div>
            <div className="backdrop-blur-md bg-amber-600/20 rounded-2xl p-6 text-center h-36 w-52 flex flex-col justify-center shadow-xl border border-amber-500/30">
              <div className="font-bold text-white text-lg truncate mb-2">{dailyRankings[2].memberName}</div>
              <div className="text-sm text-amber-200 font-semibold">{dailyRankings[2].km.toFixed(2)} km</div>
              <div className="text-xs text-amber-300 mt-1">{formatDate(dailyRankings[2].date)}</div>
            </div>
            <div className="bg-gradient-to-b from-amber-600 to-amber-800 w-full h-24 rounded-b-2xl flex items-center justify-center shadow-lg">
              <span className="text-white font-bold text-3xl">3</span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: customStyles }} />
      {showConfetti && <Confetti />}
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 text-white">
        <div className="relative overflow-hidden bg-black">
          <div className="absolute inset-0">
            <Image 
              src='/meta.jpg'
              width={1920}  
              height={1080}
              alt="Race Banner" 
              className="w-full h-full object-cover opacity-40"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-black/20 to-black"></div>
          </div>

          <div className="relative container mx-auto px-4 py-12 md:py-20">
            <div className="max-w-6xl mx-auto">
              <div className="animate-slide-in mb-6">
                <span className="inline-flex items-center gap-2 px-4 py-2 bg-orange-500/20 backdrop-blur-sm border border-orange-500/30 rounded-full text-orange-300 text-sm font-semibold">
                  <span className="text-lg">🏃</span>
                  META RUNNING CHALLENGE
                </span>
              </div>

              <h1 className="text-3xl md:text-5xl lg:text-6xl font-black text-white mb-6 text-shadow-lg animate-fade-in-up gradient-text">
                {raceInfo?.meta_title || raceInfo?.title || 'META RUN 2025'}
              </h1>

              {raceInfo?.content && (
                <div className="animate-fade-in-up mb-4">
                  <div 
                    className={`text-base md:text-lg text-gray-300 max-w-4xl content-html ${!isDescriptionExpanded ? 'description-collapsed' : ''}`}
                    dangerouslySetInnerHTML={{ __html: raceInfo.content }}
                  />
                  <button
                    onClick={() => setIsDescriptionExpanded(!isDescriptionExpanded)}
                    className="mt-2 px-4 py-2 bg-orange-500/20 hover:bg-orange-500/30 rounded-lg text-orange-300 text-sm font-semibold transition-all"
                  >
                    {isDescriptionExpanded ? '▲ Thu gọn' : '▼ Hiển thị thêm'}
                  </button>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8 animate-fade-in-up">
                <div className="backdrop-blur-xl bg-white/10 rounded-xl p-4 border border-white/20 hover:bg-white/15 transition-all duration-300 transform hover:scale-105">
                  <div className="flex items-center gap-3">
                    <div className="text-3xl">📅</div>
                    <div>
                      <div className="text-xs text-gray-400 mb-1">Thời gian thi đấu</div>
                      <div className="font-bold text-white">
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

                <div className="backdrop-blur-xl bg-white/10 rounded-xl p-4 border border-white/20 hover:bg-white/15 transition-all duration-300 transform hover:scale-105">
                  <div className="flex items-center gap-3">
                    <div className="text-3xl">🎯</div>
                    <div>
                      <div className="text-xs text-gray-400 mb-1">Tổng quãng đường</div>
                      <div className="font-bold text-white">
                        {countTotalDistance.toFixed(2)} km
                      </div>
                    </div>
                  </div>
                </div>

                <div className="backdrop-blur-xl bg-white/10 rounded-xl p-4 border border-white/20 hover:bg-white/15 transition-all duration-300 transform hover:scale-105">
                  <div className="flex items-center gap-3">
                    <div className="text-3xl">👥</div>
                    <div>
                      <div className="text-xs text-gray-400 mb-1">Vận động viên</div>
                      <div className="font-bold text-white">
                        {personalData.length} người
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="absolute bottom-0 left-0 right-0">
            <svg className="w-full h-16 fill-current text-gray-900" viewBox="0 0 1200 120" preserveAspectRatio="none">
              <path d="M0,0 C150,100 350,0 600,50 C850,100 1050,0 1200,50 L1200,120 L0,120 Z"></path>
            </svg>
          </div>
        </div>

        <div className="container mx-auto px-4 py-8 max-w-6xl">
          <div className="flex flex-col lg:flex-row justify-between items-center mb-8 gap-6 backdrop-blur-md bg-white/10 rounded-2xl p-6 border border-white/20 shadow-xl">
            <div className="flex items-center gap-4">
              <div className="text-2xl">
                {isPersonal ? '👤' : isTeam ? '👥' : '📅'}
              </div>
              <h2 className="text-2xl font-bold text-white">
                {isPersonal ? 'Personal Rankings' : isTeam ? 'Team Rankings' : 'Daily Rankings'}
              </h2>
            </div>

            {isDaily && (
              <div className="flex items-center gap-4">
                <label className="text-sm font-medium text-white">Chọn ngày:</label>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={handleDateChange}
                  className="px-4 py-2 rounded-xl bg-white/10 border border-white/20 text-white backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                  max={new Date().toISOString().split('T')[0]}
                />
              </div>
            )}
          </div>

          <div className="flex justify-center mb-8">
            <div className="backdrop-blur-md bg-white/10 rounded-2xl p-2 border border-white/20 shadow-lg">
              <button onClick={() => setActiveTab('personal')} className={`py-3 px-8 font-bold rounded-xl transition-all duration-200 ${activeTab === 'personal' ? 'bg-white/20 text-white shadow-lg backdrop-blur-sm' : 'text-gray-300 hover:text-white hover:bg-white/10'}`}>
                👤 Personal
              </button>
              <button onClick={() => setActiveTab('team')} className={`py-3 px-8 font-bold rounded-xl transition-all duration-200 ${activeTab === 'team' ? 'bg-white/20 text-white shadow-lg backdrop-blur-sm' : 'text-gray-300 hover:text-white hover:bg-white/10'}`}>
                👥 Team
              </button>
              <button onClick={() => setActiveTab('daily')} className={`py-3 px-8 font-bold rounded-xl transition-all duration-200 ${activeTab === 'daily' ? 'bg-white/20 text-white shadow-lg backdrop-blur-sm' : 'text-gray-300 hover:text-white hover:bg-white/10'}`}>
                📅 Daily
              </button>
            </div>
          </div>

          {loading && (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-gray-400 border-t-orange-400"></div>
              <div className="mt-4 text-white font-medium">Loading race data...</div>
            </div>
          )}

          {!loading && isPersonal && (
            <div className="space-y-6 pt-20">
              <PersonalPodium />
              <div className="overflow-hidden rounded-2xl backdrop-blur-md bg-white/10 border border-white/20 shadow-2xl">
                <table className="w-full">
                  <thead className="backdrop-blur-sm bg-white/20">
                    <tr>
                      <th className="px-6 py-4 text-left text-sm font-bold text-white">🏅 Hạng</th>
                      <th className="px-6 py-4 text-left text-sm font-bold text-white">👤 Tên</th>
                      <th className="px-6 py-4 text-left text-sm font-bold text-white">🏃‍♂️ Quãng đường</th>
                      <th className="px-6 py-4 text-left text-sm font-bold text-white">📊 Trạng thái</th>
                      <th className="px-6 py-4 text-left text-sm font-bold text-white">Team</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10">
                    {personalData.map((member, index) => {
                      const rank = member.order;
                      const rankStyle = getRankStyling(rank);
                      const totalKm = parseFloat(member.final_value || '0');
                      const percentage = parseFloat(member.percent_finish || '0');

                      return (
                        <tr key={member.id || index} className={`hover:bg-white/5 transition-colors duration-200 ${rank <= 3 ? 'bg-white/5' : ''}`}>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className={`inline-flex items-center justify-center w-10 h-10 rounded-full ${rankStyle.bg} ${rankStyle.text} shadow-lg`}>
                              <span className="text-sm font-bold">{rankStyle.icon} {rank}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <Image width={40}  height={40} src={member.avatar || '/meta.png'} alt="Avatar" className="h-10 w-10 rounded-full object-cover mr-3 border-2 border-white/20 shadow-md" onError={handleImageError} />
                              <div>
                                <div className="text-sm font-semibold text-white">{member.full_name}</div>
                                <div className="text-xs text-gray-300">BIB: {member.bib_number || 'N/A'}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-semibold text-white">{totalKm.toFixed(2)} km</div>
                            <div className="text-xs text-gray-400">{percentage.toFixed(1)}%</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex items-center px-2 py-1 text-xs font-semibold rounded-full ${percentage >= 100 ? 'bg-green-500/30 text-green-200' : 'bg-orange-500/30 text-orange-200'}`}>
                              {percentage >= 100 ? '✅ Hoàn thành' : '🏃‍♂️ Đang thi'}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-300">{member.team_name || 'N/A'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {!loading && isTeam && (
            <div className="space-y-6 pt-20">
              <div className="flex justify-center mb-6">
                <div className="backdrop-blur-md bg-white/10 rounded-xl p-1 border border-white/20">
                  <button
                    onClick={() => setTeamSortBy('total')}
                    className={`px-6 py-2 rounded-lg font-semibold transition-all ${teamSortBy === 'total' ? 'bg-orange-500 text-white' : 'text-gray-300 hover:text-white'}`}
                  >
                    📊 Tổng KM
                  </button>
                  <button
                    onClick={() => setTeamSortBy('average')}
                    className={`px-6 py-2 rounded-lg font-semibold transition-all ${teamSortBy === 'average' ? 'bg-orange-500 text-white' : 'text-gray-300 hover:text-white'}`}
                  >
                    📈 KM Trung Bình
                  </button>
                </div>
              </div>

              <TeamPodium />
              <div className="overflow-hidden rounded-2xl backdrop-blur-md bg-white/10 border border-white/20 shadow-2xl">
                <table className="w-full">
                  <thead className="backdrop-blur-sm bg-white/20">
                    <tr>
                      <th className="px-6 py-4 text-left text-sm font-bold text-white">🏅 Hạng</th>
                      <th className="px-6 py-4 text-left text-sm font-bold text-white">👥 Tên đội</th>
                      <th className="px-6 py-4 text-left text-sm font-bold text-white">👤 Thành viên</th>
                      <th className="px-6 py-4 text-left text-sm font-bold text-white">📊 TỔNG KM</th>
                      <th className="px-6 py-4 text-left text-sm font-bold text-white">📈 KM TB</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10">
                    {getSortedTeams().map((team, index) => {
                      const rank = index + 1;
                      const rankStyle = getRankStyling(rank);

                      return (
                        <tr key={team.id || index} className={`hover:bg-white/5 transition-colors ${rank <= 3 ? 'bg-white/5' : ''}`}>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className={`inline-flex items-center justify-center w-10 h-10 rounded-full ${rankStyle.bg} ${rankStyle.text} shadow-lg`}>
                              <span className="text-sm font-bold">{rankStyle.icon} {rank}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <div className="h-10 w-10 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center mr-3 border-2 border-white/20 shadow-md">
                                <span className="text-xl">👥</span>
                              </div>
                              <div className="text-sm font-semibold text-white">{team.name}</div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-semibold text-white">{team.total}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-bold text-orange-400">{parseFloat(team.total_distance).toFixed(2)} km</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-semibold text-blue-400">{parseFloat(team.avg_distance).toFixed(2)} km</div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {!loading && isDaily && (
            <div className="space-y-6 pt-20">
              {!dailyLoading && dailyRankings.length >= 3 && <DailyPodium />}

              <div className="overflow-hidden rounded-2xl backdrop-blur-md bg-white/10 border border-white/20 shadow-2xl">
                {dailyLoading ? (
                  <div className="flex flex-col items-center justify-center py-20">
                    <div className="animate-spin rounded-full h-12 w-12 border-4 border-gray-400 border-t-orange-400"></div>
                    <div className="mt-4 text-white font-medium">Đang tải dữ liệu ngày {formatDate(selectedDate)}...</div>
                  </div>
                ) : (
                  <table className="w-full">
                    <thead className="backdrop-blur-sm bg-white/20">
                      <tr>
                        <th className="px-6 py-4 text-left text-sm font-bold text-white">🏅 Hạng</th>
                        <th className="px-6 py-4 text-left text-sm font-bold text-white">👤 Vận động viên</th>
                        <th className="px-6 py-4 text-left text-sm font-bold text-white">📅 Ngày</th>
                        <th className="px-6 py-4 text-left text-sm font-bold text-white">🏃‍♂️ KM chạy được</th>
                        <th className="px-6 py-4 text-left text-sm font-bold text-white">Team</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/10">
                      {dailyRankings.map((record, index) => {
                        const rank = index + 1;
                        const rankStyle = getRankStyling(rank);

                        return (
                          <tr key={`${record.memberId}-${index}`} className={`hover:bg-white/5 transition-colors ${rank <= 3 ? 'bg-white/5' : ''}`}>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className={`inline-flex items-center justify-center w-10 h-10 rounded-full ${rankStyle.bg} ${rankStyle.text} shadow-lg`}>
                                <span className="text-sm font-bold">{rankStyle.icon} {rank}</span>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center">
                                <Image width={40} height={40} src={record.avatar} alt={record.memberName} className="h-10 w-10 rounded-full object-cover mr-3 border-2 border-white/20 shadow-md" onError={handleImageError} />
                                <div>
                                  <div className="text-sm font-semibold text-white">{record.memberName}</div>
                                  <div className="text-xs text-gray-300">BIB: {record.memberId}</div>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm text-white">{formatDate(record.date)}</div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm font-bold text-orange-400">{record.km.toFixed(2)} km</div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-xs text-gray-300">{record.teamName}</div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}

                {!dailyLoading && dailyRankings.length === 0 && (
                  <div className="text-center py-16">
                    <div className="text-4xl mb-4">📅</div>
                    <div className="text-lg text-white font-semibold">Chưa có dữ liệu cho ngày này</div>
                    <div className="text-sm text-gray-300 mt-2">Vui lòng chọn ngày khác</div>
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