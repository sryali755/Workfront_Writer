import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get('content-type') || '';

    let data: unknown;

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      data = {
        type: 'form-data',
        fields: Object.fromEntries(formData),
      };
    } else if (contentType.includes('application/json')) {
      data = await req.json();
    } else {
      const text = await req.text();
      data = { type: 'raw-text', content: text.substring(0, 500) };
    }

    console.log('DEBUG WEBHOOK:', JSON.stringify(data, null, 2));

    return NextResponse.json({
      received: true,
      contentType,
      data,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('DEBUG WEBHOOK ERROR:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
