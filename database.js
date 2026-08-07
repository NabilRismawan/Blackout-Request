const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Gagal terkoneksi ke database SQLite:', err.message);
    } else {
        console.log('Terhubung ke database SQLite.');

        // Tabel Users
        db.run(`CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            role TEXT NOT NULL,
            is_verified INTEGER DEFAULT 0,
            verification_token TEXT,
            reset_token TEXT,
            reset_token_expires DATETIME
        )`);
        
        // Tabel Requests
        db.run(`CREATE TABLE IF NOT EXISTS requests (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            departemen TEXT,
            dipersiapkan_oleh TEXT,
            remark TEXT,
            surat_to TEXT,
            butuh_ses INTEGER DEFAULT 0,
            ses_section TEXT,
            ses_name TEXT,
            ses_date DATETIME,
            status TEXT,
            pemeriksa_oleh TEXT,
            pemeriksa_date DATETIME, /* TAMBAHAN BARU */
            disetujui_oleh TEXT,
            disetujui_date DATETIME, /* TAMBAHAN BARU */
            tanggal_pengajuan DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        // Tabel Outages
        db.run(`CREATE TABLE IF NOT EXISTS outages (
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
            FOREIGN KEY (request_id) REFERENCES requests (id)
        )`);

        // Tabel Tasks
        db.run(`CREATE TABLE IF NOT EXISTS tasks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            outage_id INTEGER,
            deskripsi TEXT,
            FOREIGN KEY (outage_id) REFERENCES outages (id)
        )`);
    }
});

module.exports = db;    