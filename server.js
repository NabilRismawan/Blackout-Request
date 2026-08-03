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

// --- SETUP NODEMAILER DARI .ENV ---
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER, 
        pass: process.env.EMAIL_PASS  
    }
});

// Helper Kueri Database
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

app.get('/', (req, res) => {
    res.redirect('/login.html');
});

// =========================================================================
// API AUTENTIKASI & AKUN
// =========================================================================

// 1. Registrasi (Dengan Verifikasi Email)
app.post('/api/register', async (req, res) => {
    const { username, email, password, role = 'pemohon' } = req.body;
    const token = crypto.randomBytes(20).toString('hex');
    
    try {
        const hash = await bcrypt.hash(password, 10);
        db.run(
            `INSERT INTO users (username, email, password_hash, role, is_verified, verification_token) VALUES (?, ?, ?, ?, 0, ?)`, 
            [username, email, hash, role, token], 
            function(err) {
                if (err) {
                    console.error("❌ Database Error saat Register:", err.message);
                    if (err.message.includes('UNIQUE constraint failed')) {
                        return res.status(400).json({ error: 'Email tersebut sudah terdaftar.' });
                    }
                    return res.status(500).json({ error: 'Terjadi kesalahan sistem. Pastikan file database lama sudah dihapus.' });
                }
                
                // MENGGUNAKAN LINK NGROK UNTUK VERIFIKASI
                const verifyUrl = `https://upheaval-slum-chafe.ngrok-free.dev/api/verify?token=${token}`;
                
                const mailOptions = {
                    from: `"Sistem Pemadaman INALUM" <${process.env.EMAIL_USER}>`,
                    to: email,
                    subject: 'Verifikasi Akun Anda',
                    html: `
                        <div style="font-family: sans-serif; padding: 20px;">
                            <h2>Halo ${username},</h2>
                            <p>Terima kasih telah mendaftar. Silakan klik tautan di bawah ini untuk memverifikasi alamat email Anda agar dapat login:</p>
                            <a href="${verifyUrl}" style="display: inline-block; background: #0A457F; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; margin-top: 10px;">Verifikasi Email Saya</a>
                        </div>
                    `
                };
                
                transporter.sendMail(mailOptions, (mailErr) => {
                    if (mailErr) console.error('Gagal kirim email verifikasi:', mailErr);
                });

                res.status(201).json({ message: 'Registrasi sukses! Silakan cek email Anda untuk memverifikasi akun.' });
            }
        );
    } catch (e) { res.status(500).json({ error: 'Server error' }); }
});

// 2. Verifikasi Email
app.get('/api/verify', async (req, res) => {
    const { token } = req.query;
    if (!token) return res.status(400).send('Token tidak ditemukan.');

    db.get(`SELECT id FROM users WHERE verification_token = ?`, [token], (err, user) => {
        if (err || !user) return res.status(400).send('Token tidak valid atau sudah digunakan.');
        db.run(`UPDATE users SET is_verified = 1, verification_token = NULL WHERE id = ?`, [user.id], () => {
            res.send(`
                <div style="font-family: sans-serif; text-align: center; margin-top: 50px;">
                    <h2 style="color: #009A44;">Verifikasi Berhasil! ✅</h2>
                    <p>Email Anda sudah terverifikasi.</p>
                    <a href="https://upheaval-slum-chafe.ngrok-free.dev/login.html" style="color: #0A457F; font-weight: bold;">Klik di sini untuk Login</a>
                </div>
            `);
        });
    });
});

// 3. Login
app.post('/api/login', (req, res) => {
    const { email, password } = req.body;
    
    db.get(`SELECT * FROM users WHERE email = ?`, [email], async (err, user) => {
        if (err || !user) return res.status(401).json({ error: 'Email tidak ditemukan.' });
        if (user.is_verified === 0) return res.status(403).json({ error: 'Akun belum diverifikasi. Silakan cek kotak masuk email Anda.' });

        const match = await bcrypt.compare(password, user.password_hash);
        if (!match) return res.status(401).json({ error: 'Kata sandi salah.' });
        
        req.session.userId = user.id;
        req.session.username = user.username;
        req.session.role = user.role;
        
        req.session.save((err) => {
            if (err) return res.status(500).json({ error: 'Gagal memproses sesi login' });
            res.status(200).json({ message: 'Login Berhasil', redirect: '/dashboard' });
        });
    });
});

