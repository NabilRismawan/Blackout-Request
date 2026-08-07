// --- public/js/app.js ---
let currentRole = 'pemohon';
let outageCount = 1;

// 1. KONFIGURASI DYNAMIC SIDEBAR 
const iconGrid = `<svg data-encore-id="icon" class="w-6 h-6 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"></path></svg>`;
const iconForm = `<svg data-encore-id="icon" class="w-6 h-6 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>`;
const iconHistory = `<svg data-encore-id="icon" class="w-6 h-6 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>`;
const iconCheck = `<svg data-encore-id="icon" class="w-6 h-6 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>`;

const menuConfig = {
    pemohon: [
        { id: 'overview', text: 'Dashboard Overview', icon: iconGrid },
        { id: 'form', text: 'Buat Permohonan', icon: iconForm },
        { id: 'history', text: 'Histori Pengajuan', icon: iconHistory }
    ],
    pemeriksa: [
        { id: 'overview', text: 'Dashboard Overview', icon: iconGrid },
        { id: 'form', text: 'Buat Permohonan', icon: iconForm },
        { id: 'history', text: 'Histori Pengajuan', icon: iconHistory },
        { id: 'approval', text: 'Panel Pemeriksa POP', icon: iconCheck }
    ],
    penyetuju: [
        { id: 'overview', text: 'Dashboard Overview', icon: iconGrid },
        { id: 'form', text: 'Buat Permohonan', icon: iconForm },
        { id: 'history', text: 'Histori Pengajuan', icon: iconHistory },
        { id: 'approval', text: 'Panel Persetujuan POP', icon: iconCheck }
    ]
};

function renderSidebarMenu(role) {
    const menus = menuConfig[role] || menuConfig['pemohon'];
    const desktopContainer = document.getElementById('desktop-nav-container');
    const mobileContainer = document.getElementById('mobile-nav-container');

    let desktopHTML = '';
    let mobileHTML = '';

    menus.forEach(menu => {
        // Teks span diberi class opacity-0
        desktopHTML += `
        <button onclick="showView('${menu.id}')" id="nav-${menu.id}" class="nav-btn w-full flex items-center p-3 rounded-xl text-xs uppercase tracking-[0.15em] transition-colors text-white/50 hover:bg-white/10 hover:text-white group">
            <div class="ml-1 shrink-0">${menu.icon}</div>
            <span class="sidebar-text ml-4 font-medium opacity-0 transition-opacity duration-300">${menu.text}</span>
        </button>`;
        
        mobileHTML += `<button onclick="showView('${menu.id}'); toggleMobileMenu()" id="nav-${menu.id}-mobile" class="nav-btn w-full text-left block px-4 py-3 rounded-lg text-xs uppercase tracking-[0.15em] transition-colors text-white/50 hover:text-white">${menu.text}</button>`;
    });

    if (desktopContainer) desktopContainer.innerHTML = desktopHTML;
    if (mobileContainer) mobileContainer.innerHTML = mobileHTML;
}

// 2. Navigasi & Mobile Menu
function toggleMobileMenu() {
    const drawer = document.getElementById('mobileDrawer');
    const overlay = document.getElementById('drawerOverlay');
    if (drawer.classList.contains('-translate-x-full')) {
        drawer.classList.remove('-translate-x-full');
        overlay.classList.remove('hidden');
        setTimeout(() => overlay.classList.remove('opacity-0'), 10);
    } else {
        drawer.classList.add('-translate-x-full');
        overlay.classList.add('opacity-0');
        setTimeout(() => overlay.classList.add('hidden'), 300);
    }
}

