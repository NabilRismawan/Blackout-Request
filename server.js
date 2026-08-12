require('dotenv').config();
const express = require('express');
const session = require('express-session');
const bcrypt = require('bcrypt');
const path = require('path');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const db = require('./database');
const helmet = require('helmet'); // Fix #14 (Security Headers)
const rateLimit = require('express-rate-limit'); // Fix #9 (Rate Limiting)

// Fix #6 (Hardcoded Secret) - Hentikan aplikasi jika secret tidak ada
if (!process.env.SESSION_SECRET) {
    console.error("FATAL ERROR: SESSION_SECRET is not set in .env!");
    process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 3000;

app.set('trust proxy', 1); // Wajib jika menggunakan Ngrok / Reverse Proxy

// Fix #14 (Security Headers)
app.use(helmet({
    contentSecurityPolicy: false // Matikan sementara jika memblokir Tailwind via CDN
}));

// Fix #11 (DoS Body Limit) - Ubah default limit ke 100kb, 50mb hanya untuk rute spesifik
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: true, limit: '100kb' }));

// Fix #7 & #8 (Insecure Cookie & CSRF Mitigation)
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false, 
    saveUninitialized: false,
    cookie: { 
        secure: process.env.NODE_ENV === 'production', // true di production (HTTPS)
        httpOnly: true,
        sameSite: 'lax', // Mitigasi sebagian besar serangan CSRF
        maxAge: 1000 * 60 * 60 * 24 
    }
}));

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
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

// Fix #9 (Rate Limiting Auth)
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 Menit
    max: 10, // Max 10 kali coba
    message: { error: 'Terlalu banyak percobaan, coba lagi nanti.' }
});

app.get('/', (req, res) => res.redirect('/login.html'));

// =========================================================================
// API AUTENTIKASI
// =========================================================================

app.post('/api/register', authLimiter, async (req, res) => {
    const { username, email, password, role = 'pemohon' } = req.body;
    const token = crypto.randomBytes(20).toString('hex');
    try {
        const hash = await bcrypt.hash(password, 10);
        await runQuery(`INSERT INTO users (username, email, password_hash, role, is_verified, verification_token) VALUES (?, ?, ?, ?, 0, ?)`, 
            [username, email, hash, role, token]);
        res.status(201).json({ message: 'Registrasi sukses! Silakan cek email.' });
    } catch (e) { res.status(400).json({ error: 'Pendaftaran gagal.' }); } // Generic Message (User Enum)
});

app.post('/api/login', authLimiter, (req, res) => {
    const { email, password } = req.body;
    db.get(`SELECT * FROM users WHERE email = ?`, [email], async (err, user) => {
        // Fix #9 (User Enumeration) - Selalu beri pesan generik "Email atau kata sandi salah"
        if (err || !user) return res.status(401).json({ error: 'Email atau kata sandi salah.' });
        if (user.is_verified === 0) return res.status(403).json({ error: 'Akun belum diverifikasi.' });
        const match = await bcrypt.compare(password, user.password_hash);
        if (!match) return res.status(401).json({ error: 'Email atau kata sandi salah.' });
        req.session.userId = user.id; req.session.username = user.username; req.session.role = user.role;
        req.session.save(() => res.status(200).json({ message: 'Login Berhasil', redirect: '/dashboard' }));
    });
});

app.post('/api/logout', (req, res) => { req.session.destroy(); res.json({ success: true }); });
app.get('/api/user/me', requireLogin, (req, res) => res.json({ username: req.session.username, role: req.session.role }));

// =========================================================================
// API PERMOHONAN
// =========================================================================

