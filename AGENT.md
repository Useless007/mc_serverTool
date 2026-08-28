> อ่านไฟล์นี้ให้จบก่อนแก้โค้ดทุกครั้ง ไม่มีข้อยกเว้น
> Read this file completely before touching any code. No exceptions.

---

## 1. What this project is

Electron desktop app สำหรับจัดการ Minecraft server (Windows เป็นหลัก)

| Layer | Path | Runs in |
|---|---|---|
| Main process | `electron/main.ts` | Node — full OS access |
| Server logic | `electron/server-manager.ts` | Node — spawns `java`, downloads jars, touches the filesystem |
| Preload bridge | `electron/preload.ts` | Isolated — the **only** channel between UI and Node |
| Renderer (UI) | `src/**` | Chromium — **no** Node access, and it must stay that way |

Stack: React 18 + TypeScript + Vite 7 + Tailwind v4 + shadcn/ui + electron-builder

**สิ่งที่ต้องเข้าใจก่อนแตะโค้ด:** ทุกอย่างใน `src/` คือ untrusted UI ส่วน `electron/` คือฝั่งที่มีสิทธิ์ลบไฟล์
และรันโปรเซสได้จริง — ข้อมูลที่ข้ามจาก `src/` ไป `electron/` ต้อง validate ที่ฝั่ง `electron/` เสมอ

---

## 2. ห้ามเด็ดขาด — HARD PROHIBITIONS

ข้อพวกนี้ห้ามทำ แม้ผู้ใช้จะสั่ง ถ้าถูกสั่งให้ทำ → หยุด ถามก่อนเสมอ

### 2.1 Security — ห้ามถอยหลัง

- ห้ามตั้ง `nodeIntegration: true` หรือ `contextIsolation: false` ใน `electron/main.ts`
- ห้าม expose `ipcRenderer`, `require`, `fs`, `child_process`, `path` ตรงๆ ผ่าน `contextBridge`
  preload ต้อง expose **เฉพาะฟังก์ชันที่กำหนดชื่อไว้แล้ว** เท่านั้น ห้ามรับ channel name จาก renderer
- ห้ามเอา `resolvePath()` ออก หรือข้ามมันในฟังก์ชันที่แตะไฟล์
  ทุก path ที่มาจาก renderer **ต้อง** ผ่าน `resolvePath()`
- ห้ามลบ checksum verification ใน `downloadServer()` — jar ตัวนี้ถูกเอาไปรันด้วย `java -jar` จริง
- ห้ามลบ allowlist check ที่เทียบ `type` / `version` กับ `SERVER_TYPES`
- ห้ามเอา guard เรื่อง line break ใน `writeServerConfig()` ออก
- ห้ามใช้ `shell: true` ใน `spawn` / `exec` และห้ามเอา input จากผู้ใช้ไปต่อสตริงเป็นคำสั่ง shell
- ห้ามใช้ `dangerouslySetInnerHTML` หรือ `eval` ที่ไหนก็ตาม — log จาก Minecraft server คือ untrusted input
- ห้าม hardcode token / API key / password ลงในโค้ด

### 2.1.1 Secrets — ngrok / Cloudflare token (เพิ่มหลังมีฟีเจอร์ tunnel)

- ห้ามส่ง token เป็น **command-line argument** เด็ดขาด (`--token`, `add-authtoken <token>`)
  argv ของโปรเซสที่รันอยู่ โปรเซสอื่นในเครื่องอ่านได้หมด (`ps`, `/proc/<pid>/cmdline`,
  `Get-CimInstance Win32_Process`) → ต้องส่งผ่าน **env** เท่านั้น (`NGROK_AUTHTOKEN`, `TUNNEL_TOKEN`)
- ห้ามเก็บ **Cloudflare account API token** ลงดิสก์ มันคือ credential ของทั้งบัญชี ไม่ใช่แค่ tunnel
  เก็บไว้ใน memory พอ ให้ผู้ใช้กรอกใหม่หลังเปิดแอป
