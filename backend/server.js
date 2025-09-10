import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';
import 'dotenv/config'; // .env dosyasını yükler

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// CoinMarketCap listings
app.get('/api/cryptocurrency/listings/latest', async (req, res) => {
  try {
    const API_KEY = process.env.COINMARKETCAP_API_KEY;

    if (!API_KEY) {
      return res.status(500).json({ error: 'CoinMarketCap API key not configured.' });
    }

    const params = new URLSearchParams(req.query);
    params.set('limit', '100');
    const cmcUrl = `https://pro-api.coinmarketcap.com/v1/cryptocurrency/listings/latest?${params.toString()}`;

    const response = await fetch(cmcUrl, {
      headers: { 'X-CMC_PRO_API_KEY': API_KEY },
    });

    if (!response.ok) {
      const errorData = await response.json();
      return res.status(response.status).json({
        error: `CoinMarketCap API Hatası: ${response.status} - ${errorData.status?.error_message || response.statusText}`,
      });
    }

    const data = await response.json();
    const fetchedCoins = data.data.map((coin) => ({
      id: coin.id,
      name: coin.name,
      symbol: coin.symbol,
      logo: `https://cryptologos.cc/logos/${coin.slug}/${coin.slug}-icon.svg` || 'https://cryptologos.cc/logos/placeholder-logo.png',
      currentPrice: coin.quote?.USD?.price || 0,
      volume24h: coin.quote?.USD?.volume_24h || 0,
      percentChange1h: coin.quote?.USD?.percent_change_1h || 0,
      percentChange24h: coin.quote?.USD?.percent_change_24h || 0,
      percentChange7d: coin.quote?.USD?.percent_change_7d || 0,
      marketCap: coin.quote?.USD?.market_cap || 0,
      cmcRank: coin.cmc_rank || 'N/A',
    }));

    res.json(fetchedCoins);
  } catch (error) {
    console.error('CoinMarketCap listings proxy error:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// CoinAPI OHLCV
app.get('/api/cryptocurrency/ohlcv/historical', async (req, res) => {
  try {
    const API_KEY = process.env.COINAPI_IO_API_KEY;

    if (!API_KEY) {
      return res.status(500).json({ error: 'CoinAPI.io API key not configured.' });
    }

    const { symbol, time_start, time_end } = req.query;

    if (!symbol) {
      return res.status(400).json({ error: 'Symbol parameter is required for OHLCV historical data.' });
    }

    const period_id = '1DAY';
    const coinApiUrl = `https://rest.coinapi.io/v1/ohlcv/${period_id}/history?symbol_id=${symbol}&time_start=${time_start}&time_end=${time_end}`;

    const response = await fetch(coinApiUrl, {
      headers: { 'X-CoinAPI-Key': API_KEY },
    });

    if (!response.ok) {
      const errorData = await response.json();
      return res.status(response.status).json({
        error: `CoinAPI Error: ${response.status} - ${errorData.error || response.statusText}`,
      });
    }

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('CoinAPI OHLCV Proxy error:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// Coinalyze OHLCV
app.get('/api/cryptocurrency/ohlcv/coinalyze-historical', async (req, res) => {
  try {
    const COINALYZE_API_KEY = process.env.COINALYZE_API_KEY;

    if (!COINALYZE_API_KEY) {
      return res.status(500).json({ error: 'Coinalyze API key not configured.' });
    }

    const { symbol, interval, from, to } = req.query;

    if (!symbol || !interval || !from || !to) {
      return res.status(400).json({ error: 'Symbol, interval, from, and to parameters are required.' });
    }

    const coinalyzeUrl = `https://api.coinalyze.net/v1/ohlcv-history?symbols=${symbol}&interval=${interval}&from=${from}&to=${to}`;

    const response = await fetch(coinalyzeUrl, {
      headers: { 'api_key': COINALYZE_API_KEY },
    });

    if (!response.ok) {
      const errorData = await response.json();
      return res.status(response.status).json({
        error: `Coinalyze API Error: ${response.status} - ${errorData.error || response.statusText}`,
      });
    }

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('Coinalyze OHLCV Proxy error:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// Twelve Data OHLCV
app.get('/api/cryptocurrency/ohlcv/twelvedata-historical', async (req, res) => {
  try {
    const TWELVEDATA_API_KEY = process.env.TWELVEDATA_API_KEY;

    if (!TWELVEDATA_API_KEY) {
      return res.status(500).json({ error: 'Twelve Data API key not configured.' });
    }

    const { symbol, interval, outputsize } = req.query;

    if (!symbol || !interval || !outputsize) {
      return res.status(400).json({ error: 'Symbol, interval, and outputsize parameters are required.' });
    }

    const twelveDataUrl = `https://api.twelvedata.com/time_series?symbol=${symbol}/USD&interval=${interval}&outputsize=${outputsize}&apikey=${TWELVEDATA_API_KEY}`;

    const response = await fetch(twelveDataUrl);
    if (!response.ok) {
      const errorData = await response.json();
      return res.status(response.status).json({
        error: `Twelve Data API Error: ${response.status} - ${errorData.message || response.statusText}`,
      });
    }

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('Twelve Data OHLCV Proxy error:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// Google AI
app.post('/api/ai/analyze-crypto', async (req, res) => {
  try {
    const GOOGLE_AI_API_KEY = process.env.GOOGLE_AI_API_KEY;

    if (!GOOGLE_AI_API_KEY) {
      return res.status(500).json({ error: 'Google AI API key not configured.' });
    }

    const { symbol, currentPrice, percentChange24h, marketCap, rsi, macd, sma50, sma200, volume, news } = req.body;

    const prompt = `Analyze the following cryptocurrency data for ${symbol}:
- Current Price: $${currentPrice}
- 24h Change: ${percentChange24h}%
- Market Cap: $${marketCap}
- RSI (14): ${rsi}
- MACD: ${macd}
- 50-Day MA: ${sma50}
- 200-Day MA: ${sma200}
- 24h Volume: ${volume}` +
      (news?.length > 0
        ? `\n\nLatest News:\n` + news.map((item, index) => `${index + 1}. ${item.title}`).join('\n')
        : '') +
      `\n\nProvide a concise market sentiment analysis and potential short-term outlook for ${symbol} in 2-3 sentences.`;


    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GOOGLE_AI_API_KEY}`;

    const response = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      return res.status(response.status).json({
        error: `Gemini API Hatası: ${response.status} - ${errorData.error || errorData.message || response.statusText}`,
      });
    }

    const data = await response.json();
    const aiComment = data.candidates?.[0]?.content?.parts?.[0]?.text || 'No analysis available.'; // Adjust path for Gemini 2.5 Flash
    res.json({ analysis: aiComment });
  } catch (error) {
    console.error('AI analysis proxy error:', error);
    res.status(500).json({ error: 'Internal server error during AI analysis.' });
  }
});

// Tavily news
app.get('/api/news/tavily', async (req, res) => {
  try {
    const TAVILY_API_KEY = process.env.TAVILY_API_KEY;

    if (!TAVILY_API_KEY) {
      return res.status(500).json({ error: 'Tavily API key not configured.' });
    }

    const { symbol } = req.query;
    if (!symbol) return res.status(400).json({ error: 'Symbol parameter is required.' });

    const tavilyUrl = 'https://api.tavily.com/search';
    const requestBody = { query: `${symbol} crypto news`, topic: 'news', max_results: 10 };

    const response = await fetch(tavilyUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${TAVILY_API_KEY}` },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorData = await response.json();
      return res.status(response.status).json({
        error: `Tavily API Hatası: ${response.status} - ${errorData.error || errorData.message || response.statusText}`,
      });
    }

    const data = await response.json();
    const news = data.results.map((item) => ({ title: item.title, url: item.url }));
    res.json({ news });
  } catch (error) {
    console.error('Tavily news proxy error:', error);
    res.status(500).json({ error: 'Internal server error during Tavily news search.' });
  }
});

app.listen(PORT, () => {
  console.log(`Proxy server running on port ${PORT}`);
});
