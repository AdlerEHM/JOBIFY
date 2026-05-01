import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
    getFirestore, doc, getDoc, collection, getDocs,
    query, where, updateDoc, addDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyAReLeJ4fIMhjmTQMy6fgOpkEn9ebspjTU",
    authDomain: "jobify-392f2.firebaseapp.com",
    projectId: "jobify-392f2",
    storageBucket: "jobify-392f2.firebasestorage.app",
    messagingSenderId: "508357161570",
    appId: "1:508357161570:web:3137bb4e917e2e0552173b"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// ─── HELPERS ───
function emptyState(icon, title, msg) {
    return `
        <div class="empty-state">
            <span class="empty-icon">${icon}</span>
            <h3>${title}</h3>
            <p>${msg}</p>
        </div>`;
}

function formatFecha(isoStr) {
    if (!isoStr) return '-';
    return new Date(isoStr).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
}

function crearTabs(tabs) {
    const bar     = document.getElementById('tabsBar');
    const content = document.getElementById('tabsContent');
    bar.innerHTML     = '';
    content.innerHTML = '';

    tabs.forEach((tab, i) => {
        const btn = document.createElement('button');
        btn.className   = 'tab-btn' + (i === 0 ? ' active' : '');
        btn.innerText   = tab.label;
        btn.dataset.tab = tab.id;
        btn.onclick = () => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById(`panel-${tab.id}`).classList.add('active');
        };
        bar.appendChild(btn);

        const panel = document.createElement('div');
        panel.className = 'tab-panel' + (i === 0 ? ' active' : '');
        panel.id        = `panel-${tab.id}`;
        content.appendChild(panel);
    });
}

// ─── INICIO ───
onAuthStateChanged(auth, async (user) => {
    if (!user) { window.location.href = "index.html"; return; }

    const userSnap = await getDoc(doc(db, "usuarios", user.uid));
    const userData = userSnap.data();
    const rol = userData.rol;

    const badge = document.getElementById('roleBadge');
    badge.innerText = rol;
    badge.className = 'role-badge ' + (rol === 'Programador' ? 'prog' : 'emp');

    document.getElementById('loadingState').style.display = 'none';
    document.getElementById('mainContent').style.display  = 'block';

    if (rol === 'Programador') {
        document.getElementById('pageTitle').innerText    = 'Mis Proyectos';
        document.getElementById('pageSubtitle').innerText = 'Consulta tus postulaciones, proyectos activos e historial.';
        await cargarProgramador(user.uid);
    } else {
        document.getElementById('pageTitle').innerText    = 'Mis Proyectos';
        document.getElementById('pageSubtitle').innerText = 'Gestiona tus publicaciones, candidatos y proyectos activos.';
        await cargarEmpresa(user.uid);
    }
});

// ══════════════════════════════════════════
//  VISTA PROGRAMADOR
// ══════════════════════════════════════════
async function cargarProgramador(uid) {
    crearTabs([
        { id: 'postulaciones', label: '📨 Mis Postulaciones' },
        { id: 'encurso',       label: '🚀 En Curso'          },
        { id: 'historial',     label: '📁 Historial'         }
    ]);

    const snap = await getDocs(
        query(collection(db, "postulaciones"), where("programadorId", "==", uid))
    );

    const postulaciones = [];
    for (const d of snap.docs) {
        const p = { id: d.id, ...d.data() };
        const proySnap = await getDoc(doc(db, "proyectos", p.proyectoId));
        p.proyecto = proySnap.exists() ? proySnap.data() : null;
        postulaciones.push(p);
    }

    renderPostulacionesProg(postulaciones);
    renderEnCursoProg(postulaciones);
    renderHistorialProg(postulaciones, uid);
}