- ห้ามเก็บ ngrok authtoken ลงดิสก์ เก็บแค่ flag `ngrokConfigured: boolean`
- `manager-state.json` มี tunnel token อยู่ → ต้อง `mode: 0o600` เสมอ ห้ามลดสิทธิ์กลับ
- ห้ามส่ง token กลับไปฝั่ง renderer ไม่ว่ากรณีใด `TunnelStatus` ส่งได้แค่ `tokenConfigured: boolean`
- ห้าม log token ลง console buffer หรือ `pushLog()`

### 2.1.2 Public exposure — tunnel เปิดเซิร์ฟให้คนทั้งอินเทอร์เน็ต

- ห้ามเอา guard `publicExposureBlocker()` ออก
  `online-mode=false` + ไม่มี whitelist + เปิด tunnel = ใครก็เข้ามาสวมชื่อเจ้าของและได้ op
- ห้ามลืม `stop()` tunnel ตอนปิดแอป ไม่งั้นโปรเซส tunnel ค้าง เซิร์ฟยังโดนเปิดอยู่
  ทั้งที่ปิดแอปไปแล้ว และไม่มี UI ให้ปิด
- ห้ามโหลด binary (ngrok / cloudflared / JDK) มารันโดยไม่ verify checksum ถ้า upstream มีให้

### 2.2 Data loss — ผู้ใช้มี world จริงอยู่ในโฟลเดอร์นั้น

- ห้ามเขียนทับ `server.jar` โดยตรง — ต้องโหลดลง `.part` แล้วค่อย `rename` ตอนสำเร็จเท่านั้น
- ห้าม `fs.rmSync(..., { recursive: true })` บนอะไรที่ยังไม่ผ่าน `resolvePath()`
- ห้าม kill โปรเซส java ด้วย `.kill()` ตอนปิดแอป — ต้องส่งคำสั่ง `stop` แล้วรอ ไม่งั้น world เสีย
- ห้าม spawn java ตัวที่สองบนโฟลเดอร์เดิมขณะตัวแรกยังไม่ตาย
  (`startServer` ต้อง `await this.stopServer()` เสมอ)

### 2.3 Scope — ห้ามทำเกินที่สั่ง

- ห้ามเพิ่ม dependency ใหม่ ถ้าเขียนเองได้ใน ~20 บรรทัด — ถามก่อนเสมอ
- ห้าม "ปรับปรุง" ไฟล์ที่ไม่เกี่ยวกับงานที่ถูกสั่ง
- ห้าม reformat หรือจัด import ใหม่ทั้งไฟล์ — diff ต้องเล็กและอ่านรู้เรื่อง
- ห้ามแตะไฟล์ใน `src/components/ui/**` (shadcn generated) นอกจากถูกสั่งตรงๆ
- ห้ามสร้าง abstraction / interface / factory / config layer ที่ยังไม่มีคนใช้จริงตอนนี้
- ห้ามสร้างไฟล์ใหม่ ถ้าแก้ไฟล์เดิมได้
- ห้าม commit / push / เปิด PR เอง ถ้าไม่ได้ถูกสั่งตรงๆ

### 2.4 Repo hygiene

- ห้าม commit `node_modules/`, `dist/`, `dist-electron/`, `release/`, `servers/`, `.env`, `.omc/`, `.codegraph/`
- ห้ามแก้ `package-lock.json` ด้วยมือ
- ห้ามอัป dependency version แบบเหมารวมโดยไม่ได้ถูกสั่ง

---

## 3. คำเตือน — ความผิดพลาดที่เคยเกิดขึ้นจริงในโปรเจกต์นี้

ทั้งหมดนี้คือของจริงที่เคยหลุดเข้า repo มาแล้ว อ่านไว้ อย่าทำซ้ำ

