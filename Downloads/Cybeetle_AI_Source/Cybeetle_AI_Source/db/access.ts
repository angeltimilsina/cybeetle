import {env} from 'cloudflare:workers';
import {getChatGPTUser} from '@/app/chatgpt-auth';
export function database(){const db=(env as unknown as {DB:D1Database}).DB;if(!db)throw new Error('Database unavailable');return db}
export function isAdmin(email:string){return ((env as unknown as {ADMIN_EMAILS?:string}).ADMIN_EMAILS||'').split(',').map(s=>s.trim().toLowerCase()).filter(Boolean).includes(email.toLowerCase())}
export async function identity(){const u=await getChatGPTUser();if(!u)throw new AccessError('Sign in to continue',401);return u}
export async function ensureUser(){const u=await identity();const now=new Date().toISOString();await database().prepare('INSERT INTO users (id,email,name,created_at,last_seen_at) VALUES (?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET email=excluded.email,name=excluded.name,last_seen_at=excluded.last_seen_at').bind(u.userId,u.email,u.displayName,now,now).run();return u}
export async function adminIdentity(){const u=await identity();if(!isAdmin(u.email))throw new AccessError('Administrator access required',403);return u}
export class AccessError extends Error{constructor(message:string,public status:number){super(message)}}
export function failure(e:unknown){if(e instanceof AccessError)return Response.json({error:e.message},{status:e.status});console.error('Cybeetle storage request failed',e);return Response.json({error:'Your data is temporarily unavailable. Please retry.'},{status:503})}
export function sameOrigin(req:Request){const origin=req.headers.get('Origin');if(!origin||origin!==new URL(req.url).origin)throw new AccessError('Invalid request origin',403)}
export const noCache={'Cache-Control':'no-store'};
