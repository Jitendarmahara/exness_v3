import {type JwtPayload } from "jsonwebtoken"
export interface modifiedpayload extends JwtPayload{
    id:string,
    email:string
}