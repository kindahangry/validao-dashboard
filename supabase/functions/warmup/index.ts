import { serve } from 'https://deno.land/std/http/server.ts';

serve(async () => {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
    
    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('Missing required Supabase environment variables');
    }

    // Extract project ref from SUPABASE_URL
    const projectRef = supabaseUrl.replace('https://', '').split('.')[0];
    
    console.log('Starting warmup request...');
    const response = await fetch(
      `https://${projectRef}.supabase.co/functions/v1/insertHistoricalMetrics`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseAnonKey}`
        }
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Warmup failed: ${response.status} - ${errorText}`);
    }

    console.log('Warmup successful');
    return new Response('Warmup successful', { status: 200 });
  } catch (error) {
    console.error('Warmup error:', error);
    return new Response(`Warmup failed: ${error.message}`, { status: 500 });
  }
}); 