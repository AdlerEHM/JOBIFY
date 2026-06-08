import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
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
let terminoBusqueda   = '';

// --- 1. CARGAR PROYECTOS ---
async function cargarProyectos() {
    const container = document.getElementById('projectsContainer');
    if (!container) return;
    try {
        const q = query(collection(db, "proyectos"), where("estado", "==", "activo"));
        const snap = await getDocs(q);
        const proyectosBrutos = [];
        snap.forEach(doc => {
            proyectosBrutos.push({ id: doc.id, ...doc.data() });
        });

        // FIX: excluir proyectos que ya tienen postulación completada
        // o candidato aceptado con contrato firmado por ambas partes
        todosLosProyectos = [];
        for (const proyecto of proyectosBrutos) {
            const postuSnap = await getDocs(query(
                collection(db, "postulaciones"),
                where("proyectoId", "==", proyecto.id),
                where("estadoProyecto", "==", "completado")
            ));
            if (!postuSnap.empty) continue;

            const aceptadoSnap = await getDocs(query(
                collection(db, "postulaciones"),
                where("proyectoId", "==", proyecto.id),
                where("estado", "==", "aceptado")
            ));
            const tieneAceptadoFirmado = aceptadoSnap.docs.some(d => {
                const data = d.data();
                return data.contratoFirmadoEmpresa && data.contratoFirmadoProgramador;
            });
            if (!tieneAceptadoFirmado) {
                todosLosProyectos.push(proyecto);
            }
        }

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

    const termino = terminoBusqueda.toLowerCase().trim();

    const resultados = todosLosProyectos.filter(p => {
        const cumplePresupuesto = Number(p.presupuesto) <= presupuestoMax;
        const cumpleNivel = filtros.nivel.length === 0 || filtros.nivel.includes(p.nivel);
        let cumpleDuracion = true;
        if (filtros.duracion.length > 0) {
            cumpleDuracion = filtros.duracion.some(val => {
                const semanas = Number(p.duracionSemanas);
                if (val === "1") return semanas <= 2;
                if (val === "4") return semanas > 2 && semanas <= 6;
                if (val === "5") return semanas > 6;
                return false;
            });
        }
        // Búsqueda por texto: título, descripción y tags
        let cumpleBusqueda = true;
        if (termino) {
            const enTitulo = (p.titulo || '').toLowerCase().includes(termino);
            const enDesc   = (p.descripcion || '').toLowerCase().includes(termino);
            const enTags   = (p.tags || []).some(t => t.toLowerCase().includes(termino));
            cumpleBusqueda = enTitulo || enDesc || enTags;
        }
        return cumplePresupuesto && cumpleNivel && cumpleDuracion && cumpleBusqueda;
    });

    renderizarProyectos(resultados);
}

// --- 2. MODAL DE DETALLES ---
async function verDetalles(id) {
    const user = auth.currentUser;
    const btnApply = document.getElementById('btnApply');

    btnApply.innerText = "Postularme ahora";
    btnApply.disabled = false;
    btnApply.style.backgroundColor = "";
    btnApply.style.display = "block";
    btnApply.onclick = handlePostulacion;

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
                        const esCompletado = postulacion.estadoProyecto === 'completado';

                        if (esCompletado) {
                            btnApply.style.display = 'none';
                            const btnVal = document.createElement('button');
                            btnVal.id = 'btnWorkspaceModal';
                            btnVal.style.cssText = 'width:100%; padding:13px; background:#4F46E5; color:white; border:none; border-radius:8px; font-weight:700; font-size:14px; cursor:pointer; margin-bottom:4px;';
                            btnVal.innerText = 'Ver workspace del proyecto';
                            btnVal.onclick = () => window.location.href = `workspace.html?postulacionId=${postulacion.id}`;
                            modalFooter.insertBefore(btnVal, modalFooter.firstChild);
                        } else {
                            btnApply.style.display = 'none';
                            const btnWorkspace = document.createElement('button');
                            btnWorkspace.id = 'btnWorkspaceModal';
                            btnWorkspace.style.cssText = 'width:100%; padding:13px; background:#2563EB; color:white; border:none; border-radius:8px; font-weight:700; font-size:14px; cursor:pointer; margin-bottom:4px;';
                            btnWorkspace.innerText = '💬 Ir al Workspace';
                            btnWorkspace.onclick = () => window.location.href = `workspace.html?postulacionId=${postulacion.id}`;
                            modalFooter.insertBefore(btnWorkspace, modalFooter.firstChild);
                        }

                    } else if (postulacion.estado === 'aceptado' && !ambosFirmaron) {
                        btnApply.innerText = '📄 Ir a firmar el contrato';
                        btnApply.style.backgroundColor = '#10B981';
                        btnApply.onclick = () => window.location.href = `contrato.html?postulacionId=${postulacion.id}`;

                    } else if (postulacion.estado === 'pendiente') {
                        btnApply.innerText = '⏳ Postulación en revisión';
                        btnApply.disabled = true;
                        btnApply.style.backgroundColor = '#D97706';

                    } else if (postulacion.estado === 'rechazado') {
                        btnApply.innerText = '❌ Postulación rechazada';
                        btnApply.disabled = true;
                        btnApply.style.backgroundColor = '#DC2626';
                    }
                }
            }

            if (data.empresaId === user.uid) {
                btnApply.innerText = 'Tu proyecto publicado';
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

window.onclick = (event) => {
    if (event.target === document.getElementById('projectModal')) {
        document.getElementById('projectModal').style.display = "none";
    }
};

// --- 4. CONTROL DE SESIÓN ---
onAuthStateChanged(auth, async (user) => {
    if (user) {
        const userSnap = await getDoc(doc(db, "usuarios", user.uid));
        if (userSnap.exists()) {
            const data = userSnap.data();

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

            import('./navbar.js').then(m => m.iniciarNavbar());

            cargarProyectos();
            cargarWorkspaceSidebar(user.uid, data.rol);
        }
    } else {
        window.location.href = "index.html";
    }
});

document.getElementById('budgetRange').addEventListener('input', (e) => {
    document.getElementById('budgetValue').innerText = `$${e.target.value}`;
    filtrarAhorra();
});

document.querySelectorAll('.filter-check').forEach(check => {
    check.addEventListener('change', filtrarAhorra);
});

// Buscador por texto
document.getElementById('searchInput').addEventListener('input', (e) => {
    terminoBusqueda = e.target.value;
    const btnClear = document.getElementById('btnClearSearch');
    if (btnClear) btnClear.style.display = terminoBusqueda ? 'block' : 'none';
    filtrarAhorra();
});

document.getElementById('btnClearSearch').addEventListener('click', () => {
    document.getElementById('searchInput').value = '';
    terminoBusqueda = '';
    document.getElementById('btnClearSearch').style.display = 'none';
    filtrarAhorra();
});

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

        // MÓDULO 6.4: Bloquear postulación si el usuario está sancionado
        if (userData.sancionado) {
            const pendientes = 7 - (userData.proyectosRecuperacion || 0);
            return alert(`Tu cuenta tiene restricciones temporales por valoraciones negativas consecutivas. Debes completar ${pendientes} proyecto${pendientes !== 1 ? 's' : ''} más con buenas valoraciones para postularte de nuevo.`);
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

        // FIX: si se aceptó a un candidato, rechazar automáticamente los demás
        // y marcar el proyecto como "en_proceso" para que deje de aparecer en el dashboard
        if (nuevoEstado === 'aceptado') {
            // Rechazar todas las demás postulaciones pendientes del mismo proyecto
            const otrasSnap = await getDocs(query(
                collection(db, "postulaciones"),
                where("proyectoId", "==", postuData.proyectoId),
                where("estado", "==", "pendiente")
            ));
            for (const otraDoc of otrasSnap.docs) {
                if (otraDoc.id === id) continue;
                await updateDoc(doc(db, "postulaciones", otraDoc.id), { estado: "rechazado" });
                await addDoc(collection(db, "notificaciones"), {
                    para: otraDoc.data().programadorId,
                    mensaje: `Tu postulación para el proyecto fue rechazada porque se seleccionó a otro candidato.`,
                    fecha: new Date().toISOString(),
                    leido: false
                });
            }
            // Marcar proyecto como en_proceso para que salga del dashboard
            await updateDoc(doc(db, "proyectos", postuData.proyectoId), { estado: "en_proceso" });
        }

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

// --- WORKSPACE EN SIDEBAR ---
async function cargarWorkspaceSidebar(uid, rol) {
    const cont = document.getElementById('workspaceList');
    if (!cont) return;

    try {
        let postulaciones = [];

        if (rol === 'Programador') {
            const snap = await getDocs(
                query(collection(db, "postulaciones"),
                    where("programadorId", "==", uid),
                    where("estado", "==", "aceptado"))
            );
            postulaciones = snap.docs.map(d => ({ id: d.id, ...d.data() }))
                .filter(p => p.contratoFirmadoEmpresa && p.contratoFirmadoProgramador
                          && p.estadoProyecto !== 'baja');
            // Deduplicar por proyectoId
            const _vistos = new Set();
            postulaciones = postulaciones.filter(p => {
                if (_vistos.has(p.proyectoId)) return false;
                _vistos.add(p.proyectoId);
                return true;
            });
        } else {
            const snapProy = await getDocs(
                query(collection(db, "proyectos"), where("empresaId", "==", uid))
            );
            for (const d of snapProy.docs) {
                const snapPostu = await getDocs(
                    query(collection(db, "postulaciones"),
                        where("proyectoId", "==", d.id),
                        where("estado", "==", "aceptado"))
                );
                snapPostu.docs.forEach(pd => {
                    const p = { id: pd.id, ...pd.data(), proyectoTitulo: d.data().titulo };
                    if (p.contratoFirmadoEmpresa && p.contratoFirmadoProgramador && p.estadoProyecto !== 'baja')
                        postulaciones.push(p);
                });
            }
        }

        if (postulaciones.length === 0) {
            cont.innerHTML = `<p style="font-size:12px;color:#999;">Sin proyectos activos.</p>`;
            return;
        }

        cont.innerHTML = '';
        let alguno = false;

        for (const p of postulaciones) {
            const esCompletado = p.estadoProyecto === 'completado';

            // ── FIX: verificar si ya valoró antes de mostrar el botón "Valorar" ──
            let yaValoro = false;
            if (esCompletado) {
                const rolKey  = rol === 'Empresa' ? 'empresa' : 'programador';
                const valSnap = await getDoc(doc(db, "valoraciones", `${p.id}_${rolKey}`));
                yaValoro = valSnap.exists();
            }

            // Si ya valoró y el proyecto está completado → no mostrar en sidebar
            if (esCompletado && yaValoro) continue;

            alguno = true;
            const btn = document.createElement('button');

            if (esCompletado && !yaValoro) {
                // Completado pero pendiente valorar
                btn.className = 'btn-workspace-sidebar';
                btn.innerHTML = `
                    <span class="ws-dot" style="background:#F59E0B;"></span>
                    <span class="ws-titulo">${p.proyectoTitulo || 'Proyecto'}</span>
                    <span style="font-size:10px;color:#D97706;font-weight:700;white-space:nowrap;">⭐ Valorar</span>`;
                btn.onclick = () => window.location.href = `valoracion.html?postulacionId=${p.id}`;
            } else {
                // Workspace activo
                btn.className = 'btn-workspace-sidebar';
                btn.innerHTML = `
                    <span class="ws-dot"></span>
                    <span class="ws-titulo">${p.proyectoTitulo || 'Proyecto'}</span>
                    <span class="ws-arrow">→</span>`;
                btn.onclick = () => window.location.href = `workspace.html?postulacionId=${p.id}`;
            }

            cont.appendChild(btn);
        }

        if (!alguno) {
            cont.innerHTML = `<p style="font-size:12px;color:#999;">Sin proyectos activos.</p>`;
        }

    } catch (e) { console.error("Error cargando workspace sidebar:", e); }
}