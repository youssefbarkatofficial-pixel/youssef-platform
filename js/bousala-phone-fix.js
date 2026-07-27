// ============================================================
//  مصالح صيغ الموبايل 🧭📱 — طبقة غير لاغية فوق دخول المنصة الحالي
//  لا تعدل أي كود قديم: تُستدعى فقط عندما يفشل الدخول القديم
// ============================================================

window.BousalaPhoneFix = (function() {
    const EMAIL_DOMAIN = "student.youssefbarakat.com";
    const STUDENTS = "students";

    function normPhone(input) {
        let p = String(input || "").trim()
            .replace(/[٠-٩]/g, d => "٠١٢٣٤٥٦٧٨٩".indexOf(d))  // أرقام عربي → إنجليزي
            .replace(/[\s\-().]/g, "");                        // مسافات وشرط وأقواس
        p = p.replace(/^\+?20/, "0").replace(/^0020/, "0");  // +20 / 0020 → 0
        if (/^1[0125]\d{8}$/.test(p)) p = "0" + p;           // نسي الصفر؟ رجعه
        return p;
    }

    function candidates(rawInput) {
        const p = normPhone(rawInput);
        const noZero = p.replace(/^0/, "");
        const forms = [p, noZero, "20" + noZero, "+20" + noZero, rawInput.trim()];
        const emails = new Set();
        for (const f of forms) emails.add(`${f}@${EMAIL_DOMAIN}`.toLowerCase());
        
        // لو المستخدم كتب إيميل كامل أصلًا، جربه زي ما هو كمان
        if (rawInput.includes("@")) emails.add(rawInput.trim().toLowerCase());
        
        return { phone: p, emails: [...emails] };
    }

    async function tagProfile(uid, phone, email, extra = {}) {
        try {
            await firebase.firestore().collection(STUDENTS).doc(uid).set({
                ...extra,
                phone: phone,
                phoneNorm: phone,
                loginEmail: email,
                lastLoginAt: Date.now()
            }, { merge: true });
        } catch (e) {
            console.warn('Failed to tag profile in rescue module', e);
        }
    }

    async function rescueLogin(rawInput, password) {
        if (!firebase.auth || !firebase.firestore) return { ok: false, msg: "Firebase not loaded" };
        
        const { phone, emails } = candidates(rawInput);
        let wrongPass = false;

        // أ) جرب كل صيغ الإيميل الصناعي على Firebase Auth
        for (const em of emails) {
            try {
                const cred = await firebase.auth().signInWithEmailAndPassword(em, password);
                await tagProfile(cred.user.uid, phone, em);
                return { ok: true, user: cred.user, usedEmail: em, normPhone: phone };
            } catch (e) {
                if (e.code === "auth/wrong-password" || e.code === "auth/invalid-credential") {
                    // الحساب موجود بالصيغة دي بس الباسورد غلط
                    wrongPass = true;
                }
            }
        }

        // ب) الحساب مش في Auth خالص لكن ظاهر في الداشبورد؟
        //    إنقاذ ذاتي: أنشئ حساب Auth جديد بنفس بياناته (ترحيل صامت)
        const snap = await firebase.firestore().collection(STUDENTS)
            .where("phone", "in", [phone, phone.replace(/^0/, "")])
            .limit(1).get();
            
        if (!snap.empty) {
            const profile = snap.docs[0].data();
            try {
                const em = `${phone}@${EMAIL_DOMAIN}`;
                const cred = await firebase.auth().createUserWithEmailAndPassword(em, password);
                await tagProfile(cred.user.uid, phone, em, profile);
                return { ok: true, user: cred.user, migrated: true, normPhone: phone };
            } catch (e) {
                if (e.code === "auth/email-already-in-use") {
                    return { ok: false, msg: "كلمة المرور غير صحيحة، جرب تاني 🔑" };
                }
            }
        }

        return { ok: false, msg: wrongPass ? "كلمة المرور غير صحيحة، جرب تاني 🔑" : "الرقم ده مش متسجل، اعمل حساب جديد 🧭" };
    }

    return { normPhone, rescueLogin };
})();