function renderPostulacionesProg(lista) {
    const panel = document.getElementById('panel-postulaciones');
    // Bug 4 fix: excluir postulaciones de proyectos completados/baja (van al historial)
    const items = lista.filter(p =>
        ['pendiente', 'aceptado', 'rechazado'].includes(p.estado) &&
        p.estadoProyecto !== 'completado' &&
        p.estadoProyecto !== 'baja'
    );

    if (items.length === 0) {
        panel.innerHTML = emptyState('📨', 'Sin postulaciones aún',
            'Explora proyectos en el dashboard y postúlate a los que te interesen.');
        return;
    }

    const grid = document.createElement('div');
    grid.className = 'cards-grid';

    items.forEach(p => {
        const proy = p.proyecto;
        const estadoLabel = { pendiente: 'En revisión', aceptado: 'Aceptado', rechazado: 'Rechazado' };
        const estadoClass = { pendiente: 'estado-pendiente', aceptado: 'estado-aceptado', rechazado: 'estado-rechazado' };

        const card = document.createElement('div');
        card.className = 'mp-card';
        card.innerHTML = `
            <div class="mp-card-header">
                <div class="mp-card-title">${proy?.titulo || p.proyectoTitulo || 'Proyecto'}</div>
                <span class="estado-badge ${estadoClass[p.estado]}">${estadoLabel[p.estado]}</span>
            </div>
            <div class="mp-card-meta">
                💰 $${proy?.presupuesto || '-'} USD &nbsp;·&nbsp;
                ⏱️ ${proy?.duracionSemanas || '-'} semanas &nbsp;·&nbsp;
                📅 ${formatFecha(p.fecha)}
            </div>
            ${p.nota ? `<div class="nota-postulacion">📝 "${p.nota}"</div>` : ''}
            ${p.archivoUrl ? `<a href="${p.archivoUrl}" target="_blank" class="adjunto-link">📎 Ver propuesta adjunta</a>` : ''}
            <div class="mp-card-footer">
                <button class="btn-action btn-action-outline"
                    onclick="window.location.href='proyecto.html?id=${p.proyectoId}'">
                    Ver proyecto
                </button>
                ${p.estado === 'aceptado' ? `
                    <button class="btn-action btn-action-primary"
                        onclick="window.location.href='contrato.html?postulacionId=${p.id}'">
                        📄 Ir al contrato
                    </button>` : ''}
            </div>`;
        grid.appendChild(card);
    });

    panel.appendChild(grid);
}

function renderEnCursoProg(lista) {
    const panel = document.getElementById('panel-encurso');
    const items = lista.filter(p =>
        p.estado === 'aceptado' &&
        p.contratoFirmadoEmpresa &&
        p.contratoFirmadoProgramador &&
        p.estadoProyecto !== 'completado' &&
        p.estadoProyecto !== 'baja'
    );

    if (items.length === 0) {
        panel.innerHTML = emptyState('🚀', 'Sin proyectos en curso',
            'Cuando una empresa te acepte y ambos firmen el contrato, el proyecto aparecerá aquí.');
        return;
    }

    const grid = document.createElement('div');
    grid.className = 'cards-grid';

    items.forEach(p => {
        const proy = p.proyecto;
        const card = document.createElement('div');
        card.className = 'mp-card';
        card.innerHTML = `
            <div class="mp-card-header">
                <div class="mp-card-title">${proy?.titulo || p.proyectoTitulo || 'Proyecto'}</div>
                <span class="estado-badge estado-en-proceso">En proceso</span>
            </div>
            <div class="mp-card-meta">
                💰 $${proy?.presupuesto || '-'} USD &nbsp;·&nbsp;
                ⏱️ ${proy?.duracionSemanas || '-'} semanas
            </div>
            ${proy?.tags?.length
                ? `<div class="tags-mini">${proy.tags.map(t => `<span class="tag-mini">${t}</span>`).join('')}</div>`
                : ''}
            <div class="mp-card-footer">
                <button class="btn-action btn-action-primary"
                    onclick="window.location.href='workspace.html?postulacionId=${p.id}'">
                    💬 Ir al Workspace
                </button>
                <button class="btn-action btn-action-outline"
                    onclick="window.location.href='contrato.html?postulacionId=${p.id}'">
                    📄 Ver Contrato
                </button>
            </div>`;
        grid.appendChild(card);
    });

    panel.appendChild(grid);
}

