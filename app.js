class TradingChart {
    constructor() {
        this.chart = null;
        this.candleSeries = null;
        this.volumeSeries = null;
        this.maSeries = null;
        this.currentSymbol = 'BTCUSD';
        this.currentTimeframe = '1h';
        this.currentDataSource = 'binance';
        this.showVolume = true;
        this.showMA = false;
        this.maPeriod = 20;
        this.maColor = '#f7931a';
        this.lastData = [];
        this.ws = null;
        this.updateInterval = null;
        this.countdownInterval = null;
        this.currentCandleEndTime = null;
        
        this.init();
    }

    init() {
        this.setupChart();
        this.bindEvents();
        this.loadData();
        this.startRealTimeUpdates();
    }

    setupChart() {
        const chartContainer = document.getElementById('binanceChart');
        
        this.chart = LightweightCharts.createChart(chartContainer, {
            layout: {
                background: { type: 'solid', color: '#131722' },
                textColor: '#d1d4dc',
            },
            grid: {
                vertLines: { color: '#1e222d' },
                horzLines: { color: '#1e222d' },
            },
            crosshair: {
                mode: LightweightCharts.CrosshairMode.Normal,
                vertLine: {
                    width: 1,
                    color: '#787b86',
                    style: LightweightCharts.LineStyle.Dashed,
                },
                horzLine: {
                    width: 1,
                    color: '#787b86',
                    style: LightweightCharts.LineStyle.Dashed,
                },
            },
            timeScale: {
                borderColor: '#363a45',
                timeVisible: true,
                secondsVisible: false,
                visible: true,
                tickMarkFormatter: (time) => {
                    const date = new Date(time * 1000);
                    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
                },
            },
            rightPriceScale: {
                borderColor: '#363a45',
                visible: true,
                ticksVisible: true,
                textColor: '#d1d4dc',
            },
        });

        this.candleSeries = this.chart.addCandlestickSeries({
            upColor: '#26a69a',
            downColor: '#ef5350',
            borderUpColor: '#26a69a',
            borderDownColor: '#ef5350',
            wickUpColor: '#26a69a',
            wickDownColor: '#ef5350',
        });

        this.volumeSeries = this.chart.addHistogramSeries({
            color: '#26a69a',
            priceFormat: { type: 'volume' },
            priceScaleId: '',
            scaleMargins: { top: 0.8, bottom: 0 },
        });

        this.setupResizeObserver(chartContainer);
        this.setupCrosshairTooltip();
        this.setupTimeOverlay();
    }
    
    setupTimeOverlay() {
        const container = document.getElementById('binanceChart');
        container.style.position = 'relative';
        
        const priceTimeLabel = document.createElement('div');
        priceTimeLabel.id = 'priceTimeLabel';
        priceTimeLabel.style.cssText = `
            position: absolute;
            right: 8px;
            top: 10px;
            padding: 4px 10px;
            background: #2962ff;
            color: #fff;
            font-size: 12px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-weight: 500;
            pointer-events: none;
            z-index: 10;
            border-radius: 3px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.3);
            display: flex;
            flex-direction: column;
            align-items: flex-end;
            gap: 2px;
        `;
        priceTimeLabel.innerHTML = `
            <span id="priceValue">--</span>
            <span id="timeValue" style="font-size: 10px; opacity: 0.8;">--</span>
        `;
        container.appendChild(priceTimeLabel);
        
        const livePriceLabel = document.createElement('div');
        livePriceLabel.id = 'livePriceLabel';
        livePriceLabel.style.cssText = `
            position: absolute;
            padding: 4px 10px;
            background: #2962ff;
            color: #fff;
            font-size: 12px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-weight: 500;
            pointer-events: none;
            z-index: 10;
            border-radius: 3px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.3);
            display: flex;
            flex-direction: column;
            align-items: flex-end;
            gap: 2px;
            transition: top 0.3s ease, background 0.3s ease;
        `;
        livePriceLabel.innerHTML = `
            <span id="livePriceValue">--</span>
            <span id="liveCountdown" style="font-size: 10px; opacity: 0.9;">--</span>
        `;
        container.appendChild(livePriceLabel);
        
        const countdownBar = document.createElement('div');
        countdownBar.id = 'countdownBar';
        countdownBar.style.cssText = `
            position: absolute;
            left: 0;
            bottom: 0;
            height: 3px;
            background: linear-gradient(90deg, #2962ff, #00bcd4);
            pointer-events: none;
            z-index: 10;
            transition: width 1s linear;
            border-radius: 0 2px 0 0;
        `;
        container.appendChild(countdownBar);
        
        this.chart.subscribeCrosshairMove(param => {
            const priceTimeLabel = document.getElementById('priceTimeLabel');
            
            if (param.time) {
                const date = new Date(param.time * 1000);
                
                let price = null;
                if (param.seriesData && param.seriesData.size > 0) {
                    const candleData = param.seriesData.get(this.candleSeries);
                    if (candleData) {
                        price = candleData.close;
                    }
                }
                
                if (price === null && this.lastData.length > 0) {
                    const lastCandle = this.lastData[this.lastData.length - 1];
                    if (lastCandle && Math.abs(lastCandle.time - param.time) < 3600) {
                        price = lastCandle.close;
                    }
                }
                
                const hours = date.getHours().toString().padStart(2, '0');
                const minutes = date.getMinutes().toString().padStart(2, '0');
                const day = date.getDate();
                const month = date.toLocaleString('en-US', { month: 'short' });
                
                if (price !== null) {
                    const priceStr = price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                    const priceValueEl = document.getElementById('priceValue');
                    const timeValueEl = document.getElementById('timeValue');
                    if (priceValueEl) priceValueEl.textContent = priceStr;
                    if (timeValueEl) timeValueEl.textContent = `${day} ${month}  ${hours}:${minutes}`;
                } else {
                    const priceValueEl = document.getElementById('priceValue');
                    const timeValueEl = document.getElementById('timeValue');
                    if (priceValueEl) priceValueEl.textContent = '--';
                    if (timeValueEl) timeValueEl.textContent = `${day} ${month}  ${hours}:${minutes}`;
                }
                
                const formattedDate = date.toLocaleString('en-US', {
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                    hour12: false
                });
                const infoTimeEl = document.getElementById('infoTime');
                if (infoTimeEl) infoTimeEl.textContent = formattedDate;
            } else {
                const priceValueEl = document.getElementById('priceValue');
                const timeValueEl = document.getElementById('timeValue');
                if (priceValueEl) priceValueEl.textContent = '--';
                if (timeValueEl) timeValueEl.textContent = '--';
                const infoTimeEl = document.getElementById('infoTime');
                if (infoTimeEl) infoTimeEl.textContent = '--';
            }
        });
    }

    setupResizeObserver(container) {
        const resizeObserver = new ResizeObserver(entries => {
            if (entries.length === 0 || entries[0].target !== container) return;
            const { width, height } = entries[0].contentRect;
            this.chart.resize(width, height);
        });
        resizeObserver.observe(container);
    }

    setupCrosshairTooltip() {
        this.chart.subscribeCrosshairMove(param => {
            if (!param.time || !param.seriesData) return;
            
            const candleData = param.seriesData.get(this.candleSeries);
            if (candleData) {
                const infoOpenEl = document.getElementById('infoOpen');
                const infoHighEl = document.getElementById('infoHigh');
                const infoLowEl = document.getElementById('infoLow');
                const infoCloseEl = document.getElementById('infoClose');
                const infoTimeEl = document.getElementById('infoTime');
                
                if (infoOpenEl) infoOpenEl.textContent = candleData.open?.toFixed(2) || '--';
                if (infoHighEl) infoHighEl.textContent = candleData.high?.toFixed(2) || '--';
                if (infoLowEl) infoLowEl.textContent = candleData.low?.toFixed(2) || '--';
                if (infoCloseEl) infoCloseEl.textContent = candleData.close?.toFixed(2) || '--';
                
                const date = new Date(param.time * 1000);
                const formattedDate = date.toLocaleString('en-US', {
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                    hour12: false
                });
                if (infoTimeEl) infoTimeEl.textContent = formattedDate;
            }
        });
    }

    bindEvents() {
        document.getElementById('btnBTC').addEventListener('click', () => this.switchSymbol('BTCUSD'));
        document.getElementById('btnXAU').addEventListener('click', () => this.switchSymbol('XAUUSD'));
        document.getElementById('dataSource').addEventListener('change', e => this.switchDataSource(e.target.value));
        document.getElementById('chartType').addEventListener('change', e => this.changeChartType(e.target.value));
        document.getElementById('timeframe').addEventListener('change', e => this.changeTimeframe(e.target.value));
        document.getElementById('toggleVolume').addEventListener('click', () => this.toggleVolume());
        document.getElementById('toggleMA').addEventListener('click', () => this.toggleMA());
    }

    switchDataSource(source) {
        this.currentDataSource = source;
        
        const binanceChart = document.getElementById('binanceChart');
        const mt5Container = document.getElementById('mt5Chart');
        const mt5Iframe = document.getElementById('mt5iframe');
        
        if (source === 'mt5') {
            binanceChart.style.display = 'none';
            mt5Container.style.display = 'block';
            
            const symbolMap = {
                'BTCUSD': 'BTCUSD',
                'XAUUSD': 'XAUUSD'
            };
            const tfMap = {
                '1m': 'M1', '5m': 'M5', '15m': 'M15',
                '1h': 'H1', '4h': 'H4', '1d': 'D1', '1w': 'W1'
            };
            
            const mt5Symbol = symbolMap[this.currentSymbol] || this.currentSymbol;
            const mt5Tf = tfMap[this.currentTimeframe] || 'H1';
            
            const mt5Url = `https://web.metatrader5.com/demo/account?lang=vi&symbol=${mt5Symbol}&chart_period=${mt5Tf}`;
            mt5Iframe.src = mt5Url;
            
            if (this.ws) {
                this.ws.close();
            }
        } else {
            binanceChart.style.display = 'block';
            mt5Container.style.display = 'none';
            mt5Iframe.src = '';
            
            this.connectWebSocket();
            this.loadData();
        }
    }

    startRealTimeUpdates() {
        this.connectWebSocket();
        
        this.updateInterval = setInterval(() => {
            this.updateRealtimePrice();
        }, 5000);
    }

    connectWebSocket() {
        if (this.ws) {
            this.ws.close();
        }

        const symbol = this.currentSymbol === 'BTCUSD' ? 'btcusdt' : 'xauusdt';
        const interval = this.getWebSocketInterval();
        
        const wsUrl = `wss://stream.binance.com:9443/ws/${symbol}@kline_${interval}`;
        
        this.ws = new WebSocket(wsUrl);
        
        this.ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if (data.k) {
                this.updateLastCandle(data.k);
            }
        };
        
        this.ws.onerror = (error) => {
            console.warn('WebSocket error (will reconnect automatically):', error.type);
        };
        
        this.ws.onclose = (event) => {
            if (!event.wasClean) {
                setTimeout(() => this.connectWebSocket(), 5000);
            }
        };
    }

    getWebSocketInterval() {
        const map = {
            '1m': '1m', '5m': '5m', '15m': '15m',
            '1h': '1h', '4h': '4h', '1d': '1d', '1w': '1w'
        };
        return map[this.currentTimeframe] || '1h';
    }

    updateLastCandle(kline) {
        if (this.lastData.length === 0) return;
        
        const newTime = Math.floor(kline.t / 1000);
        const lastCandle = this.lastData[this.lastData.length - 1];
        
        const candleData = {
            time: newTime,
            open: parseFloat(kline.o),
            high: parseFloat(kline.h),
            low: parseFloat(kline.l),
            close: parseFloat(kline.c),
        };
        
        const volumeData = {
            time: newTime,
            value: parseFloat(kline.v),
            color: candleData.close >= candleData.open ? 'rgba(38, 166, 154, 0.5)' : 'rgba(239, 83, 80, 0.5)',
        };
        
        if (lastCandle.time === newTime) {
            this.candleSeries.update(candleData);
            this.volumeSeries.update(volumeData);
            this.lastData[this.lastData.length - 1] = candleData;
        } else {
            this.lastData.push(candleData);
            this.updateCandleEndTime(newTime);
        }
        
        this.updateHeader([candleData, lastCandle]);
        this.updateLivePriceLabel();
    }

    async updateRealtimePrice() {
        const symbol = this.currentSymbol === 'BTCUSD' ? 'BTCUSDT' : 'XAUUSDT';
        
        try {
            const response = await fetch(`http://localhost:3001/api/ticker/${symbol}`);
            if (response.ok) {
                const data = await response.json();
                if (data.lastPrice) {
                    const price = parseFloat(data.lastPrice);
                    const changePercent = parseFloat(data.priceChangePercent) || 0;
                    
                    document.getElementById('currentPrice').textContent = `$${price.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
                    
                    const priceChangeEl = document.getElementById('priceChange');
                    priceChangeEl.textContent = `${changePercent >= 0 ? '+' : ''}${changePercent.toFixed(2)}%`;
                    priceChangeEl.className = `price-change ${changePercent >= 0 ? 'positive' : 'negative'}`;
                }
            }
        } catch (e) {
            console.warn('Price update failed:', e.message);
        }
    }

    switchSymbol(symbol) {
        if (this.currentSymbol === symbol) return;
        
        document.querySelectorAll('.symbol-tab').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.symbol === symbol);
        });
        
        this.currentSymbol = symbol;
        this.stopCountdown();
        this.connectWebSocket();
        this.updateRealtimePrice();
        this.loadData();
    }

    async loadData() {
        this.showLoading(true);
        try {
            const data = await this.fetchData();
            this.lastData = data;
            this.updateChart(data);
            this.updateHeader(data);
        } catch (error) {
            console.error('Error loading data:', error);
        } finally {
            this.showLoading(false);
        }
    }

    async fetchData() {
        if (this.currentSymbol === 'BTCUSD') {
            return this.fetchBTCData();
        } else if (this.currentSymbol === 'XAUUSD') {
            return this.fetchXAUData();
        }
        throw new Error('Unknown symbol');
    }

    async fetchBTCData() {
        const interval = this.getBinanceInterval();
        const symbol = 'BTCUSDT';
        
        try {
            const response = await fetch(`http://localhost:3001/api/klines/${symbol}/${interval}`);
            if (response.ok) {
                const data = await response.json();
                if (Array.isArray(data) && data.length > 0) {
                    return data.map(k => ({
                        time: Math.floor(k[0] / 1000),
                        open: parseFloat(k[1]),
                        high: parseFloat(k[2]),
                        low: parseFloat(k[3]),
                        close: parseFloat(k[4]),
                        volume: parseFloat(k[5])
                    })).filter(d => d.close > 0);
                }
            }
        } catch (e) {
            console.warn('BTC fetch failed:', e.message);
        }
        throw new Error('No BTC data available');
    }

    async fetchXAUData() {
        const interval = this.getBinanceInterval();
        const symbol = 'XAUUSDT';
        
        try {
            const response = await fetch(`http://localhost:3001/api/klines/${symbol}/${interval}`);
            if (response.ok) {
                const data = await response.json();
                if (Array.isArray(data) && data.length > 0) {
                    return data.map(k => ({
                        time: Math.floor(k[0] / 1000),
                        open: parseFloat(k[1]),
                        high: parseFloat(k[2]),
                        low: parseFloat(k[3]),
                        close: parseFloat(k[4]),
                        volume: parseFloat(k[5])
                    })).filter(d => d.close > 0);
                }
            }
        } catch (e) {
            console.warn('XAU fetch failed:', e.message);
        }
        throw new Error('No gold data available');
    }

    getBinanceInterval() {
        const map = {
            '1m': '1m', '5m': '5m', '15m': '15m',
            '1h': '1h', '4h': '4h', '1d': '1d', '1w': '1w'
        };
        return map[this.currentTimeframe] || '1h';
    }

    updateChart(data) {
        if (!data || data.length === 0) {
            console.error('No data to display');
            return;
        }
        
        this.candleSeries.setData(data);
        
        const volumeData = data.map(d => ({
            time: d.time,
            value: d.volume || 1000000,
            color: d.close >= d.open ? 'rgba(38, 166, 154, 0.5)' : 'rgba(239, 83, 80, 0.5)',
        }));
        this.volumeSeries.setData(volumeData);
        
        this.volumeSeries.applyOptions({ visible: this.showVolume });
        
        this.updateMA();
        
        const exchange = this.currentSymbol === 'BTCUSD' ? 'Binance BTC' : 'Binance XAU';
        const infoSymbolEl = document.getElementById('infoSymbol');
        const infoExchangeEl = document.getElementById('infoExchange');
        if (infoSymbolEl) infoSymbolEl.textContent = this.currentSymbol;
        if (infoExchangeEl) infoExchangeEl.textContent = exchange;
        
        const lastCandle = data[data.length - 1];
        if (lastCandle) {
            const infoVolumeEl = document.getElementById('infoVolume');
            if (infoVolumeEl) infoVolumeEl.textContent = this.formatVolume(lastCandle.volume);
        }
        
        this.chart.timeScale().fitContent();
        
        this.startCountdown();
    }

    getTimeframeSeconds() {
        const map = {
            '1m': 60,
            '5m': 300,
            '15m': 900,
            '1h': 3600,
            '4h': 14400,
            '1d': 86400,
            '1w': 604800
        };
        return map[this.currentTimeframe] || 3600;
    }

    startCountdown() {
        if (this.countdownInterval) {
            clearInterval(this.countdownInterval);
        }

        if (this.lastData.length === 0) return;

        const lastCandle = this.lastData[this.lastData.length - 1];
        this.updateCandleEndTime(lastCandle.time);

        this.countdownInterval = setInterval(() => {
            this.updateCountdown();
            this.updateLivePriceLabel();
        }, 1000);

        this.updateCountdown();
        this.updateLivePriceLabel();
    }

    updateCandleEndTime(lastCandleTime) {
        const tfSeconds = this.getTimeframeSeconds();
        const now = Math.floor(Date.now() / 1000);
        
        const currentCandleStart = lastCandleTime;
        const nextCandleStart = currentCandleStart + tfSeconds;
        
        this.currentCandleEndTime = nextCandleStart;
    }

    updateCountdown() {
        const countdownEl = document.getElementById('infoCountdown');
        if (!countdownEl) return;

        const now = Math.floor(Date.now() / 1000);
        const tfSeconds = this.getTimeframeSeconds();
        const remaining = this.currentCandleEndTime - now;
        const elapsed = tfSeconds - remaining;

        if (remaining <= 0) {
            countdownEl.textContent = '00:00';
            this.updateCountdownBar(0);
            return;
        }

        const hours = Math.floor(remaining / 3600);
        const minutes = Math.floor((remaining % 3600) / 60);
        const seconds = remaining % 60;

        let timeStr;
        if (hours > 0) {
            timeStr = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        } else {
            timeStr = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        }

        countdownEl.textContent = timeStr;

        const priceTimeLabel = document.getElementById('priceTimeLabel');
        const timeValueEl = document.getElementById('timeValue');
        if (timeValueEl) {
            if (hours > 0) {
                timeValueEl.textContent = `${hours}h ${minutes}m ${seconds}s`;
            } else {
                timeValueEl.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
            }
        }

        if (remaining <= 10) {
            countdownEl.classList.add('warning');
            const priceTimeLabel = document.getElementById('priceTimeLabel');
            if (priceTimeLabel) priceTimeLabel.style.background = '#ef5350';
        } else {
            countdownEl.classList.remove('warning');
            const priceTimeLabel = document.getElementById('priceTimeLabel');
            if (priceTimeLabel) priceTimeLabel.style.background = '#2962ff';
        }

        const progressPercent = (elapsed / tfSeconds) * 100;
        this.updateCountdownBar(progressPercent);
    }

    updateCountdownBar(percent) {
        const bar = document.getElementById('countdownBar');
        if (!bar) return;
        bar.style.width = `${percent}%`;
    }

    updateLivePriceLabel() {
        if (this.lastData.length === 0) return;

        const lastCandle = this.lastData[this.lastData.length - 1];
        const livePriceLabel = document.getElementById('livePriceLabel');
        const livePriceValue = document.getElementById('livePriceValue');
        const liveCountdown = document.getElementById('liveCountdown');

        if (!livePriceLabel) return;

        const price = lastCandle.close;
        const priceStr = price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        if (livePriceValue) livePriceValue.textContent = priceStr;

        const now = Math.floor(Date.now() / 1000);
        const tfSeconds = this.getTimeframeSeconds();
        const remaining = this.currentCandleEndTime - now;

        if (remaining <= 0) {
            if (liveCountdown) liveCountdown.textContent = '00:00';
            livePriceLabel.style.background = '#ef5350';
        } else {
            const hours = Math.floor(remaining / 3600);
            const minutes = Math.floor((remaining % 3600) / 60);
            const seconds = remaining % 60;

            if (liveCountdown) {
                if (hours > 0) {
                    liveCountdown.textContent = `${hours}h ${minutes}m ${seconds}s`;
                } else {
                    liveCountdown.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
                }
            }

            if (remaining <= 10) {
                livePriceLabel.style.background = '#ef5350';
            } else {
                livePriceLabel.style.background = '#2962ff';
            }
        }

        const priceCoordinate = this.candleSeries.priceToCoordinate(price);
        if (priceCoordinate !== null) {
            const chartHeight = document.getElementById('binanceChart').clientHeight;
            let topPos = priceCoordinate + 30;
            if (topPos > chartHeight - 50) {
                topPos = priceCoordinate - 50;
            }
            livePriceLabel.style.top = `${topPos}px`;
        }
    }

    updateHeader(data) {
        if (data.length < 2) return;
        
        const lastCandle = data[data.length - 1];
        const prevCandle = data[data.length - 2];
        
        const currentPrice = lastCandle.close;
        const priceChange = currentPrice - prevCandle.close;
        const priceChangePercent = (priceChange / prevCandle.close) * 100;
        
        document.getElementById('currentPrice').textContent = `$${currentPrice.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
        
        const priceChangeEl = document.getElementById('priceChange');
        priceChangeEl.textContent = `${priceChange >= 0 ? '+' : ''}${priceChange.toFixed(2)} (${priceChangePercent.toFixed(2)}%)`;
        priceChangeEl.className = `price-change ${priceChange >= 0 ? 'positive' : 'negative'}`;
    }

    changeChartType(type) {
        this.chart.removeSeries(this.candleSeries);
        
        switch (type) {
            case 'candlestick':
                this.candleSeries = this.chart.addCandlestickSeries({
                    upColor: '#26a69a',
                    downColor: '#ef5350',
                    borderUpColor: '#26a69a',
                    borderDownColor: '#ef5350',
                    wickUpColor: '#26a69a',
                    wickDownColor: '#ef5350',
                });
                break;
            case 'bar':
                this.candleSeries = this.chart.addBarSeries({
                    upColor: '#26a69a',
                    downColor: '#ef5350',
                });
                break;
            case 'line':
                this.candleSeries = this.chart.addLineSeries({
                    color: '#2962ff',
                    lineWidth: 2,
                });
                break;
            case 'area':
                this.candleSeries = this.chart.addAreaSeries({
                    topColor: 'rgba(41, 98, 255, 0.4)',
                    bottomColor: 'rgba(41, 98, 255, 0.0)',
                    lineColor: '#2962ff',
                    lineWidth: 2,
                });
                break;
        }
        
        if (this.lastData.length > 0) {
            this.candleSeries.setData(this.lastData);
            this.chart.timeScale().fitContent();
        }
    }

    changeTimeframe(tf) {
        this.currentTimeframe = tf;
        this.stopCountdown();
        this.connectWebSocket();
        this.loadData();
    }

    stopCountdown() {
        if (this.countdownInterval) {
            clearInterval(this.countdownInterval);
            this.countdownInterval = null;
        }
    }

    toggleVolume() {
        this.showVolume = !this.showVolume;
        const btn = document.getElementById('toggleVolume');
        btn.classList.toggle('active', this.showVolume);
        this.loadData();
    }

    toggleMA() {
        this.showMA = !this.showMA;
        const btn = document.getElementById('toggleMA');
        btn.classList.toggle('active', this.showMA);
        
        this.updateMAIndicatorList();
        this.updateMA();
    }

    updateMAIndicatorList() {
        const container = document.getElementById('activeIndicators');
        if (this.showMA) {
            container.innerHTML = `
                <div class="indicator-tag">
                    <span>MA ${this.maPeriod}</span>
                    <button onclick="chart.toggleMA()">x</button>
                </div>
            `;
        } else {
            container.innerHTML = '';
        }
    }

    updateMA() {
        if (this.maSeries) {
            this.chart.removeSeries(this.maSeries);
            this.maSeries = null;
        }
        
        if (!this.showMA) return;
        
        this.maSeries = this.chart.addLineSeries({
            color: this.maColor,
            lineWidth: 2,
            title: `MA ${this.maPeriod}`,
        });
        
        const data = this.candleSeries.data();
        if (!data || data.length === 0) return;
        
        const maData = this.calculateMA(data, this.maPeriod);
        this.maSeries.setData(maData);
    }

    calculateMA(data, period) {
        const result = [];
        for (let i = period - 1; i < data.length; i++) {
            let sum = 0;
            for (let j = 0; j < period; j++) {
                sum += data[i - j].close;
            }
            result.push({
                time: data[i].time,
                value: sum / period,
            });
        }
        return result;
    }

    formatVolume(volume) {
        if (volume >= 1e9) return (volume / 1e9).toFixed(2) + 'B';
        if (volume >= 1e6) return (volume / 1e6).toFixed(2) + 'M';
        if (volume >= 1e3) return (volume / 1e3).toFixed(2) + 'K';
        return volume.toString();
    }

    showLoading(show) {
        document.getElementById('loading').classList.toggle('show', show);
    }
}

const chart = new TradingChart();