app.post('/api/logout', (req, res) => {
    req.session.destroy();
    res.json({ success: true });
});

app.get('/api/user/me', requireLogin, (req, res) => {
    res.json({ username: req.session.username, role: req.session.role });
});


// =========================================================================
// API LUPA KATA SANDI
// =========================================================================

app.post('/api/forgot-password', async (req, res) => {
    const { email } = req.body;
    const resetToken = crypto.randomBytes(20).toString('hex');
    const expireTime = new Date(Date.now() + 3600000).toISOString(); 

    db.get(`SELECT id, username FROM users WHERE email = ?`, [email], (err, user) => {
        if (err || !user) return res.status(404).json({ error: 'Alamat email tidak terdaftar di dalam sistem.' });

        db.run(`UPDATE users SET reset_token = ?, reset_token_expires = ? WHERE id = ?`, [resetToken, expireTime, user.id], (updateErr) => {
            if (updateErr) {
                console.error('❌ Database error saat update token reset:', updateErr.message);
                return res.status(500).json({ error: 'Gagal memproses permintaan.' });
            }

            // MENGGUNAKAN LINK NGROK UNTUK RESET SANDI
            const resetUrl = `https://upheaval-slum-chafe.ngrok-free.dev/reset-password.html?token=${resetToken}`;
            
            const mailOptions = {
                from: `"Sistem Pemadaman INALUM" <${process.env.EMAIL_USER}>`,
                to: email,
                subject: 'Reset Kata Sandi Anda',
                html: `
                    <div style="font-family: sans-serif; padding: 20px; border: 1px solid #eaeaea; border-radius: 10px;">
                        <h2 style="color: #0A457F; margin-top: 0;">Reset Kata Sandi</h2>
                        <p>Halo ${user.username},</p>
                        <p>Kami menerima permintaan untuk mereset kata sandi akun Anda. Silakan klik tautan di bawah ini untuk membuat kata sandi baru:</p>
                        <br>
                        <a href="${resetUrl}" style="display: inline-block; background: #0A457F; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Reset Kata Sandi</a>
                        <p style="margin-top: 20px; color: #E31B23; font-size: 12px;">Tautan ini hanya berlaku selama 1 jam.</p>
                    </div>
                `
            };

            transporter.sendMail(mailOptions, (mailErr) => {
                if (mailErr) console.error('❌ Gagal kirim email reset password:', mailErr);
            });

            res.json({ message: 'Tautan reset kata sandi telah berhasil dikirim ke email Anda!' });
        });
    });
});

app.post('/api/reset-password', async (req, res) => {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) return res.status(400).json({ error: 'Token dan password baru wajib diisi.' });

    db.get(`SELECT id FROM users WHERE reset_token = ? AND reset_token_expires > ?`, [token, new Date().toISOString()], async (err, user) => {
        if (err || !user) return res.status(400).json({ error: 'Tautan reset tidak valid atau sudah kedaluwarsa.' });

        try {
            const hash = await bcrypt.hash(newPassword, 10);
            
            // AUTO VERIFIKASI (is_verified = 1) SETELAH RESET PASSWORD BERHASIL
            db.run(`UPDATE users SET password_hash = ?, reset_token = NULL, reset_token_expires = NULL, is_verified = 1, verification_token = NULL WHERE id = ?`, [hash, user.id], (updateErr) => {
                if (updateErr) return res.status(500).json({ error: 'Gagal memperbarui kata sandi.' });
                res.json({ message: 'Kata sandi berhasil diperbarui! Silakan login dengan sandi baru Anda.' });
            });
        } catch (e) {
            res.status(500).json({ error: 'Server error saat memproses sandi.' });
        }
    });
});


