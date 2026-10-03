import {requireChatGPTUser} from '../chatgpt-auth';
import {isAdmin} from '@/db/access';
import Dashboard from './dashboard';
export const dynamic='force-dynamic';
export default async function Admin(){const u=await requireChatGPTUser('/admin');if(!isAdmin(u.email))return <main className="signin"><h1>Administrator access required</h1><p>This account does not have permission to view user data.</p><a href="/" className="primary-link">Return to workspace</a></main>;return <Dashboard/>}
