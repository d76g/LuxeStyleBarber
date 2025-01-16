'use strict';



/**
 * add event on element
 */

const addEventOnElem = function (elem, type, callback) {
  if (elem.length > 1) {
    for (let i = 0; i < elem.length; i++) {
      elem[i].addEventListener(type, callback);
    }
  } else {
    elem.addEventListener(type, callback);
  }
}



/**
 * navbar toggle
 */

const navbar = document.querySelector("[data-navbar]");
const navToggler = document.querySelector("[data-nav-toggler]");
const navLinks = document.querySelectorAll("[data-nav-link]");

const toggleNavbar = () => navbar.classList.toggle("active");

addEventOnElem(navToggler, "click", toggleNavbar);

const closeNavbar = () => navbar.classList.remove("active");

addEventOnElem(navLinks, "click", closeNavbar);



/**
 * header & back top btn active when scroll down to 100px
 */

const header = document.querySelector("[data-header]");
const backTopBtn = document.querySelector("[data-back-top-btn]");

const headerActive = function () {
  if (window.scrollY > 100) {
    header.classList.add("active");
    backTopBtn.classList.add("active");
  } else {
    header.classList.remove("active");
    backTopBtn.classList.remove("active");
  }
}

addEventOnElem(window, "scroll", headerActive);



/**
 * filter function
 */

const filterBtns = document.querySelectorAll("[data-filter-btn]");
const filterItems = document.querySelectorAll("[data-filter]");

let lastClickedFilterBtn = filterBtns[0];

const filter = function () {
  lastClickedFilterBtn.classList.remove("active");
  this.classList.add("active");
  lastClickedFilterBtn = this;

  for (let i = 0; i < filterItems.length; i++) {
    if (this.dataset.filterBtn === filterItems[i].dataset.filter ||
      this.dataset.filterBtn === "all") {

      filterItems[i].style.display = "block";
      filterItems[i].classList.add("active");

    } else {

      filterItems[i].style.display = "none";
      filterItems[i].classList.remove("active");

    }
  }
}

addEventOnElem(filterBtns, "click", filter);

const products = [
  // Waxen Products
  { id: 1, category: "waxen", img: "assets/images/wax_8.png", title: "Bandido ", description: "Aqua Wax 8" },
  { id: 2, category: "waxen", img: "assets/images/wax_6.png", title: "Bandido ", description: "Aqua Wax 7 " },
  { id: 3, category: "waxen", img: "assets/images/wax_10.png", title: "Bandido ", description: "Aqua Wax 6" },
  { id: 4, category: "waxen", img: "assets/images/wax_7.png", title: "Bandido", description: "Aqua Wax 5" },
  { id: 5, category: "waxen", img: "assets/images/wax_2.png", title: "Bandido ", description: "Aqua Wax 4" },
  { id: 6, category: "waxen", img: "assets/images/wax_1.png", title: "Bandido ", description: "Cream Pomades" },
  { id: 7, category: "waxen", img: "assets/images/wax_3.png", title: "Bandido ", description: "Matte" },
  { id: 8, category: "waxen", img: "assets/images/wax_5.png", title: "Bandido", description: "Fire Wax" },
  { id: 9, category: "waxen", img: "assets/images/wax_12.png", title: "Wax", description: "Extra Volume / Hair Styling" },
  // Add remaining waxen products (10 total)

  // Parfums Products
  { id: 10, category: "parfums", img: "assets/images/parfum_1.png", title: "CARTEL PARIS", description: "Flores De Diamantes" },
  { id: 11, category: "parfums", img: "assets/images/parfum_2.png", title: "KIRKE PARIS", description: "Collection Intense" },
  { id: 12, category: "parfums", img: "assets/images/parfum_3.png", title: "MULA PARIS", description: "Collection Intense" },
  { id: 13, category: "parfums", img: "assets/images/parfum_4.png", title: "ANTHRACITE PARIS", description: "Collection Intense" },
  { id: 14, category: "parfums", img: "assets/images/parfum_5.png", title: "KHAMRAH PARIS", description: "Collection Intense" },
  { id: 15, category: "parfums", img: "assets/images/parfum_6.png", title: "CARTEL PARIS", description: "Oude De Seda" },
  { id: 16, category: "parfums", img: "assets/images/parfum_7.png", title: "MUSC BLANCE PARIS", description: "Collection Intense" },
  { id: 17, category: "parfums", img: "assets/images/parfum_8.png", title: "CARTEL PARIS", description: "Rey" },
  { id: 18, category: "parfums", img: "assets/images/parfum_9.png", title: "ERBA PARIS", description: "Collection Intense" },
  { id: 19, category: "parfums", img: "assets/images/parfum_11.png", title: "SUPREME VANILLE", description: "Elixir Collection Paris" },
  // Add remaining parfums products (10 total)

  // Other Products
  { id: 20, category: "other", img: "assets/images/cologne_4.png", title: "Bandido", description: "Berlin Exclusive / Cologne 6" },
  { id: 21, category: "other", img: "assets/images/cologne_1.png", title: "Bandido", description: "Lemon Exclusive / Cologne 3" },
  { id: 22, category: "other", img: "assets/images/cologne_3.png", title: "Bandido", description: "Moscow Exclusive / Cologne 2" },
  { id: 23, category: "other", img: "assets/images/cologne_2.png", title: "Bandido", description: "Las Vegas Exclusive / Cologne 1" },
  { id: 24, category: "other", img: "assets/images/oil_1.png", title: "Bandido", description: "Beard Oil Sliver, Limited Edition" },
  { id: 25, category: "other", img: "assets/images/oil_2.png", title: "Bandido", description: "Beard Oil Golden, Limited Edition" },
  
  
  // Add remaining other products (7 total)
];

let currentFilter = "all";
let visibleProducts = 8;

function filterProducts(category) {
  currentFilter = category;
  visibleProducts = 8;
  renderProducts();
}

function loadMoreProducts() {
  visibleProducts += 8;
  renderProducts();
}

function renderProducts() {
  const container = document.getElementById("productsContainer");
  const seeMoreButton = document.getElementById("seeMoreButton");

  container.innerHTML = ""; // Clear existing products

  const filteredProducts = currentFilter === "all" ? products : products.filter(p => p.category === currentFilter);

  filteredProducts.slice(0, visibleProducts).forEach(product => {
    const card = `
      <div class="card ${product.category}">
        <img src="${product.img}" alt="${product.title}">
        <div class="card-content">
          <h2 class="card-title">${product.title}</h2>
          <p class="card-description">${product.description}</p>
        </div>
      </div>
    `;
    container.innerHTML += card;
  });

  // Show or hide the See More button
  if (visibleProducts >= filteredProducts.length) {
    seeMoreButton.classList.add("hidden");
  } else {
    seeMoreButton.classList.remove("hidden");
  }
}

// Initialize products
renderProducts();
