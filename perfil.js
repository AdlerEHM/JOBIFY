import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, doc, getDoc, updateDoc, addDoc, collection, getDocs, query, where, orderBy, limit } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

const firebaseConfig = {
    apiKey: "AIzaSyAReLeJ4fIMhjmTQMy6fgOpkEn9ebspjTU",
    authDomain: "jobify-392f2.firebaseapp.com",
    projectId: "jobify-392f2",
    storageBucket: "jobify-392f2.firebasestorage.app",
    messagingSenderId: "508357161570",
    appId: "1:508357161570:web:3137bb4e917e2e0552173b"
};

const app     = initializeApp(firebaseConfig);
const auth    = getAuth(app);
const db      = getFirestore(app);
const storage = getStorage(app);

const TAGS = [
    "Python", "Java", "SQL", "C#", "C++", "JavaScript", "PHP",
    "Swift", "Kotlin", "Dart", "Go", "Ruby", "HTML", "CSS",
    "TypeScript", "Scala", "R", "MATLAB", "Julia"
];

let selectedTags  = [];
let rolUsuario    = "";
let usuarioActual = null;
let portafolioItems = []; // { id, titulo, descripcion, links[], imagenUrl, imagenFile }

// ─── INICIO ───────────────────────────────────────────────────────────────
onAuthStateChanged(auth, async (user) => {
    if (!user) { window.location.href = "index.html"; return; }
    usuarioActual = user;

    const docSnap  = await getDoc(doc(db, "usuarios", user.uid));
    if (!docSnap.exists()) { window.location.href = "index.html"; return; }

    const userData = docSnap.data();
    rolUsuario     = userData.rol;

    // Título según rol
    document.getElementById('perfilTitulo').innerText =
        userData.perfilCompleto ? "Editar Perfil" : "Configura tu Perfil";

    // Cargar datos existentes
    if (userData.nombre) document.getElementById('displayName').value = userData.nombre;

    // Foto de perfil actual
    if (userData.foto) {
        const preview     = document.getElementById('fotoPreview');
        const placeholder = document.getElementById('fotoPlaceholder');
        preview.src               = userData.foto;
        preview.style.display     = 'block';
        placeholder.style.display = 'none';
    }

    // Mostrar campos según rol
    if (rolUsuario === "Empresa") {
        document.getElementById('companyFields').style.display = "block";
        document.getElementById('portafolioSection').style.display = 'block';
        document.getElementById('seccionEmpresa').style.display = 'block';

        // Cargar datos de empresa
        if (userData.descripcion)  document.getElementById('companyBio').value       = userData.descripcion;
        if (userData.industria)    document.getElementById('companyIndustria').value  = userData.industria;
        if (userData.tamano)       document.getElementById('companyTamano').value     = userData.tamano;
        if (userData.ubicacion)    document.getElementById('companyUbicacion').value  = userData.ubicacion;
        if (userData.sitioWeb)     document.getElementById('companyWeb').value        = userData.sitioWeb;

        // Cargar proyectos publicados por la empresa
        await cargarProyectosEmpresa(user.uid);
    } else {
        document.getElementById('devFields').style.display = "block";
        selectedTags = userData.habilidades || [];
        if (userData.pagoSugerido) document.getElementById('payRange').value = userData.pagoSugerido;
        renderTags();
        // Mostrar sección portafolio
        document.getElementById('portafolioSection').style.display = 'block';
        document.getElementById('seccionPortafolio').style.display = 'block';
        // Cargar portafolio existente
        portafolioItems = userData.portafolio || [];
        if (portafolioItems.length > 0) {
            document.getElementById('portafolioEmpty').style.display = 'none';
        }
        portafolioItems.forEach((item, i) => renderPortafolioItem(item, i));
    }

    // Cargar proyectos de Jobify completados en el portafolio del programador
    if (rolUsuario === 'Programador') {
        await cargarProyectosJobifyEnPortafolio(user.uid);
    }

    // MÓDULO 6 — llamar todas las funciones
    await cargarReputacion(user.uid);
    await verificarSanciones(user.uid, userData);
    await verificarAlertasEntrega(user.uid, userData.rol);

    // Panel de faltas: solo visible para el Programador
    // Muestra cuántas faltas lleva y si está suspendido
    if (userData.rol === 'Programador') {
        await cargarPanelFaltas(user.uid);
    }
});