| # | สิ่งที่เกิด | ทำไมถึงพลาด | บทเรียน |
|---|---|---|---|
| 1 | `this.stopServer()` เขียนโดยไม่ใส่ `await` | เห็นว่า "เรียกแล้ว" เลยคิดว่าจบ | **ฟังก์ชัน `async` ทุกตัวต้อง `await` หรือจงใจ `void` พร้อมคอมเมนต์** |
| 2 | `createWriteStream(server.jar)` ก่อนโหลดเสร็จ | ไม่ได้คิดถึงเคสโหลดพัง | ไฟล์เดิมของผู้ใช้ถูกล้างเหลือ 0 byte — **เขียนลง temp ก่อนเสมอ** |
| 3 | `execSync('java -version')` อ่านแต่ stdout | เดาว่า version ออกทาง stdout | java เขียน version ลง **stderr** → เลข version เป็น `unknown` ตลอด — **อย่าเดา I/O ต้องลองจริง** |
| 4 | ช่อง "Memory allocation (GB)" ใน CreateServer | เขียน UI แล้วลืมต่อสายไปหลังบ้าน | state ถูก set แต่ไม่เคยถูกส่งไปไหน — **UI ที่ไม่ได้ต่อสาย = bug ไม่ใช่ feature** |
| 5 | `spawn-protection` อยู่ใน `BOOLEAN_KEYS` | เห็นชื่อคล้าย boolean เลยใส่ | มันเป็นตัวเลข → UI เขียน `"true"` ลงไป ค่าพัง — **เช็คของจริงก่อน อย่าเดาจากชื่อ** |
| 6 | `download-server` เขียน meta ลงไฟล์ แต่ไม่อัปเดต state ใน memory | ทดสอบแค่ว่าไฟล์ถูกเขียน | UI ขึ้นข้อมูลผิดจนกว่าจะรีสตาร์ทแอป — **แก้ persist แล้วต้องแก้ in-memory ด้วย** |
| 7 | `set-server-dir` IPC ที่ไม่มีใครเรียก | เขียน handler เผื่อไว้ | เปิดช่องให้ renderer ย้าย sandbox root ไปไหนก็ได้ — **โค้ดที่ไม่มีคนใช้ = ช่องโหว่ ให้ลบ** |
| 8 | `deletePlugin` ไม่ผ่าน `resolvePath()` | ฟังก์ชันอื่นผ่านหมดแล้วเลยชะล่าใจ | `../../../file` ลบไฟล์นอกโฟลเดอร์ได้ — **แก้ที่เดียว ต้องไล่เช็คทุก caller** |
| 9 | log ฝั่ง renderer ไม่มีเพดาน | ฝั่ง main cap ไว้แล้วเลยคิดว่าพอ | server ที่รันยาวๆ ทำ array บวมไม่หยุด — **cap ทั้งสองฝั่ง** |
| 10 | `WriteStream` ไม่มี `.on('error')` | คิดว่า try/catch ครอบพอ | stream error = unhandled event → **แอปหลักดับทั้งตัว** ไม่ใช่แค่ promise reject |
| 11 | `cloudflared tunnel run --token <token>` | เอาตามตัวอย่างใน doc มาตรงๆ | token โผล่ใน argv ทุกโปรเซสในเครื่องอ่านได้ — **secret ต้องไปทาง env เท่านั้น** |
| 12 | เก็บ Cloudflare API token ลง `manager-state.json` | คิดว่าเก็บไว้ใช้ต่อรอบหน้า | ไม่มีโค้ดตรงไหนอ่านกลับมาเลย (`getCfToken()` ไม่มี caller) — **เก็บ credential ทั้งบัญชีไว้ฟรีๆ โดยไม่ได้ประโยชน์** |
| 13 | เปิด tunnel ได้เลยโดยไม่เช็ค `online-mode` | คิดแค่ว่า "ทำให้เพื่อนเข้าได้" | `online-mode=false` + public = ใครก็สวมชื่อเจ้าของได้ — **ฟีเจอร์ที่เปิดสู่อินเทอร์เน็ตต้องมี guard เสมอ** |
| 14 | ปิดแอปแล้วไม่ `stop()` tunnel | ลืมว่ามันเป็นคนละโปรเซส | tunnel ค้างเปิดเซิร์ฟทิ้งไว้ โดยไม่มี UI ให้ปิด — **ทุก child process ต้องมีทางตายตอนปิดแอป** |
| 15 | JDK ~200MB โหลดเก็บใน `chunks[]` แล้ว `Buffer.concat` | ก๊อป pattern เดิมจาก `downloadServer` มาใช้ | กิน RAM ~2 เท่าของไฟล์ และไม่ verify checksum ทั้งที่ Adoptium มีให้ — **pattern ที่เคยผิด อย่าก๊อปไปใช้ซ้ำ** |
| 16 | `getCustomJavaPath()` เดินไล่ทุกไฟล์ใน JDK แบบ sync ทุกครั้งที่เรียก | เขียนให้มัน "หาเจอ" อย่างเดียว | ถูกเรียกทุก `get-java-info` และทุกครั้งที่ start → freeze UI — **sync I/O ใน main process = UI ค้าง** |
| 17 | `Expand-Archive -LiteralPath '${path}'` | ต่อสตริงใส่ PowerShell | ชื่อผู้ใช้ Windows ที่มี `'` (เช่น `O'Brien`) ทำคำสั่งพัง — **อย่าต่อสตริงเป็นคำสั่ง ใช้ bound parameter** |
| 18 | `execSync(\`"${customPath}" -version\`)` | อยากได้เร็วๆ | `execSync` = ผ่าน shell + path มีชื่อผู้ใช้อยู่ และ fallback คืนเลข `21.0.6` ที่**แต่งขึ้นเอง** — **อย่ารายงานค่าที่ไม่ได้วัดจริง** |

