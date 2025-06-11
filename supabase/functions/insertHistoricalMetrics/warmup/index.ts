import { serve } from 'https://deno.land/std/http/server.ts';

serve(async () => {
  try {
    const projectRef = Deno.env.get('SUPABASE_PROJECT_REF');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    
    if (!projectRef || !anonKey) {
      throw new Error('Missing required environment variables');
    }

    const response = await fetch(
      `https://${projectRef}.supabase.co/functions/v1/insertHistoricalMetrics`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${anonKey}`
        }
      }
    );

    if (!response.ok) {
      throw new Error(`Warmup failed: ${response.status}`);
    }

    return new Response('Warmup successful', { status: 200 });
  } catch (error) {
    console.error('Warmup error:', error);
    return new Response(`Warmup failed: ${error.message}`, { status: 500 });
  }
});