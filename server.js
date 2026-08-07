require('dotenv').config();
const express = require('express');
const session = require('express-session');
const bcrypt = require('bcrypt');
const path = require('path');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

app.use(session({
    secret: process.env.SESSION_SECRET || 'rahasia_cadangan_sementara_123',
    resave: true, 
    saveUninitialized: false,
    cookie: { secure: false, maxAge: 1000 * 60 * 60 * 24 }
}));

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER, 
        pass: process.env.EMAIL_PASS  
    }
});

const runQuery = (sql, params) => new Promise((res, rej) => {
    db.run(sql, params, function(err) { if(err) rej(err); else res(this); });
});
const allQuery = (sql, params) => new Promise((res, rej) => {
    db.all(sql, params, (err, rows) => { if(err) rej(err); else res(rows); });
});

const requireLogin = (req, res, next) => {
    if (!req.session.userId) return res.status(401).json({ error: 'Unauthorized' });
    next();
};

app.get('/', (req, res) => res.redirect('/login.html'));

// =========================================================================
// API AUTENTIKASI & AKUN
// =========================================================================

app.post('/api/register', async (req, res) => {
    const { username, email, password, role = 'pemohon' } = req.body;
    const token = crypto.randomBytes(20).toString('hex');
    try {
        const hash = await bcrypt.hash(password, 10);
        db.run(`INSERT INTO users (username, email, password_hash, role, is_verified, verification_token) VALUES (?, ?, ?, ?, 0, ?)`, 
            [username, email, hash, role, token], 
            function(err) {
                if (err) return res.status(400).json({ error: 'Email sudah terdaftar.' });
                const verifyUrl = `https://upheaval-slum-chafe.ngrok-free.dev/api/verify?token=${token}`;
                transporter.sendMail({
                    from: `"Sistem Pemadaman INALUM" <${process.env.EMAIL_USER}>`,
                    to: email,
                    subject: 'Verifikasi Akun',
                    html: `<h2>Halo ${username},</h2><a href="${verifyUrl}">Verifikasi Email Saya</a>`
                }, (e) => { if(e) console.error(e) });
                res.status(201).json({ message: 'Registrasi sukses! Silakan cek email.' });
            });
    } catch (e) { res.status(500).json({ error: 'Server error' }); }
});

app.get('/api/verify', async (req, res) => {
    const { token } = req.query;
    db.get(`SELECT id FROM users WHERE verification_token = ?`, [token], (err, user) => {
        if (err || !user) return res.status(400).send('Token tidak valid.');
        db.run(`UPDATE users SET is_verified = 1, verification_token = NULL WHERE id = ?`, [user.id], () => {
            res.send(`<h2 style="color:green; text-align:center; margin-top:50px;">Verifikasi Berhasil! ✅ <br><a href="/login.html">Login Sekarang</a></h2>`);
        });
    });
});

app.post('/api/login', (req, res) => {
    const { email, password } = req.body;
    db.get(`SELECT * FROM users WHERE email = ?`, [email], async (err, user) => {
        if (err || !user) return res.status(401).json({ error: 'Email tidak ditemukan.' });
        if (user.is_verified === 0) return res.status(403).json({ error: 'Akun belum diverifikasi.' });
        const match = await bcrypt.compare(password, user.password_hash);
        if (!match) return res.status(401).json({ error: 'Kata sandi salah.' });
        req.session.userId = user.id; req.session.username = user.username; req.session.role = user.role;
        req.session.save(() => res.status(200).json({ message: 'Login Berhasil', redirect: '/dashboard' }));
    });
});

app.post('/api/logout', (req, res) => { req.session.destroy(); res.json({ success: true }); });
app.get('/api/user/me', requireLogin, (req, res) => res.json({ username: req.session.username, role: req.session.role }));

