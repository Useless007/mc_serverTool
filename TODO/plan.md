# 🚀 Minecraft Server Manager - Implementation Plan (TODO)

แผนการพัฒนาระบบเสริมประสิทธิภาพสำหรับ **Minecraft Server Manager** เพื่อรองรับการเปิดเซิฟเวอร์หลายตัว (Multi-Server), การเชื่อมต่อเครือข่ายภายนอกผ่าน **Ngrok** และ **Cloudflare Tunnel**, ระบบ **Online Plugin Browser** ที่ดึงข้อมูลปลั๊กอินสดจากเว็บ และระบบ **Java Detector & Auto-Installer**

---

## 🎯 รายการฟีเจอร์และข้อกำหนด (Requirements & Tasks)

### 1. 🔑 Ngrok Integration System
- [x] เพิ่มช่องใส่ Auth Token สำหรับ Ngrok ในหน้าตั้งค่า/เน็ตเวิร์ก
- [x] ปุ่มเปิด/ปิด (Start/Stop) Ngrok Tunnel ใช้งานได้ในคลิกเดียว
- [x] Real-time Status indicator (แสดงสถานะ Running/Stopped, Public Address tcp://..., IP/Port)

### 2. ☁️ Cloudflare Tunnel Integration System
- [x] เพิ่มช่องใส่ Tunnel Token สำหรับ Cloudflare Tunnel
- [x] ปุ่มเปิด/ปิด (Start/Stop) Cloudflare Tunnel
- [x] Status indicator (แสดงสถานะ Connecting, Active, Domain Name, Error Logs)

### 3. 🗂️ Multi-Server Management & Saved Server History
- [x] ระบบจัดเก็บประวัติเซิฟเวอร์ทั้งหมดที่เคยสร้างหรือเคยเพิ่มไว้ (Server Registry / Profiles)
- [x] หน้า UI หรือ Dropdown Selector ให้ผู้ใช้เลือกสลับเซิฟเวอร์ที่ต้องการใช้งาน (Switch Active Server)
- [x] บันทึกการตั้งค่ารายเซิฟเวอร์ (ชื่อ, ที่อยู่โฟลเดอร์, ประเภท Vanilla/Paper/Spigot, เวอร์ชั่น, พอร์ต, หน่วยความจำ)

### 4. 🧩 Online Plugin Browser & 1-Click Installation
- [x] เพิ่มระบบค้นหาและดึงข้อมูลปลั๊กอินสดจาก Web APIs (Spiget API สำหรับ SpigotMC และ Modrinth API)
- [x] แสดงรายการปลั๊กอินพร้อมรูปไอคอน, ชื่อ, คำอธิบายย่อ, ยอดดาวน์โหลด และเรตติ้ง
- [x] ปุ่ม 1-Click Install เพื่อดาวน์โหลดไฟล์ .jar ลงโฟลเดอร์ /plugins ของเซิฟเวอร์ที่เปิดอยู่โดยอัตโนมัติ

### 5. ☕ Java Detection & Automated Installer System
- [x] ตรวจสอบเวอร์ชันและที่อยู่ของ Java JDK บนเครื่องผู้ใช้โดยอัตโนมัติ
- [x] แสดงสถานะความพร้อมของ Java (พร้อมแจ้งเตือนหาก Java ไม่ตรงกับเวอร์ชัน Minecraft ที่เลือก เช่น Java 17/21 สำหรับ Minecraft 1.20+)
- [x] ปุ่มดาวน์โหลดและติดตั้ง Java OpenJDK (Adoptium / Eclipse Temurin) อัตโนมัติเมื่อยังไม่มี Java บนเครื่อง

### 6. 🎨 Logo & Branding
- [x] เปลี่ยน logo โปรแกรมใน Sidebar ให้ใช้ไฟล์ logo.png จริง
- [x] เปลี่ยน Window icon (Taskbar) ให้ใช้ logo.ico
- [x] Installer EXE และ Portable EXE ใช้ logo.ico เดียวกัน
- [x] Build เป็น .exe ทั้ง Setup Installer และ Portable

---

## 🆕 Feature ที่กำลังจะทำ (Upcoming)

### 7. 👥 Players Tab — ดูและจัดการผู้เล่น
- [ ] แสดงรายชื่อผู้เล่นที่ online อยู่ realtime (parse console list command)
- [ ] ตรวจจับ join/leave event จาก console log โดยอัตโนมัติ
- [ ] Actions ต่อผู้เล่น: Kick, Ban, OP/De-OP, Change Gamemode, Teleport (x,y,z)
- [ ] Whitelist Panel: ดู/เพิ่ม/ลบ whitelist.json + toggle whitelist-enforcement
- [ ] Ban List Panel: ดู banned-players.json + ปุ่ม Unban

### 8. 📊 Dashboard Graphs — กราฟสถานะ realtime
- [ ] ติดตั้ง Recharts library
- [ ] กราฟ Memory Usage (MB) — Area chart, rolling 5 นาที
- [ ] กราฟ Players Online — Bar chart, rolling 5 นาที
- [ ] กราฟ TPS (Ticks/sec) — Line chart (parse ms/tick จาก console), rolling 5 นาที
- [ ] เพิ่ม stat card Players Online ใน Dashboard header row
- [ ] IPC: get-metrics-history + push event on-metrics-updated ทุก 5 วิ

---

## 🛠️ โครงสร้างไฟล์และส่วนประกอบที่ต้องปรับปรุง

`
minecraft_management/
├── TODO/
│   └── plan.md                      # ไฟล์แผนงานและ TODO Checklists
├── electron/
│   ├── main.ts                      # Registrations & Inter-Process Communication
│   ├── preload.ts                   # Extended API Context Bridge
│   ├── ngrok.ts                     # Ngrok Tunnel Manager
│   ├── cloudflare-tunnel.ts         # Cloudflare Tunnel Manager
│   ├── server-manager.ts            # Server instance management & Java verifications
│   ├── store.ts                     # Multi-server registry persistence
│   ├── plugin-search.ts             # Spiget & Modrinth API integration
│   └── java-installer.ts            # Automated OpenJDK Downloader & Manager
└── src/
    ├── components/
    │   ├── Sidebar.tsx              # Server switcher dropdown + logo
    │   ├── Dashboard.tsx            # Live status + graphs (Recharts)
    │   ├── Players.tsx              # [NEW] Player management tab
    │   ├── NetworkTunnels.tsx       # Dedicated Ngrok & Cloudflare control tab
    │   ├── Plugins.tsx              # Plugin tab with Online Search & Install
    │   └── Settings.tsx             # Java status & 1-click installer button
    └── types.ts                     # Type definitions update
`

---

## 🧪 การทดสอบและการตรวจสอบ (Verification Criteria)

- [x] **Build Check**: เรียกใช้คำสั่ง npm run build เพื่อตรวจสอบว่าไม่มี TypeScript / Bundling Errors
- [x] **Multi-Server Test**: ลองสร้างและสลับสลับใช้งานระหว่างเซิฟเวอร์หลายตัว
- [x] **Tunnels Test**: ทดสอบการใส่ Auth Token / Tunnel Token และสั่ง เปิด/ปิด Ngrok & Cloudflare
- [x] **Plugins Test**: ค้นหาปลั๊กอินสดจากเว็บและทดลองกด 1-Click Install ลงโฟลเดอร์ /plugins
- [x] **Java Test**: ตรวจเช็คสถานะ Java และปุ่ม Auto-Installer
- [ ] **Players Test**: ทดสอบแสดงผู้เล่น, Kick/Ban, Whitelist/Ban list ขณะ server running
- [ ] **Graphs Test**: ตรวจกราฟ Dashboard อัปเดตทุก 5 วิขณะ server running
