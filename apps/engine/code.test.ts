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
        test("should create LONG position successfully", () => {
            // Setup
            const userId = "user1";
            Balances.set(userId, {
                userId,
                balnce: { usd: toInternal(1000) }, // 1000 USD = 100000 internal
                decimal: 2
            });

            const orderDetails: Orderdetails = {
                userId,
                orderId: "order1",
                type: Type.LONG,
                asset: Asset.BTC_USDC,
                price: toInternal(100),      // 100 USD = 10000 internal
                margin: toInternal(100),     // 100 USD = 10000 internal
                leverage: 10,
                slipage: 1  // 1% slippage
            };

            const priceData: PriceData = {
                bid: toInternal(99),
                ask: toInternal(100.5)  // Within slippage (100 + 1% = 101)
            };

            // Execute
            const result = CreateOpenOrder(orderDetails, priceData);

            // Assert
            expect(result.success).toBe(true);
            expect(result.data).toBeDefined();
            expect(result.data?.asset).toBe(Asset.BTC_USDC);
            expect(result.data?.type).toBe(Type.LONG);
            expect(result.data?.leverage).toBe(10);
            
            // Check balance deduction
            const balance = Balances.get(userId);
            expect(balance?.balnce.usd).toBe(toInternal(900)); // 1000 - 100 margin

            // Check order stored by asset
            const orders = OpenOrderDetails.get(Asset.BTC_USDC);
            expect(orders?.length).toBe(1);
            expect(orders?.[0]?.orderId).toBe("order1");
            expect(orders?.[0]?.margin).toBe(toInternal(100));
        });

        test("should create SHORT position successfully", () => {
            const userId = "user2";
            Balances.set(userId, {
                userId,
                balnce: { usd: toInternal(2000) },
                decimal: 2
            });

            const orderDetails: Orderdetails = {
                userId,
                orderId: "order2",
                type: Type.SHORT,
                asset: Asset.ETH_USDC,
                price: toInternal(50),
                margin: toInternal(200),
                leverage: 5,
                slipage: 2  // 2% slippage
            };

            const priceData: PriceData = {
                bid: toInternal(49.5),  // Within slippage (50 - 2% = 49)
                ask: toInternal(51)
            };

            const result = CreateOpenOrder(orderDetails, priceData);

            expect(result.success).toBe(true);
            expect(result.data?.type).toBe(Type.SHORT);
            expect(result.data?.currentprice).toBe(toInternal(49.5)); // Uses bid for SHORT
            
            // Check balance
            const balance = Balances.get(userId);
            expect(balance?.balnce.usd).toBe(toInternal(1800)); // 2000 - 200
        });

        test("should reject order when insufficient balance", () => {
            const userId = "user3";
            Balances.set(userId, {
                userId,
                balnce: { usd: toInternal(50) },
                decimal: 2
            });

            const orderDetails: Orderdetails = {
                userId,
                orderId: "order3",
                type: Type.LONG,
                asset: Asset.BTC_USDC,
                price: toInternal(100),
                margin: toInternal(100),  // More than available balance
                leverage: 1,
                slipage: 1
            };

            const priceData: PriceData = { 
                bid: toInternal(99), 
                ask: toInternal(100) 
            };

            const result = CreateOpenOrder(orderDetails, priceData);

            expect(result.success).toBe(false);
            expect(result.error).toBe("Insufficient funds");
        });

        test("should reject LONG order when slippage exceeded", () => {
            const userId = "user4";
            Balances.set(userId, {
                userId,
                balnce: { usd: toInternal(1000) },
                decimal: 2
            });

            const orderDetails: Orderdetails = {
                userId,
                orderId: "order4",
                type: Type.LONG,
                asset: Asset.BTC_USDC,
                price: toInternal(100),
                margin: toInternal(100),
                leverage: 1,
                slipage: 1  // 1% slippage, Max allowed: 101
            };

            const priceData: PriceData = {
                bid: toInternal(99),
                ask: toInternal(102)  // Exceeds slippage limit (100 + 1% = 101)
            };

            const result = CreateOpenOrder(orderDetails, priceData);

            expect(result.success).toBe(false);
            expect(result.error).toBe("Slippage hit");
        });

        test("should reject SHORT order when slippage exceeded", () => {
            const userId = "user5";
            Balances.set(userId, {
                userId,
                balnce: { usd: toInternal(1000) },
                decimal: 2
            });

            const orderDetails: Orderdetails = {
                userId,
                orderId: "order5",
                type: Type.SHORT,
                asset: Asset.BTC_USDC,
                price: toInternal(100),
                margin: toInternal(100),
                leverage: 1,
                slipage: 1  // 1% slippage, Min allowed: 99
            };

            const priceData: PriceData = {
                bid: toInternal(98),  // Below slippage limit (100 - 1% = 99)
                ask: toInternal(100)
            };

            const result = CreateOpenOrder(orderDetails, priceData);

            expect(result.success).toBe(false);
            expect(result.error).toBe("Slippage hit");
        });

        test("should handle 0.5% slippage correctly", () => {
            const userId = "user6";
            Balances.set(userId, {
                userId,
                balnce: { usd: toInternal(1000) },
                decimal: 2
            });

            const orderDetails: Orderdetails = {
                userId,
                orderId: "order6",
                type: Type.LONG,
                asset: Asset.BTC_USDC,
                price: toInternal(100),
                margin: toInternal(100),
                leverage: 1,
                slipage: 0.5  // 0.5% slippage
            };

            const priceData: PriceData = {
                bid: toInternal(99),
                ask: toInternal(100.4)  // Within 0.5% slippage (max 100.5)
            };

            const result = CreateOpenOrder(orderDetails, priceData);

            expect(result.success).toBe(true);
        });

        test("should default leverage to 1 if zero or negative", () => {
            const userId = "user7";
            Balances.set(userId, {
                userId,
                balnce: { usd: toInternal(1000) },
                decimal: 2
            });

            const orderDetails: Orderdetails = {
                userId,
                orderId: "order7",
                type: Type.LONG,
                asset: Asset.BTC_USDC,
                price: toInternal(100),
                margin: toInternal(100),
                leverage: 0,  // Should default to 1
                slipage: 1
            };

            const priceData: PriceData = { 
                bid: toInternal(99), 
                ask: toInternal(100) 
            };

            const result = CreateOpenOrder(orderDetails, priceData);

            expect(result.success).toBe(true);
            expect(result.data?.leverage).toBe(1);
        });

        test("should reject when user not found", () => {
            const orderDetails: Orderdetails = {
                userId: "nonexistent",
                orderId: "order8",
                type: Type.LONG,
                asset: Asset.BTC_USDC,
                price: toInternal(100),
                margin: toInternal(100),
                leverage: 1,
                slipage: 1
            };

            const priceData: PriceData = { 
                bid: toInternal(99), 
                ask: toInternal(100) 
            };

            const result = CreateOpenOrder(orderDetails, priceData);

            expect(result.success).toBe(false);
            expect(result.error).toBe("Balance not found");
        });

        test("should calculate position value correctly with leverage", () => {
            const userId = "user8";
            Balances.set(userId, {
                userId,
                balnce: { usd: toInternal(1000) },
                decimal: 2
            });

            const orderDetails: Orderdetails = {
                userId,
                orderId: "order8",
                type: Type.LONG,
                asset: Asset.BTC_USDC,
                price: toInternal(100),
                margin: toInternal(100),  // 100 USD margin
                leverage: 10,              // 10x leverage
                slipage: 1
            };

            const priceData: PriceData = { 
                bid: toInternal(99), 
                ask: toInternal(100) 
            };

            const result = CreateOpenOrder(orderDetails, priceData);

            expect(result.success).toBe(true);
            // Position value = 100 * 10 = 1000
            // Quantity = 1000 / 100 = 10
            expect(result.data?.quanity).toBeCloseTo(10, 2);
        });
    });

    describe("Callculatepnl", () => {
        test("should calculate LONG position PnL correctly (profit)", () => {
            const order = {
                userId: "user1",
                orderId: "order1",
                type: Type.LONG,
                asset: Asset.BTC_USDC,
                leverage: 10,
                margin: toInternal(100),
                quanity: 10,
                slipage: 1,
                price: toInternal(100),
                currentprice: toInternal(100)
            };

            const pnl = Callculatepnl(order, toInternal(110)); // Price increased by 10

            // (110 - 100) * 10 = 100 (in internal format = 10000)
            expect(pnl).toBe(toInternal(100));
        });

        test("should calculate LONG position PnL correctly (loss)", () => {
            const order = {
                userId: "user1",
                orderId: "order1",
                type: Type.LONG,
                asset: Asset.BTC_USDC,
                leverage: 10,
                margin: toInternal(100),
                quanity: 10,
                slipage: 1,
                price: toInternal(100),
                currentprice: toInternal(100)
            };

            const pnl = Callculatepnl(order, toInternal(90)); // Price decreased by 10

            // (90 - 100) * 10 = -100 (in internal format = -10000)
            expect(pnl).toBe(toInternal(-100));
        });

        test("should calculate SHORT position PnL correctly (profit)", () => {
            const order = {
                userId: "user1",
                orderId: "order1",
                type: Type.SHORT,
                asset: Asset.BTC_USDC,
                leverage: 10,
                margin: toInternal(100),
                quanity: 10,
                slipage: 1,
                price: toInternal(100),
                currentprice: toInternal(100)
            };

            const pnl = Callculatepnl(order, toInternal(90)); // Price decreased

            // (100 - 90) * 10 = 100 (in internal format = 10000)
            expect(pnl).toBe(toInternal(100));
        });

        test("should calculate SHORT position PnL correctly (loss)", () => {
            const order = {
                userId: "user1",
                orderId: "order1",
                type: Type.SHORT,
                asset: Asset.BTC_USDC,
                leverage: 10,
                margin: toInternal(100),
                quanity: 10,
                slipage: 1,
                price: toInternal(100),
                currentprice: toInternal(100)
            };

            const pnl = Callculatepnl(order, toInternal(110)); // Price increased

            // (100 - 110) * 10 = -100 (in internal format = -10000)
            expect(pnl).toBe(toInternal(-100));
        });
    });

    describe("ClosePosition", () => {
        test("should close LONG position with profit", () => {
            const userId = "user1";
            const asset = Asset.BTC_USDC;
            
            // Setup balance (after margin deduction)
            Balances.set(userId, {
                userId,
                balnce: { usd: toInternal(900) },
                decimal: 2
            });

            // Setup order
            const order = {
                userId,
                orderId: "order1",
                type: Type.LONG,
                asset,
                leverage: 10,
                margin: toInternal(100),
                quanity: 10,
                slipage: 1,
                price: toInternal(100),
                currentprice: toInternal(100)
            };
            OpenOrderDetails.set(asset, [order]);

            // Close at profit
            const result = ClosePosition("order1", toInternal(110), asset);

            expect(result.success).toBe(true);
            expect(result.message).toBe("Order closed successfully");
            expect(result.pnl).toBe(toInternal(100)); // (110 - 100) * 10

            // Check balance updated: 900 + 100 (margin) + 100 (pnl) = 1100
            const balance = Balances.get(userId);
            expect(balance?.balnce.usd).toBe(toInternal(1100));

            // Check order removed
            const orders = OpenOrderDetails.get(asset);
            expect(orders?.length).toBe(0);
        });

        test("should close SHORT position with loss", () => {
            const userId = "user2";
            const asset = Asset.ETH_USDC;
            
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
                currentprice: toInternal(50)
            };
            OpenOrderDetails.set(asset, [order]);

            const result = ClosePosition("order2", toInternal(60), asset);

            expect(result.success).toBe(true);
            expect(result.pnl).toBe(toInternal(-200)); // (50 - 60) * 20

            // Check balance: 800 + 200 (margin) - 200 (loss) = 800
            const balance = Balances.get(userId);
            expect(balance?.balnce.usd).toBe(toInternal(800));
        });

        test("should fail when order not found", () => {
            const result = ClosePosition("nonexistent", toInternal(100), Asset.BTC_USDC);

            expect(result.success).toBe(false);
            expect(result.error).toBe("Asset not found");
        });

        test("should fail when user not found", () => {
            const asset = Asset.BTC_USDC;
            const order = {
                userId: "ghost_user",
                orderId: "order1",
                type: Type.LONG,
                asset,
                leverage: 10,
                margin: toInternal(100),
                quanity: 10,
                slipage: 1,
                price: toInternal(100),
                currentprice: toInternal(100)
            };
            OpenOrderDetails.set(asset, [order]);

            const result = ClosePosition("order1", toInternal(110), asset);

            expect(result.success).toBe(false);
            expect(result.error).toBe("User not found");
        });
    });

    describe("LiquidatePosition", () => {
        test("should liquidate position successfully", () => {
            const asset = Asset.BTC_USDC;
            const order = {
                userId: "user1",
                orderId: "order1",
                type: Type.LONG,
                asset,
                leverage: 10,
                margin: toInternal(100),
                quanity: 10,
                slipage: 1,
                price: toInternal(100),
                currentprice: toInternal(100)
            };
            OpenOrderDetails.set(asset, [order]);

            const result = LiquidatePosition("order1", toInternal(90), asset);

            expect(result.success).toBe(true);
            expect(result.message).toBe("Position liquidated");
            expect(result.pnl).toBe(toInternal(-100));
            expect(result.userId).toBe("user1");
            expect(result.type).toBe("TRADE");

            // Check order removed
            const orders = OpenOrderDetails.get(asset);
            expect(orders?.length).toBe(0);
        });

        test("should fail when asset not found", () => {
            const result = LiquidatePosition("order1", toInternal(90), Asset.SOL_USDC);

            expect(result.success).toBe(false);
            expect(result.error).toBe("Order Not Found");
        });
    });

    describe("CheckPositionUpdates", () => {
        test("should liquidate when margin ratio exceeds allowed (90%)", async () => {
            const asset = Asset.BTC_USDC;
            const userId = "user1";
            
            const order = {
                userId,
                orderId: "order1",
                type: Type.LONG,
                asset,
                leverage: 10,
                margin: toInternal(100),
                quanity: 10,
                slipage: 1,
                price: toInternal(100),
                currentprice: toInternal(100)
            };
            OpenOrderDetails.set(asset, [order]);

            const priceData: PriceData = {
                bid: toInternal(91),  // Loss of -90, margin used = 90, ratio = 90/100 = 0.9 (triggers liquidation)
                ask: toInternal(92)
            };

            await CheckPositionUpdates(asset, priceData);

            // Order should be liquidated
            const orders = OpenOrderDetails.get(asset);
            expect(orders?.length).toBe(0);
        });

        test("should trigger stop loss for LONG position", async () => {
            const asset = Asset.BTC_USDC;
            const userId = "user1";
            
            Balances.set(userId, {
                userId,
                balnce: { usd: toInternal(900) },
                decimal: 2
            });

            const order = {
                userId,
                orderId: "order1",
                type: Type.LONG,
                asset,
                leverage: 10,
                margin: toInternal(100),
                quanity: 10,
                slipage: 1,
                price: toInternal(100),
                currentprice: toInternal(100),
                stoploss: toInternal(95)  // Stop loss at 95
            };
            OpenOrderDetails.set(asset, [order]);

            const priceData: PriceData = {
                bid: toInternal(94),  // Below stop loss
                ask: toInternal(95)
            };

            await CheckPositionUpdates(asset, priceData);

            // Order should be closed
            const orders = OpenOrderDetails.get(asset);
            expect(orders?.length).toBe(0);

            // Balance should be updated: 900 + 100 (margin) - 60 (loss) = 940
            const balance = Balances.get(userId);
            expect(balance?.balnce.usd).toBe(toInternal(940));
        });

        test("should trigger stop loss for SHORT position", async () => {
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
                stoploss: toInternal(55)  // Stop loss at 55
            };
            OpenOrderDetails.set(asset, [order]);

            const priceData: PriceData = {
                bid: toInternal(56),
                ask: toInternal(57)  // Above stop loss (uses ask for SHORT)
            };

            await CheckPositionUpdates(asset, priceData);

            const orders = OpenOrderDetails.get(asset);
            expect(orders?.length).toBe(0);
        });

        test("should trigger take profit for LONG position", async () => {
            const asset = Asset.BTC_USDC;
            const userId = "user1";
            
            Balances.set(userId, {
                userId,
                balnce: { usd: toInternal(900) },
                decimal: 2
            });

            const order = {
                userId,
                orderId: "order1",
                type: Type.LONG,
                asset,
                leverage: 10,
                margin: toInternal(100),
                quanity: 10,
                slipage: 1,
                price: toInternal(100),
                currentprice: toInternal(100),
                takeprofit: toInternal(110)  // Take profit at 110
            };
            OpenOrderDetails.set(asset, [order]);

            const priceData: PriceData = {
                bid: toInternal(111),  // Above take profit
                ask: toInternal(112)
            };

            await CheckPositionUpdates(asset, priceData);

            const orders = OpenOrderDetails.get(asset);
            expect(orders?.length).toBe(0);

            // Balance: 900 + 100 (margin) + 110 (profit) = 1110
            const balance = Balances.get(userId);
            expect(balance?.balnce.usd).toBe(toInternal(1110));
        });

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

            // Balance: 800 + 200 (margin) + 120 (profit: (50-44)*20) = 1120
            const balance = Balances.get(userId);
            expect(balance?.balnce.usd).toBe(toInternal(1100));
        });

        test("should not trigger anything when conditions not met", async () => {
            const asset = Asset.BTC_USDC;
            
            const order = {
                userId: "user1",
                orderId: "order1",
                type: Type.LONG,
                asset,
                leverage: 10,
                margin: toInternal(100),
                quanity: 10,
                slipage: 1,
                price: toInternal(100),
                currentprice: toInternal(100),
                stoploss: toInternal(95),
                takeprofit: toInternal(110)
            };
            OpenOrderDetails.set(asset, [order]);

            const priceData: PriceData = {
                bid: toInternal(102),  // Between stop loss and take profit
                ask: toInternal(103)
            };

            await CheckPositionUpdates(asset, priceData);

            // Order should still exist
            const orders = OpenOrderDetails.get(asset);
            expect(orders?.length).toBe(1);
        });

        test("should handle multiple orders for same asset", async () => {
            const asset = Asset.BTC_USDC;
            
            Balances.set("user1", { 
                userId: "user1", 
                balnce: { usd: toInternal(900) }, 
                decimal: 2 
            });
            Balances.set("user2", { 
                userId: "user2", 
                balnce: { usd: toInternal(900) }, 
                decimal: 2 
            });

            const order1 = {
                userId: "user1",
                orderId: "order1",
                type: Type.LONG,
                asset,
                leverage: 10,
                margin: toInternal(100),
                quanity: 10,
                slipage: 1,
                price: toInternal(100),
                currentprice: toInternal(100),
                stoploss: toInternal(95)
            };

            const order2 = {
                userId: "user2",
                orderId: "order2",
                type: Type.LONG,
                asset,
                leverage: 10,
                margin: toInternal(100),
                quanity: 10,
                slipage: 1,
                price: toInternal(100),
                currentprice: toInternal(100),
                takeprofit: toInternal(110)
            };

            OpenOrderDetails.set(asset, [order1, order2]);

            const priceData: PriceData = {
                bid: toInternal(111),  // Triggers order2's take profit
                ask: toInternal(112)
            };

            await CheckPositionUpdates(asset, priceData);

            // Only order1 should remain
            const orders = OpenOrderDetails.get(asset);
            expect(orders?.length).toBe(1);
            expect(orders?.[0]?.orderId).toBe("order1");
        });
    });

    describe("GetAllOpenTrades", () => {
        test("should return all orders for a user across multiple assets", () => {
            const userId = "user1";
            
            const btcOrder = {
                userId,
                orderId: "order1",
                type: Type.LONG,
                asset: Asset.BTC_USDC,
                leverage: 10,
                margin: toInternal(100),
                quanity: 10,
                slipage: 1,
                price: toInternal(100),
                currentprice: toInternal(100)
            };

            const ethOrder = {
                userId,
                orderId: "order2",
                type: Type.SHORT,
                asset: Asset.ETH_USDC,
                leverage: 5,
                margin: toInternal(200),
                quanity: 20,
                slipage: 1,
                price: toInternal(50),
                currentprice: toInternal(50)
            };

            OpenOrderDetails.set(Asset.BTC_USDC, [btcOrder]);
            OpenOrderDetails.set(Asset.ETH_USDC, [ethOrder]);

            const result = GetAllOpenTrades(userId);

            expect(result.success).toBe(true);
            expect(result.data.length).toBe(2);
            expect(result.data.find((o: { orderId: string; }) => o.orderId === "order1")).toBeDefined();
            expect(result.data.find((o: { orderId: string; }) => o.orderId === "order2")).toBeDefined();
        });

        test("should return only user's orders when multiple users have orders", () => {
            const order1 = {
                userId: "user1",
                orderId: "order1",
                type: Type.LONG,
                asset: Asset.BTC_USDC,
                leverage: 10,
                margin: toInternal(100),
                quanity: 10,
                slipage: 1,
                price: toInternal(100),
                currentprice: toInternal(100)
            };

            const order2 = {
                userId: "user2",
                orderId: "order2",
                type: Type.SHORT,
                asset: Asset.BTC_USDC,
                leverage: 5,
                margin: toInternal(200),
                quanity: 20,
                slipage: 1,
                price: toInternal(100),
                currentprice: toInternal(100)
            };

            OpenOrderDetails.set(Asset.BTC_USDC, [order1, order2]);

            const result = GetAllOpenTrades("user1");

            expect(result.success).toBe(true);
            expect(result.data.length).toBe(1);
            //@ts-ignore
            expect(result.data[0].orderId).toBe("order1");
        });

        test("should return empty array when user has no orders", () => {
            const result = GetAllOpenTrades("nonexistent");

            expect(result.success).toBe(true);
            expect(result.data.length).toBe(0);
        });
    });

    describe("Edge Cases and Decimal Handling", () => {
        test("should handle fractional USD amounts correctly", () => {
            const userId = "user1";
            Balances.set(userId, {
                userId,
                balnce: { usd: toInternal(99.99) },  // 9999 internal
                decimal: 2
            });

            const orderDetails: Orderdetails = {
                userId,
                orderId: "order1",
                type: Type.LONG,
                asset: Asset.BTC_USDC,
                price: toInternal(50.50),
                margin: toInternal(50.50),
                leverage: 1,
                slipage: 1
            };

            const priceData: PriceData = { 
                bid: toInternal(50), 
                ask: toInternal(50.50) 
            };

            const result = CreateOpenOrder(orderDetails, priceData);

            expect(result.success).toBe(true);
            
            const balance = Balances.get(userId);
            expect(balance?.balnce.usd).toBe(toInternal(49.49)); // 99.99 - 50.50
        });

        test("should handle very small price movements", () => {
            const order = {
                userId: "user1",
                orderId: "order1",
                type: Type.LONG,
                asset: Asset.BTC_USDC,
                leverage: 100,  // High leverage
                margin: toInternal(100),
                quanity: 1000,
                slipage: 1,
                price: toInternal(100),
                currentprice: toInternal(100)
            };

            const pnl = Callculatepnl(order, toInternal(100.01)); // 0.01 USD increase

            expect(pnl).toBe(toInternal(10)); // (100.01 - 100) * 1000
        });
        
    });
});