import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, doc, getDoc, collection, addDoc, updateDoc, setDoc,
         query, orderBy, onSnapshot, serverTimestamp, where, getDocs } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL, getBlob } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";
import { iniciarValoraciones } from "./valoracion.js";

// ─── GOOGLE CALENDAR ─────────────────────────────────────────────────────
const CALENDAR_CLIENT_ID = '508357161570-28cckva1vcj8lndiu1digk0midvu6ngo.apps.googleusercontent.com';
const CALENDAR_SCOPE     = 'https://www.googleapis.com/auth/calendar.events';
let   gisIniciado        = false;
let   tokenCalendar      = null;

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
const storage = getStorage(app);

const urlParams = new URLSearchParams(window.location.search);
const postulacionId = urlParams.get('postulacionId');
window.postulacionIdGlobal = postulacionId;

if (!postulacionId) {
    alert("Workspace no encontrado.");
    window.location.href = "dashboard.html";
}

let postulacionData = null;
let proyectoData    = null;
let usuarioActual   = null;
let rolActual       = null;
let archivoChat     = null;

// ─── INICIO ───
onAuthStateChanged(auth, async (user) => {
    if (!user) { window.location.href = "index.html"; return; }
    usuarioActual = user;

    const postuSnap = await getDoc(doc(db, "postulaciones", postulacionId));
    if (!postuSnap.exists()) {
        alert("Postulación no encontrada.");
        window.location.href = "dashboard.html";
        return;
    }
    postulacionData = postuSnap.data();

    if (user.uid !== postulacionData.empresaId && user.uid !== postulacionData.programadorId) {
        alert("No tienes acceso a este workspace.");
        window.location.href = "dashboard.html";
        return;
    }

    // Bloquear acceso SOLO si fue dado de baja (proyecto completado sí permite acceso)
    if (postulacionData.estadoProyecto === 'baja' && user.uid === postulacionData.programadorId) {
        document.getElementById('loadingState').style.display = 'none';
        document.getElementById('chatBloqueado').style.display = 'flex';
        document.getElementById('chatBloqueado').innerHTML = `
            <div class="bloqueado-box">
                <h3>Sin acceso al workspace</h3>
                <p>Tu participación en este proyecto fue dada de baja.</p>
                <p style="font-size:13px;color:#999;margin-top:8px;">${postulacionData.motivoBaja || ''}</p>
                <button class="btn-main" style="margin-top:16px;"
                    onclick="window.location.href='dashboard.html'">
                    Volver al Dashboard
                </button>
            </div>`;
        return;
    }

    const proySnap = await getDoc(doc(db, "proyectos", postulacionData.proyectoId));
    proyectoData = proySnap.exists() ? proySnap.data() : {};

    // Bloquear acceso si el proyecto fue cancelado
    if (proyectoData.estado === 'cancelado') {
        document.getElementById('loadingState').style.display = 'none';
        document.getElementById('chatBloqueado').style.display = 'flex';
        document.getElementById('chatBloqueado').innerHTML = `
            <div class="bloqueado-box">
                <h3>Proyecto cancelado</h3>
                <p>Este proyecto fue cancelado y el workspace ya no está disponible.</p>
                <button class="btn-main" style="margin-top:16px;"
                    onclick="window.location.href='misproyectos.html'">
                    Ir a Mis Proyectos
                </button>
            </div>`;
        return;
    }

    const userSnap = await getDoc(doc(db, "usuarios", user.uid));
    rolActual = userSnap.data().rol;

    // Cargar nombre empresa para valoraciones
    if (!proyectoData.empresaNombre && postulacionData.empresaId) {
        const empSnap = await getDoc(doc(db, "usuarios", postulacionData.empresaId));
        if (empSnap.exists()) proyectoData.empresaNombre = empSnap.data().nombre;
    }

    const roleBadge = document.getElementById('roleBadge');
    roleBadge.innerText = rolActual;
    roleBadge.className = 'role-badge ' + (rolActual === 'Programador' ? 'prog' : 'emp');

    document.getElementById('proyectoTitulo').innerText = proyectoData?.titulo || 'Proyecto';
    document.title = `Jobify - ${proyectoData?.titulo || 'Workspace'}`;
    document.getElementById('loadingState').style.display = 'none';

    const ambosFirmaron = postulacionData.contratoFirmadoEmpresa && postulacionData.contratoFirmadoProgramador;

    if (!ambosFirmaron) {
        document.getElementById('chatBloqueado').style.display = 'flex';
        return;
    }

    document.getElementById('workspaceMain').style.display = 'flex';

    // Banner informativo si el proyecto está completado
    if (postulacionData.estadoProyecto === 'completado') {
        const banner = document.createElement('div');
        banner.style.cssText = 'background:#F0FDF4;border-bottom:1px solid #BBF7D0;padding:10px 24px;font-size:13px;color:#15803D;font-weight:600;display:flex;align-items:center;gap:8px;flex-shrink:0;';
        banner.innerHTML = '<span>&#10003;</span> Este proyecto fue completado — el workspace está disponible en modo historial.';
        document.getElementById('workspaceMain').prepend(banner);
    }

    configurarTabs();
    iniciarChat();
    await verificarChat48h();
    iniciarCalendario();
    iniciarTareas();
    iniciarEntrega();
    iniciarValoraciones(db, postulacionId, postulacionData, proyectoData, usuarioActual, rolActual);
    // Verificar si el plan está aceptado para habilitar tab Finalizar
    verificarTabFinalizar();
});

