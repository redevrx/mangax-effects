# Bypass Login - mynovel.co

## ภาพรวม

Effect ที่ช่วยให้สามารถอ่านเรื่องราวบน **mynovel.co** ได้โดยไม่ต้องล็อกอิน เมื่อผู้ใช้มีเหรียญ (coins) เพียงพอ (≥ 10 เหรียญ)

## วิธีทำงาน

1. **ตรวจสอบจำนวนเหรียญ**: สคริปต์จะตรวจสอบ `.coins` และ `.coin-count` เพื่อหาจำนวนเหรียญปัจจุบัน
2. **ถ้าเหรียญ ≥ 10**: จะซ่อน modal และ overlay ทั้งหมดที่เป็น popup/login
3. **ถ้าเหรียญ < 10**: ไม่ทำอะไร หน้าเว็บแสดงผลปกติ

## ไฟล์ที่เกี่ยวข้อง

| ไฟล์ | คำอธิบาย |
|------|----------|
| `effect.json` | Manifest ที่บอกชื่อ, icon, matches, category |
| `main.js` | สคริปต์หลักที่ทำจริง |
| `test.html` | หน้าทดสอบ (เปิดใน browser ธรรมดา) |
| `test-in-browser.js` | Script สำหรับรัน test ใน browser |

## วิธีทดสอบ

### ทดสอบด้วย Chrome DevTools

```bash
node tools/devtools-runner.js effects/mynovel-bypass-login/test-in-browser.js
```

### ทดสอบด้วยไฟล์ HTML

เปิด `test.html` ในเบราว์เซอร์ แล้วกด **Enable Effect** → จะเห็น modal ถูกซ่อนทันที

### ทดสอบใน MangaX App

1. เปิด MangaX App
2. ไปที่หมวด **Effects**
3. เปิด **Bypass login (mynovel.co)**
4. เข้า https://www.mynovel.co/chapter/...
5. ถ้ามีเหรียญ ≥ 10 → modal จะถูกซ่อนอัตโนมัติ

## โครงสร้างโค้ด

```js
mangax.effect(function(ctx) {
  // 1. CONFIG — ตั้งค่า
  const CONFIG = {
    MIN_COINS: 10,
    MODAL_SELECTORS: [...],
    COIN_SELECTORS: [".coins", ".coin-count"],
  };

  // 2. getCoinCount() — ดึงจำนวนเหรียญ
  // 3. shouldBypass() — เช็คเหรียญ ≥ MIN_COINS
  // 4. hideModal() — ซ่อน modal ด้วย data-bypassed
  // 5. restoreAll() — คืนสภาพเมื่อปิด effect
  // 6. ctx.on(window, "stop", ...) — cleanup
  // 7. return function() { ... } — cleanup ตอนปิด
});
```

## วิธีปิด

- ปิด effect ผ่านเมนูของ MangaX
- หรือโหลดหน้าเว็บใหม่

## ข้อจำกัด

- ใช้ได้เฉพาะ mynovel.co และ subdomain เท่านั้น (`*.mynovel.co`)
- ถ้าเว็บเปลี่ยน selector ของ coin count หรือ modal selector จะหยุดทำงาน
- ไม่ทำงานบนทุก device (Android WebView และ iOS WKWebView อาจมีพฤติกรรมต่างกัน)

## ประวัติการแก้ไข

| Version | การเปลี่ยนแปลง |
|---------|---------------|
| 1.0.0 | เริ่มต้น — ซ่อน modal พื้นฐาน |
| 1.0.1 | แก้ `getElementById` → `querySelector` |
| 1.0.2 | แก้ `ctx.observe` รับ array + `ctx.on(stop)` ไม่มี param |
| 1.0.3 | ใช้ `data-mx-*` แทน `.hidden` + `ctx.on(window, "stop")` + return cleanup fn |
| 1.0.4 | Bump version + เพิ่ม `.coin-count` ใน COIN_SELECTORS |

## การแก้ไขปัญหาที่พบบ่อย

### Error: `target.addEventListener is not a function`
→ เกิดจากใช้ `ctx.on("stop", fn)` ผิด → แก้เป็น `ctx.on(window, "stop", fn)`

### Error: `ctx.observe callback is not a valid selector`
→ `ctx.observe` ส่ง array มา → ต้องใช้ `Array.isArray()` check

### Effect หยุดทำงานเอง
→ เช็ค selector ว่าตรงกับ page ใหม่หรือไม่ ถ้าเปลี่ยนให้ update ใน `MODAL_SELECTORS`

### Modal ยังไม่หาย
→ เช็ค coin count ว่า ≥ 10 หรือไม่ ถ้า < 10 effect จะไม่ทำอะไร

## อ้างอิง

- [MangaX Effects Schema](https://raw.githubusercontent.com/redevrx/mangax-effects/main/schema/effect.schema.json)
- [AGENTS.md](../../AGENTS.md) — คู่มือการเขียน effect
- [devtools-runner.js](../../tools/devtools-runner.js) — สำหรับ test effect

---

**Author:** redevrx  
**License:** MIT