app.post('/api/forgot-password', async (req, res) => {
    const { email } = req.body;
    const resetToken = crypto.randomBytes(20).toString('hex');
    const expireTime = new Date(Date.now() + 3600000).toISOString(); 
    db.get(`SELECT id FROM users WHERE email = ?`, [email], (err, user) => {
        if (err || !user) return res.status(404).json({ error: 'Email tidak terdaftar.' });
        db.run(`UPDATE users SET reset_token = ?, reset_token_expires = ? WHERE id = ?`, [resetToken, expireTime, user.id], () => {
            const resetUrl = `https://upheaval-slum-chafe.ngrok-free.dev/reset-password.html?token=${resetToken}`;
            transporter.sendMail({
                from: `"Sistem Pemadaman" <${process.env.EMAIL_USER}>`,
                to: email, subject: 'Reset Kata Sandi',
                html: `<a href="${resetUrl}">Klik untuk Reset Kata Sandi</a>`
            }, (e) => { if(e) console.error(e) });
            res.json({ message: 'Tautan reset dikirim ke email.' });
        });
    });
});

app.post('/api/reset-password', async (req, res) => {
    const { token, newPassword } = req.body;
    db.get(`SELECT id FROM users WHERE reset_token = ? AND reset_token_expires > ?`, [token, new Date().toISOString()], async (err, user) => {
        if (err || !user) return res.status(400).json({ error: 'Tautan tidak valid/kedaluwarsa.' });
        const hash = await bcrypt.hash(newPassword, 10);
        db.run(`UPDATE users SET password_hash = ?, reset_token = NULL, reset_token_expires = NULL, is_verified = 1, verification_token = NULL WHERE id = ?`, [hash, user.id], () => {
            res.json({ message: 'Kata sandi berhasil diperbarui!' });
        });
    });
});

// =========================================================================
// API MANAJEMEN DATA PERMOHONAN & NOTIFIKASI BERTINGKAT
// =========================================================================

app.post('/api/requests', requireLogin, async (req, res) => {
    const { departemen_pemohon, dipersiapkan_oleh, remark, outages } = req.body;
    try {
        const reqResult = await runQuery(
            `INSERT INTO requests (user_id, departemen, dipersiapkan_oleh, remark, status) VALUES (?, ?, ?, ?, 'Pending')`,
            [req.session.userId, departemen_pemohon, dipersiapkan_oleh, remark]
        );
        const requestId = reqResult.lastID;

        for (let out of outages) {
            const outResult = await runQuery(
                `INSERT INTO outages (request_id, jenis_pemadaman, area_dari, area_ke, waktu_kerja_mulai, waktu_kerja_selesai, waktu_padam_mulai, waktu_padam_selesai, titik_pentahanan, komunikasi, kepala_pelaksana, keterangan, sld_data) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [requestId, out.jenis_pemadaman, out.area_dari, out.area_ke, out.waktu_kerja_mulai, out.waktu_kerja_selesai, out.waktu_padam_mulai, out.waktu_padam_selesai, out.titik_pentahanan, out.komunikasi, out.kepala_pelaksana, out.keterangan, out.sld_data]
            );
            const outageId = outResult.lastID;
            for (let taskDesc of out.tasks) {
                if (taskDesc.trim() !== "") await runQuery(`INSERT INTO tasks (outage_id, deskripsi) VALUES (?, ?)`, [outageId, taskDesc]);
            }
        }

        // TAHAP 1: EMAIL KE PEMERIKSA POP
        const pemeriksa = await allQuery(`SELECT email FROM users WHERE role = 'pemeriksa' AND is_verified = 1`);
        const emailsToNotify = pemeriksa.map(u => u.email).filter(e => e); 
        if (emailsToNotify.length > 0) {
            transporter.sendMail({
                from: `"Sistem Pemadaman INALUM" <${process.env.EMAIL_USER}>`, to: emailsToNotify.join(', '), 
                subject: `[PENGAJUAN BARU] Permohonan #${requestId} Membutuhkan Pengecekan POP`,
                html: `<p>Ada pengajuan jadwal pemadaman baru dari <b>${req.session.username}</b>. Silakan login ke sistem untuk memeriksa dokumen.</p>`
            }, (e) => { if(e) console.error(e) });
        }
        res.status(201).json({ message: 'Permohonan jadwal berhasil disimpan!' });
    } catch (err) { res.status(500).json({ error: 'Gagal menyimpan data.' }); }
});

