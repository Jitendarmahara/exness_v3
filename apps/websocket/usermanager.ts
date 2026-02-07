import { SubscriptionManager } from "./subscription";
import { User } from "./user";
import { WebSocket } from "ws";

export class UserManager{
    private user:Map<string , User> = new Map(); // user id to there Userobject
    private static instance : UserManager;
    public static getInstance(){
        if(!this.instance){
            this.instance = new UserManager();
        }
        return this.instance
    }
    public adduser(userId:string , ws:WebSocket){
        const user = new User(userId  , ws)
        if(!this.user.get(userId)){
            this.user.set(userId , user)
        }
    }

    public getUser(id:string){
        return this.user.get(id);
    }

    public regestrationonclose(ws:WebSocket , id:string){
        ws.on("close" , ()=>{
            SubscriptionManager.getInstance().UserLeft(id)
        })
    }
}