// Fix #11 (DoS Vector) - Limit 50MB HANYA diaplikasikan ke rute insert yang membawa gambar SLD
app.post('/api/requests', requireLogin, express.json({ limit: '50mb' }), async (req, res) => {
    const { departemen_pemohon, dipersiapkan_oleh, remark, outages } = req.body;
    
    // Fix #16 (N+1 Query Pattern / Atomicity via Transaction)
    try {
        await runQuery('BEGIN TRANSACTION');
        const reqResult = await runQuery(`INSERT INTO requests (user_id, departemen, dipersiapkan_oleh, remark, status) VALUES (?, ?, ?, ?, 'Pending')`, [req.session.userId, departemen_pemohon, dipersiapkan_oleh, remark]);
        const requestId = reqResult.lastID;

        for (let out of outages) {
            const outResult = await runQuery(`INSERT INTO outages (request_id, jenis_pemadaman, area_dari, area_ke, waktu_kerja_mulai, waktu_kerja_selesai, waktu_padam_mulai, waktu_padam_selesai, titik_pentahanan, komunikasi, kepala_pelaksana, keterangan, sld_data) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [requestId, out.jenis_pemadaman, out.area_dari, out.area_ke, out.waktu_kerja_mulai, out.waktu_kerja_selesai, out.waktu_padam_mulai, out.waktu_padam_selesai, out.titik_pentahanan, out.komunikasi, out.kepala_pelaksana, out.keterangan, out.sld_data]);
            const outageId = outResult.lastID;
            for (let taskDesc of out.tasks) {
                if (taskDesc.trim() !== "") await runQuery(`INSERT INTO tasks (outage_id, deskripsi) VALUES (?, ?)`, [outageId, taskDesc]);
            }
        }
        await runQuery('COMMIT');
        res.status(201).json({ message: 'Permohonan berhasil disimpan!' });
    } catch (err) { 
        await runQuery('ROLLBACK');
        res.status(500).json({ error: 'Gagal menyimpan data.' }); 
    }
});

app.get('/api/requests/data', requireLogin, async (req, res) => {
    let sql = `SELECT r.*, u.username FROM requests r JOIN users u ON r.user_id = u.id`;
    let params = [];
    if (req.session.role === 'pemohon') {
        sql += ` WHERE r.user_id = ?`; params.push(req.session.userId);
    }
    sql += ` ORDER BY r.tanggal_pengajuan DESC LIMIT 50`; // Partial Fix #18 (Simple unpaginated bound)
    try { const rows = await allQuery(sql, params); res.json(rows); } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/requests/:id/detail', requireLogin, async (req, res) => {
    try {
        const reqData = await allQuery(`SELECT r.*, u.username FROM requests r JOIN users u ON r.user_id = u.id WHERE r.id = ?`, [req.params.id]);
        if (reqData.length === 0) return res.status(404).json({ error: 'Permohonan tidak ditemukan' });
        
        // Fix #4 (IDOR) - Pastikan pemohon hanya bisa lihat miliknya sendiri
        if (req.session.role === 'pemohon' && reqData[0].user_id !== req.session.userId) {
            return res.status(403).json({ error: 'Akses ditolak.' });
        }

        const requestInfo = reqData[0];
        const outages = await allQuery(`SELECT * FROM outages WHERE request_id = ?`, [req.params.id]);
        
        // Fix #17 (N+1 Fetch) - Ambil semua tasks dengan 1 Query (Batched)
        if (outages.length > 0) {
            const outageIds = outages.map(o => o.id);
            const placeholders = outageIds.map(() => '?').join(',');
            const allTasks = await allQuery(`SELECT outage_id, deskripsi FROM tasks WHERE outage_id IN (${placeholders})`, outageIds);
            
            outages.forEach(out => {
                out.tasks = allTasks.filter(t => t.outage_id === out.id).map(t => t.deskripsi);
            });
        }
        res.json({ request: requestInfo, outages: outages });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/requests/:id/status', requireLogin, async (req, res) => {
    const { status, surat_to, ses_name, ses_date } = req.body;
    const role = req.session.role;

    try {
        // Fix #3 (Broken Access Control) - Dapatkan status asli dari DB terlebih dahulu
        const currentReq = await allQuery(`SELECT status FROM requests WHERE id = ?`, [req.params.id]);
        if (currentReq.length === 0) return res.status(404).json({ error: 'Not found' });
        const currentStatus = currentReq[0].status;

        // Validasi otoritas (Role & State Guard)
        if (role === 'pemohon') return res.status(403).json({ error: 'Pemohon tidak dapat merubah status.' });
        if (role === 'pemeriksa' && currentStatus !== 'Pending') return res.status(403).json({ error: 'Dokumen ini tidak pada tahap Pemeriksa.' });
        if (role === 'penyetuju' && currentStatus !== 'Diperiksa POP') return res.status(403).json({ error: 'Dokumen ini tidak pada tahap Penyetuju.' });

        if (role === 'pemeriksa' && (status === 'Diperiksa POP' || status === 'Ditolak')) {
            await runQuery(`UPDATE requests SET status = ?, surat_to = ?, pemeriksa_oleh = ?, pemeriksa_date = ? WHERE id = ?`, 
                [status, surat_to, req.session.username, new Date().toISOString(), req.params.id]);
        } 
        else if (role === 'penyetuju' && (status === 'Disetujui' || status === 'Ditolak')) {
            await runQuery(`UPDATE requests SET status = ?, disetujui_oleh = ?, disetujui_date = ? WHERE id = ?`, 
                [status, req.session.username, new Date().toISOString(), req.params.id]);
        }
        res.json({ message: `Dokumen berhasil diproses.` });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.get('/dashboard', (req, res) => { 
    if (!req.session.userId) return res.redirect('/login.html'); 
    res.render('index'); 
});
app.listen(PORT, () => console.log(`Server berjalan di port ${PORT}`));