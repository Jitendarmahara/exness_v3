import { WebSocketServer } from "ws";
import { UserManager } from "./usermanager";
import { parse } from "url";
import dotenv from "dotenv";
import path from "path";
import type { modifiedpayload } from "./types";

dotenv.config({ path: path.resolve(__dirname, "../../.env") });
console.log(path.resolve(__dirname, "../../.env"));
console.log(path.resolve(__dirname));

const wss = new WebSocketServer({ port: 8080 });
import Jwt from "jsonwebtoken";

wss.on("connection", (ws, req) => {
    try {
        const { query } = parse(req.url || "", true);
        const token = query.token as string;
        if (!token) {
            console.log("Connection rejectedNo token provided");
            ws.send(JSON.stringify({ 
                type:"MESSAGE",
                error: "Authentication failed", 
                message: "Token is required" 
            }));
            ws.close(1008, "Authentication token required");
            return;
        }


        let payload: modifiedpayload;
        try {
            payload = verifytoken(token);
        } catch (error) {
            console.log("Connection rejected: Invalid token");
            ws.send(JSON.stringify({ 
                type:"MESSAGE",
                error: "Authentication failed", 
                message: "Invalid or expired token" 
            }));
            ws.close(1008, "Invalid token");
            return;
        }
        if (!payload.id) {
            console.log("Connection rejected: No user ID in token");
            ws.send(JSON.stringify({ 
                type:"MESSAGE",
                error: "Authentication failed", 
                message: "Invalid token payload" 
            }));
            ws.close(1008, "Invalid token payload");
            return;
        }

        const id = payload.id;
        console.log(`User ${id} connected successfully`);
        UserManager.getInstance().adduser(id, ws);

        ws.send(JSON.stringify({ 
            success: true, 
            message: "Connected successfully" 
        }));

        ws.on("close", () => {
            console.log(`User ${id} disconnected`);
            UserManager.getInstance().regestrationonclose(ws , id);
        });
        ws.on("error", (error) => {
            console.error(`WebSocket error for user ${id}:`, error);
        });

    } catch (error) {
        console.error("Connection error:", error);
        ws.send(JSON.stringify({ 
            error: "Server error", 
            message: "Internal server error" 
        }));
        ws.close(1011, "Internal server error");
    }
});

const verifytoken = (token: string): modifiedpayload => {
     console.log(process.env.JWT_SECRET);
    if (!process.env.JWT_SECRET) {
        throw new Error("JWT_SECRET not configured");
    }
    const res = Jwt.verify(token, process.env.JWT_SECRET) as modifiedpayload;
    return res;
};

wss.on("error", (error) => {
    console.error("WebSocket server error:", error);
});

console.log("WebSocket server running on port 8080");