import { createClient, type RedisClientType } from "redis";
import {sql} from "db/client"

const redis = createClient();
const redisproducer = createClient();
interface PriceData{
    bid: number,
    ask: number,
    market:string,
    type: string
}

let PriceHistory:PriceData = {
    bid:0,
    ask:0,
    market: "",
    type: ""
}
async function Start() {
    try{

        await redis.connect();
        await redisproducer.connect();

        Poller();

        StartPublisher()



    }
    catch(e){
        console.log("error while startup")
    }
}

async function Poller() {
    while(true){

        try{
            const data = await redis.brPop("@KlineData" , 0); // This queue data comes from the serve;
            if(data){
                const  parsed_data = JSON.parse(data.element);
                PriceHistory = {
                    bid: parsed_data.data.b,
                    ask: parsed_data.data. a,
                    market: parsed_data.data. s,
                    type: "Price"
                }
                await sql`
                INSERT INTO ticks(price , market ,timestamp )
                VALUES(${parsed_data.data.a} , ${parsed_data.data.s} , ${new Date(Math.floor(parsed_data.data.T / 1000))} )
                `
                console.log("ticks updated")
            }
            else{
                console.log("no data found")
            }
        }
        catch(e){
            console.log("error whiel running the poller" , e);
        }
    }
}

function StartPublisher() {
    setInterval( async ()=>{
        try{
            await redisproducer.lPush("PriceData" , JSON.stringify({ // this is pushing to the engie queue;
                PriceHistory
            }))
        }catch(e){
            console.log("erro while pushing to the queue" , e)
        }
    } , 100)
}    

Start();