// ─── TABS ───
function configurarTabs() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            if (btn.disabled) {
                alert('Primero deben acordar el plan de hitos en la pestaña Calendario.');
                return;
            }
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById(`tab-${btn.dataset.tab}`).classList.add('active');
        });
    });
}


// ─── CHAT 48 HORAS ───────────────────────────────────────────────────────
async function verificarChat48h() {
    // Solo aplica si el usuario es programador
    if (rolActual !== 'Programador') return;

    const fechaInicio = postulacionData.fechaInicio;
    if (!fechaInicio) return;

    const inicio = new Date(fechaInicio);
    const limite48h = new Date(inicio.getTime() + 48 * 3600000);
    const ahora = new Date();

    // Si aún estamos dentro de las 48h, no hacer nada
    if (ahora < limite48h) {
        // Mostrar aviso de tiempo restante
        const horasRestantes = Math.ceil((limite48h - ahora) / 3600000);
        const banner = document.createElement('div');
        banner.className = 'banner-48h activo';
        banner.innerHTML = `⏱️ Tienes <strong>${horasRestantes} hora${horasRestantes !== 1 ? 's' : ''}</strong> para responder en el chat y confirmar tu participación en el proyecto.`;
        document.getElementById('tab-chat').prepend(banner);
        return;
    }

    // Pasaron las 48h — verificar si el programador ya mandó algún mensaje
    const msgsRef = collection(db, 'postulaciones', postulacionId, 'mensajes');
    const q = query(
        msgsRef,
        where('autorId', '==', postulacionData.programadorId),
        where('tipo', '==', 'texto')
    );
    const snap = await getDocs(q);

    // Si ya respondió, no hacer nada
    if (!snap.empty) return;

    // No respondió en 48h → desvincularlo
    // Solo ejecutar si la postulación todavía está activa (no ya en baja)
    if (postulacionData.estadoProyecto === 'baja') return;

    try {
        // Marcar postulación como baja
        await updateDoc(doc(db, 'postulaciones', postulacionId), {
            estadoProyecto: 'baja',
            motivoBaja: 'Sin respuesta en chat dentro de 48 horas',
            fechaBaja: new Date().toISOString()
        });

        // Cancelar el proyecto — va directo al historial de empresa como cancelado
        await updateDoc(doc(db, 'proyectos', postulacionData.proyectoId), {
            estado: 'cancelado'
        });

        // Notificar a la empresa
        await addDoc(collection(db, 'notificaciones'), {
            para:    postulacionData.empresaId,
            mensaje: `El programador ${postulacionData.nombreProgramador} no respondió en 48h y fue dado de baja. El proyecto "${proyectoData.titulo || 'Proyecto'}" fue cancelado.`,
            fecha:   new Date().toISOString(),
            leido:   false
        });

        // Notificar al programador
        await addDoc(collection(db, 'notificaciones'), {
            para:    postulacionData.programadorId,
            mensaje: `Fuiste desvinculado del proyecto "${proyectoData.titulo || 'Proyecto'}" por no responder en el chat dentro de las primeras 48 horas.`,
            fecha:   new Date().toISOString(),
            leido:   false
        });

        // Mostrar mensaje al programador
        alert('⚠️ Fuiste desvinculado de este proyecto por no responder en el chat dentro de las 48 horas establecidas.');
        window.location.href = 'misproyectos.html';

    } catch (e) {
        console.error('Error al desvincular por 48h:', e);
    }
}

// ─── CHAT ───
function iniciarChat() {
    const proyectoCompletado = postulacionData.estadoProyecto === 'completado';

    // Calcular expiración del chat
    let chatExpirado = false;
    if (proyectoData?.duracionSemanas && postulacionData.fechaInicio) {
        const inicio      = new Date(postulacionData.fechaInicio);
        const diasProy    = proyectoData.duracionSemanas * 7;
        const expiry      = new Date(inicio.getTime() + (diasProy + 7) * 86400000);
        document.getElementById('chatExpiry').innerText = expiry.toLocaleDateString('es-MX', {
            day: '2-digit', month: 'long', year: 'numeric'
        });
        chatExpirado = new Date() > expiry;
    } else {
        document.getElementById('chatExpiry').innerText = 'Duración del proyecto + 7 días';
    }

    // BUG 4 FIX: deshabilitar input si el chat expiró
    const inputArea = document.getElementById('chatInputArea');
    if (chatExpirado) {
        inputArea.innerHTML = `
            <div class="chat-expirado">
                🔒 El chat de este proyecto ha expirado.
            </div>`;
    }

    // Mensajes en tiempo real
    const msgsRef = collection(db, "postulaciones", postulacionId, "mensajes");
    const q = query(msgsRef, orderBy("fecha", "asc"));

    onSnapshot(q, (snap) => {
        const container = document.getElementById('chatMessages');
        container.innerHTML = "";
        let lastDate = "";

        snap.forEach(docSnap => {
            const msg      = docSnap.data();
            const esMio    = msg.autorId === usuarioActual.uid;
            const fechaMsg = msg.fecha?.toDate ? msg.fecha.toDate() : new Date(msg.fecha);
            const fechaStr = fechaMsg.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });

            if (fechaStr !== lastDate) {
                lastDate = fechaStr;
                const sep = document.createElement('div');
                sep.className = 'date-separator';
                sep.innerText = fechaStr;
                container.appendChild(sep);
            }

            const bubble = document.createElement('div');
            bubble.className = `msg-bubble ${esMio ? 'mine' : 'theirs'}`;
            const hora = fechaMsg.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });

            if (msg.tipo === 'archivo') {
                bubble.innerHTML = `
                    <div class="msg-sender">${esMio ? 'Tú' : msg.autorNombre}</div>
                    <a href="${msg.archivoUrl}" target="_blank" class="msg-file">
                        📎 ${msg.archivoNombre || 'Archivo adjunto'}
                    </a>
                    <span class="msg-time">${hora}</span>`;
            } else {
                bubble.innerHTML = `
                    <div class="msg-sender">${esMio ? 'Tú' : msg.autorNombre}</div>
                    <div class="msg-text">${msg.texto}</div>
                    <span class="msg-time">${hora}</span>`;
            }
            container.appendChild(bubble);
        });

        container.scrollTop = container.scrollHeight;
    });

    if (chatExpirado) return; // No conectar eventos si chat expirado

    const input = document.getElementById('chatInput');
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviarMensaje(); }
    });
    input.addEventListener('input', () => {
        input.style.height = 'auto';
        input.style.height = Math.min(input.scrollHeight, 120) + 'px';
    });

    document.getElementById('btnSendMsg').onclick = enviarMensaje;

    document.getElementById('chatFileInput').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        archivoChat = file;
        const preview = document.getElementById('filePreview');
        preview.style.display = 'flex';
        preview.innerHTML = `📎 ${file.name}
            <span style="cursor:pointer; margin-left:auto; color:var(--danger);" id="removeFileChat">✕</span>`;
        document.getElementById('removeFileChat').onclick = () => {
            archivoChat = null;
            e.target.value = '';
            preview.style.display = 'none';
        };
    });
}