// ─── PROYECTOS DE EMPRESA ─────────────────────────────────────────────────
async function cargarProyectosEmpresa(uid) {
    const snap = await getDocs(query(
        collection(db, 'proyectos'),
        where('empresaId', '==', uid)
    ));

    const lista = document.getElementById('listaProyectosEmpresa');
    const empty = document.getElementById('empresaProyectosEmpty');

    if (snap.empty) {
        empty.style.display = 'block';
        return;
    }

    empty.style.display = 'none';

    snap.docs.forEach(d => {
        const p     = d.data();
        const fecha = p.fechaPublicacion
            ? new Date(p.fechaPublicacion).toLocaleDateString('es-MX', { day:'2-digit', month:'short', year:'numeric' })
            : '—';

        const card = document.createElement('div');
        card.className = 'portafolio-item';
        card.style.cursor = 'pointer';
        card.innerHTML = `
            <div class="portafolio-card-body">
                <div class="portafolio-item-header">
                    <span class="portafolio-item-numero">${p.estado || 'activo'}</span>
                    <span style="font-size:11px;color:#94A3B8;">${fecha}</span>
                </div>
                <div class="portafolio-field">
                    <strong style="font-size:15px;color:var(--text-main);">${p.titulo || 'Sin título'}</strong>
                </div>
                <div class="portafolio-field">
                    <span style="font-size:13px;color:var(--text-muted);">
                        $${p.presupuesto || 0} USD &nbsp;·&nbsp; ${p.nivel || '—'} &nbsp;·&nbsp; ${p.duracionSemanas || '?'} semanas
                    </span>
                </div>
                ${p.tags?.length ? `
                <div style="display:flex;flex-wrap:wrap;gap:5px;margin-top:4px;">
                    ${p.tags.slice(0,4).map(t => `<span style="padding:2px 8px;background:#EEF2FF;color:#4338CA;border-radius:4px;font-size:11px;font-weight:600;">${t}</span>`).join('')}
                </div>` : ''}
            </div>`;
        card.onclick = () => window.location.href = `proyecto.html?id=${d.id}`;
        lista.appendChild(card);
    });
}

// ─── RENDER TAGS ──────────────────────────────────────────────────────────
function renderTags() {
    const cloud = document.getElementById('skillsCloud');
    cloud.innerHTML = "";
    TAGS.forEach(tag => {
        const span       = document.createElement('span');
        span.innerText   = tag;
        span.className   = 'skill-tag' + (selectedTags.includes(tag) ? ' selected' : '');
        span.onclick = () => {
            if (selectedTags.includes(tag)) {
                selectedTags = selectedTags.filter(t => t !== tag);
                span.classList.remove('selected');
            } else {
                selectedTags.push(tag);
                span.classList.add('selected');
            }
        };
        cloud.appendChild(span);
    });
}

// ─── PREVIEW DE IMAGEN ────────────────────────────────────────────────────
document.getElementById('profileImage').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
        const preview     = document.getElementById('fotoPreview');
        const placeholder = document.getElementById('fotoPlaceholder');
        preview.src               = ev.target.result;
        preview.style.display     = 'block';
        placeholder.style.display = 'none';
    };
    reader.readAsDataURL(file);
});

// ─── CONTADOR DE PALABRAS ─────────────────────────────────────────────────
const bioEl = document.getElementById('companyBio');
if (bioEl) {
    bioEl.addEventListener('input', () => {
        const palabras = bioEl.value.trim() === '' ? 0 : bioEl.value.trim().split(/\s+/).length;
        const counter  = document.getElementById('bioCounter');
        if (counter) {
            counter.innerText = `${palabras} / 1000 palabras`;
            counter.style.color = palabras > 1000 ? '#DC2626' : '#aaa';
        }
    });
}

