
    const menuToggle = document.querySelector(".menu-toggle");
    const navMenu = document.querySelector(".nav-menu");
    const menuIcon = menuToggle.querySelector("i");

    // Toggle mobile menu
    menuToggle.addEventListener("click", () => {

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

      menuIcon.classList.toggle("fa-bars", !isOpen);
      menuIcon.classList.toggle("fa-xmark", isOpen);

    });

    // Close menu after clicking a navigation link
    navMenu.querySelectorAll("a").forEach(link => {

      link.addEventListener("click", () => {

        navMenu.classList.remove("is-open");

        menuToggle.setAttribute("aria-expanded", "false");
        menuToggle.setAttribute(
          "aria-label",
          "Open navigation menu"
        );

        menuIcon.classList.add("fa-bars");
        menuIcon.classList.remove("fa-xmark");

      });

    });

    // Close menu when clicking outside the header
    document.addEventListener("click", event => {

      if (
        !event.target.closest("header") &&
        navMenu.classList.contains("is-open")
      ) {

        navMenu.classList.remove("is-open");

        menuToggle.setAttribute("aria-expanded", "false");
        menuToggle.setAttribute(
          "aria-label",
          "Open navigation menu"
        );

        menuIcon.classList.add("fa-bars");
        menuIcon.classList.remove("fa-xmark");

      }

    });