import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, doc, getDoc, collection, addDoc, updateDoc, deleteDoc,
         query, where, orderBy, onSnapshot, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

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

// ID de la postulación desde la URL
const urlParams = new URLSearchParams(window.location.search);
const postulacionId = urlParams.get('postulacionId');
window.postulacionIdGlobal = postulacionId;

if (!postulacionId) {
    alert("Workspace no encontrado.");
    window.location.href = "dashboard.html";
}

let postulacionData = null;
let proyectoData = null;
let usuarioActual = null;
let rolActual = null;
let archivoChat = null;
let unsubChat = null;

// ─── INICIALIZACIÓN ───
onAuthStateChanged(auth, async (user) => {
    if (!user) { window.location.href = "index.html"; return; }
    usuarioActual = user;

    // Cargar datos de la postulación
    const postuSnap = await getDoc(doc(db, "postulaciones", postulacionId));
    if (!postuSnap.exists()) {
        alert("Postulación no encontrada.");
        window.location.href = "dashboard.html";
        return;
    }
    postulacionData = postuSnap.data();

    // Verificar que el usuario pertenece a esta postulación
    if (user.uid !== postulacionData.empresaId && user.uid !== postulacionData.programadorId) {
        alert("No tienes acceso a este workspace.");
        window.location.href = "dashboard.html";
        return;
    }

    // Cargar datos del proyecto
    const proySnap = await getDoc(doc(db, "proyectos", postulacionData.proyectoId));
    proyectoData = proySnap.data();

    // Datos del usuario actual
    const userSnap = await getDoc(doc(db, "usuarios", user.uid));
    const userData = userSnap.data();
    rolActual = userData.rol;

    // Badge de rol
    const roleBadge = document.getElementById('roleBadge');
    roleBadge.innerText = rolActual;
    roleBadge.className = 'role-badge ' + (rolActual === 'Programador' ? 'prog' : 'emp');

    // Título del proyecto
    document.getElementById('proyectoTitulo').innerText = proyectoData?.titulo || 'Proyecto';
    document.title = `Jobify - ${proyectoData?.titulo || 'Workspace'}`;

    // Ocultar loading
    document.getElementById('loadingState').style.display = 'none';

    // Verificar si ambos firmaron el contrato
    const ambosfirmaron = postulacionData.contratoFirmadoEmpresa && postulacionData.contratoFirmadoProgramador;

    if (!ambosirmaron) {
        document.getElementById('chatBloqueado').style.display = 'flex';
        return;
    }

    // Mostrar workspace
    document.getElementById('workspaceMain').style.display = 'flex';
    iniciarChat();
    iniciarCalendario();
    iniciarTareas();
    configurarTabs();
});

// ─── TABS ───
function configurarTabs() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById(`tab-${btn.dataset.tab}`).classList.add('active');
        });
    });
}