// ─── GUARDAR PERFIL ───────────────────────────────────────────────────────
document.getElementById('btnSaveProfile').onclick = async () => {
    const user   = usuarioActual;
    if (!user)   return;

    const nombre = document.getElementById('displayName').value.trim();
    const file   = document.getElementById('profileImage').files[0];
    const btn    = document.getElementById('btnSaveProfile');

    // Validaciones
    if (!nombre) return mostrarError("El nombre es obligatorio.");

    if (rolUsuario === "Empresa") {
        const bio     = document.getElementById('companyBio').value.trim();
        const palabras = bio === '' ? 0 : bio.trim().split(/\s+/).length;
        if (palabras > 1000) return mostrarError("La descripción no debe exceder las 1000 palabras.");
    } else {
        if (selectedTags.length === 0) return mostrarError("Selecciona al menos una habilidad.");
    }

    btn.innerText = "Guardando...";
    btn.disabled  = true;

    try {
        let imageUrl = "";

        // Subir imagen si se seleccionó una
        if (file) {
            const status  = document.getElementById('uploadStatus');
            status.innerText = "Subiendo imagen...";
            const storageRef = ref(storage, `perfiles/${user.uid}`);
            await uploadBytes(storageRef, file);
            imageUrl = await getDownloadURL(storageRef);
            status.innerText = "";
        }

        // Datos base
        const updateData = {
            nombre,
            perfilCompleto: true,
            reputacion:     (await getDoc(doc(db, "usuarios", user.uid))).data()?.reputacion   || 5,
            totalValores:   (await getDoc(doc(db, "usuarios", user.uid))).data()?.totalValores || 0
        };

        if (imageUrl) updateData.foto = imageUrl;

        // Datos según rol
        if (rolUsuario === "Empresa") {
            updateData.descripcion = document.getElementById('companyBio').value.trim();
            updateData.industria   = document.getElementById('companyIndustria').value;
            updateData.tamano      = document.getElementById('companyTamano').value;
            updateData.ubicacion   = document.getElementById('companyUbicacion').value.trim();
            updateData.sitioWeb    = document.getElementById('companyWeb').value.trim();
        } else {
            updateData.habilidades   = selectedTags;
            updateData.pagoSugerido  = document.getElementById('payRange').value || "0";
            // Subir imágenes del portafolio y guardar
            const portafolioGuardado = [];
            for (const item of portafolioItems) {
                let imgUrl = item.imagenUrl || "";
                if (item.imagenFile) {
                    const imgRef = ref(storage, `portafolio/${user.uid}/${Date.now()}_${item.imagenFile.name}`);
                    await uploadBytes(imgRef, item.imagenFile);
                    imgUrl = await getDownloadURL(imgRef);
                }
                portafolioGuardado.push({
                    id:          item.id,
                    titulo:      item.titulo || "",
                    descripcion: item.descripcion || "",
                    links:       item.links || [],
                    imagenUrl:   imgUrl
                });
            }
            updateData.portafolio = portafolioGuardado;
        }

        await updateDoc(doc(db, "usuarios", user.uid), updateData);

        alert("Perfil guardado con éxito.");
        window.location.href = "dashboard.html";

    } catch (error) {
        mostrarError("Error al guardar: " + error.message);
        btn.innerText = "Guardar Perfil";
        btn.disabled  = false;
    }
};


// ─── PORTAFOLIO ───────────────────────────────────────────────────────────
document.getElementById('btnAgregarProyecto').addEventListener('click', () => {
    const item = { id: Date.now(), titulo: '', descripcion: '', links: [], imagenUrl: '', imagenFile: null };
    portafolioItems.push(item);
    renderPortafolioItem(item, portafolioItems.length - 1);
});

