import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, collection, getDocs, doc, getDoc,
         query, orderBy, limit, where } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyAReLeJ4fIMhjmTQMy6fgOpkEn9ebspjTU",
    authDomain: "jobify-392f2.firebaseapp.com",
    projectId: "jobify-392f2",
    storageBucket: "jobify-392f2.firebasestorage.app",
    messagingSenderId: "508357161570",
    appId: "1:508357161570:web:3137bb4e917e2e0552173b"
};

const app  = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getFirestore(app);

// ─── SEGURIDAD ───────────────────────────────────────────────────────────
onAuthStateChanged(auth, async (user) => {
    if (!user) { window.location.href = "index.html"; return; }
    const snap = await getDoc(doc(db, "usuarios", user.uid));
    if (!snap.exists() || snap.data().rol !== "Moderador") {
        alert("Acceso denegado.");
        window.location.href = "index.html";
        return;
    }
    iniciarPanel();
});

document.getElementById('btnLogoutAdmin').onclick = () =>
    signOut(auth).then(() => window.location.href = "index.html");

// ─── TABS ────────────────────────────────────────────────────────────────
const titulos = {
    stats:    'Estadísticas Generales',
    usuarios: 'Usuarios',
    proyectos:'Proyectos',
    logs:     'Logs de Acceso',
    reportes: 'Reportes y Disputas'
};

document.querySelectorAll('.admin-nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.admin-nav-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
        btn.classList.add('active');
        const tab = btn.dataset.tab;
        document.getElementById(`tab-${tab}`).classList.add('active');
        document.getElementById('adminPageTitle').innerText = titulos[tab] || '';
        cargarTab(tab);
    });
});

document.getElementById('adminFecha').innerText = new Date().toLocaleDateString('es-MX', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric'
});

function iniciarPanel() { cargarTab('stats'); }

async function cargarTab(tab) {
    if (tab === 'stats')    await cargarStats();
    if (tab === 'usuarios') await cargarUsuarios();
    if (tab === 'proyectos') await cargarProyectos();
    if (tab === 'logs')     await cargarLogs();
}

// ─── STATS ───────────────────────────────────────────────────────────────
async function cargarStats() {
    const [usuarios, proyectos, postulaciones, bloqueos] = await Promise.all([
        getDocs(collection(db, "usuarios")),
        getDocs(collection(db, "proyectos")),
        getDocs(collection(db, "postulaciones")),
        getDocs(collection(db, "seguridad"))
    ]);

    const proyData  = proyectos.docs.map(d => d.data());
    const postuData = postulaciones.docs.map(d => d.data());
    const bloqueados = bloqueos.docs.filter(d => {
        const data = d.data();
        return data.bloqueadoHasta && new Date(data.bloqueadoHasta) > new Date();
    }).length;

    document.getElementById('statUsuarios').innerText    = usuarios.size;
    document.getElementById('statProyectos').innerText   = proyData.filter(p => p.estado === 'activo').length;
    document.getElementById('statCompletados').innerText = postuData.filter(p => p.estadoProyecto === 'completado').length;
    document.getElementById('statBloqueados').innerText  = bloqueados;
}

// ─── USUARIOS (solo lectura) ─────────────────────────────────────────────
async function cargarUsuarios() {
    const snap = await getDocs(collection(db, "usuarios"));
    let usuarios = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderUsuarios(usuarios);

    document.getElementById('searchUsuarios').oninput = (e) => {
        const q = e.target.value.toLowerCase();
        renderUsuarios(usuarios.filter(u =>
            (u.nombre || '').toLowerCase().includes(q) ||
            (u.email  || '').toLowerCase().includes(q)
        ));
    };
    document.getElementById('filterRolUsuarios').onchange = (e) => {
        renderUsuarios(e.target.value ? usuarios.filter(u => u.rol === e.target.value) : usuarios);
    };
}

function renderUsuarios(usuarios) {
    const tbody = document.getElementById('tablaUsuarios');
    tbody.innerHTML = '';
    if (usuarios.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:#94A3B8;padding:24px;">Sin resultados</td></tr>';
        return;
    }
    usuarios.forEach(u => {
        const rolClass = (u.rol || '').toLowerCase();
        const avatar = u.foto
            ? `<img src="${u.foto}" class="user-avatar">`
            : `<div class="user-initial">${(u.nombre || 'U').charAt(0).toUpperCase()}</div>`;
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>
                <div style="display:flex;align-items:center;gap:10px;">
                    ${avatar}
                    <span style="font-weight:600;">${u.nombre || '—'}</span>
                </div>
            </td>
            <td style="color:#64748B;">${u.email || '—'}</td>
            <td><span class="badge-rol ${rolClass}">${u.rol || '—'}</span></td>
            <td>
                <span class="badge-estado ${u.baneado ? 'baneado' : 'activo'}">
                    ${u.baneado ? 'Baneado' : 'Activo'}
                </span>
            </td>`;
        tbody.appendChild(tr);
    });
}

// ─── PROYECTOS (solo lectura) ─────────────────────────────────────────────
async function cargarProyectos() {
    const snap = await getDocs(collection(db, "proyectos"));
    let proyectos = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderProyectos(proyectos);

    document.getElementById('searchProyectos').oninput = (e) => {
        const q = e.target.value.toLowerCase();
        renderProyectos(proyectos.filter(p => (p.titulo || '').toLowerCase().includes(q)));
    };
}

function renderProyectos(proyectos) {
    const tbody = document.getElementById('tablaProyectos');
    tbody.innerHTML = '';
    if (proyectos.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:#94A3B8;padding:24px;">Sin resultados</td></tr>';
        return;
    }
    proyectos.forEach(p => {
        const fecha = p.fechaPublicacion
            ? new Date(p.fechaPublicacion).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })
            : '—';
        const estadoClass = p.estado === 'activo' ? 'activo' : p.estado === 'eliminado' ? 'eliminado' : 'bloqueado';
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="font-weight:600;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${p.titulo}">${p.titulo || '—'}</td>
            <td>$${p.presupuesto || 0} USD</td>
            <td>${p.nivel || '—'}</td>
            <td><span class="badge-estado ${estadoClass}">${p.estado || '—'}</span></td>
            <td style="color:#64748B;">${fecha}</td>`;
        tbody.appendChild(tr);
    });
}

// ─── LOGS ────────────────────────────────────────────────────────────────
async function cargarLogs() {
    const snap = await getDocs(query(collection(db, "logsAcceso"), orderBy("fecha", "desc"), limit(50)));
    const tbody = document.getElementById('tablaLogs');
    tbody.innerHTML = '';
    if (snap.empty) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:#94A3B8;padding:24px;">Sin registros.</td></tr>';
        return;
    }
    snap.docs.forEach(d => {
        const log = d.data();
        const fecha = new Date(log.fecha).toLocaleString('es-MX', {
            day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
        });
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="font-weight:600;">${log.email || '—'}</td>
            <td><span class="badge-estado ${log.estado === 'exitoso' ? 'activo' : 'baneado'}">${log.estado}</span></td>
            <td style="color:#64748B;">${fecha}</td>
            <td style="color:#64748B;">${log.plataforma || '—'}</td>`;
        tbody.appendChild(tr);
    });
}