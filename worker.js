export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === 'GET' && url.pathname === '/') {
      try {
        env.ANALYTICS.writeDataPoint({
          blobs: [request.headers.get('cf-ipcountry') || 'XX'],
          indexes: ['pageview']
        });
      } catch (_) {}
      return new Response(mainPage(), { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    }

    if (request.method === 'GET' && url.pathname === '/stats') {
      try {
        const token = env.CF_API_TOKEN;
        const accountId = env.CF_ACCOUNT_ID;
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
        const yearStart  = new Date(now.getFullYear(), 0, 1).toISOString();
        const query = async (since) => {
          const r = await fetch(
            `https://api.cloudflare.com/client/v4/accounts/${accountId}/analytics_engine/sql`,
            { method: 'POST', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'text/plain' },
              body: `SELECT count() AS c FROM page_views WHERE timestamp > toDateTime(${Math.floor(new Date(since).getTime()/1000)})` }
          );
          const txt = await r.text();
          try { const d = JSON.parse(txt); if (!r.ok) return { count: 0 }; return { count: Number(d.data?.[0]?.c || 0) }; }
          catch(e) { return { count: 0 }; }
        };
        const [today, month, year] = await Promise.all([query(todayStart), query(monthStart), query(yearStart)]);
        return new Response(JSON.stringify({ today: today.count, month: month.count, year: year.count }), {
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
      } catch (e) {
        return new Response(JSON.stringify({ today: 0, month: 0, year: 0 }), { headers: { 'Content-Type': 'application/json' } });
      }
    }

    if (request.method === 'GET') return new Response(mainPage(), { headers: { 'Content-Type': 'text/html; charset=utf-8' } });

    if (request.method === 'POST' && url.pathname === '/process') {
      try {
        const fd = await request.formData();
        const action = fd.get('action');

        if (action === 'transcribe') {
          const file = fd.get('file');
          if (!file) return new Response('No file', { status: 400 });
          const PROMPT = 'English university lecture: statistics, pharmacology, chemistry, biochemistry. Formulas: p-hat=p\u0302, q-hat=q\u0302, x-bar=x\u0305, mu=\u03bc, sigma=\u03c3, z-star=z*, CI=p\u0302\u00b1z*\u221a(p\u0302q\u0302/n), E=z*\u221a(p\u0302q\u0302/n), SE=\u221a(p\u0302q\u0302/n), n=p\u0302q\u0302(z*/E)\u00b2, H\u2080, H\u2081, t\u00bd=0.693/ke, CL=Dose/AUC, F=(AUCoral/AUCiv)\u00d7100%, pH=pKa+log([A\u207b]/[HA]). Write numbers as digits.';
          const gf = new FormData();
          gf.append('file', file, file.name || 'audio.wav');
          gf.append('model', 'whisper-large-v3-turbo');
          gf.append('response_format', 'text');
          gf.append('language', 'en');
          gf.append('prompt', PROMPT);
          const gr = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
            method: 'POST', headers: { 'Authorization': `Bearer ${env.GROQ_API_KEY}` }, body: gf
          });
          const grText = await gr.text();
          if (!gr.ok) return new Response('Groq error: ' + grText, { status: 500 });
          return new Response(grText.trim(), { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
        }

        if (action === 'analyze') {
          const text = fd.get('text') || '';
          const opts = JSON.parse(fd.get('opts') || '{}');
          const useBoth = fd.get('useBoth') === 'true';
          const lang = fd.get('lang') || 'en';

          const LANG_NAMES = {
            en:'English', fa:'Persian (Farsi)', ar:'Arabic', de:'German',
            fr:'French', es:'Spanish', ru:'Russian', zh:'Chinese (Simplified)',
            ja:'Japanese', tr:'Turkish', hi:'Hindi', pt:'Portuguese (Brazilian)'
          };
          const targetLang = LANG_NAMES[lang] || 'English';

          const safeJson = (raw, fb = {}) => {
            try {
              const c = raw.replace(/```json|```/g, '').trim();
              const m = c.match(/\{[\s\S]*\}/);
              return JSON.parse(m ? m[0] : c);
            } catch { return fb; }
          };

          const GURL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${env.GEMINI_API_KEY}`;
          const GH = { 'Content-Type': 'application/json' };

          const geminiCall = (prompt, maxTokens) => fetch(GURL, {
            method: 'POST', headers: GH,
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.1, maxOutputTokens: maxTokens } })
          }).then(async r => { const d = await r.json(); return safeJson(d.candidates?.[0]?.content?.parts?.[0]?.text || '{}', {}); }).catch(() => ({}));

          // Translate transcript if not English
          let translatedText = text;
          if (lang !== 'en') {
            try {
              const CHUNK = 12000;
              const chunks = [];
              for (let i = 0; i < text.length; i += CHUNK) chunks.push(text.substring(i, i + CHUNK));
              const translated = await Promise.all(chunks.map(chunk =>
                fetch(GURL, {
                  method: 'POST', headers: GH,
                  body: JSON.stringify({
                    contents: [{ parts: [{ text: `Translate the following university lecture text to ${targetLang}. Keep all formulas, numbers, and technical notation exactly as they are. Return ONLY the translated text, nothing else.\n\n"""${chunk}"""` }] }],
                    generationConfig: { temperature: 0.1, maxOutputTokens: 8192 }
                  })
                }).then(async r => { const d = await r.json(); return d.candidates?.[0]?.content?.parts?.[0]?.text || chunk; }).catch(() => chunk)
              ));
              translatedText = translated.join(' ');
            } catch(_) { translatedText = text; }
          }

          const FSYS = `You are an expert formula extractor for university science lectures (statistics, pharmacology, chemistry, biochemistry).
Extract EVERY formula or equation mentioned, even if only described verbally.
Verbal to notation:
- "p hat" or "p-hat" or "sample proportion" -> p\u0302 = x/n
- "q hat" -> q\u0302 = 1 - p\u0302
- "x bar" -> x\u0305, "mu" -> \u03bc, "sigma" -> \u03c3, "z star" or "critical value" -> z*
- "confidence interval" or "CI" -> p\u0302 \u00b1 z* \u00b7 \u221a(p\u0302q\u0302/n)
- "margin of error" or "E equals" -> E = z* \u00b7 \u221a(p\u0302q\u0302/n)
- "standard error" -> SE = \u221a(p\u0302q\u0302/n)
- "sample size formula" or "solving for n" -> n = p\u0302q\u0302 \u00b7 (z*/E)\u00b2
- "half life" -> t\u00bd = 0.693/ke
- "clearance" -> CL = Dose/AUC
- "bioavailability" -> F = (AUC_oral/AUC_iv) \u00d7 100%
- "henderson hasselbalch" -> pH = pKa + log([A\u207b]/[HA])
Formula names and context must be in ${targetLang}.
Return ONLY valid JSON: {"formulas":[{"formula":"...","name":"...","type":"statistical|mathematical|chemical|pharmacological|other","context":"exact quote max 20 words"}]}
If no formulas found return: {"formulas":[]}`;

          const FUSER = `Transcript:\n"""\n${text}\n"""\nExtract ALL formulas including verbal descriptions. Return only JSON.`;
          const TPROMPT = `Analyze this university lecture transcript. Return ONLY valid JSON with no extra text.
All terms and key points MUST be written in ${targetLang}.
{"terms":[{"term":"..."}],"points":["..."]}
Rules: 10-20 important technical terms, 5-8 key takeaways. Everything in ${targetLang}.
TRANSCRIPT:\n"""\n${text.substring(0, 16000)}\n"""`;

          const nvidiaCall = () => fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${env.NVIDIA_API_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model: 'meta/llama-3.3-70b-instruct',
              messages: [{ role: 'system', content: FSYS }, { role: 'user', content: FUSER }],
              temperature: 0.1, max_tokens: 4000, response_format: { type: 'json_object' }
            })
          }).then(async r => safeJson((await r.json()).choices?.[0]?.message?.content || '{}', { formulas: [] }))
            .catch(() => ({ formulas: [] }));

          const [nFormulas, gTerms, gFormulas] = await Promise.all([
            nvidiaCall(),
            geminiCall(TPROMPT, 2048).then(r => ({ terms: r.terms || [], points: r.points || [] })),
            useBoth ? geminiCall(FSYS + '\n\n' + FUSER, 4096).then(r => ({ formulas: r.formulas || [] })) : Promise.resolve({ formulas: [] })
          ]);

          const normKey = f => f.formula.toLowerCase().replace(/[\s*()\[\]{}'"`\u00b1\u00b7\u00d7\u221a^_]/g, '').substring(0, 30);
          let merged = [];
          if (!useBoth) {
            merged = (nFormulas.formulas || []).map(f => ({ ...f, source: 'nvidia' }));
          } else {
            const nMap = new Map((nFormulas.formulas || []).map(f => ({ ...f, source: 'nvidia' })).map(f => [normKey(f), f]));
            const seen = new Set();
            for (const gf of (gFormulas.formulas || []).map(f => ({ ...f, source: 'gemini' }))) {
              const k = normKey(gf);
              if (nMap.has(k) && !seen.has(k)) { merged.push({ ...nMap.get(k), source: 'both' }); seen.add(k); }
            }
            for (const f of [...(nFormulas.formulas || []).map(f => ({ ...f, source: 'nvidia' })), ...(gFormulas.formulas || []).map(f => ({ ...f, source: 'gemini' }))]) {
              const k = normKey(f);
              if (!seen.has(k) && f.formula) { merged.push(f); seen.add(k); }
            }
            merged.sort((a, b) => ({ both: 0, nvidia: 1, gemini: 2 }[a.source] - ({ both: 0, nvidia: 1, gemini: 2 }[b.source])));
          }

          return new Response(JSON.stringify({
            formulas: opts.formulas ? merged : [],
            terms:    opts.terms    ? (gTerms.terms  || []) : [],
            points:   opts.summary  ? (gTerms.points || []) : [],
            translatedText: lang !== 'en' ? translatedText : null,
          }), { headers: { 'Content-Type': 'application/json; charset=utf-8' } });
        }

        return new Response('Invalid action', { status: 400 });
      } catch (e) {
        return new Response('Error: ' + e.message, { status: 500 });
      }
    }
    return new Response('Not Found', { status: 404 });
  }
};

