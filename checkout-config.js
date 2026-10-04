'use strict';
// Public configuration only. Never place payment API keys or customer data here.
// A link is enabled only after its merchant, price, variant, US shipping,
// quantity, customer-name/email collection, receipts and policies are verified.
window.LevuzoCheckoutConfig=Object.freeze({
  enabled:false,
  links:Object.freeze({}),
  acceptedCards:Object.freeze([]),
  deliveryEstimate:null
});