// CORRECCIÓN: historial con botón valorar
async function renderHistorialProg(lista, uid) {
    const panel = document.getElementById('panel-historial');
    const items = lista.filter(p =>
        p.estadoProyecto === 'completado' ||
        p.estadoProyecto === 'baja' ||
        p.estado === 'rechazado'
    );

    if (items.length === 0) {
        panel.innerHTML = emptyState('📁', 'Historial vacío',
            'Aquí aparecerán tus proyectos completados, rechazados y proyectos donde fuiste dado de baja.');
        return;
    }

    const grid = document.createElement('div');
    grid.className = 'cards-grid';

    for (const p of items) {
        const proy = p.proyecto;
        let badgeClass, badgeLabel;
        if (p.estadoProyecto === 'completado')     { badgeClass = 'estado-completado'; badgeLabel = '✅ Completado'; }
        else if (p.estadoProyecto === 'baja')       { badgeClass = 'estado-baja';       badgeLabel = '🚫 Dado de baja'; }
        else                                        { badgeClass = 'estado-rechazado';  badgeLabel = '❌ Rechazado'; }

        // Verificar si ya valoró
        let yaValoro = false;
        if (p.estadoProyecto === 'completado') {
            const valSnap = await getDoc(doc(db, "valoraciones", `${p.id}_programador`));
            yaValoro = valSnap.exists();
        }

        const card = document.createElement('div');
        card.className = 'mp-card';
        card.style.opacity = '0.88';
        card.innerHTML = `
            <div class="mp-card-header">
                <div class="mp-card-title">${proy?.titulo || p.proyectoTitulo || 'Proyecto'}</div>
                <span class="estado-badge ${badgeClass}">${badgeLabel}</span>
            </div>
            <div class="mp-card-meta">
                💰 $${proy?.presupuesto || '-'} USD &nbsp;·&nbsp;
                ⏱️ ${proy?.duracionSemanas || '-'} semanas
            </div>
            ${p.estadoProyecto === 'baja'
                ? `<div class="aviso-baja">⚠️ Fuiste dado de baja de este proyecto por la empresa.</div>`
                : ''}
            <div class="mp-card-footer">
                <button class="btn-action btn-action-outline"
                    onclick="window.location.href='proyecto.html?id=${p.proyectoId}'">
                    Ver proyecto
                </button>
                <button class="btn-action btn-action-outline"
                    onclick="window.location.href='workspace.html?postulacionId=${p.id}'">
                    Ver workspace
                </button>
                ${p.estadoProyecto === 'completado' ? `
                    <button class="btn-action ${yaValoro ? 'btn-action-outline' : 'btn-action-primary'}"
                        onclick="abrirValoracion('${p.id}')"
                        ${yaValoro ? 'style="opacity:0.6;"' : ''}>
                        ${yaValoro ? 'Ver valoración' : 'Dejar valoración'}
                    </button>` : ''}
            </div>`;
        grid.appendChild(card);
    }

    panel.appendChild(grid);
}

// ══════════════════════════════════════════
//  VISTA EMPRESA
// ══════════════════════════════════════════
async function cargarEmpresa(uid) {
    crearTabs([
        { id: 'publicaciones', label: '📋 Mis Publicaciones' },
        { id: 'encurso',       label: '🚀 En Curso'          },
        { id: 'historial',     label: '📁 Historial'         }
    ]);

    const snapProy = await getDocs(
        query(collection(db, "proyectos"), where("empresaId", "==", uid))
    );

    const proyectos = [];
    for (const d of snapProy.docs) {
        const p = { id: d.id, ...d.data() };
        const snapPostu = await getDocs(
            query(collection(db, "postulaciones"), where("proyectoId", "==", p.id))
        );
        p.postulaciones = snapPostu.docs.map(dd => ({ id: dd.id, ...dd.data() }));
        proyectos.push(p);
    }

    renderPublicacionesEmp(proyectos);
    renderEnCursoEmp(proyectos);
    renderHistorialEmp(proyectos);
}

