// Devuelve los pedidos pagados, leyéndolos directamente de Stripe.
// Solo responde si se envía la contraseña correcta (ADMIN_PASSWORD).
import Stripe from "stripe";
import { timingSafeEqual } from "node:crypto";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const MAX_PEDIDOS = 500;

function passwordCorrecta(recibida) {
  const esperada = process.env.ADMIN_PASSWORD || "";
  const a = Buffer.from(String(recibida || ""));
  const b = Buffer.from(esperada);
  // timingSafeEqual: compara sin dar pistas por el tiempo de respuesta
  return esperada !== "" && a.length === b.length && timingSafeEqual(a, b);
}

function json(status, datos) {
  return new Response(JSON.stringify(datos), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }
  });
}

export default async (req) => {
  if (req.method !== "POST") return json(405, { error: "Método no permitido" });

  if (!passwordCorrecta(req.headers.get("x-admin-password"))) {
    // Espera 1 segundo para frenar a quien intente adivinar la contraseña
    await new Promise((r) => setTimeout(r, 1000));
    return json(401, { error: "Contraseña incorrecta" });
  }

  try {
    const pedidos = [];

    for await (const s of stripe.checkout.sessions.list({ limit: 100, status: "complete" })) {
      if (s.payment_status !== "paid") continue;
      const m = s.metadata || {};
      const c = s.customer_details || {};

      pedidos.push({
        fecha_pago: new Date(s.created * 1000).toISOString(),
        nombre: m.nombre || c.name || "",
        email: c.email || s.customer_email || "",
        telefono: m.telefono || c.phone || "",
        fecha_fiesta: m.fecha_fiesta || "",
        lugar: m.lugar || "",
        edad: m.edad || "",
        tematica: m.tematica || "",
        servicios: m.servicios || "",
        total: (s.amount_total || 0) / 100,
        notas: m.notas || ""
      });

      if (pedidos.length >= MAX_PEDIDOS) break;
    }

    return json(200, { pedidos });
  } catch (err) {
    console.error("Error leyendo Stripe:", err.message);
    return json(500, { error: "No se han podido cargar los pedidos." });
  }
};

export const config = { path: "/api/pedidos" };