async function enviarMensaje() {
    const input = document.getElementById('chatInput');
    const texto = input.value.trim();
    if (!texto && !archivoChat) return;

    const userSnap = await getDoc(doc(db, "usuarios", usuarioActual.uid));
    const userData = userSnap.data();

    try {
        if (archivoChat) {
            const storageRef = ref(storage, `chats/${postulacionId}/${Date.now()}_${archivoChat.name}`);
            await uploadBytes(storageRef, archivoChat);
            const url = await getDownloadURL(storageRef);
            await addDoc(collection(db, "postulaciones", postulacionId, "mensajes"), {
                tipo: 'archivo', archivoUrl: url, archivoNombre: archivoChat.name,
                autorId: usuarioActual.uid, autorNombre: userData.nombre || 'Usuario',
                fecha: serverTimestamp()
            });
            archivoChat = null;
            document.getElementById('chatFileInput').value = '';
            document.getElementById('filePreview').style.display = 'none';
        }
        if (texto) {
            await addDoc(collection(db, "postulaciones", postulacionId, "mensajes"), {
                tipo: 'texto', texto,
                autorId: usuarioActual.uid, autorNombre: userData.nombre || 'Usuario',
                fecha: serverTimestamp()
            });
        }
        input.value = '';
        input.style.height = 'auto';
    } catch (error) { alert("Error al enviar mensaje: " + error.message); }
}

// ─── CALENDARIO ───
function iniciarCalendario() {
    const planRef = doc(db, "postulaciones", postulacionId, "plan", "datos");
    onSnapshot(planRef, (snap) => {
        const plan = snap.exists() ? snap.data() : { hitos: [], estado: 'borrador' };
        renderizarPlan(plan);
    });
    document.getElementById('btnAgregarHito').onclick = agregarHito;
}

