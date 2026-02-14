// Fixed HTTP Backend Router
import { createClient } from "redis";
import { Kafka } from "kafkajs";
import { Router, type Request, type Response } from "express";
import { requireAuth } from "./user";

const router = Router();
const redisSubscriber = createClient();
const redisPublisher = createClient();

const kafka = new Kafka({
    clientId: "trading_backend",
    brokers: ["localhost:9092"]
})

const producer = kafka.producer();

async function init() {
    await redisSubscriber.connect();
    await redisPublisher.connect();
    await producer.connect();
    console.log("connected to redis and kafka");
}

init().catch(console.error);

function SendandAwait(order: any, timeoutMs: number = 10000) {
    const requestId = Math.random().toString(32).substring(2, 15);

    return new Promise(async (resolve, reject) => {
        let isResolved = false;
        const channelname = `response:${requestId}`;

        const timeout = setTimeout(() => {
            if (!isResolved) {
                isResolved = true;
                redisSubscriber.unsubscribe(channelname);
                reject(new Error("Request timeout"));
            }
        }, timeoutMs);

        await redisSubscriber.subscribe(channelname, (message) => {
            if (isResolved) return;
            isResolved = true;
            clearTimeout(timeout);
            redisSubscriber.unsubscribe(channelname);
            
            try {
                const response = JSON.parse(message);
                if (response.success) {
                    resolve(response.data);
                } else {
                    reject(new Error(response.error));
                }
            } catch (e) {
                reject(new Error("Failed to parse the message"));
            }
        });

        
        try {
            await producer.send({
                topic: "order-request", 
                messages: [{
                    key: requestId,
                    value: JSON.stringify({
                        requestId,
                        responsechannel: channelname,
                        order 
                    })
                }]
            });
        } catch (e) {
            clearTimeout(timeout);
            redisSubscriber.unsubscribe(channelname);
            reject(e);
        }
    });
}

const ALLOWED_LEVERAGE = [1, 2, 5, 10, 25, 50, 100, 200, 500];


router.post("/open", requireAuth ,  async (req: Request, res: Response) => {
    const userId = req.user?.id; 
    const orderId = Math.random().toString(32).substring(2, 10);
    const { margin, slipage, price, takeprofit, stoploss, asset, type, leverage } = req.body;


    if (!margin || !slipage || !price || !asset || !type) {
        return res.status(400).json({
            success: false,
            error: "Invalid Schema - missing required fields"
        });
    }

    if (!ALLOWED_LEVERAGE.includes(Number(leverage))) {
        return res.status(400).json({
            success: false,
            error: "Invalid leverage value"
        });
    }

    try {
        const result = await SendandAwait({
            action: "OPEN_POSITION",
            userId,
            orderId,
            type,
            asset,
            margin: Number(margin),
            price: Number(price),
            leverage: Number(leverage),
            slipage: Number(slipage),
            stoploss: stoploss ? Number(stoploss) : undefined,
            takeprofit: takeprofit ? Number(takeprofit) : undefined
        }, 10000);

        return res.status(201).json({
            success: true,
            position: result,
            message: "Position opened successfully"
        });
    } catch (e) {
        return res.status(400).json({
            success: false,
            message: "Failed to open the position",
            error: e instanceof Error ? e.message : "Unknown error"
        });
    }
});


router.post("/close/:orderId/:asset", requireAuth , async (req: Request, res: Response) => {
    const { orderId, asset } = req.params;
    const userId =req.user?.id 

    if (!orderId || typeof orderId !== "string") {
        return res.status(400).json({
            success: false,
            message: "Invalid orderId"
        });
    }

    if (!asset || typeof asset !== "string") {
        return res.status(400).json({
            success: false,
            message: "Invalid asset"
        });
    }

    try {
        const result = await SendandAwait({
            action: "CLOSE_POSITION",
            orderId,
            userId, 
            type: null,
            asset
        }, 10000);

        return res.status(200).json({
            success: true,
            message: "Position closed successfully",
            position: result
        });
    } catch (e) {
        return res.status(400).json({
            success: false,
            message: "Failed to close the position",
            error: e instanceof Error ? e.message : "Unknown error"
        });
    }
});


router.get("/:userId", requireAuth ,  async (req: Request, res: Response) => {
    const { userId } = req.params;

    if (!userId || typeof userId !== "string") {
        return res.status(400).json({
            success: false,
            message: "Invalid userId"
        });
    }

    try {
        const result = await SendandAwait({
            action: "ALL_POSITION",
            userId
        }, 10000);

        return res.status(200).json({
            success: true,
            message: "Positions retrieved successfully",
            positions: result
        });
    } catch (e) {
        return res.status(400).json({
            success: false,
            message: "Failed to retrieve positions",
            error: e instanceof Error ? e.message : "Unknown error"
        });
    }
});

export default router;
export { router as Orderrouter };