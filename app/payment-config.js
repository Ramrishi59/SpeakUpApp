window.SUPaymentsConfig = {
  enabled: true,
  keyId: "rzp_live_SeuVdqMO92PST8",
  amount: 49900,  // display only (paise) — the server sets the real charge
  currency: "INR",
  name: "SpeakUp",
  description: "SpeakUp Premium Access",
  themeColor: "#ff7a59",
  orderEndpoint: "https://us-central1-speakup-19106.cloudfunctions.net/createOrder",
  verifyEndpoint: "https://us-central1-speakup-19106.cloudfunctions.net/verifyPayment",
  supportMessage: "Payment setup is almost ready. Please contact the SpeakUp team to activate premium access."
};