function renderPortafolioItem(item, index) {
    const container = document.getElementById('portafolioItems');
    // Ocultar empty state
    const empty = document.getElementById('portafolioEmpty');
    if (empty) empty.style.display = 'none';

    const div = document.createElement('div');
    div.className = 'portafolio-item';
    div.id        = `portafolio-item-${item.id}`;

    div.innerHTML = `
        <!-- Imagen arriba -->
        <img id="prev-${item.id}" class="portafolio-img-preview"
            ${item.imagenUrl ? `src="${item.imagenUrl}" style="display:block;"` : ''}>
        <div class="portafolio-img-placeholder" id="placeholder-${item.id}"
            ${item.imagenUrl ? 'style="display:none;"' : ''}>
            <span>📷</span>
            Clic para subir imagen
        </div>
        <input type="file" id="file-${item.id}" accept="image/*" style="display:none;">

        <!-- Cuerpo -->
        <div class="portafolio-card-body">
            <div class="portafolio-item-header">
                <span class="portafolio-item-numero">Proyecto ${index + 1}</span>
                <button class="btn-eliminar-portafolio" data-id="${item.id}" title="Eliminar">✕</button>
            </div>

            <div class="portafolio-field">
                <label>Nombre del proyecto</label>
                <input type="text" id="titulo-${item.id}"
                    placeholder="Ej: Tienda online con carrito de compras"
                    value="${item.titulo || ''}">
            </div>

            <div class="portafolio-field">
                <label>Descripción</label>
                <textarea id="desc-${item.id}"
                    placeholder="¿Qué hiciste? ¿Qué tecnologías usaste?">${item.descripcion || ''}</textarea>
            </div>

            <div class="portafolio-field">
                <label>Enlaces</label>
                <div class="link-chips" id="chips-${item.id}"></div>
                <div class="link-input-row">
                    <input type="url" id="link-input-${item.id}"
                        placeholder="https://github.com/usuario/proyecto">
                    <button class="btn-agregar-link" data-id="${item.id}">+ Link</button>
                </div>
            </div>
        </div>`;

    container.appendChild(div);

    // Render links existentes
    renderLinks(item);

    // Click en placeholder → abrir input file
    div.querySelector(`#placeholder-${item.id}`).onclick = () => div.querySelector(`#file-${item.id}`).click();
    div.querySelector(`#prev-${item.id}`).onclick        = () => div.querySelector(`#file-${item.id}`).click();

    // Seleccionar imagen
    div.querySelector(`#file-${item.id}`).addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        portafolioItems[index].imagenFile = file;
        const reader = new FileReader();
        reader.onload = (ev) => {
            const prev = div.querySelector(`#prev-${item.id}`);
            prev.src          = ev.target.result;
            prev.style.display = 'block';
            div.querySelector(`#placeholder-${item.id}`).style.display = 'none';
        };
        reader.readAsDataURL(file);
    });

    // Título
    div.querySelector(`#titulo-${item.id}`).addEventListener('input', (e) => {
        portafolioItems[index].titulo = e.target.value;
    });

    // Descripción
    div.querySelector(`#desc-${item.id}`).addEventListener('input', (e) => {
        portafolioItems[index].descripcion = e.target.value;
    });

    // Agregar link
    div.querySelector(`.btn-agregar-link`).addEventListener('click', () => {
        const input = div.querySelector(`#link-input-${item.id}`);
        const url   = input.value.trim();
        if (!url) return;
        if (!url.startsWith('http')) return alert('El link debe comenzar con http:// o https://');
        portafolioItems[index].links = portafolioItems[index].links || [];
        portafolioItems[index].links.push(url);
        input.value = '';
        renderLinks(portafolioItems[index]);
    });

    // Eliminar item
    div.querySelector('.btn-eliminar-portafolio').addEventListener('click', () => {
        portafolioItems = portafolioItems.filter(p => p.id !== item.id);
        div.remove();
        // Renumerar
        document.querySelectorAll('.portafolio-item-numero').forEach((el, i) => {
            el.innerText = `Proyecto ${i + 1}`;
        });
        // Mostrar empty si no quedan items
        if (portafolioItems.length === 0) {
            const empty = document.getElementById('portafolioEmpty');
            if (empty) empty.style.display = 'block';
        }
    });
}

function renderLinks(item) {
    const chips = document.getElementById(`chips-${item.id}`);
    if (!chips) return;
    chips.innerHTML = '';
    (item.links || []).forEach((url, i) => {
        const chip = document.createElement('a');
        chip.href      = url;
        chip.target    = '_blank';
        chip.className = 'link-chip';
        const domain = (() => { try { return new URL(url).hostname.replace('www.',''); } catch { return url; } })();
        chip.innerHTML = `🔗 ${domain} <span class="link-chip-remove" data-index="${i}">✕</span>`;
        chip.querySelector('.link-chip-remove').addEventListener('click', (e) => {
            e.preventDefault();
            item.links.splice(i, 1);
            renderLinks(item);
        });
        chips.appendChild(chip);
    });
}


// ─── MOSTRAR ERROR ────────────────────────────────────────────────────────
function mostrarError(msg) {
    const el = document.getElementById('errorMsg');
    el.innerText = msg;
    el.style.display = 'block';
    setTimeout(() => el.style.display = 'none', 4000);
}

