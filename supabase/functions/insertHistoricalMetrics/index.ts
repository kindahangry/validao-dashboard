import { serve } from 'https://deno.land/std/http/server.ts';

serve(async () => {
  try {
    console.time('Total execution time');
    const timestamp = new Date().toISOString();
    const chains = ['celestia', 'hyperliquid', 'dymension', 'initia', 'sthype', 'somnia'];
    const metricFields = ['total_stake', 'delegator_count'];

    // Cache for prices to avoid redundant fetches
    const priceCache: Record<string, number> = {};

    const coingeckoIds: Record<string, string> = {
      celestia: 'celestia',
      dymension: 'dymension',
      hyperliquid: 'hyperliquid',
      initia: 'initia',
      sthype: 'hyperliquid', // Use HYPE price for stHYPE
      somnia: 'somnia'
    };

    const denomFactors: Record<string, number> = {
      celestia: 1e6,
      hyperliquid: 1e8,
      dymension: 1e18,
      initia: 1e6,
      sthype: 1e18,
      somnia: 1e18 // wei denomination factor
    };

    const historicalMetrics: any[] = [];

    const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    const fetchWithTimeout = async (url: string, options: RequestInit = {}, timeout = 30000) => {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), timeout);
      
      try {
        const response = await fetch(url, {
          ...options,
          signal: controller.signal,
          headers: {
            ...options.headers,
            'User-Agent': 'ValiDash/1.0 (https://validao.xyz)'
          }
        });
        clearTimeout(id);
        if (!response.ok) {
           const errorBody = await response.text();
           console.error(`Fetch failed for ${url}: ${response.status} - ${errorBody}`);
           throw new Error(`Fetch failed for ${url}: ${response.status} - ${errorBody}`);
        }
        return response;
      } catch (error: any) {
        clearTimeout(id);
        console.error(`Fetch error for ${url}:`, error);
        throw new Error(`Fetch error for ${url}: ${error.message}`);
      }
    };

    const fetchWithRetry = async (url: string, options: RequestInit = {}, timeout = 30000, maxRetries = 3) => {
      let lastError: Error | null = null;
      
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          console.log(`Attempt ${attempt}/${maxRetries} for ${url}`);
          
          // For the overview endpoint, do a GET request first instead of HEAD
          if (url.includes('/overview/overview')) {
            console.log('Checking overview endpoint...');
            try {
              // Use GET instead of HEAD since the API might not support HEAD
              await fetchWithTimeout(url, { ...options, method: 'GET' }, 15000);
              console.log('Overview endpoint is responsive');
            } catch (err) {
              console.warn('Overview endpoint check failed:', err);
              // Continue anyway, as the endpoint might still work
            }
          }

          const response = await fetchWithTimeout(url, options, timeout);
          console.log(`Success on attempt ${attempt} for ${url}`);
          return { response };
        } catch (err) {
          lastError = err as Error;
          console.warn(`Attempt ${attempt} failed for ${url}: ${err.message}`);
          
          if (attempt === maxRetries) break;
          
          // Exponential backoff: 2000ms, 4000ms, 8000ms, etc.
          const backoffMs = Math.min(2000 * Math.pow(2, attempt - 1), 20000);
          console.log(`Waiting ${backoffMs}ms before retry...`);
          await sleep(backoffMs);
        }
      }
      throw lastError || new Error(`All ${maxRetries} attempts failed for ${url}`);
    };

    const fetchPrice = async (id: string): Promise<number | null> => {
      try {
        // Check cache first
        if (priceCache[id] !== undefined) {
          console.log(`Using cached price for ${id}:`, priceCache[id]);
          return priceCache[id];
        }

        const apiKey = Deno.env.get('COINGECKO_API_KEY');
        if (!apiKey) {
          console.error('❌ COINGECKO_API_KEY is not set');
          return null;
        }

        // Use a unique timer name for each price fetch
        const timerName = `Price fetch for ${id} at ${Date.now()}`;
        console.time(timerName);
        
        const url = `https://pro-api.coingecko.com/api/v3/simple/price?ids=${id}&vs_currencies=usd`;
        console.log(`Fetching price for ${id} from CoinGecko...`);
        const { response: res } = await fetchWithRetry(url, {
          headers: { 
            'x-cg-pro-api-key': apiKey,
            'User-Agent': 'ValiDash/1.0 (https://validao.xyz)'
          }
        }, 20000);

        const json = await res.json();
        const price = json[id]?.usd ?? null;
        console.log(`CoinGecko price fetched for ${id}:`, price);
        console.timeEnd(timerName);

        // Cache the price
        if (price !== null) {
          priceCache[id] = price;
        }

        return price;
      } catch (err) {
        console.error(`❌ fetchPrice error for ${id}:`, err);
        return null;
      }
    };

    // Fetch overview data first with longer timeout
    console.time('Overview fetch');
    console.log('Fetching overview data...');
    const { response: overviewRes } = await fetchWithRetry(
      'https://api.validao.xyz/api/v1/overview/overview',
      {},
      45000, // 45 second timeout for overview
      3 // 3 retries for overview
    );
    const overview = await overviewRes.json();
    console.log('Overview data fetched successfully:', overview);
    console.timeEnd('Overview fetch');

    // Fetch all chain data in parallel with shorter timeouts
    console.time('Chain data fetch');
    console.log('Fetching chain data...');
    const chainDataPromises = chains.map(async (chain) => {
      try {
        console.time(`Chain fetch for ${chain}`);
        console.log(`Processing chain: ${chain}`);
        const url = `https://api.validao.xyz/api/v1/overview/chain/${chain}`;
        const { response: res } = await fetchWithRetry(url, {}, 30000, 2);
        const data = await res.json();
        console.log(`Data fetched for ${chain}:`, data);

        const coinId = coingeckoIds[chain];
        const priceUsd = coinId ? await fetchPrice(coinId) : null;
        console.log(`Price fetched for ${chain}:`, priceUsd);
        console.timeEnd(`Chain fetch for ${chain}`);

        return { chain, data, priceUsd };
      } catch (error) {
        console.error(`Error processing chain ${chain}:`, error);
        return null;
      }
    });

    const chainResults = await Promise.all(chainDataPromises);
    console.log('Chain data fetched successfully');
    console.timeEnd('Chain data fetch');

    for (const result of chainResults) {
      if (!result) continue;
      const { chain, data, priceUsd } = result;

      if (chain === 'initia') {
        // Handle Initia's dual staking system
        const initStake = data.stake_by_denom?.uinit || 0;
        const lpStake = data.stake_by_denom?.['move/543b35a39cfadad3da3c23249c474455d15efd2f94f849473226dee8a3c7a9e1'] || 0;
        const initApr = data.apr_by_denom?.uinit || 0;
        const lpApr = data.apr_by_denom?.['move/543b35a39cfadad3da3c23249c474455d15efd2f94f849473226dee8a3c7a9e1'] || 0;

         // Add total stake entry using the API's total_stake_usd value (THIS IS THE CORRECT ONE)
        historicalMetrics.push({
          chain: 'Initia',
          metric_type: 'total_stake',
          value: data.total_stake / denomFactors.initia,
          timestamp,
          source: 'cron',
          token_usd: data.price_usd,
          value_usd: data.total_stake_usd,
          apr: data.apr 
        });

        // Add INIT stake entry
        historicalMetrics.push({
          chain: 'Initia',
          metric_type: 'total_stake_init',
          value: initStake / denomFactors.initia,
          timestamp,
          source: 'cron',
          token_usd: data.price_usd,
          value_usd: (initStake / denomFactors.initia) * (data.price_usd || 0), // Keep 0.8 weight for LP value
          apr: initApr
        });

        // Add LP stake entry
        historicalMetrics.push({
          chain: 'Initia',
          metric_type: 'total_stake_lp',
          value: lpStake / denomFactors.initia,
          timestamp,
          source: 'cron',
          token_usd: data.price_usd,
          value_usd: (lpStake * 0.8 / denomFactors.initia) * (data.price_usd || 0), // Keep 0.8 weight for LP value
          apr: lpApr
        });

        // Add delegator count
        if (data.delegator_count !== undefined) {
          historicalMetrics.push({
            chain: 'Initia',
            metric_type: 'delegator_count',
            value: data.delegator_count,
            timestamp,
            source: 'cron',
            token_usd: null,
            value_usd: null,
            apr: null
          });
        }
      } else {
        // Handle other chains
        for (const field of metricFields) {
          if (data[field] !== undefined) {
            let normalizedValue = data[field];
            if (field === 'total_stake') {
              const factor = denomFactors[chain] || 1;
              normalizedValue = data[field] / factor;
            }

            const entry: Record<string, any> = {
              chain: chain.charAt(0).toUpperCase() + chain.slice(1),
              metric_type: field,
              value: normalizedValue,
              timestamp,
              source: 'cron',
              token_usd: null,
              value_usd: null,
              apr: data.apr || null
            };

            if (field === 'total_stake' && priceUsd !== null) {
              entry.token_usd = priceUsd;
              entry.value_usd = normalizedValue * priceUsd;
            }

            historicalMetrics.push(entry);
          }
        }
      }
    }

    // --- Data Validation --- //
    const filteredMetrics = historicalMetrics.filter(metric => {
        // Basic validation: skip if essential fields are missing or zero for stake/revenue metrics
        if (metric.metric_type.includes('stake') || metric.metric_type === 'total_revenue') {
            // Log the metric values for debugging
            console.log(`Validating metric:`, {
                chain: metric.chain,
                type: metric.metric_type,
                value: metric.value,
                value_usd: metric.value_usd,
                apr: metric.apr
            });

            // Only skip if ALL critical values are missing/zero
            const hasValidValue = metric.value !== null && metric.value !== 0;
            const hasValidValueUsd = metric.value_usd !== null && metric.value_usd !== 0;
            const hasValidApr = metric.apr !== null;

            // For stake metrics, we need at least one of value or value_usd
            if (metric.metric_type.includes('stake')) {
                if (!hasValidValue && !hasValidValueUsd) {
                    console.warn(`Skipping stake metric with no valid values:`, metric);
                    return false;
                }
            }

            // For revenue metrics, we need value_usd
            if (metric.metric_type === 'total_revenue' && !hasValidValueUsd) {
                console.warn(`Skipping revenue metric with no valid USD value:`, metric);
                return false;
            }

            // Additional check for unusually large stake values
            if (metric.metric_type.includes('stake') && metric.value > 1e15) {
                console.warn(`Skipping unusually large stake value:`, metric);
                return false;
            }
        }
        // Keep other metrics (like delegator count) as is
        return true;
    });
     console.log(`Filtered out ${historicalMetrics.length - filteredMetrics.length} potentially invalid metrics.`);
     console.log(`Collected ${filteredMetrics.length} metrics for insertion.`);

    if (filteredMetrics.length === 0) {
      console.warn('⚠️ No valid historical metrics collected — skipping insert.');
      return new Response('⚠️ No valid historical metrics collected — skipping insert.', { status: 200 });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
      console.error('❌ Missing required Supabase environment variables for database insert.');
      return new Response('❌ Missing required Supabase environment variables', { status: 500 });
    }

    const overviewSnapshot = { // Assuming overview data is always valid if fetched successfully
      timestamp,
      total_stake_usd: overview.total_stake_usd,
      active_chains: overview.active_chains,
      total_chains: overview.total_chains,
      total_delegators: overview.total_delegators,
      incentivized_chains: overview.incentivized_chains,
      incentivized_stake: overview.incentivized_stake,
      source: 'cron'
    };

    console.log('Inserting data into database...');
    // Insert all data in parallel
    const [histInsert, overviewInsert] = await Promise.all([
      fetch(`${supabaseUrl}/rest/v1/historical_metrics`, {
        method: 'POST',
        headers: {
          apikey: supabaseAnonKey,
          Authorization: `Bearer ${supabaseServiceRoleKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify(filteredMetrics)
      }).then(async res => {
          if (!res.ok) {
              const errText = await res.text();
              console.error(`Historical metrics insert failed: ${res.status} - ${errText}`);
              throw new Error(`Historical metrics insert failed: ${res.status} - ${errText}`);
          }
          console.log('Historical metrics inserted successfully.');
          return res;
      }),
      fetch(`${supabaseUrl}/rest/v1/validao-overview`, {
        method: 'POST',
        headers: {
          apikey: supabaseAnonKey,
          Authorization: `Bearer ${supabaseServiceRoleKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify([overviewSnapshot])
      }).then(async res => {
          if (!res.ok) {
              const errText = await res.text();
              console.error(`Overview insert failed: ${res.status} - ${errText}`);
              throw new Error(`Overview insert failed: ${res.status} - ${errText}`);
          }
           console.log('Overview inserted successfully.');
           return res;
      })
    ]);

    console.log('✅ All data insertion processes completed.');
    console.timeEnd('Total execution time');
    return new Response('✅ All data inserted successfully', { status: 200 });

  } catch (err: any) {
    console.error('❌ Function error in main try-catch block:', err);
    return new Response(`❌ Function Error: ${err.message}`, {
      status: 500,
      headers: { 'Content-Type': 'text/plain' }
    });
  }
});