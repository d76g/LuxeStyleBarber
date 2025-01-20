document.addEventListener("DOMContentLoaded", function () {
  const form = document.getElementById("appointmentForm");

  form.addEventListener("submit", async function (e) {
    e.preventDefault();

    // Get form values
    const formData = {
      name: document.getElementById("name").value,
      email: document.getElementById("email").value,
      phone: document.getElementById("phone").value,
      category: document.getElementById("category").value,
      date: document.getElementById("date").value,
      time: document.getElementById("time").value,
      barberName:document.getElementById("barberName").value,
      message: document.getElementById("message").value,
    };

    // Handle the submit button state
    const button = form.querySelector('button[type="submit"]');
    const originalText = button.innerHTML; // Capture the original button text
    button.innerHTML = '<span class="span">Verwerken...</span>';
    button.disabled = true;

    const prodApiURL = "https://www.luxestylebarber.nl/book-appointment";
    const testApiURL = 'http://localhost:3000/book-appointment';

    try {
      // Send data to server
      const response = await fetch('/book-appointment', {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      const result = await response.json();

      if (response.status === 200) {
        // Show success message
        Swal.fire({
          title: 'Succes',
          text: 'U ontvangt een bevestigingsmail',
          icon: 'success',
          confirmButtonText: 'Okè'
        })
        form.reset(); // Reset the form after successful submission
      } else {
        throw new Error(result.message || "Booking failed");
      }
    } catch (error) {
      // Show error message
      Swal.fire({
        title: 'Opps',
        text: 'Er is iets misgegaan, probeer ons te bellen voor een afspraak',
        icon: 'error',
        confirmButtonText: 'Okè'
      })
    } finally {
      // Reset button state
      button.innerHTML = originalText;
      button.disabled = false;
    }
  });

  // Add date validation to prevent past dates
  const dateInput = document.getElementById("date");
  dateInput.addEventListener("input", function () {
    const today = new Date().toISOString().split("T")[0];
    if (this.value < today) {
      Swal.fire({
        title: 'Opps',
        text: 'Selecteer een toekomstige datum',
        icon: 'error',
        confirmButtonText: 'Okè'
      })
      this.value = today;
    }
  });

  // Set minimum date to today
  dateInput.min = new Date().toISOString().split("T")[0];
});
