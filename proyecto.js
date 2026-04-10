import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, doc, getDoc, collection, addDoc, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
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

const urlParams = new URLSearchParams(window.location.search);
const proyectoId = urlParams.get('id');

if (!proyectoId) {
    alert("Proyecto no encontrado.");
    window.location.href = "dashboard.html";
}

let proyectoData = null;
let archivoSeleccionado = null;

// --- CARGAR DATOS DEL PROYECTO ---
async function cargarProyecto() {
    try {
        const docSnap = await getDoc(doc(db, "proyectos", proyectoId));
        if (!docSnap.exists()) {
            alert("Este proyecto no existe.");
            window.location.href = "dashboard.html";
            return;
        }
        proyectoData = docSnap.data();
        renderizarProyecto(proyectoData);
    } catch (error) {
        console.error("Error cargando proyecto:", error);
    }
}

// --- RENDERIZAR DATOS ---
function renderizarProyecto(data) {
    document.title = `Jobify - ${data.titulo}`;
    document.getElementById('projTitle').innerText = data.titulo;
    document.getElementById('projLevel').innerText = data.nivel || '-';
    document.getElementById('projBudget').innerText = `$${data.presupuesto} USD`;
    document.getElementById('projDuration').innerText = `${data.duracionSemanas} semanas`;

    const fecha = data.fechaPublicacion
        ? new Date(data.fechaPublicacion).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })
        : '-';
    document.getElementById('projDate').innerText = `Publicado: ${fecha}`;

    document.getElementById('quickBudget').innerText = `$${data.presupuesto} USD`;
    document.getElementById('quickDuration').innerText = `${data.duracionSemanas} semanas`;
    document.getElementById('quickLevel').innerText = data.nivel || '-';
    document.getElementById('quickEntrega').innerText = data.modalidadEntrega
        ? data.modalidadEntrega.charAt(0).toUpperCase() + data.modalidadEntrega.slice(1)
        : 'No especificada';

    document.getElementById('projDesc').innerText = data.descripcion || 'Sin descripción.';

    const tagsEl = document.getElementById('projTags');
    tagsEl.innerHTML = '';
    if (data.tags && data.tags.length > 0) {
        data.tags.forEach(t => tagsEl.innerHTML += `<span class="tag">${t}</span>`);
    } else {
        tagsEl.innerHTML = '<span style="color:#999; font-size:13px;">No especificadas</span>';
    }

    const typesEl = document.getElementById('projTypes');
    typesEl.innerHTML = '';
    if (data.tipoProyecto && data.tipoProyecto.length > 0) {
        data.tipoProyecto.forEach(t => typesEl.innerHTML += `<span class="tag-type">${t}</span>`);
    } else {
        typesEl.innerHTML = '<span style="color:#999; font-size:13px;">No especificado</span>';
    }

    document.getElementById('projCategory').innerText = data.categoria || 'General';
    document.getElementById('projEntrega').innerText = data.modalidadEntrega
        ? data.modalidadEntrega.charAt(0).toUpperCase() + data.modalidadEntrega.slice(1)
        : 'No especificada';

    const modalidadesPago = {
        'por-entrega': 'Por cada entrega / hito',
        'periodico': 'Por fecha (15 o 30 días)',
        'unico': 'Pago único al finalizar'
    };
    document.getElementById('projPago').innerText = modalidadesPago[data.modalidadPago] || data.modalidadPago || 'No especificado';
    document.getElementById('projFecha').innerText = fecha;

    // Bug 5 fix: estado dinámico según datos reales
    const estadoEl = document.getElementById('projEstado');
    if (estadoEl) {
        if (data.estado === 'activo') {
            estadoEl.innerText = '🟢 Activo';
            estadoEl.style.color = '#16A34A';
        } else if (data.estado === 'eliminado') {
            estadoEl.innerText = '🔴 Eliminado';
            estadoEl.style.color = '#DC2626';
        } else {
            estadoEl.innerText = '⚪ ' + (data.estado || 'Desconocido');
            estadoEl.style.color = '#888';
        }
    }

    document.getElementById('loadingState').style.display = 'none';
    document.getElementById('mainContent').style.display = 'block';
}

// --- CARGAR EMPRESA ---
async function cargarEmpresa(empresaId) {
    try {
        const empSnap = await getDoc(doc(db, "usuarios", empresaId));
        if (empSnap.exists()) {
            const emp = empSnap.data();
            document.getElementById('companyName').innerText = emp.nombre || 'Empresa';
            const avatar = document.getElementById('companyAvatar');
            if (emp.foto) {
                avatar.innerHTML = `<img src="${emp.foto}" alt="Logo">`;
            } else {
                avatar.innerText = (emp.nombre || 'E').charAt(0).toUpperCase();
            }
        }
    } catch (e) { console.error(e); }
}

