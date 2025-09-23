import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

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
      'https://84race.com/api/v1/races/detail/16790/ranking_personal/${page}', { headers }
    );
    return NextResponse.json(response.data);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}