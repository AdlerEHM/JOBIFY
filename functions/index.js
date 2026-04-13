const { onDocumentCreated, onDocumentUpdated } = require("firebase-functions/v2/firestore");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const admin = require("firebase-admin");
const https = require("https");

admin.initializeApp();
const db = admin.firestore();

// ─── CONFIGURACIÓN EMAILJS ────────────────────────────────────────────────
const EMAILJS_SERVICE_ID   = "service_sq5han5";
const EMAILJS_PUBLIC_KEY   = "bvCwb6Qdnk4UEZ3Gk";
const EMAILJS_PRIVATE_KEY  = "g0rWBwKiqUazPe8r3y-1f";
const TEMPLATE_POSTULACION = "template_xxcagun";
const TEMPLATE_PROYECTO    = "template_kdb93sl";

// ─── FUNCIÓN BASE PARA ENVIAR CORREO ─────────────────────────────────────
function enviarCorreo(templateId, nombre, email, asunto, mensaje) {
    return new Promise((resolve) => {
        if (!email) return resolve();

        const data = JSON.stringify({
            service_id:  EMAILJS_SERVICE_ID,
            template_id: templateId,
            user_id:     EMAILJS_PUBLIC_KEY,
            accessToken: EMAILJS_PRIVATE_KEY,
            template_params: { nombre, to_email: email, asunto, mensaje }
        });

        const options = {
            hostname: "api.emailjs.com",
            path:     "/api/v1.0/email/send",
            method:   "POST",
            headers:  {
                "Content-Type":   "application/json",
                "Content-Length": Buffer.byteLength(data)
            }
        };

        const req = https.request(options, (res) => {
            let body = "";
            res.on("data", chunk => body += chunk);
            res.on("end", () => {
                if (res.statusCode === 200) {
                    console.log(`✅ Correo enviado a ${email}: ${asunto}`);
                } else {
                    console.error(`❌ Error EmailJS ${res.statusCode}: ${body}`);
                }
                resolve();
            });
        });

        req.on("error", (e) => {
            console.error("❌ Error de red:", e);
            resolve();
        });

        req.write(data);
        req.end();
    });
}

// ─── HELPER: obtener datos de usuario ────────────────────────────────────
async function getUsuario(uid) {
    const snap = await db.collection("usuarios").doc(uid).get();
    return snap.exists ? snap.data() : null;
}

// ══════════════════════════════════════════════════════════════════════════
//  TRIGGER 1: Nueva postulación → notificar a la empresa
// ══════════════════════════════════════════════════════════════════════════
exports.onNuevaPostulacion = onDocumentCreated(
    "postulaciones/{postulacionId}",
    async (event) => {
        const data = event.data.data();
        if (!data.empresaId || !data.programadorId) return;

        const [empresa, programador] = await Promise.all([
            getUsuario(data.empresaId),
            getUsuario(data.programadorId)
        ]);

        if (!empresa?.email) return;

        await enviarCorreo(
            TEMPLATE_POSTULACION,
            empresa.nombre || "Empresa",
            empresa.email,
            `Nueva postulación en "${data.proyectoTitulo}"`,
            `El programador ${programador?.nombre || "un programador"} se postuló a tu proyecto "${data.proyectoTitulo}". Ingresa a Jobify para revisar su propuesta.`
        );
    }
);

// ══════════════════════════════════════════════════════════════════════════
//  TRIGGER 2: Cambio de estado → aceptado / rechazado
// ══════════════════════════════════════════════════════════════════════════
exports.onCambioPostulacion = onDocumentUpdated(
    "postulaciones/{postulacionId}",
    async (event) => {
        const antes   = event.data.before.data();
        const despues = event.data.after.data();

        if (antes.estado === despues.estado) return;
        if (antes.estado !== "pendiente") return;
        if (!["aceptado", "rechazado"].includes(despues.estado)) return;

        const [programador, empresa] = await Promise.all([
            getUsuario(despues.programadorId),
            getUsuario(despues.empresaId)
        ]);

        if (!programador?.email) return;

        if (despues.estado === "aceptado") {
            await enviarCorreo(
                TEMPLATE_POSTULACION,
                programador.nombre || "Programador",
                programador.email,
                `¡Fuiste aceptado en "${despues.proyectoTitulo}"!`,
                `¡Felicidades! La empresa ${empresa?.nombre || ""} aceptó tu postulación para "${despues.proyectoTitulo}". Ingresa a Jobify para firmar el contrato.`
            );
        } else {
            await enviarCorreo(
                TEMPLATE_POSTULACION,
                programador.nombre || "Programador",
                programador.email,
                `Actualización sobre tu postulación en "${despues.proyectoTitulo}"`,
                `La empresa ${empresa?.nombre || ""} seleccionó otro candidato para "${despues.proyectoTitulo}". ¡No te desanimes! Sigue explorando proyectos en Jobify.`
            );
        }
    }
);

