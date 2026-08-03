const express = require('express');
const session = require('express-session');
const bcrypt = require('bcrypt');
const path = require('path');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const db = require('./database'); // Memanggil database.js yang baru

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

app.use(session({
    secret: 'rahasia_super_aman_sistem_kelistrikan_123',
    resave: true, 
    saveUninitialized: false,
    cookie: { secure: false, maxAge: 1000 * 60 * 60 * 24 }
}));

// --- SETUP NODEMAILER ---
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'zakadiya71@gmail.com', 
        pass: 'nwavsztmqavhefvm'
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

// --- API AUTENTIKASI ---

// 1. Register User Baru (Dengan perbaikan Error Handling)
app.post('/api/register', async (req, res) => {
    const { username, email, password, role = 'pemohon' } = req.body;
    
    // Buat token acak sepanjang 20 byte (40 karakter hex)
    const token = crypto.randomBytes(20).toString('hex');
    
    try {
        const hash = await bcrypt.hash(password, 10);
        
        // Simpan ke DB dengan status is_verified = 0 (Belum terverifikasi)
        db.run(
            `INSERT INTO users (username, email, password_hash, role, is_verified, verification_token) VALUES (?, ?, ?, ?, 0, ?)`, 
            [username, email, hash, role, token], 
            function(err) {
                if (err) {
                    // CETAK ERROR ASLI KE TERMINAL UNTUK DEBUGGING
                    console.error("❌ Database Error saat Register:", err.message);
                    
                    // Cek jika errornya karena email duplikat (UNIQUE constraint)
                    if (err.message.includes('UNIQUE constraint failed')) {
                        return res.status(400).json({ error: 'Email tersebut sudah terdaftar.' });
                    }
                    
                    // Jika error lain (misal kolom tidak ditemukan karena belum hapus database.sqlite lama)
                    return res.status(500).json({ error: 'Terjadi kesalahan sistem. Pastikan file database lama sudah dihapus.' });
                }
                
                // Kirim Email Verifikasi
                const verifyUrl = `http://localhost:${PORT}/api/verify?token=${token}`;
                const mailOptions = {
                    from: '"Sistem Pemadaman" <no-reply@sistem.local>',
                    to: email,
                    subject: 'Verifikasi Akun Anda',
                    html: `
                        <div style="font-family: sans-serif; padding: 20px;">
                            <h2>Halo ${username},</h2>
                            <p>Terima kasih telah mendaftar. Silakan klik tautan di bawah ini untuk memverifikasi alamat email Anda agar dapat login:</p>
                            <a href="${verifyUrl}" style="display: inline-block; background: #059669; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; margin-top: 10px;">Verifikasi Email Saya</a>
                            <p style="margin-top: 20px; font-size: 12px; color: #888;">Tautan ini dibuat secara otomatis. Jangan bagikan ke siapapun.</p>
                        </div>
                    `
                };
                
                transporter.sendMail(mailOptions, (mailErr) => {
                    if (mailErr) console.error('Gagal kirim email verifikasi:', mailErr);
                });

                res.status(201).json({ message: 'Registrasi sukses! Silakan cek email Anda untuk memverifikasi akun.' });
            }
        );
    } catch (e) { 
        console.error("Server Error:", e);
        res.status(500).json({ error: 'Server error saat memproses sandi.' }); 
    }
});

// 2. Endpoint Verifikasi dari Link Email
app.get('/api/verify', async (req, res) => {
    const { token } = req.query;
    if (!token) return res.status(400).send('Token tidak ditemukan.');

    db.get(`SELECT id FROM users WHERE verification_token = ?`, [token], (err, user) => {
        if (err || !user) return res.status(400).send('Token tidak valid atau sudah digunakan.');

        // Update status menjadi terverifikasi dan hapus token
        db.run(`UPDATE users SET is_verified = 1, verification_token = NULL WHERE id = ?`, [user.id], () => {
            res.send(`
                <div style="font-family: sans-serif; text-align: center; margin-top: 50px;">
                    <h2 style="color: #059669;">Verifikasi Berhasil!</h2>
                    <p>Email Anda sudah terverifikasi.</p>
                    <a href="/login.html" style="color: blue;">Klik di sini untuk Login</a>
                </div>
            `);
        });
    });
});