function renderPublicacionesEmp(proyectos) {
    const panel  = document.getElementById('panel-publicaciones');
    // Bug 3 fix: excluir proyectos activos que ya tienen una postulación completada
    const activos = proyectos.filter(p => {
        if (p.estado !== 'activo') return false;
        const tieneCompletado = p.postulaciones.some(ps => ps.estadoProyecto === 'completado');
        return !tieneCompletado;
    });

    if (activos.length === 0) {
        panel.innerHTML = emptyState('📋', 'Sin publicaciones',
            'Aún no has publicado ningún proyecto. Ve al dashboard y crea uno.');
        return;
    }

    const grid = document.createElement('div');
    grid.className = 'cards-grid';

    activos.forEach(p => {
        const pendientes      = p.postulaciones.filter(ps => ps.estado === 'pendiente');
        const aceptado        = p.postulaciones.find(ps => ps.estado === 'aceptado');
        const totalCandidatos = p.postulaciones.length;

        const card = document.createElement('div');
        card.className = 'mp-card mp-card-expandible';
        card.innerHTML = `
            <div class="mp-card-header">
                <div class="mp-card-title">${p.titulo}</div>
                <span class="estado-badge estado-activo">Activo</span>
            </div>
            <div class="mp-card-meta">
                💰 $${p.presupuesto} USD &nbsp;·&nbsp;
                ⏱️ ${p.duracionSemanas} semanas &nbsp;·&nbsp;
                📅 ${formatFecha(p.fechaPublicacion)}
            </div>
            ${p.tags?.length
                ? `<div class="tags-mini">${p.tags.map(t => `<span class="tag-mini">${t}</span>`).join('')}</div>`
                : ''}
            <button class="btn-toggle-candidatos" data-proyecto="${p.id}">
                👥 Ver candidatos
                <span class="candidatos-count">${totalCandidatos}</span>
                <span class="toggle-arrow">▼</span>
            </button>
            <div class="candidatos-panel" id="candidatos-${p.id}" style="display:none;">
                ${renderCandidatosPanel(p.postulaciones, aceptado)}
            </div>
            <div class="mp-card-footer">
                <button class="btn-action btn-action-outline"
                    onclick="window.location.href='proyecto.html?id=${p.id}'">Ver publicación</button>
                <button class="btn-action btn-action-danger"
                    onclick="eliminarProyecto('${p.id}')">🗑️ Eliminar</button>
            </div>`;
        grid.appendChild(card);
    });

    panel.appendChild(grid);

    document.querySelectorAll('.btn-toggle-candidatos').forEach(btn => {
        btn.addEventListener('click', () => {
            const proyId  = btn.getAttribute('data-proyecto');
            const panelC  = document.getElementById(`candidatos-${proyId}`);
            const arrow   = btn.querySelector('.toggle-arrow');
            const abierto = panelC.style.display !== 'none';
            panelC.style.display = abierto ? 'none' : 'block';
            arrow.innerText      = abierto ? '▼' : '▲';
            btn.classList.toggle('active', !abierto);
        });
    });
}

function renderCandidatosPanel(postulaciones, aceptado) {
    if (postulaciones.length === 0) {
        return `<div class="candidatos-empty">📭 Aún no hay candidatos para este proyecto.</div>`;
    }
    const pendientes = postulaciones.filter(ps => ps.estado === 'pendiente');
    const aceptados  = postulaciones.filter(ps => ps.estado === 'aceptado');
    const rechazados = postulaciones.filter(ps => ps.estado === 'rechazado');
    let html = '';
    if (aceptados.length > 0) {
        html += `<div class="candidatos-grupo-titulo">✅ Programador seleccionado</div>`;
        aceptados.forEach(ps => { html += renderFilaCandidato(ps, 'aceptado'); });
    }
    if (pendientes.length > 0) {
        html += `<div class="candidatos-grupo-titulo">⏳ Pendientes de revisión (${pendientes.length})</div>`;
        pendientes.forEach(ps => { html += renderFilaCandidato(ps, 'pendiente'); });
    }
    if (rechazados.length > 0) {
        html += `<div class="candidatos-grupo-titulo rechazados-titulo">❌ Rechazados (${rechazados.length})</div>`;
        rechazados.forEach(ps => { html += renderFilaCandidato(ps, 'rechazado'); });
    }
    return html;
}