// ═══════════════════════════════════════════════════
// MÓDULO 6.1 — Valoración cruzada (estrellas + comentarios)
// MÓDULO 6.2 — Etiquetas de desempeño
// Llena la sección de valoraciones con datos de Firestore
// ═══════════════════════════════════════════════════
async function cargarReputacion(uid) {
    // Traer todas las valoraciones donde este usuario fue valuado
    // MÓDULO 6.1: traer valoraciones sin orderBy para evitar índice compuesto
    const snap = await getDocs(query(
        collection(db, 'valoraciones'),
        where('valuadoId', '==', uid)
    ));

    // Ordenar en el cliente por fecha descendente
    const vals = snap.docs.map(d => d.data())
        .sort((a, b) => new Date(b.fecha || 0) - new Date(a.fecha || 0));

    // Helper seguro — no falla si el panel está oculto al cargar
    const setEl   = (id, val) => { const el = document.getElementById(id); if (el) el.innerText = val; };
    const setHTML = (id, val) => { const el = document.getElementById(id); if (el) el.innerHTML = val; };

    // Actualizar contador total
    setEl('totalValoraciones',
        vals.length === 0
            ? 'Aún no tienes valoraciones'
            : `${vals.length} valoración${vals.length !== 1 ? 'es' : ''} recibida${vals.length !== 1 ? 's' : ''}`);

    if (vals.length === 0) {
        setHTML('listaPositivas', '<p class="rep-empty">Sin valoraciones aún. Completa proyectos para recibirlas.</p>');
        setEl('promedioNum', '-');
        setEl('promedioEstrellas', '☆☆☆☆☆');
        setEl('totalNum', '0 reseñas');
        return;
    }

    // Calcular promedio
    const promedio = (vals.reduce((s, v) => s + v.estrellas, 0) / vals.length).toFixed(1);
    setEl('promedioNum', promedio);
    setEl('promedioEstrellas', '★'.repeat(Math.round(promedio)) + '☆'.repeat(5 - Math.round(promedio)));
    setEl('totalNum', `${vals.length} reseña${vals.length !== 1 ? 's' : ''}`);

    // Barras de distribución por estrella
    const barras = document.getElementById('barrasDistribucion');
    barras.innerHTML = [5,4,3,2,1].map(n => {
        const cnt = vals.filter(v => v.estrellas === n).length;
        const pct = Math.round((cnt / vals.length) * 100);
        return `
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:5px;">
                <span style="font-size:12px;color:#6B7280;width:10px;">${n}</span>
                <span style="font-size:11px;">⭐</span>
                <div style="flex:1;background:#E5E7EB;border-radius:4px;height:7px;">
                    <div style="background:#4F46E5;height:7px;border-radius:4px;width:${pct}%;"></div>
                </div>
                <span style="font-size:11px;color:#9CA3AF;width:20px;">${cnt}</span>
            </div>`;
    }).join('');

    // Enriquecer valoraciones con título del proyecto si no lo tienen
    for (const v of vals) {
        if (!v.proyectoTitulo && v.proyectoId) {
            try {
                const proySnap = await getDoc(doc(db, 'proyectos', v.proyectoId));
                if (proySnap.exists()) v.proyectoTitulo = proySnap.data().titulo;
            } catch(e) { /* si falla, no importa */ }
        }
    }

    // Separar top 5 positivas y negativas
    const positivas = vals.filter(v => v.estrellas >= 4).slice(0, 5);
    const negativas  = vals.filter(v => v.estrellas <= 2).slice(0, 5);

    // Actualizar contadores en los tabs
    setEl('cntPos', positivas.length);
    setEl('cntNeg', negativas.length);

    // Render positivas
    setHTML('listaPositivas',
        positivas.length === 0
            ? '<p class="rep-empty">Sin reseñas positivas aún</p>'
            : positivas.map(v => renderReseña(v)).join(''));

    // Render negativas
    setHTML('listaNegativas',
        negativas.length === 0
            ? '<p class="rep-empty">Sin reseñas negativas aún</p>'
            : negativas.map(v => renderReseña(v)).join(''));
}

// Render de una reseña individual con etiquetas de desempeño
// MÓDULO 6.1/6.2: Render de una reseña con proyecto, estrellas y etiquetas
function renderReseña(v) {
    const fecha = v.fecha
        ? new Date(v.fecha).toLocaleDateString('es-MX', { day:'2-digit', month:'short', year:'numeric' })
        : '';

    const estrellasFill = '★'.repeat(v.estrellas);
    const estrellasVac  = '★'.repeat(5 - v.estrellas);

    // MÓDULO 6.2: etiquetas positivas en verde, negativas en rojo
    const etiquetasHTML = (v.etiquetas || []).slice(0, 4).map(e =>
        `<span class="${e.tipo === 'positiva' ? 'etiqueta-pos' : 'etiqueta-neg'}">${e.texto}</span>`
    ).join('');

    // Nombre del proyecto al que pertenece la valoración
    const proyectoNombre = v.proyectoTitulo || '';

    return `
        <div class="reseña-item">
            <div class="reseña-top">
                <span class="reseña-stars-fill">${estrellasFill}</span>
                <span class="reseña-stars-empty">${estrellasVac}</span>
                <span class="reseña-fecha">${fecha}</span>
            </div>
            ${proyectoNombre ? `
                <div style="font-size:12px;color:#4F46E5;font-weight:600;margin-bottom:6px;">
                    ${proyectoNombre}
                </div>` : ''}
            ${etiquetasHTML ? `<div class="reseña-etiquetas">${etiquetasHTML}</div>` : ''}
            ${v.comentario ? `<p class="reseña-comentario">"${v.comentario}"</p>` : ''}
        </div>`;
}