app.get('/api/requests/data', requireLogin, async (req, res) => {
    let sql = `SELECT r.*, u.username FROM requests r JOIN users u ON r.user_id = u.id`;
    let params = [];
    if (req.session.role === 'pemohon') {
        sql += ` WHERE r.user_id = ?`; params.push(req.session.userId);
    }
    sql += ` ORDER BY r.tanggal_pengajuan DESC`;
    try { const rows = await allQuery(sql, params); res.json(rows); } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/requests/:id/detail', requireLogin, async (req, res) => {
    try {
        const reqData = await allQuery(`SELECT r.*, u.username FROM requests r JOIN users u ON r.user_id = u.id WHERE r.id = ?`, [req.params.id]);
        if (reqData.length === 0) return res.status(404).json({ error: 'Permohonan tidak ditemukan' });
        const requestInfo = reqData[0];
        const outages = await allQuery(`SELECT * FROM outages WHERE request_id = ?`, [req.params.id]);
        for (let out of outages) {
            const tasks = await allQuery(`SELECT deskripsi FROM tasks WHERE outage_id = ?`, [out.id]);
            out.tasks = tasks.map(t => t.deskripsi);
        }
        res.json({ request: requestInfo, outages: outages });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/requests/:id/status', requireLogin, async (req, res) => {
    const { status, surat_to, butuh_ses, ses_section, ses_name, ses_date } = req.body;
    const role = req.session.role;

    try {
        // TAHAP 2: POP CHECKER MEMPROSES DOKUMEN
        if (role === 'pemeriksa' && (status === 'Menunggu SES' || status === 'Diperiksa POP')) {
            // ---> REVISI DITAMBAHKAN DI SINI: pemeriksa_date
            await runQuery(
                `UPDATE requests SET status = ?, surat_to = ?, butuh_ses = ?, ses_section = ?, ses_name = ?, ses_date = ?, pemeriksa_oleh = ?, pemeriksa_date = ? WHERE id = ?`,
                [status, surat_to, butuh_ses ? 1 : 0, ses_section, ses_name, ses_date, req.session.username, new Date().toISOString(), req.params.id]
            );

            // Jika butuh SES -> Kirim email ke tim SES
            if (butuh_ses) {
                const sesUsers = await allQuery(`SELECT email FROM users WHERE role = 'ses' AND is_verified = 1`);
                if (sesUsers.length > 0) {
                    transporter.sendMail({
                        from: `"Sistem Pemadaman INALUM" <${process.env.EMAIL_USER}>`, to: sesUsers.map(u=>u.email).join(', '),
                        subject: `[PERLU KONFIRMASI SES] Permohonan #${req.params.id}`,
                        html: `<p>Tim POP meminta konfirmasi Anda untuk pemadaman #${req.params.id}. Silakan login dan klik Konfirmasi Aman.</p>`
                    }, (e) => { if(e) console.error(e) });
                }
            } 
            // Jika TIDAK butuh SES -> Langsung bypass ke Penyetuju POP (Manajer)
            else {
                const penyetuju = await allQuery(`SELECT email FROM users WHERE role = 'penyetuju' AND is_verified = 1`);
                if (penyetuju.length > 0) {
                    transporter.sendMail({
                        from: `"Sistem Pemadaman INALUM" <${process.env.EMAIL_USER}>`, to: penyetuju.map(u=>u.email).join(', '),
                        subject: `[PERLU PERSETUJUAN] Permohonan #${req.params.id} Telah Diverifikasi POP`,
                        html: `<p>Dokumen siap untuk disetujui final. Silakan login ke sistem.</p>`
                    }, (e) => { if(e) console.error(e) });
                }
            }
        } 
        
        // TAHAP 3: SES MENGKONFIRMASI (Otomatis merekam nama akun SES yang login)
        else if (role === 'ses' && status === 'Diperiksa POP') {
            await runQuery(`UPDATE requests SET status = ?, ses_name = ?, ses_date = ? WHERE id = ?`, 
                [status, req.session.username, new Date().toISOString(), req.params.id]);
            
            // Lanjut notifikasi ke Manajer POP
            const penyetuju = await allQuery(`SELECT email FROM users WHERE role = 'penyetuju' AND is_verified = 1`);
            if (penyetuju.length > 0) {
                transporter.sendMail({
                    from: `"Sistem Pemadaman INALUM" <${process.env.EMAIL_USER}>`, to: penyetuju.map(u=>u.email).join(', '),
                    subject: `[PERLU PERSETUJUAN] Permohonan #${req.params.id} Telah Dikonfirmasi SES`,
                    html: `<p>Pihak SES telah memberikan konfirmasi aman. Dokumen siap untuk disetujui final.</p>`
                }, (e) => { if(e) console.error(e) });
            }
        } 
        
        // TAHAP 4: MANAJER POP MENYETUJUI / MENOLAK
        else if (role === 'penyetuju' && status === 'Disetujui') {
            // ---> REVISI DITAMBAHKAN DI SINI: disetujui_date
            await runQuery(`UPDATE requests SET status = ?, disetujui_oleh = ?, disetujui_date = ? WHERE id = ?`, 
                [status, req.session.username, new Date().toISOString(), req.params.id]);
            
            // Notifikasi ke Pemohon
            const reqData = await allQuery(`SELECT u.email FROM requests r JOIN users u ON r.user_id = u.id WHERE r.id = ?`, [req.params.id]);
            if (reqData[0] && reqData[0].email) {
                transporter.sendMail({
                    from: `"Sistem Pemadaman INALUM" <${process.env.EMAIL_USER}>`, to: reqData[0].email,
                    subject: `[DISETUJUI] Permohonan #${req.params.id} Disetujui POP`,
                    html: `<p>Permohonan Anda telah disetujui. Surat Konfirmasi Balasan (TCP) kini dapat dicetak melalui dashboard.</p>`
                }, (e) => { if(e) console.error(e) });
            }
        } 
        else if (status === 'Ditolak') {
            await runQuery(`UPDATE requests SET status = ? WHERE id = ?`, [status, req.params.id]);
            const reqData = await allQuery(`SELECT u.email FROM requests r JOIN users u ON r.user_id = u.id WHERE r.id = ?`, [req.params.id]);
            if (reqData[0] && reqData[0].email) {
                transporter.sendMail({
                    from: `"Sistem Pemadaman INALUM" <${process.env.EMAIL_USER}>`, to: reqData[0].email,
                    subject: `[DITOLAK] Permohonan #${req.params.id} Ditolak`,
                    html: `<p>Mohon maaf, permohonan Anda ditolak oleh pihak POP/Manajemen.</p>`
                }, (e) => { if(e) console.error(e) });
            }
        }

        res.json({ message: `Dokumen berhasil diproses.` });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// Atur EJS sebagai View Engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views')); // Beritahu Express bahwa folder EJS bernama 'views'

// Middleware untuk file statis (CSS, JS, Gambar)
app.use(express.static(path.join(__dirname, 'public')));

// Rute Dashboard menggunakan res.render() bukan res.sendFile()
app.get('/dashboard', (req, res) => { 
    if (!req.session.userId) return res.redirect('/login.html'); 
    res.render('index'); // Ini akan memuat file views/index.ejs
});

app.listen(PORT, () => console.log(`Server berjalan di port ${PORT}`));