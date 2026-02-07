import {client , sql} from "db/client"
import {createClient, type RedisClientType} from "redis"

import { WebSocket } from "ws"
const ws = new WebSocket("wss://ws.backpack.exchange/");
const markt = ["SOL_USDC" , "BTC_USDC" , "ETH_USDC"]
let globalId = 1;
async function WebsocketManager() {
    const redis = await redismanager();
    ws.on("open" , ()=>{
        markt.forEach((x) => {
            ws.send(JSON.stringify({
                method : "SUBSCRIBE",
                params : [`bookTicker.${x}`],
                id: globalId++
            }))

            console.log(`connected to ${x} this market`)
        });
    })
    // this pushse to the redis queue;
    ws.on("message" , (data)=>{
        const parse_data = JSON.parse(data.toString());
        console.log(parse_data);
        redis.lPush("@KlineData" , JSON.stringify(parse_data))
    })


    ws.on('close' , ()=>{
        setTimeout(WebsocketManager , 5000)
    })

    ws.on("error" , (e)=>{
        console.log("error while connecting to the exxhange" , e);
    })
}

async function redismanager(){
    const redis = createClient();
    await redis.connect();
    return redis;
}

WebsocketManager();