// ─── CHAT ───
function iniciarChat() {
    // Calcular expiración del chat (duración del proyecto + 7 días)
    if (proyectoData?.duracionSemanas && postulacionData.fechaInicio) {
        const inicio = new Date(postulacionData.fechaInicio);
        const diasProyecto = proyectoData.duracionSemanas * 7;
        const expiry = new Date(inicio.getTime() + (diasProyecto + 7) * 86400000);
        document.getElementById('chatExpiry').innerText = expiry.toLocaleDateString('es-MX', {
            day: '2-digit', month: 'long', year: 'numeric'
        });
    } else {
        document.getElementById('chatExpiry').innerText = 'Según duración del proyecto + 7 días';
    }

    // Escuchar mensajes en tiempo real con onSnapshot
    const msgsRef = collection(db, "postulaciones", postulacionId, "mensajes");
    const q = query(msgsRef, orderBy("fecha", "asc"));

    unsubChat = onSnapshot(q, (snap) => {
        const container = document.getElementById('chatMessages');
        container.innerHTML = "";

        let lastDate = "";

        snap.forEach(docSnap => {
            const msg = docSnap.data();
            const esMio = msg.autorId === usuarioActual.uid;

            const fechaMsg = msg.fecha?.toDate ? msg.fecha.toDate() : new Date(msg.fecha);
            const fechaStr = fechaMsg.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });

            // Separador de fecha
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
                    <span class="msg-time">${hora}</span>
                `;
            } else {
                bubble.innerHTML = `
                    <div class="msg-sender">${esMio ? 'Tú' : msg.autorNombre}</div>
                    <div class="msg-text">${msg.texto}</div>
                    <span class="msg-time">${hora}</span>
                `;
            }

            container.appendChild(bubble);
        });

        // Scroll al último mensaje
        container.scrollTop = container.scrollHeight;
    });

    // Enviar mensaje con Enter
    const input = document.getElementById('chatInput');
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            enviarMensaje();
        }
    });

    // Auto-resize textarea
    input.addEventListener('input', () => {
        input.style.height = 'auto';
        input.style.height = Math.min(input.scrollHeight, 120) + 'px';
    });

    document.getElementById('btnSendMsg').onclick = enviarMensaje;

    // Adjuntar archivo en chat
    document.getElementById('chatFileInput').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        archivoChat = file;
        const preview = document.getElementById('filePreview');
        preview.style.display = 'flex';
        preview.innerHTML = `📎 ${file.name} <span style="cursor:pointer; margin-left:auto; color:var(--danger);" id="removeFileChat">✕</span>`;
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
            // Subir archivo
            const storageRef = ref(storage, `chats/${postulacionId}/${Date.now()}_${archivoChat.name}`);
            await uploadBytes(storageRef, archivoChat);
            const url = await getDownloadURL(storageRef);

            await addDoc(collection(db, "postulaciones", postulacionId, "mensajes"), {
                tipo: 'archivo',
                archivoUrl: url,
                archivoNombre: archivoChat.name,
                autorId: usuarioActual.uid,
                autorNombre: userData.nombre || 'Usuario',
                fecha: serverTimestamp()
            });

            archivoChat = null;
            document.getElementById('chatFileInput').value = '';
            document.getElementById('filePreview').style.display = 'none';
        }

        if (texto) {
            await addDoc(collection(db, "postulaciones", postulacionId, "mensajes"), {
                tipo: 'texto',
                texto: texto,
                autorId: usuarioActual.uid,
                autorNombre: userData.nombre || 'Usuario',
                fecha: serverTimestamp()
            });
        }

        input.value = '';
        input.style.height = 'auto';

    } catch (error) {
        alert("Error al enviar mensaje: " + error.message);
    }
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
    const hitos = plan.hitos || [];
    const estado = plan.estado || 'borrador';
    const planBloqueado = estado === 'aceptado';

    // Estado del plan
    const estadoEl = document.getElementById('planEstado');
    if (planBloqueado) {
        estadoEl.className = 'plan-estado bloqueado';
        estadoEl.innerText = '🔒 Plan de trabajo aceptado y bloqueado por ambas partes.';
    } else if (estado === 'propuesto') {
        estadoEl.className = 'plan-estado pendiente';
        estadoEl.innerText = '⏳ Plan propuesto — esperando aceptación de la otra parte.';
    } else {
        estadoEl.className = '';
        estadoEl.innerText = '';
    }

    // Mostrar/ocultar formulario
    document.getElementById('formHito').style.display = planBloqueado ? 'none' : 'block';

    // Renderizar hitos
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
                    <div class="hito-fecha">${new Date(hito.fecha).toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' })}</div>
                </div>
                ${!planBloqueado ? `<button class="btn-eliminar-hito" data-index="${i}">🗑️</button>` : ''}
            `;
            lista.appendChild(item);
        });

        // Eliminar hito
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

    // Acciones del plan
    const acciones = document.getElementById('accionesPlan');
    acciones.innerHTML = '';

    if (!planBloqueado && hitos.length > 0) {
        acciones.style.display = 'flex';

        if (estado !== 'propuesto') {
            const btnProponer = document.createElement('button');
            btnProponer.className = 'btn-proponer';
            btnProponer.innerText = '📤 Proponer plan a la otra parte';
            btnProponer.onclick = async () => {
                await updateDoc(doc(db, "postulaciones", postulacionId, "plan", "datos"), { estado: 'propuesto', propuestoPor: usuarioActual.uid });
            };
            acciones.appendChild(btnProponer);
        }

        // Solo puede aceptar quien NO propuso
        if (estado === 'propuesto' && plan.propuestoPor !== usuarioActual.uid) {
            const btnAceptar = document.createElement('button');
            btnAceptar.className = 'btn-aceptar-plan';
            btnAceptar.innerText = '✅ Aceptar plan de trabajo';
            btnAceptar.onclick = async () => {
                await updateDoc(doc(db, "postulaciones", postulacionId, "plan", "datos"), { estado: 'aceptado' });
                alert('¡Plan de trabajo bloqueado! Las fechas han quedado confirmadas.');
            };
            acciones.appendChild(btnAceptar);
        }
    } else {
        acciones.style.display = 'none';
    }
}

