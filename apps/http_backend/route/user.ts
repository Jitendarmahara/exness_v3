import { Router, type Request, type Response } from "express";
import jwt from "jsonwebtoken";
import { Resend } from "resend";
import {client} from "db/client";
import type { custompayload } from "../types";
import dotenv from "dotenv";
import path from "path"

dotenv.config({path:path.resolve(__dirname , "../../.env")});
console.log(path.resolve(__dirname , "../../.env"));
console.log(path.resolve(__dirname ));
const router = Router();
const resend = new Resend(process.env.RESEND_API_KEY!)

router.post("/signup", async (req: Request, res: Response) => {
    const {email} = req.body;
    
    const response = await client.user.findUnique({
        where: {
            email
        }
    })
    
    if(response) {
        return res.status(409).json({
            success: false,
            error: "email already exists"
        })
    }

    const user = await client.user.create({
        data: {
            email,
            lastLoggedIn: new Date()
        }
    })
    
    const token = jwt.sign(
        { email, id: user.id }, 
        process.env.JWT_SECRET!, 
        { expiresIn: '15m' }
    );

    const result = {
        success:true
    }        //await sendemail(email, token);
    
    if(!result.success) {
        return res.status(500).json({
            success: false,
            msg: "failed to send the mail"
        })
    }

    return res.status(200).json({
        success: true,
        message: "please check the mail to verify",
        token
    })
})

router.get("/signin/post", async (req: Request, res: Response) => {
    const {token} = req.query;
    
    if(typeof(token) !== "string") {
        return res.status(400).json({
            success: false,
            error: "Invalid token"
        });
    }
    
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET!) as custompayload;
        
        if(!decoded || !decoded.email) {
            return res.status(401).json({
                success: false,
                error: "Invalid token payload"
            });
        }

        await client.user.update({
            where: { email: decoded.email },
            data: { lastLoggedIn: new Date() }
        });

        const sessionToken = jwt.sign(
            { email: decoded.email, id: decoded.id }, 
            process.env.JWT_SECRET!, 
            { expiresIn: '7d' }
        );

        res.cookie('session', sessionToken);

        return res.status(200).json({
            success: true,
            message: "Sign in successful"
        });

    } catch(error) {
        return res.status(401).json({
            success: false,
            error: "Invalid or expired token"
        });
    }
})


router.post("/logout", (req: Request, res: Response) => {
    res.clearCookie('session', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict'
    });
    
    return res.status(200).json({
        success: true,
        message: "Logged out successfully"
    });
});



export const requireAuth = async (req: Request, res: Response, next: Function) => {
    try {
        const token = req.cookies.session;
        
        if (!token) {
            return res.status(401).json({
                success: false,
                error: "Not authenticated"
            });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET!) as custompayload;
        
        if (!decoded || !decoded.email || !decoded.id) {
            return res.status(401).json({
                success: false,
                error: "Invalid session"
            });
        }

        req.user = { id: decoded.id };
        next();
    } catch (error) {
        return res.status(401).json({
            success: false,
            error: "Invalid or expired session"
        });
    }
};




async function sendemail(email: string, token: string) {
    const link = `http://localhost:3000/api/v1/signin/post?token=${token}`;
    
    try {
        const {data, error} = await resend.emails.send({
            from: process.env.EMAIL!,
            to: [email],
            subject: "Sign in to your account",
            html: `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .button { 
                    display: inline-block; 
                    padding: 12px 24px; 
                    background-color: #007bff; 
                    color: white; 
                    text-decoration: none; 
                    border-radius: 5px;
                    margin: 20px 0;
                }
                .footer { margin-top: 30px; font-size: 12px; color: #666; }
                </style>
            </head>
            <body>
                <div class="container">
                <h2>Sign In to Your Account</h2>
                <p>Click the button below to sign in:</p>
                <a href="${link}" class="button">Sign In</a>
                <p>Or copy and paste this link into your browser:</p>
                <p style="word-break: break-all; color: #007bff;">${link}</p>
                <div class="footer">
                    <p>This link will expire in 15 minutes.</p>
                    <p>If you didn't request this, please ignore this email.</p>
                </div>
                </div>
            </body>
            </html>
        `
        })

        if(error) {
            return {
                success: false,
                error
            }
        }

        return {
            success: true,
            data
        }
    } catch(e) {
        return {
            success: false,
        }
    }
}

export default router;

export {router as Userrouter};