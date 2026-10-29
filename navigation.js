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
    if (!url) return;
    window.location.href = url;
  }

  function routeLabelFromNode(node) {
    if (!node) return "";
    return (node.getAttribute("aria-label") || node.textContent || "").replace(/\s+/g, " ").trim();
  }

  function bindRouteNode(node, url) {
    if (!node || node.dataset.enairBound === "true") return;
    node.dataset.enairBound = "true";
    node.style.cursor = "pointer";
    node.tabIndex = 0;
    node.setAttribute("role", "button");
    node.setAttribute("aria-label", routeLabelFromNode(node) || "Action");

    const trigger = (event) => {
      if (event && event.type === "keydown") {
        const key = event.key || "";
        if (key !== "Enter" && key !== " " && key !== "Spacebar") return;
      }
      if (event) {
        event.preventDefault && event.preventDefault();
        event.stopPropagation && event.stopPropagation();
      }
      go(url);
    };

    node.addEventListener("click", trigger);
    node.addEventListener("keydown", trigger);
  }

  function bindText(text, handler, occurrence = 0) {
    const nodes = [...document.querySelectorAll("button, a, div, span")];
    let found = 0;

    for (const node of nodes) {
      if (!node || !node.textContent) continue;
      const value = (node.textContent || "").replace(/\s+/g, " ").trim();
      if (value.toLowerCase() === text.toLowerCase()) {
        if (found === occurrence) {
          bindRouteNode(node, typeof handler === "function" ? null : handler);
          if (typeof handler === "function") {
            const old = node.dataset.enairCustomHandler;
            if (old !== "true") {
              node.dataset.enairCustomHandler = "true";
              node.addEventListener("click", function (event) {
                event.preventDefault && event.preventDefault();
                event.stopPropagation && event.stopPropagation();
                handler(event, node);
              });
            }
          }
          return true;
        }
        found += 1;
      }
    }
    return false;
  }

  function bindRouteMap() {
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

    document.querySelectorAll("[data-route]").forEach((el) => {
      const url = el.dataset.route;
      bindRouteNode(el, url);
    });
  }

  function createMapPicker(containerSelector, items, className) {
    const container = document.querySelector(containerSelector);
    if (!container || container.querySelector("." + className)) return;

    const picker = document.createElement("div");
    picker.className = className;

    items.forEach(({ label, route }) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = className.replace("picker", "city") + " " + className.replace("picker", "city");
      btn.textContent = label;
      btn.dataset.route = route;
      btn.setAttribute("aria-label", label);
      btn.addEventListener("click", function (event) {
        event.preventDefault();
        go(route);
      });
      picker.appendChild(btn);
    });

    container.appendChild(picker);
  }

  function ensureMapPickers() {
    createMapPicker(".map-illustration-95", [
      { label: "New York", route: routes.booking },
      { label: "London", route: routes.booking },
      { label: "Dubai", route: routes.booking },
      { label: "Tokyo", route: routes.booking },
      { label: "Sydney", route: routes.booking },
      { label: "São Paulo", route: routes.booking },
    ], "enair-map-picker");

    createMapPicker(".interactive-visual-map-44", [
      { label: "Tokyo", route: routes.booking },
      { label: "London", route: routes.booking },
      { label: "Rome", route: routes.booking },
      { label: "Singapore", route: routes.booking },
      { label: "Sydney", route: routes.booking },
    ], "enair-destination-map-picker");
  }

  function makeStaticLinksInteractive() {
    document.querySelectorAll("[data-route]").forEach((node) => {
      const url = node.dataset.route;
      if (!url || node.dataset.enairBound === "true") return;
      bindRouteNode(node, url);
    });
  }

  function safeInit() {
    try {
      makeStaticLinksInteractive();
      bindRouteMap();
      ensureMapPickers();
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
