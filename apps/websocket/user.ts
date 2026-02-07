import { WebSocket } from "ws";
import { SubscriptionManager } from "./subscription";
export class User{
    private id:string;
    private ws : WebSocket;

    constructor (id:string , ws:WebSocket){
        this.id = id;
        this.ws = ws;
        this.addlistner(ws);
    }

    private addlistner(ws:WebSocket){
        ws.on("message" , (data)=>{
            const parse_data = JSON.parse(data.toString());
            console.log(parse_data);
            if(parse_data.type === "SUBSCRIBE"){
                
                SubscriptionManager.getInstance().Subscrib(this.id , parse_data.room)
            }
            if(parse_data.type === "UNSUBSCRIBE"){
                SubscriptionManager.getInstance().Unsubscribe(this.id , parse_data.room)
            }
        })
    }

    public emit(message:any){
        console.log(message);
        this.ws.send(JSON.stringify(message))
    }
}