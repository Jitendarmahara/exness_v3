import postgres from "postgres"
import {readFileSync} from "fs"
import dotenv from "dotenv"
import path from "path";
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const database_url = process.env.DATABASE_URL!;

async function DBSETUP() {
    const sql = postgres(database_url);
    console.log(database_url);
    try{
        const schema  = readFileSync('./schema.sql' , 'utf-8');
        await sql.unsafe(schema);
        console.log("completed")
    }catch(e){
        console.log("error while updating te db" , e)
    }
}

DBSETUP();