function renderizarPlan(plan) {
    const hitos       = plan.hitos || [];
    const estado      = plan.estado || 'borrador';
    const planBloqueado = estado === 'aceptado';

    const estadoEl = document.getElementById('planEstado');
    if (planBloqueado) {
        estadoEl.className = 'plan-estado bloqueado';
        estadoEl.innerHTML = `
            <span>🔒 Plan aceptado y bloqueado por ambas partes.</span>
            <div style="display:flex;gap:10px;margin-top:10px;flex-wrap:wrap;">
                <button id="btnSyncCalendar" class="btn-sync-calendar">📅 Sincronizar con Google Calendar</button>
                <button id="btnDesbloquearPlan" class="btn-desbloquear-plan">🔓 Solicitar modificación</button>
            </div>`;
        setTimeout(() => {
            const btnCal = document.getElementById('btnSyncCalendar');
            if (btnCal) btnCal.onclick = () => sincronizarCalendar(hitos);
            const btnDes = document.getElementById('btnDesbloquearPlan');
            if (btnDes) btnDes.onclick = () => solicitarModificacionPlan();
        }, 100);
    } else if (estado === 'modificacion_solicitada') {
        const solicitadoPor = plan.modificacionSolicitadaPor;
        const esMiSolicitud = solicitadoPor === usuarioActual?.uid;
        estadoEl.className = 'plan-estado pendiente';
        estadoEl.innerHTML = esMiSolicitud
            ? '⏳ Solicitaste modificar el plan — esperando que la otra parte acepte.'
            : `<span>⚠️ La otra parte solicita modificar el plan.</span>
               <button id="btnAceptarModificacion" class="btn-aceptar-plan" style="margin-top:8px;">✅ Aceptar y desbloquear plan</button>`;
        setTimeout(() => {
            const btnAM = document.getElementById('btnAceptarModificacion');
            if (btnAM) btnAM.onclick = async () => {
                await updateDoc(doc(db, "postulaciones", postulacionId, "plan", "datos"),
                    { estado: 'borrador', modificacionSolicitadaPor: null });
                alert('Plan desbloqueado. Pueden editar los hitos y volver a proponerlo.');
            };
        }, 100);
    } else if (estado === 'propuesto') {
        estadoEl.className = 'plan-estado pendiente';
        estadoEl.innerText = '⏳ Plan propuesto — esperando aceptación.';
    } else { estadoEl.className = ''; estadoEl.innerText = ''; }

    document.getElementById('formHito').style.display = planBloqueado ? 'none' : 'block';

    const lista = document.getElementById('listaHitos');
    lista.innerHTML = '';

    if (hitos.length === 0) {
        lista.innerHTML = '<p class="empty-msg">No hay hitos agregados aún.</p>';
    } else {
        const hoy = new Date();
        hitos.forEach((hito, i) => {
            const fechaHito = new Date(hito.fecha);
            let dotClass = '';
            if (fechaHito < hoy) dotClass = 'vencido';
            else if ((fechaHito - hoy) < 7 * 86400000) dotClass = 'proximo';

            const item = document.createElement('div');
            item.className = 'hito-item';
            item.innerHTML = `
                <div class="hito-dot ${dotClass}"></div>
                <div class="hito-info">
                    <div class="hito-nombre">${hito.nombre}</div>
                    <div class="hito-fecha">${fechaHito.toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' })}</div>
                </div>
                ${!planBloqueado ? `<button class="btn-eliminar-hito" data-index="${i}">🗑️</button>` : ''}`;
            lista.appendChild(item);
        });

        lista.querySelectorAll('.btn-eliminar-hito').forEach(btn => {
            btn.onclick = async () => {
                const idx = parseInt(btn.getAttribute('data-index'));
                const snap = await getDoc(doc(db, "postulaciones", postulacionId, "plan", "datos"));
                const planActual = snap.exists() ? snap.data() : { hitos: [] };
                planActual.hitos.splice(idx, 1);
                await updateDoc(doc(db, "postulaciones", postulacionId, "plan", "datos"), { hitos: planActual.hitos });
            };
        });
    }

    const acciones = document.getElementById('accionesPlan');
    acciones.innerHTML = '';

    if (!planBloqueado && hitos.length > 0) {
        acciones.style.display = 'flex';
        if (estado !== 'propuesto') {
            const btnProponer = document.createElement('button');
            btnProponer.className = 'btn-proponer';
            btnProponer.innerText = '📤 Proponer plan a la otra parte';
            btnProponer.onclick = async () => {
                await updateDoc(doc(db, "postulaciones", postulacionId, "plan", "datos"),
                    { estado: 'propuesto', propuestoPor: usuarioActual.uid });
            };
            acciones.appendChild(btnProponer);
        }
        if (estado === 'propuesto' && plan.propuestoPor !== usuarioActual.uid) {
            const btnAceptar = document.createElement('button');
            btnAceptar.className = 'btn-aceptar-plan';
            btnAceptar.innerText = '✅ Aceptar plan de trabajo';
            btnAceptar.onclick = async () => {
                await updateDoc(doc(db, "postulaciones", postulacionId, "plan", "datos"), { estado: 'aceptado' });
                alert('¡Plan bloqueado! Las fechas han quedado confirmadas.');
            };
            acciones.appendChild(btnAceptar);
        }
    } else { acciones.style.display = 'none'; }
}

async function agregarHito() {
    const nombre = document.getElementById('hitoNombre').value.trim();
    const fecha  = document.getElementById('hitoFecha').value;
    if (!nombre || !fecha) return alert("Completa el nombre y la fecha del hito.");
    const planRef = doc(db, "postulaciones", postulacionId, "plan", "datos");
    const snap = await getDoc(planRef);
    const planActual = snap.exists() ? snap.data() : { hitos: [], estado: 'borrador' };
    planActual.hitos = planActual.hitos || [];
    planActual.hitos.push({ nombre, fecha });
    planActual.hitos.sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
    await setDoc(planRef, { ...planActual, estado: planActual.estado || 'borrador' });
    document.getElementById('hitoNombre').value = '';
    document.getElementById('hitoFecha').value  = '';
}

