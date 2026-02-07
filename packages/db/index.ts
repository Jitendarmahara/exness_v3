// this should export priam and the sql connection to the 
import dotenv from "dotenv";
import path from "path"
import postgres from "postgres";
import { PrismaClient } from "./generated/prisma/client.js"
import { PrismaPg } from "@prisma/adapter-pg";
import {Pool} from "pg"
dotenv.config({path:path.resolve(__dirname , ("../../.env"))});

export const sql = postgres(process.env.DATABASE_URL!, {
    max:10
});

// i also need to send the prisma also for the user/trade/asset tables

const pool = new Pool({
    connectionString: process.env.DATABASE_URL!
})
const adapter = new PrismaPg(pool);
export const client = new PrismaClient({adapter})
