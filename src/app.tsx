import React, { useState, useEffect } from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { RSI, MACD, SMA } from 'technicalindicators';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

interface NewsItem {
  title: string;
  url: string;
}

interface CoinData {
  id: string;
  name: string;
  symbol: string;
  logo: string;
  currentPrice: number;
  volume24h: number;
  percentChange1h: number;
  percentChange24h: number;
  percentChange7d: number;
  marketCap: number;
  cmcRank: number;
}

interface ChartData {
  labels: string[];
  datasets: {
    label: string;
    data: number[];
    borderColor: string;
    tension: number;
    fill: boolean;
  }[];
}

function App() {
  const [coins, setCoins] = useState<CoinData[]>([]);
  const [selected, setSelected] = useState<string>('BTC');
  const [chartData, setChartData] = useState<ChartData | null>(null);
  const [chartLoading, setChartLoading] = useState<boolean>(false);
  const [chartError, setChartError] = useState<string | null>(null);
  const [indicators, setIndicators] = useState<any>({});
  const [loadingInitialData, setLoadingInitialData] = useState<boolean>(true);
  const [initialDataError, setInitialDataError] = useState<string | null>(null);
  const [aiSummary, setAiSummary] = useState<string>('AI analysis loading...');
  const [news, setNews] = useState<NewsItem[]>([]);
  const [newsLoading, setNewsLoading] = useState<boolean>(false);
  const [newsError, setNewsError] = useState<string | null>(null);

  const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';

  useEffect(() => {
    const fetchCoins = async () => {
      try {
        const response = await fetch(`${BACKEND_URL}/api/cryptocurrency/listings/latest`);
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(`API Error: ${response.status} - ${errorData.error || response.statusText}`);
        }
        const json = await response.json();
        const fetchedCoins: CoinData[] = json.map((coin: any) => ({
          id: coin.id,
          name: coin.name,
          symbol: coin.symbol,
          logo: coin.logo || 'https://cryptologos.cc/logos/placeholder-logo.png',
          currentPrice: coin.currentPrice || 0,
          volume24h: coin.volume24h || 0,
          percentChange1h: coin.percentChange1h || 0,
          percentChange24h: coin.percentChange24h || 0,
          percentChange7d: coin.percentChange7d || 0,
          marketCap: coin.marketCap || 0,
          cmcRank: Number(coin.cmcRank) || 9999,
        }));
        fetchedCoins.sort((a, b) => a.cmcRank - b.cmcRank);
        setCoins(fetchedCoins);
        if (fetchedCoins.length > 0) setSelected(fetchedCoins[0].symbol);
      } catch (e: any) {
        console.error("API request failed:", e);
        setInitialDataError(e.message);
      } finally {
        setLoadingInitialData(false);
      }
    };
    fetchCoins();
  }, []);

  useEffect(() => {
    const fetchChartAndIndicatorsData = async () => {
      if (!selected) return;
      const currentCoin = coins.find((c) => c.symbol === selected);
      if (!currentCoin) return;

      setChartLoading(true);
      setChartError(null);
      setNewsLoading(true);
      setNewsError(null);

      try {
        const interval = '1day';
        const outputsize = 200;
        const ohlcvResponse = await fetch(`${BACKEND_URL}/api/cryptocurrency/ohlcv/twelvedata-historical?symbol=${selected}&interval=${interval}&outputsize=${outputsize}`);
        if (!ohlcvResponse.ok) {
          const errorData = await ohlcvResponse.json();
          throw new Error(`Twelve Data OHLCV API Error: ${ohlcvResponse.status} - ${errorData.error || ohlcvResponse.statusText}`);
        }
        const ohlcvJson = await ohlcvResponse.json();
        if (!ohlcvJson?.values || ohlcvJson.values.length === 0) {
          throw new Error('No OHLCV data found for this coin from Twelve Data.');
        }

        const history = ohlcvJson.values.sort((a: any, b: any) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime());
        const labels = history.map((d: any) => new Date(d.datetime).toLocaleDateString());
        const prices = history.map((d: any) => parseFloat(d.close));

        setChartData({
          labels,
          datasets: [{
            label: `${selected} Price (USD)`,
            data: prices,
            borderColor: 'rgb(75, 192, 192)',
            tension: 0.1,
            fill: false,
          }],
        });

        // Technical indicators
        const closePrices = prices;
        const currentRsi = RSI.calculate({ values: closePrices, period: 14 }).slice(-1)[0] ?? 'N/A';
        const currentMacdObj = MACD.calculate({ values: closePrices, fastPeriod: 12, slowPeriod: 26, signalPeriod: 9, SimpleMAOscillator: true, SimpleMASignal: true }).slice(-1)[0] ?? { MACD: 'N/A', signal: 'N/A', histogram: 'N/A' };
        const currentSma50 = SMA.calculate({ values: closePrices, period: 50 }).slice(-1)[0] ?? 'N/A';
        const currentSma200 = SMA.calculate({ values: closePrices, period: 200 }).slice(-1)[0] ?? 'N/A';

        const updatedIndicators = {
          rsi: typeof currentRsi === 'number' ? parseFloat(currentRsi.toFixed(2)) : 'N/A',
          macd: typeof currentMacdObj.MACD === 'number' ? parseFloat(currentMacdObj.MACD.toFixed(4)) : 'N/A',
          macdSignal: typeof currentMacdObj.signal === 'number' ? parseFloat(currentMacdObj.signal.toFixed(4)) : 'N/A',
          macdHistogram: typeof currentMacdObj.histogram === 'number' ? parseFloat(currentMacdObj.histogram.toFixed(4)) : 'N/A',
          sma50: typeof currentSma50 === 'number' ? parseFloat(currentSma50.toFixed(4)) : 'N/A',
          sma200: typeof currentSma200 === 'number' ? parseFloat(currentSma200.toFixed(4)) : 'N/A',
          volume: currentCoin.volume24h || 0,
        };

        setIndicators(updatedIndicators);

        // AI analysis
        const aiRes = await fetch(`${BACKEND_URL}/api/ai/analyze-crypto`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            symbol: selected,
            currentPrice: currentCoin.currentPrice,
            percentChange24h: currentCoin.percentChange24h,
            marketCap: currentCoin.marketCap,
            rsi: updatedIndicators.rsi,
            macd: updatedIndicators.macd,
            sma50: updatedIndicators.sma50,
            sma200: updatedIndicators.sma200,
            volume: currentCoin.volume24h,
            news: news,
          }),
        });
        if (!aiRes.ok) {
          const errorData = await aiRes.json();
          throw new Error(`AI Analysis API Error: ${aiRes.status} - ${errorData.error || aiRes.statusText}`);
        }
        const aiJson = await aiRes.json();
        setAiSummary(aiJson.analysis);

        // News
        const newsRes = await fetch(`${BACKEND_URL}/api/news/tavily?symbol=${selected}`);
        if (!newsRes.ok) {
          const errorData = await newsRes.json();
          throw new Error(`News API Error: ${newsRes.status} - ${errorData.error || newsRes.statusText}`);
        }
        const newsJson = await newsRes.json();
        setNews(newsJson.news);

      } catch (e: any) {
        console.error("Data fetch error:", e);
        setChartError(e.message);
        setIndicators({});
        setAiSummary(`AI analysis error: ${e.message}`);
        setNewsError(`News error: ${e.message}`);
        setNews([]);
      } finally {
        setChartLoading(false);
        setNewsLoading(false);
      }
    };
    fetchChartAndIndicatorsData();
  }, [selected, coins]);

  const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => setSelected(e.target.value);

  const LoadingDot = () => <span className="inline-block w-2 h-2 bg-gray-700 rounded-full animate-pulse mr-1"></span>;

  if (loadingInitialData) return <div>Loading initial data... <LoadingDot /><LoadingDot /><LoadingDot /></div>;
  if (initialDataError) return <div>Error loading coins: {initialDataError}</div>;

  return (
    <div className="p-4">
      <select value={selected} onChange={handleSelectChange}>
        {coins.map((c) => <option key={c.id} value={c.symbol}>{c.name} ({c.symbol})</option>)}
      </select>

      {chartLoading && <div>Loading chart... <LoadingDot /><LoadingDot /><LoadingDot /></div>}
      {chartError && <div>Chart error: {chartError}</div>}
      {chartData && <Line data={chartData} />}

      <div className="mt-4">
        <h2>Technical Indicators</h2>
        <ul>
          <li>RSI: {indicators.rsi ?? 'N/A'}</li>
          <li>MACD: {indicators.macd ?? 'N/A'}</li>
          <li>MACD Signal: {indicators.macdSignal ?? 'N/A'}</li>
          <li>MACD Histogram: {indicators.macdHistogram ?? 'N/A'}</li>
          <li>SMA50: {indicators.sma50 ?? 'N/A'}</li>
          <li>SMA200: {indicators.sma200 ?? 'N/A'}</li>
          <li>Volume 24h: {indicators.volume ?? 'N/A'}</li>
        </ul>
      </div>

      <div className="mt-4">
        <h2>AI Analysis</h2>
        <p>{aiSummary}</p>
      </div>

      <div className="mt-4">
        <h2>News</h2>
        {newsLoading && <div>Loading news... <LoadingDot /><LoadingDot /><LoadingDot /></div>}
        {newsError && <div>{newsError}</div>}
        <ul>
          {news.map((n, idx) => <li key={idx}><a href={n.url} target="_blank" rel="noopener noreferrer">{n.title}</a></li>)}
        </ul>
      </div>
    </div>
  );
}

export default App;