// ─── TAREAS ───
function iniciarTareas() {
    // Las tareas son el checklist PERSONAL del programador
    // La empresa ve un mensaje explicativo
    const btnNueva = document.getElementById('btnNuevaTarea');
    const formNueva = document.getElementById('formNuevaTarea');

    if (rolActual === 'Empresa') {
        // Empresa solo puede ver las tareas, no crearlas
        if (btnNueva) btnNueva.style.display = 'none';
        if (formNueva) formNueva.style.display = 'none';
        // Agregar nota explicativa
        const header = document.querySelector('.tareas-header');
        if (header && !document.getElementById('notaEmpresaTareas')) {
            const nota = document.createElement('p');
            nota.id = 'notaEmpresaTareas';
            nota.style.cssText = 'font-size:12px;color:#94A3B8;background:#F8F9FA;padding:8px 12px;border-radius:8px;margin:0;border-left:3px solid var(--border);';
            nota.innerText = '👁️ Vista de solo lectura — estas son las tareas internas del programador.';
            header.appendChild(nota);
        }
    }

    const tareasRef = collection(db, "postulaciones", postulacionId, "tareas");
    const q = query(tareasRef, orderBy("creadoEn", "asc"));

    onSnapshot(q, (snap) => {
        const lista = document.getElementById('listaTareas');
        lista.innerHTML = '';
        if (snap.empty) { lista.innerHTML = '<p class="empty-msg">No hay tareas aún.</p>'; return; }

        const labels = { 'no-iniciada': 'No iniciada', 'en-proceso': 'En proceso', 'finalizada': 'Finalizada' };

        snap.forEach(docSnap => {
            const tarea = docSnap.data();
            const id    = docSnap.id;
            const estadoActual = tarea.estado || 'no-iniciada';
            const item = document.createElement('div');
            item.className = 'tarea-item';
            item.innerHTML = `
                <button class="tarea-status-btn ${estadoActual !== 'no-iniciada' ? estadoActual : ''}"
                        data-id="${id}" data-estado="${estadoActual}" title="Cambiar estado">
                    ${estadoActual === 'en-proceso' ? '◑' : estadoActual === 'finalizada' ? '✓' : ''}
                </button>
                <div class="tarea-info">
                    <div class="tarea-desc">${tarea.descripcion}</div>
                    <div class="tarea-objetivo">${tarea.objetivo || ''}</div>
                    <div class="tarea-fecha">📅 ${tarea.fecha
                        ? new Date(tarea.fecha).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })
                        : 'Sin fecha'}</div>
                </div>
                <span class="tarea-estado-badge ${estadoActual}">${labels[estadoActual]}</span>`;
            lista.appendChild(item);
        });

        lista.querySelectorAll('.tarea-status-btn').forEach(btn => {
            if (rolActual === 'Empresa') {
                btn.style.cursor = 'default';
                btn.title = 'Solo el programador puede cambiar el estado';
                return;
            }
            btn.onclick = async () => {
                const id = btn.getAttribute('data-id');
                const estadoActual = btn.getAttribute('data-estado');
                const estados = ['no-iniciada', 'en-proceso', 'finalizada'];
                const siguiente = estados[(estados.indexOf(estadoActual) + 1) % estados.length];
                await updateDoc(doc(db, "postulaciones", postulacionId, "tareas", id), { estado: siguiente });
            };
        });
    });

    document.getElementById('btnNuevaTarea').onclick = () => {
        document.getElementById('formNuevaTarea').style.display = 'flex';
    };
    document.getElementById('btnCancelarTarea').onclick = () => {
        document.getElementById('formNuevaTarea').style.display = 'none';
        limpiarFormTarea();
    };
    document.getElementById('btnGuardarTarea').onclick = async () => {
        const desc     = document.getElementById('tareaDesc').value.trim();
        const objetivo = document.getElementById('tareaObjetivo').value.trim();
        const fecha    = document.getElementById('tareaFecha').value;
        if (!desc) return alert("La descripción es obligatoria.");
        await addDoc(collection(db, "postulaciones", postulacionId, "tareas"), {
            descripcion: desc, objetivo, fecha: fecha || null,
            estado: 'no-iniciada', creadoPor: usuarioActual.uid, creadoEn: serverTimestamp()
        });
        document.getElementById('formNuevaTarea').style.display = 'none';
        limpiarFormTarea();
    };
}

function limpiarFormTarea() {
    document.getElementById('tareaDesc').value    = '';
    document.getElementById('tareaObjetivo').value = '';
    document.getElementById('tareaFecha').value    = '';
}
// ─── SOLICITAR MODIFICACIÓN DEL PLAN ─────────────────────────────────────
async function solicitarModificacionPlan() {
    const confirmar = confirm('¿Deseas solicitar modificar el plan? La otra parte debe aceptar para que se desbloquee.');
    if (!confirmar) return;
    await updateDoc(doc(db, "postulaciones", postulacionId, "plan", "datos"), {
        estado: 'modificacion_solicitada',
        modificacionSolicitadaPor: usuarioActual.uid
    });
    // Notificar a la otra parte
    const otroId = rolActual === 'Empresa' ? postulacionData.programadorId : postulacionData.empresaId;
    await addDoc(collection(db, 'notificaciones'), {
        para:    otroId,
        mensaje: `La ${rolActual === 'Empresa' ? 'empresa' : 'el programador'} solicita modificar el plan de hitos del proyecto "${proyectoData?.titulo || 'Proyecto'}". Ingresa al workspace para aceptar o rechazar.`,
        fecha:   new Date().toISOString(),
        leido:   false
    });
}

// ─── VERIFICAR TAB FINALIZAR ──────────────────────────────────────────────
function verificarTabFinalizar() {
    const tabFinalizar = document.getElementById('tabFinalizar');
    if (!tabFinalizar) return;

    // Tab Finalizar siempre accesible — el contenido del panel maneja el estado
    tabFinalizar.disabled = false;
    tabFinalizar.style.opacity = '1';
    tabFinalizar.style.cursor  = 'pointer';
    tabFinalizar.title = '';

    // El panel se actualiza en tiempo real según el estado del plan
    onSnapshot(doc(db, "postulaciones", postulacionId, "plan", "datos"), (planSnap) => {
        const planData    = planSnap.exists() ? planSnap.data() : {};
        const planAceptado = planData.estado === 'aceptado';

        // Solo actualizar el panel si el tab Finalizar NO está activo
        // para no interrumpir si el usuario ya está viendo el contenido
        const tabActivo = document.getElementById('tab-finalizar').classList.contains('active');
        if (tabActivo) return;

        const panel = document.getElementById('panelCompletar');
        if (!panel) return;

        if (!planAceptado && postulacionData.estadoProyecto !== 'completado') {
            panel.innerHTML = `
                <div style="text-align:center;padding:60px 20px;color:var(--text-muted);">
                    <div style="font-size:48px;margin-bottom:16px;">📅</div>
                    <h3 style="font-size:18px;font-weight:700;color:var(--text-main);margin-bottom:8px;">
                        Plan de trabajo pendiente
                    </h3>
                    <p style="font-size:14px;line-height:1.6;max-width:360px;margin:0 auto;">
                        Para poder finalizar el proyecto primero deben acordar y aceptar el plan
                        de hitos en la pestaña <strong>Calendario</strong>. Una vez aceptado
                        podrás proceder con el pago y cierre del proyecto.
                    </p>
                </div>`;
        }
    });
}


