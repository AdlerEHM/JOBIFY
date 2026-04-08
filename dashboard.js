import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, doc, getDoc, collection, getDocs, query, where, addDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

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

let todosLosProyectos = [];

// --- 1. CARGAR PROYECTOS ---
async function cargarProyectos() {
    const container = document.getElementById('projectsContainer');
    if (!container) return;
    try {
        const q = query(collection(db, "proyectos"), where("estado", "==", "activo"));
        const snap = await getDocs(q);
        todosLosProyectos = [];
        snap.forEach(doc => {
            todosLosProyectos.push({ id: doc.id, ...doc.data() });
        });
        renderizarProyectos(todosLosProyectos);
    } catch (error) { console.error("Error:", error); }
}

function renderizarProyectos(lista) {
    const container = document.getElementById('projectsContainer');
    container.innerHTML = "";

    if (lista.length === 0) {
        container.innerHTML = `<p style="grid-column: 1/-1; text-align: center; color: #888;">No se encontraron proyectos con esos filtros.</p>`;
        return;
    }

    lista.forEach(data => {
        const card = document.createElement('div');
        card.className = 'project-card';
        card.style.cursor = 'pointer';
        card.innerHTML = `
            <div class="card-header">
                <div class="company-logo"></div>
                <div class="company-info">
                    <h4>${data.titulo}</h4>
                    <span>$${data.presupuesto} USD</span>
                </div>
            </div>
            <div class="card-tags">
                <span class="tag">${data.nivel}</span>
                <span class="tag">${data.duracionSemanas} semanas</span>
            </div>
        `;
        card.addEventListener('click', () => verDetalles(data.id));
        container.appendChild(card);
    });
}

function filtrarAhorra() {
    const presupuestoMax = parseInt(document.getElementById('budgetRange').value);
    const checksMarcados = Array.from(document.querySelectorAll('.filter-check:checked'));
    const filtros = {
        nivel: checksMarcados.filter(c => c.dataset.tipo === "nivel").map(c => c.value),
        duracion: checksMarcados.filter(c => c.dataset.tipo === "duracion").map(c => c.value)
    };

    const resultados = todosLosProyectos.filter(p => {
        const cumplePresupuesto = p.presupuesto <= presupuestoMax;
        const cumpleNivel = filtros.nivel.length === 0 || filtros.nivel.includes(p.nivel);
        let cumpleDuracion = true;
        if (filtros.duracion.length > 0) {
            cumpleDuracion = filtros.duracion.some(val => {
                if (val === "1") return p.duracionSemanas <= 1;
                if (val === "4") return p.duracionSemanas > 1 && p.duracionSemanas <= 4;
                if (val === "5") return p.duracionSemanas > 4;
                return false;
            });
        }
        return cumplePresupuesto && cumpleNivel && cumpleDuracion;
    });

    renderizarProyectos(resultados);
}