function renderFilaCandidato(ps, estado) {
    const estadoClass = { pendiente: 'estado-pendiente', aceptado: 'estado-aceptado', rechazado: 'estado-rechazado' };
    const estadoLabel = { pendiente: 'En revisión', aceptado: 'Aceptado', rechazado: 'Rechazado' };
    return `
        <div class="candidato-card" id="cand-${ps.id}">
            <div class="candidato-card-header">
                <img class="candidato-avatar-lg"
                    src="${ps.fotoProgramador || 'https://via.placeholder.com/40'}" alt="">
                <div class="candidato-card-info">
                    <div class="candidato-card-nombre">${ps.nombreProgramador}</div>
                    <div class="candidato-card-fecha">Postulado: ${formatFecha(ps.fecha)}</div>
                </div>
                <span class="estado-badge ${estadoClass[estado]}">${estadoLabel[estado]}</span>
            </div>
            ${ps.nota ? `
                <div class="candidato-nota">
                    <span class="candidato-nota-label">📝 Nota del candidato</span>
                    <p>${ps.nota}</p>
                </div>` : ''}
            ${ps.archivoUrl
                ? `<a href="${ps.archivoUrl}" target="_blank" class="adjunto-link">📎 Ver propuesta / archivo adjunto</a>`
                : '<div class="sin-adjunto">Sin archivo adjunto</div>'}
            <div class="candidato-card-acciones">
                ${estado === 'pendiente' ? `
                    <button class="btn-action btn-action-primary"
                        onclick="gestionarCandidato('${ps.id}','aceptado')">✔ Aceptar candidato</button>
                    <button class="btn-action btn-action-danger"
                        onclick="gestionarCandidato('${ps.id}','rechazado')">✖ Rechazar</button>` : ''}
                ${estado === 'aceptado' ? `
                    <button class="btn-action btn-action-primary"
                        onclick="window.location.href='contrato.html?postulacionId=${ps.id}'">
                        📄 Ir al Contrato
                    </button>` : ''}
            </div>
        </div>`;
}

function renderEnCursoEmp(proyectos) {
    const panel = document.getElementById('panel-encurso');
    const items = [];
    proyectos.forEach(p => {
        const pos = p.postulaciones.find(ps =>
            ps.estado === 'aceptado' &&
            ps.contratoFirmadoEmpresa &&
            ps.contratoFirmadoProgramador &&
            ps.estadoProyecto !== 'completado' &&
            ps.estadoProyecto !== 'baja'
        );
        if (pos) items.push({ proyecto: p, postulacion: pos });
    });

    if (items.length === 0) {
        panel.innerHTML = emptyState('🚀', 'Sin proyectos en curso',
            'Cuando aceptes un candidato y ambos firmen el contrato, el proyecto aparecerá aquí.');
        return;
    }

    const grid = document.createElement('div');
    grid.className = 'cards-grid';

    items.forEach(({ proyecto: p, postulacion: pos }) => {
        const card = document.createElement('div');
        card.className = 'mp-card';
        card.innerHTML = `
            <div class="mp-card-header">
                <div class="mp-card-title">${p.titulo}</div>
                <span class="estado-badge estado-en-proceso">En proceso</span>
            </div>
            <div class="mp-card-meta">
                👤 <strong>${pos.nombreProgramador}</strong><br>
                💰 $${p.presupuesto} USD &nbsp;·&nbsp; ⏱️ ${p.duracionSemanas} semanas
            </div>
            <div class="mp-card-footer">
                <button class="btn-action btn-action-primary"
                    onclick="window.location.href='workspace.html?postulacionId=${pos.id}'">
                    💬 Ir al Workspace
                </button>
                <button class="btn-action btn-action-outline"
                    onclick="window.location.href='contrato.html?postulacionId=${pos.id}'">
                    📄 Ver Contrato
                </button>
                <button class="btn-action btn-action-danger"
                    onclick="darDeBaja('${pos.id}')">
                    🚫 Dar de baja
                </button>
            </div>`;
        grid.appendChild(card);
    });

    panel.appendChild(grid);
}

