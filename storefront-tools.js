(() => {
  'use strict';
  const lifecycle=new AbortController();
  const registry=document.modelContext;
  if(registry?.registerTool){
    const registrations=[
      {name:'set_product_lighting',description:'Switch the live 3D product model between daylight and blue illumination.',inputSchema:{type:'object',properties:{mode:{type:'string',enum:['day','night']}},required:['mode'],additionalProperties:false},annotations:{readOnlyHint:false},execute:async input=>{if(!input||!['day','night'].includes(input.mode)||Object.keys(input).length!==1)throw new Error('Expected day or night mode.');document.querySelector('#day-night [data-light="'+input.mode+'"]').click();return {mode:input.mode};}},
      {name:'explore_product_feature',description:'Open the same product information drawer used by the feature cards.',inputSchema:{type:'object',properties:{feature:{type:'string',enum:['levitation','rotation','audio','light']}},required:['feature'],additionalProperties:false},annotations:{readOnlyHint:false},execute:input=>{const keys={levitation:'movement',rotation:'movement',audio:'strap',light:'dial'};if(!input||!Object.hasOwn(keys,input.feature)||Object.keys(input).length!==1)throw new Error('Unknown feature.');document.querySelector(`[data-info="${keys[input.feature]}"]`).click();return {feature:input.feature,opened:true};}},
      {name:'start_order_review',description:'Open the order review for one Orbit. Does not place an order or collect payment.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:false},execute:async input=>{if(input&&Object.keys(input).length)throw new Error('No input is accepted.');document.querySelector('#add-bag').click();return {product:'Levuzo Orbit',subtotalUSD:249,quantity:1,paymentCollected:false};}}
    ];
    registrations.forEach(tool=>{try{Promise.resolve(registry.registerTool(tool,{signal:lifecycle.signal})).catch(()=>{});}catch{}});
  }
  window.addEventListener('pagehide',event=>{if(!event.persisted)lifecycle.abort();});
})();