// --- 2. MODAL DE DETALLES ---
async function verDetalles(id) {
    const user = auth.currentUser;
    const btnApply = document.getElementById('btnApply');

    // Resetear botón
    btnApply.innerText = "Postularme ahora";
    btnApply.disabled = false;
    btnApply.style.backgroundColor = "";
    btnApply.style.display = "block";
    btnApply.onclick = handlePostulacion;

    // Resetear/limpiar botón workspace si existía
    const btnWS = document.getElementById('btnWorkspaceModal');
    if (btnWS) btnWS.remove();

    const modal = document.getElementById('projectModal');
    try {
        const docSnap = await getDoc(doc(db, "proyectos", id));
        if (!docSnap.exists()) return;

        const data = docSnap.data();
        document.getElementById('modalTitle').innerText = data.titulo;
        document.getElementById('modalBudget').innerText = `$${data.presupuesto} USD`;
        document.getElementById('modalLevel').innerText = data.nivel;
        document.getElementById('modalDuration').innerText = `${data.duracionSemanas} semanas`;
        document.getElementById('modalDesc').innerText = data.descripcion;

        const tagsCont = document.getElementById('modalTags');
        tagsCont.innerHTML = "";
        if (data.tags) data.tags.forEach(t => tagsCont.innerHTML += `<span class="tag">${t}</span>`);

        // Botón "Ver más"
        const modalFooter = document.querySelector('.modal-footer');
        let btnVerMas = document.getElementById('btnVerMas');
        if (!btnVerMas) {
            btnVerMas = document.createElement('button');
            btnVerMas.id = 'btnVerMas';
            btnVerMas.className = 'btn-main';
            btnVerMas.style.cssText = 'margin-top: 10px; background: white; color: var(--primary); border: 2px solid var(--primary); width: 100%; padding: 12px; border-radius: 8px; font-weight: bold; cursor: pointer;';
            btnVerMas.innerText = 'Ver más';
            modalFooter.appendChild(btnVerMas);
        }
        btnVerMas.onclick = () => window.location.href = `proyecto.html?id=${id}`;

        btnApply.setAttribute('data-id', id);

        // Si hay usuario logueado y es programador, verificar estado de postulación
        if (user) {
            const userSnap = await getDoc(doc(db, "usuarios", user.uid));
            const userData = userSnap.data();

            if (userData.rol === 'Programador') {
                const q = query(
                    collection(db, "postulaciones"),
                    where("proyectoId", "==", id),
                    where("programadorId", "==", user.uid)
                );
                const existe = await getDocs(q);

                if (!existe.empty) {
                    const postulacion = { id: existe.docs[0].id, ...existe.docs[0].data() };
                    const ambosFirmaron = postulacion.contratoFirmadoEmpresa && postulacion.contratoFirmadoProgramador;

                    if (postulacion.estado === 'aceptado' && ambosFirmaron) {
                        // Workspace activo — botón directo
                        btnApply.style.display = 'none';
                        const btnWorkspace = document.createElement('button');
                        btnWorkspace.id = 'btnWorkspaceModal';
                        btnWorkspace.style.cssText = 'width:100%; padding:13px; background:#2563EB; color:white; border:none; border-radius:8px; font-weight:700; font-size:14px; cursor:pointer; margin-bottom:4px;';
                        btnWorkspace.innerText = '💬 Ir al Workspace';
                        btnWorkspace.onclick = () => window.location.href = `workspace.html?postulacionId=${postulacion.id}`;
                        modalFooter.insertBefore(btnWorkspace, modalFooter.firstChild);

                    } else if (postulacion.estado === 'aceptado' && !ambosFirmaron) {
                        // Aceptado pero falta contrato
                        btnApply.innerText = '📄 Ir a firmar el contrato';
                        btnApply.style.backgroundColor = '#10B981';
                        btnApply.onclick = () => window.location.href = `contrato.html?postulacionId=${postulacion.id}`;

                    } else if (postulacion.estado === 'pendiente') {
                        // En revisión
                        btnApply.innerText = '⏳ Postulación en revisión';
                        btnApply.disabled = true;
                        btnApply.style.backgroundColor = '#D97706';

                    } else if (postulacion.estado === 'rechazado') {
                        // Rechazado
                        btnApply.innerText = '❌ Postulación rechazada';
                        btnApply.disabled = true;
                        btnApply.style.backgroundColor = '#DC2626';
                    }
                }
            }

            // Si es la empresa dueña del proyecto
            if (data.empresaId === user.uid) {
                btnApply.innerText = '👁️ Tu proyecto publicado';
                btnApply.disabled = true;
                btnApply.style.backgroundColor = '#64748B';
            }
        }

        modal.style.display = "flex";

    } catch (error) { console.error(error); }
}

// Cerrar Modal
document.getElementById('closeModal').onclick = () => {
    document.getElementById('projectModal').style.display = "none";
};

// --- 3. MENÚ DE PERFIL ---
const trigger = document.getElementById('profileTrigger');
const dropdown = document.getElementById('profileDropdown');

trigger.onclick = (e) => {
    e.stopPropagation();
    dropdown.classList.toggle('active');
};

window.onclick = (event) => {
    if (event.target === document.getElementById('projectModal')) {
        document.getElementById('projectModal').style.display = "none";
    }
    if (!trigger.contains(event.target)) {
        dropdown.classList.remove('active');
    }
};

// --- 4. CONTROL DE SESIÓN ---
onAuthStateChanged(auth, async (user) => {
    if (user) {
        const userSnap = await getDoc(doc(db, "usuarios", user.uid));
        if (userSnap.exists()) {
            const data = userSnap.data();
            const initial = (data.nombre || "U").charAt(0).toUpperCase();

            if (data.rol === "Empresa") {
                document.getElementById('exclusiveEmpresa').style.display = "block";
                document.getElementById('companyApplicants').style.display = "block";
                cargarCandidatosParaEmpresa(user.uid);
            }

            const roleBadge = document.getElementById('roleBadge');
            if (roleBadge) {
                roleBadge.innerText = data.rol;
                roleBadge.className = 'role-badge ' + (data.rol === "Programador" ? "prog" : "emp");
            }

            const userPhoto = document.getElementById('userPhoto');
            const userInitial = document.getElementById('userInitial');
            if (data.foto) {
                userPhoto.src = data.foto;
                userPhoto.style.display = "block";
                userInitial.style.display = "none";
            } else {
                userInitial.innerText = initial;
                userInitial.style.display = "flex";
                userPhoto.style.display = "none";
            }

            document.getElementById('menuName').innerText = data.nombre || "Usuario";
            document.getElementById('menuEmail').innerText = user.email;
            document.getElementById('menuInitial').innerText = initial;

            cargarProyectos();
        }
    } else {
        window.location.href = "index.html";
    }
});