**Pattern ที่เห็นซ้ำๆ:** พลาดเพราะ *เดา* แล้ว *ไม่ลองรัน*
ทั้งสิบข้อจับได้ด้วยการรันของจริงหนึ่งครั้ง

---

## 4. Workflow บังคับ

### ก่อนเริ่ม

1. อ่านไฟล์ที่จะแก้ **ทั้งไฟล์** ก่อน อย่าแก้จากที่จำได้หรือเดา
2. `grep` หา caller ทุกตัวของฟังก์ชันที่จะแก้ — แก้ที่ต้นทางที่เดียว ไม่ใช่ patch ทีละจุดเรียก
3. งานไม่ชัด → **ถามก่อน** ห้ามเดาแล้วลุย

### ก่อนบอกว่าเสร็จ — ต้องผ่านครบทุกข้อ

```bash
npx tsc --noEmit
```

```bash
npm run build
```

`tsconfig.json` มี `"include": ["src"]` เท่านั้น → **`electron/` ไม่ถูก typecheck โดยอัตโนมัติ**
ถ้าแก้อะไรใน `electron/` ต้องสั่งเพิ่มเอง:

```bash
npx tsc --noEmit --skipLibCheck --strict --module esnext --moduleResolution bundler --target es2020 --lib es2022,dom --types node,electron electron/main.ts electron/preload.ts
```

### กฎเหล็กข้อสุดท้าย

> **ห้ามพูดว่า "เสร็จแล้ว" / "แก้ให้แล้ว" / "น่าจะใช้ได้" ถ้ายังไม่ได้รันจริง**
>
> ถ้ารันไม่ได้ ให้พูดตรงๆ ว่า *"แก้แล้วแต่ยังไม่ได้ทดสอบ — ต้องลอง X ก่อน"*
> การรายงานว่าเสร็จทั้งที่ยังไม่ได้ตรวจ คือความผิดพลาดที่แพงที่สุด

ห้ามนับสิ่งเหล่านี้เป็นหลักฐานว่าเสร็จ: โค้ดที่ "ดูถูกต้อง", TODO ที่ทิ้งไว้, `test.skip`,
ฟังก์ชันเปล่า, หรือคำอธิบายยาวๆ ที่ไม่มีผลรันจริงประกอบ

---

## 5. Style

- TypeScript strict — ห้ามใช้ `any` ห้ามใส่ `@ts-ignore` เพื่อกลบ error
- ไม่มี semicolon, single quote, 2-space indent (ตามของเดิมในไฟล์)
- Path alias `@/` ชี้ไป `src/` (renderer เท่านั้น — `electron/` ใช้ relative import)
- Comment เขียนเมื่ออธิบาย **ทำไม** เท่านั้น อย่าเขียนอธิบายว่าโค้ดทำอะไร
- IPC handler ต้อง return `{ success: boolean, error?: string }` ให้เหมือนตัวอื่นๆ