// Switch tabs positivas/negativas
window.switchTab = (tab) => {
    document.getElementById('listaPositivas').style.display = tab === 'positivas' ? 'block' : 'none';
    document.getElementById('listaNegativas').style.display = tab === 'negativas' ? 'block' : 'none';

    const btnPos = document.getElementById('btnTabPos');
    const btnNeg = document.getElementById('btnTabNeg');

    btnPos.classList.toggle('active-pos', tab === 'positivas');
    btnNeg.classList.toggle('active-neg', tab === 'negativas');
};

// ═══════════════════════════════════════════════════
// MÓDULO 6.3 — Contador de recuperación X/7
// MÓDULO 6.4 — Sanciones automáticas
// ═══════════════════════════════════════════════════
// MÓDULO 6.3 y 6.4: Sanciones automáticas y Contador de Recuperación X/7
// La sanción se activa cuando las últimas 3 valoraciones tienen promedio < 2
// El contador X/7 mide proyectos completados con buenas valoraciones DESDE la sanción
// El usuario se recupera al completar 7 proyectos con valoración >= 4 post-sanción
async function verificarSanciones(uid, userData) {

    // MÓDULO 6.4: Si ya está sancionado → calcular progreso de recuperación
    if (userData.sancionado) {
        const fechaSancion = userData.fechaInicioSancion || new Date().toISOString();

        // Contar proyectos completados con buena valoración DESPUÉS de la sanción
        const valsSnap = await getDocs(query(
            collection(db, 'valoraciones'),
            where('valuadoId', '==', uid)
        ));

        const proyectosRecuperacion = valsSnap.docs
            .map(d => d.data())
            .filter(v =>
                v.estrellas >= 4 &&
                v.fecha && v.fecha > fechaSancion // solo valoraciones post-sanción
            ).length;

        if (proyectosRecuperacion >= 7) {
            // MÓDULO 6.3: Recuperación completa — 7 proyectos buenos completados
            await updateDoc(doc(db, 'usuarios', uid), {
                sancionado:             false,
                proyectosRecuperacion:  0,
                fechaInicioSancion:     null
            });
            return; // Banner ya no se muestra
        }

        // Actualizar contador en Firestore
        await updateDoc(doc(db, 'usuarios', uid), {
            proyectosRecuperacion
        });

        // MÓDULO 6.3: Mostrar banner con contador X/7 de proyectos
        const bannerEl = document.getElementById('bannerSancion');
        const contEl   = document.getElementById('diasRecuperacion');
        const barraEl  = document.getElementById('barraRecuperacion');
        const notaEl   = document.getElementById('diasRestantes');

        if (bannerEl) bannerEl.style.display = 'block';
        if (contEl)   contEl.innerText = proyectosRecuperacion;
        if (barraEl)  barraEl.style.width = `${(proyectosRecuperacion / 7) * 100}%`;
        if (notaEl)   notaEl.innerText =
            `Completa ${7 - proyectosRecuperacion} proyecto${7 - proyectosRecuperacion !== 1 ? 's' : ''} más con buenas valoraciones para levantar la sanción.`;

        return;
    }

    // MÓDULO 6.4: Verificar si debe sancionarse — revisar últimas 3 valoraciones
    const snap = await getDocs(query(
        collection(db, 'valoraciones'),
        where('valuadoId', '==', uid)
    ));

    if (snap.size < 3) return;

    const ultimas3 = snap.docs.map(d => d.data())
        .sort((a, b) => new Date(b.fecha || 0) - new Date(a.fecha || 0))
        .slice(0, 3);
    const prom = ultimas3.reduce((s, v) => s + v.estrellas, 0) / 3;

    if (prom < 2) {
        // MÓDULO 6.4: Aplicar sanción automática — inhabilitar postulaciones
        await updateDoc(doc(db, 'usuarios', uid), {
            sancionado:            true,
            proyectosRecuperacion: 0,
            fechaInicioSancion:    new Date().toISOString()
        });

        const bannerEl = document.getElementById('bannerSancion');
        const contEl   = document.getElementById('diasRecuperacion');
        const barraEl  = document.getElementById('barraRecuperacion');
        const notaEl   = document.getElementById('diasRestantes');

        if (bannerEl) bannerEl.style.display = 'block';
        if (contEl)   contEl.innerText = '0';
        if (barraEl)  barraEl.style.width = '0%';
        if (notaEl)   notaEl.innerText = 'Completa 7 proyectos con buenas valoraciones para levantar la sanción.';
    }
}

