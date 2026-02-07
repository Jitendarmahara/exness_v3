export interface Order {
    orderId:string
    userId:string
    type: Type
    asset: Asset
    price: number  // at what price the user send the request to bought it// basically to check does the request has crossed the slippage or not;
    quanity:number
    currentprice:number
    margin: number   // the decimal points is also 2 it menas if 50000 it will be 500$
    leverage: number
    stoploss?:number
    takeprofit?:number
    slipage: number , // this will be bipss is 100 it means 1%// not implemented
}
export type Decimal = 2;
export enum Type {
    LONG =  "LONG",
    SHORT = "SHORT"
}
export enum Asset{
    SOL_USDC = "SOL_USDC",
    BTC_USDC = "BTC_USDC",
    ETH_USDC = "ETH_USDC"
}
export enum Status{
    OPEN = "OPEN",
    CLOSED = "CLOSED"
}
interface Balance{
    userId:string
    balnce : {
        usd: number
    }
    decimal: Decimal
}
export let OpenOrderDetails:Map<string , Order[]> = new Map(); // userId to  there all Orders

export let Balances:Map<string , Balance> = new Map();

// before pushing any fo the balance into the object we do have to multiply wiht the decimal mens 100 if 2 ; 

