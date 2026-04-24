import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, collection, getDocs, doc, getDoc, updateDoc,
         query, orderBy, limit, where, setDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

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
    if (!snap.exists() || snap.data().rol !== "Admin") {
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
    stats:      'Estadísticas Generales',
    usuarios:   'Gestión de Usuarios',
    proyectos:  'Gestión de Proyectos',
    moderadores:'Gestión de Moderadores',
    seguridad:  'Seguridad y Logs',
    config:     'Configuración de la Plataforma'
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

function iniciarPanel() {
    cargarTab('stats');
    cargarConfig();
}

async function cargarTab(tab) {
    if (tab === 'stats')       await cargarStats();
    if (tab === 'usuarios')    await cargarUsuarios();
    if (tab === 'proyectos')   await cargarProyectos();
    if (tab === 'seguridad')   await cargarSeguridad();
    if (tab === 'moderadores') await cargarModerados();
}

// ─── STATS ───────────────────────────────────────────────────────────────
async function cargarStats() {
    const [usuarios, proyectos, postulaciones, bloqueos] = await Promise.all([
        getDocs(collection(db, "usuarios")),
        getDocs(collection(db, "proyectos")),
        getDocs(collection(db, "postulaciones")),
        getDocs(collection(db, "seguridad"))
    ]);

    const usersData = usuarios.docs.map(d => d.data());
    const proyData  = proyectos.docs.map(d => d.data());
    const postuData = postulaciones.docs.map(d => d.data());

    const bloqueados = bloqueos.docs.filter(d => {
        const data = d.data();
        return data.bloqueadoHasta && new Date(data.bloqueadoHasta) > new Date();
    }).length;

    // Comisión estimada
    let totalPresupuesto = 0;
    const completados = postuData.filter(p => p.estadoProyecto === 'completado');
    for (const p of completados) {
        const proy = proyData.find(pr => pr.empresaId === p.empresaId);
        if (proy?.presupuesto) totalPresupuesto += Number(proy.presupuesto);
    }
    const comision = (totalPresupuesto * 0.0395).toFixed(2);

    document.getElementById('statUsuarios').innerText      = usersData.length;
    document.getElementById('statEmpresas').innerText      = usersData.filter(u => u.rol === 'Empresa').length;
    document.getElementById('statProgramadores').innerText = usersData.filter(u => u.rol === 'Programador').length;
    document.getElementById('statProyectos').innerText     = proyData.filter(p => p.estado === 'activo').length;
    document.getElementById('statPostulaciones').innerText = postuData.length;
    document.getElementById('statCompletados').innerText   = completados.length;
    document.getElementById('statComisiones').innerText    = `$${comision}`;
    document.getElementById('statBloqueados').innerText    = bloqueados;
}

// ─── USUARIOS ────────────────────────────────────────────────────────────
let todosUsuarios = [];

async function cargarUsuarios() {
    const snap = await getDocs(collection(db, "usuarios"));
    todosUsuarios = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderUsuarios(todosUsuarios);

    document.getElementById('searchUsuarios').oninput = (e) => {
        const q = e.target.value.toLowerCase();
        renderUsuarios(todosUsuarios.filter(u =>
            (u.nombre || '').toLowerCase().includes(q) ||
            (u.email  || '').toLowerCase().includes(q)
        ));
    };
    document.getElementById('filterRolUsuarios').onchange = (e) => {
        const rol = e.target.value;
        renderUsuarios(rol
            ? todosUsuarios.filter(u => rol === 'baneado' ? u.baneado : u.rol === rol)
            : todosUsuarios
        );
    };
}

function renderUsuarios(usuarios) {
    const tbody = document.getElementById('tablaUsuarios');
    tbody.innerHTML = '';
    if (usuarios.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:#94A3B8;padding:24px;">Sin resultados</td></tr>';
        return;
    }
    usuarios.forEach(u => {
        const tr = document.createElement('tr');
        const rolClass = (u.rol || '').toLowerCase();
        const avatar = u.foto
            ? `<img src="${u.foto}" class="user-avatar">`
            : `<div class="user-initial">${(u.nombre || 'U').charAt(0).toUpperCase()}</div>`;

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
            </td>
            <td style="display:flex;gap:6px;flex-wrap:wrap;">
                <button class="btn-sm edit" data-uid="${u.id}">Editar</button>
                ${u.baneado
                    ? `<button class="btn-sm unban" data-uid="${u.id}">Desbanear</button>`
                    : `<button class="btn-sm ban" data-uid="${u.id}">Banear</button>`
                }
            </td>`;
        tbody.appendChild(tr);
    });

    // Banear / Desbanear
    tbody.querySelectorAll('.btn-sm.ban').forEach(btn => {
        btn.onclick = async () => {
            if (!confirm('¿Banear este usuario?')) return;
            await updateDoc(doc(db, "usuarios", btn.dataset.uid), { baneado: true });
            await cargarUsuarios();
        };
    });
    tbody.querySelectorAll('.btn-sm.unban').forEach(btn => {
        btn.onclick = async () => {
            if (!confirm('¿Desbanear este usuario?')) return;
            await updateDoc(doc(db, "usuarios", btn.dataset.uid), { baneado: false });
            await cargarUsuarios();
        };
    });

    // Editar usuario
    tbody.querySelectorAll('.btn-sm.edit').forEach(btn => {
        btn.onclick = () => {
            const u = todosUsuarios.find(x => x.id === btn.dataset.uid);
            if (!u) return;
            document.getElementById('editUserId').value  = u.id;
            document.getElementById('editNombre').value  = u.nombre || '';
            document.getElementById('editRol').value     = u.rol || 'Programador';
            document.getElementById('editFoto').value    = u.foto || '';
            document.getElementById('modalEditarUsuario').style.display = 'flex';
        };
    });
}

// Modal editar usuario
document.getElementById('btnCancelarEditar').onclick = () =>
    document.getElementById('modalEditarUsuario').style.display = 'none';

document.getElementById('btnConfirmarEditar').onclick = async () => {
    const uid    = document.getElementById('editUserId').value;
    const nombre = document.getElementById('editNombre').value.trim();
    const rol    = document.getElementById('editRol').value;
    const foto   = document.getElementById('editFoto').value.trim();
    if (!nombre) return alert('El nombre es obligatorio.');
    const updateData = { nombre, rol };
    if (foto) updateData.foto = foto;
    await updateDoc(doc(db, "usuarios", uid), updateData);
    document.getElementById('modalEditarUsuario').style.display = 'none';
    alert('Usuario actualizado.');
    await cargarUsuarios();
};

// ─── PROYECTOS ───────────────────────────────────────────────────────────
async function cargarProyectos() {
    const snap = await getDocs(collection(db, "proyectos"));
    let proyectos = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderProyectos(proyectos);

    document.getElementById('searchProyectos').oninput = (e) => {
        const q = e.target.value.toLowerCase();
        renderProyectos(proyectos.filter(p => (p.titulo || '').toLowerCase().includes(q)));
    };
    document.getElementById('filterEstadoProyectos').onchange = (e) => {
        renderProyectos(e.target.value ? proyectos.filter(p => p.estado === e.target.value) : proyectos);
    };
}

function renderProyectos(proyectos) {
    const tbody = document.getElementById('tablaProyectos');
    tbody.innerHTML = '';
    if (proyectos.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:#94A3B8;padding:24px;">Sin resultados</td></tr>';
        return;
    }
    proyectos.forEach(p => {
        const fecha = p.fechaPublicacion
            ? new Date(p.fechaPublicacion).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })
            : '—';
        const estadoClass = p.estado === 'activo' ? 'activo' : p.estado === 'eliminado' ? 'eliminado' : 'bloqueado';
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="font-weight:600;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${p.titulo}">${p.titulo || '—'}</td>
            <td style="color:#64748B;font-size:12px;">${p.empresaId?.substring(0, 10) || '—'}...</td>
            <td>$${p.presupuesto || 0} USD</td>
            <td>${p.nivel || '—'}</td>
            <td><span class="badge-estado ${estadoClass}">${p.estado || '—'}</span></td>
            <td style="color:#64748B;">${fecha}</td>
            <td>
                ${p.estado !== 'eliminado'
                    ? `<button class="btn-sm delete" data-id="${p.id}">Eliminar</button>`
                    : '<span style="color:#94A3B8;font-size:12px;">Eliminado</span>'
                }
            </td>`;
        tbody.appendChild(tr);
    });

    tbody.querySelectorAll('.btn-sm.delete').forEach(btn => {
        btn.onclick = async () => {
            if (!confirm('¿Eliminar este proyecto? Esta acción no se puede deshacer.')) return;
            await updateDoc(doc(db, "proyectos", btn.dataset.id), { estado: 'eliminado' });
            await cargarProyectos();
        };
    });
}

// ─── MODERADORES ─────────────────────────────────────────────────────────
async function cargarModerados() {
    const snap = await getDocs(query(collection(db, "usuarios"), where("rol", "==", "Moderador")));
    const mods = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    const tbody = document.getElementById('tablaModerados');
    tbody.innerHTML = '';

    if (mods.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;color:#94A3B8;padding:24px;">No hay moderadores asignados.</td></tr>';
    } else {
        mods.forEach(m => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td style="font-weight:600;">${m.nombre || '—'}</td>
                <td style="color:#64748B;">${m.email || '—'}</td>
                <td>
                    <button class="btn-sm ban" data-uid="${m.id}" data-nombre="${m.nombre || ''}">Quitar moderador</button>
                </td>`;
            tbody.appendChild(tr);
        });
        tbody.querySelectorAll('.btn-sm.ban').forEach(btn => {
            btn.onclick = async () => {
                if (!confirm(`¿Quitar el rol de moderador a ${btn.dataset.nombre}?`)) return;
                await updateDoc(doc(db, "usuarios", btn.dataset.uid), { rol: 'Programador' });
                await cargarModerados();
            };
        });
    }

    document.getElementById('btnCrearModerador').onclick = () =>
        document.getElementById('modalModerador').style.display = 'flex';
    document.getElementById('btnCancelarModerador').onclick = () =>
        document.getElementById('modalModerador').style.display = 'none';
    document.getElementById('btnConfirmarModerador').onclick = async () => {
        const correo = document.getElementById('correoModerador').value.trim();
        if (!correo) return alert('Escribe el correo del usuario.');
        const snap2 = await getDocs(query(collection(db, "usuarios"), where("email", "==", correo)));
        if (snap2.empty) return alert('No se encontró ningún usuario con ese correo.');
        await updateDoc(doc(db, "usuarios", snap2.docs[0].id), { rol: 'Moderador' });
        document.getElementById('modalModerador').style.display = 'none';
        document.getElementById('correoModerador').value = '';
        alert(`${correo} ahora es Moderador.`);
        await cargarModerados();
    };
}

// ─── SEGURIDAD ───────────────────────────────────────────────────────────
async function cargarSeguridad() {
    const [logsSnap, bloqueoSnap] = await Promise.all([
        getDocs(query(collection(db, "logsAcceso"), orderBy("fecha", "desc"), limit(50))),
        getDocs(collection(db, "seguridad"))
    ]);

    const hoy = new Date().toDateString();
    const logsHoy = logsSnap.docs.filter(d => new Date(d.data().fecha).toDateString() === hoy).length;
    const bloqueados = bloqueoSnap.docs.filter(d => {
        const data = d.data();
        return data.bloqueadoHasta && new Date(data.bloqueadoHasta) > new Date();
    }).length;

    document.getElementById('statLogsHoy').innerText      = logsHoy;
    document.getElementById('statBloqueadosHoy').innerText = bloqueados;

    const tbody = document.getElementById('tablaLogs');
    tbody.innerHTML = '';
    logsSnap.docs.forEach(d => {
        const log = d.data();
        const fecha = new Date(log.fecha).toLocaleString('es-MX', {
            day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
        });
        const key = (log.email || '').replace(/\./g, '_').replace(/@/g, '__');
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="font-weight:600;">${log.email || '—'}</td>
            <td><span class="badge-estado ${log.estado === 'exitoso' ? 'activo' : 'baneado'}">${log.estado}</span></td>
            <td style="color:#64748B;">${fecha}</td>
            <td style="color:#64748B;">${log.plataforma || '—'}</td>
            <td>
                <button class="btn-sm unlock" data-key="${key}">Desbloquear</button>
            </td>`;
        tbody.appendChild(tr);
    });

    tbody.querySelectorAll('.btn-sm.unlock').forEach(btn => {
        btn.onclick = async () => {
            if (!confirm('¿Desbloquear esta cuenta?')) return;
            await updateDoc(doc(db, "seguridad", btn.dataset.key), { intentos: 0, bloqueadoHasta: null });
            await cargarSeguridad();
        };
    });
}

// ─── CONFIGURACIÓN ───────────────────────────────────────────────────────
async function cargarConfig() {
    const snap = await getDoc(doc(db, "configuracion", "plataforma"));
    if (snap.exists()) {
        const cfg = snap.data();
        if (cfg.comision     !== undefined) document.getElementById('configComision').value     = cfg.comision;
        if (cfg.comisionFija !== undefined) document.getElementById('configComisionFija').value = cfg.comisionFija;
        if (cfg.bloqueoMin   !== undefined) document.getElementById('configBloqueoMin').value   = cfg.bloqueoMin;
        if (cfg.maxIntentos  !== undefined) document.getElementById('configMaxIntentos').value  = cfg.maxIntentos;
        if (cfg.horas48      !== undefined) document.getElementById('configHoras48').value      = cfg.horas48;
    }

    document.getElementById('btnGuardarConfig').onclick = async () => {
        await setDoc(doc(db, "configuracion", "plataforma"), {
            comision:      parseFloat(document.getElementById('configComision').value),
            comisionFija:  parseFloat(document.getElementById('configComisionFija').value),
            bloqueoMin:    parseInt(document.getElementById('configBloqueoMin').value),
            maxIntentos:   parseInt(document.getElementById('configMaxIntentos').value),
            horas48:       parseInt(document.getElementById('configHoras48').value),
            actualizadoEn: new Date().toISOString()
        });
        alert('Configuración guardada correctamente.');
    };
}