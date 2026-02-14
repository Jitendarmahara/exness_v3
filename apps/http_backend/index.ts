import express from "express"
import cors from 'cors'
import { Userrouter } from "./route/user";
import { Orderrouter } from "./route/order";
const app = express();
app.use(express.json());
app.use(cors());


app.use("/api/v1" , Userrouter);
app.use("/api/v1/position" , Orderrouter)


const server = app.listen(3000 , ()=>{
    console.log("server started on port 3000")
})

server.on("error" , (err)=>{
    console.log("problem while starting the server" , err)
})