// =========================================================================
// API MANAJEMEN DATA PERMOHONAN & NOTIFIKASI BERTINGKAT
// =========================================================================

app.post('/api/requests', requireLogin, async (req, res) => {
    const { departemen_pemohon, dipersiapkan_oleh, outages } = req.body;
    try {
        const reqResult = await runQuery(
            `INSERT INTO requests (user_id, departemen, dipersiapkan_oleh, status) VALUES (?, ?, ?, 'Pending')`,
            [req.session.userId, departemen_pemohon, dipersiapkan_oleh]
        );
        const requestId = reqResult.lastID;

        for (let out of outages) {
            const outResult = await runQuery(
                `INSERT INTO outages (request_id, jenis_pemadaman, area_dari, area_ke, waktu_kerja_mulai, waktu_kerja_selesai, waktu_padam_mulai, waktu_padam_selesai, titik_pentahanan, komunikasi, kepala_pelaksana, keterangan, sld_data) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [requestId, out.jenis_pemadaman, out.area_dari, out.area_ke, out.waktu_kerja_mulai, out.waktu_kerja_selesai, out.waktu_padam_mulai, out.waktu_padam_selesai, out.titik_pentahanan, out.komunikasi, out.kepala_pelaksana, out.keterangan, out.sld_data]
            );
            const outageId = outResult.lastID;
            for (let taskDesc of out.tasks) {
                if (taskDesc.trim() !== "") {
                    await runQuery(`INSERT INTO tasks (outage_id, deskripsi) VALUES (?, ?)`, [outageId, taskDesc]);
                }
            }
        }

        // TAHAP 1: KIRIM EMAIL NOTIFIKASI HANYA KE PEMERIKSA
        const pemeriksa = await allQuery(`SELECT email FROM users WHERE role = 'pemeriksa' AND is_verified = 1`);
        const emailsToNotify = pemeriksa.map(user => user.email).filter(e => e); 

        if (emailsToNotify.length > 0) {
            const mailOptions = {
                from: `"Sistem Pemadaman INALUM" <${process.env.EMAIL_USER}>`, 
                to: emailsToNotify.join(', '), 
                subject: `[PENGAJUAN BARU] Permohonan Pemadaman #${requestId} Membutuhkan Pengecekan`,
                html: `
                    <div style="font-family: sans-serif; padding: 20px; border: 1px solid #eaeaea; border-radius: 10px;">
                        <h2 style="color: #0A457F; margin-top: 0;">Permohonan Membutuhkan Pengecekan</h2>
                        <p>Halo Tim Pemeriksa,</p>
                        <p>Terdapat pengajuan jadwal pemadaman baru dari <b>${req.session.username}</b>.</p>
                        <p>Mohon segera login ke dalam <a href="https://upheaval-slum-chafe.ngrok-free.dev/login.html" style="color: #009A44; font-weight: bold;">Dasbor Sistem</a> untuk mengecek kelengkapan dokumen dan SLD.</p>
                    </div>
                `
            };
            transporter.sendMail(mailOptions, (error) => {
                if (error) console.error('❌ Gagal mengirim notifikasi ke pemeriksa:', error);
            });
        }

        res.status(201).json({ message: 'Permohonan jadwal berhasil disimpan!' });
    } catch (err) { res.status(500).json({ error: 'Gagal menyimpan data.' }); }
});

