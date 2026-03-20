# 📦 คู่มือ Deploy แอป CBM Calculator บน Vercel

## 🚀 ขั้นตอนการ Deploy บน Vercel (ฟรี!)

### ขั้นตอนที่ 1: เตรียม GitHub Account
1. สมัคร GitHub Account ที่ https://github.com (ถ้ายังไม่มี)
2. สร้าง Repository ใหม่สำหรับโปรเจคนี้

### ขั้นตอนที่ 2: Push โค้ดขึ้น GitHub
```bash
# Initialize git (ถ้ายังไม่ได้ทำ)
git init

# Add all files
git add .

# Commit
git commit -m "Initial commit - CBM Calculator"

# Add remote origin (เปลี่ยน URL เป็น repo ของคุณ)
git remote add origin https://github.com/YOUR_USERNAME/cbm-calculator.git

# Push to GitHub
git push -u origin main
```

### ขั้นตอนที่ 3: สมัคร Vercel Account
1. ไปที่ https://vercel.com
2. กด **"Sign Up"**
3. เลือก **"Continue with GitHub"**
4. อนุญาตให้ Vercel เข้าถึง GitHub

### ขั้นตอนที่ 4: Import Project
1. ในหน้า Dashboard กด **"Add New..."** → **"Project"**
2. เลือก Repository ที่ push ไปจากขั้นตอนที่ 2
3. กด **"Import"**

### ขั้นตอนที่ 5: Configure Project
```
Framework Preset: Next.js
Root Directory: ./
Build Command: bun run build (หรือ npm run build)
Output Directory: .next
Install Command: bun install (หรือ npm install)
```

### ขั้นตอนที่ 6: Deploy
1. กดปุ่ม **"Deploy"**
2. รอประมาณ 2-5 นาที
3. เมื่อเสร็จจะได้ URL แบบนี้:
   ```
   https://cbm-calculator-xyz123.vercel.app
   ```

### ขั้นตอนที่ 7: Custom Domain (ทางเลือก)
1. ไปที่ **Settings** → **Domains**
2. เพิ่ม Domain ที่คุณต้องการ
3. Vercel จะให้ DNS records ที่ต้องตั้งค่า

---

## 🔗 วิธีแชร์ให้ลูกค้าใช้งาน

### วิธีที่ 1: ส่ง URL โดยตรง
```
https://cbm-calculator-xyz123.vercel.app
```

### วิธีที่ 2: สร้าง QR Code
1. ไปที่ https://www.qr-code-generator.com/
2. ใส่ URL ของแอป
3. Download QR Code
4. ส่ง QR Code ให้ลูกค้าผ่าน Line/WhatsApp

### วิธีที่ 3: สร้าง Short Link
1. ไปที่ https://bitly.com
2. ย่อ URL ให้สั้น
3. แชร์ลิงก์สั้นให้ลูกค้า

---

## 📱 ติดตั้งเป็นแอปบนมือถือ (PWA)

ลูกค้าสามารถติดตั้งแอปบนมือถือได้:
1. เปิด URL บน Chrome/Safari
2. กดที่เมนู (⋮ หรือ ⇧)
3. เลือก **"Add to Home Screen"** หรือ **"เพิ่มที่หน้าจอหลัก"**
4. แอปจะปรากฏบนหน้าจอมือถือเหมือนแอปทั่วไป

---

## 💰 ค่าใช้จ่าย

| Plan | ราคา | Bandwidth | Builds/วัน |
|------|------|-----------|------------|
| **Hobby (ฟรี)** | ฿0 | 100GB/เดือน | ไม่จำกัด |
| Pro | $20/เดือน | 1TB/เดือน | ไม่จำกัด |

**หมายเหตุ**: Plan Hobby (ฟรี) เพียงพอสำหรับการใช้งานทั่วไป

---

## 🔄 Auto Deploy

เมื่อคุณ push โค้ดใหม่ไป GitHub:
- Vercel จะ **build และ deploy อัตโนมัติ**
- ลูกค้าจะเห็นเวอร์ชันใหม่ทันที

---

## ❓ คำถามที่พบบ่อย

**Q: ข้อมูลที่ลูกค้ากรอกจะหายไหม?**
A: ไม่หาย! แอปใช้ localStorage เก็บข้อมูลบนเครื่องลูกค้า

**Q: ใช้ได้กี่คนพร้อมกัน?**
A: ไม่จำกัด! Vercel รองรับ concurrent users ได้มาก

**Q: ต้องจ่ายเงินไหม?**
A: ไม่ต้อง! Plan Hobby ฟรีตลอดชีพ

---

## 📞 ติดต่อ

หากมีปัญหาการ Deploy สามารถติดต่อได้ที่:
- Vercel Support: https://vercel.com/support
- Documentation: https://vercel.com/docs
