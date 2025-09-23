// app/api/race/team/route.ts
import { NextResponse } from 'next/server';
import axios from 'axios';

export async function GET() {
  try {
    // Headers để tránh bị block
    const headers = {
      'Accept-Encoding': 'gzip',
      'Connection': 'Keep-Alive',
      'Host': '84race.com',
      'User-Agent': 'okhttp/5.0.0-alpha.14',
      'x-ap': 'keaGnxGF8146Z17CDti_RcdZ4koRdKmGS6D3xBQe2MbkqJTpepjOLOiYVvv.2U6UJZVSD0.TwxhSyGjW3YcjozknVAl.99DgdCM_zrh7u0hkRQQzRrKTCkTmb5bWJ3uYuUa76iyLuhj2NB0KwzV3xHYQGA752wuiEPLuykN6so7eLDbI7RCvgk0yNX7beIQAmkeGsXJ4N4aCymeIGAXrRfF.EAxofbNUM0_TNbIy5Vq1uEGP5tbrdO8nAiLAN03UTjxycUxdlF6oesaBPIhAoPovgURH531PhzEMwTJmOAKdx2oTc2_e8XiyHUPsx.unLSBLb9ocVOMUp0l.Zf0vRQ17B717B7'
    };

    // Fetch cả 2 pages
    const [page1Response, page2Response] = await Promise.all([
      axios.get('https://84race.com/api/v1/races/detail/16790/ranking_team?page=1', { headers }),
      axios.get('https://84race.com/api/v1/races/detail/16790/ranking_team?page=2', { headers })
    ]);

    // Merge data từ 2 pages
    const allTeams = [
      ...(page1Response.data?.data?.teams || []),
      ...(page2Response.data?.data?.teams || [])
    ];

    // Get countTotalDistance từ page 1
    const countTotalDistance = page1Response.data?.data?.countTotalDistance || 0;

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