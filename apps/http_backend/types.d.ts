import { JwtPayload } from "jsonwebtoken"
declare global{
    namespace Express{
        interface Request{
            user?:{
                id:string
            }
        }
    }
}

export interface custompayload extends JwtPayload{
    email?:string ;
}



