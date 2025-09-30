import { NextResponse } from 'next/server';
import axios from 'axios';
import { loadUsersFromFile, scrapeTotalKmForBannedUser, UserData } from '@/lib/weekly-km';

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

const bannedUsersCache = new Map<number, { km: number; timestamp: number }>();
const BANNED_CACHE_DURATION = 60 * 60 * 1000;

function getBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_BASE_URL) {
    return process.env.NEXT_PUBLIC_BASE_URL;
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  return 'http://localhost:3000';
}

export async function GET() {
  try {
    const headers = {
      'Accept-Encoding': 'gzip',
      'Connection': 'Keep-Alive',
      'Host': '84race.com',
      'User-Agent': 'okhttp/5.0.0-alpha.14',
      'x-ap': 'keaGnxGF8146Z17CDti_RcdZ4koRdKmGS6D3xBQe2MbkqJTpepjOLOiYVvv.2U6UJZVSD0.TwxhSyGjW3YcjozknVAl.99DgdCM_zrh7u0hkRQQzRrKTCkTmb5bWJ3uYuUa76iyLuhj2NB0KwzV3xHYQGA752wuiEPLuykN6so7eLDbI7RCvgk0yNX7beIQAmkeGsXJ4N4aCymeIGAXrRfF.EAxofbNUM0_TNbIy5Vq1uEGP5tbrdO8nAiLAN03UTjxycUxdlF6oesaBPIhAoPovgURH531PhzEMwTJmOAKdx2oTc2_e8XiyHUPsx.unLSBLb9ocVOMUp0l.Zf0vRQ17B717B7'
    };

    const [page1Response, page2Response] = await Promise.all([
      axios.get('https://84race.com/api/v1/races/detail/16790/ranking_team?page=1', { headers }),
      axios.get('https://84race.com/api/v1/races/detail/16790/ranking_team?page=2', { headers })
    ]);

    const allTeams: Team[] = [
      ...(page1Response.data?.data?.teams || []),
      ...(page2Response.data?.data?.teams || [])
    ];

    let countTotalDistance = page1Response.data?.data?.countTotalDistance || 0;

    const memberAdjustments = new Map<number, number>();
    
    try {
      const baseUrl = getBaseUrl();
      const adjustmentsResponse = await fetch(`${baseUrl}/api/km-adjustments`, { cache: 'no-store' });
      
      if (adjustmentsResponse.ok) {
        const allAdjustments: { bibNumber: number; adjustmentKm: number }[] = await adjustmentsResponse.json();
        console.log(`[Team] Loaded ${allAdjustments.length} adjustments`);
        
        allAdjustments.forEach(adj => {
          const current = memberAdjustments.get(adj.bibNumber) || 0;
          memberAdjustments.set(adj.bibNumber, current + adj.adjustmentKm);
        });
      }
    } catch (error) {
      console.error('Error fetching adjustments:', error);
    }

    try {
      const users: UserData[] = await loadUsersFromFile();
      const allUsers = users;
      const bannedUsers = users.filter(u => u.ban === true);

      const teamKmMap = new Map<string, number>();
      const teamMemberCount = new Map<string, number>();

      allTeams.forEach(team => {
        teamKmMap.set(team.name, parseFloat(team.total_distance));
        teamMemberCount.set(team.name, parseInt(team.total));
      });

      allUsers.forEach(user => {
        const memberId = parseInt(user.member_id);
        const adjustment = memberAdjustments.get(memberId);
        if (adjustment && user.team_name && user.team_name !== 'null') {
          const teamName = user.team_name;
          const currentKm = teamKmMap.get(teamName) || 0;
          teamKmMap.set(teamName, currentKm + adjustment);
          countTotalDistance += adjustment;
          console.log(`[Team] Applied adjustment to BIB ${memberId} (${user.name}): ${adjustment} km to team ${teamName}`);
        }
      });

      if (bannedUsers.length > 0) {
        for (const user of bannedUsers) {
          if (!user.team_name || user.team_name === 'null') continue;

          const memberId = parseInt(user.member_id);
          let totalKm = 0;

          const cached = bannedUsersCache.get(memberId);
          if (cached && Date.now() - cached.timestamp < BANNED_CACHE_DURATION) {
            totalKm = cached.km;
          } else {
            totalKm = await scrapeTotalKmForBannedUser(memberId);
            bannedUsersCache.set(memberId, { km: totalKm, timestamp: Date.now() });
          }

          const adjustment = memberAdjustments.get(memberId) || 0;
          totalKm += adjustment;

          const teamName = user.team_name;
          const currentKm = teamKmMap.get(teamName) || 0;
          const currentCount = teamMemberCount.get(teamName) || 0;
          
          teamKmMap.set(teamName, currentKm + totalKm);
          teamMemberCount.set(teamName, currentCount + 1);
          countTotalDistance += totalKm;

          const existingTeam = allTeams.find(t => t.name === teamName);
          if (!existingTeam) {
            allTeams.push({
              id: `banned_${teamName}`,
              team_id: `banned_${teamName}`,
              race_id: '16790',
              total_distance: totalKm.toString(),
              avg_distance: totalKm.toString(),
              order: '0',
              actual_value: totalKm.toString(),
              virtual_value: totalKm.toString(),
              final_value: totalKm.toString(),
              name: teamName,
              total: '1'
            });
          }
        }
      }

      allTeams.forEach(team => {
        const updatedKm = teamKmMap.get(team.name);
        const updatedCount = teamMemberCount.get(team.name);
        
        if (updatedKm !== undefined && updatedCount !== undefined) {
          team.total_distance = updatedKm.toString();
          team.avg_distance = (updatedKm / updatedCount).toString();
          team.total = updatedCount.toString();
          team.final_value = updatedKm.toString();
        }
      });

      allTeams.sort((a, b) => 
        parseFloat(b.total_distance) - parseFloat(a.total_distance)
      );
    } catch (error) {
      console.error('Error adding banned users to team rankings:', error);
    }

    return NextResponse.json({
      data: {
        teams: allTeams,
        countTotalDistance: countTotalDistance
      }
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}