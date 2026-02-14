import type { RedisClientType } from "@redis/client";
import { Balances, OpenOrderDetails, Status, Type, type Asset, type Order } from "../state";
import { createClient } from "redis";

const redis = createClient();
const AllowedMargin = 0.9;

connectredis(redis);

export interface Orderdetails {
    userId: string,
    orderId: string,
    type: Type,
    asset: Asset,
    price: number,
    margin: number,
    leverage: number,
    stoploss?: number,
    takeprofit?: number,
    slipage: number,
}

export interface PriceData {
    bid: number,
    ask: number
}

export function CreateOpenOrder(details: Orderdetails, Price: PriceData) {
    const balance = Balances.get(details.userId);
    if (!balance) {
        return {
            success: false,
            error: "Balance not found"
        }
    }
    
    if (balance.balnce.usd < details.margin) {  
        return {
            success: false,
            error: "Insufficient funds"
        }
    }
    
    const currentprice = details.type === Type.LONG ? Price.ask : Price.bid;
    

    const slipageprice = details.price * (details.slipage / 100);
  
    if (details.type === Type.LONG) {
        const maxallowed = details.price + slipageprice;
        if (currentprice > maxallowed) {
            return {
                success: false,
                error: "Slippage hit"
            }
        }
    }
    
    if (details.type === Type.SHORT) {
        const minallowed = details.price - slipageprice;
        if (currentprice < minallowed) {
            return {
                success: false,  
                error: 'Slippage hit'
            }
        }
    }
    
    const margin = details.margin;
    let leverage;
    if (details.leverage <= 0) {
        leverage = 1;
    } else {
        leverage = details.leverage;
    }
    
    const positionvalue = margin * leverage;
    const quantity = positionvalue / currentprice;
    
    const order: Order = {
        userId: details.userId,
        orderId: details.orderId,  
        type: details.type,
        asset: details.asset,
        leverage,
        margin,
        quanity: quantity,
        slipage: details.slipage,
        price: details.price,
        currentprice,
        stoploss: details.stoploss,
        takeprofit: details.takeprofit,
    }
    
    balance.balnce.usd -= details.margin;  
    Balances.set(details.userId, balance);

    if (!OpenOrderDetails.get(details.asset)) {
        OpenOrderDetails.set(details.asset, []);
    }
    OpenOrderDetails.get(details.asset)?.push(order);
    
    return {
        success: true,
        data: order,
        error: null
    }
}

export function Callculatepnl(order: Order, currentprice: number) {
    if (order.type === Type.LONG) {
        return (currentprice - order.currentprice) * order.quanity;
    }
    return (order.currentprice - currentprice) * order.quanity;
}

export function LiquidatePosition(orderId: string, currentprice: number, asset: string) {
    const userorder = OpenOrderDetails.get(asset);
    if (!userorder) {
        return {
            success: false,
            error: "Order Not Found"
        }
    }
    
    const orderindex = userorder.findIndex(x => x.orderId === orderId);
    if (orderindex === -1) {
        return {
            success: false,
            error: "Order not found"
        }
    }
    
    const order = userorder[orderindex];
    if (!order) {
        return {
            success: false,
            error: "Order not found"
        }
    }
    
    const pnl = Callculatepnl(order, currentprice);
    userorder.splice(orderindex, 1);
    OpenOrderDetails.set(asset, userorder);  

    return {
        success: true,
        message: "Position liquidated",
        pnl,
        userId: order.userId,
        currentprice,
        price: order.price,
        type: "TRADE"
    }
}

export function ClosePosition(orderId: string, currentprice: number, asset: string) {
    const userorder = OpenOrderDetails.get(asset);
    if (!userorder) {
        return {
            success: false,
            error: "Asset not found"
        }
    }
    
    const ordeindex = userorder.findIndex(x => x.orderId === orderId);
    if (ordeindex === -1) {
        return {
            success: false,
            error: "Order not found"
        }
    }
    
    const order = userorder[ordeindex];
    if (!order) {
        return {
            success: false,
            error: "Order not found"
        }
    }
    
    const userId = order.userId;
    const pnl = Callculatepnl(order, currentprice);
    const balance = Balances.get(userId);
    
    if (!balance) {
        return {
            success: false,
            error: "User not found"
        }
    }
    
    balance.balnce.usd += order.margin + pnl;  
    Balances.set(userId, balance);
    
    userorder.splice(ordeindex, 1);
    OpenOrderDetails.set(asset, userorder); 
    
    return {
        success: true,
        message: "Order closed successfully",
        pnl,
        userId: order.userId,
        price: order.price,
        currentprice
    }
}

export async function CheckPositionUpdates(asset: string, currentprice: PriceData) {
    const all_orders = OpenOrderDetails.get(asset);
    if (!all_orders) {
        return;
    }
    
    for (const x of all_orders) {
        const userId = x.userId;
        const price = x.type === Type.LONG ? currentprice.bid : currentprice.ask;
        const pnl = Callculatepnl(x, price);
        const marginused = Math.max(0, -pnl);
        const marginratio = marginused / x.margin;
        
        if (marginratio >= AllowedMargin) {
            const res = LiquidatePosition(x.orderId, price, x.asset);  
            await redis.publish(x.asset, JSON.stringify(res));  
            continue;
        }

        if (x.stoploss !== undefined) {
            const stoploss = (x.type === Type.LONG && price <= x.stoploss || 
                             x.type === Type.SHORT && price >= x.stoploss);
            if (stoploss) {
                const res = ClosePosition(x.orderId, price, x.asset);  
                await redis.publish(x.asset, JSON.stringify(res));  
                continue;
            }
        }

        if (x.takeprofit !== undefined) {
            const takeprofit = (x.type === Type.LONG && price >= x.takeprofit || 
                               x.type === Type.SHORT && price <= x.takeprofit);
            if (takeprofit) { 
                const res = ClosePosition(x.orderId, price, x.asset);  
                await redis.publish(x.asset, JSON.stringify(res)); 
                continue;
            }
        }
    }
}
export function GetAllOpenTrades(userId: string) {
    const allOrders: Order[] = [];
    
    for (const [asset, orders] of OpenOrderDetails.entries()) {
        const userOrders = orders.filter(order => order.userId === userId);
        allOrders.push(...userOrders);
    }
    
    return {
        success: true,
        data: allOrders
    }
}

async function connectredis(redis: ReturnType<typeof createClient>) {
    await redis.connect();
}
// get all the closed trades can be dirvely taken form the dtabse no need to put it 