// Slider presupuesto
document.getElementById('budgetRange').addEventListener('input', (e) => {
    document.getElementById('budgetValue').innerText = `$${e.target.value}`;
    filtrarAhorra();
});

// Checkboxes
document.querySelectorAll('.filter-check').forEach(check => {
    check.addEventListener('change', filtrarAhorra);
});

// Cerrar Sesión
document.getElementById('btnLogout').onclick = () => signOut(auth);

// --- LÓGICA DE POSTULACIÓN ---
async function handlePostulacion() {
    const user = auth.currentUser;
    const btn = document.getElementById('btnApply');
    const proyectoId = btn.getAttribute('data-id');
    if (!user) return alert("Debes iniciar sesión para postularte.");

    try {
        const userSnap = await getDoc(doc(db, "usuarios", user.uid));
        const userData = userSnap.data();

        if (userData.rol !== "Programador") {
            return alert("Solo los programadores pueden postularse a proyectos.");
        }

        const proyectoSnap = await getDoc(doc(db, "proyectos", proyectoId));
        const proyectoData = proyectoSnap.data();

        const q = query(
            collection(db, "postulaciones"),
            where("proyectoId", "==", proyectoId),
            where("programadorId", "==", user.uid)
        );
        const existe = await getDocs(q);

        if (!existe.empty) {
            btn.innerText = "⏳ Postulación en revisión";
            btn.disabled = true;
            btn.style.backgroundColor = '#D97706';
            return;
        }

        await addDoc(collection(db, "postulaciones"), {
            proyectoId: proyectoId,
            empresaId: proyectoData.empresaId,
            programadorId: user.uid,
            nombreProgramador: userData.nombre || "Sin nombre",
            fotoProgramador: userData.foto || "",
            proyectoTitulo: proyectoData.titulo || "Sin título",
            fecha: new Date().toISOString(),
            estado: "pendiente"
        });

        btn.innerText = "¡Postulación Enviada!";
        btn.style.backgroundColor = "#1E8E3E";
        btn.disabled = true;

        setTimeout(() => {
            document.getElementById('projectModal').style.display = "none";
        }, 1500);

    } catch (error) {
        alert("Error al postularse: " + error.message);
    }
}

document.getElementById('btnApply').onclick = handlePostulacion;

// --- CANDIDATOS PARA EMPRESA ---
async function cargarCandidatosParaEmpresa(empresaId) {
    const listCont = document.getElementById('applicantsList');
    if (!listCont) return;
    try {
        const q = query(
            collection(db, "postulaciones"),
            where("empresaId", "==", empresaId),
            where("estado", "==", "pendiente")
        );
        const snap = await getDocs(q);

        if (snap.empty) {
            listCont.innerHTML = `<p style="font-size: 12px; color: #999;">No hay postulaciones aún.</p>`;
            return;
        }

        listCont.innerHTML = "";
        snap.forEach(docSnap => {
            const postu = docSnap.data();
            const id = docSnap.id;
            listCont.innerHTML += `
                <div class="applicant-card" id="card-${id}">
                    <img src="${postu.fotoProgramador || 'https://via.placeholder.com/35'}" alt="Foto">
                    <div class="applicant-info">
                        <h5>${postu.nombreProgramador}</h5>
                        <span>${postu.proyectoTitulo || ''}</span>
                        <div class="applicant-actions">
                            <button class="btn-approve" onclick="gestionarPostulacion('${id}', 'aceptado')">✔</button>
                            <button class="btn-reject" onclick="gestionarPostulacion('${id}', 'rechazado')">✖</button>
                        </div>
                    </div>
                </div>
            `;
        });
    } catch (e) { console.error("Error cargando candidatos:", e); }
}

window.gestionarPostulacion = async (id, nuevoEstado) => {
    try {
        const postuRef = doc(db, "postulaciones", id);
        await updateDoc(postuRef, { estado: nuevoEstado });

        const postuSnap = await getDoc(postuRef);
        const postuData = postuSnap.data();

        await addDoc(collection(db, "notificaciones"), {
            para: postuData.programadorId,
            mensaje: `Tu postulación para el proyecto ha sido ${nuevoEstado}`,
            fecha: new Date().toISOString(),
            leido: false
        });

        const card = document.getElementById(`card-${id}`);
        if (card) {
            card.style.opacity = "0";
            card.style.transform = "translateX(20px)";
            setTimeout(() => card.remove(), 300);
        }

        alert(`Candidato ${nuevoEstado} con éxito.`);

    } catch (error) {
        console.error("Error al gestionar:", error);
        alert("Hubo un error al procesar la solicitud.");
    }
};