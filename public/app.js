document.addEventListener("DOMContentLoaded", function () {
  let currentStep = 1;
  const totalSteps = 5;

  const screens = {
    1: document.getElementById("screen1"),
    2: document.getElementById("screen2"),
    3: document.getElementById("screen3"),
    4: document.getElementById("screen4"),
    5: document.getElementById("screen5")
  };

  const age = document.getElementById("age");
  const theme = document.getElementById("theme");
  const services = document.querySelectorAll('input[name="service"]');
  const fields = ["name", "phone", "email", "date", "location", "notes"];

  const progress = document.querySelector(".progress");
  const progressFill = document.getElementById("progressFill");
  const progressSteps = document.querySelectorAll(".progress-step");
  const wizardForm = document.getElementById("wizardForm");
  const successMessage = document.getElementById("successMessage");
  const payButton = document.getElementById("payButton");
  const paymentError = document.getElementById("paymentError");

  function value(id) {
    return document.getElementById(id).value.trim();
  }

  function getSelectedServices() {
    return Array.from(services).filter(function (service) {
      return service.checked;
    });
  }

  // Solo para mostrar. El precio real lo calcula el servidor.
  function getTotal() {
    return getSelectedServices().reduce(function (total, service) {
      return total + Number(service.dataset.price);
    }, 0);
  }

  function updateSummary() {
    const selected = getSelectedServices();

    document.getElementById("summaryAge").textContent = age.value || "Sin seleccionar";
    document.getElementById("summaryTheme").textContent = theme.value || "Sin seleccionar";
    document.getElementById("summaryServices").textContent =
      selected.length > 0
        ? selected
            .map(function (s) {
              return s.dataset.nombre + " (" + s.dataset.price + " €)";
            })
            .join(", ")
        : "Sin seleccionar";
    document.getElementById("summaryName").textContent = value("name") || "-";
    document.getElementById("summaryDate").textContent = value("date") || "Sin indicar";
    document.getElementById("summaryTotal").textContent = getTotal() + " €";
    document.getElementById("liveTotal").textContent = getTotal() + " €";

    payButton.textContent = "Pagar " + getTotal() + " € con Stripe 💳";
  }

  function showStep(step, scroll) {
    Object.values(screens).forEach(function (screen) {
      screen.classList.remove("active");
    });
    screens[step].classList.add("active");

    progressSteps.forEach(function (progressStep) {
      const number = Number(progressStep.dataset.step);
      progressStep.classList.remove("active", "completed");
      if (number === step) progressStep.classList.add("active");
      if (number < step) progressStep.classList.add("completed");
    });

    progressFill.style.width = ((step - 1) / (totalSteps - 1)) * 100 + "%";
    updateSummary();

    if (scroll !== false) {
      document.getElementById("personalizar").scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  function toggleError(id, hasError) {
    document.getElementById(id).classList.toggle("show", hasError);
    return !hasError;
  }

  function validateAge() {
    return toggleError("ageError", age.value === "");
  }

  function validateTheme() {
    return toggleError("themeError", theme.value === "");
  }

  function validateServices() {
    return toggleError("servicesError", getSelectedServices().length === 0);
  }

  function validateData() {
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value("email"));
    return toggleError("dataError", value("name") === "" || value("phone") === "" || !emailOk);
  }

  const validators = { 1: validateAge, 2: validateTheme, 3: validateServices, 4: validateData };

  [1, 2, 3, 4].forEach(function (n) {
    document.getElementById("next" + n).addEventListener("click", function () {
      if (validators[n]()) {
        currentStep = n + 1;
        showStep(currentStep);
      }
    });
  });

  [2, 3, 4, 5].forEach(function (n) {
    document.getElementById("back" + n).addEventListener("click", function () {
      currentStep = n - 1;
      showStep(currentStep);
    });
  });

  age.addEventListener("change", function () {
    toggleError("ageError", false);
    updateSummary();
  });

  theme.addEventListener("change", function () {
    toggleError("themeError", false);
    updateSummary();
  });

  services.forEach(function (service) {
    service.addEventListener("change", function () {
      toggleError("servicesError", false);
      updateSummary();
    });
  });

  // ---------- Guardar el formulario por si el cliente cancela en Stripe ----------

  function saveDraft() {
    try {
      const draft = {
        age: age.value,
        theme: theme.value,
        services: getSelectedServices().map(function (s) { return s.value; })
      };
      fields.forEach(function (id) { draft[id] = value(id); });
      sessionStorage.setItem("fiestaDraft", JSON.stringify(draft));
    } catch (e) { /* si el navegador no deja, no pasa nada */ }
  }

  function restoreDraft() {
    try {
      const draft = JSON.parse(sessionStorage.getItem("fiestaDraft") || "null");
      if (!draft) return false;
      age.value = draft.age || "";
      theme.value = draft.theme || "";
      services.forEach(function (s) { s.checked = (draft.services || []).includes(s.value); });
      fields.forEach(function (id) { document.getElementById(id).value = draft[id] || ""; });
      return true;
    } catch (e) {
      return false;
    }
  }

  // ---------- Pago ----------

  wizardForm.addEventListener("submit", async function (event) {
    event.preventDefault();

    if (!validateAge() || !validateTheme() || !validateServices() || !validateData()) {
      paymentError.textContent = "Faltan datos en algún paso. Vuelve atrás y revísalos.";
      paymentError.classList.add("show");
      return;
    }

    paymentError.classList.remove("show");
    payButton.disabled = true;
    payButton.textContent = "Conectando con Stripe…";

    try {
      const response = await fetch("/.netlify/functions/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          edad: age.value,
          tematica: theme.value,
          servicios: getSelectedServices().map(function (s) { return s.value; }),
          cliente: {
            nombre: value("name"),
            telefono: value("phone"),
            email: value("email"),
            fecha: value("date"),
            lugar: value("location"),
            notas: value("notes")
          }
        })
      });

      const data = await response.json();
      if (!response.ok || !data.url) throw new Error(data.error || "Error desconocido");

      saveDraft();
      window.location.href = data.url; // página de pago de Stripe
    } catch (err) {
      paymentError.textContent = err.message || "No se ha podido iniciar el pago.";
      paymentError.classList.add("show");
      payButton.disabled = false;
      updateSummary();
    }
  });

  // ---------- Vuelta desde Stripe ----------

  function showSuccess(icon, title, text, total) {
    document.getElementById("successIcon").textContent = icon;
    document.getElementById("successTitle").textContent = title;
    document.getElementById("successText").textContent = text;
    document.getElementById("successTotalRow").style.display = total ? "block" : "none";
    document.getElementById("finalTotal").textContent = total ? total + " €" : "";
    wizardForm.style.display = "none";
    progress.style.display = "none";
    successMessage.classList.add("show");
    document.getElementById("personalizar").scrollIntoView({ block: "start" });
  }

  async function handleReturn() {
    const params = new URLSearchParams(window.location.search);
    const estado = params.get("pago");
    if (!estado) return false;

    // Limpia la URL para que al recargar no se repita
    history.replaceState(null, "", window.location.pathname + "#personalizar");

    if (estado === "cancelado") {
      if (restoreDraft()) {
        currentStep = 5;
        showStep(5, false);
      }
      document.getElementById("cancelNotice").classList.add("show");
      document.getElementById("personalizar").scrollIntoView({ block: "start" });
      return true;
    }

    if (estado === "ok") {
      sessionStorage.removeItem("fiestaDraft");
      showSuccess(
        "🎉",
        "¡Pago completado!",
        "Hemos recibido tu reserva. Stripe te enviará el justificante por correo.",
        null
      );
      return true;
    }
    return false;
  }

  document.getElementById("restart").addEventListener("click", function () {
    wizardForm.reset();
    sessionStorage.removeItem("fiestaDraft");
    document.getElementById("cancelNotice").classList.remove("show");
    wizardForm.style.display = "block";
    progress.style.display = "flex";
    successMessage.classList.remove("show");
    currentStep = 1;
    showStep(currentStep);
  });

  document.getElementById("menuToggle").addEventListener("click", function () {
    document.getElementById("navLinks").classList.toggle("open");
  });

  document.querySelectorAll("#navLinks a").forEach(function (link) {
    link.addEventListener("click", function () {
      document.getElementById("navLinks").classList.remove("open");
    });
  });

  handleReturn().then(function (handled) {
    if (!handled) showStep(1, false);
  });
});