// ═══════════════════════════════════════════════════════════════════════════
//  GOOGLE CALENDAR
// ═══════════════════════════════════════════════════════════════════════════
function iniciarGIS(callback) {
    if (gisIniciado) { callback(); return; }
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.onload = () => { gisIniciado = true; callback(); };
    document.head.appendChild(script);
}

function sincronizarCalendar(hitos) {
    if (!hitos || hitos.length === 0) { alert('No hay hitos para sincronizar.'); return; }
    iniciarGIS(() => {
        const client = google.accounts.oauth2.initTokenClient({
            client_id: CALENDAR_CLIENT_ID,
            scope:     CALENDAR_SCOPE,
            callback:  async (response) => {
                if (response.error) { alert('Error al autorizar: ' + response.error); return; }
                tokenCalendar = response.access_token;
                await agregarHitosACalendar(hitos, tokenCalendar);
            }
        });
        client.requestAccessToken();
    });
}

async function agregarHitosACalendar(hitos, token) {
    const btn = document.getElementById('btnSyncCalendar');
    if (btn) { btn.innerText = '⏳ Sincronizando...'; btn.disabled = true; }
    let exitosos = 0, errores = 0;
    for (const hito of hitos) {
        const fechaFin = new Date(hito.fecha);
        fechaFin.setDate(fechaFin.getDate() + 1);
        const evento = {
            summary:     `📌 ${hito.nombre} — Jobify`,
            description: `Hito del proyecto: ${proyectoData?.titulo || 'Proyecto'}`,
            start:   { date: hito.fecha },
            end:     { date: fechaFin.toISOString().split('T')[0] },
            reminders: {
                useDefault: false,
                overrides:  [{ method: 'email', minutes: 1440 }, { method: 'popup', minutes: 60 }]
            },
            colorId: '9'
        };
        try {
            const res = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify(evento)
            });
            if (res.ok) exitosos++; else errores++;
        } catch (e) { errores++; }
    }
    if (btn) { btn.innerText = exitosos > 0 ? '✅ Sincronizado' : '❌ Error'; btn.disabled = false; }
    if (exitosos > 0 && errores === 0)
        alert(`✅ ${exitosos} hito${exitosos !== 1 ? 's' : ''} agregado${exitosos !== 1 ? 's' : ''} a Google Calendar con recordatorios.`);
    else if (exitosos > 0)
        alert(`⚠️ ${exitosos} hitos agregados, ${errores} fallaron.`);
    else
        alert('❌ No se pudo sincronizar. Intenta de nuevo.');
}
// ═══════════════════════════════════════════════════════════════════════════
//  MÓDULO DE ENTREGA — Repositorio tipo GitHub
// ═══════════════════════════════════════════════════════════════════════════

function iniciarEntrega() {
    const accionesEl = document.getElementById('entregaAcciones');
    if (!accionesEl) return;

    if (rolActual === 'Programador') {
        const btnSubir = document.createElement('button');
        btnSubir.className = 'btn-subir-entrega';
        btnSubir.id = 'btnSubirEntrega';
        btnSubir.innerText = 'Subir entrega (.zip)';
        btnSubir.onclick = () => document.getElementById('inputEntregaZip').click();
        accionesEl.appendChild(btnSubir);

        const input = document.createElement('input');
        input.type    = 'file';
        input.id      = 'inputEntregaZip';
        input.accept  = '.zip';
        input.style.display = 'none';
        input.onchange = (e) => procesarZip(e.target.files[0]);
        accionesEl.appendChild(input);
    }

    cargarEntregaExistente();
}

async function cargarEntregaExistente() {
    try {
        const snap = await getDoc(doc(db, 'postulaciones', postulacionId, 'entrega', 'datos'));
        if (!snap.exists()) return;
        mostrarExplorer(snap.data().archivos || [], snap.data());
    } catch (e) {
        console.error('Error cargando entrega:', e);
    }
}

// Carpetas a ignorar en el zip
const CARPETAS_IGNORADAS = [
    'node_modules/', '.git/', '__pycache__/', '.idea/', '.vscode/',
    'dist/', 'build/', '.next/', 'venv/', 'env/', '.env/',
    'coverage/', '.nyc_output/', 'vendor/'
];

// Extensiones a ignorar (binarios grandes)
const EXTENSIONES_IGNORADAS = ['exe','dll','so','dylib','bin','dat','db','sqlite'];

function debeIgnorar(ruta) {
    const rutaLower = ruta.toLowerCase();
    for (const carpeta of CARPETAS_IGNORADAS) {
        if (rutaLower.includes(carpeta)) return true;
    }
    const ext = ruta.split('.').pop().toLowerCase();
    if (EXTENSIONES_IGNORADAS.includes(ext)) return true;
    return false;
}

