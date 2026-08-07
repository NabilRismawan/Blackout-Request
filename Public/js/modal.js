// --- public/js/modal.js ---

async function openDetailModal(id) {
    try {
        const res = await fetch(`/api/requests/${id}/detail`);
        if (!res.ok) throw new Error('Gagal mengambil detail');
        const data = await res.json();

        document.getElementById('modalTitle').innerText = `Detail Pengajuan #${id}`;

        // HELPER TANGGAL & JAM UNTUK MODAL WEB
        const formatDateWeb = (dateStr) => {
            if(!dateStr) return '-';
            return new Date(dateStr).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
        };
        const formatTimeWeb = (dateStr) => {
            if(!dateStr) return '-';
            return new Date(dateStr).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB';
        };

        const namaPemeriksa = data.request.pemeriksa_oleh || '<span class="text-gray-400 italic">Menunggu...</span>';
        const namaPenyetuju = data.request.disetujui_oleh || '<span class="text-gray-400 italic">Menunggu...</span>';

        // --- TAMPILAN MODAL UI (DI WEB) ---
        let contentHTML = `
            <div class="bg-white p-4 md:p-6 rounded-2xl border border-border mb-4 md:mb-6 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 md:gap-4 shadow-sm">
                <div class="col-span-2 md:col-span-1"><span class="block text-[9px] md:text-[10px] uppercase tracking-[0.15em] text-muted mb-1">Dibuat Oleh</span><span class="text-xs md:text-sm font-medium text-inalum-blue">${data.request.username}</span></div>
                <div class="col-span-2 md:col-span-1"><span class="block text-[9px] md:text-[10px] uppercase tracking-[0.15em] text-muted mb-1">Departemen</span><span class="text-xs md:text-sm font-medium text-inalum-blue">${data.request.departemen}</span></div>
                <div class="col-span-2 md:col-span-1"><span class="block text-[9px] md:text-[10px] uppercase tracking-[0.15em] text-muted mb-1">Pemeriksa (POP)</span><span class="text-xs md:text-sm font-medium text-inalum-blue">${namaPemeriksa}</span></div>
                <div class="col-span-2 md:col-span-1"><span class="block text-[9px] md:text-[10px] uppercase tracking-[0.15em] text-muted mb-1">Penyetuju (POP)</span><span class="text-xs md:text-sm font-medium text-inalum-blue">${namaPenyetuju}</span></div>
                <div class="col-span-2 md:col-span-1"><span class="block text-[9px] md:text-[10px] uppercase tracking-[0.15em] text-muted mb-1">Status</span>${statusBadge(data.request.status)}</div>
            </div>
        `;

        data.outages.forEach((out, index) => {
            contentHTML += `
                <div class="bg-white p-4 md:p-8 rounded-2xl md:rounded-3xl border border-border mb-6 shadow-sm">
                    <span class="inline-block bg-background-soft px-3 py-1 rounded-full text-[9px] md:text-[10px] uppercase tracking-[0.2em] font-medium text-inalum-blue mb-3">Pemadaman 0${index + 1}</span>
                    <h4 class="font-medium text-lg md:text-xl tracking-tight mb-4 pb-4 border-b border-border">${out.jenis_pemadaman}</h4>
                    
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-5 text-xs md:text-sm mb-6">
                        <div class="bg-background-soft p-3 md:p-4 rounded-xl border border-border col-span-1 md:col-span-2 flex flex-col md:flex-row md:items-center justify-between gap-2">
                            <div><span class="block text-[9px] md:text-[10px] uppercase tracking-[0.15em] text-muted mb-1">Area Terdampak</span><b class="font-medium">${out.area_dari}</b> <span class="text-muted mx-1">s/d</span> <b class="font-medium">${out.area_ke}</b></div>
                            <div><span class="block text-[9px] md:text-[10px] uppercase tracking-[0.15em] text-muted mb-1">Kepala Pelaksana</span><b class="font-medium">${out.kepala_pelaksana}</b></div>
                        </div>
                        
                        <div class="border border-border p-3 md:p-4 rounded-xl col-span-1 md:col-span-2">
                            <span class="block text-[9px] md:text-[10px] uppercase tracking-[0.15em] text-muted mb-2 border-b border-border pb-2">Rincian Waktu Pelaksanaan</span>
                            <div class="overflow-x-auto">
                                <table class="w-full text-left text-xs md:text-sm">
                                    <thead>
                                        <tr class="text-muted border-b border-border">
                                            <th class="py-2 font-medium">Keterangan</th>
                                            <th class="py-2 font-medium">Dari (Jam, Tanggal)</th>
                                            <th class="py-2 font-medium">Sampai (Jam, Tanggal)</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr class="border-b border-border/50">
                                            <td class="py-2 font-medium flex items-center gap-2"><span class="h-1.5 w-1.5 rounded-full bg-inalum-green shrink-0"></span>Kerja</td>
                                            <td class="py-2">${formatTimeWeb(out.waktu_kerja_mulai)}, ${formatDateWeb(out.waktu_kerja_mulai)}</td>
                                            <td class="py-2">${formatTimeWeb(out.waktu_kerja_selesai)}, ${formatDateWeb(out.waktu_kerja_selesai)}</td>
                                        </tr>
                                        <tr>
                                            <td class="py-2 font-medium flex items-center gap-2"><span class="h-1.5 w-1.5 rounded-full bg-inalum-red shrink-0"></span>Padam</td>
                                            <td class="py-2 text-inalum-red font-medium">${formatTimeWeb(out.waktu_padam_mulai)}, ${formatDateWeb(out.waktu_padam_mulai)}</td>
                                            <td class="py-2 text-inalum-red font-medium">${formatTimeWeb(out.waktu_padam_selesai)}, ${formatDateWeb(out.waktu_padam_selesai)}</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <div class="col-span-1 md:col-span-2 grid grid-cols-2 md:grid-cols-4 gap-3 mt-2 border-b border-border pb-4">
                            <div><span class="block text-[9px] md:text-[10px] uppercase tracking-[0.15em] text-muted mb-1">Titik Pentahanan</span>${out.titik_pentahanan || '-'}</div>
                            <div><span class="block text-[9px] md:text-[10px] uppercase tracking-[0.15em] text-muted mb-1">Komunikasi</span>${out.komunikasi || '-'}</div>
                            <div class="md:col-span-2"><span class="block text-[9px] md:text-[10px] uppercase tracking-[0.15em] text-muted mb-1">Keterangan Tambahan</span>${out.keterangan || '-'}</div>
                        </div>
                    </div>

                    <div class="mb-6">
                        <span class="block text-[9px] md:text-[10px] uppercase tracking-[0.15em] text-muted mb-2">Rincian Pekerjaan</span>
                        <ul class="list-none text-xs md:text-sm space-y-2">
                            ${out.tasks.map(t => `<li class="bg-background p-3 rounded-lg border border-border flex items-center gap-3"><span class="h-1.5 w-1.5 rounded-full bg-inalum-blue shrink-0"></span>${t}</li>`).join('')}
                        </ul>
                    </div>

                    <div>
                        <span class="block text-[9px] md:text-[10px] uppercase tracking-[0.15em] text-muted mb-2">Lampiran SLD (PDF Render)</span>
                        ${out.sld_data ? `<div class="border border-border rounded-xl p-1 bg-background-soft"><img src="${out.sld_data}" alt="SLD Annotated" class="w-full h-auto rounded-lg"></div>` : '<p class="text-xs italic text-muted bg-background p-4 rounded-xl border border-border text-center">Tidak ada lampiran SLD.</p>'}
                    </div>
                </div>
            `;
        });

        const btnPrint = document.getElementById('btnPrintPDF');
        if (data.request.status === 'Disetujui' || data.request.status === 'Approved') {
            btnPrint.classList.remove('hidden');
        } else {
            btnPrint.classList.add('hidden');
        }

        document.getElementById('modalContent').innerHTML = contentHTML;
        document.body.style.overflow = 'hidden'; 
        document.getElementById('detailModal').classList.remove('hidden');

        // --- GENERATE TEMPLATE CETAK RESMI ---
        const formatPrintDate = (dStr) => {
            if(!dStr) return '-';
            const d = new Date(dStr);
            const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
            return `${months[d.getMonth()]} ${String(d.getDate()).padStart(2,'0')}, ${d.getFullYear()}`;
        };
        const formatPrintTime = (dStr) => {
            if(!dStr) return '-';
            const d = new Date(dStr);
            return `${String(d.getHours()).padStart(2,'0')} : ${String(d.getMinutes()).padStart(2,'0')}`;
        };
        const formatPrintDateRange = (mulaiStr, selesaiStr) => {
            if(!mulaiStr || !selesaiStr) return '-';
            const m = new Date(mulaiStr); const s = new Date(selesaiStr);
            const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
            if(m.getMonth() === s.getMonth() && m.getFullYear() === s.getFullYear()) {
                return `${months[m.getMonth()]} ${String(m.getDate()).padStart(2,'0')} ~ ${String(s.getDate()).padStart(2,'0')}, ${m.getFullYear()}`;
            }
            return `${formatPrintDate(m)} ~ ${formatPrintDate(s)}`;
        };

        const namaPemeriksaPDF = data.request.pemeriksa_oleh || '-';
        const namaPenyetujuPDF = data.request.disetujui_oleh || '-';

        let printHTML = `
            <div style="font-family: Arial, sans-serif; color: black; font-size: 10px; width: 100%;">
                
                <!-- HEADER KOP -->
                <table style="width: 100%; border-collapse: collapse; margin-bottom: 5px;">
                    <tr>
                        <td style="width: 33%; vertical-align: top; text-align: left;">
                            To &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;: ${data.request.surat_to || '-'}<br>
                            FROM : POP
                        </td>
                        <td style="width: 34%; text-align: center; vertical-align: top;">
                            <img src="/logo-inalum-login.png" style="height: 35px; object-fit: contain;">
                        </td>
                        <td style="width: 33%; text-align: right; vertical-align: top;">
                            <table style="border-collapse: collapse; border: 1px solid black; float: right; text-align: center; margin-bottom: 5px;">
                                <tr><td style="border: 1px solid black; padding: 2px 5px; font-size: 8px;">No. Dokumen / Revisi</td></tr>
                                <tr><td style="border: 1px solid black; padding: 2px 5px; font-weight: bold;">POP-FR18-001 / 0</td></tr>
                            </table>
                            <div style="clear: both;"></div>
                            No. : OW/TE/${data.request.id}/${new Date().getFullYear()}<br>
                            DATE OF ISSUED : ${formatPrintDate(new Date())}
                        </td>
                    </tr>
                </table>

                <div style="text-align: center; margin-bottom: 15px;">
                    <div style="font-size: 16px; font-weight: bold; margin-bottom: 3px;">PT INDONESIA ASAHAN ALUMINIUM</div>
                    <div style="font-size: 14px; font-weight: bold; text-decoration: underline;">APPROVAL OF OUTAGE WORK</div>
                </div>

                <!-- TABLE 1: SUMMARY OF OUTAGE -->
                <table class="print-table" style="width: 100%; border-collapse: collapse; font-size: 9px; text-align: center; margin-bottom: 15px;">
                    <thead style="background-color: #f0f0f0;">
                        <tr>
                            <th rowspan="2">OUTAGE<br>NO</th>
                            <th rowspan="2">REQUEST<br>DATE</th>
                            <th colspan="2">REQUESTER</th>
                            <th rowspan="2">WORKING<br>DATE</th>
                            <th rowspan="2">Kind Of Outage</th>
                            <th rowspan="2">OUTAGE AREA</th>
                            <th rowspan="2">OUTAGE TIME</th>
                            <th rowspan="2">WORKING TIME</th>
                            <th rowspan="2">WORKING CHIEF</th>
                        </tr>
                        <tr>
                            <th>SECT.</th>
                            <th>P. Incharge</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        data.outages.forEach((out, index) => {
            printHTML += `
                        <tr>
                            <td>${index + 1}</td>
                            <td>${formatPrintDate(data.request.tanggal_pengajuan)}</td>
                            <td>${data.request.departemen}</td>
                            <td>${data.request.dipersiapkan_oleh}</td>
                            <td>${formatPrintDateRange(out.waktu_kerja_mulai, out.waktu_kerja_selesai)}</td>
                            <td>${out.jenis_pemadaman}</td>
                            <td>From : ${out.area_dari}<br>To &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;: ${out.area_ke}</td>
                            <td>From : ${formatPrintTime(out.waktu_padam_mulai)}<br>To &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;: ${formatPrintTime(out.waktu_padam_selesai)}</td>
                            <td>From : ${formatPrintTime(out.waktu_kerja_mulai)}<br>To &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;: ${formatPrintTime(out.waktu_kerja_selesai)}</td>
                            <td>${out.kepala_pelaksana || '-'}</td>
                        </tr>
            `;
        });

        printHTML += `
                    </tbody>
                </table>

                <!-- TABLE 2: CONTENTS OF WORK & DETAILS -->
                <table class="print-table" style="width: 100%; border-collapse: collapse; font-size: 9px; text-align: center; margin-bottom: 10px;">
                    <thead style="background-color: #f0f0f0;">
                        <tr>
                            <th>OUTAGE<br>NO</th>
                            <th style="width: 50%;">CONTENTS OF WORK</th>
                            <th>EARTH PLACE</th>
                            <th>COMMUNICATION TO MCR</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        data.outages.forEach((out, index) => {
            printHTML += `
                        <tr>
                            <td>${index + 1}</td>
                            <td style="text-align: left;">
                                <ul style="margin: 0; padding-left: 15px;">
                                    ${out.tasks.map(t => `<li>${t}</li>`).join('')}
                                </ul>
                            </td>
                            <td>${out.titik_pentahanan || '-'}</td>
                            <td>${out.komunikasi || '-'}</td>
                        </tr>
            `;
        });

        // REMARKS & SIGNATURE BLOCK
        printHTML += `
                    </tbody>
                </table>
                
                <div style="font-size: 10px; font-weight: bold; margin-bottom: 5px;">Remark :</div>
                <div style="font-size: 10px; margin-bottom: 15px; min-height: 20px;">
                    ${data.request.remark ? data.request.remark.replace(/\n/g, '<br>') : '-'}
                </div>

                <!-- SIGNATURE TABLE (POP) -->
                <table class="print-table" style="width: 100%; border-collapse: collapse; font-size: 10px; text-align: center; page-break-inside: avoid;">
                    <tr style="background-color: #f0f0f0;">
                        <td rowspan="5" style="width: 4%;" class="vertical-text"><b>POP</b></td>
                        <td style="width: 24%;"></td>
                        <td style="width: 24%; font-weight: bold;">PREPARED</td>
                        <td style="width: 24%; font-weight: bold;">CHECKED</td>
                        <td style="width: 24%; font-weight: bold;">APPROVED</td>
                    </tr>
                    <tr>
                        <td style="text-align: left; background-color: #f0f0f0; font-weight: bold;">NAME</td>
                        <td>MUHAMMAD ALBANI</td>
                        <td>${namaPemeriksaPDF}</td>
                        <td>${namaPenyetujuPDF}</td>
                    </tr>
                    <tr>
                        <td style="text-align: left; background-color: #f0f0f0; font-weight: bold;">POSITION</td>
                        <td>Spesialis</td>
                        <td>Ka. Seksi</td>
                        <td>Ka. Dept.</td>
                    </tr>
                    <tr>
                        <td style="text-align: left; background-color: #f0f0f0; font-weight: bold;">DATE</td>
                        <td>${formatPrintDate(data.request.tanggal_pengajuan)}</td>
                        <td>${data.request.pemeriksa_date ? formatPrintDate(data.request.pemeriksa_date) : '-'}</td>
                        <td>${data.request.disetujui_date ? formatPrintDate(data.request.disetujui_date) : '-'}</td>
                    </tr>
                    <tr>
                        <td style="text-align: left; background-color: #f0f0f0; font-weight: bold;">TIME</td>
                        <td>${formatPrintTime(data.request.tanggal_pengajuan)}</td>
                        <td>${data.request.pemeriksa_date ? formatPrintTime(data.request.pemeriksa_date) : '-'}</td>
                        <td>${data.request.disetujui_date ? formatPrintTime(data.request.disetujui_date) : '-'}</td>
                    </tr>
                </table>
                <div style="clear: both;"></div>
            </div>
        `;

        // GABUNGKAN GAMBAR SLD
        let sldAttachmentsHTML = '';
        data.outages.forEach((out, index) => {
            if (out.sld_data) {
                sldAttachmentsHTML += `
                    <div style="page-break-before: always; padding-top: 20px;">
                        <h2 style="font-size: 14px; font-family: Arial, sans-serif; font-weight: bold; margin-bottom: 15px; border-bottom: 2px solid black; padding-bottom: 5px; text-transform: uppercase;">
                            LAMPIRAN SLD - PEMADAMAN ${index + 1}
                        </h2>
                        <div style="text-align: center;">
                            <img src="${out.sld_data}" style="max-width: 100%; max-height: 24cm; border: 1px solid #ccc;">
                        </div>
                    </div>
                `;
            }
        });
        printHTML += sldAttachmentsHTML;

        document.getElementById('printTemplateContainer').innerHTML = printHTML;

    } catch(e) {
        alert('Gagal memuat detail permohonan dari database.');
    }
}

function closeDetailModal() {
    document.body.style.overflow = '';
    document.getElementById('detailModal').classList.add('hidden');
}