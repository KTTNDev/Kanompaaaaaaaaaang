# BreadFlow POS · Google Sheets Edition

POS สำหรับร้านขนมปังขนาดเล็ก ออกแบบให้แม่ค้าจบการขายภายใน 2–3 จิ้ม และใช้ Google Sheet เป็นฐานข้อมูลหลัก ไม่มี SQLite, PostgreSQL หรือเซิร์ฟเวอร์ฐานข้อมูล

## วิธีขาย

1. จิ้มการ์ดสินค้า เมนูเดิมซ้ำจะเพิ่มจำนวนทันที
2. ถ้ารับเงินพอดี จิ้ม **รับเงินสดพอดี** เพื่อบันทึกบิลทันที
3. ถ้าต้องทอนหรือรับ QR/บัตร จิ้ม **เงินทอน / QR / บัตร** แล้วเลือกวิธีชำระ

ไม่มีหน้าต่างเลือกท็อปปิง แต่ละรสเป็นสินค้าคนละเมนูและมีราคาจบในตัว

## โครงสร้าง

- Next.js เป็นหน้าเว็บสำหรับ iPad และ proxy แบบ serverless
- Google Apps Script เป็น API ที่ Google ดูแลให้
- Google Sheet `ฐานข้อมูล` เป็นแหล่งข้อมูลหลักสำหรับสินค้า บิล รายการขาย ค่าใช้จ่าย และของเสีย
- Local Storage ใช้เฉพาะโหมดทดลองก่อนเชื่อม Google Apps Script

## เชื่อม Google Sheet ครั้งแรก

1. เปิด Google Sheet `ฐานข้อมูล`
2. ไปที่ **ส่วนขยาย → Apps Script**
3. นำโค้ดจาก `google-apps-script/Code.gs` ไปแทนในไฟล์ `Code.gs`
4. ตั้งค่า Project Settings → Time zone เป็น Bangkok
5. กด **Deploy → New deployment → Web app**
6. Execute as: Me, Who has access: Anyone
7. คัดลอก URL ที่ลงท้าย `/exec`
8. เปิดหน้า **ตั้งค่า** ใน POS วาง URL และกดเชื่อมต่อ

URL ถูกจำไว้ใน iPad เครื่องนั้น หลังเชื่อมแล้วทุก CRUD และทุกบิลจะอ่าน/เขียน Google Sheet

## เปิดโปรเจกต์

```bash
npm install
npm run dev
```

เปิด `http://localhost:3000`

## ตรวจระบบ

```bash
npm run typecheck
npm run lint
npm run build
```

## ตารางหลักใน Google Sheet

- `DB_PRODUCTS` สินค้า ราคา ต้นทุน หมวด รูป และสต็อกสินค้า
- `DB_ORDERS` หัวบิล ยอดรวม ส่วนลด ต้นทุน กำไร วิธีชำระ และเงินทอน
- `DB_ORDER_ITEMS` รายการสินค้าในแต่ละบิล
- `DB_EXPENSES` ค่าใช้จ่าย
- `DB_WASTE` สินค้าทิ้ง/เสีย
- `DB_SETTINGS` ชื่อร้านและค่าเริ่มต้น

ไฟล์ `prisma` และฐานข้อมูล SQL เดิมถูกถอดออกจากระบบแล้ว
