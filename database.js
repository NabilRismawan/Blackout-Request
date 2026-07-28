const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Tentukan lokasi file database (otomatis terbuat jika belum ada)
const dbPath = path.join(__dirname, 'database.sqlite');

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Gagal membuka database:', err.message);
    } else {
        console.log('Terkoneksi ke database SQLite.');
    }
});

// Buat tabel jika belum ada (Skema Baru)
db.serialize(() => {
    // Tabel Users yang sudah di-update dengan email dan status verifikasi
    db.run(`
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT,
                email TEXT UNIQUE,
                password_hash TEXT,
                role TEXT,
                is_verified INTEGER DEFAULT 0,
                verification_token TEXT,
                reset_token TEXT,
                reset_token_expires DATETIME
            )
        `);
    
    // Tabel Requests (Permohonan)
    db.run(`
        CREATE TABLE IF NOT EXISTS requests (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            departemen TEXT,
            dipersiapkan_oleh TEXT,
            status TEXT DEFAULT 'Pending',
            tanggal_pengajuan DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES users(id)
        )
    `);

    // Tabel Outages (Pemadaman)
    db.run(`
        CREATE TABLE IF NOT EXISTS outages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            request_id INTEGER,
            jenis_pemadaman TEXT,
            area_dari TEXT,
            area_ke TEXT,
            waktu_kerja_mulai DATETIME,
            waktu_kerja_selesai DATETIME,
            waktu_padam_mulai DATETIME,
            waktu_padam_selesai DATETIME,
            titik_pentahanan TEXT,
            komunikasi TEXT,
            kepala_pelaksana TEXT,
            keterangan TEXT,
            sld_data TEXT,
            FOREIGN KEY(request_id) REFERENCES requests(id)
        )
    `);

    // Tabel Tasks (Rincian Pekerjaan)
    db.run(`
        CREATE TABLE IF NOT EXISTS tasks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            outage_id INTEGER,
            deskripsi TEXT,
            FOREIGN KEY(outage_id) REFERENCES outages(id)
        )
    `);
});

module.exports = db;
