'use strict';
// Card and shipping fields belong to the hosted payment provider, never this page.
// A frontend redirect is not payment verification or cross-order enforcement.
const checkoutDialog=document.createElement('dialog');
checkoutDialog.id='checkout-dialog';
checkoutDialog.className='checkout-dialog';
checkoutDialog.setAttribute('aria-labelledby','checkout-title');
checkoutDialog.innerHTML=`
  <header class="checkout-head"><span class="wordmark"><strong>LEVUZO</strong></span><span class="checkout-step">ORDER REVIEW</span><button type="button" id="checkout-close" aria-label="Close checkout">×</button></header>
  <div class="checkout-layout">
    <section class="checkout-summary" aria-label="Order summary"><p class="eyebrow">YOUR ORBIT</p><h2 id="checkout-title">A new atmosphere.</h2><article class="checkout-item"><div><strong>Orbit</strong><p id="checkout-variant"></p><p>Quantity 1</p></div><span id="checkout-item-price"></span></article><div class="checkout-totals"><p class="checkout-saving"><span>Launch saving</span><span id="checkout-saving"></span></p><p class="checkout-total"><span>Subtotal</span><strong id="checkout-total"></strong></p></div><p class="checkout-summary-note">USD · Shipping and tax are not included.</p><p class="checkout-limit">Limit: one speaker per customer.</p></section>
    <section class="checkout-payment" aria-labelledby="checkout-payment-title"><p class="eyebrow">CHECKOUT</p><h3 id="checkout-payment-title">Checkout is temporarily unavailable.</h3><p class="checkout-intro" id="checkout-status" role="status">We’re not accepting orders yet. No payment has been taken and no order has been placed.</p><div class="accepted-cards" id="accepted-cards" aria-label="Accepted card brands" hidden></div><p class="checkout-delivery" id="checkout-delivery" hidden></p><button type="button" class="primary launch-cta" id="secure-checkout" disabled><span id="secure-checkout-label">Checkout unavailable</span><span aria-hidden="true">↗</span></button><p class="checkout-disclosure" id="checkout-disclosure">Please check back when ordering opens.</p><button class="checkout-back" id="checkout-back" type="button">Return to bag</button></section>
  </div>`;
document.body.append(checkoutDialog);
let checkoutOpening=false,checkoutLeaving=false,checkoutReturnFocus=null;
function configuredCheckout(item){
  const config=window.LevuzoCheckoutConfig;
  if(!config||config.enabled!==true||!validSelection(item))return null;
  const key=`${item.material}|${item.size}`;
  if(!Object.prototype.hasOwnProperty.call(config.links||{},key))return null;
  const value=config.links[key];
  if(typeof value!=='string')return null;
  try{
    const url=new URL(value);
    if(url.protocol!=='https:'||url.hostname!=='buy.stripe.com'||url.port||url.username||url.password||url.search||url.hash||!/^\/[A-Za-z0-9]+$/.test(url.pathname)||url.pathname.startsWith('/test_'))return null;
    return url.href;
  }catch{return null;}
}
function renderCheckout(){
  const item=bag[0],url=bag.length===1?configuredCheckout(item):null;
  $('#checkout-variant').textContent=validSelection(item)?`${item.material} / ${item.size}`:'';
  $('#checkout-item-price').textContent=money(launchOffer.price);
  $('#checkout-total').textContent=money(launchOffer.price);
  $('#checkout-saving').textContent=money(launchOffer.standard-launchOffer.price);
  $('#secure-checkout').disabled=!url;
  $('#secure-checkout-label').textContent=url?'Continue to secure payment':'Checkout unavailable';
  $('#checkout-payment-title').textContent=url?'Shipping & payment':'Checkout is temporarily unavailable.';
  $('#checkout-status').textContent=url?'Enter your US shipping address, full name and email on the next page. Then choose your payment method.':'We’re not accepting orders yet. No payment has been taken and no order has been placed.';
  $('#checkout-disclosure').textContent=url?'You’ll continue to Stripe’s hosted checkout. Card details are handled by Stripe and are never stored by this storefront.':'Please check back when ordering opens.';
  const cards=$('#accepted-cards');cards.replaceChildren();
  if(url)for(const name of window.LevuzoCheckoutConfig.acceptedCards||[]){if(!['Visa','Mastercard','American Express','Discover'].includes(name))continue;const badge=document.createElement('span');badge.className='card-brand';badge.textContent=name;cards.append(badge);}
  cards.hidden=!cards.childElementCount;
  const delivery=$('#checkout-delivery');
  delivery.hidden=true;
  delivery.textContent='';
}
async function openCheckout(){
  if(checkoutOpening||checkoutDialog.open||bag.length!==1||!validSelection(bag[0]))return;
  checkoutOpening=true;checkoutLeaving=false;checkoutReturnFocus=document.activeElement;
  try{renderCheckout();if($('#bag-dialog').open)await closeDialog($('#bag-dialog'));checkoutDialog.showModal();window.LevuzoMotion?.dialogOpened(checkoutDialog);$('#checkout-close').focus({preventScroll:true});}finally{checkoutOpening=false;}
}
async function closeCheckout(){await closeDialog(checkoutDialog);const target=checkoutReturnFocus?.isConnected&&!checkoutReturnFocus.closest('dialog:not([open])')?checkoutReturnFocus:document.querySelector('.bag-button');target?.focus({preventScroll:true});}
$('#checkout-close').addEventListener('click',closeCheckout);
$('#checkout-back').addEventListener('click',async()=>{await closeDialog(checkoutDialog);openDialog('bag-dialog');});
checkoutDialog.addEventListener('cancel',event=>{event.preventDefault();closeCheckout();});
checkoutDialog.addEventListener('click',event=>{if(event.target!==checkoutDialog)return;const rect=checkoutDialog.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)closeCheckout();});
$('#secure-checkout').addEventListener('click',()=>{
  if(checkoutLeaving||bag.length!==1)return;
  const url=configuredCheckout(bag[0]);
  if(!url){renderCheckout();return;}
  checkoutLeaving=true;$('#secure-checkout').disabled=true;$('#secure-checkout-label').textContent='Opening secure checkout…';
  window.location.assign(url);
});
window.addEventListener('pageshow',()=>{checkoutLeaving=false;if(checkoutDialog.open)renderCheckout();});
