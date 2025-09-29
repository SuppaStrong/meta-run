import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

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
  [key: string]: unknown;
}

interface RaceData {
  data?: {
    members?: Member[];
    [key: string]: unknown;
  };
  [key: string]: unknown;
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
    const response = await axios.get(
      `https://84race.com/api/v1/races/detail/16790/ranking_personal/${page}`, 
      { headers }
    );
    
    const data = response.data as RaceData;
    
    // Fetch all adjustments and calculate total per member
    try {
      const adjustmentsResponse = await fetch(
        `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/km-adjustments`,
        { cache: 'no-store' }
      );
      
      if (adjustmentsResponse.ok) {
        const allAdjustments: KmAdjustment[] = await adjustmentsResponse.json();
        
        // Group adjustments by bibNumber and calculate total
        const memberAdjustments = new Map<number, number>();
        allAdjustments.forEach(adj => {
          const current = memberAdjustments.get(adj.bibNumber) || 0;
          memberAdjustments.set(adj.bibNumber, current + adj.adjustmentKm);
        });
        
        // Apply adjustments to members
        if (data?.data?.members) {
          data.data.members = data.data.members.map((member: Member) => {
            const bibNumber = member.bib_number || member.id;
            const adjustment = memberAdjustments.get(bibNumber);
            
            if (adjustment) {
              const originalKm = parseFloat(member.final_value || '0');
              const adjustedKm = Math.max(0, originalKm + adjustment);
              
              return {
                ...member,
                original_km: originalKm,
                adjustment_km: adjustment,
                final_value: adjustedKm.toString()
              };
            }
            
            return member;
          });
          
          // Re-sort by final_value descending
          data.data.members.sort((a: Member, b: Member) => 
            parseFloat(b.final_value) - parseFloat(a.final_value)
          );
          
          // Update order after sorting
          data.data.members.forEach((member: Member, index: number) => {
            member.order = index + 1;
          });
        }
      }
    } catch (error) {
      console.error('Error applying adjustments to personal rankings:', error);
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