export const footerData = (brand) => ({
  section1: {
    title: "Location & Contact",
    items: [
      {
        label: brand.addressLabel || "Address",
        text: brand.address,
        path: brand.address
          ? "https://maps.app.goo.gl/DhSrjLydLQ5VPy3e7"
          : null,
        target: "_blank"
      },
      {
        label: "Phone",
        text: brand.phone,
        path: `tel:${brand.phone}`
      },
      {
        label: "Hours",
        text: brand.hours,
        path: null
      }
    ],
    showNewsletter: true
  },

  section2: {
    title: "Company Info",
    items: [
      { text: "About Us", path: "/about" },
      { text: "Privacy Policy", path: "/privacy" },
      { text: "Contact Our Team", path: "/contact" },
      { text: "Terms & Conditions", path: "/terms" }
    ],
    textAlign: "text-center text-md-start text-lg-end"
  },

  section3: {
    title: "Customer Service",
    items: [
      { text: "Returns & Exchanges", path: "/returns" },
      { text: "Special Requests", path: "/requests" },
      { text: "Order Status", path: "/order-status" },
      { text: "Shipping Information", path: "/shipping" }
    ],
    textAlign: "text-center text-md-center text-lg-end"
  },

  section4: {
    title: "Resources",
    items: [
      { text: "Customer Forms", path: "/customer-forms" },
      { text: "Account Login", path: "/login" },
      { text: "Vendor Information", path: "/vendor-information" },
      { text: "Join Our Team", path: "/careers" }
    ],
    textAlign: "text-center text-md-end text-lg-end"
  }
});