// --- CONTROL DE SESIÓN ---
onAuthStateChanged(auth, async (user) => {
    if (!user) { window.location.href = "index.html"; return; }

    await cargarProyecto();
    if (!proyectoData) return;

    if (proyectoData.empresaId) cargarEmpresa(proyectoData.empresaId);

    const userSnap = await getDoc(doc(db, "usuarios", user.uid));
    const userData = userSnap.data();

    const roleBadge = document.getElementById('roleBadge');
    roleBadge.innerText = userData.rol;
    roleBadge.className = 'role-badge ' + (userData.rol === 'Programador' ? 'prog' : 'emp');

    // Dueño del proyecto (empresa)
    if (proyectoData.empresaId === user.uid) {
        document.getElementById('applyForm').style.display = 'none';
        document.getElementById('applyCard').querySelector('.apply-subtitle').style.display = 'none';
        document.getElementById('ownProject').style.display = 'block';
        return;
    }

    // Otra empresa
    if (userData.rol === 'Empresa') {
        document.getElementById('applyForm').style.display = 'none';
        document.getElementById('applyCard').querySelector('h3').innerText = 'Solo programadores pueden postularse';
        document.getElementById('applyCard').querySelector('.apply-subtitle').innerText = 'Tu cuenta es de tipo Empresa.';
        return;
    }

    // Programador: verificar estado de postulación
    const q = query(
        collection(db, "postulaciones"),
        where("proyectoId", "==", proyectoId),
        where("programadorId", "==", user.uid)
    );
    const existe = await getDocs(q);

    if (!existe.empty) {
        const postulacion = { id: existe.docs[0].id, ...existe.docs[0].data() };
        mostrarEstadoPostulacion(postulacion);
        return;
    }

    // No se ha postulado aún — mostrar formulario
    document.getElementById('btnApply').onclick = () => {
        document.getElementById('confirmModal').style.display = 'flex';
    };
    document.getElementById('btnConfirmApply').onclick = () => enviarPostulacion(user, userData);
    document.getElementById('btnCancelModal').onclick = () => {
        document.getElementById('confirmModal').style.display = 'none';
    };
});

// --- MOSTRAR ESTADO SEGÚN POSTULACIÓN ---
function mostrarEstadoPostulacion(postulacion) {
    // Ocultar formulario siempre
    document.getElementById('applyForm').style.display = 'none';

    const ambosFirmaron = postulacion.contratoFirmadoEmpresa && postulacion.contratoFirmadoProgramador;

    if (postulacion.estado === 'rechazado') {
        // Rechazado
        document.getElementById('alreadyApplied').style.display = 'block';
        document.getElementById('alreadyApplied').innerHTML = `
            <span class="check-icon">❌</span>
            <p style="color:#DC2626;">Tu postulación fue rechazada.</p>
            <small>La empresa seleccionó a otro candidato.</small>
        `;

    } else if (postulacion.estado === 'aceptado' && ambosFirmaron) {
        document.getElementById('alreadyApplied').style.display = 'block';

        if (postulacion.estadoProyecto === 'completado') {
            // Proyecto completado → ir a valorar
            document.getElementById('alreadyApplied').innerHTML = `
                <span class="check-icon">✅</span>
                <p style="color:#059669;">¡Proyecto completado!</p>
                <small>El proyecto ha sido finalizado por ambas partes.</small>
                <br>
                <button onclick="window.location.href='valoracion.html?postulacionId=${postulacion.id}'"
                    style="margin-top:14px; padding:12px 20px; background:#10B981; color:white;
                           border:none; border-radius:10px; font-weight:700; font-size:14px;
                           cursor:pointer; width:100%;">
                    ⭐ Dejar valoración
                </button>`;
        } else {
            // Proyecto en curso → ir al workspace
            document.getElementById('alreadyApplied').innerHTML = `
                <span class="check-icon">🚀</span>
                <p style="color:#2563EB;">¡Proyecto en curso!</p>
                <small>El contrato fue firmado por ambas partes.</small>
                <br>
                <button onclick="window.location.href='workspace.html?postulacionId=${postulacion.id}'"
                    style="margin-top:14px; padding:12px 20px; background:var(--primary); color:white;
                           border:none; border-radius:10px; font-weight:700; font-size:14px;
                           cursor:pointer; width:100%;">
                    💬 Ir al Workspace
                </button>`;
        }

    } else if (postulacion.estado === 'aceptado' && !ambosFirmaron) {
        // Aceptado pero falta firmar contrato
        document.getElementById('alreadyApplied').style.display = 'block';
        document.getElementById('alreadyApplied').innerHTML = `
            <span class="check-icon">🎉</span>
            <p style="color:#059669;">¡Fuiste aceptado!</p>
            <small>Falta firmar el contrato para iniciar el proyecto.</small>
            <br>
            <button onclick="window.location.href='contrato.html?postulacionId=${postulacion.id}'"
                style="margin-top:14px; padding:12px 20px; background:#10B981; color:white;
                       border:none; border-radius:10px; font-weight:700; font-size:14px;
                       cursor:pointer; width:100%;">
                📄 Ir a firmar el contrato
            </button>
        `;

    } else {
        // Pendiente (en revisión)
        document.getElementById('alreadyApplied').style.display = 'block';
        document.getElementById('alreadyApplied').innerHTML = `
            <span class="check-icon">⏳</span>
            <p style="color:#D97706;">Postulación en revisión</p>
            <small>La empresa está revisando tu solicitud. Te notificaremos cuando haya una respuesta.</small>
        `;
    }
}

