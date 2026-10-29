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

  function bindText(text, handler, occurrence = 0) {
    const nodes = [...document.querySelectorAll("button, a, div, span")];
    let found = 0;

    for (const node of nodes) {
      if (!node || !node.textContent) continue;
      const value = (node.textContent || "").replace(/\s+/g, " ").trim();
      if (value.toLowerCase() === text.toLowerCase()) {
        if (found === occurrence) {
          node.style.cursor = "pointer";
          node.addEventListener("click", function (event) {
            event.preventDefault();
            handler(event, node);
          });
          return true;
        }
        found += 1;
      }
    }
    return false;
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