// 3. Login Menggunakan Email
function prosesSesiLogin(req, res, localId, username, role) {
    req.session.userId = localId;
    req.session.username = username;
    req.session.role = role;
    
    req.session.save((err) => {
        if (err) return res.status(500).json({ error: 'Gagal memproses sesi login' });
        res.status(200).json({ message: 'Login Berhasil', redirect: '/dashboard' });
    });
}

app.post('/api/login', (req, res) => {
    const { email, password } = req.body;
    
    db.get(`SELECT * FROM users WHERE email = ?`, [email], async (err, user) => {
        if (err || !user) return res.status(401).json({ error: 'Email tidak ditemukan.' });
        
        // Cek status verifikasi
        if (user.is_verified === 0) return res.status(403).json({ error: 'Akun belum diverifikasi. Silakan cek kotak masuk email Anda.' });

        // Cek password
        const match = await bcrypt.compare(password, user.password_hash);
        if (!match) return res.status(401).json({ error: 'Kata sandi salah.' });
        
        prosesSesiLogin(req, res, user.id, user.username, user.role);
    });
});

app.post('/api/logout', (req, res) => {
    req.session.destroy();
    res.json({ success: true });
});

app.get('/api/user/me', requireLogin, (req, res) => {
    res.json({ username: req.session.username, role: req.session.role });
});

// --- API LUPA KATA SANDI ---
app.post('/api/forgot-password', async (req, res) => {
    const { email } = req.body;
    const resetToken = crypto.randomBytes(20).toString('hex');
    const expireTime = new Date(Date.now() + 3600000).toISOString(); 

    db.get(`SELECT id, username FROM users WHERE email = ?`, [email], (err, user) => {
        
        // REVISI: Cek apakah email terdaftar di database
        if (err || !user) {
            return res.status(404).json({ error: 'Alamat email tidak terdaftar di dalam sistem.' });
        }

        db.run(`UPDATE users SET reset_token = ?, reset_token_expires = ? WHERE id = ?`, [resetToken, expireTime, user.id], (updateErr) => {
            if (updateErr) {
                console.error('❌ Database error saat update token reset:', updateErr.message);
                return res.status(500).json({ error: 'Gagal memproses permintaan.' });
            }

            const resetUrl = `http://localhost:${PORT}/reset-password.html?token=${resetToken}`;
            const mailOptions = {
                from: '"Sistem Pemadaman" <EMAIL_GMAIL_KAMU@gmail.com>', // Sesuaikan email kamu
                to: email,
                subject: 'Reset Kata Sandi Anda',
                html: `
                    <div style="font-family: sans-serif; padding: 20px; border: 1px solid #eaeaea; border-radius: 10px;">
                        <h2 style="color: #0284c7; margin-top: 0;">Reset Kata Sandi</h2>
                        <p>Halo ${user.username},</p>
                        <p>Kami menerima permintaan untuk mereset kata sandi akun Anda. Silakan klik tautan di bawah ini untuk membuat kata sandi baru:</p>
                        <br>
                        <a href="${resetUrl}" style="display: inline-block; background: #0A0A0A; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Reset Kata Sandi</a>
                        <p style="margin-top: 20px; color: #dc2626; font-size: 12px;">Tautan ini hanya berlaku selama 1 jam.</p>
                    </div>
                `
            };

            transporter.sendMail(mailOptions, (mailErr) => {
                if (mailErr) console.error('❌ Gagal kirim email reset password:', mailErr);
            });

            // REVISI: Pesan sukses secara spesifik jika email berhasil ditemukan
            res.json({ message: 'Tautan reset kata sandi telah berhasil dikirim ke email Anda!' });
        });
    });
});