// CORRECCIÓN: historial empresa con botón valorar
async function renderHistorialEmp(proyectos) {
    const panel = document.getElementById('panel-historial');
    const items = [];

    proyectos.forEach(p => {
        if (p.estado !== 'activo') { items.push({ proyecto: p, tipo: 'cancelado' }); return; }
        const completado = p.postulaciones.find(ps => ps.estadoProyecto === 'completado');
        const baja       = p.postulaciones.find(ps => ps.estadoProyecto === 'baja');
        if (completado) items.push({ proyecto: p, postulacion: completado, tipo: 'completado' });
        else if (baja)  items.push({ proyecto: p, postulacion: baja,       tipo: 'baja' });
    });

    if (items.length === 0) {
        panel.innerHTML = emptyState('📁', 'Historial vacío',
            'Aquí aparecerán tus proyectos completados, cancelados o con programadores dados de baja.');
        return;
    }

    const grid = document.createElement('div');
    grid.className = 'cards-grid';

    for (const { proyecto: p, postulacion: pos, tipo } of items) {
        let badgeClass, badgeLabel;
        if (tipo === 'completado')      { badgeClass = 'estado-completado'; badgeLabel = '✅ Completado'; }
        else if (tipo === 'baja')       { badgeClass = 'estado-baja';       badgeLabel = '🚫 Programador dado de baja'; }
        else                            { badgeClass = 'estado-cancelado';  badgeLabel = '❌ Cancelado'; }

        // Verificar si ya valoró (solo si hay postulación y está completado)
        let yaValoro = false;
        if (tipo === 'completado' && pos) {
            const valSnap = await getDoc(doc(db, "valoraciones", `${pos.id}_empresa`));
            yaValoro = valSnap.exists();
        }

        const card = document.createElement('div');
        card.className = 'mp-card';
        card.style.opacity = '0.88';
        card.innerHTML = `
            <div class="mp-card-header">
                <div class="mp-card-title">${p.titulo}</div>
                <span class="estado-badge ${badgeClass}">${badgeLabel}</span>
            </div>
            <div class="mp-card-meta">
                💰 $${p.presupuesto} USD &nbsp;·&nbsp; ⏱️ ${p.duracionSemanas} semanas
                ${pos ? `<br>👤 ${pos.nombreProgramador}` : ''}
            </div>
            <div class="mp-card-footer">
                <button class="btn-action btn-action-outline"
                    onclick="window.location.href='proyecto.html?id=${p.id}'">Ver proyecto</button>
                <button class="btn-action btn-action-outline"
                    onclick="window.location.href='workspace.html?postulacionId=${pos?.id || ''}'">
                    Ver workspace
                </button>
                ${tipo === 'completado' && pos ? `
                    <button class="btn-action ${yaValoro ? 'btn-action-outline' : 'btn-action-primary'}"
                        onclick="abrirValoracion('${pos.id}')"
                        ${yaValoro ? 'style="opacity:0.6;"' : ''}>
                        ${yaValoro ? 'Ver valoración' : 'Dejar valoración'}
                    </button>` : ''}
            </div>`;
        grid.appendChild(card);
    }

    panel.appendChild(grid);
}

// ─── ACCIONES GLOBALES ───
window.gestionarCandidato = async (postulacionId, nuevoEstado) => {
    const accion = nuevoEstado === 'aceptado' ? 'aceptar' : 'rechazar';
    if (!confirm(`¿Confirmas ${accion} a este candidato?`)) return;
    try {
        await updateDoc(doc(db, "postulaciones", postulacionId), { estado: nuevoEstado });
        const postuSnap = await getDoc(doc(db, "postulaciones", postulacionId));
        const postuData = postuSnap.data();
        await addDoc(collection(db, "notificaciones"), {
            para: postuData.programadorId,
            mensaje: `Tu postulación para "${postuData.proyectoTitulo}" fue ${nuevoEstado}.`,
            fecha: new Date().toISOString(), leido: false
        });

        // Correo aceptado/rechazado → manejado por Cloud Function onCambioPostulacion

        if (nuevoEstado === 'aceptado') {
            window.location.href = `contrato.html?postulacionId=${postulacionId}`;
        } else { window.location.reload(); }
    } catch (e) { alert("Error: " + e.message); }
};

window.darDeBaja = async (postulacionId) => {
    if (!confirm("¿Dar de baja al programador? Esta acción quedará en el historial.")) return;
    try {
        await updateDoc(doc(db, "postulaciones", postulacionId), { estadoProyecto: 'baja' });
        const postuSnap = await getDoc(doc(db, "postulaciones", postulacionId));
        const postuData = postuSnap.data();
        await addDoc(collection(db, "notificaciones"), {
            para: postuData.programadorId,
            mensaje: `Has sido dado de baja del proyecto "${postuData.proyectoTitulo}".`,
            fecha: new Date().toISOString(), leido: false
        });
        alert("Programador dado de baja.");
        window.location.reload();
    } catch (e) { alert("Error: " + e.message); }
};

window.eliminarProyecto = async (proyectoId) => {
    if (!confirm("¿Eliminar esta publicación? Esta acción no se puede deshacer.")) return;
    try {
        await updateDoc(doc(db, "proyectos", proyectoId), { estado: 'eliminado' });
        window.location.reload();
    } catch (e) { alert("Error: " + e.message); }
};
// ─── ABRIR VALORACION ────────────────────────────────────────────────────
window.abrirValoracion = (postulacionId) => {
    window.location.href = `valoracion.html?postulacionId=${postulacionId}`;
};