// ═══════════════════════════════════════════════════
// MÓDULO 6.5 — Alertas de 10 días antes de entrega
// ═══════════════════════════════════════════════════
async function verificarAlertasEntrega(uid, rol) {
    const ahora      = new Date();
    const contenedor = document.getElementById('alertasEntrega');
    if (!contenedor) return;

    // Limpiar el contenedor antes de agregar items para evitar que se dupliquen
    // al volver a cargar la página (el usuario ya pudo haberlos cerrado antes)
    contenedor.innerHTML = '';

    const campoId = rol === 'Programador' ? 'programadorId' : 'empresaId';

    const postuSnap = await getDocs(query(
        collection(db, 'postulaciones'),
        where(campoId, '==', uid),
        where('estado', '==', 'aceptado')
    ));

    for (const postuDoc of postuSnap.docs) {
        const postu = postuDoc.data();
        if (postu.estadoProyecto === 'completado' || postu.estadoProyecto === 'baja') continue;

        const planSnap = await getDoc(doc(db, 'postulaciones', postuDoc.id, 'plan', 'datos'));
        if (!planSnap.exists()) continue;

        const hitos = planSnap.data().hitos || [];
        // Usar for...of en lugar de forEach para poder usar await dentro
        for (const hito of hitos) {
            const fechaHito = new Date(hito.fecha);
            const diffDias  = Math.ceil((fechaHito - ahora) / 86400000);
            if (diffDias < 0 || diffDias > 10) continue;

            // MÓDULO 6.5: Crear notificación interna en campana
            // Usar solo 2 where para evitar índice compuesto, filtrar en cliente
            const notifCheck = await getDocs(query(
                collection(db, 'notificaciones'),
                where('para', '==', uid),
                where('tipo', '==', 'alerta_hito')
            ));
            const hitoRef = `${postuDoc.id}_${hito.fecha}`;
            const yaExiste = notifCheck.docs.some(d => d.data().hitoRef === hitoRef);

            if (!yaExiste) {
                const textoAviso = diffDias === 0
                    ? `Hoy vence el hito "${hito.nombre}" del proyecto "${postu.proyectoTitulo || 'Proyecto'}".`
                    : `En ${diffDias} día${diffDias !== 1 ? 's' : ''} vence "${hito.nombre}" — ${postu.proyectoTitulo || 'Proyecto'}.`;
                await addDoc(collection(db, 'notificaciones'), {
                    para:    uid,
                    mensaje: textoAviso,
                    fecha:   new Date().toISOString(),
                    leido:   false,
                    tipo:    'alerta_hito',
                    hitoRef
                });
            }

            const urgente = diffDias <= 3;
            const item = document.createElement('div');
            item.className = `alerta-item${urgente ? ' urgente' : ''}`;
            const textoTiempo = diffDias === 0 ? 'Vence hoy'
                              : diffDias === 1 ? 'Vence mañana'
                              : `${diffDias} días restantes`;
            item.innerHTML = `
                <button class="alerta-cerrar" onclick="this.parentElement.remove()">✕</button>
                <span class="alerta-titulo">${textoTiempo}</span>
                <p class="alerta-hito">${hito.nombre}</p>
                <p class="alerta-proyecto">
                    ${postu.proyectoTitulo || 'Proyecto'} ·
                    ${fechaHito.toLocaleDateString('es-MX',{day:'2-digit',month:'short'})}
                </p>`;
            contenedor.appendChild(item);
        }
    }
}

