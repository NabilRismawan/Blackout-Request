const ldap = require('ldapjs');

const server = ldap.createServer();
const PORT = 1389;
const BASE_DN = 'dc=outagesys,dc=com';

// ---------------------------------------------------------
// INILAH "DATABASE PUSAT" PERUSAHAAN (Hanya ada di server LDAP)
// Tim IT pusat mengelola data ini, BUKAN dari dalam kode aplikasi
// ---------------------------------------------------------
const directoryDB = {
    'budi': { password: 'password123', title: 'General Manager' },
    'siti': { password: 'password123', title: 'Supervisor Teknis' },
    'alex': { password: 'password123', title: 'IT Administrator' },
    'nabil': { password: 'password123', title: 'Staff Engineer' }
};

// 1. Logika Autentikasi (BIND) - "Apakah Sandi Benar?"
server.bind(BASE_DN, (req, res, next) => {
    const dn = req.dn.toString(); 
    // Mengambil username dari format: cn=nama_user,ou=Karyawan,dc=outagesys,dc=com
    const match = dn.match(/cn=([^,]+)/);
    const username = match ? match[1] : null;

    console.log(`[LDAP-SERVER] Menerima permintaan login untuk: ${username}`);

    if (!username || !directoryDB[username] || req.credentials !== directoryDB[username].password) {
        console.log(`[LDAP-SERVER] ❌ Akses Ditolak: Kredensial Salah`);
        return next(new ldap.InvalidCredentialsError());
    }

    console.log(`[LDAP-SERVER] ✅ Akses Diizinkan`);
    res.end();
    return next();
});

// 2. Logika Profil (SEARCH) - "Apa Jabatan Orang Ini?"
server.search(BASE_DN, (req, res, next) => {
    const dn = req.dn.toString();
    const match = dn.match(/cn=([^,]+)/);
    const username = match ? match[1] : null;

    if (username && directoryDB[username]) {
        console.log(`[LDAP-SERVER] Mengirim profil ${username} (Jabatan: ${directoryDB[username].title}) ke Aplikasi`);
        
        const obj = {
            dn: req.dn.toString(),
            attributes: {
                cn: username,
                title: directoryDB[username].title
            }
        };
        res.send(obj);
    }
    
    res.end();
    return next();
});

// Jalankan Server LDAP
server.listen(PORT, '127.0.0.1', () => {
    console.log(`\n================================================`);
    console.log(`🏢 MOCK LDAP SERVER (ACTIVE DIRECTORY) AKTIF`);
    console.log(`📍 Berjalan di ldap://127.0.0.1:${PORT}`);
    console.log(`================================================\n`);
});