// --- ENVIAR POSTULACIÓN ---
async function enviarPostulacion(user, userData) {
    const btn = document.getElementById('btnConfirmApply');
    btn.innerText = 'Enviando...';
    btn.disabled = true;

    try {
        let archivoUrl = "";
        if (archivoSeleccionado) {
            const storageRef = ref(storage, `propuestas/${proyectoId}/${user.uid}_${archivoSeleccionado.name}`);
            await uploadBytes(storageRef, archivoSeleccionado);
            archivoUrl = await getDownloadURL(storageRef);
        }

        const nota = document.getElementById('applyNote').value.trim();

        await addDoc(collection(db, "postulaciones"), {
            proyectoId: proyectoId,
            empresaId: proyectoData.empresaId,
            programadorId: user.uid,
            nombreProgramador: userData.nombre || "Sin nombre",
            fotoProgramador: userData.foto || "",
            proyectoTitulo: proyectoData.titulo || "Sin título",
            nota: nota,
            archivoUrl: archivoUrl,
            fecha: new Date().toISOString(),
            estado: "pendiente"
        });

        document.getElementById('confirmModal').style.display = 'none';
        document.getElementById('applyForm').style.display = 'none';
        document.getElementById('alreadyApplied').style.display = 'block';
        document.getElementById('alreadyApplied').innerHTML = `
            <span class="check-icon">⏳</span>
            <p style="color:#D97706;">Postulación en revisión</p>
            <small>La empresa está revisando tu solicitud.</small>
        `;

    } catch (error) {
        alert("Error al postularse: " + error.message);
        btn.innerText = 'Sí, postularme';
        btn.disabled = false;
    }
}

// --- MANEJO DE ARCHIVO ---
const fileDrop = document.getElementById('fileDrop');
const fileInput = document.getElementById('fileInput');
const fileSelected = document.getElementById('fileSelected');

fileDrop.addEventListener('click', () => fileInput.click());
fileDrop.addEventListener('dragover', (e) => { e.preventDefault(); fileDrop.classList.add('dragover'); });
fileDrop.addEventListener('dragleave', () => fileDrop.classList.remove('dragover'));
fileDrop.addEventListener('drop', (e) => {
    e.preventDefault();
    fileDrop.classList.remove('dragover');
    const file = e.dataTransfer.files[0];
    if (file) seleccionarArchivo(file);
});
fileInput.addEventListener('change', () => {
    const file = fileInput.files[0];
    if (file) seleccionarArchivo(file);
});

function seleccionarArchivo(file) {
    archivoSeleccionado = file;
    const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
    fileDrop.style.display = 'none';
    fileSelected.style.display = 'flex';
    fileSelected.innerHTML = `📎 ${file.name} <span style="color:#888; font-weight:400; margin-left:auto;">${sizeMB} MB</span>
        <span style="cursor:pointer; margin-left:12px; color:#EF4444;" id="removeFile">✕</span>`;
    document.getElementById('removeFile').onclick = () => {
        archivoSeleccionado = null;
        fileInput.value = '';
        fileDrop.style.display = 'block';
        fileSelected.style.display = 'none';
    };
}

document.getElementById('confirmModal').addEventListener('click', (e) => {
    if (e.target === document.getElementById('confirmModal')) {
        document.getElementById('confirmModal').style.display = 'none';
    }
});