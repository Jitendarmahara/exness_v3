// this work is to update the candles table every 1 minute timeframe
import { sql } from "./index.js";
import cron from "node-cron";

const TIMEFRAMES = {
    "1m": { interval: 60 * 1000, table: "candles_1m" },
    "5m": { interval: 5 * 60 * 1000, table: "candles_5m" },
    "15m": { interval: 15 * 60 * 1000, table: "candles_15m" },
    "1h": { interval: 60 * 60 * 1000, table: "candles_1h" },
    "4h": { interval: 4 * 60 * 60 * 1000, table: "candles_4h" },
    "1d": { interval: 24 * 60 * 60 * 1000, table: "candles_1d" },
    "1w": { interval: 7 * 24 * 60 * 60 * 1000, table: "candles_1w" }
};

const MARKETS = ["SOL_USDC", "BTC_USDC", "ETH_USDC"];

function getCandleStartTime(timestamp: number, interval: number): number {
    return Math.floor(timestamp / interval) * interval;
}

async function aggregateCandle(
    market: string,
    timeframe: string,
    intervalMs: number,
    tableName: string
) {
    try {
        const now = Date.now();
        const currentCandleStart = getCandleStartTime(now, intervalMs);
        const previousCandleStart = currentCandleStart - intervalMs;
        const previousCandleEnd = currentCandleStart;

        // ✅ convert to Date for TIMESTAMPTZ
        const startTime = new Date(previousCandleStart);
        const endTime = new Date(previousCandleEnd);

        const result = await sql`
            SELECT
                MIN(price) AS low,
                MAX(price) AS high,
                COUNT(*) AS trade_count,
                (SELECT price FROM ticks
                 WHERE market = ${market}
                   AND timestamp >= ${startTime}
                   AND timestamp < ${endTime}
                 ORDER BY timestamp ASC LIMIT 1) AS open,
                (SELECT price FROM ticks
                 WHERE market = ${market}
                   AND timestamp >= ${startTime}
                   AND timestamp < ${endTime}
                 ORDER BY timestamp DESC LIMIT 1) AS close
            FROM ticks
            WHERE market = ${market}
              AND timestamp >= ${startTime}
              AND timestamp < ${endTime}
        `;

        if (!result[0] || result[0].open === null) {
            console.log(`[${timeframe}] ${market}: No ticks found for previous candle`);
            return;
        }

        const candle = result[0];

        await sql`
            INSERT INTO ${sql(tableName)} (
                market, open, high, low, close,
                start_time, end_time, trade_count
            )
            VALUES (
                ${market},
                ${candle.open},
                ${candle.high},
                ${candle.low},
                ${candle.close},
                ${startTime},
                ${endTime},
                ${candle.trade_count}
            )
            ON CONFLICT (market, start_time)
            DO UPDATE SET
                high = EXCLUDED.high,
                low = EXCLUDED.low,
                close = EXCLUDED.close,
                trade_count = EXCLUDED.trade_count
        `;

        console.log(
            `[${timeframe}] ${market}: O=${candle.open} H=${candle.high} L=${candle.low} C=${candle.close}`
        );
    } catch (e) {
        console.error(`Error aggregating ${timeframe} for ${market}:`, e);
    }
}

async function runAggregation() {
    const ts = new Date().toISOString();
    console.log(`\n🔄 [${ts}] Running candle aggregation...`);

    for (const market of MARKETS) {
        for (const [timeframe, config] of Object.entries(TIMEFRAMES)) {
            await aggregateCandle(
                market,
                timeframe,
                config.interval,
                config.table
            );
        }
    }

    console.log("✅ Aggregation cycle complete\n");
}

// run every minute
cron.schedule("* * * * *", () => {
    runAggregation().catch(console.error);
});

console.log("Candle aggregator started");
console.log(`Markets: ${MARKETS.join(", ")}`);
console.log("Running every minute at :00 seconds\n");

// run immediately on startup
runAggregation().catch(console.error);