function showView(viewName) {
    const views = ['overview', 'form', 'history', 'approval'];
    views.forEach(v => {
        const section = document.getElementById(`view-${v}`);
        if(section) section.classList.add('hidden');
    });

    const activeSection = document.getElementById(`view-${viewName}`);
    if(activeSection) activeSection.classList.remove('hidden');
    
    // Reset Desktop
    document.querySelectorAll('#desktop-nav-container .nav-btn').forEach(btn => {
        btn.classList.remove('bg-white', 'text-inalum-blue');
        btn.classList.add('text-white/50', 'hover:bg-white/10', 'hover:text-white');
    });
    
    const activeNav = document.getElementById(`nav-${viewName}`);
    if(activeNav) {
        activeNav.classList.remove('text-white/50', 'hover:bg-white/10', 'hover:text-white');
        activeNav.classList.add('bg-white', 'text-inalum-blue');
    }

    // Reset Mobile
    document.querySelectorAll('#mobile-nav-container .nav-btn').forEach(btn => {
        btn.classList.remove('bg-white', 'text-inalum-blue', 'font-bold');
        btn.classList.add('text-white/50');
    });
    
    const activeMobileNav = document.getElementById(`nav-${viewName}-mobile`);
    if(activeMobileNav) {
        activeMobileNav.classList.remove('text-white/50');
        activeMobileNav.classList.add('bg-white', 'text-inalum-blue', 'font-bold');
    }

    if(['overview', 'history', 'approval'].includes(viewName)) loadDataFromServer();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// 3. Utilities & Notifications
function showNotification(msg, styleClass) {
    const el = document.getElementById('alertNotification');
    el.innerText = msg;
    el.className = `max-w-5xl mx-auto border p-4 rounded-xl text-xs md:text-sm text-center font-medium shadow-sm ${styleClass}`;
    el.classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setTimeout(() => el.classList.add('hidden'), 5000);
}

// 4. Animasi Dasbor
const heroPhrases = ['Kelola Pemadaman.', 'Rencanakan Presisi.', 'Pantau Setiap Proses.'];
let heroPhraseIndex = 0; let heroCharIndex = 0; let heroDeleting = false;

function tickHeroTyping() {
    const el = document.getElementById('heroTypedText');
    if (!el) return;
    const current = heroPhrases[heroPhraseIndex];
    if (!heroDeleting && heroCharIndex === current.length) {
        setTimeout(() => { heroDeleting = true; tickHeroTyping(); }, 1600); return;
    }
    if (heroDeleting && heroCharIndex === 0) {
        heroDeleting = false; heroPhraseIndex = (heroPhraseIndex + 1) % heroPhrases.length;
    }
    heroCharIndex += heroDeleting ? -1 : 1;
    el.textContent = current.slice(0, heroCharIndex);
    setTimeout(tickHeroTyping, heroDeleting ? 35 : 75);
}

function tickHeroClock() {
    const el = document.getElementById('heroClock');
    if (!el) return;
    const isMobile = window.innerWidth < 640;
    const options = isMobile ? { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' } : { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' };
    el.textContent = new Date().toLocaleString('id-ID', options).replace('pukul', '|');
}

function animateCountUp(id, target) {
    const el = document.getElementById(id);
    if (!el) return;
    const from = parseInt(el.dataset.value || '0', 10);
    if (from === target) { el.textContent = target; return; }
    const duration = 600; const start = performance.now();
    function frame(now) {
        const progress = Math.min((now - start) / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 4);
        const value = Math.round(from + (target - from) * eased);
        el.textContent = value;
        if (progress < 1) requestAnimationFrame(frame); else el.dataset.value = target;
    }
    requestAnimationFrame(frame);
}

function timeAgo(dateString) {
    const diffMs = Date.now() - new Date(dateString).getTime();
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return 'Baru saja';
    if (mins < 60) return `${mins} menit lalu`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours} jam lalu`;
    return `${Math.floor(hours / 24)} hari lalu`;
}

// 5. Logika Data & Fetch API
function statusDot(status) {
    if(status === 'Disetujui' || status === 'Approved') return 'bg-inalum-green';
    if(status === 'Diperiksa POP') return 'bg-inalum-blue';
    if(status === 'Ditolak' || status === 'Rejected') return 'bg-inalum-red';
    return 'bg-amber-500';
}

function statusBadge(status) {
    return `<span class="inline-flex items-center gap-1.5 px-2 md:px-3 py-1 rounded-full border border-border text-[9px] md:text-[10px] uppercase tracking-[0.15em] font-medium whitespace-nowrap"><span class="h-1.5 w-1.5 rounded-full ${statusDot(status)} shrink-0"></span>${status}</span>`;
}

function renderRecentActivity(listData) {
    const el = document.getElementById('recentActivityList');
    if (!el) return;
    if (!listData.length) {
        el.innerHTML = '<p class="p-6 text-sm text-muted italic text-center md:text-left">Belum ada pengajuan.</p>'; return;
    }
    const recent = [...listData].sort((a, b) => new Date(b.tanggal_pengajuan) - new Date(a.tanggal_pengajuan)).slice(0, 5);
    el.innerHTML = recent.map((d, i) => `
        <div class="fade-up-row flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 p-4 md:p-5 hover:bg-background-soft/50 transition-colors" style="animation-delay: ${i * 60}ms">
            <div class="flex items-center gap-3 md:gap-4 min-w-0">
                <div class="h-8 w-8 md:h-9 md:w-9 shrink-0 rounded-full bg-inalum-blue text-white flex items-center justify-center text-[10px] md:text-xs font-medium">${(d.username || '?')[0].toUpperCase()}</div>
                <div class="min-w-0">
                    <p class="text-xs md:text-sm font-medium truncate">${d.username} &middot; ${d.departemen}</p>
                    <p class="text-[10px] md:text-xs text-muted mt-0.5">${timeAgo(d.tanggal_pengajuan)}</p>
                </div>
            </div>
            <div class="self-start sm:self-auto ml-11 sm:ml-0">${statusBadge(d.status)}</div>
        </div>
    `).join('');
}

async function loadDataFromServer() {
    try {
        const res = await fetch('/api/requests/data');
        const listData = await res.json();

        animateCountUp('stat-total', listData.length);
        animateCountUp('stat-pending', listData.filter(d => d.status === 'Pending').length);
        animateCountUp('stat-approved', listData.filter(d => d.status === 'Approved' || d.status === 'Disetujui').length);
        animateCountUp('stat-rejected', listData.filter(d => d.status === 'Rejected' || d.status === 'Ditolak').length);
        renderRecentActivity(listData);

        const historyFilter = document.getElementById('historyDateFilter')?.value;
        const approvalFilter = document.getElementById('approvalDateFilter')?.value;
        const getLocalDateString = (utcDateStr) => { const d = new Date(utcDateStr); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

        let historyData = listData;
        if (historyFilter) historyData = historyData.filter(d => getLocalDateString(d.tanggal_pengajuan) === historyFilter);
        let approvalData = listData;
        if (approvalFilter) approvalData = approvalData.filter(d => getLocalDateString(d.tanggal_pengajuan) === approvalFilter);

        const tbodyHistory = document.getElementById('historyTableBody');
        if (historyData.length === 0) {
            tbodyHistory.innerHTML = `<tr><td colspan="6" class="p-6 text-center text-muted italic">Tidak ada pengajuan pada tanggal tersebut.</td></tr>`;
        } else {
            tbodyHistory.innerHTML = historyData.map(d => `
                <tr class="border-b border-border hover:bg-background-soft/50 transition-colors">
                    <td class="p-3 md:p-4 font-medium">#${d.id}</td>
                    <td class="p-3 md:p-4">${d.username}</td>
                    <td class="p-3 md:p-4">${d.departemen}</td>
                    <td class="p-3 md:p-4">${new Date(d.tanggal_pengajuan).toLocaleString('id-ID', {day:'numeric', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit'})}</td>
                    <td class="p-3 md:p-4">${statusBadge(d.status)}</td>
                    <td class="p-3 md:p-4 text-right"><button onclick="openDetailModal(${d.id})" class="bg-white border border-border px-3 md:px-4 py-1.5 md:py-2 rounded-full text-[9px] md:text-[10px] uppercase tracking-[0.15em] font-medium hover:bg-inalum-blue hover:text-white transition-colors whitespace-nowrap">Detail</button></td>
                </tr>
            `).join('');
        }

        if(['pemeriksa', 'penyetuju'].includes(currentRole)) {
            const tbodyApproval = document.getElementById('approvalTableBody');
            if (approvalData.length === 0) {
                tbodyApproval.innerHTML = `<tr><td colspan="5" class="p-6 text-center text-muted italic">Tidak ada dokumen yang perlu divalidasi pada tanggal tersebut.</td></tr>`;
            } else {
                tbodyApproval.innerHTML = approvalData.map(d => {
                    let actionButtons = `<span class="text-[10px] md:text-xs text-muted italic whitespace-nowrap">Menunggu Tahap Lain</span>`;

                    if (currentRole === 'pemeriksa' && d.status === 'Pending') {
                        actionButtons = `
                            <button onclick="openPopProcessModal(${d.id})" class="bg-inalum-blue text-white px-3 md:px-4 py-1.5 md:py-2 rounded-full text-[9px] md:text-[10px] uppercase tracking-[0.15em] font-medium hover:bg-inalum-bluehover transition-transform active:scale-95 whitespace-nowrap">Proses Dokumen</button>
                        `;
                    } else if (currentRole === 'penyetuju' && d.status === 'Diperiksa POP') {
                        actionButtons = `
                            <button onclick="updateStatus(${d.id}, 'Disetujui')" class="bg-inalum-green text-white px-4 md:px-6 py-1.5 md:py-2 rounded-full text-[9px] md:text-[10px] uppercase tracking-[0.15em] font-medium hover:bg-inalum-green/90 transition-transform active:scale-95 whitespace-nowrap">Ya, Setuju</button>
                            <button onclick="updateStatus(${d.id}, 'Ditolak')" class="border border-inalum-red text-inalum-red px-4 md:px-6 py-1.5 md:py-2 rounded-full text-[9px] md:text-[10px] uppercase tracking-[0.15em] font-medium hover:bg-inalum-red hover:text-white transition-transform active:scale-95 whitespace-nowrap">Tolak</button>
                        `;
                    }

                    return `
                    <tr class="border-b border-border hover:bg-background-soft/50 transition-colors">
                        <td class="p-3 md:p-4 font-medium">#${d.id}</td>
                        <td class="p-3 md:p-4">${d.dipersiapkan_oleh}</td>
                        <td class="p-3 md:p-4">${d.departemen}</td>
                        <td class="p-3 md:p-4">${statusBadge(d.status)}</td>
                        <td class="p-3 md:p-4 text-right">
                            <div class="flex flex-wrap justify-end items-center gap-2">
                                <button onclick="openDetailModal(${d.id})" class="bg-white border border-border px-3 md:px-4 py-1.5 md:py-2 rounded-full text-[9px] md:text-[10px] uppercase tracking-[0.15em] font-medium hover:bg-background-soft transition-colors whitespace-nowrap">Lihat</button>
                                ${actionButtons}
                            </div>
                        </td>
                    </tr>
                    `;
                }).join('');
            }
        }
    } catch(e) { console.error(e); }
}

// 6. Modal POP & Status
function openPopProcessModal(id) {
    document.getElementById('pop_req_id').value = id;
    document.getElementById('popProcessModal').classList.remove('hidden');
}

function closePopProcessModal() {
    document.getElementById('popProcessModal').classList.add('hidden');
}

async function submitPopProcess(e) {
    e.preventDefault();
    const id = document.getElementById('pop_req_id').value;
    const surat_to = document.getElementById('pop_surat_to').value;
    const status = 'Diperiksa POP';

    if(!confirm(`Apakah Anda yakin ingin memproses dokumen ini menjadi status "${status}"?`)) return;

    try {
        const res = await fetch(`/api/requests/${id}/status`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ status, surat_to, butuh_ses: false, ses_section: '', ses_name: '', ses_date: '' })
        });
        if(res.ok) {
            closePopProcessModal();
            showNotification('Dokumen berhasil diproses!', 'bg-background-soft text-inalum-blue border-border');
            loadDataFromServer();
        }
    } catch(e) { console.error(e); }
}

async function updateStatus(id, newStatus) {
    let confirmMsg = `Ubah status pengajuan #${id} menjadi ${newStatus}?`;
    if(newStatus === 'Disetujui' || newStatus === 'Ditolak') {
        confirmMsg = `Apakah Anda yakin ingin memberikan keputusan ${newStatus} pada pengajuan #${id}?`;
    }
    if(!confirm(confirmMsg)) return;

    try {
        const res = await fetch(`/api/requests/${id}/status`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ status: newStatus })
        });
        if(res.ok) {
            showNotification('Keputusan berhasil disimpan!', 'bg-background-soft text-inalum-blue border-border');
            loadDataFromServer();
        }
    } catch(e) { console.error(e); }
}