app.get('/api/requests/data', requireLogin, async (req, res) => {
    let sql = `SELECT r.*, u.username FROM requests r JOIN users u ON r.user_id = u.id`;
    let params = [];
    if (req.session.role === 'pemohon') {
        sql += ` WHERE r.user_id = ?`;
        params.push(req.session.userId);
    }
    sql += ` ORDER BY r.tanggal_pengajuan DESC`;

    try {
        const rows = await allQuery(sql, params);
        res.json(rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
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
    const { status } = req.body;
    const role = req.session.role;

    if (role === 'pemohon') return res.status(403).json({ error: 'Akses ditolak.' });
    if (role === 'pemeriksa' && !['Diperiksa', 'Ditolak'].includes(status)) {
        return res.status(403).json({ error: 'Pemeriksa hanya dapat memverifikasi (Diperiksa) atau menolak.' });
    }
    if (role === 'penyetuju' && !['Disetujui', 'Ditolak'].includes(status)) {
        return res.status(403).json({ error: 'Manajer HANYA dapat memberikan persetujuan final (YA) atau menolak (TIDAK).' });
    }

    try {
        // Siapkan query default
        let updateQuery = `UPDATE requests SET status = ? WHERE id = ?`;
        let queryParams = [status, req.params.id];

        // Jika yang mengubah status adalah pemeriksa, rekam namanya
        if (role === 'pemeriksa') {
            updateQuery = `UPDATE requests SET status = ?, pemeriksa_oleh = ? WHERE id = ?`;
            // req.session.username mengambil nama spesifik orang yang sedang login
            queryParams = [status, req.session.username, req.params.id];
        } 
        // Jika yang mengubah status adalah penyetuju (manajer), rekam namanya
        else if (role === 'penyetuju') {
            updateQuery = `UPDATE requests SET status = ?, disetujui_oleh = ? WHERE id = ?`;
            queryParams = [status, req.session.username, req.params.id];
        }

        // Eksekusi query ke database
        await runQuery(updateQuery, queryParams);

        const reqData = await allQuery(`SELECT r.*, u.username, u.email FROM requests r JOIN users u ON r.user_id = u.id WHERE r.id = ?`, [req.params.id]);
        const requestInfo = reqData[0];

        // TAHAP 2: KIRIM NOTIFIKASI KE PENYETUJU
        if (status === 'Diperiksa') {
            const penyetuju = await allQuery(`SELECT email FROM users WHERE role = 'penyetuju' AND is_verified = 1`);
            const emailsPenyetuju = penyetuju.map(user => user.email).filter(e => e); 

            if (emailsPenyetuju.length > 0) {
                const mailOptions = {
                    from: `"Sistem Pemadaman INALUM" <${process.env.EMAIL_USER}>`,
                    to: emailsPenyetuju.join(', '),
                    subject: `[PERLU PERSETUJUAN] Pengajuan Pemadaman #${requestInfo.id} Telah Diverifikasi`,
                    html: `
                        <div style="padding: 20px;">
                            <h2>Menunggu Persetujuan Final</h2>
                            <p>Permohonan #${requestInfo.id} telah dicek dan siap untuk disetujui.</p>
                            <a href="https://upheaval-slum-chafe.ngrok-free.dev/login.html" style="color: #009A44; font-weight: bold;">Login ke Dasbor</a>
                        </div>
                    `
                };
                transporter.sendMail(mailOptions, (err) => { if(err) console.error(err); });
            }
        }
        // TAHAP 3: KIRIM KONFIRMASI KE PEMOHON
        else if (status === 'Disetujui' || status === 'Ditolak') {
            const emailPemohon = requestInfo.email;
            if (emailPemohon) {
                const actionText = status === 'Disetujui' ? 'DISETUJUI' : 'DITOLAK';
                const mailOptions = {
                    from: `"Sistem Pemadaman INALUM" <${process.env.EMAIL_USER}>`,
                    to: emailPemohon,
                    subject: `[${actionText}] Keputusan Permohonan Pemadaman #${requestInfo.id}`,
                    html: `
                        <div style="padding: 20px;">
                            <h2>Status: ${actionText}</h2>
                            <p>Permohonan Anda telah ${status.toLowerCase()}.</p>
                            <a href="https://upheaval-slum-chafe.ngrok-free.dev/login.html" style="color: #009A44; font-weight: bold;">Lihat Detail di Dasbor</a>
                        </div>
                    `
                };
                transporter.sendMail(mailOptions, (err) => { if(err) console.error(err); });
            }
        }

        res.json({ message: `Status berhasil diubah menjadi ${status}` });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.use(express.static(path.join(__dirname, 'public')));

app.get('/dashboard', (req, res) => {
    if (!req.session.userId) return res.redirect('/login.html');
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`✅ Server Utama berjalan di port ${PORT}`);
});