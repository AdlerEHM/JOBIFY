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

// --- 1. CARGAR PROYECTOS EN EL GRID ---
let todosLosProyectos = []; // Guardaremos los proyectos aquí

async function cargarProyectos() {
    const container = document.getElementById('projectsContainer');
    if (!container) return;

    try {
        const q = query(collection(db, "proyectos"), where("estado", "==", "activo"));
        const snap = await getDocs(q);
        
        todosLosProyectos = []; // Limpiar
        snap.forEach(doc => {
            todosLosProyectos.push({ id: doc.id, ...doc.data() });
        });

        renderizarProyectos(todosLosProyectos); // Mostrar todos al inicio
    } catch (error) { console.error("Error:", error); }
}

// Esta función se encarga de DIBUJAR las tarjetas en el HTML
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
            <button class="btn-main btn-view-more" data-id="${data.id}" style="padding: 8px 16px; font-size: 13px;">Ver más</button>
        `;
        container.appendChild(card);
    });

    // Re-vincular botones de "Ver más"
    document.querySelectorAll('.btn-view-more').forEach(btn => {
        btn.onclick = () => verDetalles(btn.getAttribute('data-id'));
    });
}

// LA MAGIA: Filtrar la lista local
function filtrarAhorra() {
    const presupuestoMax = parseInt(document.getElementById('budgetRange').value);
    const checksMarcados = Array.from(document.querySelectorAll('.filter-check:checked'));
    
    const filtros = {
        nivel: checksMarcados.filter(c => c.dataset.tipo === "nivel").map(c => c.value),
        duracion: checksMarcados.filter(c => c.dataset.tipo === "duracion").map(c => c.value)
    };

    const resultados = todosLosProyectos.filter(p => {
        // 1. Filtro Presupuesto
        const cumplePresupuesto = p.presupuesto <= presupuestoMax;
        
        // 2. Filtro Nivel
        const cumpleNivel = filtros.nivel.length === 0 || filtros.nivel.includes(p.nivel);

        // 3. Filtro Duración
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
    const btn = document.getElementById('btnApply');
    btn.innerText = "Postularme ahora"; // Resetear texto
    btn.disabled = false; // Habilitar
    btn.style.backgroundColor = ""; // Resetear color
    const modal = document.getElementById('projectModal');
    try {
        const docSnap = await getDoc(doc(db, "proyectos", id));
        if (docSnap.exists()) {
            const data = docSnap.data();
            document.getElementById('modalTitle').innerText = data.titulo;
            document.getElementById('modalBudget').innerText = `$${data.presupuesto} USD`;
            document.getElementById('modalLevel').innerText = data.nivel;
            document.getElementById('modalDuration').innerText = `${data.duracionSemanas} semanas`;
            document.getElementById('modalDesc').innerText = data.descripcion;
            
            const tagsCont = document.getElementById('modalTags');
            tagsCont.innerHTML = "";
            if (data.tags) data.tags.forEach(t => tagsCont.innerHTML += `<span class="tag">${t}</span>`);

            modal.style.display = "flex";
            document.getElementById('btnApply').setAttribute('data-id', id);
        }
    } catch (error) { console.error(error); }
}

// Cerrar Modal
document.getElementById('closeModal').onclick = () => {
    document.getElementById('projectModal').style.display = "none";
};

// --- 3. MENÚ DE PERFIL (DROPDOWN) ---
const trigger = document.getElementById('profileTrigger');
const dropdown = document.getElementById('profileDropdown');

trigger.onclick = (e) => {
    e.stopPropagation();
    dropdown.classList.toggle('active');
};

// Cerrar todo al hacer clic fuera (Dropdown y Modal)
window.onclick = (event) => {
    if (event.target === document.getElementById('projectModal')) {
        document.getElementById('projectModal').style.display = "none";
    }
    if (!trigger.contains(event.target)) {
        dropdown.classList.remove('active');
    }
};

// --- 4. CONTROL DE SESIÓN (ÚNICO Y CORREGIDO) ---
onAuthStateChanged(auth, async (user) => {
    if (user) {
        const userSnap = await getDoc(doc(db, "usuarios", user.uid));
        
        if (userSnap.exists()) {
            // Aquí creamos la variable 'data' que usaremos para todo
            const data = userSnap.data(); 
            const initial = (data.nombre || "U").charAt(0).toUpperCase();

            // 1. Lógica para Empresa (Cargar botón y lista de candidatos)
            if (data.rol === "Empresa") {
                document.getElementById('exclusiveEmpresa').style.display = "block";
                document.getElementById('companyApplicants').style.display = "block";
                cargarCandidatosParaEmpresa(user.uid);
            }

            // 2. Badge de Rol
            const roleBadge = document.getElementById('roleBadge');
            if (roleBadge) {
                roleBadge.innerText = data.rol;
                roleBadge.className = 'role-badge ' + (data.rol === "Programador" ? "prog" : "emp");
            }

            // 3. Foto o Inicial en la barra superior
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

            // 4. Info en el Dropdown
            document.getElementById('menuName').innerText = data.nombre || "Usuario";
            document.getElementById('menuEmail').innerText = user.email;
            document.getElementById('menuInitial').innerText = initial;

            // 5. Cargar los proyectos
            cargarProyectos();
        }
    } else {
        window.location.href = "index.html";
    }
});

// Escuchar el slider de presupuesto
document.getElementById('budgetRange').addEventListener('input', (e) => {
    document.getElementById('budgetValue').innerText = `$${e.target.value}`;
    filtrarAhorra();
});

// Escuchar todos los checkboxes
document.querySelectorAll('.filter-check').forEach(check => {
    check.addEventListener('change', filtrarAhorra);
});

// Cerrar Sesión
document.getElementById('btnLogout').onclick = () => signOut(auth);
// --- LÓGICA DE POSTULACIÓN ---
document.getElementById('btnApply').onclick = async () => {
    const user = auth.currentUser;
    const btn = document.getElementById('btnApply');
    const proyectoId = btn.getAttribute('data-id');

    // 1. Verificación de seguridad básica
    if (!user) return alert("Debes iniciar sesión para postularte.");

    try {
        // 2. Traer info del usuario para saber su nombre y rol
        const userSnap = await getDoc(doc(db, "usuarios", user.uid));
        const userData = userSnap.data();

        if (userData.rol !== "Programador") {
            return alert("Solo los programadores pueden postularse a proyectos.");
        }

        const proyectoSnap = await getDoc(doc(db, "proyectos", proyectoId));
        const proyectoData = proyectoSnap.data();

        // 3. Verificar si YA se postuló (evitar duplicados)
        const q = query(
            collection(db, "postulaciones"), 
            where("proyectoId", "==", proyectoId),
            where("programadorId", "==", user.uid)
        );
        const existe = await getDocs(q);
        
        if (!existe.empty) {
            btn.innerText = "Ya te postulaste";
            btn.disabled = true;
            return alert("Ya enviaste tu solicitud para este proyecto.");
        }

        // 4. Guardar la postulación
        await addDoc(collection(db, "postulaciones"), {
            proyectoId: proyectoId,
            empresaId: proyectoData.empresaId,
            programadorId: user.uid,
            nombreProgramador: userData.nombre || "Sin nombre",
            fotoProgramador: userData.foto || "",
            fecha: new Date().toISOString(),
            estado: "pendiente"
        });

        // 5. Feedback visual
        btn.innerText = "¡Postulación Enviada!";
        btn.style.backgroundColor = "#1E8E3E"; // Verde de éxito
        btn.disabled = true;

        setTimeout(() => {
            document.getElementById('projectModal').style.display = "none";
        }, 1500);

    } catch (error) {
        alert("Error al postularse: " + error.message);
    }
};



async function cargarCandidatosParaEmpresa(empresaId) {
    const listCont = document.getElementById('applicantsList');
    if (!listCont) return;

    try {
        //Filtramos para que la empresa solo vea SUS candidatos
        const q = query(collection(db, "postulaciones"), where("empresaId", "==", empresaId));
        const snap = await getDocs(q);

        
        if (snap.empty) {
            listCont.innerHTML = `<p style="font-size: 12px; color: #999;">No hay postulaciones aún.</p>`;
            return;
        }

        listCont.innerHTML = ""; 

        snap.forEach(docSnap => {
            const postu = docSnap.data();
            const id = docSnap.id;
            
            // Solo mostramos las que están "pendiente"
            if (postu.estado === "pendiente") {
                listCont.innerHTML += `
                    <div class="applicant-card" id="card-${id}">
                        <img src="${postu.fotoProgramador || 'https://via.placeholder.com/35'}" alt="Foto">
                        <div class="applicant-info">
                            <h5>${postu.nombreProgramador}</h5>
                            <div class="applicant-actions">
                                <button class="btn-approve" onclick="gestionarPostulacion('${id}', 'aceptado')">✔</button>
                                <button class="btn-reject" onclick="gestionarPostulacion('${id}', 'rechazado')">✖</button>
                            </div>
                        </div>
                    </div>
                `;
            }
        });
    } catch (e) { console.error("Error cargando candidatos:", e); }
}
// Función global para que los botones en el HTML puedan llamarla
window.gestionarPostulacion = async (id, nuevoEstado) => {
    try {
        const postuRef = doc(db, "postulaciones", id);
        
        // 1. ¡ESTO ES LO QUE FALTABA!: Guardar el cambio real en la base de datos
        await updateDoc(postuRef, { estado: nuevoEstado });

        // 2. Traer la postulación para saber a qué programador notificar
        const postuSnap = await getDoc(postuRef);
        const postuData = postuSnap.data();

        // 3. Crear la notificación para el programador
        await addDoc(collection(db, "notificaciones"), {
            para: postuData.programadorId, 
            mensaje: `Tu postulación para el proyecto ha sido ${nuevoEstado}`,
            fecha: new Date().toISOString(),
            leido: false
        });

        // 4. Efecto visual
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