---

## 6. Known gaps — รู้อยู่แล้วว่ายังไม่เสร็จ (อย่าเพิ่งไปแตะถ้าไม่ได้ถูกสั่ง)

- 🔴 **Cloudflare Tunnel ใช้กับ Minecraft ไม่ได้จริง** — ingress ตั้งเป็น `http://localhost:port`
  แต่ Minecraft เป็น **TCP ดิบ ไม่ใช่ HTTP** และ `*.cfargotunnel.com` **ไม่มี public DNS record**
  (resolve ได้เฉพาะจากในเครือข่าย Cloudflare) → URL ที่แอปโชว์ ไม่มีผู้เล่นคนไหนต่อได้
  ถ้าจะทำจริงต้องใช้ Spectrum (เสียเงิน) หรือให้ฝั่งผู้เล่นรัน `cloudflared access tcp` เอง
  **ตอนนี้ควรซ่อนหรือติดป้าย experimental ไว้ก่อน** — ngrok TCP ใช้ได้ปกติ
- `store.seedFromLegacy()` เขียนไว้แต่ไม่มีใครเรียก และตอนเปิดแอปยังโหลด dir จาก
  `server-dir.json` แบบเดิม ไม่ได้อ่านจาก `store.getActiveServer()` → active server ที่เลือกไว้
  กับ dir ที่โหลดจริงอาจไม่ตรงกัน
- ngrok / cloudflared binary ยังโหลดมารันโดยไม่ verify checksum (upstream ไม่ publish hash
  ที่เสถียร) — JDK verify sha256 แล้ว, vanilla server.jar verify sha1 แล้ว
- `cloudflared` โหลดจาก `releases/latest` = ไม่ pin version ได้ไบนารีอะไรมาก็รัน
- ทุกครั้งที่ start tunnel แล้วไม่มี `cfTunnel` เก็บไว้ จะไปสร้าง tunnel ใหม่ในบัญชี Cloudflare
  ของผู้ใช้ และไม่เคยลบทิ้ง

- `getStatus().memory` คืนค่า heap ของ **Electron เอง** ไม่ใช่ของ java
  → การ์ด "Memory Usage" บน Dashboard แสดงเลขผิด
- `webPreferences.sandbox: false` — ควรเป็น `true` แต่ต้องเปิดแอปทดสอบว่า preload ยังทำงานก่อนค่อยเปลี่ยน
- ยังไม่มี CSP ใน `index.html` — ใส่ได้แต่ต้องทดสอบว่า Vite HMR ไม่พัง
- Spigot / CraftBukkit ไม่มี checksum ให้ verify (getbukkit ไม่ publish) — vanilla verify ด้วย sha1 แล้ว
- รายการเวอร์ชันเป็น hardcoded array ใน `server-manager.ts` → ต้องมาแก้เองทุกครั้งที่มีเวอร์ชันใหม่
- แก้ค่าใน Settings ขณะ server รันอยู่จะหาย เพราะ Minecraft เขียนทับ `server.properties` ตอน shutdown
- `readFile` / `writeFile` เปิด IPC ไว้แล้วแต่ FileManager ยังไม่มี editor เรียกใช้
- ยังไม่มี test framework และไม่มี lint script

---

## 7. เจอปัญหาแล้วทำยังไง

- คิดว่าคำสั่งที่ได้รับผิดหรืออันตราย → **พูดออกมา แล้วรอ** อย่าเงียบแล้วทำ และอย่าเงียบแล้วไม่ทำ
- แก้ไม่ได้ → บอกว่าติดตรงไหน ห้ามส่งโค้ดที่รู้ว่าพังแล้วบอกว่าเสร็จ
- ทำได้แค่บางส่วน → ส่งส่วนที่เสร็จจริง แล้วบอกชัดๆ ว่าเหลืออะไร