
/* =========================================
   PARAS BABA — RESPONSIVE MOBILE NAVIGATION
   ========================================= */

document.addEventListener("DOMContentLoaded", () => {

  const menuToggle = document.querySelector(".menu-toggle");
  const navMenu = document.querySelector(".nav-menu");

  // Stop safely if navigation elements are unavailable
  if (!menuToggle || !navMenu) {
    return;
  }

  const menuIcon = menuToggle.querySelector("i");

  // Close mobile navigation
  const closeMenu = () => {

    navMenu.classList.remove("is-open");

    menuToggle.setAttribute("aria-expanded", "false");
    menuToggle.setAttribute(
      "aria-label",
      "Open navigation menu"
    );

    if (menuIcon) {
      menuIcon.classList.add("fa-bars");
      menuIcon.classList.remove("fa-xmark");
    }

  };

  // Toggle mobile navigation
  menuToggle.addEventListener("click", (event) => {

    event.stopPropagation();

    const isOpen = navMenu.classList.toggle("is-open");

    menuToggle.setAttribute(
      "aria-expanded",
      String(isOpen)
    );

    menuToggle.setAttribute(
      "aria-label",
      isOpen
        ? "Close navigation menu"
        : "Open navigation menu"
    );

    if (menuIcon) {
      menuIcon.classList.toggle("fa-bars", !isOpen);
      menuIcon.classList.toggle("fa-xmark", isOpen);
    }

  });

  // Close menu after clicking a navigation link
  navMenu.querySelectorAll("a").forEach((link) => {

    link.addEventListener("click", () => {
      closeMenu();
    });

  });

  // Close menu when clicking outside the header
  document.addEventListener("click", (event) => {

    if (
      !event.target.closest("header") &&
      navMenu.classList.contains("is-open")
    ) {
      closeMenu();
    }

  });

  // Close menu when pressing Escape
  document.addEventListener("keydown", (event) => {

    if (
      event.key === "Escape" &&
      navMenu.classList.contains("is-open")
    ) {
      closeMenu();
      menuToggle.focus();
    }

  });

});