async function agregarHito() {
    const nombre = document.getElementById('hitoNombre').value.trim();
    const fecha = document.getElementById('hitoFecha').value;

    if (!nombre || !fecha) return alert("Completa el nombre y la fecha del hito.");

    const planRef = doc(db, "postulaciones", postulacionId, "plan", "datos");
    const snap = await getDoc(planRef);

    let planActual = snap.exists() ? snap.data() : { hitos: [], estado: 'borrador' };
    planActual.hitos = planActual.hitos || [];
    planActual.hitos.push({ nombre, fecha });
    planActual.hitos.sort((a, b) => new Date(a.fecha) - new Date(b.fecha));

    if (snap.exists()) {
        await updateDoc(planRef, { hitos: planActual.hitos, estado: 'borrador' });
    } else {
        await addDoc(collection(db, "postulaciones", postulacionId, "plan"), { ...planActual, id: "datos" });
        // Usar setDoc sería mejor, pero con la estructura actual:
        const { setDoc } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
        await setDoc(planRef, planActual);
    }

    document.getElementById('hitoNombre').value = '';
    document.getElementById('hitoFecha').value = '';
}

// ─── TAREAS ───
function iniciarTareas() {
    const tareasRef = collection(db, "postulaciones", postulacionId, "tareas");
    const q = query(tareasRef, orderBy("fecha", "asc"));

    onSnapshot(q, (snap) => {
        const lista = document.getElementById('listaTareas');
        lista.innerHTML = '';

        if (snap.empty) {
            lista.innerHTML = '<p class="empty-msg">No hay tareas aún.</p>';
            return;
        }

        snap.forEach(docSnap => {
            const tarea = docSnap.data();
            const id = docSnap.id;
            const estados = ['no-iniciada', 'en-proceso', 'finalizada'];
            const labels = { 'no-iniciada': 'No iniciada', 'en-proceso': 'En proceso', 'finalizada': 'Finalizada' };
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
                    <div class="tarea-fecha">📅 ${tarea.fecha ? new Date(tarea.fecha).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Sin fecha'}</div>
                </div>
                <span class="tarea-estado-badge ${estadoActual}">${labels[estadoActual]}</span>
            `;
            lista.appendChild(item);
        });

        // Cambiar estado al hacer click en el botón
        lista.querySelectorAll('.tarea-status-btn').forEach(btn => {
            btn.onclick = async () => {
                const id = btn.getAttribute('data-id');
                const estadoActual = btn.getAttribute('data-estado');
                const estados = ['no-iniciada', 'en-proceso', 'finalizada'];
                const siguiente = estados[(estados.indexOf(estadoActual) + 1) % estados.length];
                await updateDoc(doc(db, "postulaciones", postulacionId, "tareas", id), { estado: siguiente });
            };
        });
    });

    // Formulario nueva tarea
    document.getElementById('btnNuevaTarea').onclick = () => {
        document.getElementById('formNuevaTarea').style.display = 'flex';
    };

    document.getElementById('btnCancelarTarea').onclick = () => {
        document.getElementById('formNuevaTarea').style.display = 'none';
        limpiarFormTarea();
    };

    document.getElementById('btnGuardarTarea').onclick = async () => {
        const desc = document.getElementById('tareaDesc').value.trim();
        const objetivo = document.getElementById('tareaObjetivo').value.trim();
        const fecha = document.getElementById('tareaFecha').value;

        if (!desc) return alert("La descripción es obligatoria.");

        await addDoc(collection(db, "postulaciones", postulacionId, "tareas"), {
            descripcion: desc,
            objetivo: objetivo,
            fecha: fecha || null,
            estado: 'no-iniciada',
            creadoPor: usuarioActual.uid,
            creadoEn: serverTimestamp()
        });

        document.getElementById('formNuevaTarea').style.display = 'none';
        limpiarFormTarea();
    };
}

function limpiarFormTarea() {
    document.getElementById('tareaDesc').value = '';
    document.getElementById('tareaObjetivo').value = '';
    document.getElementById('tareaFecha').value = '';
}