// Subir archivos en lotes para no saturar el navegador
async function subirEnLotes(tareas, tamanoLote = 5) {
    const resultados = [];
    for (let i = 0; i < tareas.length; i += tamanoLote) {
        const lote = tareas.slice(i, i + tamanoLote);
        const res  = await Promise.all(lote.map(t => t()));
        resultados.push(...res);
        // Pequeña pausa entre lotes
        if (i + tamanoLote < tareas.length) {
            await new Promise(r => setTimeout(r, 200));
        }
    }
    return resultados;
}

async function procesarZip(file) {
    if (!file) return;
    const btn = document.getElementById('btnSubirEntrega');
    if (btn) { btn.innerText = 'Procesando...'; btn.disabled = true; }

    try {
        const zip = await JSZip.loadAsync(file);

        // Recolectar archivos válidos (sin node_modules, etc.)
        const archivosFiltrados = [];
        zip.forEach((ruta, archivo) => {
            if (archivo.dir) return;
            if (debeIgnorar(ruta)) return;
            archivosFiltrados.push({ ruta, archivo });
        });

        if (archivosFiltrados.length === 0) {
            if (btn) { btn.innerText = 'Subir entrega (.zip)'; btn.disabled = false; }
            alert('El .zip no contiene archivos válidos, o todos son de carpetas excluidas (node_modules, .git, etc.).');
            return;
        }

        if (archivosFiltrados.length > 200) {
            if (btn) { btn.innerText = 'Subir entrega (.zip)'; btn.disabled = false; }
            alert(`El .zip contiene ${archivosFiltrados.length} archivos válidos. Por favor incluye solo el código fuente (sin node_modules, dist, etc.). Máximo 200 archivos.`);
            return;
        }

        if (btn) btn.innerText = `Subiendo 0/${archivosFiltrados.length} archivos...`;

        // Subir .zip original a Storage
        const zipRef = ref(storage, `entregas/${postulacionId}/${file.name}`);
        await uploadBytes(zipRef, file);
        const zipUrl = await getDownloadURL(zipRef);

        // Crear tareas de upload por lote
        let subidos = 0;
        const tareas = archivosFiltrados.map(({ ruta, archivo }) => async () => {
            try {
                const blob        = await archivo.async('blob');
                const archivoRef  = ref(storage, `entregas/${postulacionId}/archivos/${ruta}`);
                await uploadBytes(archivoRef, blob);
                const url = await getDownloadURL(archivoRef);
                subidos++;
                if (btn) btn.innerText = `Subiendo ${subidos}/${archivosFiltrados.length} archivos...`;
                return {
                    ruta,
                    nombre:    ruta.split('/').pop(),
                    extension: ruta.includes('.') ? ruta.split('.').pop().toLowerCase() : 'txt',
                    tamano:    blob.size,
                    url
                };
            } catch (e) {
                console.warn('Error subiendo:', ruta, e);
                return null;
            }
        });

        const resultados = await subirEnLotes(tareas, 5);
        const archivos   = resultados.filter(Boolean);

        // Guardar estructura en Firestore (sin contenido)
        const entregaData = {
            archivos,
            zipUrl,
            zipNombre:     file.name,
            zipTamano:     file.size,
            subidoPor:     usuarioActual.uid,
            subidoEn:      new Date().toISOString(),
            totalArchivos: archivos.length
        };

        await setDoc(doc(db, 'postulaciones', postulacionId, 'entrega', 'datos'), entregaData);

        await addDoc(collection(db, 'notificaciones'), {
            para:    postulacionData.empresaId,
            mensaje: `El programador subió la entrega final del proyecto "${proyectoData?.titulo || 'Proyecto'}". Revísala en el workspace.`,
            fecha:   new Date().toISOString(),
            leido:   false
        });

        mostrarExplorer(archivos, entregaData);
        if (btn) { btn.innerText = 'Actualizar entrega'; btn.disabled = false; }
        alert(`✅ Entrega subida: ${archivos.length} archivos.`);

    } catch (e) {
        console.error('Error procesando zip:', e);
        if (btn) { btn.innerText = 'Subir entrega (.zip)'; btn.disabled = false; }
        alert('Error al procesar el archivo: ' + e.message);
    }
}

function mostrarExplorer(archivos, data) {
    document.getElementById('entregaEmpty').style.display    = 'none';
    document.getElementById('entregaExplorer').style.display = 'grid';

    const infoEl = document.getElementById('entregaInfo');
    const fecha  = data.subidoEn ? new Date(data.subidoEn).toLocaleString('es-MX', {
        day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
    }) : '—';
    const tamano = data.zipTamano ? (data.zipTamano / 1024).toFixed(1) + ' KB' : '—';
    infoEl.style.display = 'flex';
    infoEl.innerHTML = `
        <span><strong>${data.zipNombre || 'entrega.zip'}</strong></span>
        <span>${data.totalArchivos || archivos.length} archivos</span>
        <span>${tamano}</span>
        <span>Subido: ${fecha}</span>
        ${data.zipUrl ? `<a href="${data.zipUrl}" target="_blank" class="btn-descargar-zip">Descargar .zip</a>` : ''}`;

    const treeEl = document.getElementById('explorerTree');
    treeEl.innerHTML = '';

    // Construir árbol de carpetas
    const estructura = {};
    archivos.forEach(archivo => {
        const partes = archivo.ruta.split('/');
        let nivel = estructura;
        partes.forEach((parte, i) => {
            if (i === partes.length - 1) {
                nivel[parte] = archivo;
            } else {
                if (!nivel[parte]) nivel[parte] = {};
                nivel = nivel[parte];
            }
        });
    });

    renderTree(estructura, treeEl);
}