function mainPage() {
return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>LectureFlow</title>
<link rel="icon" type="image/svg+xml" href="data:image/svg+xml,%3Csvg width='80' height='80' viewBox='0 0 80 80' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Crect width='80' height='80' rx='22' fill='%23f8fafc'/%3E%3Crect width='80' height='80' rx='22' fill='none' stroke='%23e2e8f0' stroke-width='1.5'/%3E%3Crect x='8' y='44' width='10' height='20' rx='4' fill='%2394a3b8'/%3E%3Crect x='22' y='32' width='10' height='32' rx='4' fill='%2364748b'/%3E%3Crect x='36' y='16' width='10' height='48' rx='4' fill='%232563eb'/%3E%3Crect x='50' y='24' width='10' height='40' rx='4' fill='%233b82f6'/%3E%3Crect x='64' y='36' width='10' height='28' rx='4' fill='%2364748b'/%3E%3C/svg%3E">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@500&display=swap" rel="stylesheet">
<style>
:root{--ac:#2563eb;--ac-h:#1d4ed8;--ac-bg:#eff6ff;--ac-bd:#bfdbfe;
  --bg:#f1f5f9;--sf:#ffffff;--pn:#f8fafc;--bd:#e2e8f0;--bd2:#cbd5e1;
  --tx:#0f172a;--td:#475569;--mu:#94a3b8;--r:14px;--fc:#2563eb;}
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
body{font-family:'Inter',system-ui,sans-serif;background:var(--bg);color:var(--tx);min-height:100vh;padding:28px 16px 56px;transition:background .2s,color .2s;}
body.dark{--ac:#60a5fa;--ac-h:#93c5fd;--ac-bg:#1c2d4a;--ac-bd:#2c4a78;--bg:#0b1220;--sf:#161f30;--pn:#1c2738;--bd:#2a3850;--bd2:#3d4f6b;--tx:#e8edf6;--td:#9fb0c9;--mu:#6b7b94;--fc:#7eb0ff;}
body.light{--ac:#2563eb;--ac-h:#1d4ed8;--ac-bg:#eff6ff;--ac-bd:#bfdbfe;--bg:#f1f5f9;--sf:#ffffff;--pn:#f8fafc;--bd:#e2e8f0;--bd2:#cbd5e1;--tx:#0f172a;--td:#475569;--mu:#94a3b8;--fc:#2563eb;}
.wrap{width:100%;max-width:620px;margin:0 auto;}
.topbar{display:flex;justify-content:flex-end;gap:8px;margin-bottom:24px;}
.theme-btn{display:flex;align-items:center;gap:6px;padding:6px 14px;background:var(--sf);border:1px solid var(--bd);border-radius:100px;font-size:11px;font-weight:600;color:var(--td);cursor:pointer;font-family:'Inter',sans-serif;transition:all .2s;}
.theme-btn:hover{border-color:var(--ac);color:var(--ac);}
.lang-sel{padding:6px 10px;background:var(--sf);border:1px solid var(--bd);border-radius:100px;font-size:11px;font-weight:600;color:var(--td);cursor:pointer;font-family:'Inter',sans-serif;transition:all .2s;outline:none;}
.lang-sel:hover{border-color:var(--ac);color:var(--ac);}
.header{text-align:center;margin-bottom:28px;}
.logo-wrap{margin-bottom:16px;}
.logo-wrap svg{filter:drop-shadow(0 2px 12px rgba(37,99,235,.18));}
.badge{display:inline-flex;align-items:center;gap:6px;font-size:10px;font-weight:600;letter-spacing:1.5px;text-transform:uppercase;color:var(--ac);background:var(--ac-bg);border:1px solid var(--ac-bd);padding:4px 12px;border-radius:100px;margin-bottom:12px;}
.badge::before{content:'';width:6px;height:6px;background:var(--ac);border-radius:50%;animation:pulse 2s infinite;}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}
h1{font-size:28px;font-weight:700;color:var(--tx);letter-spacing:-.5px;margin-bottom:6px;}
.sub{color:var(--td);font-size:13px;line-height:1.5;}
.sec{background:var(--sf);border:1px solid var(--bd);border-radius:var(--r);padding:20px;margin-bottom:10px;box-shadow:0 1px 3px rgba(0,0,0,.04);}
.sec-label{font-size:10px;font-weight:600;letter-spacing:1px;text-transform:uppercase;color:var(--mu);margin-bottom:14px;}
.drop{border:1.5px dashed var(--bd2);border-radius:10px;padding:30px 20px;text-align:center;cursor:pointer;transition:all .2s;}
.drop:hover,.drop.over{border-color:var(--ac);background:var(--ac-bg);}
.drop-icon{width:52px;height:52px;background:var(--ac-bg);border:1px solid var(--ac-bd);border-radius:14px;display:flex;align-items:center;justify-content:center;margin:0 auto 14px;}
.drop h3{font-size:14px;font-weight:500;color:var(--tx);margin-bottom:4px;}
.drop p{color:var(--td);font-size:12px;}
.fname{margin-top:12px;display:none;align-items:center;justify-content:center;gap:6px;color:var(--ac-h);font-size:12px;font-weight:500;background:var(--ac-bg);border:1px solid var(--ac-bd);padding:5px 14px;border-radius:100px;}
input[type="file"]{display:none;}
.ibox{display:none;margin-top:10px;background:var(--ac-bg);border:1px solid var(--ac-bd);border-radius:8px;padding:10px 14px;font-size:11px;color:var(--ac-h);line-height:1.6;}
.grid3{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;}
.tcard{display:flex;flex-direction:column;align-items:center;gap:6px;padding:12px 8px;background:var(--pn);border:1.5px solid var(--bd);border-radius:10px;cursor:pointer;transition:all .2s;user-select:none;}
.tcard:has(input:checked){border-color:var(--ac);background:var(--ac-bg);}
.tcard input{display:none;}
.tcard-icon{font-size:20px;}
.tcard-label{font-size:11px;font-weight:500;color:var(--td);}
.tcard:has(input:checked) .tcard-label{color:var(--ac);}
.grid2{display:grid;grid-template-columns:1fr 1fr;gap:8px;}
.mcard{display:flex;flex-direction:column;gap:5px;padding:14px;background:var(--pn);border:1.5px solid var(--bd);border-radius:10px;cursor:pointer;transition:all .2s;user-select:none;}
.mcard.sel{border-color:var(--ac);background:var(--ac-bg);}
.mcard input{display:none;}
.mcard-title{font-size:13px;font-weight:600;color:var(--tx);display:flex;align-items:center;gap:6px;}
.mcard.sel .mcard-title{color:var(--ac-h);}
.mcard-desc{font-size:11px;color:var(--td);line-height:1.5;}
.mcard.sel .mcard-desc{color:var(--ac);}
.mbadge{font-size:9px;font-weight:700;padding:2px 7px;border-radius:100px;border:1px solid;margin-left:auto;}
.mf{background:var(--ac-bg);color:var(--ac-h);border-color:var(--ac-bd);}
.ma{background:var(--pn);color:var(--td);border-color:var(--bd);}
.mcard.sel .ma{background:var(--ac-bg);color:var(--ac-h);border-color:var(--ac-bd);}
.btn{width:100%;padding:14px;border:none;border-radius:10px;font-size:14px;font-weight:600;cursor:pointer;background:var(--ac);color:#fff;font-family:'Inter',sans-serif;transition:background .2s,transform .1s;margin-bottom:10px;}
.btn:hover:not(:disabled){background:var(--ac-h);transform:translateY(-1px);}
.btn:active:not(:disabled){transform:translateY(0);}
.btn:disabled{background:var(--bd2);color:var(--mu);cursor:not-allowed;}
.loading{display:none;background:var(--sf);border:1px solid var(--bd);border-radius:var(--r);padding:24px 20px;margin-bottom:10px;}
.loading-top{display:flex;align-items:center;gap:12px;margin-bottom:16px;}
.spin{width:32px;height:32px;flex-shrink:0;border:2.5px solid var(--bd2);border-top-color:var(--ac);border-radius:50%;animation:spin .7s linear infinite;}
@keyframes spin{to{transform:rotate(360deg);}}
#ltxt{font-size:13px;font-weight:500;color:var(--tx);}
.pbar-wrap{background:var(--pn);border-radius:100px;height:5px;overflow:hidden;}
.pbar{height:100%;background:var(--ac);border-radius:100px;width:0%;transition:width .4s ease;}
.plabel{display:flex;justify-content:space-between;font-size:10px;color:var(--td);margin-top:8px;}
.ppct{color:var(--ac);font-weight:600;}
.abar{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:10px;}
.abtn{padding:10px 8px;border:1px solid var(--bd);border-radius:10px;font-size:12px;font-weight:600;cursor:pointer;background:var(--sf);color:var(--td);font-family:'Inter',sans-serif;transition:all .2s;display:flex;align-items:center;justify-content:center;gap:5px;}
.abtn:hover{border-color:var(--ac);color:var(--ac);background:var(--ac-bg);}
.abtn.ok{border-color:var(--ac);color:var(--ac);background:var(--ac-bg);}
.tabs{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-bottom:10px;}
.tab{padding:9px 4px;border-radius:8px;font-size:11px;font-weight:600;cursor:pointer;background:var(--sf);color:var(--mu);text-align:center;border:1px solid var(--bd);transition:all .2s;}
.tab:hover{color:var(--ac);border-color:var(--ac-bd);}
.tab.on{background:var(--ac-bg);color:var(--ac);border-color:var(--ac-bd);}
.result{margin-top:4px;display:none;}
.card{background:var(--sf);border:1px solid var(--bd);border-radius:var(--r);padding:18px;margin-bottom:10px;box-shadow:0 1px 3px rgba(0,0,0,.04);}
.card-title{font-size:10px;font-weight:600;letter-spacing:1px;text-transform:uppercase;color:var(--mu);margin-bottom:14px;}
.sbox{max-height:520px;overflow-y:auto;padding-right:4px;scrollbar-width:thin;scrollbar-color:var(--bd2) transparent;}
.sbox::-webkit-scrollbar{width:4px;}
.sbox::-webkit-scrollbar-thumb{background:var(--bd2);border-radius:4px;}
.txten{font-size:13px;line-height:1.9;color:var(--tx);white-space:pre-wrap;word-break:break-word;}
.legend{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px;}
.li{font-size:10px;font-weight:600;padding:3px 9px;border-radius:100px;border:1px solid;}
.lc,.tc{background:#eff6ff;color:#1d4ed8;border-color:#bfdbfe;}
.ls,.ts{background:#f0fdf4;color:#166534;border-color:#bbf7d0;}
.lm,.tm{background:#faf5ff;color:#6b21a8;border-color:#e9d5ff;}
.lp,.tp{background:#fff1f2;color:#9f1239;border-color:#fecdd3;}
.to{background:#fefce8;color:#854d0e;border-color:#fef08a;}
.lb,.sg{background:#eff6ff;color:#1d4ed8;border-color:#bfdbfe;}
.lg,.sb{background:#f0fdf4;color:#166534;border-color:#bbf7d0;}
.ln,.sn{background:#f7fee7;color:#3f6212;border-color:#d9f99d;}
body.dark .lc,body.dark .tc{background:#16243c;color:#93c5fd;border-color:#2c4a78;}
body.dark .ls,body.dark .ts{background:#142a1f;color:#4ade80;border-color:#1f4a32;}
body.dark .lm,body.dark .tm{background:#241b3a;color:#c4a3ff;border-color:#3a2a5c;}
body.dark .lp,body.dark .tp{background:#3a1620;color:#fb7185;border-color:#5c2230;}
body.dark .to{background:#3a2e10;color:#fbbf24;border-color:#5c481a;}
body.dark .lb,body.dark .sg{background:#16243c;color:#93c5fd;border-color:#2c4a78;}
body.dark .lg,body.dark .sb{background:#142a1f;color:#4ade80;border-color:#1f4a32;}
body.dark .ln,body.dark .sn{background:#26301a;color:#bef264;border-color:#3a4a22;}
.fi{background:var(--pn);border:1px solid var(--bd);border-radius:10px;padding:12px 14px;margin-bottom:8px;transition:border-color .2s;}
.fi:hover{border-color:var(--ac-bd);}
.fi-top{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:5px;}
.ftype{font-size:9px;font-weight:700;padding:3px 8px;border-radius:100px;letter-spacing:.5px;text-transform:uppercase;border:1px solid;}
.fcode{font-family:'JetBrains Mono',monospace;font-size:14px;color:var(--fc);font-weight:500;word-break:break-all;}
.fname2{font-size:12px;color:var(--td);margin-top:2px;}
.fctx{font-size:11px;color:var(--mu);margin-top:8px;font-style:italic;border-top:1px solid var(--bd);padding-top:8px;line-height:1.5;}
.fsrc{font-size:9px;font-weight:600;padding:2px 7px;border-radius:100px;border:1px solid;margin-left:auto;}
.tgrid{display:flex;flex-wrap:wrap;gap:7px;}
.ttag{background:var(--ac-bg);border:1px solid var(--ac-bd);color:var(--ac-h);padding:5px 12px;border-radius:100px;font-size:12px;font-weight:500;}
.spoint{display:flex;gap:10px;align-items:flex-start;background:var(--pn);border:1px solid var(--bd);border-radius:8px;padding:10px 14px;margin-bottom:8px;font-size:13px;line-height:1.7;color:var(--tx);}
.sdot{width:6px;height:6px;background:var(--ac);border-radius:50%;flex-shrink:0;margin-top:7px;}
.err{background:#fff1f2;border:1px solid #fecdd3;color:#9f1239;padding:12px 14px;border-radius:10px;margin-top:10px;display:none;font-size:12px;line-height:1.5;}
body.dark .err{background:#3a1620;border-color:#5c2230;color:#fda4af;}
#fTab,#tTab,#sTab{display:none;}
</style>
</head>
<body class="light">
<div class="wrap">
  <div class="topbar">
    <select class="lang-sel" id="langSel" onchange="setLang(this.value)">
      <option value="en">English</option>
      <option value="fa">فارسی</option>
      <option value="ar">العربية</option>
      <option value="de">Deutsch</option>
      <option value="fr">Français</option>
      <option value="es">Español</option>
      <option value="ru">Русский</option>
      <option value="zh">中文</option>
      <option value="ja">日本語</option>
      <option value="tr">Türkçe</option>
      <option value="hi">हिन्दी</option>
      <option value="pt">Português</option>
    </select>
    <button class="theme-btn" onclick="toggleTheme()"><span id="tl">Dark mode</span></button>
  </div>

  <div class="header">
    <div class="logo-wrap">
      <svg width="72" height="72" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect width="80" height="80" rx="22" fill="#f8fafc"/>
        <rect width="80" height="80" rx="22" fill="none" stroke="#e2e8f0" stroke-width="1.5"/>
        <rect x="8"  y="44" width="10" height="20" rx="4" fill="#94a3b8"/>
        <rect x="22" y="32" width="10" height="32" rx="4" fill="#64748b"/>
        <rect x="36" y="16" width="10" height="48" rx="4" fill="#2563eb"/>
        <rect x="50" y="24" width="10" height="40" rx="4" fill="#3b82f6"/>
        <rect x="64" y="36" width="10" height="28" rx="4" fill="#64748b"/>
      </svg>
    </div>
    <div class="badge" id="uBadge">AI Lecture Assistant</div>
    <h1 id="uH1">LectureFlow</h1>
    <p class="sub" id="uSub">Upload a recording — get transcript, formulas, terms & summary</p>
  </div>

  <div class="sec">
    <div class="sec-label" id="uRecLabel">Recording</div>
    <div class="drop" id="drop" onclick="document.getElementById('fi').click()">
      <div class="drop-icon">
        <svg width="28" height="28" viewBox="0 0 26 26" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="9" y="1" width="8" height="14" rx="4" fill="#2563eb"/>
          <path d="M4 13 Q4 21 13 21 Q22 21 22 13" stroke="#2563eb" stroke-width="2.2" stroke-linecap="round" fill="none"/>
          <line x1="13" y1="21" x2="13" y2="25" stroke="#2563eb" stroke-width="2.2" stroke-linecap="round"/>
          <line x1="8"  y1="25" x2="18" y2="25" stroke="#2563eb" stroke-width="2.2" stroke-linecap="round"/>
          <line x1="11" y1="7"  x2="15" y2="7"  stroke="white" stroke-width="1.5" stroke-linecap="round" opacity="0.65"/>
          <line x1="11" y1="10" x2="15" y2="10" stroke="white" stroke-width="1.5" stroke-linecap="round" opacity="0.65"/>
          <line x1="11" y1="13" x2="15" y2="13" stroke="white" stroke-width="1.5" stroke-linecap="round" opacity="0.65"/>
        </svg>
      </div>
      <h3 id="uDropH">Drop your audio file here</h3>
      <p id="uDropP">or click to browse · mp3 · m4a · wav · ogg · webm</p>
      <div class="fname" id="fn"></div>
    </div>
    <div class="ibox" id="ib"></div>
    <input type="file" id="fi" accept="audio/*">
  </div>

  <div class="sec">
    <div class="sec-label" id="uExtLabel">Extract</div>
    <div class="grid3">
      <label class="tcard"><input type="checkbox" id="cf" checked><span class="tcard-icon">🧪</span><span class="tcard-label" id="uFormulas">Formulas</span></label>
      <label class="tcard"><input type="checkbox" id="ct" checked><span class="tcard-icon">💊</span><span class="tcard-label" id="uTerms">Terms</span></label>
      <label class="tcard"><input type="checkbox" id="cs" checked><span class="tcard-icon">📋</span><span class="tcard-label" id="uSummary">Summary</span></label>
    </div>
  </div>

  <div class="sec">
    <div class="sec-label" id="uModeLabel">Analysis mode</div>
    <div class="grid2">
      <label class="mcard sel" id="mf" onclick="selMode('fast')">
        <input type="radio" name="mode" checked>
        <div class="mcard-title">⚡ NVIDIA <span class="mbadge mf" id="uFastBadge">Default</span></div>
        <div class="mcard-desc" id="uFastDesc">Fast formula detection + Gemini summary</div>
      </label>
      <label class="mcard" id="ma" onclick="selMode('acc')">
        <input type="radio" name="mode">
        <div class="mcard-title">🎯 Both <span class="mbadge ma" id="uAccBadge">+Gemini</span></div>
        <div class="mcard-desc" id="uAccDesc">NVIDIA + Gemini — maximum coverage</div>
      </label>
    </div>
  </div>

  <button class="btn" id="go" disabled onclick="run()" data-key="analyze">Analyze lecture →</button>

  <div class="loading" id="loading">
    <div class="loading-top"><div class="spin"></div><p id="ltxt">Processing...</p></div>
    <div class="pbar-wrap"><div class="pbar" id="pb"></div></div>
    <div class="plabel"><span id="ps"></span><span class="ppct" id="pp"></span></div>
  </div>
  <div class="err" id="err"></div>

  <div class="result" id="result">
    <div class="abar">
      <button class="abtn" id="cpbtn" onclick="cpTxt()">📋 Copy text</button>
      <button class="abtn" onclick="dlTxt()" id="uDlTxt">⬇ Download .txt</button>
      <button class="abtn" id="pdfBtn" onclick="dlPdf()">📄 Download PDF</button>
    </div>
    <div class="tabs">
      <div class="tab on" onclick="showTab('tr')" id="uTabTr">Transcript</div>
      <div class="tab" onclick="showTab('fo')" id="uTabFo">Formulas</div>
      <div class="tab" onclick="showTab('te')" id="uTabTe">Terms</div>
      <div class="tab" onclick="showTab('su')" id="uTabSu">Summary</div>
    </div>
    <div id="trTab"><div class="card"><div class="card-title" id="uTrTitle">Full Transcript</div><div class="sbox"><div class="txten" id="trTxt"></div></div></div></div>
    <div id="fTab"><div class="card">
      <div class="card-title" id="uFTitle">Formulas & Equations</div>
      <div class="legend" id="fleg">
        <span class="li lc">Chemical</span><span class="li ls">Statistical</span>
        <span class="li lm">Mathematical</span><span class="li lp">Pharmacological</span>
      </div>
      <div class="sbox" id="flist"><p style="color:var(--mu);font-size:12px;text-align:center;padding:24px 0" id="uNoFormulas">No formulas detected</p></div>
    </div></div>
    <div id="tTab"><div class="card"><div class="card-title" id="uTTitle">Technical Terms</div><div class="sbox"><div class="tgrid" id="tlist"></div></div></div></div>
    <div id="sTab"><div class="card"><div class="card-title" id="uSTitle">Key Points</div><div class="sbox" id="slist"></div></div></div>
  </div>

  <div style="margin-top:32px;border-top:1px solid var(--bd);padding-top:20px;">
    <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;">
      <div style="display:flex;align-items:center;gap:10px;">
        <svg width="30" height="30" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect width="80" height="80" rx="18" fill="#f8fafc"/>
          <rect width="80" height="80" rx="18" fill="none" stroke="#e2e8f0" stroke-width="1.5"/>
          <rect x="8"  y="44" width="10" height="20" rx="4" fill="#94a3b8"/>
          <rect x="22" y="32" width="10" height="32" rx="4" fill="#64748b"/>
          <rect x="36" y="16" width="10" height="48" rx="4" fill="#2563eb"/>
          <rect x="50" y="24" width="10" height="40" rx="4" fill="#3b82f6"/>
          <rect x="64" y="36" width="10" height="28" rx="4" fill="#64748b"/>
        </svg>
        <div>
          <div style="font-size:13px;font-weight:600;color:var(--tx);">LectureFlow</div>
          <div style="font-size:11px;color:var(--mu);">Built with Claude</div>
        </div>
      </div>
      <div style="display:flex;align-items:center;gap:8px;">
        <a href="https://github.com/kiaashkan/LectureFlow-app" target="_blank" title="Download Android App" style="display:inline-flex;align-items:center;justify-content:center;width:36px;height:36px;border:1px solid var(--bd);border-radius:8px;text-decoration:none;color:var(--td);background:var(--sf);">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 16l-5-5 1.41-1.41L11 13.17V4h2v9.17l2.59-2.58L17 11l-5 5zm-7 2h14v2H5v-2z"/></svg>
        </a>
        <a href="https://t.me/kiaashkan" target="_blank" title="@kiaashkan on Telegram" style="display:inline-flex;align-items:center;justify-content:center;width:36px;height:36px;border:1px solid var(--bd);border-radius:8px;text-decoration:none;color:var(--td);background:var(--sf);">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8l-1.68 7.92c-.12.56-.48.7-.96.44l-2.64-1.96-1.28 1.24c-.14.14-.26.26-.54.26l.2-2.72 4.96-4.48c.22-.2-.04-.3-.34-.1L7.66 14.4 5.08 13.6c-.54-.18-.56-.54.12-.8l9.16-3.52c.46-.16.86.1.72.72z"/></svg>
        </a>
        <a href="https://github.com/kiaashkan" target="_blank" title="kiaashkan on GitHub" style="display:inline-flex;align-items:center;justify-content:center;width:36px;height:36px;border:1px solid var(--bd);border-radius:8px;text-decoration:none;color:var(--td);background:var(--sf);">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.604-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.464-1.11-1.464-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0112 6.836c.85.004 1.705.115 2.504.337 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.202 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.579.688.481C19.138 20.163 22 16.418 22 12c0-5.523-4.477-10-10-10z"/></svg>
        </a>
      </div>
    </div>
    <div style="margin-top:10px;font-size:11px;color:var(--mu);">
      Made by <span style="font-weight:600;color:var(--td);">Kia Ashkan</span> with the help of Claude
    </div>
    <div style="margin-top:10px;display:flex;gap:16px;font-size:11px;color:var(--mu);flex-wrap:wrap;">
      <span><span id="uToday">Today</span>: <strong id="statToday" style="color:var(--td)">—</strong></span>
      <span><span id="uMonth">Month</span>: <strong id="statMonth" style="color:var(--td)">—</strong></span>
      <span><span id="uYear">Year</span>: <strong id="statYear" style="color:var(--td)">—</strong></span>
    </div>
  </div>
</div>

<script>
var selFile=null,rData={},curLang='en';
const TARGET_SR=8000,CHUNK_SECS=720;

var T={
  en:{badge:'AI Lecture Assistant',sub:'Upload a recording — get transcript, formulas, terms & summary',
    recLabel:'Recording',dropH:'Drop your audio file here',dropP:'or click to browse · mp3 · m4a · wav · ogg · webm',
    extLabel:'Extract',formulas:'Formulas',terms:'Terms',summary:'Summary',
    modeLabel:'Analysis mode',fastDesc:'Fast formula detection + Gemini summary',accDesc:'NVIDIA + Gemini — maximum coverage',fastBadge:'Default',accBadge:'+Gemini',
    analyze:'Analyze lecture →',copy:'📋 Copy text',dlTxt:'⬇ Download .txt',dlPdf:'📄 Download PDF',
    tabTr:'Transcript',tabFo:'Formulas',tabTe:'Terms',tabSu:'Summary',
    trTitle:'Full Transcript',fTitle:'Formulas & Equations',tTitle:'Technical Terms',sTitle:'Key Points',
    noFormulas:'No formulas detected',noTerms:'No terms detected',noSummary:'No summary available',
    dark:'Dark mode',light:'Light mode',large:'📦 Large file — will be split into chunks.',
    today:'Today',month:'Month',year:'Year'},
  fa:{badge:'دستیار هوشمند درس',sub:'فایل صوتی آپلود کن — متن، فرمول، اصطلاح و خلاصه بگیر',
    recLabel:'ضبط صدا',dropH:'فایل صوتی را اینجا رها کنید',dropP:'یا کلیک کنید · mp3 · m4a · wav · ogg · webm',
    extLabel:'استخراج',formulas:'فرمول‌ها',terms:'اصطلاحات',summary:'خلاصه',
    modeLabel:'حالت آنالیز',fastDesc:'تشخیص سریع فرمول + خلاصه Gemini',accDesc:'NVIDIA + Gemini — پوشش کامل',fastBadge:'پیش‌فرض',accBadge:'+Gemini',
    analyze:'آنالیز درس ←',copy:'📋 کپی متن',dlTxt:'⬇ دانلود .txt',dlPdf:'📄 دانلود PDF',
    tabTr:'متن',tabFo:'فرمول‌ها',tabTe:'اصطلاحات',tabSu:'خلاصه',
    trTitle:'متن کامل',fTitle:'فرمول‌ها و معادلات',tTitle:'اصطلاحات فنی',sTitle:'نکات کلیدی',
    noFormulas:'فرمولی یافت نشد',noTerms:'اصطلاحی یافت نشد',noSummary:'خلاصه‌ای در دسترس نیست',
    dark:'حالت تاریک',light:'حالت روشن',large:'📦 فایل بزرگ — به بخش‌های کوچکتر تقسیم می‌شود.',
    today:'امروز',month:'ماه',year:'سال'},
  ar:{badge:'مساعد المحاضرات',sub:'ارفع تسجيلاً — احصل على النص والمعادلات والمصطلحات والملخص',
    recLabel:'التسجيل',dropH:'أسقط ملف الصوت هنا',dropP:'أو انقر للتصفح · mp3 · m4a · wav',
    extLabel:'استخراج',formulas:'المعادلات',terms:'المصطلحات',summary:'الملخص',
    modeLabel:'وضع التحليل',fastDesc:'كشف سريع للمعادلات + ملخص Gemini',accDesc:'NVIDIA + Gemini — تغطية شاملة',fastBadge:'افتراضي',accBadge:'+Gemini',
    analyze:'تحليل المحاضرة ←',copy:'📋 نسخ النص',dlTxt:'⬇ تحميل .txt',dlPdf:'📄 تحميل PDF',
    tabTr:'النص',tabFo:'المعادلات',tabTe:'المصطلحات',tabSu:'الملخص',
    trTitle:'النص الكامل',fTitle:'المعادلات والصيغ',tTitle:'المصطلحات التقنية',sTitle:'النقاط الرئيسية',
    noFormulas:'لم يتم اكتشاف معادلات',noTerms:'لم يتم اكتشاف مصطلحات',noSummary:'لا يوجد ملخص',
    dark:'الوضع المظلم',light:'الوضع الفاتح',large:'📦 ملف كبير — سيتم تقسيمه.',
    today:'اليوم',month:'الشهر',year:'السنة'},
  de:{badge:'KI Vorlesungsassistent',sub:'Lade eine Aufnahme hoch — erhalte Transkript, Formeln, Begriffe & Zusammenfassung',
    recLabel:'Aufnahme',dropH:'Audiodatei hier ablegen',dropP:'oder klicken · mp3 · m4a · wav · ogg · webm',
    extLabel:'Extrahieren',formulas:'Formeln',terms:'Begriffe',summary:'Zusammenfassung',
    modeLabel:'Analysemodus',fastDesc:'Schnelle Formelerkennung + Gemini Zusammenfassung',accDesc:'NVIDIA + Gemini — maximale Abdeckung',fastBadge:'Standard',accBadge:'+Gemini',
    analyze:'Vorlesung analysieren →',copy:'📋 Text kopieren',dlTxt:'⬇ .txt herunterladen',dlPdf:'📄 PDF herunterladen',
    tabTr:'Transkript',tabFo:'Formeln',tabTe:'Begriffe',tabSu:'Zusammenfassung',
    trTitle:'Volles Transkript',fTitle:'Formeln & Gleichungen',tTitle:'Fachbegriffe',sTitle:'Kernpunkte',
    noFormulas:'Keine Formeln erkannt',noTerms:'Keine Begriffe erkannt',noSummary:'Keine Zusammenfassung',
    dark:'Dunkelmodus',light:'Hellmodus',large:'📦 Große Datei — wird aufgeteilt.',
    today:'Heute',month:'Monat',year:'Jahr'},
  fr:{badge:'Assistant IA de cours',sub:'Téléchargez un enregistrement — obtenez transcription, formules, termes & résumé',
    recLabel:'Enregistrement',dropH:'Déposez votre fichier audio ici',dropP:'ou cliquez pour parcourir · mp3 · m4a · wav',
    extLabel:'Extraire',formulas:'Formules',terms:'Termes',summary:'Résumé',
    modeLabel:"Mode d'analyse",fastDesc:'Détection rapide + résumé Gemini',accDesc:'NVIDIA + Gemini — couverture maximale',fastBadge:'Défaut',accBadge:'+Gemini',
    analyze:'Analyser le cours →',copy:'📋 Copier le texte',dlTxt:'⬇ Télécharger .txt',dlPdf:'📄 Télécharger PDF',
    tabTr:'Transcription',tabFo:'Formules',tabTe:'Termes',tabSu:'Résumé',
    trTitle:'Transcription complète',fTitle:'Formules & Équations',tTitle:'Termes techniques',sTitle:'Points clés',
    noFormulas:'Aucune formule détectée',noTerms:'Aucun terme détecté',noSummary:'Aucun résumé disponible',
    dark:'Mode sombre',light:'Mode clair',large:'📦 Fichier volumineux — sera divisé.',
    today:"Aujourd'hui",month:'Mois',year:'Année'},
  es:{badge:'Asistente IA de clases',sub:'Sube una grabación — obtén transcripción, fórmulas, términos y resumen',
    recLabel:'Grabación',dropH:'Suelta tu archivo de audio aquí',dropP:'o haz clic para buscar · mp3 · m4a · wav',
    extLabel:'Extraer',formulas:'Fórmulas',terms:'Términos',summary:'Resumen',
    modeLabel:'Modo de análisis',fastDesc:'Detección rápida + resumen Gemini',accDesc:'NVIDIA + Gemini — cobertura máxima',fastBadge:'Por defecto',accBadge:'+Gemini',
    analyze:'Analizar clase →',copy:'📋 Copiar texto',dlTxt:'⬇ Descargar .txt',dlPdf:'📄 Descargar PDF',
    tabTr:'Transcripción',tabFo:'Fórmulas',tabTe:'Términos',tabSu:'Resumen',
    trTitle:'Transcripción completa',fTitle:'Fórmulas y Ecuaciones',tTitle:'Términos técnicos',sTitle:'Puntos clave',
    noFormulas:'No se detectaron fórmulas',noTerms:'No se detectaron términos',noSummary:'No hay resumen disponible',
    dark:'Modo oscuro',light:'Modo claro',large:'📦 Archivo grande — se dividirá.',
    today:'Hoy',month:'Mes',year:'Año'},
  ru:{badge:'ИИ-ассистент лекций',sub:'Загрузите запись — получите транскрипт, формулы, термины и резюме',
    recLabel:'Запись',dropH:'Перетащите аудиофайл сюда',dropP:'или нажмите для выбора · mp3 · m4a · wav',
    extLabel:'Извлечь',formulas:'Формулы',terms:'Термины',summary:'Резюме',
    modeLabel:'Режим анализа',fastDesc:'Быстрое обнаружение формул + резюме Gemini',accDesc:'NVIDIA + Gemini — максимальное покрытие',fastBadge:'По умолчанию',accBadge:'+Gemini',
    analyze:'Анализировать лекцию →',copy:'📋 Копировать текст',dlTxt:'⬇ Скачать .txt',dlPdf:'📄 Скачать PDF',
    tabTr:'Транскрипт',tabFo:'Формулы',tabTe:'Термины',tabSu:'Резюме',
    trTitle:'Полный транскрипт',fTitle:'Формулы и уравнения',tTitle:'Технические термины',sTitle:'Ключевые моменты',
    noFormulas:'Формулы не обнаружены',noTerms:'Термины не обнаружены',noSummary:'Резюме недоступно',
    dark:'Тёмный режим',light:'Светлый режим',large:'📦 Большой файл — будет разделён.',
    today:'Сегодня',month:'Месяц',year:'Год'},
  zh:{badge:'AI课堂助手',sub:'上传录音 — 获取文字稿、公式、术语和摘要',
    recLabel:'录音',dropH:'将音频文件拖放至此',dropP:'或点击浏览 · mp3 · m4a · wav',
    extLabel:'提取',formulas:'公式',terms:'术语',summary:'摘要',
    modeLabel:'分析模式',fastDesc:'快速公式检测 + Gemini摘要',accDesc:'NVIDIA + Gemini — 最大覆盖',fastBadge:'默认',accBadge:'+Gemini',
    analyze:'分析课程 →',copy:'📋 复制文本',dlTxt:'⬇ 下载 .txt',dlPdf:'📄 下载 PDF',
    tabTr:'文字稿',tabFo:'公式',tabTe:'术语',tabSu:'摘要',
    trTitle:'完整文字稿',fTitle:'公式和方程',tTitle:'技术术语',sTitle:'要点',
    noFormulas:'未检测到公式',noTerms:'未检测到术语',noSummary:'暂无摘要',
    dark:'深色模式',light:'浅色模式',large:'📦 大文件 — 将被分割处理。',
    today:'今天',month:'本月',year:'本年'},
  ja:{badge:'AI講義アシスタント',sub:'録音をアップロード — 文字起こし、数式、用語、要約を取得',
    recLabel:'録音',dropH:'音声ファイルをここにドロップ',dropP:'またはクリックして選択 · mp3 · m4a · wav',
    extLabel:'抽出',formulas:'数式',terms:'用語',summary:'要約',
    modeLabel:'分析モード',fastDesc:'高速数式検出 + Gemini要約',accDesc:'NVIDIA + Gemini — 最大カバレッジ',fastBadge:'デフォルト',accBadge:'+Gemini',
    analyze:'講義を分析 →',copy:'📋 テキストをコピー',dlTxt:'⬇ .txtをダウンロード',dlPdf:'📄 PDFをダウンロード',
    tabTr:'文字起こし',tabFo:'数式',tabTe:'用語',tabSu:'要約',
    trTitle:'全文字起こし',fTitle:'数式と方程式',tTitle:'専門用語',sTitle:'重要ポイント',
    noFormulas:'数式が検出されませんでした',noTerms:'用語が検出されませんでした',noSummary:'要約がありません',
    dark:'ダークモード',light:'ライトモード',large:'📦 大きなファイル — 分割して処理します。',
    today:'今日',month:'今月',year:'今年'},
  tr:{badge:'Yapay Zeka Ders Asistanı',sub:'Kayıt yükle — transkript, formüller, terimler ve özet al',
    recLabel:'Kayıt',dropH:'Ses dosyanızı buraya bırakın',dropP:'veya tıklayın · mp3 · m4a · wav',
    extLabel:'Çıkar',formulas:'Formüller',terms:'Terimler',summary:'Özet',
    modeLabel:'Analiz modu',fastDesc:'Hızlı formül tespiti + Gemini özet',accDesc:'NVIDIA + Gemini — maksimum kapsam',fastBadge:'Varsayılan',accBadge:'+Gemini',
    analyze:'Dersi analiz et →',copy:'📋 Metni kopyala',dlTxt:'⬇ .txt indir',dlPdf:'📄 PDF indir',
    tabTr:'Transkript',tabFo:'Formüller',tabTe:'Terimler',tabSu:'Özet',
    trTitle:'Tam Transkript',fTitle:'Formüller ve Denklemler',tTitle:'Teknik Terimler',sTitle:'Ana Noktalar',
    noFormulas:'Formül tespit edilmedi',noTerms:'Terim tespit edilmedi',noSummary:'Özet mevcut değil',
    dark:'Karanlık mod',light:'Aydınlık mod',large:'📦 Büyük dosya — parçalara bölünecek.',
    today:'Bugün',month:'Ay',year:'Yıl'},
  hi:{badge:'AI लेक्चर असिस्टेंट',sub:'रिकॉर्डिंग अपलोड करें — ट्रांसक्रिप्ट, फॉर्मूले, शब्द और सारांश पाएं',
    recLabel:'रिकॉर्डिंग',dropH:'अपनी ऑडियो फ़ाइल यहाँ छोड़ें',dropP:'या क्लिक करें · mp3 · m4a · wav',
    extLabel:'निकालें',formulas:'फॉर्मूले',terms:'शब्द',summary:'सारांश',
    modeLabel:'विश्लेषण मोड',fastDesc:'तेज़ फॉर्मूला पहचान + Gemini सारांश',accDesc:'NVIDIA + Gemini — पूर्ण कवरेज',fastBadge:'डिफ़ॉल्ट',accBadge:'+Gemini',
    analyze:'लेक्चर विश्लेषण →',copy:'📋 टेक्स्ट कॉपी करें',dlTxt:'⬇ .txt डाउनलोड',dlPdf:'📄 PDF डाउनलोड',
    tabTr:'ट्रांसक्रिप्ट',tabFo:'फॉर्मूले',tabTe:'शब्द',tabSu:'सारांश',
    trTitle:'पूर्ण ट्रांसक्रिप्ट',fTitle:'फॉर्मूले और समीकरण',tTitle:'तकनीकी शब्द',sTitle:'मुख्य बिंदु',
    noFormulas:'कोई फॉर्मूला नहीं मिला',noTerms:'कोई शब्द नहीं मिला',noSummary:'कोई सारांश उपलब्ध नहीं',
    dark:'डार्क मोड',light:'लाइट मोड',large:'📦 बड़ी फ़ाइल — टुकड़ों में विभाजित होगी।',
    today:'आज',month:'महीना',year:'साल'},
  pt:{badge:'Assistente de Aulas com IA',sub:'Envie uma gravação — obtenha transcrição, fórmulas, termos e resumo',
    recLabel:'Gravação',dropH:'Solte seu arquivo de áudio aqui',dropP:'ou clique para procurar · mp3 · m4a · wav',
    extLabel:'Extrair',formulas:'Fórmulas',terms:'Termos',summary:'Resumo',
    modeLabel:'Modo de análise',fastDesc:'Detecção rápida + resumo Gemini',accDesc:'NVIDIA + Gemini — cobertura máxima',fastBadge:'Padrão',accBadge:'+Gemini',
    analyze:'Analisar aula →',copy:'📋 Copiar texto',dlTxt:'⬇ Baixar .txt',dlPdf:'📄 Baixar PDF',
    tabTr:'Transcrição',tabFo:'Fórmulas',tabTe:'Termos',tabSu:'Resumo',
    trTitle:'Transcrição completa',fTitle:'Fórmulas e Equações',tTitle:'Termos técnicos',sTitle:'Pontos principais',
    noFormulas:'Nenhuma fórmula detectada',noTerms:'Nenhum termo detectado',noSummary:'Nenhum resumo disponível',
    dark:'Modo escuro',light:'Modo claro',large:'📦 Arquivo grande — será dividido.',
    today:'Hoje',month:'Mês',year:'Ano'}
};

function setLang(l){
  curLang=l;
  var t=T[l]||T.en;
  var rtl=l==='fa'||l==='ar';
  document.documentElement.setAttribute('dir',rtl?'rtl':'ltr');
  localStorage.setItem('lang',l);
  var s=function(id,v){var e=document.getElementById(id);if(e)e.textContent=v;};
  s('uBadge',t.badge); s('uSub',t.sub);
  s('uRecLabel',t.recLabel); s('uDropH',t.dropH); s('uDropP',t.dropP);
  s('uExtLabel',t.extLabel); s('uFormulas',t.formulas); s('uTerms',t.terms); s('uSummary',t.summary);
  s('uModeLabel',t.modeLabel);
  s('uFastDesc',t.fastDesc); s('uAccDesc',t.accDesc);
  s('uFastBadge',t.fastBadge); s('uAccBadge',t.accBadge);
  s('uDlTxt',t.dlTxt);
  s('pdfBtn',t.dlPdf);
  s('uTabTr',t.tabTr); s('uTabFo',t.tabFo); s('uTabTe',t.tabTe); s('uTabSu',t.tabSu);
  s('uTrTitle',t.trTitle); s('uFTitle',t.fTitle); s('uTTitle',t.tTitle); s('uSTitle',t.sTitle);
  s('uNoFormulas',t.noFormulas);
  s('uToday',t.today); s('uMonth',t.month); s('uYear',t.year);
  var go=document.getElementById('go'); if(go)go.textContent=t.analyze;
  var cp=document.getElementById('cpbtn'); if(cp)cp.textContent=t.copy;
  var isDark=document.body.classList.contains('dark');
  var tl=document.getElementById('tl'); if(tl)tl.textContent=isDark?t.light:t.dark;
}

(function(){
  var s=localStorage.getItem('t'),isDark=s==='d';
  document.body.classList.remove('light','dark');
  document.body.classList.add(isDark?'dark':'light');
  var tl=document.getElementById('tl');
  if(tl)tl.textContent=isDark?'Light mode':'Dark mode';
  var saved=localStorage.getItem('lang')||'en';
  document.getElementById('langSel').value=saved;
  window.addEventListener('load',function(){setLang(saved);});
})();

(function(){
  var ua=navigator.userAgent;
  var isWebView=ua.indexOf('wv')>-1||ua.indexOf('WebView')>-1||(ua.indexOf('Android')>-1&&ua.indexOf('Version/')>-1);
  if(isWebView){var btn=document.getElementById('pdfBtn');if(btn)btn.style.display='none';}
})();

(function(){
  fetch('/stats').then(function(r){return r.json();}).then(function(d){
    document.getElementById('statToday').textContent=d.today||0;
    document.getElementById('statMonth').textContent=d.month||0;
    document.getElementById('statYear').textContent=d.year||0;
  }).catch(function(){});
})();

function toggleTheme(){
  var isDark=document.body.classList.contains('dark');
  document.body.classList.toggle('dark',!isDark);
  document.body.classList.toggle('light',isDark);
  var t=T[curLang]||T.en;
  document.getElementById('tl').textContent=isDark?t.dark:t.light;
  localStorage.setItem('t',isDark?'l':'d');
}

function selMode(m){
  document.getElementById('mf').classList.toggle('sel',m==='fast');
  document.getElementById('ma').classList.toggle('sel',m==='acc');
}

var drop=document.getElementById('drop'),fi=document.getElementById('fi');
fi.addEventListener('change',function(e){if(e.target.files[0])setFile(e.target.files[0]);});
drop.addEventListener('dragover',function(e){e.preventDefault();drop.classList.add('over');});
drop.addEventListener('dragleave',function(){drop.classList.remove('over');});
drop.addEventListener('drop',function(e){e.preventDefault();drop.classList.remove('over');if(e.dataTransfer.files[0])setFile(e.dataTransfer.files[0]);});

function setFile(f){
  selFile=f;
  var mb=(f.size/1024/1024).toFixed(1);
  var fn=document.getElementById('fn');
  fn.textContent='\u2713 '+(f.name.length>35?f.name.substring(0,32)+'...':f.name)+' \u00b7 '+mb+' MB';
  fn.style.display='inline-flex';
  document.getElementById('go').disabled=false;
  var ib=document.getElementById('ib');
  var t=T[curLang]||T.en;
  if(parseFloat(mb)>15){ib.innerHTML=t.large;ib.style.display='block';}
  else ib.style.display='none';
}

function showTab(t){
  var map={tr:'trTab',fo:'fTab',te:'tTab',su:'sTab'};
  Object.keys(map).forEach(function(k){document.getElementById(map[k]).style.display=k===t?'block':'none';});
  document.querySelectorAll('.tab').forEach(function(el,i){el.classList.toggle('on',['tr','fo','te','su'][i]===t);});
}

function prog(pct,stage){
  document.getElementById('pb').style.width=pct+'%';
  document.getElementById('pp').textContent=pct+'%';
  document.getElementById('ps').textContent=stage;
  document.getElementById('ltxt').textContent=stage;
}

function resample(input,inRate,outRate){
  if(inRate===outRate)return input;
  var step=inRate/outRate,outLen=Math.floor(input.length/step),out=new Float32Array(outLen);
  for(var i=0;i<outLen;i++)out[i]=input[Math.floor(i*step)];
  return out;
}

function buildWav(pcm,sr){
  var n=pcm.length,buf=new ArrayBuffer(44+n),v=new DataView(buf);
  var ws=function(o,s){for(var i=0;i<s.length;i++)v.setUint8(o+i,s.charCodeAt(i));};
  ws(0,'RIFF');v.setUint32(4,36+n,true);ws(8,'WAVE');
  ws(12,'fmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);
  v.setUint32(24,sr,true);v.setUint32(28,sr,true);v.setUint16(32,1,true);v.setUint16(34,8,true);
  ws(36,'data');v.setUint32(40,n,true);
  for(var i=0;i<n;i++){var s=Math.max(-1,Math.min(1,pcm[i]));v.setUint8(44+i,Math.round((s+1)*127.5));}
  return new Blob([buf],{type:'audio/wav'});
}

async function toWavChunks(file){
  prog(5,'\uD83D\uDD04 Decoding audio...');
  var ctx=new(window.AudioContext||window.webkitAudioContext)();
  var decoded=await ctx.decodeAudioData(await file.arrayBuffer());
  await ctx.close();
  prog(15,'\uD83D\uDD04 Converting...');
  var nCh=decoded.numberOfChannels,n=decoded.length,mono=new Float32Array(n);
  for(var ch=0;ch<nCh;ch++){var src=decoded.getChannelData(ch);for(var i=0;i<n;i++)mono[i]+=src[i];}
  if(nCh>1)for(var i=0;i<n;i++)mono[i]/=nCh;
  var rs=resample(mono,decoded.sampleRate,TARGET_SR);
  var cs=TARGET_SR*CHUNK_SECS,chunks=[];
  for(var s=0;s<rs.length;s+=cs)chunks.push(buildWav(rs.subarray(s,Math.min(s+cs,rs.length)),TARGET_SR));
  prog(22,'\u2705 '+chunks.length+' chunk'+(chunks.length>1?'s':'')+' ready');
  return chunks;
}

function upload(blob,idx,total){
  return new Promise(function(res,rej){
    var fd=new FormData();
    fd.append('file',blob,'chunk_'+idx+'.wav');
    fd.append('action','transcribe');
    var xhr=new XMLHttpRequest();
    xhr.open('POST','/process');
    xhr.upload.addEventListener('progress',function(e){
      if(e.lengthComputable){
        var pct=Math.round(22+((idx+e.loaded/e.total)/total)*45);
        prog(pct,total>1?'\uD83D\udce4 Part '+(idx+1)+'/'+total+' \u2014 '+Math.round(e.loaded/e.total*100)+'%':'\uD83D\udce4 Uploading...');
      }
    });
    xhr.addEventListener('load',function(){xhr.status<300?res(xhr.responseText):rej(new Error(xhr.responseText));});
    xhr.addEventListener('error',function(){rej(new Error('Network error'));});
    xhr.send(fd);
  });
}

async function run(){
  if(!selFile)return;
  var useBoth=document.getElementById('ma').classList.contains('sel');
  var langEl=document.getElementById('langSel');
  var lang=langEl?langEl.value:'en';
  document.getElementById('go').disabled=true;
  document.getElementById('loading').style.display='block';
  document.getElementById('result').style.display='none';
  document.getElementById('err').style.display='none';
  var opts={formulas:document.getElementById('cf').checked,terms:document.getElementById('ct').checked,summary:document.getElementById('cs').checked};
  try{
    var chunks=await toWavChunks(selFile);
    var parts=[];
    for(var i=0;i<chunks.length;i++){
      var txt=(await upload(chunks[i],i,chunks.length)).trim();
      if(txt)parts.push(txt);
      prog(Math.round(22+((i+1)/chunks.length)*45),'\u2705 Part '+(i+1)+'/'+chunks.length+' done');
    }
    var tx=parts.join(' ');
    if(!tx||tx.length<10)throw new Error('Transcript empty \u2014 check your audio file');
    prog(70,useBoth?'\uD83D\uDD2C NVIDIA + Gemini analyzing...':'\uD83D\uDD2C NVIDIA analyzing...');
    var fd=new FormData();
    fd.append('action','analyze');fd.append('text',tx);
    fd.append('opts',JSON.stringify(opts));fd.append('useBoth',useBoth?'true':'false');
    fd.append('lang',lang);
    var r=await fetch('/process',{method:'POST',body:fd});
    var j=await r.text();
    if(!r.ok)throw new Error(j);
    prog(100,'\u2705 Done!');
    rData=JSON.parse(j);
    rData.transcript=rData.translatedText||tx;
    render(opts,useBoth);
  }catch(e){
    document.getElementById('err').textContent='Error: '+e.message;
    document.getElementById('err').style.display='block';
  }finally{
    document.getElementById('loading').style.display='none';
    document.getElementById('go').disabled=false;
  }
}

var TM={chemical:{c:'tc',l:'Chemical'},statistical:{c:'ts',l:'Statistical'},mathematical:{c:'tm',l:'Mathematical'},pharmacological:{c:'tp',l:'Pharmacological'},other:{c:'to',l:'Other'}};

function render(opts,useBoth){
  var t=T[curLang]||T.en;
  document.getElementById('trTxt').textContent=rData.transcript||'';
  document.getElementById('fleg').innerHTML=
    '<span class="li lc">Chemical</span><span class="li ls">Statistical</span><span class="li lm">Mathematical</span><span class="li lp">Pharmacological</span>'+
    (useBoth?'<span class="li lb" style="margin-left:auto">Both</span><span class="li lg">Gemini</span><span class="li ln">NVIDIA</span>':'');
  if(opts.formulas&&rData.formulas&&rData.formulas.length){
    document.getElementById('flist').innerHTML=rData.formulas.map(function(f){
      var tm=TM[f.type]||TM.other;
      var src=f.source==='both'?'sb':f.source==='nvidia'?'sn':'sg';
      var srcLbl=f.source==='both'?'Both':f.source==='nvidia'?'NVIDIA':'Gemini';
      var sb=useBoth?'<span class="fsrc '+src+'">'+srcLbl+'</span>':'';
      var ctx=f.context?'<div class="fctx">\uD83D\uDCCD "'+f.context+'"</div>':'';
      return '<div class="fi"><div class="fi-top"><span class="ftype '+tm.c+'">'+tm.l+'</span><span class="fcode">'+f.formula+'</span>'+sb+'</div><div class="fname2">'+f.name+'</div>'+ctx+'</div>';
    }).join('');
  } else if(opts.formulas){
    document.getElementById('flist').innerHTML='<p style="color:var(--mu);font-size:12px;text-align:center;padding:24px 0">'+t.noFormulas+'</p>';
  }
  if(rData.terms&&rData.terms.length)
    document.getElementById('tlist').innerHTML=rData.terms.map(function(tm){return '<span class="ttag">'+tm.term+'</span>';}).join('');
  else
    document.getElementById('tlist').innerHTML='<p style="color:var(--mu);font-size:12px;text-align:center;padding:16px 0">'+t.noTerms+'</p>';
  if(rData.points&&rData.points.length)
    document.getElementById('slist').innerHTML=rData.points.map(function(p){return '<div class="spoint"><span class="sdot"></span>'+p+'</div>';}).join('');
  else
    document.getElementById('slist').innerHTML='<p style="color:var(--mu);font-size:12px;text-align:center;padding:16px 0">'+t.noSummary+'</p>';
  document.getElementById('result').style.display='block';
  showTab('tr');
}

function getTx(){return rData.transcript||'';}
function baseName(){var n=selFile?selFile.name:'lecture';var d=n.lastIndexOf('.');return d>0?n.substring(0,d):n;}

async function cpTxt(){
  try{
    await navigator.clipboard.writeText(getTx());
    var b=document.getElementById('cpbtn');
    b.textContent='\u2713 Copied!';b.classList.add('ok');
    setTimeout(function(){b.textContent=(T[curLang]||T.en).copy;b.classList.remove('ok');},2000);
  }catch(e){alert('Copy failed.');}
}
function dlTxt(){
  var a=document.createElement('a');
  a.href=URL.createObjectURL(new Blob([getTx()],{type:'text/plain;charset=utf-8'}));
  a.download=baseName()+'_notes.txt';
  document.body.appendChild(a);a.click();document.body.removeChild(a);
}
function dlPdf(){
  var n=baseName(),txt=getTx();
  if(!window.open||navigator.userAgent.indexOf('wv')>-1||navigator.userAgent.indexOf('WebView')>-1){
    var a=document.createElement('a');
    a.href=URL.createObjectURL(new Blob([txt],{type:'text/plain;charset=utf-8'}));
    a.download=n+'_notes.txt';document.body.appendChild(a);a.click();document.body.removeChild(a);return;
  }
  var w=window.open('','_blank');
  if(!w){var a=document.createElement('a');a.href=URL.createObjectURL(new Blob([txt],{type:'text/plain;charset=utf-8'}));a.download=n+'_notes.txt';document.body.appendChild(a);a.click();document.body.removeChild(a);return;}
  var html='<!DOCTYPE html><html><head><meta charset="UTF-8"><title>'+n+'<\/title>';
  html+='<style>body{font-family:Arial,sans-serif;font-size:13px;line-height:1.8;padding:40px;max-width:800px;margin:0 auto;}pre{white-space:pre-wrap;word-break:break-word;}<\/style>';
  html+='<\/head><body><h1 style="font-size:18px">'+n+'<\/h1>';
  html+='<pre>'+txt.replace(/</g,'&lt;').replace(/>/g,'&gt;')+'<\/pre>';
  html+='<scr'+'ipt>window.onload=function(){window.print();}<\/scr'+'ipt>';
  html+='<\/body><\/html>';
  w.document.write(html);w.document.close();
}
<\/script>
</body>
</html>`;}
