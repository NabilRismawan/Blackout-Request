// --- public/js/form.js ---

async function submitForm(e) {
    e.preventDefault();
    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerText;
    submitBtn.innerText = "Menyimpan...";
    submitBtn.disabled = true;

    const payload = {
        departemen_pemohon: document.getElementById('form-dept').value,
        dipersiapkan_oleh: document.getElementById('form-preby').value,
        remark: document.getElementById('form-remark').value,
        outages: []
    };

    document.querySelectorAll('.outage-block').forEach(block => {
        const tasks = [];
        block.querySelectorAll('.task-input').forEach(ti => { if(ti.value) tasks.push(ti.value); });
        payload.outages.push({
            jenis_pemadaman: block.querySelector('[name="jenis_pemadaman"]').value,
            area_dari: block.querySelector('[name="area_dari"]').value,
            area_ke: block.querySelector('[name="area_ke"]').value,
            waktu_kerja_mulai: block.querySelector('[name="waktu_kerja_mulai"]').value,
            waktu_kerja_selesai: block.querySelector('[name="waktu_kerja_selesai"]').value,
            waktu_padam_mulai: block.querySelector('[name="waktu_padam_mulai"]').value,
            waktu_padam_selesai: block.querySelector('[name="waktu_padam_selesai"]').value,
            titik_pentahanan: block.querySelector('[name="titik_pentahanan"]').value,
            komunikasi: block.querySelector('[name="komunikasi"]').value,
            kepala_pelaksana: block.querySelector('[name="kepala_pelaksana"]').value,
            keterangan: block.querySelector('[name="keterangan"]').value,
            sld_data: block.querySelector('.sld-hidden-data').value,
            tasks: tasks
        });
    });

    try {
        const res = await fetch('/api/requests', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const resData = await res.json();
        if(res.ok) {
            showNotification(resData.message, 'bg-background-soft text-inalum-blue border-border');
            document.getElementById('mainForm').reset();
            document.querySelectorAll('.outage-block').forEach((block, index) => {
                if (index > 0) block.remove();
                else {
                    block.querySelector('.sld-hidden-data').value = '';
                    block.querySelector('.sld-canvas').classList.add('hidden');
                    block.querySelector('.canvas-placeholder').classList.remove('hidden');
                    block.querySelector('.canvas-controls').classList.add('hidden');
                }
            });
            window.outageCount = 1;
            showView('overview');
        } else {
            showNotification(resData.error, 'bg-red-50 text-inalum-red border-red-200');
        }
    } catch (err) { 
        showNotification('Gagal terhubung ke database. Pastikan koneksi stabil.', 'bg-red-50 text-inalum-red border-red-200'); 
    } finally {
        submitBtn.innerText = originalText;
        submitBtn.disabled = false;
    }
}

document.getElementById('outageRequestContainer').addEventListener('click', function(e) {
    if (e.target && e.target.classList.contains('add-task-btn')) {
        const container = e.target.closest('.task-list-container');
        const newRow = document.createElement('div');
        newRow.className = 'flex items-center gap-2 mt-2 animate-[fade-up_0.2s_ease-out]';
        newRow.innerHTML = `<input type="text" class="task-input flex-1 border border-border p-3 md:p-2.5 rounded-xl md:rounded-lg bg-white text-sm focus:outline-none focus:border-inalum-blue transition-colors" placeholder="Rincian pekerjaan tambahan..."><button type="button" class="remove-task-btn shrink-0 border border-border text-foreground w-10 h-10 md:w-9 md:h-9 rounded-full font-medium text-lg hover:bg-inalum-red hover:text-white hover:border-inalum-red transition-colors shadow-sm">&times;</button>`;
        container.appendChild(newRow);
    }
    if (e.target && e.target.classList.contains('remove-task-btn')) e.target.parentElement.remove();
    if (e.target && e.target.classList.contains('remove-outage-btn')) { 
        e.target.closest('.outage-block').remove(); 
        recalculateOutageLabels(); 
    }
});

document.getElementById('addOutageBtn').addEventListener('click', function() {
    window.outageCount++;
    const container = document.getElementById('outageRequestContainer');
    const newBlock = document.querySelector('.outage-block').cloneNode(true);

    newBlock.setAttribute('data-outage', window.outageCount);
    newBlock.querySelector('.remove-outage-btn').classList.remove('hidden');
    newBlock.querySelectorAll('input[type="text"], input[type="datetime-local"]').forEach(input => input.value = '');
    newBlock.querySelector('.sld-upload').value = '';
    newBlock.querySelector('.sld-hidden-data').value = '';
    newBlock.querySelector('.sld-canvas').classList.add('hidden');
    newBlock.querySelector('.canvas-placeholder').classList.remove('hidden');
    newBlock.querySelector('.canvas-controls').classList.add('hidden');
    newBlock.querySelector('.canvas-placeholder').innerHTML = 'Preview PDF akan muncul di sini...<br><span class="text-[9px] mt-1 block opacity-70">Gunakan file PDF 1 halaman</span>';
    newBlock.querySelector('.canvas-wrapper').className = 'canvas-wrapper relative border border-border rounded-xl bg-white min-h-[150px] flex items-center justify-center overflow-auto cursor-crosshair';

    const newCanvas = newBlock.querySelector('.sld-canvas');
    newCanvas.getContext('2d').clearRect(0, 0, newCanvas.width, newCanvas.height);
    newBlock.querySelector('.task-list-container').innerHTML = `<div class="flex items-center gap-2"><input type="text" class="task-input flex-1 border border-border p-3 md:p-2.5 rounded-xl md:rounded-lg bg-white text-sm focus:outline-none focus:border-inalum-blue transition-colors" placeholder="Rincian pekerjaan..."><button type="button" class="add-task-btn shrink-0 bg-inalum-blue text-white w-10 h-10 md:w-9 md:h-9 rounded-full font-medium text-lg hover:bg-inalum-bluehover transition-colors shadow-sm">+</button></div>`;

    newBlock.classList.add('animate-[fade-up_0.3s_ease-out]');
    container.appendChild(newBlock);
    recalculateOutageLabels();
    initCanvasForOutage(newBlock);
    setTimeout(() => newBlock.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100);
});

function recalculateOutageLabels() {
    document.querySelectorAll('.outage-block').forEach((block, index) => {
        const num = index + 1;
        block.setAttribute('data-outage', num);
        block.querySelector('.outage-label').innerText = `Pemadaman ke-${num}`;
        if (num === 1) block.querySelector('.remove-outage-btn').classList.add('hidden');
        else block.querySelector('.remove-outage-btn').classList.remove('hidden');
    });
    window.outageCount = document.querySelectorAll('.outage-block').length;
}

// Logika Annotasi PDF/Canvas SLD
function initCanvasForOutage(outageBlockElement) {
    const upload = outageBlockElement.querySelector('.sld-upload');
    const canvas = outageBlockElement.querySelector('.sld-canvas');
    const ctx = canvas.getContext('2d');
    const placeholder = outageBlockElement.querySelector('.canvas-placeholder');
    const controls = outageBlockElement.querySelector('.canvas-controls');
    const toolBtns = outageBlockElement.querySelectorAll('.tool-btn');
    const undoBtn = outageBlockElement.querySelector('.undo-highlight-btn');
    const clearBtn = outageBlockElement.querySelector('.clear-highlight-btn');
    const hiddenData = outageBlockElement.querySelector('.sld-hidden-data');
    const wrapper = outageBlockElement.querySelector('.canvas-wrapper');

    let offscreenCanvas = document.createElement('canvas');
    let offscreenCtx = offscreenCanvas.getContext('2d');

    let activeTool = 'highlight'; 
    let isDrawing = false; let startX, startY; let currentRect = null; let currentPath = []; let savedAnnotations = [];

    toolBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            toolBtns.forEach(b => {
                b.classList.remove('bg-inalum-blue', 'text-white', 'border-inalum-blue');
                b.classList.add('bg-white', 'text-foreground', 'border-border');
            });
            btn.classList.remove('bg-white', 'text-foreground', 'border-border');
            btn.classList.add('bg-inalum-blue', 'text-white', 'border-inalum-blue');
            activeTool = btn.getAttribute('data-tool');
            canvas.style.cursor = activeTool === 'text' ? 'text' : 'crosshair';
        });
    });

    function redrawCanvas() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        if (offscreenCanvas.width > 0) ctx.drawImage(offscreenCanvas, 0, 0);

        const drawShape = (anno) => {
            if (anno.type === 'highlight') {
                ctx.fillStyle = 'rgba(250, 204, 21, 0.4)'; ctx.strokeStyle = '#eab308'; ctx.lineWidth = 2;
                ctx.fillRect(anno.x, anno.y, anno.w, anno.h); ctx.strokeRect(anno.x, anno.y, anno.w, anno.h);
            } else if (anno.type === 'draw') {
                if (!anno.points || anno.points.length === 0) return;
                ctx.strokeStyle = '#E31B23'; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
                ctx.beginPath(); ctx.moveTo(anno.points[0].x, anno.points[0].y);
                for (let i = 1; i < anno.points.length; i++) ctx.lineTo(anno.points[i].x, anno.points[i].y);
                ctx.stroke();
            } else if (anno.type === 'text') {
                ctx.font = 'bold 16px sans-serif'; ctx.fillStyle = '#E31B23'; ctx.textBaseline = 'top';
                ctx.fillText(anno.text, anno.x, anno.y);
            }
        };

        savedAnnotations.forEach(drawShape);
        if (activeTool === 'highlight' && currentRect) drawShape({ type: 'highlight', ...currentRect });
        if (activeTool === 'draw' && currentPath.length > 0) drawShape({ type: 'draw', points: currentPath });
    }

    function saveCanvasState() { if (offscreenCanvas.width > 0) hiddenData.value = canvas.toDataURL("image/png"); }

    upload.addEventListener('change', async function(e) {
        const file = e.target.files[0];
        if (!file) return;
        if (file.type !== 'application/pdf') { alert('Mohon unggah file dengan format .pdf'); upload.value = ''; return; }

        placeholder.textContent = 'Memuat PDF...';
        const fileReader = new FileReader();
        fileReader.onload = async function() {
            const typedarray = new Uint8Array(this.result);
            try {
                const pdf = await pdfjsLib.getDocument(typedarray).promise;
                const page = await pdf.getPage(1); 
                const maxWidth = wrapper.clientWidth - 32; 
                const unscaledViewport = page.getViewport({ scale: 1.0 });
                const scale = maxWidth / unscaledViewport.width;
                const finalScale = scale < 1.5 ? scale : 1.5; 
                const viewport = page.getViewport({ scale: finalScale });
                
                canvas.width = viewport.width; canvas.height = viewport.height;
                offscreenCanvas.width = viewport.width; offscreenCanvas.height = viewport.height;
                await page.render({ canvasContext: offscreenCtx, viewport: viewport }).promise;

                placeholder.classList.add('hidden'); canvas.classList.remove('hidden');
                controls.classList.remove('hidden'); wrapper.classList.remove('items-center', 'justify-center');
                savedAnnotations = []; currentRect = null; currentPath = [];
                redrawCanvas(); saveCanvasState();
            } catch (err) {
                alert('Gagal memproses file PDF tersebut.');
                placeholder.innerHTML = 'Preview PDF akan muncul di sini...<br><span class="text-[9px] mt-1 block opacity-70">Gunakan file PDF 1 halaman</span>';
            }
        };
        fileReader.readAsArrayBuffer(file);
    });

    function getPointerPos(e) {
        const rect = canvas.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        return { x: clientX - rect.left, y: clientY - rect.top };
    }

    canvas.addEventListener('mousedown', (e) => {
        if (!offscreenCanvas.width) return;
        const pos = getPointerPos(e);
        if (activeTool === 'text') {
            const text = prompt('Ketik teks yang ingin ditambahkan:');
            if (text && text.trim() !== '') {
                savedAnnotations.push({ type: 'text', text: text, x: pos.x, y: pos.y });
                redrawCanvas(); saveCanvasState();
            }
            return;
        }
        isDrawing = true; startX = pos.x; startY = pos.y;
        if (activeTool === 'draw') currentPath = [{ x: startX, y: startY }];
    });

    canvas.addEventListener('mousemove', (e) => {
        if (!isDrawing) return;
        const pos = getPointerPos(e);
        if (activeTool === 'highlight') currentRect = { x: Math.min(startX, pos.x), y: Math.min(startY, pos.y), w: Math.abs(pos.x - startX), h: Math.abs(pos.y - startY) };
        else if (activeTool === 'draw') currentPath.push({ x: pos.x, y: pos.y });
        redrawCanvas();
    });

    const finalizeInteraction = () => {
        if (!isDrawing) return; isDrawing = false;
        if (activeTool === 'highlight' && currentRect && currentRect.w > 4 && currentRect.h > 4) savedAnnotations.push({ type: 'highlight', ...currentRect });
        else if (activeTool === 'draw' && currentPath.length > 1) savedAnnotations.push({ type: 'draw', points: currentPath });
        currentRect = null; currentPath = [];
        redrawCanvas(); saveCanvasState();
    };

    canvas.addEventListener('mouseup', finalizeInteraction); canvas.addEventListener('mouseleave', finalizeInteraction);
    canvas.addEventListener('touchstart', (e) => { if(e.touches.length > 1) return; e.preventDefault(); canvas.dispatchEvent(new MouseEvent('mousedown', { clientX: e.touches[0].clientX, clientY: e.touches[0].clientY })); }, {passive: false});
    canvas.addEventListener('touchmove', (e) => { if(e.touches.length > 1) return; e.preventDefault(); canvas.dispatchEvent(new MouseEvent('mousemove', { clientX: e.touches[0].clientX, clientY: e.touches[0].clientY })); }, {passive: false});
    canvas.addEventListener('touchend', (e) => { e.preventDefault(); canvas.dispatchEvent(new MouseEvent('mouseup')); }, {passive: false});

    undoBtn.addEventListener('click', () => { if (savedAnnotations.length > 0) { savedAnnotations.pop(); redrawCanvas(); saveCanvasState(); } });
    clearBtn.addEventListener('click', () => { savedAnnotations = []; currentRect = null; currentPath = []; redrawCanvas(); saveCanvasState(); });
}