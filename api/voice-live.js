import { handleLiveRequest } from '../server/liveVoice.js';
export default function handler(req,res) { return handleLiveRequest(req,res); }
