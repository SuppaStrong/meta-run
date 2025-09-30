import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import { loadUsersFromFile, scrapeTotalKmForBannedUser, UserData } from '@/lib/weekly-km';

interface KmAdjustment {
  bibNumber: number;
  adjustmentKm: number;
  date: string;
  reason?: string;
}

interface Member {
  id: number;
  bib_number?: number;
  final_value: string;
  original_km?: number;
  adjustment_km?: number;
  order: number;
  full_name?: string;
  team_name?: string;
  avatar?: string;
  [key: string]: unknown;
}

interface RaceData {
  data?: {
    members?: Member[];
    [key: string]: unknown;
  };
  [key: string]: unknown;
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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ page: string }> }
) {
  const { page } = await params;

  const headers = {
    'Accept-Encoding': 'gzip',
    'Connection': 'Keep-Alive',
    'Host': '84race.com',
    'User-Agent': 'okhttp/5.0.0-alpha.14',
    'x-ap': 'keaGnxGF8146Z17CDti_RcdZ4koRdKmGS6D3xBQe2MbkqJTpepjOLOiYVvv.2U6UJZVSD0.TwxhSyGjW3YcjozknVAl.99DgdCM_zrh7u0hkRQQzRrKTCkTmb5bWJ3uYuUa76iyLuhj2NB0KwzV3xHYQGA752wuiEPLuykN6so7eLDbI7RCvgk0yNX7beIQAmkeGsXJ4N4aCymeIGAXrRfF.EAxofbNUM0_TNbIy5Vq1uEGP5tbrdO8nAiLAN03UTjxycUxdlF6oesaBPIhAoPovgURH531PhzEMwTJmOAKdx2oTc2_e8XiyHUPsx.unLSBLb9ocVOMUp0l.Zf0vRQ17B717B7'
  };
  
  try {
    console.log(`[Personal Rankings] Fetching page ${page}`);
    
    const response = await axios.get(
      `https://84race.com/api/v1/races/detail/16790/ranking_personal/${page}`, 
      { headers }
    );
    
    const data = response.data as RaceData;
    
    const memberAdjustments = new Map<number, number>();
    
    try {
      const baseUrl = getBaseUrl();
      const adjustmentsResponse = await fetch(`${baseUrl}/api/km-adjustments`, { cache: 'no-store' });
      
      if (adjustmentsResponse.ok) {
        const allAdjustments: KmAdjustment[] = await adjustmentsResponse.json();
        console.log(`[Personal] Loaded ${allAdjustments.length} adjustments:`, allAdjustments);
        
        allAdjustments.forEach(adj => {
          const current = memberAdjustments.get(adj.bibNumber) || 0;
          memberAdjustments.set(adj.bibNumber, current + adj.adjustmentKm);
          console.log(`[Personal] Map adjustment: BIB ${adj.bibNumber} => ${current + adj.adjustmentKm} km`);
        });
      }
    } catch (error) {
      console.error('Error fetching adjustments:', error);
    }

    try {
      const users: UserData[] = await loadUsersFromFile();
      const bannedUsers = users.filter(u => u.ban === true);

      if (bannedUsers.length > 0 && data?.data?.members) {
        const bannedMembers: Member[] = [];

        for (const user of bannedUsers) {
          const memberId = parseInt(user.member_id);
          let totalKm = 0;

          const cached = bannedUsersCache.get(memberId);
          if (cached && Date.now() - cached.timestamp < BANNED_CACHE_DURATION) {
            totalKm = cached.km;
          } else {
            totalKm = await scrapeTotalKmForBannedUser(memberId);
            bannedUsersCache.set(memberId, { km: totalKm, timestamp: Date.now() });
          }

          bannedMembers.push({
            id: memberId,
            bib_number: memberId,
            full_name: user.name,
            team_name: user.team_name === 'null' ? undefined : user.team_name,
            avatar: '/meta.png',
            final_value: totalKm.toString(),
            percent_finish: '0',
            order: 0,
            hangmuc_name: '',
            note: '',
            update_time: new Date().toISOString()
          });
        }

        console.log(`[Personal] Adding ${bannedMembers.length} banned users`);
        data.data.members = [...data.data.members, ...bannedMembers];
      }
    } catch (error) {
      console.error('Error adding banned users to personal rankings:', error);
    }

    if (data?.data?.members) {
      console.log(`[Personal] Applying adjustments to ${data.data.members.length} members`);
      
      data.data.members = data.data.members.map((member: Member) => {
        const bibNumber = parseInt(String(member.bib_number || member.id));
        const adjustment = memberAdjustments.get(bibNumber);
        
        if (adjustment) {
          const originalKm = parseFloat(member.final_value || '0');
          const adjustedKm = Math.max(0, originalKm + adjustment);
          
          console.log(`[Personal] Applied adjustment to BIB ${bibNumber}: ${originalKm} + (${adjustment}) = ${adjustedKm}`);
          
          return {
            ...member,
            original_km: originalKm,
            adjustment_km: adjustment,
            final_value: adjustedKm.toString()
          };
        }
        
        return member;
      });
      
      console.log(`[Personal] Sorting and re-ranking...`);
      data.data.members.sort((a: Member, b: Member) => 
        parseFloat(b.final_value) - parseFloat(a.final_value)
      );
      
      data.data.members.forEach((member: Member, index: number) => {
        member.order = index + 1;
      });
      
      console.log(`[Personal] Final member count: ${data.data.members.length}`);
    }
    
    return NextResponse.json(data);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}