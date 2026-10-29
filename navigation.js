(function () {
  "use strict";

  const routes = {
    home: "enair-homepage.html",
    destinations: "enair-destinations.html",
    booking: "enair-booking.html",
    search: "booking-search.html",
    fare: "booking-select-fare.html",
    passengers: "booking-passengers.html",
    payment: "booking-payment.html",
    fleet: "enair-fleet-experience.html",
    loyalty: "enair-loyalty.html",
    about: "enair-about-contact.html",
    rewards: "enair-rewards-enrollment.html",
  };

  function go(url) {
    if (url) window.location.href = url;
  }

  function attachInteractive(node, handler) {
    if (!node || node.dataset.enairBound === "true") return;

    node.dataset.enairBound = "true";
    node.style.cursor = "pointer";
    node.tabIndex = 0;
    node.setAttribute("role", "button");
    node.setAttribute("aria-label", node.textContent ? node.textContent.trim() : "Action");

    const run = function (event) {
      if (event && event.type === "keydown") {
        const key = event.key || "";
        if (key !== "Enter" && key !== " " && key !== "Spacebar") return;
      }

      if (event) {
        event.preventDefault && event.preventDefault();
        event.stopPropagation && event.stopPropagation();
      }

      handler(event, node);
    };

    node.addEventListener("click", run);
    node.addEventListener("keydown", run);
  }

  function bindText(text, handler) {
    const nodes = [...document.querySelectorAll("button, a, div, span")];
    let matched = 0;

    for (const node of nodes) {
      if (!node || !node.textContent) continue;
      const value = (node.textContent || "").replace(/\s+/g, " ").trim();
      if (value.toLowerCase() === text.toLowerCase()) {
        attachInteractive(node, handler);
        matched += 1;
      }
    }

    return matched > 0;
  }

  function bindNavigation() {
    const map = {
      Home: routes.home,
      Destinations: routes.destinations,
      "Book Flights": routes.booking,
      "Our Fleet": routes.fleet,
      Loyalty: routes.loyalty,
      "About eNAir": routes.about,
      "Book Now": routes.booking,
      Search: routes.search,
      "View Flights": routes.search,
      "Contact Support": routes.about,
      "Join eNAir Rewards": routes.rewards,
    };

    Object.entries(map).forEach(([label, url]) => {
      bindText(label, () => go(url));
    });
  }

  function bindGenericButtons() {
    const pairs = {
      "Book Now": routes.booking,
      "Book Flights": routes.booking,
      Search: routes.search,
      "View Flights": routes.search,
      Destinations: routes.destinations,
      "Our Fleet": routes.fleet,
      Loyalty: routes.loyalty,
      "About eNAir": routes.about,
      "Join eNAir Rewards": routes.rewards,
      "Contact Support": routes.about,
      Home: routes.home,
    };

    Object.entries(pairs).forEach(([label, url]) => {
      bindText(label, () => go(url));
    });
  }

  function safeInit() {
    try {
      bindNavigation();
      bindGenericButtons();
      if (window) {
        window.enairSafe = true;
      }
    } catch (error) {
      console.error("navigation.js failed to initialize:", error);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", safeInit);
  } else {
    safeInit();
  }
})();
