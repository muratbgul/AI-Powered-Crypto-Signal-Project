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

interface IndicatorItem {
  name: string;
  value: string | number;
  comment: string;
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
  const [aiSummary, setAiSummary] = useState<string>('AI analysis loading...'); // New state for AI summary
  const [news, setNews] = useState<NewsItem[]>([]); // New state for news
  const [newsLoading, setNewsLoading] = useState<boolean>(false); // New state for news loading
  const [newsError, setNewsError] = useState<string | null>(null); // New state for news error

  useEffect(() => {
    const fetchCoins = async () => {
      try {
        const response = await fetch('https://backend-ai-powered-crypto-signal-project.onrender.com/api/cryptocurrency/listings/latest');
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(`API Error: ${response.status} - ${errorData.error || response.statusText}`);
        }
        const json = await response.json();
        const fetchedCoins: CoinData[] = json.map((coin: any) => ({
          id: coin.id,
          name: coin.name,
          symbol: coin.symbol,
          logo: coin.logo || 'https://cryptologos.cc/logos/placeholder-logo.png', // Backend now sends logo, use it or placeholder
          currentPrice: coin.currentPrice || 0,
          volume24h: coin.volume24h || 0,
          percentChange1h: coin.percentChange1h || 0,
          percentChange24h: coin.percentChange24h || 0,
          percentChange7d: coin.percentChange7d || 0,
          marketCap: coin.marketCap || 0,
          cmcRank: coin.cmcRank || 'N/A'
        }));
        fetchedCoins.sort((a, b) => a.cmcRank - b.cmcRank); // Sort by CMC rank
        setCoins(fetchedCoins);
        console.log('Frontend\'e ulaşan işlenmiş coin verisi:', fetchedCoins); // Geçici log
        // fetchedCoins.length > 0 ise ve 'selected' henüz ayarlanmamışsa, ilk coini seç
        if (fetchedCoins.length > 0) {
          setSelected(fetchedCoins[0].symbol);
        }
      } catch (e: any) {
        console.error("API request failed:", e);
        setInitialDataError(e.message);
      } finally {
        setLoadingInitialData(false);
      }
    };

    fetchCoins();
  }, []);

  // Removed the useEffect for fetching coin logos as per user request.

  useEffect(() => {
    console.log('useEffect triggered for selected:', selected); // Debug log
    const fetchChartAndIndicatorsData = async () => {
      setChartLoading(true); // Yükleme başlangıcında true yap
      setChartError(null); // Önceki hataları temizle
      setNewsLoading(true); // Haber yükleme başlangıcında true yap
      setNewsError(null); // Haber hatalarını temizle

      const currentCoin = coins.find((c) => c.symbol === selected);
      console.log('Current coins array:', coins); // Debug log
      console.log('Found currentCoin:', currentCoin); // Debug log
      // currentCoin bulunamazsa veya henüz yüklenmediyse, beklemeye devam et veya varsayılan değerleri ayarla.
      // Bu durum, coinler henüz yüklenmediğinde veya geçerli olmayan bir 'selected' değeri olduğunda ortaya çıkabilir.
      if (!currentCoin) {
        setChartData(null);
        setIndicators({});
        setAiSummary('Please select a coin to view data.'); // Reset AI summary
        setNews([]); // Clear news
        setNewsLoading(false); // Ensure news loading is false if no coin selected
        return;
      }
      try {
        // Twelve Data API için tarih aralığı ve çıktı boyutu
        const interval = '1day'; // Günlük veriler için
        const outputsize = 200; // Son 200 günün verisi için

        // Twelve Data'dan OHLCV verisi çek
        const ohlcvResponse = await fetch(`/api/cryptocurrency/ohlcv/twelvedata-historical?symbol=${selected}&interval=${interval}&outputsize=${outputsize}`);

        if (!ohlcvResponse.ok) {
          const errorData = await ohlcvResponse.json();
          throw new Error(`Twelve Data OHLCV API Error: ${ohlcvResponse.status} - ${errorData.error || errorData.message || ohlcvResponse.statusText}`);
        }
        const ohlcvJson = await ohlcvResponse.json();

        if (ohlcvJson && ohlcvJson.values && ohlcvJson.values.length > 0) {
          // Twelve Data OHLCV data format: [{ datetime, open, high, low, close, volume }, ...]
          const history: any[] = ohlcvJson.values;
          // Veriyi en eskiden en yeniye doğru sırala
          history.sort((a: any, b: any) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime());

          const labels = history.map((data: any) => new Date(data.datetime).toLocaleDateString());
          const prices = history.map((data: any) => parseFloat(data.close));

          setChartData({
            labels: labels,
            datasets: [{
              label: `${selected} Price (USD)`, // Use selected directly
              data: prices,
              borderColor: 'rgb(75, 192, 192)',
              tension: 0.1,
              fill: false,
            }],
          });

          const closePrices = history.map((data: any) => parseFloat(data.close));

          // Technical indicator calculations (remain mostly the same)
          const rsiInput = {
            values: closePrices,
            period: 14,
          };
          const rsi = RSI.calculate(rsiInput);
          const currentRsi = rsi.length > 0 ? rsi[rsi.length - 1] : 'N/A';

          const macdInput = {
            values: closePrices,
            fastPeriod: 12,
            slowPeriod: 26,
            signalPeriod: 9,
            SimpleMA: false,
            SimpleMAOscillator: false,
            SimpleMASignal: false,
          };
          const macd = MACD.calculate(macdInput);
          const currentMacd = macd.length > 0 ? macd[macd.length - 1] : { MACD: 'N/A', signal: 'N/A', histogram: 'N/A' };

          const sma50 = SMA.calculate({ values: closePrices, period: 50 });
          const currentSma50 = sma50.length > 0 ? sma50[sma50.length - 1] : 'N/A';

          const sma200 = SMA.calculate({ values: closePrices, period: 200 });
          const currentSma200 = sma200.length > 0 ? sma200[sma200.length - 1] : 'N/A';

          const currentIndicators = {
            rsi: typeof currentRsi === 'number' ? parseFloat(currentRsi.toFixed(2)) : 'N/A',
            macd: typeof currentMacd.MACD === 'number' ? parseFloat(currentMacd.MACD.toFixed(4)) : 'N/A',
            macdSignal: typeof currentMacd.signal === 'number' ? parseFloat(currentMacd.signal.toFixed(4)) : 'N/A',
            macdHistogram: typeof currentMacd.histogram === 'number' ? parseFloat(currentMacd.histogram.toFixed(4)) : 'N/A',
            sma50: typeof currentSma50 === 'number' ? parseFloat(currentSma50.toFixed(4)) : 'N/A',
            sma200: typeof currentSma200 === 'number' ? parseFloat(currentSma200.toFixed(4)) : 'N/A',
            volume: 0, // No direct volume data from Twelve Data, will be fetched separately if needed
          };
          setIndicators(currentIndicators);

          // Fetch AI analysis
          const aiAnalysisResponse = await fetch('/api/ai/analyze-crypto', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              symbol: selected, // Use selected directly
              currentPrice: currentCoin.currentPrice || 0,
              percentChange24h: currentCoin.percentChange24h || 0,
              marketCap: currentCoin.marketCap || 0,
              rsi: currentIndicators.rsi,
              macd: currentIndicators.macd,
              sma50: currentIndicators.sma50,
              sma200: currentIndicators.sma200,
              volume: currentCoin.volume24h || 0,
              news: news, // Add news data to the payload
            }),
          });

          if (!aiAnalysisResponse.ok) {
            const errorData = await aiAnalysisResponse.json();
            throw new Error(`AI Analysis API Error: ${aiAnalysisResponse.status} - ${errorData.error || aiAnalysisResponse.statusText}`);
          }

          const aiAnalysisJson = await aiAnalysisResponse.json();
          setAiSummary(aiAnalysisJson.analysis);

          try {
              const newsResponse = await fetch(`/api/news/tavily?symbol=${selected}`);

              if (!newsResponse.ok) {
                const errorData = await newsResponse.json();
                console.error('Tavily News API Yanıtı OK değil:', newsResponse.status, errorData);
                throw new Error(`Tavily News API Error: ${newsResponse.status} - ${errorData.error || newsResponse.statusText}`);
              }

              const newsJson = await newsResponse.json();
              setNews(newsJson.news);
          } catch (newsFetchError: any) {
              console.error("Tavily news fetch failed:", newsFetchError);
              setNewsError(`News error: ${newsFetchError.message}`);
              setNews([]);
          }

        } else {
          setChartData(null);
          setIndicators({});
          setChartError('No OHLCV data found for this coin from Twelve Data.');
          setAiSummary('No data to analyze.');
          setNews([]);
        }
        
      } catch (e: any) {
        console.error("OHLCV/AI/News API request failed:", e);
        setChartError(e.message);
        setIndicators({});
        setAiSummary(`AI analysis error: ${e.message}`);
        setNewsError(`News error: ${e.message}`);
        setNews([]); // Hata durumunda haberleri temizle
      } finally {
        setChartLoading(false);
        setNewsLoading(false); // Haber yüklemesini de finally içinde sonlandır
      }
    };
    if (selected) {
      fetchChartAndIndicatorsData();
    }
  }, [selected, coins]); // coins'i bağımlılık dizisine ekledim

  const handleSelectChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const newSelected = event.target.value;
    console.log('Selected coin changed to:', newSelected); // Debug log
    setSelected(newSelected);
  };

  // Yanıp sönen nokta animasyonu için Tailwind CSS uyumlu bir bileşen
  const LoadingDot = () => (
    <span className="inline-block w-2 h-2 ml-2 bg-blue-500 rounded-full animate-pulse duration-100">
    </span>
  );

  // Dummy data for news and AI summary - will be replaced with live data later
  const dummyData: { [key: string]: any } = {
    BTC: {
      news: [
        { title: 'Bitcoin reached new highs!', url: '#' },
        { title: 'Institutional investors increase BTC holdings', url: '#' },
        { title: 'Regulatory news impacts crypto markets', url: '#' },
      ],
      indicators: [
        { name: 'RSI', value: '76', comment: 'Market is overbought, a pullback may occur.' },
        { name: 'MACD', value: '+1.25', comment: 'Bullish crossover detected.' },
        { name: '50-day MA', value: '45,200', comment: 'Price is above the 50-day average.' },
        { name: '200-day MA', value: '39,800', comment: 'Strong long-term uptrend.' },
        { name: 'Volume', value: '1.2B', comment: 'High trading volume supports the trend.' },
        { name: 'Sentiment', value: '182 positive', comment: 'Social media sentiment is positive, buy pressure likely.' },
      ],
      aiSummary: 'According to AI analysis, due to overbought RSI and strong positive sentiment, a short-term correction is possible, but the overall trend remains bullish. Consider waiting for a better entry.',
    },
    ETH: {
      news: [
        { title: 'Ethereum 2.0 launch date announced', url: '#' },
        { title: 'ETH gas fees drop to record lows', url: '#' },
        { title: 'DeFi projects boost Ethereum ecosystem', url: '#' },
      ],
      indicators: [
        { name: 'RSI', value: '54', comment: 'Neutral zone, no strong signal.' },
        { name: 'MACD', value: '-0.32', comment: 'Bearish momentum is fading.' },
        { name: '50-day MA', value: '3,150', comment: 'Price is near the 50-day average.' },
        { name: '200-day MA', value: '2,900', comment: 'Long-term trend is positive.' },
        { name: 'Volume', value: '800M', comment: 'Volume is average.' },
        { name: 'Sentiment', value: '120 positive', comment: 'Sentiment is slightly positive.' },
      ],
      aiSummary: 'AI suggests holding ETH for now as indicators are mixed and no strong trend is present.',
    },
    SOL: {
      news: [
        { title: 'Solana mainnet stability improves', url: '#' },
        { title: 'SOL price rebounds after dip', url: '#' },
        { title: 'NFTs thrive on Solana', url: '#' },
      ],
      indicators: [
        { name: 'RSI', value: '33', comment: 'Approaching oversold territory.' },
        { name: 'MACD', value: '-0.85', comment: 'Bearish momentum increasing.' },
        { name: '50-day MA', value: '110', comment: 'Price is below the 50-day average.' },
        { name: '200-day MA', value: '95', comment: 'Long-term support may be tested.' },
        { name: 'Volume', value: '500M', comment: 'Volume is slightly below average.' },
        { name: 'Sentiment', value: '60 positive', comment: 'Sentiment is neutral.' },
      ],
      aiSummary: 'AI recommends caution as SOL is nearing oversold levels but bearish momentum persists.',
    },
    AVAX: {
      news: [
        { title: 'Avalanche partners with major DeFi platform', url: '#' },
        { title: 'AVAX price surges after network upgrade', url: '#' },
        { title: 'Avalanche ecosystem expands rapidly', url: '#' },
      ],
      indicators: [
        { name: 'RSI', value: '48', comment: 'Neutral, no clear trend.' },
        { name: 'MACD', value: '+0.10', comment: 'Weak bullish signal.' },
        { name: '50-day MA', value: '35', comment: 'Price is at the 50-day average.' },
        { name: '200-day MA', value: '28', comment: 'Long-term trend is positive.' },
        { name: 'Volume', value: '210M', comment: 'Volume is low.' },
        { name: 'Sentiment', value: '30 positive', comment: 'Sentiment is neutral.' },
      ],
      aiSummary: 'AI analysis shows no strong buy or sell signal for AVAX at this time.',
    },
    XRP: {
      news: [
        { title: 'XRP lawsuit update', url: '#' },
        { title: 'Ripple expands global partnerships', url: '#' },
        { title: 'XRP trading volume increases', url: '#' },
      ],
      indicators: [
        { name: 'RSI', value: '41', comment: 'Slightly oversold.' },
        { name: 'MACD', value: '-0.12', comment: 'Bearish but stabilizing.' },
        { name: '50-day MA', value: '0.65', comment: 'Price is below the 50-day average.' },
        { name: '200-day MA', value: '0.58', comment: 'Long-term support is holding.' },
        { name: 'Volume', value: '320M', comment: 'Volume is average.' },
        { name: 'Sentiment', value: '40 positive', comment: 'Sentiment is slightly negative.' },
      ],
      aiSummary: 'AI suggests monitoring XRP for a reversal as oversold conditions may lead to a bounce.',
    },
    ADA: {
      news: [
        { title: 'Cardano launches new smart contracts', url: '#' },
        { title: 'ADA staking rewards increase', url: '#' },
        { title: 'Cardano community grows', url: '#' },
      ],
      indicators: [
        { name: 'RSI', value: '59', comment: 'Approaching overbought.' },
        { name: 'MACD', value: '+0.22', comment: 'Bullish momentum building.' },
        { name: '50-day MA', value: '1.25', comment: 'Price is above the 50-day average.' },
        { name: '200-day MA', value: '1.10', comment: 'Long-term trend is positive.' },
        { name: 'Volume', value: '150M', comment: 'Volume is low.' },
        { name: 'Sentiment', value: '25 positive', comment: 'Sentiment is positive.' },
      ],
      aiSummary: 'AI analysis: ADA is gaining bullish momentum, but overbought risk is rising.',
    },
    FET: {
      news: [
        { title: 'Fetch.ai partners with Bosch for Web3', url: '#' },
        { title: 'FET price surges on AI hype', url: '#' },
        { title: 'FET launches new DeFi tools', url: '#' },
      ],
      indicators: [
        { name: 'RSI', value: '64', comment: 'Slightly overbought.' },
        { name: 'MACD', value: '+0.45', comment: 'Bullish crossover.' },
        { name: '50-day MA', value: '2.10', comment: 'Price is above the 50-day average.' },
        { name: '200-day MA', value: '1.80', comment: 'Long-term trend is positive.' },
        { name: 'Volume', value: '90M', comment: 'Volume is increasing.' },
        { name: 'Sentiment', value: '80 positive', comment: 'Sentiment is positive.' },
      ],
      aiSummary: 'AI analysis: FET is in a bullish phase, but monitor for overbought signals.',
    },
  };

  const dummyNews: NewsItem[] = dummyData[selected]?.news || [];
  // const dummyAiSummary: string = dummyData[selected]?.aiSummary || 'No data found.'; // Remove or comment out this line

  if (loadingInitialData) {
    // return <div className="min-h-screen flex items-center justify-center text-xl">Loading coins...</div>; // Kaldırıldı
  }

  if (initialDataError) {
    // return <div className="min-h-screen flex items-center justify-center text-xl text-red-600">Error: {initialDataError}</div>; // Kaldırıldı
  }

  if (chartLoading) {
    // return <div className="min-h-screen flex items-center justify-center text-xl">Loading...</div>; // Kaldırıldı
  }

  if (chartError) {
    // return <div className="min-h-screen flex items-center justify-center text-xl text-red-600">Error: {chartError}</div>; // Kaldırıldı
  }

  const currentCoin = coins.find((c) => c.symbol === selected);

  return (
    <div className="min-h-screen bg-gray-100 w-full flex flex-col">
      {/* Header */}
      <header className="flex items-center bg-gray-900 text-white p-4">
        <span className="text-3xl font-extrabold tracking-wide">CryptoSignal</span>
      </header>

      {/* Main Content */}
      <div className="flex flex-1 flex-col md:flex-row w-full">
        {/* Left: News & Selector */}
        <aside className="md:w-1/4 w-full bg-white p-6 border-r border-gray-200">
          <div className="mb-6">
            <label htmlFor="coin-select" className="block text-sm font-medium text-gray-700 mb-2">Select Coin</label>
            <select
              id="coin-select"
              value={selected}
              onChange={handleSelectChange}
              className="w-full p-2 border border-gray-300 rounded"
            >
              {coins.map((coin) => (
                <option key={coin.id} value={coin.symbol}>{coin.name} ({coin.symbol})</option>
              ))}
            </select>
          </div>
          <div className="mb-4">
            {currentCoin && (
              <span className="text-lg font-bold flex items-center">
                {currentCoin.name} ({currentCoin.symbol})
              </span>
            )}
            {currentCoin?.currentPrice && <span className={`ml-2 text-xl font-bold ${currentCoin.currentPrice > 0 ? 'text-green-600' : 'text-red-600'}`}>
              ${currentCoin.currentPrice.toFixed(2)}
              <LoadingDot/>{/* Artık sadece yüklenirken değil, sürekli görünür. */}
            </span>}
          </div>
          <h2 className="text-lg font-semibold mb-4">Latest News</h2>
          <ul className="space-y-3">
            {newsLoading ? (
              <li><div className="text-gray-500">Loading news... <LoadingDot /></div></li>
            ) : newsError ? (
              <li><div className="text-red-600">{newsError}</div></li>
            ) : news.length > 0 ? (
              news.map((item: NewsItem, idx: number) => (
                <li key={idx}>
                  <a href={item.url} className="text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer">
                    {item.title}
                  </a>
                </li>
              ))
            ) : (
              <li><div className="text-gray-500">No news found for {selected}.</div></li>
            )}
          </ul>
        </aside>

        {/* Center: Chart and Indicators Table */}
        <main className="flex-1 flex flex-col items-center justify-start p-6">
          {/* Price Chart */}
          <div className="w-full max-w-2xl bg-white rounded-lg shadow p-6 mb-8 flex flex-col items-center">
            <h2 className="text-xl font-semibold mb-4">{selected}/USDT Price Chart</h2>
            {chartLoading ? (
              <div className="w-full h-64 flex items-center justify-center text-gray-500">Loading chart...</div>
            ) : chartError ? (
              <div className="w-full h-64 flex items-center justify-center text-red-600">Chart Error: {chartError}</div>
            ) : chartData ? (
              <div className="w-full h-64">
                <Line data={chartData} options={{ maintainAspectRatio: false }} />
              </div>
            ) : (
              <div className="w-full h-64 bg-gray-200 rounded flex items-center justify-center text-gray-500">
                Chart data not found.
              </div>
            )}
          </div>

          {/* Indicators Table */}
          <div className="w-full max-w-2xl mb-8">
            <h2 className="text-xl font-semibold mb-4">Technical Indicators</h2>
            <table className="min-w-full bg-white rounded-lg shadow overflow-hidden">
              <thead>
                <tr className="bg-gray-100">
                  <th className="py-3 px-4 text-left font-semibold">Indicator</th>
                  <th className="py-3 px-4 text-right font-semibold">Value</th>
                </tr>
              </thead>
              <tbody>
                {/* RSI */} 
                <tr className="border-t border-gray-200">
                  <td className="py-3 px-4 font-medium">RSI (14)</td>
                  <td className={`py-3 px-4 text-right`}>{typeof indicators.rsi === 'number' ? indicators.rsi.toFixed(2) : 'N/A'} <LoadingDot /></td>
                </tr>
                {/* MACD */} 
                <tr className="border-t border-gray-200">
                  <td className="py-3 px-4 font-medium">MACD</td>
                  <td className={`py-3 px-4 text-right`}>{typeof indicators.macd === 'number' ? indicators.macd.toFixed(4) : 'N/A'} <LoadingDot /></td>
                </tr>
                <tr className="border-t border-gray-200">
                  <td className="py-3 px-4 font-medium">MACD Signal</td>
                  <td className={`py-3 px-4 text-right`}>{typeof indicators.macdSignal === 'number' ? indicators.macdSignal.toFixed(4) : 'N/A'} <LoadingDot /></td>
                </tr>
                <tr className="border-t border-gray-200">
                  <td className="py-3 px-4 font-medium">MACD Histogram</td>
                  <td className={`py-3 px-4 text-right`}>{typeof indicators.macdHistogram === 'number' ? indicators.macdHistogram.toFixed(4) : 'N/A'} <LoadingDot /></td>
                </tr>
                {/* 50-day MA */} 
                <tr className="border-t border-gray-200">
                  <td className="py-3 px-4 font-medium">50-Day MA</td>
                  <td className={`py-3 px-4 text-right`}>{typeof indicators.sma50 === 'number' ? indicators.sma50.toFixed(4) : 'N/A'} <LoadingDot /></td>
                </tr>
                {/* 200-day MA */} 
                <tr className="border-t border-gray-200">
                  <td className="py-3 px-4 font-medium">200-Day MA</td>
                  <td className={`py-3 px-4 text-right`}>{typeof indicators.sma200 === 'number' ? indicators.sma200.toFixed(4) : 'N/A'} <LoadingDot /></td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Market Data Table */}
          <div className="w-full max-w-2xl mb-8">
            <h2 className="text-xl font-semibold mb-4">Market Data</h2>
            <table className="min-w-full bg-white rounded-lg shadow overflow-hidden">
              <thead>
                <tr className="bg-gray-100">
                  <th className="py-3 px-4 text-left font-semibold">Metric</th>
                  <th className="py-3 px-4 text-right font-semibold">Value</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t border-gray-200">
                  <td className="py-3 px-4 font-medium">24h Volume</td>
                  <td className={`py-3 px-4 text-right`}>${currentCoin?.volume24h?.toLocaleString() || '0'} <LoadingDot /></td>
                </tr>
                <tr className="border-t border-gray-200">
                  <td className="py-3 px-4 font-medium">1h Change</td>
                  <td className={`py-3 px-4 text-right ${currentCoin && (currentCoin.percentChange1h || 0) > 0 ? 'text-green-600' : 'text-red-600'}`}>{currentCoin?.percentChange1h?.toFixed(2) || 'N/A'}% <LoadingDot /></td>
                </tr>
                <tr className="border-t border-gray-200">
                  <td className="py-3 px-4 font-medium">24h Change</td>
                  <td className={`py-3 px-4 text-right ${currentCoin && (currentCoin.percentChange24h || 0) > 0 ? 'text-green-600' : 'text-red-600'}`}>{currentCoin?.percentChange24h?.toFixed(2) || 'N/A'}% <LoadingDot /></td>
                </tr>
                <tr className="border-t border-gray-200">
                  <td className="py-3 px-4 font-medium">7d Change</td>
                  <td className={`py-3 px-4 text-right ${currentCoin && (currentCoin.percentChange7d || 0) > 0 ? 'text-green-600' : 'text-red-600'}`}>{currentCoin?.percentChange7d?.toFixed(2) || 'N/A'}% <LoadingDot /></td>
                </tr>
                <tr className="border-t border-gray-200">
                  <td className="py-3 px-4 font-medium">Market Cap</td>
                  <td className={`py-3 px-4 text-right`}>${currentCoin?.marketCap?.toLocaleString() || '0'} <LoadingDot /></td>
                </tr>
                <tr className="border-t border-gray-200">
                  <td className="py-3 px-4 font-medium">CMC Rank</td>
                  <td className={`py-3 px-4 text-right`}>{currentCoin?.cmcRank || 'N/A'} <LoadingDot /></td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* AI Analysis Summary */}
          <div className="w-full max-w-2xl flex justify-center">
            <div className="rounded-lg shadow p-6 text-lg font-semibold text-white w-full text-center bg-gradient-to-r from-blue-500 to-indigo-600">
              {aiSummary}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

export default App;