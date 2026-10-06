import { handleVoiceRequest } from '../server/voice.js';
export default function handler(req, res) { return handleVoiceRequest(req, res, true); }
