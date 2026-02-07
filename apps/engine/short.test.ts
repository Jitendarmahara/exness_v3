// test/trading.test.ts
// test/trading.test.ts
import { describe, test, expect, beforeEach, mock } from "bun:test";
import { 
    CreateOpenOrder, 
    ClosePosition, 
    LiquidatePosition,
    CheckPositionUpdates,
    GetAllOpenTrades,
    Callculatepnl,
    type Orderdetails,
    type PriceData 
} from "./helper/process";
import { Balances, OpenOrderDetails, Type, Asset } from "./state";

// Mock Redis
const mockRedis = {
    publish: mock(async () => 1),
    connect: mock(async () => {}),
};

// Helper to convert USD to internal representation (multiply by 100 for 2 decimals)
const toInternal = (usd: number) => Math.round(usd * 100);
const toUSD = (internal: number) => internal / 100;

describe("Trading Engine Tests", () => {
    beforeEach(() => {
        // Clear all state before each test
        Balances.clear();
        OpenOrderDetails.clear();
        mockRedis.publish.mockClear();
    });

    describe("CreateOpenOrder", () => {
        
        test("should trigger take profit for SHORT position", async () => {
            const asset = Asset.ETH_USDC;
            const userId = "user2";
            
            Balances.set(userId, {
                userId,
                balnce: { usd: toInternal(800) },
                decimal: 2
            });

            const order = {
                userId,
                orderId: "order2",
                type: Type.SHORT,
                asset,
                leverage: 5,
                margin: toInternal(200),
                quanity: 20,
                slipage: 1,
                price: toInternal(50),
                currentprice: toInternal(50),
                takeprofit: toInternal(45)  // Take profit at 45
            };
            OpenOrderDetails.set(asset, [order]);

            const priceData: PriceData = {
                bid: toInternal(44),  // Below take profit (uses ask for SHORT)
                ask: toInternal(45)
            };

            await CheckPositionUpdates(asset, priceData);

            const orders = OpenOrderDetails.get(asset);
            expect(orders?.length).toBe(0);
            console.log("done")

            // Balance: 800 + 200 (margin) + 120 (profit: (50-44)*20) = 1120
            const balance = Balances.get(userId);
            expect(balance?.balnce.usd).toBe(toInternal(110000));
        });

        
    });
});