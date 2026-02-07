import { createClient ,  type RedisClientType } from "redis";
import { UserManager } from "./usermanager";
export class SubscriptionManager{
    private static instance:SubscriptionManager;
    private subscriptions:Map<string , string[]> = new Map(); // this is user to room;
    private reversesubscriptions: Map<string , string[]> = new Map(); // this is room to user;
    redisclient:RedisClientType;

    constructor(){
        this.redisclient = createClient();
        this.redisclient.connect();
    }

    public static getInstance(){
        if(!this.instance){       // if this instance is not initialized t
            this.instance = new SubscriptionManager();
        }
        return this.instance;
    }

    public Subscrib(id:string , room:string){
        if(!this.subscriptions.get(id)){
            this.subscriptions.set(id , []);
        }
        if(! this.subscriptions.get(id)?.includes(room)){
            this.subscriptions.get(id)?.push(room)
        }
        console.log(this.subscriptions);
        if(!this.reversesubscriptions.get(room)){
            this.reversesubscriptions.set(room , []);
        }
        if(!this.reversesubscriptions.get(room)?.includes(id)){
            this.reversesubscriptions.get(room)?.push(id);
        }
        console.log(this.reversesubscriptions);
        if(this.reversesubscriptions.get(room)?.length === 1){
            this.redisclient.subscribe(room , this.rediscallback.bind(this))
        }
    }

    public rediscallback(message:string , channel:string){
        // this message will have the user

        console.log("hi i am getting called ")
        console.log(message);
        console.log(channel);
        const parsed_message = JSON.parse(message);
        if(parsed_message.parse_data.PriceHistory.type === "TRADE"){
            const parsed_message = JSON.parse(message);
            const userId = parsed_message.userId;
            // get the socket of this user and send the message;
            UserManager.getInstance().getUser(userId)?.emit(message)
        }else{
            console.log(parsed_message);
            this.reversesubscriptions.get(channel)?.forEach(x => UserManager.getInstance().getUser(x)?.emit(parsed_message.parse_data))
        }
    }


    public Unsubscribe(id:string , room:string){
        const unsubuser = this.subscriptions.get(id);
        if(unsubuser){
            this.subscriptions.set(id , unsubuser.filter(x => x !== room))
        }

        const unsubroom = this.reversesubscriptions.get(room);
        if(unsubroom){
            this.reversesubscriptions.set(room , unsubroom.filter(x => x!== id))
        }

        if(this.reversesubscriptions.get(room)?.length === 0){
            this.reversesubscriptions.delete(room);
            this.redisclient.unsubscribe(room).catch(console.error);
        }
    }

    public UserLeft(id :string){
        this.subscriptions.get(id)?.forEach(x => this.Unsubscribe(id , x))
    }

    public getSubscriptions(id:string){ // return all the room that user is subscribed;
        return this.subscriptions.get(id)
    }
}
