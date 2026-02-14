import { createClient } from "redis";
import { CheckPositionUpdates, ClosePosition, CreateOpenOrder, GetAllOpenTrades, type Orderdetails, type PriceData } from "./helper/process";
import { Kafka } from "kafkajs";
import { Type } from "./state";

const redis = createClient();
const redispublisher = createClient();
const redisresponsepublisher = createClient();

const kafka = new Kafka({
    clientId: 'engine-trading',
    brokers: ["localhost:9092"]
})

const consumer = kafka.consumer({
    groupId: 'order-engine'
})

const Price = {
    "SOL_USDC": {bid: 0, ask: 0},
    "BTC_USDC": {bid: 0, ask: 0},
    "ETH_USDC": {bid: 0, ask: 0}
}

const redismessagequeue = async () => {
    await redis.connect();
    await redispublisher.connect();
    
    while(true){
        try {
            const res = await redis.brPop("PriceData", 0);
            const parse_data = JSON.parse(res?.element!);
            console.log(parse_data);
            
            const market = parse_data.PriceHistory.market;
            const priceData = {
                bid: parse_data.PriceHistory.b,
                ask: parse_data.PriceHistory.a
            };
            
            if(market === "SOL_USDC"){
                Price.SOL_USDC = priceData;
                await redispublisher.publish(market, JSON.stringify(parse_data));
                console.log("published to", market);
                CheckPositionUpdates(market, Price.SOL_USDC);
            }
            else if(market === "BTC_USDC"){
                Price.BTC_USDC = priceData;
                await redispublisher.publish(market, JSON.stringify(parse_data));
                console.log("published to", market);
                CheckPositionUpdates(market, Price.BTC_USDC);
            }
            else if(market === "ETH_USDC"){
                Price.ETH_USDC = priceData;
                await redispublisher.publish(market, JSON.stringify(parse_data));
                console.log("published to", market);
                CheckPositionUpdates(market, Price.ETH_USDC);
            }
        } catch(e) {
            console.error("Error in redismessagequeue:", e);
        }
    }
}

const kafkaMessage = async () => {
    await redisresponsepublisher.connect();
    await consumer.connect();
    await consumer.subscribe({
        topic: 'order-request',
        fromBeginning: false
    })

    await consumer.run({
        eachMessage: async({topic, partition, message}) => {
            try{
                const request = JSON.parse(message.value?.toString()!);
                const {responsechannel, order} = request;
                const action  = order.action;
                
                let price: PriceData | undefined;
                if(order.asset === "SOL_USDC"){
                    price = Price.SOL_USDC;
                } else if(order.asset === "BTC_USDC"){
                    price = Price.BTC_USDC;
                } else if(order.asset === "ETH_USDC"){
                    price = Price.ETH_USDC;
                }
                
                if(!price || (price.bid === 0 && price.ask === 0)){
                    const errorResponse = { success: false, error: "Price not available" };
                    await redisresponsepublisher.publish(responsechannel, JSON.stringify(errorResponse));
                    
                    await consumer.commitOffsets([{
                        topic,
                        partition,
                        offset: (Number(message.offset) + 1).toString()
                    }]);
                    return;
                }
                
                let response;
                switch(action){
                    case "OPEN_POSITION":
                        const orderresponse: Orderdetails = {
                            userId: order.userId,
                            orderId: order.orderId,
                            type: order.type,
                            asset: order.asset,
                            margin: order.margin,
                            stoploss: order.stoploss,
                            takeprofit: order.takeprofit,
                            leverage: order.leverage,
                            price: order.price,
                            slipage: order.slipage
                        }
                        response = CreateOpenOrder(orderresponse, price);
                        break;
                        
                    case "CLOSE_POSITION":
                        const assetprice = order.type === Type.LONG ? price.bid : price.ask;
                        response = ClosePosition(order.orderId, assetprice, order.userId);
                        break;
                    
                    case "ALL_POSITION":
                        response = GetAllOpenTrades(order.userId)
                        break;
                    default:
                        response = { success: false, error: "Unknown action" };
                }
                
          
                if(response){
                    await redisresponsepublisher.publish(responsechannel, JSON.stringify(response));
                }
                
                // only comit offste successful publish
                await consumer.commitOffsets([{
                    topic,
                    partition,
                    offset: (Number(message.offset) + 1).toString()
                }]);
                
            }
            catch(e){
                console.error("Kafka message error:", e);
            }
        }
    })
}

// Start both processes
redismessagequeue();
kafkaMessage();