function renderTree(nodo, contenedor) {
    // Primero carpetas, luego archivos
    const entradas = Object.entries(nodo).sort(([a, av], [b, bv]) => {
        const aEsArchivo = !!av.ruta;
        const bEsArchivo = !!bv.ruta;
        if (aEsArchivo !== bEsArchivo) return aEsArchivo ? 1 : -1;
        return a.localeCompare(b);
    });

    entradas.forEach(([nombre, valor]) => {
        const item = document.createElement('div');

        if (valor.ruta) {
            // Archivo
            item.className = 'tree-file';
            item.innerHTML = `<span class="tree-icon">${getIcono(valor.extension)}</span><span class="tree-name">${nombre}</span>`;
            item.onclick = (e) => verArchivo(valor, e.currentTarget);
        } else {
            // Carpeta
            item.className = 'tree-folder';
            const label = document.createElement('div');
            label.className = 'tree-folder-label';
            label.innerHTML = `<span class="tree-icon">📂</span><span class="tree-name">${nombre}</span>`;
            const hijos = document.createElement('div');
            hijos.className = 'tree-children';
            renderTree(valor, hijos);
            label.onclick = () => {
                hijos.classList.toggle('collapsed');
                label.querySelector('.tree-icon').textContent =
                    hijos.classList.contains('collapsed') ? '📁' : '📂';
            };
            item.appendChild(label);
            item.appendChild(hijos);
        }
        contenedor.appendChild(item);
    });
}

async function verArchivo(archivo, elementoClick) {
    const viewer = document.getElementById('explorerViewer');
    const ext    = archivo.extension || 'txt';

    // Marcar activo
    document.querySelectorAll('.tree-file').forEach(el => el.classList.remove('active'));
    if (elementoClick) elementoClick.classList.add('active');

    // Imágenes — usar URL directo en img tag (no fetch, evita CORS)
    if (['png','jpg','jpeg','gif','webp','svg'].includes(ext)) {
        viewer.innerHTML = `
            <div class="viewer-header">
                <span class="viewer-path">${archivo.ruta}</span>
                <span class="viewer-lang">${ext.toUpperCase()}</span>
            </div>
            <div style="padding:20px;text-align:center;color:#64748B;">
                <img src="${archivo.url}" style="max-width:100%;max-height:400px;border-radius:8px;" onerror="this.style.display='none';this.nextSibling.style.display='block'">
                <p style="display:none;">No se puede previsualizar la imagen.</p>
            </div>`;
        return;
    }

    // Archivos binarios — solo link de descarga
    if (['zip','pdf','docx','xlsx','exe','dll','jar'].includes(ext)) {
        viewer.innerHTML = `
            <div class="viewer-header">
                <span class="viewer-path">${archivo.ruta}</span>
            </div>
            <div style="padding:40px;text-align:center;color:#64748B;">
                <p>Archivo binario — no se puede previsualizar.</p>
                <a href="${archivo.url}" target="_blank" class="btn-descargar-zip" style="display:inline-block;margin-top:12px;">Descargar archivo</a>
            </div>`;
        return;
    }

    // Mostrar cargando
    viewer.innerHTML = `
        <div class="viewer-header">
            <span class="viewer-path">${archivo.ruta}</span>
            <span class="viewer-lang">${getLang(ext).toUpperCase()}</span>
        </div>
        <div style="padding:20px;color:#64748B;font-size:13px;">Cargando...</div>`;

    try {
        // Usar getBlob del SDK de Firebase (evita CORS)
        const storageRef = ref(storage, `entregas/${postulacionId}/archivos/${archivo.ruta}`);
        const blob = await getBlob(storageRef);
        const text = await blob.text();
        const lang = getLang(ext);

        viewer.innerHTML = `
            <div class="viewer-header">
                <span class="viewer-path">${archivo.ruta}</span>
                <span class="viewer-lang">${lang.toUpperCase()}</span>
            </div>
            <pre class="viewer-pre"><code class="language-${lang} hljs">${escapeHtml(text)}</code></pre>`;

        if (window.hljs) {
            viewer.querySelectorAll('code').forEach(el => hljs.highlightElement(el));
        }
    } catch (e) {
        console.error('Error cargando archivo:', e);
        viewer.innerHTML = `
            <div class="viewer-header">
                <span class="viewer-path">${archivo.ruta}</span>
            </div>
            <div style="padding:20px;color:#EF4444;font-size:13px;">
                Error al cargar el archivo. Intenta de nuevo.
            </div>`;
    }
}

function escapeHtml(text) {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

function getIcono(ext) {
    const m = { js:'🟨', ts:'🔷', py:'🐍', java:'☕', html:'🌐', css:'🎨',
                json:'📋', md:'📝', php:'🐘', cpp:'⚙️', c:'⚙️', sql:'🗄️',
                txt:'📄', png:'🖼️', jpg:'🖼️', svg:'🖼️', sh:'💻' };
    return m[ext] || '📄';
}

function getLang(ext) {
    const m = { js:'javascript', ts:'typescript', py:'python', java:'java',
                html:'html', css:'css', json:'json', md:'markdown', php:'php',
                cpp:'cpp', c:'c', sql:'sql', xml:'xml', yaml:'yaml',
                yml:'yaml', sh:'bash', txt:'plaintext' };
    return m[ext] || 'plaintext';
}