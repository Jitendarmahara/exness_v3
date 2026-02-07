import { WebSocketServer } from "ws";
import { UserManager } from "./usermanager";
const wss = new WebSocketServer({port:8080});
// her is have to also fetach the user id oof the user from the token ;
// we will verify the token over her let se fo test just generatin ranom uudi;

wss.on("connection" , (ws)=>{
    const id  = Math.random().toString(32).substring(2 , 15);
    UserManager.getInstance().adduser(id , ws)
})