// ══════════════════════════════════════════════════════════════════════════
//  TRIGGER 3: Proyecto completado → notificar a ambas partes
// ══════════════════════════════════════════════════════════════════════════
exports.onProyectoCompletado = onDocumentUpdated(
    "postulaciones/{postulacionId}",
    async (event) => {
        const antes   = event.data.before.data();
        const despues = event.data.after.data();

        if (antes.estadoProyecto === "completado") return;
        if (despues.estadoProyecto !== "completado") return;

        const [empresa, programador] = await Promise.all([
            getUsuario(despues.empresaId),
            getUsuario(despues.programadorId)
        ]);

        const titulo = despues.proyectoTitulo || "el proyecto";
        const msg    = `El proyecto "${titulo}" ha sido completado por ambas partes. Ingresa a Jobify para dejar tu valoración.`;
        const asunto = `El proyecto "${titulo}" ha sido completado`;

        await Promise.all([
            empresa?.email     ? enviarCorreo(TEMPLATE_PROYECTO, empresa.nombre     || "Empresa",      empresa.email,     asunto, msg) : Promise.resolve(),
            programador?.email ? enviarCorreo(TEMPLATE_PROYECTO, programador.nombre || "Programador",  programador.email, asunto, msg) : Promise.resolve()
        ]);
    }
);

// ══════════════════════════════════════════════════════════════════════════
//  TRIGGER 4: Nuevo proyecto → notificar programadores con intereses
// ══════════════════════════════════════════════════════════════════════════
exports.onNuevoProyecto = onDocumentCreated(
    "proyectos/{proyectoId}",
    async (event) => {
        const proyecto = event.data.data();
        if (!proyecto.tags || proyecto.tags.length === 0) return;

        const programadoresSnap = await db.collection("usuarios")
            .where("rol", "==", "Programador")
            .where("perfilCompleto", "==", true)
            .get();

        const correos = [];

        programadoresSnap.forEach(doc => {
            const prog = doc.data();
            if (!prog.email || !prog.habilidades) return;

            const coincide = proyecto.tags.some(tag =>
                prog.habilidades.includes(tag)
            );

            if (coincide) {
                correos.push(enviarCorreo(
                    TEMPLATE_POSTULACION,
                    prog.nombre || "Programador",
                    prog.email,
                    `Nuevo proyecto disponible: "${proyecto.titulo}"`,
                    `Hay un nuevo proyecto que coincide con tus habilidades: "${proyecto.titulo}". Presupuesto: $${proyecto.presupuesto} USD · Nivel: ${proyecto.nivel}. Ingresa a Jobify para postularte.`
                ));
            }
        });

        await Promise.all(correos);
        console.log(`✅ Notificados ${correos.length} programadores sobre "${proyecto.titulo}"`);
    }
);

// ══════════════════════════════════════════════════════════════════════════
//  TRIGGER 5: Recordatorios automáticos de entrega (8 AM México cada día)
// ══════════════════════════════════════════════════════════════════════════
exports.recordatoriosEntrega = onSchedule(
    { schedule: "0 8 * * *", timeZone: "America/Mexico_City" },
    async () => {
        const ahora = new Date();

        const postuSnap = await db.collection("postulaciones")
            .where("estado", "==", "aceptado")
            .where("contratoFirmadoEmpresa", "==", true)
            .where("contratoFirmadoProgramador", "==", true)
            .get();

        for (const doc of postuSnap.docs) {
            const postu = doc.data();
            if (postu.estadoProyecto === "completado") continue;
            if (!postu.fechaInicio) continue;

            const proySnap = await db.collection("proyectos").doc(postu.proyectoId).get();
            if (!proySnap.exists) continue;
            const proyecto = proySnap.data();
            if (!proyecto.duracionSemanas) continue;

            const fechaInicio   = new Date(postu.fechaInicio);
            const fechaEntrega  = new Date(fechaInicio.getTime() + proyecto.duracionSemanas * 7 * 86400000);
            const diasRestantes = Math.ceil((fechaEntrega - ahora) / 86400000);

            if (![10, 8, 6, 4, 2, 0].includes(diasRestantes)) continue;

            const [empresa, programador] = await Promise.all([
                getUsuario(postu.empresaId),
                getUsuario(postu.programadorId)
            ]);

            const asunto = diasRestantes === 0
                ? `🚨 Hoy es la fecha de entrega de "${postu.proyectoTitulo}"`
                : `⏰ Faltan ${diasRestantes} días para entregar "${postu.proyectoTitulo}"`;

            const mensaje = diasRestantes === 0
                ? `Hoy es la fecha límite del proyecto "${postu.proyectoTitulo}". Asegúrate de marcarlo como finalizado en Jobify.`
                : `Quedan ${diasRestantes} días para la entrega del proyecto "${postu.proyectoTitulo}". Revisa el avance en el workspace de Jobify.`;

            await Promise.all([
                empresa?.email     ? enviarCorreo(TEMPLATE_PROYECTO, empresa.nombre     || "Empresa",     empresa.email,     asunto, mensaje) : Promise.resolve(),
                programador?.email ? enviarCorreo(TEMPLATE_PROYECTO, programador.nombre || "Programador", programador.email, asunto, mensaje) : Promise.resolve()
            ]);

            console.log(`✅ Recordatorio: "${postu.proyectoTitulo}" — faltan ${diasRestantes} días`);
        }
    }
);