// ═══════════════════════════════════════════════════════════
// PROYECTOS DE JOBIFY EN PORTAFOLIO DEL PROGRAMADOR
// Muestra automáticamente los proyectos completados en Jobify
// ═══════════════════════════════════════════════════════════
async function cargarProyectosJobifyEnPortafolio(uid) {
    const grid  = document.getElementById('portafolioItems');
    const empty = document.getElementById('portafolioEmpty');
    if (!grid) return;

    const snap = await getDocs(query(
        collection(db, 'postulaciones'),
        where('programadorId', '==', uid),
        where('estadoProyecto', '==', 'completado')
    ));

    if (snap.empty) return;

    if (empty) empty.style.display = 'none';

    const separador = document.createElement('div');
    separador.style.cssText = 'grid-column:1/-1;padding:16px 0 4px;';
    separador.innerHTML = `
        <p style="font-size:12px;font-weight:700;color:#9CA3AF;
                  text-transform:uppercase;letter-spacing:0.5px;margin:0;">
            Proyectos completados en Jobify
        </p>`;
    grid.appendChild(separador);

    for (const d of snap.docs) {
        const pos = d.data();
        const proySnap = await getDoc(doc(db, 'proyectos', pos.proyectoId));
        if (!proySnap.exists()) continue;
        const proy = proySnap.data();

        const tagsHTML = (proy.tags || []).slice(0, 4)
            .map(t => `<span style="padding:3px 8px;background:#EEF2FF;color:#4F46E5;
                border-radius:20px;font-size:11px;font-weight:600;">${t}</span>`).join('');

        const card = document.createElement('div');
        card.className = 'portafolio-item';
        card.innerHTML = `
            <div style="padding:6px 16px;background:linear-gradient(135deg,#EEF2FF,#E0E7FF);
                        border-bottom:1px solid #C7D2FE;">
                <span style="font-size:10px;font-weight:700;color:#4F46E5;
                             text-transform:uppercase;letter-spacing:0.5px;">Jobify</span>
            </div>
            <div class="portafolio-card-body">
                <div style="font-weight:700;font-size:15px;color:#111827;">
                    ${proy.titulo || pos.proyectoTitulo}
                </div>
                <div style="font-size:13px;color:#6B7280;line-height:1.5;">
                    ${proy.descripcion
                        ? proy.descripcion.slice(0, 100) + (proy.descripcion.length > 100 ? '...' : '')
                        : 'Proyecto completado en Jobify'}
                </div>
                ${tagsHTML ? `<div style="display:flex;flex-wrap:wrap;gap:4px;">${tagsHTML}</div>` : ''}
                <div style="display:flex;gap:12px;font-size:12px;color:#9CA3AF;">
                    <span>$${proy.presupuesto || '-'} USD</span>
                    <span>${proy.duracionSemanas || '-'} semanas</span>
                </div>
            </div>`;

        grid.appendChild(card);
    }
}

// ─── PANEL DE FALTAS (solo Programador) ──────────────────────────────────────
// Lee el campo 'faltas' y 'suspendido' del documento del usuario en Firestore
// y lo muestra en un panel visual dentro del perfil para que el programador
// sepa en todo momento cuántas faltas lleva y cuál es su estado.
async function cargarPanelFaltas(uid) {
    const panelFaltas = document.getElementById('panelFaltas');
    if (!panelFaltas) return;

    const snap = await getDoc(doc(db, 'usuarios', uid));
    if (!snap.exists()) return;
    const data = snap.data();

    const faltas     = data.faltas     || 0;
    const suspendido = data.suspendido || false;

    // Mostrar el panel
    panelFaltas.style.display = 'block';

    // Rellenar los valores
    document.getElementById('faltasNum').innerText     = faltas;
    document.getElementById('faltasMax').innerText     = '3';
    document.getElementById('faltasBarra').style.width = `${Math.min((faltas / 3) * 100, 100)}%`;
    document.getElementById('faltasBarra').style.background =
        faltas === 0 ? '#10B981' : faltas === 1 ? '#F59E0B' : '#EF4444';

    const estadoEl = document.getElementById('faltasEstado');
    if (suspendido) {
        estadoEl.innerText   = '🔴 Cuenta suspendida — No puedes postularte a nuevos proyectos.';
        estadoEl.style.color = '#DC2626';
    } else if (faltas === 0) {
        estadoEl.innerText   = '🟢 Sin faltas — Tu historial está limpio.';
        estadoEl.style.color = '#059669';
    } else {
        estadoEl.innerText   = `🟡 ${faltas} falta${faltas !== 1 ? 's' : ''} registrada${faltas !== 1 ? 's' : ''} — Al llegar a 3 tu cuenta será suspendida.`;
        estadoEl.style.color = '#D97706';
    }
}