// B. Endpoint untuk Menyimpan Password Baru
app.post('/api/reset-password', async (req, res) => {
    const { token, newPassword } = req.body;
    
    if (!token || !newPassword) return res.status(400).json({ error: 'Token dan password baru wajib diisi.' });

    // Cari user dengan token yang cocok dan belum kedaluwarsa
    db.get(`SELECT id FROM users WHERE reset_token = ? AND reset_token_expires > ?`, [token, new Date().toISOString()], async (err, user) => {
        if (err || !user) return res.status(400).json({ error: 'Tautan reset tidak valid atau sudah kedaluwarsa.' });

        try {
            // Hash password baru
            const hash = await bcrypt.hash(newPassword, 10);
            
            // Update password dan kosongkan kembali token reset
            db.run(`UPDATE users SET password_hash = ?, reset_token = NULL, reset_token_expires = NULL WHERE id = ?`, [hash, user.id], (updateErr) => {
                if (updateErr) return res.status(500).json({ error: 'Gagal memperbarui kata sandi.' });
                res.json({ message: 'Kata sandi berhasil diperbarui! Silakan login dengan sandi baru Anda.' });
            });
        } catch (e) {
            res.status(500).json({ error: 'Server error saat memproses sandi.' });
        }
    });
});

// --- API MANAJEMEN DATA PERMOHONAN ---
app.post('/api/requests', requireLogin, async (req, res) => {
    const { departemen_pemohon, dipersiapkan_oleh, outages } = req.body;
    try {
        // 1. Simpan data permohonan ke database
        const reqResult = await runQuery(
            `INSERT INTO requests (user_id, departemen, dipersiapkan_oleh, status) VALUES (?, ?, ?, 'Pending')`,
            [req.session.userId, departemen_pemohon, dipersiapkan_oleh]
        );
        const requestId = reqResult.lastID;

        // 2. Simpan detail rincian pemadaman dan tugas
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

        // =========================================================================
        // TAHAP 1: KIRIM EMAIL NOTIFIKASI HANYA KE PEMERIKSA
        // =========================================================================
        const pemeriksa = await allQuery(`SELECT email FROM users WHERE role = 'pemeriksa' AND is_verified = 1`);
        const emailsToNotify = pemeriksa.map(user => user.email).filter(e => e); 

        if (emailsToNotify.length > 0) {
            const mailOptions = {
                from: '"Sistem Pemadaman" <EMAIL_GMAIL_KAMU@gmail.com>', 
                to: emailsToNotify.join(', '), 
                subject: `[PENGAJUAN BARU] Permohonan Pemadaman #${requestId} Membutuhkan Pengecekan`,
                html: `
                    <div style="font-family: sans-serif; padding: 20px; color: #333; border: 1px solid #eaeaea; border-radius: 10px;">
                        <h2 style="color: #0284c7; margin-top: 0;">Permohonan Membutuhkan Pengecekan</h2>
                        <p>Halo Tim Pemeriksa,</p>
                        <p>Terdapat pengajuan jadwal pemadaman baru dari <b>${req.session.username}</b> (Departemen: ${departemen_pemohon}).</p>
                        <p>Mohon segera login ke dalam Dasbor untuk mengecek kelengkapan dokumen dan SLD, lalu ubah statusnya menjadi <b>Diperiksa</b> agar dapat diteruskan ke Manajer.</p>
                        <br>
                        <a href="http://localhost:3000/login.html" style="display: inline-block; background: #0A0A0A; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Cek Dokumen</a>
                    </div>
                `
            };

            transporter.sendMail(mailOptions, (error) => {
                if (error) console.error('❌ Gagal mengirim notifikasi ke pemeriksa:', error);
                else console.log(`✅ Notifikasi tahap 1 (Pemeriksa) dikirim ke: ${emailsToNotify.join(', ')}`);
            });
        }

        res.status(201).json({ message: 'Permohonan jadwal berhasil disimpan!' });
    } catch (err) { 
        console.error(err);
        res.status(500).json({ error: 'Gagal menyimpan data.' }); 
    }
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
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/requests/:id/status', requireLogin, async (req, res) => {
    const { status } = req.body;
    const role = req.session.role;

    // Validasi Keamanan Role
    if (role === 'pemohon') return res.status(403).json({ error: 'Akses ditolak.' });
    if (role === 'pemeriksa' && !['Diperiksa', 'Ditolak'].includes(status)) {
        return res.status(403).json({ error: 'Pemeriksa hanya dapat memverifikasi (Diperiksa) atau menolak.' });
    }
    if (role === 'penyetuju' && !['Disetujui', 'Ditolak'].includes(status)) {
        return res.status(403).json({ error: 'Manajer HANYA dapat memberikan persetujuan final (YA) atau menolak (TIDAK).' });
    }

    try {
        await runQuery(`UPDATE requests SET status = ? WHERE id = ?`, [status, req.params.id]);

        // Ambil data detail permohonan untuk isi email
        const reqData = await allQuery(`SELECT r.*, u.username, u.email FROM requests r JOIN users u ON r.user_id = u.id WHERE r.id = ?`, [req.params.id]);
        const requestInfo = reqData[0];

        // =========================================================================
        // TAHAP 2: JIKA DIPERIKSA -> KIRIM NOTIFIKASI KE PENYETUJU (MANAJER)
        // =========================================================================
        if (status === 'Diperiksa') {
            const penyetuju = await allQuery(`SELECT email FROM users WHERE role = 'penyetuju' AND is_verified = 1`);
            const emailsPenyetuju = penyetuju.map(user => user.email).filter(e => e); 

            if (emailsPenyetuju.length > 0) {
                const mailOptions = {
                    from: '"Sistem Pemadaman" <EMAIL_GMAIL_KAMU@gmail.com>',
                    to: emailsPenyetuju.join(', '),
                    subject: `[PERLU PERSETUJUAN] Pengajuan Pemadaman #${requestInfo.id} Telah Diverifikasi`,
                    html: `
                        <div style="font-family: sans-serif; padding: 20px; color: #333; border: 1px solid #eaeaea; border-radius: 10px;">
                            <h2 style="color: #d97706; margin-top: 0;">Menunggu Persetujuan Final</h2>
                            <p>Halo Tim Penyetuju,</p>
                            <p>Permohonan pemadaman dari <b>${requestInfo.departemen}</b> telah dicek dan diverifikasi oleh Tim Pemeriksa.</p>
                            <p>Mohon masuk ke Dasbor untuk memberikan persetujuan akhir (Disetujui / Ditolak).</p>
                            <br>
                            <a href="http://localhost:3000/login.html" style="display: inline-block; background: #0A0A0A; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Berikan Keputusan</a>
                        </div>
                    `
                };

                transporter.sendMail(mailOptions, (error) => {
                    if (error) console.error('❌ Gagal mengirim notifikasi ke penyetuju:', error);
                    else console.log(`✅ Notifikasi tahap 2 (Penyetuju) dikirim ke: ${emailsPenyetuju.join(', ')}`);
                });
            }
        }

        // =========================================================================
        // TAHAP 3: JIKA DISETUJUI / DITOLAK -> KIRIM KONFIRMASI KE PEMOHON
        // =========================================================================
        else if (status === 'Disetujui' || status === 'Ditolak') {
            const emailPemohon = requestInfo.email;
            
            if (emailPemohon) {
                const colorCode = status === 'Disetujui' ? '#059669' : '#dc2626'; // Hijau / Merah
                const actionText = status === 'Disetujui' ? 'DISETUJUI' : 'DITOLAK';

                const mailOptions = {
                    from: '"Sistem Pemadaman" <EMAIL_GMAIL_KAMU@gmail.com>',
                    to: emailPemohon,
                    subject: `[${actionText}] Keputusan Permohonan Pemadaman #${requestInfo.id}`,
                    html: `
                        <div style="font-family: sans-serif; padding: 20px; color: #333; border: 1px solid #eaeaea; border-radius: 10px;">
                            <h2 style="color: ${colorCode}; margin-top: 0;">Status Permohonan: ${actionText}</h2>
                            <p>Halo <b>${requestInfo.dipersiapkan_oleh}</b>,</p>
                            <p>Permohonan jadwal pemadaman Anda untuk departemen <b>${requestInfo.departemen}</b> telah <strong>${status.toLowerCase()}</strong> oleh Manajer.</p>
                            <p>Detail pengajuan dapat Anda lihat kembali melalui Dasbor sistem.</p>
                            <br>
                            <a href="http://localhost:3000/login.html" style="display: inline-block; background: #0A0A0A; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Buka Dashboard</a>
                        </div>
                    `
                };

                transporter.sendMail(mailOptions, (error) => {
                    if (error) console.error('❌ Gagal mengirim notifikasi ke pemohon:', error);
                    else console.log(`✅ Notifikasi tahap 3 (Pemohon) dikirim ke: ${emailPemohon}`);
                });
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
    console.log(`Server Utama berjalan di http://localhost:${PORT}`);
});