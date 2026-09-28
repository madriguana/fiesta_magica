// Función que se ejecuta en los servidores de Netlify (no en el navegador).
// Aquí está la clave secreta de Stripe, guardada como variable de entorno.
const Stripe = require("stripe");
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

// Los precios SOLO se leen de aquí: aunque alguien cambie data-price con F12,
// paga el precio real.
const SERVICIOS = {
  animacion:  { nombre: "Animación y juegos",        precio: 120 },
  decoracion: { nombre: "Decoración temática",       precio: 80 },
  pintacaras: { nombre: "Pinta-caras y globoflexia", precio: 60 },
  magia:      { nombre: "Magia y espectáculos",      precio: 100 },
  catering:   { nombre: "Catering y tarta",          precio: 90 },
  hinchable:  { nombre: "Castillo hinchable",        precio: 150 }
};
const EDADES = ["1-3 años", "4-5 años", "6-7 años", "8-9 años", "10-12 años", "Más de 12 años"];
const TEMATICAS = ["Princesas", "Dinosaurios", "Unicornios", "Superhéroes", "Robots", "Espacio", "Animales"];

function texto(valor, max) {
  return typeof valor === "string" ? valor.trim().slice(0, max) : "";
}

function respuesta(status, datos) {
  return {
    statusCode: status,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(datos)
  };
}

exports.handler = async function (event) {
  if (event.httpMethod !== "POST") return respuesta(405, { error: "Método no permitido." });

  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch (e) {
    return respuesta(400, { error: "Datos no válidos." });
  }

  const cliente = body.cliente || {};
  const edad = texto(body.edad, 30);
  const tematica = texto(body.tematica, 30);
  const ids = Array.isArray(body.servicios) ? [...new Set(body.servicios)] : [];
  const nombre = texto(cliente.nombre, 100);
  const telefono = texto(cliente.telefono, 20);
  const email = texto(cliente.email, 120);
  const fecha = texto(cliente.fecha, 10);
  const lugar = texto(cliente.lugar, 150);
  const notas = texto(cliente.notas, 450);

  if (!EDADES.includes(edad)) return respuesta(400, { error: "Edad no válida." });
  if (!TEMATICAS.includes(tematica)) return respuesta(400, { error: "Temática no válida." });
  if (ids.length === 0 || ids.some((id) => !SERVICIOS[id])) {
    return respuesta(400, { error: "Selecciona al menos un servicio válido." });
  }
  if (!nombre || !telefono || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return respuesta(400, { error: "Revisa tu nombre, teléfono y correo." });
  }

  const seleccion = ids.map((id) => SERVICIOS[id]);
  const listaServicios = seleccion.map((s) => s.nombre).join(", ");
  const web = process.env.URL || "https://" + event.headers.host;

  // Todo esto queda guardado en Stripe y sale al exportar los pagos a Excel
  const datosPedido = {
    nombre, telefono, fecha_fiesta: fecha, lugar,
    edad, tematica, servicios: listaServicios, notas
  };

  try {
    const sesion = await stripe.checkout.sessions.create({
      mode: "payment",
      locale: "es",
      customer_email: email,
      line_items: seleccion.map((s) => ({
        quantity: 1,
        price_data: {
          currency: "eur",
          unit_amount: s.precio * 100, // en céntimos
          product_data: { name: s.nombre, description: `Fiesta de ${tematica} (${edad})` }
        }
      })),
      metadata: datosPedido,
      payment_intent_data: {
        description: `Fiesta ${tematica} (${edad}): ${listaServicios}`,
        metadata: datosPedido
      },
      success_url: `${web}/?pago=ok`,
      cancel_url: `${web}/?pago=cancelado`
    });

    return respuesta(200, { url: sesion.url });
  } catch (err) {
    console.error("Error de Stripe:", err.message);
    return respuesta(500, { error: "No se ha podido iniciar el pago. Inténtalo de nuevo." });
  }
};
