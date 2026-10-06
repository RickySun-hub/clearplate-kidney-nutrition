// Run with node --env-file=.env.local. Values travel via stdin, never CLI arguments.
import { spawnSync } from 'node:child_process';
const allowed = ['SUPABASE_URL','SUPABASE_ANON_KEY','VOICE_ENABLED','OPENAI_API_KEY'];
for (const name of allowed) {
  const value = process.env[name];
  if (!value) { console.log(`${name}: not configured`); continue; }
  const command = `npx --cache D:\\.codex\\npm-cache --yes vercel env add ${name} preview --yes --sensitive --force`;
  const result = spawnSync('cmd.exe', ['/d','/s','/c',command], {input:value, encoding:'utf8', windowsHide:true});
  if (result.status !== 0) { console.error(`${name}: configuration failed (exit ${result.status})`); process.exitCode=1; }
  else console.log(`${name}: configured for preview`);
}