// 7. Auth & Initialize
const handleLogout = async () => {
    const res = await fetch('/api/logout', { method: 'POST' });
    if (res.ok) window.location.href = '/login.html';
};

document.getElementById('logoutBtn').addEventListener('click', handleLogout);
document.getElementById('logoutBtnMobile').addEventListener('click', handleLogout);

document.addEventListener('DOMContentLoaded', async () => {
    setInterval(tickHeroClock, 1000); 
    tickHeroClock(); 
    tickHeroTyping();

    try {
        const res = await fetch('/api/user/me');
        if(!res.ok) window.location.href = '/login.html';
        const user = await res.json();

        currentRole = user.role;
        document.getElementById('userGreeting').innerText = `${user.username} (${user.role})`;
        document.getElementById('avatarLetter').innerText = user.username[0].toUpperCase();

        // MERENDER SIDEBAR DINAMIS
        renderSidebarMenu(currentRole);

        if(['pemeriksa', 'penyetuju'].includes(currentRole)) {
            let title = currentRole === 'pemeriksa' ? 'Panel Pemeriksa POP' : 'Panel Persetujuan POP';
            const panelTitleEl = document.getElementById('approvalPanelTitle');
            if(panelTitleEl) panelTitleEl.innerText = title;
        }

        if (typeof initCanvasForOutage === 'function') {
            initCanvasForOutage(document.querySelector('.outage-block'));
        }
        
        showView('overview');
    } catch (e) { window.location.href = '/login.html'; }
});